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
  const counts=await Promise.all(clinics.map(async c=>{const q={clinicId:String(c._id)},[patients,appointments,staff,treatments,invoices,payments]=await Promise.all(['patients','appointments','users','treatments','invoices','payments'].map(n=>database.collection(n).find(q,{projection:n==='invoices'?{totalAmount:1,balanceAmount:1,status:1}:n==='payments'?{amount:1}:{_id:1}}).toArray()));return {id:String(c._id),patients:patients.length,appointments:appointments.length,staff:staff.length,treatments:treatments.length,billed:invoices.filter(i=>i.status!=='cancelled').reduce((n,i)=>n+Number(i.totalAmount||0),0),outstanding:invoices.filter(i=>i.status!=='cancelled').reduce((n,i)=>n+Number(i.balanceAmount||0),0),collected:payments.reduce((n,p)=>n+Number(p.amount||0),0)}}));
  const platformInvoices=await database.collection('platformInvoices').find({}).sort({createdAt:-1}).limit(100).toArray();
  const mrr=subscriptions.filter(s=>s.status==='active').reduce((n,s)=>{const plan=plans.find(p=>p.slug===s.plan);return n+(s.billingInterval==='yearly'?Number(plan?.priceAnnual||0)/12:Number(plan?.priceMonthly||0))},0);
  return ok({ clinics:clinics.map(({logoData,faviconData,...c})=>c), subscriptions, requests, plans, counts, platformInvoices, metrics:{mrr,arr:mrr*12,active:subscriptions.filter(s=>s.status==='active').length,trial:subscriptions.filter(s=>s.status==='trialing').length,saasRevenue:platformInvoices.filter(i=>i.status==='paid').reduce((n,i)=>n+Number(i.amount||0),0)} });
}

export async function PATCH(request) {
  const user = await currentUser();
  if (!sameOrigin(request) || user?.role !== 'platform_owner') return fail('Unauthorized', 403);
  const body = await request.json().catch(() => ({}));
  if (!id(body.clinicId)) return fail('Invalid clinic');
  const database = await db();
  if(['updateSubscription','recordPayment'].includes(body.action)){
    const clinic=await database.collection('clinics').findOne({_id:new ObjectId(body.clinicId)});if(!clinic)return fail('Clinic not found',404);
    const current=await database.collection('subscriptions').findOne({clinicId:body.clinicId},{sort:{createdAt:-1}});
    const plan=await database.collection('subscriptionPlans').findOne({slug:body.plan||current?.plan,active:true});if(!plan)return fail('Select an active plan');
    if(body.action==='updateSubscription'&&(!['active','trialing','past_due','suspended'].includes(body.status)||!['monthly','yearly'].includes(body.interval)))return fail('Invalid subscription settings');
    const days=Number(body.extendDays||0),months=Number(body.extendMonths),amount=Number(body.amount);
    if(body.action==='updateSubscription'&&(!Number.isInteger(days)||days<0||days>365))return fail('Extension must be 0–365 days');
    if(body.action==='recordPayment'&&(!Number.isInteger(months)||months<1||months>24||!Number.isFinite(amount)||amount<1||!String(body.paymentReference||'').trim()))return fail('Enter amount, verified payment reference and 1–24 months');
    const session=database.client.startSession();try{await session.withTransaction(async()=>{
      const sub=await database.collection('subscriptions').findOne({clinicId:body.clinicId},{session,sort:{createdAt:-1}}),now=new Date(),end=new Date(sub?.periodEndsAt&&new Date(sub.periodEndsAt)>now?sub.periodEndsAt:now);
      if(body.action==='recordPayment'){const day=end.getUTCDate();end.setUTCDate(1);end.setUTCMonth(end.getUTCMonth()+months);end.setUTCDate(Math.min(day,new Date(Date.UTC(end.getUTCFullYear(),end.getUTCMonth()+1,0)).getUTCDate()))}else if(days)end.setUTCDate(end.getUTCDate()+days);else if(!sub)end.setUTCDate(end.getUTCDate()+30);
      const status=body.action==='recordPayment'?'active':body.status,subscriptionId=sub?._id||new ObjectId(),changes={plan:plan.slug,status,billingInterval:body.interval||sub?.billingInterval||'monthly',periodEndsAt:end,trialEndsAt:status==='trialing'?end:null,updatedAt:now};
      await database.collection('subscriptions').updateOne({_id:subscriptionId},{$set:changes,$setOnInsert:{clinicId:body.clinicId,createdAt:now}},{upsert:true,session});
      if(body.action==='recordPayment')await database.collection('platformInvoices').insertOne({clinicId:body.clinicId,subscriptionId:String(subscriptionId),invoiceNumber:`SAAS-${new ObjectId()}`,amount:Math.round(amount*100)/100,currency:plan.currency||'PKR',status:'paid',paidAt:now,paymentReference:String(body.paymentReference).slice(0,100),billingPeriodStart:now.toISOString().slice(0,10),billingPeriodEnd:end.toISOString().slice(0,10),createdAt:now},{session});
      await database.collection('auditLogs').insertOne({clinicId:body.clinicId,actorId:String(user._id),action:body.action,module:'subscriptions',createdAt:now},{session});
    })}catch(e){return fail(e.message,409)}finally{await session.endSession()}return ok({success:true});
  }
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
  if (!['active','inactive','suspended'].includes(body.status)) return fail('Invalid status');
  await database.collection('clinics').updateOne({ _id: new ObjectId(body.clinicId) }, { $set: { status: body.status, updatedAt: new Date() } });
  return ok({ success: true });
}
