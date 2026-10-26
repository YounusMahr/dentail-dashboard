import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { ObjectId } from 'mongodb';
import { hashPassword } from './auth';
import { smtpSender, smtpTransport } from './clinic-smtp';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
let indexesPromise;

function resetKey() {
  const secret = process.env.CLINIC_CONTROL_SECRET || process.env.PASSWORD_RESET_SECRET;
  if (!secret || secret.length < 32) throw new Error('Password reset secret is not configured');
  return createHash('sha256').update(secret).digest();
}

function protectPassword(password) {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', resetKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(password, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map(part => part.toString('base64url')).join('.');
}

function revealPassword(encrypted) {
  const [iv, tag, ciphertext] = String(encrypted || '').split('.');
  if (!iv || !tag || !ciphertext) throw new Error('Prepared password is unavailable');
  const decipher = createDecipheriv('aes-256-gcm', resetKey(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64url')), decipher.final()]).toString('utf8');
}

async function ensureResetIndexes(database) {
  if (!indexesPromise) indexesPromise = Promise.all([
    database.collection('passwordResetRequests').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    database.collection('passwordResetRequests').createIndex({ clinicId: 1, status: 1, requestedAt: -1 }),
    database.collection('passwordResetLimits').createIndex({ key: 1 }, { unique: true }),
    database.collection('passwordResetLimits').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
  ]).catch(error => { indexesPromise = undefined; throw error; });
  await indexesPromise;
}

export async function queuePasswordReset(database, suppliedEmail) {
  const email = String(suppliedEmail || '').trim().toLowerCase();
  if (email.length > 254 || !emailPattern.test(email)) return { invalid: true };
  await ensureResetIndexes(database);
  const hour = Math.floor(Date.now() / 3600000);
  const key = createHash('sha256').update(`${email}:${hour}`).digest('hex');
  const limits = database.collection('passwordResetLimits');
  await limits.updateOne({ key }, { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date((hour + 2) * 3600000) } }, { upsert: true });
  if ((await limits.findOne({ key }, { projection: { count: 1 } }))?.count > 5) return { limited: true };
  const user = await database.collection('users').findOne({ email, role: 'clinic_admin', active: true }, { projection: { email: 1, clinicId: 1 } });
  if (!user?.clinicId || !ObjectId.isValid(user.clinicId)) return { accepted: true };
  const clinic = await database.collection('clinics').findOne({ _id: new ObjectId(user.clinicId) }, { projection: { name: 1 } });
  if (!clinic) return { accepted: true };
  const requests = database.collection('passwordResetRequests');
  const existing = await requests.findOne({ userId: String(user._id), status: { $in: ['pending', 'processing', 'delivery_sent'] }, expiresAt: { $gt: new Date() } });
  if (!existing) await requests.insertOne({ clinicId: user.clinicId, userId: String(user._id), email: user.email, clinicName: clinic.name, status: 'pending', requestedAt: new Date(), expiresAt: new Date(Date.now() + 24 * 3600000) });
  return { accepted: true };
}

export async function listPasswordResets(database, clinicId) {
  await database.collection('passwordResetRequests').updateMany({ clinicId, status: 'processing', processingUntil: { $lte: new Date() } }, { $set: { status: 'pending' }, $unset: { processingUntil: '' } });
  const rows = await database.collection('passwordResetRequests').find({ clinicId, expiresAt: { $gt: new Date() } }, { projection: { userId: 0, preparedHash: 0, preparedPassword: 0 } }).sort({ requestedAt: -1 }).limit(100).toArray();
  return rows;
}

async function sendResetEmail(database, user, clinicName, password, requestId) {
  const subject = `${clinicName} — temporary login password`;
  const text = `Hello ${user.name || 'Clinic Admin'},\n\nA temporary password was requested for your ${clinicName} clinic account.\n\nEmail: ${user.email}\nTemporary password: ${password}\n\nSign in to your clinic dashboard and change this password immediately in My account. If you did not request it, contact your platform administrator.\n`;
  const smtp = await database.collection('clinicSmtpSettings').findOne({ clinicId: user.clinicId, enabled: true });
  if (smtp) {
    const transport = smtpTransport(smtp);
    try {
      const result = await transport.sendMail({ from: smtpSender(smtp), to: user.email, subject, text });
      if (!result.accepted?.some(address => address.toLowerCase() === user.email)) throw new Error('Email provider did not accept the password email');
    }
    finally { transport.close(); }
    return 'clinic_smtp';
  }
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) throw new Error('Configure clinic SMTP or RESEND_API_KEY and EMAIL_FROM before sending password resets');
  const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': `clinic-password-reset-${requestId}` }, body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [user.email], subject, text }), signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error('Email provider did not accept the password email');
  return 'resend';
}

