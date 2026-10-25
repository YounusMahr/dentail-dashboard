import sharp from 'sharp';
import { currentUser, sameOrigin } from '@/lib/auth';
import { db } from '@/lib/db';
import { fail, ok } from '@/lib/http';
import { subscriptionPlan } from '@/lib/subscription-plans';

export const runtime = 'nodejs';

async function clinicAdmin() {
  const user = await currentUser();
  return user?.role === 'clinic_admin' && user.clinicId ? user : null;
}

export async function GET() {
  const user = await clinicAdmin();
  if (!user) return fail('Unauthorized', 403);
  const database = await db();
  const requests = await database.collection('subscriptionPayments')
    .find({ clinicId: user.clinicId }, { projection: { receiptImage: 0 } })
    .sort({ createdAt: -1 }).limit(10).toArray();
  return ok({ requests });
}

export async function POST(request) {
  if (!sameOrigin(request)) return fail('Invalid request origin', 403);
  const user = await clinicAdmin();
  if (!user) return fail('Unauthorized', 403);
  if (Number(request.headers.get('content-length')) > 4 * 1024 * 1024) return fail('Receipt image must be under 3 MB', 413);

  try {
    const form = await request.formData();
    const plan = subscriptionPlan(String(form.get('planId') || ''));
    const file = form.get('receipt');
    if (!plan) return fail('Choose a valid plan');
    if (!file || typeof file.arrayBuffer !== 'function' || file.size < 1 || file.size > 3 * 1024 * 1024) {
      return fail('Upload a receipt image under 3 MB');
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    const image = sharp(bytes, { limitInputPixels: 16000000, animated: false });
    const metadata = await image.metadata();
    if (!['jpeg', 'png', 'webp'].includes(metadata.format) || (metadata.pages || 1) > 1) {
      return fail('Use a static JPEG, PNG or WebP receipt image');
    }
    const receiptImage = await image.rotate().resize({ width: 1600, height: 2400, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 84, mozjpeg: true }).toBuffer();
    const database = await db();
    const collection = database.collection('subscriptionPayments');
    const pending = await collection.findOne({ clinicId: user.clinicId, status: 'pending_review' }, { projection: { _id: 1 } });
    if (pending) return fail('A payment is already waiting for review. Please wait for the super admin.', 409);
    const result = await collection.insertOne({
      clinicId: user.clinicId,
      submittedBy: String(user._id),
      planId: plan.id,
      months: plan.months,
      amount: plan.price,
      currency: 'PKR',
      paymentMethod: 'jazzcash',
      transactionReference: String(form.get('transactionReference') || '').trim().slice(0, 100),
      receiptImage,
      receiptMimeType: 'image/jpeg',
      status: 'pending_review',
      createdAt: new Date(),
    });
    return ok({ id: String(result.insertedId), status: 'pending_review' }, 201);
  } catch (error) {
    console.error('Subscription receipt submission failed:', error);
    return fail('Could not upload this receipt. Choose a valid image and try again.', 400);
  }
}
