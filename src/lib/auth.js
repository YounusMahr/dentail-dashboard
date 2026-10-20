import { cookies } from 'next/headers';
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import { db } from './db';

const COOKIE = 'dental_session';
const digest = (value) => createHash('sha256').update(value).digest('hex');

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  return `scrypt:${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}

export function verifyPassword(password, stored) {
  if (stored?.startsWith('$2y$') || stored?.startsWith('$2a$') || stored?.startsWith('$2b$')) return bcrypt.compareSync(password, stored.replace(/^\$2y\$/, '$2b$'));
  if (!stored?.startsWith('scrypt:')) return false;
  const [, salt, value] = stored.split(':');
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(value, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function createSession(userId) {
  const token = randomBytes(32).toString('hex');
  await (await db()).collection('sessions').insertOne({ tokenHash: digest(token), userId, expiresAt: new Date(Date.now() + 14 * 86400000) });
  (await cookies()).set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 14 * 86400 });
}

export async function clearSession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await (await db()).collection('sessions').deleteOne({ tokenHash: digest(token) });
  jar.delete(COOKIE);
}

export async function currentUser() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const database = await db();
  const session = await database.collection('sessions').findOne({ tokenHash: digest(token), expiresAt: { $gt: new Date() } });
  if (!session || !ObjectId.isValid(session.userId)) return null;
  const user = await database.collection('users').findOne({ _id: new ObjectId(session.userId), active: true }, { projection: { passwordHash: 0 } });
  if (user?.role === 'dentist') {
    const doctor = await database.collection('doctors').findOne({ userId: String(user._id), clinicId: user.clinicId });
    user.doctorId = doctor ? String(doctor._id) : null;
  }
  return user || null;
}

export function can(user, roles) { return !!user && roles.includes(user.role); }
export function sameOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  return new URL(origin).host === new URL(request.url).host;
}
