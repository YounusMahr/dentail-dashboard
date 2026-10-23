import { saveDoctor } from '@/lib/legacy-workflows';
import { ObjectId } from 'mongodb';
import { currentUser, sameOrigin } from '@/lib/auth';
import { db } from '@/lib/db';
import { fail, id, ok } from '@/lib/http';
import { modules } from '@/lib/modules';
import { cleanRecord } from '@/lib/records';
import { writeBlock } from '@/lib/clinic-access';

async function context(request, params) {
  const { module, recordId } = await params, user = await currentUser();
  if (!sameOrigin(request) || !id(recordId) || !modules[module] || !((modules[module].writeRoles || modules[module].roles).includes(user?.role)||module==='doctors'&&user?.role==='dentist')) return null;
  const collection = (await db()).collection(module === 'staff' ? 'users' : module);
  const filter = { _id: new ObjectId(recordId), clinicId: user.clinicId, ...(module === 'appointments' ? { deletedAt: { $exists: false } } : {}) };
  const existing = await collection.findOne(filter);
  if(module==='doctors'&&user.role==='dentist'&&recordId!==user.doctorId)return null;
  return existing ? { module, user, collection, filter, existing } : null;
}

export async function PATCH(request, { params }) {
  const ctx = await context(request, params);
  if (!ctx) return fail('Not found or unauthorized', 404);
  if (ctx.module === 'staff' && String(ctx.existing._id) === String(ctx.user._id) && (await request.clone().json()).active === false) return fail('Cannot disable your own account');
  if (ctx.module === 'staff' && String(ctx.existing._id) === String(ctx.user._id) && (await request.clone().json()).role !== 'clinic_admin') return fail('Cannot change your own admin role');
  try {
    const input = await request.json();
    if(ctx.module==='doctors'&&ctx.user.role==='dentist')input.active=ctx.existing.active;
    if(ctx.module==='invoices'&&input.action==='void'){
      if(ctx.user.role!=='clinic_admin')return fail('Only administrators can void invoices',403);
      const block=await writeBlock(ctx.user);if(block)return fail(block,403);
      const result=await ctx.collection.updateOne({...ctx.filter,paidAmount:0,status:{$ne:'cancelled'}},{$set:{status:'cancelled',balanceAmount:0,updatedAt:new Date()},$unset:{visitInvoiceKey:''}});
      return result.modifiedCount?ok({success:true}):fail('Only unpaid invoices can be voided',409);
    }
    const changes = await cleanRecord(ctx.module, input, ctx.user, ctx.existing);
    if(ctx.module==='doctors'&&ctx.user.role!=='clinic_admin')return fail('Only administrators can deactivate doctors',403);
  if (ctx.module === 'doctors') { await saveDoctor(changes, input, ctx.user, ctx.existing); return ok({success:true}); }
    if (ctx.module === 'invoices') return fail('Invoice amounts cannot be edited after creation');
    if (ctx.module === 'treatments' && ctx.user.role === 'dentist' && ctx.existing.doctorId !== ctx.user.doctorId) return fail('Unauthorized', 403);
    if (['appointments','treatments'].includes(ctx.module)) {
      const database = await db(), session = database.client.startSession();
      try { await session.withTransaction(async () => {
        await ctx.collection.updateOne(ctx.filter, { $set: { ...changes, updatedAt: new Date() } }, { session });
        if(ctx.module==='appointments')await database.collection('visitSessions').updateOne({clinicId:ctx.user.clinicId,appointmentId:String(ctx.existing._id)},{$set:{...(changes.status?{status:changes.status}:{}),...(changes.appointmentDate?{scheduledDate:changes.appointmentDate}:{}),...(changes.startsAt?{startsAt:changes.startsAt}:{}),...(changes.serviceId!==undefined?{serviceId:changes.serviceId}:{}),...(changes.doctorId?{doctorId:changes.doctorId}:{}),updatedAt:new Date()}},{session});
        if(ctx.module==='appointments'&&changes.status==='cancelled')await database.collection('invoices').updateOne({clinicId:ctx.user.clinicId,visitInvoiceKey:String(ctx.existing._id),paidAmount:0,status:{$ne:'cancelled'}},{$set:{status:'cancelled',balanceAmount:0,updatedAt:new Date()},$unset:{visitInvoiceKey:''}},{session});
        await database.collection('auditLogs').insertOne({ clinicId: ctx.user.clinicId, module: ctx.module, recordId: String(ctx.existing._id), actorId: String(ctx.user._id), changedFields: Object.keys(changes), beforeStatus: ctx.existing.status || null, afterStatus: changes.status || ctx.existing.status || null, createdAt: new Date() }, { session });
      }); } finally { await session.endSession(); }
    } else await ctx.collection.updateOne(ctx.filter, { $set: { ...changes, updatedAt: new Date() } });
    if (ctx.module === 'staff') await (await db()).collection('doctors').updateMany({ clinicId: ctx.user.clinicId, userId: String(ctx.existing._id) }, { $set: { ...(changes.name ? { name: changes.name } : {}), ...(changes.email ? { email: changes.email } : {}), ...(changes.active !== undefined ? { active: changes.active } : {}), updatedAt: new Date() } });
    return ok({ success: true });
  } catch (error) { return fail(error.code === 11000 ? 'Slot already booked' : error.message); }
}

