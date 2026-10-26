import { createHash, randomBytes } from 'node:crypto';
import { db } from '@/lib/db';
import { verifyPassword } from '@/lib/auth';
import { fail } from '@/lib/http';

export const runtime = 'nodejs';

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const slug = String(body.slug || '').trim().toLowerCase();
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || !/^\S+@\S+\.\S+$/.test(email) || !password || password.length > 128) return fail('Enter the existing clinic admin email and password');
  const database = await db();
  const clinic = await database.collection('clinics').findOne({ slug }, { projection: { _id: 1, status: 1 } });
  if (!clinic) return fail('Clinic not found', 404);

  const attemptKey = createHash('sha256').update(`${slug}:${email}`).digest('hex');
  const attempts = database.collection('controlPairAttempts');
  await attempts.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  if (await attempts.countDocuments({ attemptKey, expiresAt: { $gt: new Date() } }) >= 5) return fail('Too many attempts. Try again in 15 minutes.', 429);

  const admin = await database.collection('users').findOne({ clinicId: String(clinic._id), role: 'clinic_admin', active: true, $or: [{ email }, { username: email }] });
  if (!admin || !verifyPassword(password, admin.passwordHash)) {
    await attempts.insertOne({ attemptKey, expiresAt: new Date(Date.now() + 15 * 60_000) });
    return fail('Invalid clinic admin credentials', 401);
  }

  const token = randomBytes(32).toString('hex');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  await database.collection('controlGrants').createIndex({ tokenHash: 1 }, { unique: true });
  await database.collection('controlGrants').insertOne({ tokenHash, clinicId: String(clinic._id), slug, issuedBy: String(admin._id), createdAt: new Date() });
  await attempts.deleteMany({ attemptKey });
  return Response.json({ token, clinicId: String(clinic._id), adminUserId: String(admin._id), adminEmail: admin.email || email, status: clinic.status }, { headers: { 'Cache-Control': 'no-store' } });
}
