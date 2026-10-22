import assert from 'node:assert/strict';
import { randomBytes, scryptSync } from 'node:crypto';
import { spawn } from 'node:child_process';
import { MongoClient, ObjectId } from 'mongodb';

const dbName = `dc_visit_${Date.now()}_${randomBytes(3).toString('hex')}`;
const origin = 'http://localhost:3121';
const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
let server, passed = 0;
const check = (condition, label) => { assert(condition, label); console.log(`PASS ${++passed}: ${label}`); };
try {
  await client.connect();
  const database = client.db(dbName);
  const clinicId = String(new ObjectId()), foreignClinic = String(new ObjectId());
  const patientId = String(new ObjectId()), doctorId = String(new ObjectId()), serviceId = String(new ObjectId());
  const adminId = new ObjectId(), dentistId = new ObjectId();
  const password = `Visit-QA-${randomBytes(8).toString('hex')}`, salt = randomBytes(16).toString('hex');
  const passwordHash = `scrypt:${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
  await database.collection('clinics').insertMany([
    { _id: new ObjectId(clinicId), name: 'Visit QA Clinic', slug: 'visit-qa', status: 'active' },
    { _id: new ObjectId(foreignClinic), name: 'Foreign Clinic', slug: 'foreign-visit-qa', status: 'active' },
  ]);
  await database.collection('users').insertMany([
    { _id: adminId, clinicId, role: 'clinic_admin', active: true, name: 'QA Admin', email: 'visit-admin@qa.invalid', passwordHash },
    { _id: dentistId, clinicId, role: 'dentist', active: true, name: 'QA Dentist', email: 'visit-dentist@qa.invalid', passwordHash },
    { clinicId, role: 'receptionist', active: true, name: 'QA Reception', email: 'visit-reception@qa.invalid', passwordHash },
    { clinicId: foreignClinic, role: 'clinic_admin', active: true, name: 'Foreign Admin', email: 'foreign-visit@qa.invalid', passwordHash },
  ]);
  await database.collection('patients').insertOne({ _id: new ObjectId(patientId), clinicId, name: 'Visit Patient', phone: '03001112233', medicalHistory: 'Synthetic allergy note' });
  await database.collection('doctors').insertOne({ _id: new ObjectId(doctorId), clinicId, userId: String(dentistId), name: 'Dr. Visit QA', active: true, consultationFee: 1500, slotMinutes: 30, workingDays: 'monday,tuesday,wednesday,thursday,friday,saturday,sunday', startTime: '09:00', endTime: '18:00' });
  await database.collection('services').insertOne({ _id: new ObjectId(serviceId), clinicId, name: 'Synthetic filling', standardFee: 4000, durationMinutes: 30, active: true });
  server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--port', '3121'], { env: { ...process.env, MONGODB_DB: dbName, NODE_ENV: 'production', RESEND_API_KEY: '', EMAIL_FROM: '' }, windowsHide: true, stdio: 'pipe' });
  let log = ''; server.stdout.on('data', value => log += value); server.stderr.on('data', value => log += value);
  let ready = false; for (let attempt = 0; attempt < 60; attempt++) { try { if ((await fetch(`${origin}/login`)).ok) { ready = true; break; } } catch {} await new Promise(resolve => setTimeout(resolve, 500)); }
  assert(ready, log);
  async function request(path, { cookie, body, method } = {}) {
    const response = await fetch(origin + path, { method: method || (body ? 'POST' : 'GET'), headers: { Origin: origin, 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { response, data: await response.json().catch(() => ({})) };
  }
  async function login(email) {
    const { response } = await request('/api/auth/login', { body: { email, password } });
    assert.equal(response.status, 200);
    return response.headers.get('set-cookie').split(';')[0];
  }
  const admin = await login('visit-admin@qa.invalid'), receptionist = await login('visit-reception@qa.invalid'), dentist = await login('visit-dentist@qa.invalid'), foreign = await login('foreign-visit@qa.invalid');
  const appointmentDate = '2027-05-10';
  const booked = await request('/api/records/appointments', { cookie: receptionist, body: { patientId, doctorId, serviceId, appointmentDate, startsAt: '10:00', patientNotes: 'Tooth pain' } });
  assert.equal(booked.response.status, 201, JSON.stringify(booked.data));
  const appointmentId = booked.data.id;
  check((await request(`/api/visits/${appointmentId}`)).response.status === 401, 'Anonymous visit access denied');
  check((await request(`/api/visits/${appointmentId}`, { cookie: foreign })).response.status === 404, 'Other clinic visit access denied');
  const initial = (await request(`/api/visits/${appointmentId}`, { cookie: admin })).data;
  check(initial.patient.name === 'Visit Patient' && initial.doctor.name === 'Dr. Visit QA' && initial.service.name === 'Synthetic filling' && initial.appointment.patientNotes === 'Tooth pain' && initial.visitSession?.status === 'scheduled' && initial.invoices[0]?.totalAmount === 4000 && initial.prescription?.status === 'draft', 'Booking prepares linked visit, service-priced invoice and prescription draft');
  check((await fetch(`${origin}/dashboard/visits/${appointmentId}`, { headers: { Cookie: admin } })).status === 200, 'Visit page renders');
  const checkedIn = await request(`/api/records/appointments/${appointmentId}`, { cookie: receptionist, method: 'PATCH', body: { status: 'checked_in' } });
  check(checkedIn.response.status === 200, 'Reception checks patient in');
  const treatment = await request('/api/records/treatments', { cookie: dentist, body: { appointmentId, patientId, doctorId, serviceId, diagnosis: 'Synthetic diagnosis', treatmentRendered: 'Synthetic filling done', completeAppointment: true, scheduleFollowup: true, followupDueDate: '2027-05-20', followupReason: 'Review filling' } });
  assert.equal(treatment.response.status, 201, JSON.stringify(treatment.data));
  const completed = (await request(`/api/visits/${appointmentId}`, { cookie: admin })).data;
  check(completed.appointment.status === 'completed' && completed.treatments.length === 1 && completed.invoices.length === 1 && completed.followUps.length === 1, 'Treatment completes visit while retaining its booking invoice and recall');
  const frontDesk = (await request(`/api/visits/${appointmentId}`, { cookie: receptionist })).data;
  check(!JSON.stringify(frontDesk.treatments).includes('Synthetic diagnosis'), 'Reception does not see diagnosis');
  const duplicate = await request('/api/records/invoices', { cookie: receptionist, body: { appointmentId, patientId, doctorId, feeType: 'treatment', items: [{ serviceId, description: 'Synthetic filling', quantity: 1, unitPrice: 4000 }] } });
  check(duplicate.response.status === 400, 'Second invoice for one visit rejected');
  const invoiceId = String(completed.invoices[0]._id);
  const paid = await request(`/api/invoices/${invoiceId}/payments`, { cookie: receptionist, body: { amount: 1200, paymentMethod: 'cash', idempotencyKey: 'qa-visit-payment-0001' } });
  check(paid.response.status === 200, 'Partial payment accepted');
  const updated = (await request(`/api/visits/${appointmentId}`, { cookie: admin })).data;
  check(updated.invoices[0].balanceAmount === 2800 && updated.payments[0].amount === 1200, 'Visit shows updated balance and receipt');
  const stats = (await request('/api/stats', { cookie: admin })).data;
  check(stats.actionQueue.some(item => item.kind === 'billing' && item.href === `/dashboard/visits/${appointmentId}`), 'Dashboard billing action opens the exact visit');
  const next = await request('/api/records/appointments', { cookie: receptionist, body: { patientId, doctorId, serviceId, appointmentDate, startsAt: '11:00', patientNotes: 'Follow-up to previous visit' } });
  check(next.response.status === 201 && (await request(`/api/visits/${appointmentId}`, { cookie: admin })).data.otherAppointments.some(item => String(item._id) === next.data.id), 'Next appointment stays linked to same patient');
  const cancelled=await request(`/api/records/appointments/${next.data.id}`,{cookie:receptionist,method:'PATCH',body:{status:'cancelled',cancellationReason:'Synthetic test cancellation'}});
  assert.equal(cancelled.response.status,200,JSON.stringify(cancelled.data));
  const cancelledInvoice=await database.collection('invoices').findOne({clinicId,appointmentId:next.data.id});
  const cancelledSession=await database.collection('visitSessions').findOne({clinicId,appointmentId:next.data.id});
  check(cancelledInvoice.status==='cancelled'&&cancelledInvoice.balanceAmount===0&&cancelledSession.status==='cancelled','Cancelling an unpaid booking clears its automatic invoice and session');
  const newcomer=await request('/api/records/appointments',{cookie:receptionist,body:{patientMode:'new',newPatient:{name:'Synthetic New Patient',phone:'+92 300 999 8877',email:'new-visit@qa.invalid',whatsappConsent:false,emailConsent:true,marketingConsent:false},doctorId,serviceId,appointmentDate,startsAt:'12:00'}});
  assert.equal(newcomer.response.status,201,JSON.stringify(newcomer.data));
  const newcomerVisit=(await request(`/api/visits/${newcomer.data.id}`,{cookie:admin})).data;
  check(newcomerVisit.patient.phone==='03009998877'&&newcomerVisit.invoices[0].totalAmount===4500&&newcomerVisit.invoices[0].items.length===2&&newcomerVisit.prescription.status==='draft','New patient booking normalizes +92 and adds Rs 500 checkup to service fee');
  check(newcomerVisit.communications.emailQueue[0]?.status==='pending_provider'&&newcomerVisit.communications.whatsappQueue.length===0,'Email consent queues a message without claiming delivery; no WhatsApp consent sends nothing');
  const publicBooking=await request('/api/clinic/visit-qa',{body:{patientName:'Synthetic Online Patient',patientPhone:'+92 301 111 2233',patientEmail:'online@qa.invalid',doctorId,serviceId,appointmentDate,startsAt:'13:00',whatsappConsent:false,emailConsent:false}});
  assert.equal(publicBooking.response.status,201,JSON.stringify(publicBooking.data));
  const publicVisit=(await request(`/api/visits/${publicBooking.data.confirmationId}`,{cookie:admin})).data;
  check(publicVisit.patient.phone==='03011112233'&&publicVisit.invoices[0].totalAmount===4500&&publicVisit.visitSession.status==='scheduled','Public website booking creates the same patient, visit and invoice flow');
  console.log(`PASS: ${passed} connected visit checks`);
} finally {
  server?.kill();
  if (dbName.startsWith('dc_visit_')) await client.db(dbName).dropDatabase().catch(() => {});
  await client.close();
}
