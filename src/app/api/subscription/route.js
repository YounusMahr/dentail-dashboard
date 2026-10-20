import { currentUser, sameOrigin } from '@/lib/auth';
import { db } from '@/lib/db';
import { fail, ok } from '@/lib/http';

export async function GET() {
  const user = await currentUser();
  if (user?.role !== 'clinic_admin') return fail('Unauthorized', 403);
  const database = await db();
  const [subscription, request, plans, invoices] = await Promise.all([
    database.collection('subscriptions').findOne({ clinicId: user.clinicId }, { sort: { createdAt: -1 } }),
    database.collection('planRequests').findOne({ clinicId: user.clinicId, status: 'pending' }, { sort: { createdAt: -1 } }),
    database.collection('subscriptionPlans').find({ active: true }).sort({ priceMonthly: 1 }).toArray(),
    database.collection('platformInvoices').find({ clinicId: user.clinicId }).sort({ createdAt: -1 }).limit(20).toArray()
  ]);
  return ok({ subscription, request, plans, invoices });
}

export async function PATCH(request) {
  const user = await currentUser();
  if (!sameOrigin(request) || user?.role !== 'clinic_admin') return fail('Unauthorized', 403);
  const body = await request.json().catch(() => ({}));
  const interval = body.interval === 'yearly' ? 'yearly' : 'monthly';
  const database = await db();
  const plan = await database.collection('subscriptionPlans').findOne({ slug: body.plan, active: true });
  if (!plan) return fail('Invalid plan');
  const subscription = await database.collection('subscriptions').findOne({ clinicId: user.clinicId }, { sort: { createdAt: -1 } });
  if (!subscription) return fail('Subscription missing', 404);
  await database.collection('planRequests').updateOne(
    { clinicId: user.clinicId, status: 'pending' },
    { $set: { plan: plan.slug, interval, action: subscription.plan === plan.slug ? 'renewal' : 'change', updatedAt: new Date() }, $setOnInsert: { clinicId: user.clinicId, status: 'pending', createdAt: new Date() } },
    { upsert: true }
  );
  return ok({ success: true });
}
