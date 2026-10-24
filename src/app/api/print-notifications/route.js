import { ObjectId } from 'mongodb';
import { currentUser, sameOrigin } from '@/lib/auth';
import { careIndexes } from '@/lib/care';
import { db, ensureIndexes } from '@/lib/db';
import { fail, ok } from '@/lib/http';
import { enqueue, dispatchSingleNotification } from '@/lib/messaging';
import { queueEmail, dispatchEmailOutbox } from '@/lib/email-notifications';

export const maxDuration = 30;

export async function POST(request) {
  const user = await currentUser();
  if (!user?.clinicId || !sameOrigin(request)) return fail('Unauthorized', 403);
  const body = await request.json().catch(() => ({}));
  const { kind, recordId } = body;
  if (!['receipt', 'prescription'].includes(kind) || !ObjectId.isValid(recordId || '')) return fail('Invalid print request', 400);
  if (kind === 'prescription' && !['clinic_admin', 'dentist'].includes(user.role)) return fail('Unauthorized', 403);
  if (kind === 'receipt' && !['clinic_admin', 'receptionist', 'dentist'].includes(user.role)) return fail('Unauthorized', 403);

  const database = await db();
  const record = await database.collection(kind === 'receipt' ? 'payments' : 'prescriptions').findOne({ _id: new ObjectId(recordId), clinicId: user.clinicId });
  if (!record) return fail('Document not found', 404);
  if (kind === 'prescription' && (record.status !== 'issued' || user.role === 'dentist' && record.doctorId !== user.doctorId)) return fail('Issue the prescription before sending it', 409);
  const invoice = kind === 'receipt' ? await database.collection('invoices').findOne({ _id: new ObjectId(record.invoiceId), clinicId: user.clinicId }) : null;
  if (kind === 'receipt' && !invoice) return fail('Invoice not found', 404);

  await Promise.all([careIndexes(database), ensureIndexes()]);
  const eventKey = kind === 'receipt' ? `print-receipt:${recordId}` : `print-prescription:${recordId}:r${record.revision || 1}`;
  const type = kind === 'receipt' ? 'payment_receipt' : 'prescription_ready';
  const values = kind === 'receipt'
    ? [`Receipt ${invoice.invoiceNumber || recordId}`, `Rs ${Number(record.amount).toLocaleString('en-PK')}`, `Balance Rs ${Number(invoice.balanceAmount || 0).toLocaleString('en-PK')}`]
    : [`Prescription ${recordId.slice(-6).toUpperCase()}`, `Revision ${record.revision || 1}`];
  const details = kind === 'receipt'
    ? [`Receipt: ${invoice.invoiceNumber || recordId}`, `Amount received: Rs ${Number(record.amount).toLocaleString('en-PK')}`, `Remaining balance: Rs ${Number(invoice.balanceAmount || 0).toLocaleString('en-PK')}`]
    : ['Your dentist has prepared your prescription. The PDF copy is attached.'];

  await Promise.all([
    enqueue({ clinicId: user.clinicId, patientId: record.patientId, type, eventKey, values, sourceId: recordId }),
    queueEmail({ clinicId: user.clinicId, patientId: record.patientId, type: kind === 'prescription' ? 'prescription_issued' : type, eventKey, details, sourceId: recordId })
  ]);
  const [whatsDoc, emailDoc] = await Promise.all(['notificationOutbox', 'emailOutbox'].map(collection => database.collection(collection).findOne({ clinicId: user.clinicId, eventKey })));
  for (const [collection, doc] of [['notificationOutbox', whatsDoc], ['emailOutbox', emailDoc]]) {
    if (doc?.status === 'failed') await database.collection(collection).updateOne({ _id: doc._id, status: 'failed' }, { $set: { status: 'pending_provider', updatedAt: new Date() }, $unset: { error: '' } });
  }
  const delivery = await Promise.allSettled([
    whatsDoc && whatsDoc.status !== 'sent' ? dispatchSingleNotification(whatsDoc._id, user.clinicId) : Promise.resolve(),
    emailDoc && emailDoc.status !== 'sent' ? dispatchEmailOutbox(user.clinicId, emailDoc._id) : Promise.resolve()
  ]);
  const [whatsappResult, emailResult] = await Promise.all(['notificationOutbox', 'emailOutbox'].map(collection => database.collection(collection).findOne({ clinicId: user.clinicId, eventKey }, { projection: { status: 1, error: 1 } })));
  const summarize = (doc, outcome) => doc ? { status: doc.status, ...(doc.error ? { error: doc.error } : {}), ...(outcome.status === 'rejected' && !doc.error ? { error: outcome.reason?.message || 'Delivery failed' } : {}) } : { status: 'off' };
  return ok({ whatsapp: summarize(whatsappResult, delivery[0]), email: summarize(emailResult, delivery[1]) });
}
