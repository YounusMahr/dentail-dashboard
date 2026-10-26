import { ObjectId } from 'mongodb';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(request) {
  const challengeId = new URL(request.url).searchParams.get('id');
  if (!ObjectId.isValid(challengeId)) return Response.json({ error: 'Invalid challenge' }, { status: 400 });
  const challenge = await (await db()).collection('controlChallenges').findOne({ _id: new ObjectId(challengeId), expiresAt: { $gt: new Date() } });
  if (!challenge || challenge.expectedHost !== new URL(request.url).host) return Response.json({ error: 'Challenge not found' }, { status: 404 });
  return Response.json({ proof: challenge.proof }, { headers: { 'Cache-Control': 'no-store' } });
}
