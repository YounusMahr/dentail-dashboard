import { currentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { fail, ok } from '@/lib/http';
import {ObjectId} from 'mongodb';

export async function GET() {
  const user = await currentUser();
  if (!user?.clinicId) return fail('Unauthorized', 401);
  const database = await db(), q = { clinicId: user.clinicId };
  const [patients, doctors, services, clinic] = await Promise.all([
    database.collection('patients').find(q, { projection: { name: 1, phone: 1 } }).sort({ name: 1 }).toArray(),
    database.collection('doctors').find({ ...q, active: { $ne: false } }, { projection: { name: 1, consultationFee: 1, standardFee: 1 } }).sort({ name: 1 }).toArray(),
    database.collection('services').find({ ...q, active: { $ne: false } }, { projection: { name: 1, standardFee: 1, includesCheckup: 1, category: 1 } }).sort({ name: 1 }).toArray(),
    database.collection('clinics').findOne({_id:new ObjectId(user.clinicId)},{projection:{newPatientCheckupFee:1}}),
  ]);
  const appointments = await database.collection('appointments').find({...q,...(user.role==='dentist'?{doctorId:user.doctorId}:{})},{projection:{patientId:1,doctorId:1,serviceId:1,appointmentDate:1,startsAt:1,status:1}}).sort({appointmentDate:-1}).limit(300).toArray();
  return ok({ patients, doctors, services, appointments, currency:user.currency, timezone:user.timezone, newPatientCheckupFee:clinic?.newPatientCheckupFee??500 });
}
