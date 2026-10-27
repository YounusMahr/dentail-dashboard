import assert from 'node:assert/strict';
import { incomingPatientText, validWebhookToken, webhookToken } from '../src/lib/whatsapp-patient-webhook.mjs';

process.env.EVOLUTION_API_KEY = 'test-key-for-webhook-signature';
const token = webhookToken('clinic-a', 'clinic-main');
assert.equal(validWebhookToken('clinic-a', 'clinic-main', token), true);
assert.equal(validWebhookToken('clinic-b', 'clinic-main', token), false);
assert.equal(validWebhookToken('clinic-a', 'other-instance', token), false);
assert.equal(validWebhookToken('clinic-a', 'clinic-main', 'bad'), false);

const event = { event: 'messages.upsert', instance: 'clinic-main', data: { key: { id: 'message-1', fromMe: false, remoteJid: '923001234567@s.whatsapp.net' }, message: { conversation: 'Please book an appointment' } } };
assert.deepEqual(incomingPatientText(event, 'clinic-main'), { messageId: 'message-1', phone: '03001234567', text: 'Please book an appointment' });
assert.equal(incomingPatientText({ ...event, instance: 'other-instance' }, 'clinic-main'), null);
assert.equal(incomingPatientText({ ...event, data: { ...event.data, key: { ...event.data.key, fromMe: true } } }, 'clinic-main'), null);
assert.equal(incomingPatientText({ ...event, data: { ...event.data, key: { ...event.data.key, remoteJid: '12345@g.us' } } }, 'clinic-main'), null);
assert.equal(incomingPatientText({ ...event, data: { ...event.data, message: { imageMessage: { caption: 'Please book' } } } }, 'clinic-main'), null);
console.log('PASS: signed tenant webhook, inbound patient text and ignored outbound/group/media events');
