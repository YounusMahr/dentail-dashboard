import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { db } from './db.js';

let nonceIndexesPromise;

export async function verifyControlAccess(request, body = '') {
  const authorization = request.headers.get('authorization') || '';
  if (authorization.startsWith('Bearer ')) {
    const token = authorization.slice(7);
    if (!/^[a-f0-9]{64}$/i.test(token)) throw new Error('Invalid control token');
    const database = await db();
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const grant = await database.collection('controlGrants').findOne({ tokenHash, revokedAt: { $exists: false } });
    if (!grant) throw new Error('Control token is revoked or invalid');
    return { database, slug: grant.slug, clinicId: grant.clinicId, grantId: grant._id };
  }
  const database = await verifyControlRequest(request, body);
  const slug = process.env.MANAGED_CLINIC_SLUG;
  if (process.env.MANAGED_CLINIC !== 'true' || !slug || !process.env.MONGODB_DB) throw new Error('Managed clinic mode is not configured');
  return { database, slug };
}

export async function verifyControlRequest(request, body = '') {
  const secret = process.env.CLINIC_CONTROL_SECRET;
  if (!secret || secret.length < 32) throw new Error('Clinic control secret is not configured');
  const timestamp = request.headers.get('x-control-timestamp') || '';
  const nonce = request.headers.get('x-control-nonce') || '';
  const signature = request.headers.get('x-control-signature') || '';
  if (!/^\d{13}$/.test(timestamp) || Math.abs(Date.now() - Number(timestamp)) > 5 * 60_000 || !/^[a-f0-9]{32,64}$/i.test(nonce) || !/^[a-f0-9]{64}$/i.test(signature)) throw new Error('Invalid control request');
  const target = new URL(request.url), path = target.pathname + target.search;
  const expected = createHmac('sha256', secret).update(`${timestamp}.${nonce}.${path}.${body}`).digest();
  if (!timingSafeEqual(expected, Buffer.from(signature, 'hex'))) throw new Error('Invalid control signature');
  const database = await db();
  if (!nonceIndexesPromise) nonceIndexesPromise = Promise.all([
    database.collection('controlNonces').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    database.collection('controlNonces').createIndex({ nonce: 1 }, { unique: true }),
  ]).catch(error => { nonceIndexesPromise = undefined; throw error; });
  await nonceIndexesPromise;
  try { await database.collection('controlNonces').insertOne({ nonce, expiresAt: new Date(Date.now() + 10 * 60_000) }); }
  catch (error) { if (error.code === 11000) throw new Error('Control request was already used'); throw error; }
  return database;
}
