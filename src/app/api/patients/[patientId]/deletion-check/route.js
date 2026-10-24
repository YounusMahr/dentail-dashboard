import { ObjectId } from 'mongodb';
import { currentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { fail, id, ok } from '@/lib/http';
import { patientDeletionStatus } from '@/lib/patient-deletion-check';

export async function GET(_request, { params }) {
  const { patientId } = await params;
  const user = await currentUser();
  if (!user?.clinicId || !['clinic_admin', 'receptionist', 'dentist'].includes(user.role) || !id(patientId)) return fail('Not found or unauthorized', 404);
  const database = await db();
  const patient = await database.collection('patients').findOne({ _id: new ObjectId(patientId), clinicId: user.clinicId }, { projection: { _id: 1 } });
  if (!patient) return fail('Patient not found', 404);

  const { removableAppointmentIds, ...status } = await patientDeletionStatus(database, user.clinicId, patientId);
  return ok(status);
}
