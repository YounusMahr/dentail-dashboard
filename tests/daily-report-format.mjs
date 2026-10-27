import assert from 'node:assert/strict';
import { formatDailyReport } from '../src/lib/daily-report-format.mjs';

const text = formatDailyReport({ name: 'Test Dental', day: '2026-10-27', totalPatients: 32, newPatients: 2, appointments: 5, bookedToday: 3, billed: 7000, received: 4500, outstanding: 2500 });
assert.match(text, /\*Total patients:\* 32/);
assert.match(text, /\*Payments received today:\* Rs 4,500/);
assert.match(text, /\*Fees billed today:\* Rs 7,000/);
assert.match(text, /not profit/);
console.log('PASS: admin daily report separates billed fees from received payments');
