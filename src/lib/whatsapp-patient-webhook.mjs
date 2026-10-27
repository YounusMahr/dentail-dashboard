import { createHmac, timingSafeEqual } from 'node:crypto';
import { pakistanMobile } from './pakistan-phone.mjs';

export function webhookToken(clinicId, instanceName) {
  const key = process.env.EVOLUTION_API_KEY;
  if (!key) throw new Error('Evolution API key is missing');
  return createHmac('sha256', key).update(`patient-ai:${clinicId}:${instanceName}`).digest('hex');
}

export function validWebhookToken(clinicId, instanceName, received) {
  if (typeof received !== 'string' || !/^[a-f0-9]{64}$/.test(received)) return false;
  const expected = Buffer.from(webhookToken(clinicId, instanceName), 'hex');
  return timingSafeEqual(expected, Buffer.from(received, 'hex'));
}

export function incomingPatientText(event, instanceName) {
  if (String(event?.event || '').toLowerCase().replaceAll('_', '.') !== 'messages.upsert' || event?.instance !== instanceName) return null;
  const item = event.data;
  if (!item?.key?.id || item.key.fromMe || item.message?.protocolMessage) return null;
  const jid = item.key.remoteJid?.endsWith('@s.whatsapp.net') ? item.key.remoteJid : item.key.remoteJidAlt;
  if (!/^\d+@s\.whatsapp\.net$/.test(jid || '')) return null;
  let phone;
  try { phone = pakistanMobile(jid.split('@')[0]); } catch { return null; }
  const message = item.message?.ephemeralMessage?.message || item.message?.viewOnceMessage?.message || item.message;
  const text = (message?.conversation || message?.extendedTextMessage?.text || '').trim();
  if (!text || text.length > 1500) return null;
  return { messageId: String(item.key.id).slice(0, 150), phone, text };
}
