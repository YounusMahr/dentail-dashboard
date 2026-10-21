import { ObjectId } from 'mongodb';
import { db } from './db';
import { today } from './care-validation.mjs';
import { cleanPhone, getLiveConnection, sendEvolutionText, getEvolutionConfig } from './evolution';

export const messageTypes = [
  'appointment_confirmation',
  'appointment_reminder',
  'session_reminder',
  'follow_up',
  'payment_receipt',
  'waitlist_offer'
];

export const defaultTemplates = {
  appointment_confirmation: {
    en: 'Hello {{patient}}, your appointment at {{clinic}} is confirmed: {{details}}. Please contact us for changes.',
    ur: 'السلام علیکم {{patient}}، {{clinic}} میں آپ کی اپائنٹمنٹ کی تصدیق ہو گئی ہے: {{details}}۔ تبدیلی کے لیے کلینک سے رابطہ کریں۔'
  },
  appointment_reminder: {
    en: 'Hello {{patient}}, a reminder from {{clinic}} about your appointment: {{details}}.',
    ur: 'السلام علیکم {{patient}}، {{clinic}} کی طرف سے اپائنٹمنٹ کی یاد دہانی: {{details}}۔'
  },
  session_reminder: {
    en: 'Hello {{patient}}, your next treatment session at {{clinic}} is due: {{details}}. Please contact us to confirm.',
    ur: 'السلام علیکم {{patient}}، {{clinic}} میں آپ کا اگلا سیشن: {{details}}۔ تصدیق کے لیے رابطہ کریں۔'
  },
  follow_up: {
    en: 'Hello {{patient}}, {{clinic}} would like to arrange your follow-up: {{details}}. Please contact the clinic.',
    ur: 'السلام علیکم {{patient}}، {{clinic}} کی طرف سے فالو اپ کی یاد دہانی: {{details}}۔ کلینک سے رابطہ کریں۔'
  },
  payment_receipt: {
    en: 'Hello {{patient}}, {{clinic}} has recorded your payment: {{details}}. Thank you.',
    ur: 'السلام علیکم {{patient}}، {{clinic}} میں آپ کی ادائیگی درج ہو گئی ہے: {{details}}۔ شکریہ۔'
  },
  waitlist_offer: {
    en: 'Hello {{patient}}, a slot is available at {{clinic}}: {{details}}. Open your patient portal to accept; the slot is subject to availability.',
    ur: 'السلام علیکم {{patient}}، {{clinic}} میں وقت دستیاب ہے: {{details}}۔ قبول کرنے کے لیے اپنا پیشنٹ پورٹل کھولیں۔ بکنگ دستیابی سے مشروط ہے۔'
  }
};

export const normalizePhone = value => cleanPhone(value);

export function renderMessage(template, { patient, clinic, details }) {
  return template.replace(/\{\{(patient|clinic|details)\}\}/g, (_, key) => ({ patient, clinic, details })[key] || '');
}

export async function publicMessagingSettings(clinicId) {
  const database = await db();
  const stored = await database.collection('messagingSettings').findOne({ clinicId });
  const { defaultInstance } = getEvolutionConfig();
  const instanceName = stored?.instanceName || defaultInstance;

  const live = await getLiveConnection(instanceName);

  return {
    templates: { ...defaultTemplates, ...stored?.templates },
    instanceName,
    providerConnected: live.connected,
    connectionState: live.state,
    profileName: live.profileName,
    profilePicUrl: live.profilePicUrl,
    ownerNumber: live.ownerNumber,
    allInstances: live.allInstances || []
  };
}

export async function saveMessagingSettings(clinicId, body) {
  const updateData = { updatedAt: new Date() };

  if (body.templates) {
    const templates = {};
    for (const type of messageTypes) {
      templates[type] = {};
      for (const lang of ['en', 'ur']) {
        const text = String(body.templates?.[type]?.[lang] || '').trim();
        if (!text || text.length > 1500) throw new Error('Each template needs 1–1500 characters');
        if (/\{\{(?!patient\}\}|clinic\}\}|details\}\})/.test(text)) throw new Error('Only {{patient}}, {{clinic}} and {{details}} variables are supported');
        templates[type][lang] = text;
      }
    }
    updateData.templates = templates;
  }

  if (body.instanceName) {
    updateData.instanceName = String(body.instanceName).trim();
  }

  await (await db()).collection('messagingSettings').updateOne(
    { clinicId },
    { $set: updateData },
    { upsert: true }
  );
}

export async function enqueue({ clinicId, patientId, type, eventKey, values = [], sourceCollection, sourceId, sourceFingerprint }, session, autoDispatch = false) {
  if (!messageTypes.includes(type)) throw new Error('Unknown notification type');
  const database = await db();
  const patient = await database.collection('patients').findOne({ _id: new ObjectId(patientId), clinicId }, { session });
  if (!patient?.whatsappConsent) return;
  const phone = normalizePhone(patient.phone);
  if (!/^\d{10,15}$/.test(phone)) return;

  const res = await database.collection('notificationOutbox').updateOne(
    { clinicId, eventKey },
    {
      $setOnInsert: {
        clinicId,
        patientId,
        type,
        eventKey,
        values: values.map(v => String(v).slice(0, 250)),
        sourceCollection: sourceCollection || null,
        sourceId: sourceId || null,
        sourceFingerprint: sourceFingerprint || null,
        status: 'pending_provider',
        createdAt: new Date()
      }
    },
    { upsert: true, session }
  );

  // If this is a newly inserted notification and no MongoDB transaction session, trigger dispatch
  if (autoDispatch && !session && res.upsertedCount > 0) {
    setTimeout(() => {
      dispatchPendingNotifications(clinicId).catch(() => {});
    }, 100);
  }
}

