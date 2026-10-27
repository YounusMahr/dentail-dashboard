import { after } from 'next/server';
import { ObjectId } from 'mongodb';
import { db, ensureIndexes } from '@/lib/db';
import { incomingPatientText, validWebhookToken } from '@/lib/whatsapp-patient-webhook.mjs';
import { processPatientInbox } from '@/lib/whatsapp-patient-assistant';

export const runtime = 'nodejs';
export const maxDuration = 60;
const reply = (status = 200) => Response.json({ received: true }, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(request, { params }) {
  const { clinicId, token } = await params;
  if (!ObjectId.isValid(clinicId) || !process.env.EVOLUTION_API_KEY) return reply(404);
  const database = await db();
  const settings = await database.collection('messagingSettings').findOne({ clinicId }, { projection: { instanceName: 1, patientAiEnabled: 1 } });
  if (!settings?.instanceName || !validWebhookToken(clinicId, settings.instanceName, token)) return reply(404);
  if (!settings.patientAiEnabled) return reply();
  const raw = await request.text();
  if (raw.length > 12000) return reply(413);
  let event;
  try { event = JSON.parse(raw); } catch { return reply(400); }
  const incoming = incomingPatientText(event, settings.instanceName);
  if (!incoming) return reply();
  await ensureIndexes();
  try {
    await database.collection('whatsappAiInbox').insertOne({ clinicId, instanceName: settings.instanceName, ...incoming, status: 'pending', createdAt: new Date() });
  } catch (error) {
    if (error.code === 11000) return reply();
    throw error;
  }
  after(() => processPatientInbox(clinicId, incoming.phone, settings.instanceName));
  return reply();
}
