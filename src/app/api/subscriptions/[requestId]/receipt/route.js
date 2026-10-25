import { ObjectId } from 'mongodb';
import { currentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { fail } from '@/lib/http';

export async function GET(_request, { params }) {
  const user = await currentUser();
  const { requestId } = await params;
  if (!user || !ObjectId.isValid(requestId)) return fail('Unauthorized', 403);
  const query = { _id: new ObjectId(requestId) };
  if (user.role === 'clinic_admin') query.clinicId = user.clinicId;
  else if (user.role !== 'platform_owner') return fail('Unauthorized', 403);
  const record = await (await db()).collection('subscriptionPayments').findOne(query, { projection: { receiptImage: 1, receiptMimeType: 1 } });
  if (!record?.receiptImage) return fail('Receipt not found', 404);
  return new Response(record.receiptImage.buffer, {
    headers: {
      'Content-Type': record.receiptMimeType || 'image/jpeg',
      'Content-Disposition': 'inline; filename="payment-receipt.jpg"',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
