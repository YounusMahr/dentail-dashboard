import { ObjectId } from 'mongodb';
import { currentUser, sameOrigin } from '@/lib/auth';
import { db } from '@/lib/db';
import { fail, id, ok } from '@/lib/http';

export async function GET() {
  const user = await currentUser();
  if (user?.role !== 'platform_owner') return fail('Unauthorized', 403);
  const database = await db();
  const clinics = await database.collection('clinics').find({}, { projection: { name: 1, slug: 1, status: 1, city: 1, phone: 1, createdAt: 1 } }).sort({ createdAt: -1 }).limit(300).toArray();
  const counts = await Promise.all(clinics.map(async clinic => {
    const clinicId = String(clinic._id);
    const [patients, appointments, staff, treatments] = await Promise.all(['patients', 'appointments', 'users', 'treatments'].map(collection => database.collection(collection).countDocuments({ clinicId })));
    return { id: clinicId, patients, appointments, staff, treatments };
  }));
  return ok({ clinics, counts, metrics: { total: clinics.length, active: clinics.filter(clinic => clinic.status === 'active').length, patients: counts.reduce((sum, row) => sum + row.patients, 0), appointments: counts.reduce((sum, row) => sum + row.appointments, 0) } });
}

export async function PATCH(request) {
  const user = await currentUser();
  if (!sameOrigin(request) || user?.role !== 'platform_owner') return fail('Unauthorized', 403);
  const body = await request.json().catch(() => ({}));
  if (!id(body.clinicId) || !['active', 'inactive', 'suspended'].includes(body.status)) return fail('Invalid clinic or status');
  const result = await (await db()).collection('clinics').updateOne({ _id: new ObjectId(body.clinicId) }, { $set: { status: body.status, updatedAt: new Date() } });
  return result.matchedCount ? ok({ success: true }) : fail('Clinic not found', 404);
}