export async function dispatchSingleNotification(outboxId, clinicId) {
  const database = await db();
  const item = await database.collection('notificationOutbox').findOne({
    _id: new ObjectId(outboxId),
    ...(clinicId ? { clinicId } : {})
  });

  if (!item) throw new Error('Notification record not found');
  if (item.status === 'sent') return { skipped: true, reason: 'Already sent' };

  const [patient, clinic, storedSettings] = await Promise.all([
    database.collection('patients').findOne({ _id: new ObjectId(item.patientId), clinicId: item.clinicId }),
    database.collection('clinics').findOne({ _id: new ObjectId(item.clinicId) }),
    database.collection('messagingSettings').findOne({ clinicId: item.clinicId })
  ]);

  if (!patient?.whatsappConsent) {
    await database.collection('notificationOutbox').updateOne(
      { _id: item._id },
      { $set: { status: 'cancelled', cancelReason: 'Patient opted out or no WhatsApp consent' } }
    );
    return { cancelled: true, reason: 'No consent' };
  }

  const phone = normalizePhone(patient.phone);
  if (!phone) {
    await database.collection('notificationOutbox').updateOne(
      { _id: item._id },
      { $set: { status: 'failed', error: 'Invalid patient phone number' } }
    );
    return { failed: true, reason: 'Invalid phone' };
  }

  const lang = patient.preferredLanguage === 'ur' ? 'ur' : 'en';
  const templates = { ...defaultTemplates, ...storedSettings?.templates };
  const template = templates[item.type]?.[lang] || defaultTemplates[item.type]?.[lang] || defaultTemplates[item.type]?.en;

  const messageText = renderMessage(template, {
    patient: patient.name || 'Valued Patient',
    clinic: clinic?.name || 'Dental Clinic',
    details: (item.values || []).join(' · ')
  });

  const { defaultInstance } = getEvolutionConfig();
  const instanceName = storedSettings?.instanceName || defaultInstance;

  try {
    const sendRes = await sendEvolutionText(phone, messageText, instanceName);
    await database.collection('notificationOutbox').updateOne(
      { _id: item._id },
      {
        $set: {
          status: 'sent',
          sentAt: new Date(),
          deliveredVia: 'evolution_api',
          instanceUsed: instanceName,
          recipientPhone: phone,
          messageId: sendRes.messageId,
          renderedText: messageText
        }
      }
    );
    return { success: true, messageId: sendRes.messageId };
  } catch (err) {
    await database.collection('notificationOutbox').updateOne(
      { _id: item._id },
      {
        $set: {
          status: 'failed',
          failedAt: new Date(),
          error: err.message,
          renderedText: messageText
        }
      }
    );
    throw err;
  }
}

export async function dispatchPendingNotifications(clinicId) {
  const database = await db();
  const query = { status: 'pending_provider', ...(clinicId ? { clinicId } : {}) };
  const pending = await database.collection('notificationOutbox').find(query).sort({ createdAt: 1 }).limit(25).toArray();

  if (!pending.length) return { processed: 0, sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;

  for (const item of pending) {
    try {
      await dispatchSingleNotification(item._id, clinicId);
      sent++;
      // polite pause to respect rate limits
      await new Promise(r => setTimeout(r, 400));
    } catch {
      failed++;
    }
  }

  return { processed: pending.length, sent, failed };
}

export async function queueReminders(clinicId, autoDispatch = false) {
  const database = await db(), now = today(), tomorrow = new Date(Date.now() + 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' }), q = clinicId ? { clinicId } : {};
  const appointments = await database.collection('appointments').find({ ...q, appointmentDate: { $gte: now }, status: { $in: ['pending', 'confirmed'] } }).limit(2000).toArray();

  for (const a of appointments) {
    const base = { clinicId: a.clinicId, patientId: a.patientId, sourceCollection: 'appointments', sourceId: String(a._id), sourceFingerprint: `${a.appointmentDate} ${a.startsAt}`, values: [a.appointmentDate, a.startsAt] };
    await enqueue({ ...base, type: 'appointment_confirmation', eventKey: `booking:${a._id}:${a.appointmentDate}:${a.startsAt}` }, null, false);
    if (a.appointmentDate === tomorrow) {
      await enqueue({ ...base, type: 'appointment_reminder', eventKey: `reminder:${a._id}:${a.appointmentDate}:${a.startsAt}` }, null, false);
    }
  }

  const sessions = await database.collection('careSessions').find({ ...q, scheduledDate: tomorrow, status: { $in: ['planned', 'scheduled'] } }).limit(2000).toArray();
  for (const s of sessions) {
    await enqueue({ clinicId: s.clinicId, patientId: s.patientId, type: 'session_reminder', eventKey: `session:${s._id}:${s.scheduledDate}`, values: [s.scheduledDate, 'Your next treatment visit'], sourceCollection: 'careSessions', sourceId: String(s._id), sourceFingerprint: s.scheduledDate }, null, false);
  }

  const followUps = await database.collection('follow-ups').find({ ...q, status: 'pending', dueDate: { $lte: now } }).limit(2000).toArray();
  for (const f of followUps) {
    await enqueue({ clinicId: f.clinicId, patientId: f.patientId, type: 'follow_up', eventKey: `follow-up:${f._id}:${f.dueDate}`, values: [f.dueDate, 'Please contact the clinic to arrange your follow-up'], sourceCollection: 'follow-ups', sourceId: String(f._id) }, null, false);
  }

  let dispatchResult = null;
  if (autoDispatch) {
    dispatchResult = await dispatchPendingNotifications(clinicId);
  }

  return {
    success: true,
    appointmentsScanned: appointments.length,
    sessionsScanned: sessions.length,
    followUpsScanned: followUps.length,
    dispatchResult
  };
}
