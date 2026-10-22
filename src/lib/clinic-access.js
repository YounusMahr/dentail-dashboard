import { ObjectId } from 'mongodb';
import { db } from './db';

export async function writeBlock(user) {
  if (!user?.clinicId || !ObjectId.isValid(user.clinicId)) return 'No clinic assigned';
  const clinic = await (await db()).collection('clinics').findOne({ _id: new ObjectId(user.clinicId) }, { projection: { status: 1 } });
  return clinic?.status === 'active' ? null : 'Clinic is inactive';
}
