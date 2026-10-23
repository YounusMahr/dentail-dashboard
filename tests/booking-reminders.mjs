import assert from 'node:assert/strict';
import { pakistanMobile } from '../src/lib/pakistan-phone.mjs';
import { appointmentReminderWindows } from '../src/lib/reminder-windows.mjs';

assert.equal(pakistanMobile('03267073002'), '03267073002');
assert.equal(pakistanMobile('+923267073002'), '03267073002');
assert.equal(pakistanMobile('0092 326 7073002'), '03267073002');
assert.throws(() => pakistanMobile('+92367073002'), /valid Pakistani mobile/);

assert.deepEqual(appointmentReminderWindows(48 * 60), ['48h']);
assert.deepEqual(appointmentReminderWindows(24 * 60 + 1), ['48h']);
assert.deepEqual(appointmentReminderWindows(24 * 60), []);
assert.deepEqual(appointmentReminderWindows(60), ['1h']);
assert.deepEqual(appointmentReminderWindows(1), ['1h']);
assert.deepEqual(appointmentReminderWindows(0), []);

console.log('Booking phone formats and reminder windows passed');
