import { ObjectId } from 'mongodb';
import { currentUser, sameOrigin } from '@/lib/auth';
import { db } from '@/lib/db';
import { writeBlock } from '@/lib/clinic-access';
import { executeClinicAction } from '@/lib/ai-actions';

export const runtime = 'nodejs';
const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(request) {
  if (!sameOrigin(request)) return json({ error: 'Invalid request origin' }, 403);
  const user = await currentUser();
  if (!['clinic_admin', 'receptionist', 'dentist'].includes(user?.role) || !user.clinicId) return json({ error: 'Clinic staff access required' }, 403);
  const block = await writeBlock(user); if (block) return json({ error: block }, 403);
  const body = await request.json().catch(() => ({}));
  if (!/^[a-f\d]{24}$/i.test(body.id || '')) return json({ error: 'Invalid action' }, 400);
  const database = await db(), key = { _id: new ObjectId(body.id), clinicId: user.clinicId, userId: String(user._id) };
  const action = await database.collection('aiActions').findOneAndUpdate({ ...key, status: 'pending', expiresAt: { $gt: new Date() } }, { $set: { status: 'processing', startedAt: new Date() } }, { returnDocument: 'after' });
  if (!action) return json({ error: 'Action is already processed or expired. Ask AI to prepare it again.' }, 409);
  try {
    const result = await executeClinicAction(database, user, action);
    await database.collection('aiActions').updateOne(key, { $set: { status: 'completed', result, completedAt: new Date() } });
    await database.collection('aiChats').updateOne({ _id: new ObjectId(action.chatId), clinicId: user.clinicId, userId: String(user._id), 'messages.action.id': body.id }, { $set: { 'messages.$.action.status': 'completed', 'messages.$.action.href': result.href, 'messages.$.action.label': result.label } });
    return json({ success: true, action: { id: body.id, status: 'completed', summary: action.summary, ...result } });
  } catch (error) {
    await database.collection('aiActions').updateOne(key, { $set: { status: 'failed', error: error.message, completedAt: new Date() } });
    await database.collection('aiChats').updateOne({ _id: new ObjectId(action.chatId), clinicId: user.clinicId, userId: String(user._id), 'messages.action.id': body.id }, { $set: { 'messages.$.action.status': 'failed' } });
    return json({ error: error.code === 11000 ? 'This record already exists or the slot was booked. Ask AI to prepare a new action.' : error.message }, 409);
  }
}