export async function DELETE(request, { params }) {
  const ctx = await context(request, params);
  if (!ctx) return fail('Not found or unauthorized', 404);
  const block = await writeBlock(ctx.user);
  if (block) return fail(block, 403);
  if (ctx.module === 'appointments') {
    if (ctx.user.role === 'dentist') return fail('Only clinic administrators or receptionists can remove appointments', 403);
    const database = await db(), appointmentId = String(ctx.existing._id);
    if (ctx.existing.deletedAt) return ok({ success: true });
    const [treatment, paidInvoice, issuedPrescription] = await Promise.all([
      database.collection('treatments').findOne({ clinicId: ctx.user.clinicId, appointmentId }),
      database.collection('invoices').findOne({ clinicId: ctx.user.clinicId, $or: [{ appointmentId }, { visitInvoiceKey: appointmentId }], paidAmount: { $gt: 0 } }),
      database.collection('prescriptions').findOne({ clinicId: ctx.user.clinicId, appointmentId, status: 'issued' }),
    ]);
    if (treatment || paidInvoice || issuedPrescription || ctx.existing.status === 'completed') return fail('This visit has clinical or paid records. Cancel the appointment instead.', 409);
    const session = database.client.startSession();
    try {
      await session.withTransaction(async () => {
        const at = new Date();
        await ctx.collection.updateOne(ctx.filter, { $set: { status: 'cancelled', deletedAt: at, deletedBy: String(ctx.user._id), updatedAt: at } }, { session });
        await database.collection('visitSessions').updateMany({ clinicId: ctx.user.clinicId, appointmentId }, { $set: { status: 'cancelled', updatedAt: at } }, { session });
        await database.collection('invoices').updateMany({ clinicId: ctx.user.clinicId, $or: [{ appointmentId }, { visitInvoiceKey: appointmentId }], paidAmount: 0 }, { $set: { status: 'cancelled', balanceAmount: 0, updatedAt: at }, $unset: { visitInvoiceKey: '' } }, { session });
        for (const collectionName of ['notificationOutbox', 'emailOutbox']) await database.collection(collectionName).updateMany({ clinicId: ctx.user.clinicId, sourceId: appointmentId, status: 'pending_provider' }, { $set: { status: 'cancelled', cancelReason: 'Appointment removed', updatedAt: at } }, { session });
        await database.collection('auditLogs').insertOne({ clinicId: ctx.user.clinicId, module: 'appointments', recordId: appointmentId, actorId: String(ctx.user._id), action: 'remove', beforeStatus: ctx.existing.status, afterStatus: 'cancelled', createdAt: at }, { session });
      });
    } finally { await session.endSession(); }
    return ok({ success: true });
  }
  if (['invoices', 'treatments'].includes(ctx.module)) return fail('Clinical and financial records cannot be deleted');
  if (ctx.module === 'staff' && String(ctx.existing._id) === String(ctx.user._id)) return fail('Cannot delete your own account');
  const database = await db();
  if (ctx.module === 'patients') for (const collection of ['appointments','treatments','invoices','payments','follow-ups','patientDocuments','treatmentPlans','careSessions','prescriptions','labCases','waitingList','portalAccess']) if (await database.collection(collection).findOne({ clinicId: ctx.user.clinicId, patientId: String(ctx.existing._id) })) return fail('Patient has linked records and cannot be deleted');
  if(ctx.module==='doctors'&&ctx.user.role!=='clinic_admin')return fail('Only administrators can deactivate doctors',403);
  if (ctx.module === 'doctors') { await saveDoctor({active:false}, {}, ctx.user, ctx.existing); return ok({success:true}); }
  if (ctx.module === 'doctors') for (const collection of ['appointments','treatments','treatmentPlans','prescriptions','careSessions','waitingList']) if (await database.collection(collection).findOne({ clinicId: ctx.user.clinicId, doctorId: String(ctx.existing._id) })) return fail('Doctor has linked records and cannot be deleted');
  if(ctx.module==='services'&&await database.collection('invoices').findOne({clinicId:ctx.user.clinicId,'items.serviceId':String(ctx.existing._id)}))return fail('Service is used by invoices; deactivate it instead');
  if (ctx.module === 'services') for (const collection of ['appointments','treatments']) if (await database.collection(collection).findOne({ clinicId: ctx.user.clinicId, serviceId: String(ctx.existing._id) })) return fail('Service is in use and cannot be deleted');
  if (ctx.module === 'staff') {
    await ctx.collection.updateOne(ctx.filter, { $set: { active: false, updatedAt: new Date() } });
    await database.collection('doctors').updateMany({ clinicId: ctx.user.clinicId, userId: String(ctx.existing._id) }, { $set: { active: false, updatedAt: new Date() } });
    return ok({ success: true });
  }
  await ctx.collection.deleteOne(ctx.filter);
  return ok({ success: true });
}
