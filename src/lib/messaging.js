import { ObjectId } from 'mongodb';
import { db } from './db';
import { today } from './care-validation.mjs';
import { cleanPhone, getLiveConnection, sendEvolutionText, getEvolutionConfig } from './evolution';
import {queueEmail,dispatchEmailOutbox} from './email-notifications';
import {localInstant} from './clinic-time.mjs';
import {appointmentReminderWindows} from './reminder-windows.mjs';

export const messageTypes = [
  'appointment_confirmation',
  'appointment_reminder',
  'session_reminder',
  'follow_up',
  'payment_receipt',
  'prescription_ready',
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
  prescription_ready: {
    en: 'Hello {{patient}}, your prescription from {{clinic}} is ready: {{details}}. Please contact the clinic for a private copy.',
    ur: 'السلام علیکم {{patient}}، {{clinic}} سے آپ کا نسخہ تیار ہے: {{details}}۔ ذاتی کاپی کے لیے کلینک سے رابطہ کریں۔'
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
    providerError:live.error||'',
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
  return res.upsertedId || null;
}

export async function dispatchSingleNotification(outboxId, clinicId) {
  const database = await db();
  const item = await database.collection('notificationOutbox').findOne({
    _id: new ObjectId(outboxId),
    ...(clinicId ? { clinicId } : {})
  });

  if (!item) throw new Error('Notification record not found');
  if (item.status === 'sent') return { skipped: true, reason: 'Already sent' };
  if (item.type === 'payment_receipt' && !item.eventKey?.startsWith('print-receipt:')) {
    await database.collection('notificationOutbox').updateOne({ _id: item._id }, { $set: { status: 'cancelled', cancelReason: 'Receipt sends only when staff prints', updatedAt: new Date() } });
    return { cancelled: true, reason: 'Print required' };
  }

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

  if (item.sourceCollection === 'appointments' && item.sourceId && ObjectId.isValid(item.sourceId)) {
    const appointment = await database.collection('appointments').findOne({ _id: new ObjectId(item.sourceId), clinicId: item.clinicId });
    if (!appointment || appointment.deletedAt || ['cancelled', 'no_show'].includes(appointment.status) || item.sourceFingerprint !== `${appointment.appointmentDate} ${appointment.startsAt}`) {
      await database.collection('notificationOutbox').updateOne({ _id: item._id }, { $set: { status: 'cancelled', cancelReason: 'Appointment changed or cancelled', updatedAt: new Date() } });
      return { cancelled: true, reason: 'Appointment changed or cancelled' };
    }
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
  const appointments = await database.collection('appointments').find({ ...q, deletedAt: { $exists: false }, appointmentDate: { $gte: now }, status: { $in: ['pending', 'confirmed'] } }).limit(2000).toArray();
  const clinics = await database.collection('clinics').find({ _id: { $in: [...new Set(appointments.map(a => String(a.clinicId)))].filter(ObjectId.isValid).map(value => new ObjectId(value)) } }, { projection: { timezone: 1 } }).toArray();
  const timezones = new Map(clinics.map(clinic => [String(clinic._id), clinic.timezone || 'Asia/Karachi']));

  for (const a of appointments) {
    const base = { clinicId: a.clinicId, patientId: a.patientId, sourceCollection: 'appointments', sourceId: String(a._id), sourceFingerprint: `${a.appointmentDate} ${a.startsAt}`, values: [a.appointmentDate, a.startsAt] };
    await enqueue({ ...base, type: 'appointment_confirmation', eventKey: `booking:${a._id}:${a.appointmentDate}:${a.startsAt}` }, null, false);
    await queueEmail({clinicId:a.clinicId,patientId:a.patientId,type:'appointment_confirmation',eventKey:`booking:${a._id}:${a.appointmentDate}:${a.startsAt}`,details:[`Date: ${a.appointmentDate}`,`Time: ${a.startsAt}`],sourceId:String(a._id)});
    const minutesUntil = (localInstant(a.appointmentDate, a.startsAt, timezones.get(String(a.clinicId)) || 'Asia/Karachi').getTime() - Date.now()) / 60000;
    for (const window of appointmentReminderWindows(minutesUntil)) {
      const eventKey = `reminder:${window}:${a._id}:${a.appointmentDate}:${a.startsAt}`;
      await enqueue({ ...base, type: 'appointment_reminder', eventKey, values: [a.appointmentDate, a.startsAt, window === '48h' ? '2 days to go' : 'About 1 hour to go'] }, null, false);
      if (window === '48h') await queueEmail({ clinicId: a.clinicId, patientId: a.patientId, type: 'appointment_reminder', eventKey, details: [`Date: ${a.appointmentDate}`, `Time: ${a.startsAt}`, 'Your visit is in 2 days'], sourceId: String(a._id) });
    }
  }

  const sessions = await database.collection('careSessions').find({ ...q, scheduledDate: tomorrow, status: { $in: ['planned', 'scheduled'] } }).limit(2000).toArray();
  for (const s of sessions) {
    await enqueue({ clinicId: s.clinicId, patientId: s.patientId, type: 'session_reminder', eventKey: `session:${s._id}:${s.scheduledDate}`, values: [s.scheduledDate, 'Your next treatment visit'], sourceCollection: 'careSessions', sourceId: String(s._id), sourceFingerprint: s.scheduledDate }, null, false);
    await queueEmail({clinicId:s.clinicId,patientId:s.patientId,type:'session_reminder',eventKey:`session:${s._id}:${s.scheduledDate}`,details:[`Session date: ${s.scheduledDate}`],sourceId:String(s._id)});
  }

  const followUps = await database.collection('follow-ups').find({ ...q, status: 'pending', dueDate: { $lte: now } }).limit(2000).toArray();
  for (const f of followUps) {
    await enqueue({ clinicId: f.clinicId, patientId: f.patientId, type: 'follow_up', eventKey: `follow-up:${f._id}:${f.dueDate}`, values: [f.dueDate, 'Please contact the clinic to arrange your follow-up'], sourceCollection: 'follow-ups', sourceId: String(f._id) }, null, false);
    await queueEmail({clinicId:f.clinicId,patientId:f.patientId,type:'follow_up',eventKey:`follow-up:${f._id}:${f.dueDate}`,details:[`Follow-up date: ${f.dueDate}`,f.reason],sourceId:String(f._id)});
  }

  let dispatchResult = null;
  if (autoDispatch) {
    dispatchResult = await dispatchPendingNotifications(clinicId);
    await dispatchEmailOutbox(clinicId);
  }

  return {
    success: true,
    appointmentsScanned: appointments.length,
    sessionsScanned: sessions.length,
    followUpsScanned: followUps.length,
    dispatchResult
  };
}
