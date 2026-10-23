import { ObjectId } from 'mongodb';
import { db } from './db';
import { hashPassword } from './auth';
import { cleanRecord } from './records';
import { medications, money, validDate } from './care-validation.mjs';

// Related writes commit together: a failed payment or recall cannot leave half a visit.
export async function createClinicalRecord(module, input, user, record) {
  const database = await db(), session = database.client.startSession(), recordId = new ObjectId();
  const stamp = { clinicId: user.clinicId, createdAt: new Date(), updatedAt: new Date() };
  let invoice, recall, appointment, prescriptionDraft;
  if (input.appointmentId) {
    if (!ObjectId.isValid(input.appointmentId)) throw new Error('Invalid appointment');
    appointment = await database.collection('appointments').findOne({ _id: new ObjectId(input.appointmentId), clinicId: user.clinicId, patientId: record.patientId });
    if (!appointment || record.doctorId && appointment.doctorId !== record.doctorId || module === 'treatments' && appointment.doctorId !== record.doctorId) throw new Error('Appointment must belong to this patient and dentist');
    record.appointmentId = input.appointmentId;
  }
  if (module === 'treatments') {
    if (input.prescriptionDraft) {
      const draft = input.prescriptionDraft;
      if (!appointment) throw new Error('Choose the linked appointment for the prescription');
      const existingPrescription = await database.collection('prescriptions').findOne({ clinicId: user.clinicId, appointmentId: String(appointment._id) });
      if (existingPrescription?.status === 'issued') throw new Error('Prescription already issued. Create a revision before editing medicines.');
      const rows = Array.isArray(draft.medications) ? draft.medications.filter(row => Object.values(row).some(value => String(value || '').trim())) : [];
      if (draft.reviewDate && !validDate(draft.reviewDate)) throw new Error('Choose a valid review date');
      prescriptionDraft = {
        medications: rows.length ? medications(rows) : [],
        language: ['english', 'urdu', 'bilingual'].includes(draft.language) ? draft.language : 'bilingual',
        diagnosis: String(record.diagnosis || '').slice(0, 12000),
        instructionsEn: String(draft.instructionsEn || '').trim().slice(0, 12000),
        instructionsUr: String(draft.instructionsUr || '').trim().slice(0, 12000),
        reviewDate: draft.reviewDate || '',
      };
    }
    if (input.completeAppointment && !appointment) throw new Error('Choose the appointment to complete');
    if (input.scheduleFollowup) {
      if (String(input.followupDueDate) < new Date().toLocaleDateString('en-CA', { timeZone:user.timezone||'Asia/Karachi' })) throw new Error('Recall date cannot be in the past');
      recall = await cleanRecord('follow-ups', { patientId: record.patientId, dueDate: input.followupDueDate, reason: input.followupReason, status: 'pending' }, user);
    }
    if (input.createInvoice) {
      if (!record.serviceId) throw new Error('Choose a service to create the treatment invoice');
      const service = await database.collection('services').findOne({ _id: new ObjectId(record.serviceId), clinicId: user.clinicId });
      invoice = await cleanRecord('invoices', { patientId: record.patientId, doctorId: record.doctorId, feeType: 'treatment', items: [{ serviceId: record.serviceId, description: service.name, quantity: 1, unitPrice: service.standardFee }], dueDate: new Date().toLocaleDateString('en-CA', { timeZone:user.timezone||'Asia/Karachi' }) }, user);
    }
  }
  const amount = module === 'invoices' && input.initialPayment ? money(input.initialPaymentAmount) : 0;
  const method = input.initialPaymentMethod || 'cash';
  if (input.initialPayment && (!(amount > 0) || amount > record.totalAmount || !['cash','card','bank_transfer','easypaisa_jazzcash'].includes(method))) throw new Error('Enter a valid upfront payment within the invoice total');
  try {
    await session.withTransaction(async () => {
      if (appointment && (invoice || module === 'invoices')) {
        const existingInvoice = await database.collection('invoices').findOne({ clinicId: user.clinicId, appointmentId: String(appointment._id), status: { $ne: 'cancelled' } }, { projection: { _id: 1 }, session });
        if (existingInvoice) throw new Error('This visit already has an invoice. Open it to receive payment or review its items.');
        if (invoice) invoice.visitInvoiceKey = String(appointment._id);
        else record.visitInvoiceKey = String(appointment._id);
      }
      if (amount) Object.assign(record, { paidAmount: amount, balanceAmount: money(record.totalAmount - amount), status: amount === record.totalAmount ? 'paid' : 'partially_paid' });
      await database.collection(module).insertOne({ _id: recordId, ...record, ...stamp }, { session });
      if (prescriptionDraft) await database.collection('prescriptions').updateOne({ clinicId: user.clinicId, appointmentId: String(appointment._id), status: 'draft' }, { $set: { ...prescriptionDraft, updatedAt: new Date() }, $setOnInsert: { clinicId: user.clinicId, appointmentId: String(appointment._id), patientId: record.patientId, doctorId: record.doctorId, status: 'draft', revision: 1, createdAt: new Date() } }, { upsert: true, session });
      if (appointment && input.completeAppointment) await database.collection('appointments').updateOne({ _id: appointment._id, clinicId: user.clinicId }, { $set: { status: 'completed', updatedAt: new Date() } }, { session });
      if (recall) await database.collection('follow-ups').insertOne({ ...recall, treatmentRecordId: String(recordId), ...stamp }, { session });
      if (invoice) await database.collection('invoices').insertOne({ ...invoice, treatmentRecordId: String(recordId), appointmentId: record.appointmentId || '', ...stamp }, { session });
      if (amount) await database.collection('payments').insertOne({ invoiceId: String(recordId), patientId: record.patientId, receivedByUserId: String(user._id), amount, paymentMethod: method, transactionReference: String(input.initialPaymentReference || '').slice(0,100), notes: 'Upfront payment at invoice issuance', ...stamp }, { session });
      await database.collection('auditLogs').insertOne({ module, recordId: String(recordId), actorId: String(user._id), action: 'created', ...stamp }, { session });
    });
  } finally { await session.endSession(); }
  return recordId;
}

