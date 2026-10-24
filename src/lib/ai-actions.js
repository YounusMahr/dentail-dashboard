import { ObjectId } from 'mongodb';
import { chairSlots } from './availability.mjs';
import { pakistanMobile } from './pakistan-phone.mjs';
import { cleanRecord } from './records';
import { bookVisit } from './visit-booking';
import { createClinicalRecord } from './legacy-workflows';
import { money, validDate } from './care-validation.mjs';
import { careIndexes } from './care';

const id = value => typeof value === 'string' && /^[a-f\d]{24}$/i.test(value);
const string = (value, max = 200) => String(value ?? '').trim().slice(0, max);
const exact = value => new RegExp(`^${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
const roleActions = { clinic_admin: ['create_patient', 'book_appointment', 'create_service', 'create_invoice', 'receive_payment'], receptionist: ['create_patient', 'book_appointment', 'create_invoice', 'receive_payment'], dentist: ['create_patient', 'book_appointment'] };
function assertActionRole(user, type) { if (!roleActions[user.role]?.includes(type)) throw new Error('Your staff role cannot perform this action.'); }

async function one(database, collection, clinicId, name, extra = {}) {
  let matches = await database.collection(collection).find({ clinicId, name: exact(name), ...extra }).limit(2).toArray();
  if (!matches.length) matches = await database.collection(collection).find({ clinicId, name: { $regex: name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' }, ...extra }).limit(3).toArray();
  if (!matches.length) throw new Error(`No ${collection.slice(0, -1)} named “${name}” was found. Ask for the exact name.`);
  if (matches.length > 1) throw new Error(`More than one ${collection.slice(0, -1)} has that name. Ask for a unique detail.`);
  return matches[0];
}

async function patientFor(database, clinicId, args) {
  const phone = args.phone ? pakistanMobile(args.phone) : '';
  if (phone) {
    const matches = await database.collection('patients').find({ clinicId, phone }).limit(2).toArray();
    if (matches.length > 1) throw new Error('More than one patient has this phone. Open the patient directory and resolve the duplicate first.');
    const patient = matches[0];
    if (patient && args.patient_name && patient.name.toLowerCase() !== string(args.patient_name).toLowerCase()) throw new Error(`Phone belongs to ${patient.name}. Confirm the correct patient before continuing.`);
    return { patient, phone };
  }
  if (!args.patient_name) throw new Error('Ask for the patient name or Pakistani mobile number.');
  return { patient: await one(database, 'patients', clinicId, string(args.patient_name)), phone: '' };
}

export async function prepareClinicAction(database, user, args) {
  if (!args || typeof args !== 'object' || Array.isArray(args)) throw new Error('Invalid action');
  const clinicId = user.clinicId, type = args.action;
  assertActionRole(user, type);
  if (type === 'create_patient') {
    const name = string(args.patient_name), phone = pakistanMobile(args.phone);
    if (!name) throw new Error('Ask for the patient name.');
    if (await database.collection('patients').findOne({ clinicId, phone })) throw new Error('A patient with this phone already exists. Use the existing patient file.');
    const email = string(args.email);
    await cleanRecord('patients', { name, phone, email }, user, null, { skipIndexes: true });
    return { type, payload: { name, phone, email }, summary: `Create patient: ${name} · ${phone}${email ? ` · ${email}` : ''} · WhatsApp care updates on`, href: '/dashboard/patients' };
  }
  if (type === 'book_appointment') {
    const { patient, phone } = await patientFor(database, clinicId, args);
    if (!patient && (!phone || !string(args.patient_name))) throw new Error('For a new patient, ask for full name and valid Pakistani mobile number.');
    const doctors = await database.collection('doctors').find({ clinicId, active: { $ne: false } }).toArray();
    const doctor = args.doctor_name ? await one(database, 'doctors', clinicId, string(args.doctor_name), { active: { $ne: false } }) : user.role === 'dentist' ? doctors.find(d => String(d._id) === user.doctorId) : doctors.length === 1 ? doctors[0] : null;
    if (!doctor) throw new Error(`Ask which dentist to book. Available: ${doctors.map(d => d.name).join(', ') || 'none'}.`);
    if (user.role === 'dentist' && String(doctor._id) !== user.doctorId) throw new Error('Dentists can only book their own schedule.');
    const date = string(args.date), time = string(args.time);
    if (!validDate(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('Ask for a valid appointment date and time. Use YYYY-MM-DD and HH:mm.');
    if (!patient) await cleanRecord('patients', { name: string(args.patient_name), phone, email: string(args.email) }, user, null, { skipIndexes: true });
    let service = null;
    if (args.service_name) service = await one(database, 'services', clinicId, string(args.service_name), { active: { $ne: false } });
    if (service && !Number.isFinite(Number(service.standardFee))) throw new Error('This service has no valid fee. Update it in Services before booking.');
    const clashes = await database.collection('appointments').find({ clinicId, appointmentDate: date, status: { $nin: ['cancelled', 'rescheduled'] }, $or: [{ doctorId: String(doctor._id) }, ...(doctor.chairName ? [{ chairName: doctor.chairName }] : [])] }, { projection: { startsAt: 1, endsAt: 1, status: 1 } }).toArray();
    if (!chairSlots({ ...doctor, active: true }, date, clashes, new Date(), user.timezone).includes(time)) throw new Error('That dentist/chair slot is unavailable. Ask for another date or time.');
    const clinic = await database.collection('clinics').findOne({ _id: new ObjectId(clinicId) }, { projection: { newPatientCheckupFee: 1 } });
    const checkupFee = Number(clinic?.newPatientCheckupFee ?? 500), fee = service ? Number(service.standardFee) + (!patient && !service.includesCheckup ? checkupFee : 0) : checkupFee;
    const patientName = patient?.name || string(args.patient_name);
    return { type, payload: { patientId: patient ? String(patient._id) : '', newPatient: patient ? null : { name: patientName, phone, email: string(args.email) }, doctorId: String(doctor._id), serviceId: service ? String(service._id) : '', date, time, notes: string(args.notes, 1000) }, summary: `Book ${patientName} · ${doctor.name} · ${date} ${time} · ${service?.name || 'Dental checkup'} · Rs ${fee.toLocaleString('en-PK')}${patient ? ` · WhatsApp ${patient.whatsappConsent ? 'on' : 'off'}` : ' · new patient · WhatsApp care updates on'}`, href: '/dashboard/appointments' };
  }
  if (type === 'create_service') {
    const name = string(args.service_name), standardFee = money(args.amount), durationMinutes = Number(args.duration_minutes);
    if (!name || !(standardFee >= 0) || !Number.isInteger(durationMinutes) || durationMinutes < 1) throw new Error('Ask for service name, fee in Rs, and duration in minutes.');
    if (await database.collection('services').findOne({ clinicId, name: exact(name) })) throw new Error('A service with this name already exists.');
    const payload = { name, standardFee, durationMinutes, category: string(args.category) || 'General', includesCheckup: args.includes_checkup === true, active: true };
    await cleanRecord('services', payload, user, null, { skipIndexes: true });
    return { type, payload, summary: `Add service: ${name} · Rs ${standardFee.toLocaleString('en-PK')} · ${durationMinutes} min${payload.includesCheckup ? ' · checkup included' : ''}`, href: '/dashboard/services' };
  }
  if (type === 'create_invoice') {
    const { patient } = await patientFor(database, clinicId, args);
    if (!patient) throw new Error('Patient not found. Ask for the existing patient number first.');
    const description = string(args.description), amount = money(args.amount), feeType = args.fee_type;
    if (!description || !(amount > 0) || !['consultation', 'checkup', 'treatment'].includes(feeType)) throw new Error('Ask for invoice description, fee category and amount in Rs.');
    const doctor = args.doctor_name ? await one(database, 'doctors', clinicId, string(args.doctor_name)) : null;
    if (feeType !== 'treatment' && !doctor) throw new Error('Ask which dentist provided the consultation or checkup.');
    const payload = { patientId: String(patient._id), doctorId: doctor ? String(doctor._id) : '', feeType, description, amount };
    return { type, payload, summary: `Create ${feeType} invoice: ${patient.name} · ${description} · Rs ${amount.toLocaleString('en-PK')}${doctor ? ` · ${doctor.name}` : ''}`, href: '/dashboard/invoices' };
  }
  if (type === 'receive_payment') {
    const invoiceNumber = string(args.invoice_number), amount = money(args.amount), paymentMethod = args.payment_method;
    if (!invoiceNumber || !(amount > 0) || !['cash', 'card', 'bank_transfer', 'easypaisa_jazzcash'].includes(paymentMethod)) throw new Error('Ask for invoice number, amount received in Rs, and payment method.');
    const invoice = await database.collection('invoices').findOne({ clinicId, invoiceNumber, status: { $ne: 'cancelled' } });
    if (!invoice) throw new Error('Invoice not found. Ask for the exact invoice number.');
    if (amount > invoice.balanceAmount) throw new Error(`Payment exceeds outstanding Rs ${Number(invoice.balanceAmount).toLocaleString('en-PK')}.`);
    const patient = id(invoice.patientId) ? await database.collection('patients').findOne({ clinicId, _id: new ObjectId(invoice.patientId) }, { projection: { name: 1 } }) : null;
    return { type, payload: { invoiceId: String(invoice._id), amount, paymentMethod }, summary: `Receive Rs ${amount.toLocaleString('en-PK')} · ${invoiceNumber} · ${patient?.name || 'Patient'} · ${paymentMethod.replaceAll('_', ' ')}`, href: '/dashboard/invoices' };
  }
  throw new Error('That action is unavailable in AI Assistant.');
}

export async function executeClinicAction(database, user, action) {
  const { type, payload: p } = action;
  assertActionRole(user, type);
  if (type === 'book_appointment' && user.role === 'dentist' && p.doctorId !== user.doctorId) throw new Error('Dentists can only book their own schedule.');
  if (type === 'book_appointment') {
    const result = await bookVisit({ patientMode: p.patientId ? 'existing' : 'new', patientId: p.patientId, newPatient: p.newPatient ? { ...p.newPatient, whatsappConsent: true, emailConsent: !!p.newPatient.email, marketingConsent: false } : undefined, doctorId: p.doctorId, serviceId: p.serviceId, appointmentDate: p.date, startsAt: p.time, patientNotes: p.notes, status: 'confirmed' }, user);
    return { href: `/dashboard/visits/${result.id}`, label: 'Open appointment', recordId: result.id };
  }
  if (type === 'receive_payment') {
    await careIndexes(database);
    const session = database.client.startSession(); let paymentId;
    try { await session.withTransaction(async () => {
      const invoice = await database.collection('invoices').findOneAndUpdate({ _id: new ObjectId(p.invoiceId), clinicId: user.clinicId, status: { $ne: 'cancelled' }, balanceAmount: { $gte: p.amount } }, [
        { $set: { paidAmount: { $round: [{ $add: ['$paidAmount', p.amount] }, 2] }, balanceAmount: { $round: [{ $subtract: ['$balanceAmount', p.amount] }, 2] } } },
        { $set: { status: { $cond: [{ $lte: ['$balanceAmount', 0] }, 'paid', 'partially_paid'] }, updatedAt: new Date() } },
      ], { returnDocument: 'after', session });
      if (!invoice) throw new Error('Invoice missing or payment exceeds remaining balance. Ask AI to prepare a new payment.');
      paymentId = new ObjectId();
      await database.collection('payments').insertOne({ _id: paymentId, clinicId: user.clinicId, invoiceId: p.invoiceId, patientId: invoice.patientId, sessionId: null, receivedByUserId: String(user._id), amount: p.amount, paymentMethod: p.paymentMethod, idempotencyKey: `ai-action-${action._id}`, createdAt: new Date() }, { session });
      await database.collection('auditLogs').insertOne({ clinicId: user.clinicId, module: 'payments', recordId: p.invoiceId, actorId: String(user._id), amount: p.amount, action: 'ai_confirmed', createdAt: new Date() }, { session });
    }); } finally { await session.endSession(); }
    return { href: `/api/payments/${paymentId}/receipt`, label: 'Open receipt', recordId: String(paymentId) };
  }
  if (type === 'create_invoice') {
    const input = { patientId: p.patientId, doctorId: p.doctorId, feeType: p.feeType, items: [{ description: p.description, quantity: 1, unitPrice: p.amount }] };
    const record = await cleanRecord('invoices', input, user);
    const recordId = await createClinicalRecord('invoices', input, user, record);
    return { href: '/dashboard/invoices', label: 'View invoices', recordId: String(recordId) };
  }
  if (type === 'create_patient' || type === 'create_service') {
    if (type === 'create_patient' && await database.collection('patients').findOne({ clinicId: user.clinicId, phone: p.phone })) throw new Error('Patient already exists. Ask AI to use that patient.');
    if (type === 'create_service' && await database.collection('services').findOne({ clinicId: user.clinicId, name: exact(p.name) })) throw new Error('Service already exists.');
    const module = type === 'create_patient' ? 'patients' : 'services';
    const input = type === 'create_patient' ? { ...p, whatsappConsent: true, emailConsent: !!p.email, marketingConsent: false } : p;
    const record = await cleanRecord(module, input, user);
    const result = await database.collection(module).insertOne({ ...record, clinicId: user.clinicId, createdAt: new Date(), updatedAt: new Date() });
    return { href: type === 'create_patient' ? `/dashboard/patients/${result.insertedId}` : '/dashboard/services', label: type === 'create_patient' ? 'Open patient' : 'View services', recordId: String(result.insertedId) };
  }
  throw new Error('Unsupported action');
}
