import { ObjectId } from 'mongodb';
import { currentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { fail, id } from '@/lib/http';
import { prescriptionHtml } from '@/lib/prescription-print';

export async function GET(request, { params }) {
  const user = await currentUser(), { treatmentId } = await params;
  if (!['clinic_admin', 'dentist'].includes(user?.role) || !id(treatmentId)) return fail('Unauthorized', 403);
  const database = await db();
  const treatment = await database.collection('treatments').findOne({ _id: new ObjectId(treatmentId), clinicId: user.clinicId });
  if (!treatment || user.role === 'dentist' && treatment.doctorId !== user.doctorId) return fail('Not found', 404);
  const [patient, doctor, clinic] = await Promise.all([
    database.collection('patients').findOne({ _id: new ObjectId(treatment.patientId), clinicId: user.clinicId }),
    database.collection('doctors').findOne({ _id: new ObjectId(treatment.doctorId), clinicId: user.clinicId }),
    database.collection('clinics').findOne({ _id: new ObjectId(user.clinicId) }),
  ]);
  if (!patient || !doctor || !clinic) return fail('Linked clinic record not found', 404);
  const html = prescriptionHtml({ ...treatment, documentType: 'treatment', status: 'issued' }, patient, doctor, clinic);
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store' } });
}
