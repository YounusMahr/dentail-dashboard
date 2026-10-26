import { ObjectId } from 'mongodb';
import { hashPassword, verifyPassword } from '@/lib/auth';
import { ensureIndexes } from '@/lib/db';
import { verifyControlAccess } from '@/lib/control-plane.mjs';
import { fail, ok } from '@/lib/http';
import { subscriptionPlan } from '@/lib/subscription-plans';
import { issuePasswordReset, listPasswordResets } from '@/lib/password-reset';

export const runtime = 'nodejs';

const services = [
  { name: 'Consultation & Dental Checkup', standardFee: 1500, durationMinutes: 20 },
  { name: 'Scaling & Polishing', standardFee: 3000, durationMinutes: 30 },
  { name: 'Tooth Restoration / Filling', standardFee: 4000, durationMinutes: 30 },
];
function addMonthsClamped(date, months) {
  const result = new Date(date), day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

export async function POST(request) {
  const raw = await request.text();
  let database, slug, grantId;
  try { ({ database, slug, grantId } = await verifyControlAccess(request, raw)); }
  catch { return fail('Unauthorized', 401); }
  let body;
  try { body = JSON.parse(raw); } catch { return fail('Invalid JSON'); }
  if (body.action === 'control.revoke' && grantId) {
    await database.collection('controlGrants').updateOne({ _id: grantId, revokedAt: { $exists: false } }, { $set: { revokedAt: new Date() } });
    return ok({ revoked: true });
  }
  if (body.action === 'ping') return ok({ ready: true, slug });
  if (body.action === 'admin.create') {
    const details = body.clinic || {}, admin = body.admin || {};
    const username = String(admin.username || '').trim().toLowerCase();
    const usernameIsEmail = /^\S+@\S+\.\S+$/.test(username);
    const email = usernameIsEmail ? username : String(details.email || '').trim().toLowerCase();
    const password = String(admin.password || '');
    if (details.slug !== slug || !String(details.name || '').trim() || !(usernameIsEmail || /^[a-z][a-z0-9._-]{2,39}$/.test(username)) || !/^\S+@\S+\.\S+$/.test(email) || password.length < 12 || password.length > 128) return fail('Enter a valid username, clinic email and a password of 12 to 128 characters');
    await ensureIndexes();
    const existing = await database.collection('clinics').findOne({ slug });
    const previousAdmin = await database.collection('users').findOne({ $or: [{ email }, { username }, { email: username }, { username: email }] });
    if (previousAdmin) {
      if (previousAdmin.clinicId === String(existing?._id) && previousAdmin.role === 'clinic_admin' && (previousAdmin.username || previousAdmin.email) === username && verifyPassword(password, previousAdmin.passwordHash)) return ok({ clinicId: previousAdmin.clinicId, userId: String(previousAdmin._id), status: existing.status, email: previousAdmin.email, alreadyCreated: true });
      return fail('Admin username or email already exists in this clinic', 409);
    }
    const session = database.client.startSession();
    try {
      let clinicId = existing ? String(existing._id) : null, userId;
      await session.withTransaction(async () => {
        if (!clinicId) {
          const created = await database.collection('clinics').insertOne({ name: String(details.name).slice(0, 150), slug, phone: String(details.phone || '').slice(0, 40), address: String(details.address || '').slice(0, 500), email: String(details.email || '').slice(0, 150), currency: 'PKR', timezone: 'Asia/Karachi', status: 'suspended', subscription: { status: 'pending_payment' }, createdAt: new Date() }, { session });
          clinicId = String(created.insertedId);
          await database.collection('services').insertMany(services.map(item => ({ ...item, clinicId, active: true, createdAt: new Date() })), { session });
        }
        const createdAdmin = await database.collection('users').insertOne({ clinicId, name: String(admin.name || `${details.name} Admin`).slice(0, 150), username, email, phone: '', passwordHash: hashPassword(password), role: 'clinic_admin', active: true, mustChangePassword: false, createdAt: new Date() }, { session });
        userId = String(createdAdmin.insertedId);
      });
      return ok({ clinicId, userId, status: existing?.status || 'pending_payment', email }, 201);
    } catch (error) { return fail(error.code === 11000 ? 'Admin username or email already exists in this clinic' : 'Could not create clinic admin', 409); }
    finally { await session.endSession(); }
  }
  if (body.action === 'provision') {
    const clinic = body.clinic || {}, admin = body.admin || {};
    if (clinic.slug !== slug || !clinic.name || !admin.name || !/^\S+@\S+\.\S+$/.test(admin.email || '') || String(admin.password || '').length < 12) return fail('Invalid clinic or admin details');
    await ensureIndexes();
    const existing = await database.collection('clinics').findOne({ slug });
    if (existing) return ok({ clinicId: String(existing._id), alreadyProvisioned: true });
    const session = database.client.startSession();
    try {
      let clinicId;
      await session.withTransaction(async () => {
        const result = await database.collection('clinics').insertOne({ name: String(clinic.name).slice(0, 150), slug, phone: String(clinic.phone || '').slice(0, 30), address: String(clinic.address || '').slice(0, 500), currency: 'PKR', timezone: 'Asia/Karachi', status: 'suspended', subscription: { status: 'pending_payment' }, createdAt: new Date() }, { session });
        clinicId = String(result.insertedId);
        const created = await database.collection('users').insertOne({ clinicId, name: String(admin.name).slice(0, 150), email: String(admin.email).toLowerCase(), phone: String(admin.phone || '').slice(0, 30), passwordHash: hashPassword(admin.password), role: 'clinic_admin', active: true, mustChangePassword: true, createdAt: new Date() }, { session });
        await database.collection('doctors').insertOne({ clinicId, userId: String(created.insertedId), name: String(admin.name).slice(0, 150), email: String(admin.email).toLowerCase(), specialization: 'Dental Surgeon / Clinic Director', consultationFee: 1500, slotMinutes: 30, workingDays: 'monday,tuesday,wednesday,thursday,friday,saturday', startTime: '10:00', endTime: '20:00', active: true, createdAt: new Date() }, { session });
        await database.collection('services').insertMany(services.map(item => ({ ...item, clinicId, active: true, createdAt: new Date() })), { session });
      });
      return ok({ clinicId }, 201);
    } catch (error) { return fail(error.code === 11000 ? 'Clinic or admin already exists' : 'Provisioning failed', 409); }
    finally { await session.endSession(); }
  }

  const clinic = await database.collection('clinics').findOne({ slug });
  if (!clinic) return fail('Clinic not provisioned', 404);
  const q = { clinicId: String(clinic._id) };
  if (body.action === 'admin.block' || body.action === 'admin.unblock') {
    const byId = ObjectId.isValid(body.userId) ? { _id: new ObjectId(body.userId) } : null;
    const username = String(body.username || '').trim().toLowerCase();
    const email = String(body.email || '').trim().toLowerCase();
    if (!byId && !username && !email) return fail('Admin account is required');
    const identity = byId || { $or: [...(username ? [{ username }] : []), ...(email ? [{ email }] : [])] };
    const admin = await database.collection('users').findOne({ ...q, role: 'clinic_admin', ...identity });
    if (!admin) return fail('Clinic admin not found', 404);
    const blocked = body.action === 'admin.block';
    const session = database.client.startSession();
    try {
      await session.withTransaction(async () => {
        await database.collection('users').updateOne({ _id: admin._id, ...q, role: 'clinic_admin' }, { $set: { active: !blocked, updatedAt: new Date() } }, { session });
        if (blocked) await database.collection('sessions').deleteMany({ userId: String(admin._id) }, { session });
        await database.collection('auditLogs').insertOne({ ...q, module: 'users', recordId: String(admin._id), action: blocked ? 'admin-blocked' : 'admin-unblocked', createdAt: new Date() }, { session });
      });
    } catch { return fail('Could not update admin access', 409); }
    finally { await session.endSession(); }
    return ok({ blocked, userId: String(admin._id) });
  }
  if (body.action === 'password-reset.list') return ok({ requests: await listPasswordResets(database, q.clinicId) });
  if (body.action === 'password-reset.issue') {
    try { return ok(await issuePasswordReset(database, body.requestId, q.clinicId)); }
    catch (error) { return fail(error.message, 409); }
  }
  if (body.action === 'list-payments') {
    const payments = await database.collection('subscriptionPayments').find(q, { projection: { receiptImage: 0 } }).sort({ createdAt: -1 }).limit(100).toArray();
    return ok({ payments, subscription: clinic.subscription || null, status: clinic.status });
  }
  if (body.action === 'subscription.approve') {
    if (!ObjectId.isValid(body.paymentId)) return fail('Invalid payment');
    const payment = await database.collection('subscriptionPayments').findOne({ ...q, _id: new ObjectId(body.paymentId) });
    if (payment?.status === 'approved' && clinic.subscription?.paymentId === String(payment._id)) return ok({ status: clinic.status, endsAt: clinic.subscription.endsAt, planId: payment.planId, alreadyApproved: true });
    if (!payment || payment.status !== 'pending_review') return fail('Payment is not pending review', 409);
    const start = new Date();
    const currentEnd = clinic.subscription?.endsAt ? new Date(clinic.subscription.endsAt) : null;
    if (currentEnd && currentEnd > start) start.setTime(currentEnd.getTime());
    const end = addMonthsClamped(start, Number(payment.months || 1));
    const session = database.client.startSession();
    try { await session.withTransaction(async () => {
      const changed = await database.collection('subscriptionPayments').updateOne({ ...q, _id: payment._id, status: 'pending_review' }, { $set: { status: 'approved', reviewedAt: new Date(), reviewNote: String(body.note || '').slice(0, 500) } }, { session });
      if (!changed.modifiedCount) throw new Error('Payment was already reviewed');
      await database.collection('clinics').updateOne({ _id: clinic._id }, { $set: { status: 'active', subscription: { status: 'active', planId: payment.planId, startedAt: start, endsAt: end, paymentId: String(payment._id) }, updatedAt: new Date() } }, { session });
    }); } catch { return fail('Could not approve payment', 409); } finally { await session.endSession(); }
    return ok({ status: 'active', endsAt: end, planId: payment.planId });
  }
  if (body.action === 'subscription.reject') {
    if (!ObjectId.isValid(body.paymentId)) return fail('Invalid payment');
    const changed = await database.collection('subscriptionPayments').updateOne({ ...q, _id: new ObjectId(body.paymentId), status: 'pending_review' }, { $set: { status: 'rejected', reviewedAt: new Date(), reviewNote: String(body.note || '').slice(0, 500) } });
    return changed.modifiedCount ? ok({ status: 'rejected' }) : fail('Payment is not pending review', 409);
  }
  if (body.action === 'subscription.grant') {
    const plan = subscriptionPlan(body.planId);
    const note = String(body.note || '').trim().slice(0, 500);
    if (!plan || note.length < 5) return fail('Choose a plan and add a reason for manual activation');
    const startedAt = new Date(), endsAt = addMonthsClamped(startedAt, plan.months);
    await database.collection('clinics').updateOne({ _id: clinic._id }, { $set: { status: 'active', subscription: { status: 'active', planId: plan.id, startedAt, endsAt, manual: true, reason: note }, updatedAt: new Date() } });
    await database.collection('auditLogs').insertOne({ ...q, module: 'subscription', recordId: String(clinic._id), action: 'manual-activation', reason: note, createdAt: new Date() });
    return ok({ status: 'active', endsAt, planId: plan.id, manual: true });
  }
  if (body.action === 'subscription.suspend' || body.action === 'subscription.reactivate') {
    const active = body.action === 'subscription.reactivate';
    if (active && (!clinic.subscription?.endsAt || new Date(clinic.subscription.endsAt) <= new Date())) return fail('Subscription has expired; approve a new payment first', 409);
    await database.collection('clinics').updateOne({ _id: clinic._id }, { $set: { status: active ? 'active' : 'suspended', 'subscription.status': active ? 'active' : 'suspended', updatedAt: new Date() } });
    return ok({ status: active ? 'active' : 'suspended' });
  }
  return fail('Unknown action');
}
