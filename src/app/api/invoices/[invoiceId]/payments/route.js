import { ObjectId } from 'mongodb';
import { currentUser, sameOrigin } from '@/lib/auth';
import { db } from '@/lib/db';
import { fail, id, ok } from '@/lib/http';
import { writeBlock } from '@/lib/clinic-access';

export async function GET(request, { params }) {
  const user = await currentUser(), invoiceId = (await params).invoiceId;
  if (!user?.clinicId || !id(invoiceId)) return fail('Unauthorized', 401);
  const database = await db();
  const invoice = await database.collection('invoices').findOne({ _id: new ObjectId(invoiceId), clinicId: user.clinicId });
  if (!invoice) return fail('Invoice not found', 404);
  return ok({ invoice, payments: await database.collection('payments').find({ clinicId: user.clinicId, invoiceId }).sort({ createdAt: -1 }).toArray() });
}

export async function POST(request, { params }) {
  const user = await currentUser(), invoiceId = (await params).invoiceId;
  if (!sameOrigin(request) || !['clinic_admin', 'receptionist'].includes(user?.role) || !id(invoiceId)) return fail('Unauthorized', 403);
  const block = await writeBlock(user); if (block) return fail(block, 403);
  const body = await request.json().catch(() => ({})), amount = Number(body.amount), method = String(body.paymentMethod || 'cash');
  if (!(amount > 0) || !['cash', 'card', 'bank_transfer', 'easypaisa_jazzcash'].includes(method)) return fail('Invalid payment');
  const database = await db(), filter = { _id: new ObjectId(invoiceId), clinicId: user.clinicId, status: { $ne: 'cancelled' }, balanceAmount: { $gte: amount } };
  const session = database.client.startSession();
  let invoice;
  try {
    await session.withTransaction(async () => {
      invoice = await database.collection('invoices').findOneAndUpdate(filter, [
        { $set: { paidAmount: { $add: ['$paidAmount', amount] }, balanceAmount: { $subtract: ['$balanceAmount', amount] } } },
        { $set: { status: { $cond: [{ $lte: ['$balanceAmount', 0] }, 'paid', 'partially_paid'] }, updatedAt: new Date() } }
      ], { returnDocument: 'after', session });
      if (!invoice) throw new Error('Invoice missing or payment exceeds balance');
      await database.collection('payments').insertOne({ clinicId: user.clinicId, invoiceId, patientId: invoice.patientId, receivedByUserId: String(user._id), amount, paymentMethod: method, transactionReference: String(body.transactionReference || '').slice(0, 100), createdAt: new Date() }, { session });
      await database.collection('auditLogs').insertOne({ clinicId: user.clinicId, module: 'payments', recordId: invoiceId, actorId: String(user._id), amount, createdAt: new Date() }, { session });
    });
  } catch (error) { return fail(error.message, 409); } finally { await session.endSession(); }
  return ok({ invoice });
}
