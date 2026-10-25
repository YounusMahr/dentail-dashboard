import { ObjectId } from 'mongodb';
import { currentUser, sameOrigin } from '@/lib/auth';
import { db, ensureIndexes } from '@/lib/db';
import { fail, ok } from '@/lib/http';
import { writeBlock } from '@/lib/clinic-access';
import { cleanSmtpSettings, encryptSmtpPassword, smtpSender, smtpTransport } from '@/lib/clinic-smtp';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function GET() {
  const user = await currentUser();
  if (user?.role !== 'clinic_admin' || !user.clinicId) return fail('Unauthorized', 403);
  const database = await db();
  const settings = await database.collection('clinicSmtpSettings').findOne({ clinicId: user.clinicId }, { projection: { passwordEncrypted: 0 } });
  if (settings) return ok({ settings: { host: settings.host, port: settings.port, username: settings.username, fromEmail: settings.fromEmail, fromName: settings.fromName, enabled: settings.enabled, passwordSaved: true } });
  const legacy = await database.collection('clinics').findOne({ _id: new ObjectId(user.clinicId) }, { projection: { name: 1, smtpHost: 1, smtpPort: 1, smtpUser: 1 } });
  return ok({ settings: legacy?.smtpHost ? { host: legacy.smtpHost, port: Number(legacy.smtpPort) || 587, username: legacy.smtpUser || '', fromEmail: legacy.smtpUser || '', fromName: legacy.name || '', passwordSaved: false } : null });
}

export async function PATCH(request) {
  const user = await currentUser();
  if (user?.role !== 'clinic_admin' || !user.clinicId || !sameOrigin(request)) return fail('Unauthorized', 403);
  const block = await writeBlock(user); if (block) return fail(block, 403);
  try {
    const body = await request.json(), data = cleanSmtpSettings(body), database = await db();
    await ensureIndexes();
    const existing = await database.collection('clinicSmtpSettings').findOne({ clinicId: user.clinicId });
    if (!data.password && !existing?.passwordEncrypted) return fail('Enter the SMTP app password');
    const passwordEncrypted = data.password ? encryptSmtpPassword(data.password) : existing.passwordEncrypted;
    await database.collection('clinicSmtpSettings').updateOne({ clinicId: user.clinicId }, { $set: { clinicId: user.clinicId, host: data.host, port: data.port, username: data.username, fromEmail: data.fromEmail, fromName: data.fromName, passwordEncrypted, enabled: true, updatedAt: new Date() } }, { upsert: true });
    await database.collection('clinics').updateOne({ _id: new ObjectId(user.clinicId) }, { $unset: { smtpHost: '', smtpPort: '', smtpUser: '', smtpPass: '', smtpFrom: '', smtpSecure: '' } });
    return ok({ success: true });
  } catch (error) { return fail(error.message || 'Could not save SMTP settings'); }
}

export async function POST(request) {
  const user = await currentUser();
  if (user?.role !== 'clinic_admin' || !user.clinicId || !sameOrigin(request)) return fail('Unauthorized', 403);
  const block = await writeBlock(user); if (block) return fail(block, 403);
  const settings = await (await db()).collection('clinicSmtpSettings').findOne({ clinicId: user.clinicId, enabled: true });
  if (!settings) return fail('Save SMTP settings first');
  let transport;
  try {
    transport = smtpTransport(settings);
    await transport.verify();
    await transport.sendMail({ from: smtpSender(settings), to: user.email, subject: 'Clinic email test', text: 'Your clinic SMTP email connection is working.' });
    return ok({ success: true, recipient: user.email });
  } catch (error) { return fail(`SMTP test failed: ${error.message}`, 502); }
  finally { transport?.close(); }
}
