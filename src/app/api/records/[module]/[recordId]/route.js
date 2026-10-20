import { ObjectId } from 'mongodb';
import { currentUser, sameOrigin } from '@/lib/auth';
import { db } from '@/lib/db';
import { fail, id, ok } from '@/lib/http';
import { modules } from '@/lib/modules';
import { cleanRecord } from '@/lib/records';
import { writeBlock } from '@/lib/clinic-access';

async function context(request, params) {
  const { module, recordId } = await params, user = await currentUser();
  if (!sameOrigin(request) || !id(recordId) || !modules[module] || !(modules[module].writeRoles || modules[module].roles).includes(user?.role)) return null;
  const collection = (await db()).collection(module === 'staff' ? 'users' : module);
  const filter = { _id: new ObjectId(recordId), clinicId: user.clinicId };
  const existing = await collection.findOne(filter);
  return existing ? { module, user, collection, filter, existing } : null;
}

export async function PATCH(request, { params }) {
  const ctx = await context(request, params);
  if (!ctx) return fail('Not found or unauthorized', 404);
  if (ctx.module === 'staff' && String(ctx.existing._id) === String(ctx.user._id) && (await request.clone().json()).active === false) return fail('Cannot disable your own account');
  if (ctx.module === 'staff' && String(ctx.existing._id) === String(ctx.user._id) && (await request.clone().json()).role !== 'clinic_admin') return fail('Cannot change your own admin role');
  try {
    const changes = await cleanRecord(ctx.module, await request.json(), ctx.user, ctx.existing);
    if (ctx.module === 'invoices') return fail('Invoice amounts cannot be edited after creation');
    if (ctx.module === 'treatments' && ctx.user.role === 'dentist' && ctx.existing.doctorId !== ctx.user.doctorId) return fail('Unauthorized', 403);
    if (['appointments','treatments'].includes(ctx.module)) {
      const database = await db(), session = database.client.startSession();
      try { await session.withTransaction(async () => {
        await ctx.collection.updateOne(ctx.filter, { $set: { ...changes, updatedAt: new Date() } }, { session });
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
  if (['invoices', 'treatments', 'appointments'].includes(ctx.module)) return fail('Clinical and financial records cannot be deleted');
  if (ctx.module === 'staff' && String(ctx.existing._id) === String(ctx.user._id)) return fail('Cannot delete your own account');
  const database = await db();
  if (ctx.module === 'patients') for (const collection of ['appointments','treatments','invoices','payments','follow-ups','patientDocuments']) if (await database.collection(collection).findOne({ clinicId: ctx.user.clinicId, patientId: String(ctx.existing._id) })) return fail('Patient has linked records and cannot be deleted');
  if (ctx.module === 'doctors') for (const collection of ['appointments','treatments']) if (await database.collection(collection).findOne({ clinicId: ctx.user.clinicId, doctorId: String(ctx.existing._id) })) return fail('Doctor has linked records and cannot be deleted');
  if (ctx.module === 'services') for (const collection of ['appointments','treatments']) if (await database.collection(collection).findOne({ clinicId: ctx.user.clinicId, serviceId: String(ctx.existing._id) })) return fail('Service is in use and cannot be deleted');
  if (ctx.module === 'staff') {
    await ctx.collection.updateOne(ctx.filter, { $set: { active: false, updatedAt: new Date() } });
    await database.collection('doctors').updateMany({ clinicId: ctx.user.clinicId, userId: String(ctx.existing._id) }, { $set: { active: false, updatedAt: new Date() } });
    return ok({ success: true });
  }
  await ctx.collection.deleteOne(ctx.filter);
  return ok({ success: true });
}
