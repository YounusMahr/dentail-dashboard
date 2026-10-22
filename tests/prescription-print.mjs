import assert from 'node:assert/strict';
import { prescriptionHtml } from '../src/lib/prescription-print.js';

const clinic = { _id: '507f1f77bcf86cd799439011', name: 'AL shifa', address: 'Ada Khanpur', phone: '03055212536', logoVersion: 3 };
const patient = { name: 'Murtaza' };
const doctor = { name: 'MURTAZA ALI', specialization: 'Dental Surgeon / Clinic Director' };
const record = { _id: '507f1f77bcf86cd799439012', status: 'issued', language: 'bilingual', createdAt: '2026-10-21T10:00:00.000Z', diagnosis: 'teeth damage', medications: [{ name: 'Augmentin', strength: '20mg', dose: '1', frequency: '3 times', duration: '5 days', instructions: 'کھانے کے بعد' }], instructionsEn: 'Avoid cold water', instructionsUr: 'ٹھنڈے پانی سے پرہیز کریں', reviewDate: '2026-10-22', revision: 1 };

const html = prescriptionHtml(record, patient, doctor, clinic);
for (const expected of ['size:A4', 'clinic-logo', '/api/clinic-brand/507f1f77bcf86cd799439011/logo?v=3', 'AL shifa', 'MURTAZA ALI', 'Murtaza', 'Augmentin', 'کھانے کے بعد', 'ٹھنڈے پانی سے پرہیز کریں', '22/10/2026', 'Doctor’s signature / stamp']) assert.ok(html.includes(expected), `Missing ${expected}`);
assert.ok(!html.includes('DRAFT — NOT ISSUED'));
assert.ok(prescriptionHtml(record, patient, doctor, { ...clinic, logoVersion: null }).includes('/dentalcare-icon.svg'));
assert.ok(prescriptionHtml({ ...record, status: 'draft', language: 'english', diagnosis: '<script>alert(1)</script>' }, patient, doctor, clinic).includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
assert.ok(!prescriptionHtml({ ...record, language: 'english' }, patient, doctor, clinic).includes('ٹھنڈے پانی سے پرہیز کریں'));
console.log('PASS: A4 prescription, clinic logo, bilingual details, draft safety and escaping');
