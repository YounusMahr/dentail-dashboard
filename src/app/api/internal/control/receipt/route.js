import { ObjectId } from 'mongodb';
import { verifyControlRequest } from '@/lib/control-plane.mjs';
import { fail } from '@/lib/http';

export const runtime = 'nodejs';

export async function GET(request) {
  let database;
  try { database = await verifyControlRequest(request); }
  catch { return fail('Unauthorized', 401); }
  const requestId = new URL(request.url).searchParams.get('requestId');
  if (!ObjectId.isValid(requestId)) return fail('Invalid receipt');
  const clinic = await database.collection('clinics').findOne({ slug: process.env.MANAGED_CLINIC_SLUG });
  if (!clinic) return fail('Clinic not found', 404);
  const payment = await database.collection('subscriptionPayments').findOne({ _id: new ObjectId(requestId), clinicId: String(clinic._id) }, { projection: { receiptImage: 1, receiptMimeType: 1 } });
  if (!payment?.receiptImage) return fail('Receipt not found', 404);
  return new Response(payment.receiptImage.buffer, { headers: { 'Content-Type': payment.receiptMimeType || 'image/jpeg', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
}
