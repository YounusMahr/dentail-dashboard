import { ObjectId } from 'mongodb';
import { currentUser, sameOrigin } from '@/lib/auth';
import { db } from '@/lib/db';
import { fail, ok } from '@/lib/http';

export async function GET(request) {
  const user = await currentUser();
  if (!user?.clinicId || !['clinic_admin', 'receptionist', 'dentist'].includes(user.role)) return fail('Unauthorized', 403);
  const query = new URL(request.url).searchParams;
  const patientId = query.get('patient') || '';
  if (patientId && !ObjectId.isValid(patientId)) return fail('Invalid patient', 400);
  const limit = Math.min(Math.max(Number(query.get('limit')) || 30, 1), 100);
  const database = await db();
  const scope = { clinicId: user.clinicId, ...(patientId ? { patientId } : {}) };
  const attention = { ...scope, status: { $in: ['pending_provider', 'failed'] } };
  const [whatsapp, email, bookings, whatsappAttention, emailAttention, bookingAttention] = await Promise.all([
    database.collection('notificationOutbox').find(scope, { projection: { type: 1, patientId: 1, sourceId: 1, sourceCollection: 1, values: 1, status: 1, error: 1, createdAt: 1, sentAt: 1 } }).sort({ createdAt: -1 }).limit(limit).toArray(),
    database.collection('emailOutbox').find(scope, { projection: { type: 1, patientId: 1, sourceId: 1, details: 1, status: 1, error: 1, createdAt: 1, sentAt: 1 } }).sort({ createdAt: -1 }).limit(limit).toArray(),
    database.collection('appointments').find({ ...scope, bookingSource: { $in: ['website', 'whatsapp_ai'] } }, { projection: { patientId: 1, bookingSource: 1, appointmentDate: 1, startsAt: 1, serviceId: 1, createdAt: 1 } }).sort({ createdAt: -1 }).limit(limit).toArray(),
    database.collection('notificationOutbox').countDocuments(attention),
    database.collection('emailOutbox').countDocuments(attention),
    database.collection('appointments').countDocuments({ ...scope, bookingSource: { $in: ['website', 'whatsapp_ai'] }, bookingSeenAt: { $exists: false } }),
  ]);
  const rows = [...whatsapp.map(item => ({ ...item, channel: 'WhatsApp', details: item.values || [] })), ...email.map(item => ({ ...item, channel: 'Email' })), ...bookings.map(item => ({ _id: item._id, patientId: item.patientId, type: item.bookingSource === 'whatsapp_ai' ? 'whatsapp_booking' : 'website_booking', channel: item.bookingSource === 'whatsapp_ai' ? 'WhatsApp AI' : 'Website', status: 'booked', sourceId: String(item._id), details: [`Date: ${item.appointmentDate}`, `Time: ${item.startsAt}`], createdAt: item.createdAt }))].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, limit);
  const ids = [...new Set(rows.map(item => item.patientId).filter(ObjectId.isValid))].map(value => new ObjectId(value));
  const patients = ids.length ? await database.collection('patients').find({ clinicId: user.clinicId, _id: { $in: ids } }, { projection: { name: 1, phone: 1 } }).toArray() : [];
  const names = new Map(patients.map(patient => [String(patient._id), { name: patient.name, phone: patient.phone }]));
  return ok({ records: rows.map(item => ({ ...item, patient: names.get(item.patientId) || null })), attentionCount: whatsappAttention + emailAttention + bookingAttention, messageAttentionCount: whatsappAttention + emailAttention, bookingAttentionCount: bookingAttention });
}

export async function POST(request) {
  const user = await currentUser();
  if (!user?.clinicId || !['clinic_admin', 'receptionist', 'dentist'].includes(user.role) || !sameOrigin(request)) return fail('Unauthorized', 403);
  await (await db()).collection('appointments').updateMany({ clinicId: user.clinicId, bookingSource: { $in: ['website', 'whatsapp_ai'] }, bookingSeenAt: { $exists: false } }, { $set: { bookingSeenAt: new Date() } });
  return ok({ success: true });
}
