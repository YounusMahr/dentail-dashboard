import { ObjectId } from 'mongodb';
import { db } from './db';

export async function writeBlock(user) {
  if (!user?.clinicId || !ObjectId.isValid(user.clinicId)) return 'No clinic assigned';
  if (user.mustChangePassword) return 'Change your temporary password in My account before editing clinic records.';
  const clinic = await (await db()).collection('clinics').findOne({ _id: new ObjectId(user.clinicId) }, { projection: { status: 1, subscription: 1 } });
  if (clinic?.status !== 'active') return 'Clinic is inactive';
  if (process.env.MANAGED_CLINIC === 'true' && (!clinic.subscription?.endsAt || new Date(clinic.subscription.endsAt) <= new Date())) return 'Subscription has expired. Open Plans to renew.';
  return null;
}