async function commitDeliveredPassword(database, request) {
  const session = database.client.startSession();
  try {
    await session.withTransaction(async () => {
      const reset = await database.collection('passwordResetRequests').updateOne({ _id: request._id, status: 'delivery_sent' }, { $set: { status: 'completed', completedAt: new Date() }, $unset: { preparedHash: '', preparedPassword: '', processingUntil: '' } }, { session });
      if (!reset.matchedCount) throw new Error('Reset request was already completed');
      const changed = await database.collection('users').updateOne({ _id: new ObjectId(request.userId), email: request.email, clinicId: request.clinicId, role: 'clinic_admin', active: true }, { $set: { passwordHash: request.preparedHash, mustChangePassword: true, updatedAt: new Date() } }, { session });
      if (!changed.matchedCount) throw new Error('Clinic admin account changed; password was not activated');
      await database.collection('sessions').deleteMany({ userId: request.userId }, { session });
    });
    return { status: 'completed' };
  } finally { await session.endSession(); }
}

export async function issuePasswordReset(database, requestId, clinicId) {
  if (!ObjectId.isValid(requestId)) throw new Error('Invalid reset request');
  await ensureResetIndexes(database);
  const requests = database.collection('passwordResetRequests');
  const id = new ObjectId(requestId);
  let request = await requests.findOne({ _id: id, clinicId, expiresAt: { $gt: new Date() } });
  if (!request) throw new Error('Reset request expired or unavailable');
  if (request.status === 'completed') return { status: 'completed' };
  if (request.status === 'delivery_sent') return commitDeliveredPassword(database, request);
  if (request.status === 'processing' && request.processingUntil <= new Date()) {
    await requests.updateOne({ _id: id, status: 'processing', processingUntil: { $lte: new Date() } }, { $set: { status: 'pending' }, $unset: { processingUntil: '' } });
    request = await requests.findOne({ _id: id, clinicId });
  }
  if (request.status !== 'pending') throw new Error('Reset request is already being processed');
  const user = await database.collection('users').findOne({ _id: new ObjectId(request.userId), email: request.email, clinicId: request.clinicId, role: 'clinic_admin', active: true });
  if (!user) throw new Error('Clinic admin account is no longer active');
  const password = request.preparedPassword ? revealPassword(request.preparedPassword) : randomBytes(18).toString('base64url');
  const preparedHash = request.preparedHash || hashPassword(password);
  const preparedPassword = request.preparedPassword || protectPassword(password);
  const claimed = await requests.updateOne({ _id: id, status: 'pending' }, { $set: { status: 'processing', preparedHash, preparedPassword, processingUntil: new Date(Date.now() + 2 * 60000) } });
  if (!claimed.modifiedCount) throw new Error('Reset request is already being processed');
  let provider;
  try { provider = await sendResetEmail(database, user, request.clinicName || 'DentalCare', password, requestId); }
  catch (error) {
    await requests.updateOne({ _id: id, status: 'processing' }, { $set: { status: 'pending', lastError: String(error.message).slice(0, 250) }, $unset: { processingUntil: '' } });
    throw error;
  }
  await requests.updateOne({ _id: id, status: 'processing' }, { $set: { status: 'delivery_sent', provider, deliveredAt: new Date() }, $unset: { processingUntil: '', lastError: '' } });
  request = await requests.findOne({ _id: id });
  return commitDeliveredPassword(database, request);
}
