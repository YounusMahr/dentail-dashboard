import { ObjectId } from 'mongodb';
import { currentUser, sameOrigin } from '@/lib/auth';
import { db } from '@/lib/db';
import { fail, id, ok } from '@/lib/http';

export async function GET() {
  const user = await currentUser();
  if (user?.role !== 'platform_owner') return fail('Unauthorized', 403);
  const database = await db();
  const [clinics, subscriptions, requests, plans] = await Promise.all([
    database.collection('clinics').find({}).sort({ createdAt: -1 }).limit(300).toArray(),
    database.collection('subscriptions').find({}).toArray(),
    database.collection('planRequests').find({ status: 'pending' }).toArray(),
    database.collection('subscriptionPlans').find({ active: true }).toArray()
  ]);
  return ok({ clinics, subscriptions, requests, plans });
}

export async function PATCH(request) {
  const user = await currentUser();
  if (!sameOrigin(request) || user?.role !== 'platform_owner') return fail('Unauthorized', 403);
  const body = await request.json().catch(() => ({}));
  if (!id(body.clinicId)) return fail('Invalid clinic');
  const database = await db();
  if (body.action === 'approvePlan') {
    const reference = String(body.paymentReference || '').trim().slice(0, 100);
    const pending = await database.collection('planRequests').findOne({ clinicId: body.clinicId, status: 'pending' });
    if (!pending || !reference) return fail('Pending request and verified payment reference required');
    const plan = await database.collection('subscriptionPlans').findOne({ slug: pending.plan, active: true });
    const subscription = await database.collection('subscriptions').findOne({ clinicId: body.clinicId }, { sort: { createdAt: -1 } });
    if (!plan || !subscription) return fail('Plan or subscription missing', 404);
    const [doctorCount, staffCount, patientCount] = await Promise.all([
      database.collection('doctors').countDocuments({ clinicId: body.clinicId, active: { $ne: false } }),
      database.collection('users').countDocuments({ clinicId: body.clinicId, active: { $ne: false } }),
      database.collection('patients').countDocuments({ clinicId: body.clinicId })
    ]);
    if (doctorCount > plan.maxDoctors || staffCount > plan.maxStaff || patientCount > plan.maxPatients) return fail('Current usage exceeds this plan limit', 409);
    const now = new Date();
    const start = pending.action === 'renewal' && subscription.periodEndsAt && new Date(subscription.periodEndsAt) > now ? new Date(subscription.periodEndsAt) : now;
    const end = new Date(start);
    const day = end.getUTCDate();
    end.setUTCDate(1);
    end.setUTCMonth(end.getUTCMonth() + (pending.interval === 'yearly' ? 12 : 1));
    const monthEnd = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate();
    end.setUTCDate(Math.min(day, monthEnd));
    const amount = pending.interval === 'yearly' ? Number(plan.priceAnnual) : Number(plan.priceMonthly);
    const session = database.client.startSession();
    try {
      await session.withTransaction(async () => {
        const claimed = await database.collection('planRequests').updateOne({ _id: pending._id, status: 'pending' }, { $set: { status: 'approved', paymentReference: reference, approvedBy: String(user._id), updatedAt: now } }, { session });
        if (!claimed.modifiedCount) throw new Error('Request already processed');
        await database.collection('subscriptions').updateOne({ _id: subscription._id }, { $set: { plan: plan.slug, billingInterval: pending.interval, status: 'active', periodEndsAt: end, updatedAt: now } }, { session });
        await database.collection('platformInvoices').insertOne({ clinicId: body.clinicId, subscriptionId: String(subscription._id), invoiceNumber: `SAAS-${Date.now()}-${pending._id}`, amount, currency: plan.currency || 'PKR', status: 'paid', billingPeriodStart: start.toISOString().slice(0,10), billingPeriodEnd: end.toISOString().slice(0,10), paidAt: now, paymentReference: reference, createdAt: now }, { session });
      });
    } catch (error) { return fail(error.message, 409); } finally { await session.endSession(); }
    return ok({ success: true });
  }
  if (!['active','suspended'].includes(body.status)) return fail('Invalid status');
  await database.collection('clinics').updateOne({ _id: new ObjectId(body.clinicId) }, { $set: { status: body.status, updatedAt: new Date() } });
  return ok({ success: true });
}
