import { ObjectId } from 'mongodb';
import { currentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { fail, id, ok } from '@/lib/http';

export async function GET(request, { params }) {
  const user = await currentUser();
  const { appointmentId } = await params;
  if (!user?.clinicId) return fail('Unauthorized', 401);
  if (!id(appointmentId)) return fail('Invalid appointment', 400);
  const database = await db();
  const clinicId = user.clinicId;
  const appointment = await database.collection('appointments').findOne({
    _id: new ObjectId(appointmentId), clinicId,
    ...(user.role === 'dentist' ? { doctorId: user.doctorId } : {}),
  });
  if (!appointment) return fail('Appointment not found', 404);
  const patientId = appointment.patientId;
  const [patient, doctor, service, treatments, invoices, followUps, otherAppointments, services] = await Promise.all([
    database.collection('patients').findOne({ _id: new ObjectId(patientId), clinicId }),
    id(appointment.doctorId) ? database.collection('doctors').findOne({ _id: new ObjectId(appointment.doctorId), clinicId }, { projection: { name: 1, specialization: 1, consultationFee: 1 } }) : null,
    id(appointment.serviceId) ? database.collection('services').findOne({ _id: new ObjectId(appointment.serviceId), clinicId }, { projection: { name: 1, standardFee: 1 } }) : null,
    database.collection('treatments').find({ clinicId, appointmentId }, { projection: user.role === 'receptionist' ? { diagnosis: 0, clinicalNotes: 0, prescription: 0 } : undefined }).sort({ createdAt: -1 }).toArray(),
    database.collection('invoices').find({ clinicId, appointmentId, status: { $ne: 'cancelled' } }).sort({ createdAt: -1 }).toArray(),
    database.collection('follow-ups').find({ clinicId, patientId, status: { $in: ['pending', 'contacted'] } }).sort({ dueDate: 1 }).limit(5).toArray(),
    database.collection('appointments').find({ clinicId, patientId, _id: { $ne: new ObjectId(appointmentId) } }, { projection: { appointmentDate: 1, startsAt: 1, status: 1, doctorId: 1 } }).sort({ appointmentDate: -1, startsAt: -1 }).limit(6).toArray(),
    database.collection('services').find({ clinicId, active: { $ne: false } }, { projection: { name: 1, standardFee: 1 } }).sort({ name: 1 }).toArray(),
  ]);
  if (!patient) return fail('Patient file not found', 404);
  const payments = invoices.length ? await database.collection('payments').find({ clinicId, invoiceId: { $in: invoices.map(invoice => String(invoice._id)) } }).sort({ createdAt: -1 }).toArray() : [];
  return ok({ appointment, patient, doctor, service, treatments, invoices, payments, followUps, otherAppointments, services, role: user.role, currency: user.currency, timezone: user.timezone });
}