export async function saveDoctor(record, input, user, existing = null) {
  const database = await db(), session = database.client.startSession();
  const email = String(record.email || existing?.email || '').toLowerCase();
  const password = String(input.newPassword || '');
  if (password && (password.length < 8 || password.length > 200)) throw new Error('Password must contain 8–200 characters');
  const doctorId = existing?._id || new ObjectId();
  try {
    await session.withTransaction(async () => {
      let account = existing?.userId ? await database.collection('users').findOne({ _id: new ObjectId(existing.userId), clinicId: user.clinicId }, { session }) : null;
      const emailOwner = await database.collection('users').findOne({ email }, { session });
      if (!account && emailOwner?.clinicId === user.clinicId && emailOwner.role === 'dentist') account = emailOwner;
      if (emailOwner && String(emailOwner._id) !== String(account?._id)) throw new Error('This email already belongs to another account');
      if (!account && !password && !existing) throw new Error('Set a password for the new doctor login');
      if (account && !['dentist','clinic_admin'].includes(account.role)) throw new Error('Only a dentist account can be linked');
      if (account && String(account._id) === String(user._id) && record.active === false) throw new Error('Cannot deactivate your own account');
      const accountData = { name: record.name || existing?.name, email, phone: record.phone ?? existing?.phone ?? '', active: record.active ?? existing?.active ?? true, updatedAt: new Date(), ...(password ? { passwordHash: hashPassword(password) } : {}) };
      if (account) await database.collection('users').updateOne({ _id: account._id }, { $set: accountData }, { session });
      else if (password) { account = { _id: new ObjectId() }; await database.collection('users').insertOne({ _id: account._id, ...accountData, role: 'dentist', clinicId: user.clinicId, createdAt: new Date() }, { session }); }
      const data = { ...record, email, ...(account ? { userId: String(account._id) } : {}), updatedAt: new Date() };
      if (existing) await database.collection('doctors').updateOne({ _id: doctorId, clinicId: user.clinicId }, { $set: data }, { session });
      else await database.collection('doctors').insertOne({ _id: doctorId, ...data, clinicId: user.clinicId, createdAt: new Date() }, { session });
    });
  } finally { await session.endSession(); }
  return doctorId;
}
