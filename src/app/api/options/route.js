import { currentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { fail, ok } from '@/lib/http';

export async function GET() {
  const user = await currentUser();
  if (!user?.clinicId) return fail('Unauthorized', 401);
  const database = await db(), q = { clinicId: user.clinicId };
  const [patients, doctors, services] = await Promise.all([
    database.collection('patients').find(q, { projection: { name: 1, phone: 1 } }).sort({ name: 1 }).toArray(),
    database.collection('doctors').find({ ...q, active: { $ne: false } }, { projection: { name: 1, consultationFee: 1, standardFee: 1 } }).sort({ name: 1 }).toArray(),
    database.collection('services').find({ ...q, active: { $ne: false } }, { projection: { name: 1 } }).sort({ name: 1 }).toArray(),
  ]);
  return ok({ patients, doctors, services });
}
