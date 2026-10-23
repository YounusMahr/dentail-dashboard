import { ObjectId } from 'mongodb';
import { currentUser, sameOrigin } from '@/lib/auth';
import { db } from '@/lib/db';
import { fail, id, ok } from '@/lib/http';
import { writeBlock } from '@/lib/clinic-access';
import { cleanPatientPhoto } from '@/lib/patient-photo.mjs';

async function context(params) {
  const user = await currentUser();
  const { patientId } = await params;
  if (!user?.clinicId || !['clinic_admin', 'receptionist', 'dentist'].includes(user.role) || !id(patientId)) return null;
  const database = await db();
  const patient = await database.collection('patients').findOne({ _id: new ObjectId(patientId), clinicId: user.clinicId });
  return patient ? { database, user, patient, patientId, q: { clinicId: user.clinicId, patientId } } : null;
}

export async function GET(request, { params }) {
  const ctx = await context(params);
  if (!ctx) return fail('Patient not found', 404);
  const { database, user, patient, q } = ctx;
  const [appointments, treatments, invoices, followUps, plans, payments, sessions, prescriptions, labCases, doctors, services] = await Promise.all([
    database.collection('appointments').find({ ...q, deletedAt: { $exists: false } }).sort({ appointmentDate: -1, startsAt: -1 }).toArray(),
    database.collection('treatments').find(q, { projection: user.role === 'receptionist' ? { clinicalNotes: 0, diagnosis: 0, prescription: 0 } : undefined }).sort({ createdAt: -1 }).toArray(),
    database.collection('invoices').find(q).sort({ createdAt: -1 }).toArray(),
    database.collection('follow-ups').find(q).sort({ dueDate: -1 }).toArray(),
    database.collection('treatmentPlans').find(q, { projection: { title: 1, status: 1, toothNumbers: 1, summary: 1, aftercare: 1, totalFee: 1, nextReviewDate: 1 } }).sort({ createdAt: -1 }).toArray(),
    database.collection('payments').find(q).sort({ createdAt: -1 }).toArray(),
    database.collection('careSessions').find(q, { projection: { title: 1, scheduledDate: 1, status: 1, amountDue: 1, planId: 1, appointmentId: 1 } }).sort({ scheduledDate: -1 }).toArray(),
    user.role === 'receptionist' ? [] : database.collection('prescriptions').find(q, { projection: { diagnosis: 1, reviewDate: 1, status: 1, revision: 1, appointmentId: 1, createdAt: 1, medications: 1 } }).sort({ createdAt: -1 }).toArray(),
    database.collection('labCases').find(q, { projection: { title: 1, labName: 1, dueDate: 1, status: 1, toothNumbers: 1 } }).sort({ dueDate: -1 }).toArray(),
    database.collection('doctors').find({ clinicId: user.clinicId }, { projection: { name: 1 } }).toArray(),
    database.collection('services').find({ clinicId: user.clinicId }, { projection: { name: 1 } }).toArray(),
  ]);
  const totalPaid = payments.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const outstanding = invoices.filter(item => item.status !== 'cancelled').reduce((sum, item) => sum + Number(item.balanceAmount || 0), 0);
  return ok({ patient, appointments, treatments, invoices, followUps, plans, payments, sessions, prescriptions, labCases, doctors, services, totalPaid, outstanding, userRole: user.role });
}

export async function PATCH(request, { params }) {
  if (!sameOrigin(request)) return fail('Invalid request origin', 403);
  const ctx = await context(params);
  if (!ctx) return fail('Patient not found', 404);
  const block = await writeBlock(ctx.user);
  if (block) return fail(block, 403);
  const body = await request.json().catch(() => ({}));
  if (Object.hasOwn(body, 'photoDataUrl')) {
    try {
      const photoDataUrl = await cleanPatientPhoto(body.photoDataUrl);
      const now = new Date();
      await ctx.database.collection('patients').updateOne({ _id: ctx.patient._id, clinicId: ctx.user.clinicId }, { $set: { photoDataUrl, updatedAt: now } });
      await ctx.database.collection('auditLogs').insertOne({ clinicId: ctx.user.clinicId, actorId: String(ctx.user._id), module: 'patients', recordId: ctx.patientId, action: 'photo_updated', createdAt: now });
      return ok({ success: true, photoDataUrl });
    } catch (error) { return fail(error.message, 400); }
  }
  if (typeof body.whatsappConsent !== 'boolean') return fail('Choose whether WhatsApp care messages are enabled', 400);
  const now = new Date();
  await ctx.database.collection('patients').updateOne({ _id: ctx.patient._id, clinicId: ctx.user.clinicId }, { $set: { whatsappConsent: body.whatsappConsent, updatedAt: now } });
  if (!body.whatsappConsent) await ctx.database.collection('notificationOutbox').updateMany({ clinicId: ctx.user.clinicId, patientId: ctx.patientId, status: 'pending_provider' }, { $set: { status: 'cancelled', cancelReason: 'Patient opted out', updatedAt: now } });
  await ctx.database.collection('auditLogs').insertOne({ clinicId: ctx.user.clinicId, actorId: String(ctx.user._id), module: 'patients', recordId: ctx.patientId, action: body.whatsappConsent ? 'whatsapp_on' : 'whatsapp_off', createdAt: now });
  return ok({ success: true, whatsappConsent: body.whatsappConsent });
}
