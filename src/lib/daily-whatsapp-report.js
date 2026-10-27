import { ObjectId } from 'mongodb';
import { db } from './db';
import { clinicDay, localInstant } from './clinic-time.mjs';
import { pakistanMobile } from './pakistan-phone.mjs';
import { sendEvolutionText } from './evolution';
import { formatDailyReport } from './daily-report-format.mjs';

export async function sendEndOfDayReports({ clinicId, instanceName, now = new Date() }) {
  const database = await db();
  const clinic = await database.collection('clinics').findOne({ _id: new ObjectId(clinicId), status: 'active' }, { projection: { name: 1, timezone: 1 } });
  if (!clinic) return { sent: 0, skipped: 'clinic_unavailable' };
  const timezone = clinic.timezone || 'Asia/Karachi';
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', hourCycle: 'h23' }).format(now));
  if (hour < 23) return { sent: 0, skipped: 'before_day_end' };
  const day = clinicDay(timezone, now);
  const from = localInstant(day, '00:00', timezone), to = localInstant(day, '23:59:59', timezone);
  const period = { $gte: from, $lte: new Date(to.getTime() + 999) };
  const users = await database.collection('users').find({ clinicId, role: 'clinic_admin', active: { $ne: false } }, { projection: { phone: 1 } }).toArray();
  const recipients = [...new Set(users.flatMap(user => { try { return [pakistanMobile(user.phone)]; } catch { return []; } }))];
  if (!recipients.length) return { sent: 0, skipped: 'admin_phone_missing' };
  const q = { clinicId };
  const [totalPatients, newPatients, appointments, bookedToday, bills, collections, balances] = await Promise.all([
    database.collection('patients').countDocuments(q),
    database.collection('patients').countDocuments({ ...q, createdAt: period }),
    database.collection('appointments').countDocuments({ ...q, appointmentDate: day, deletedAt: { $exists: false }, status: { $nin: ['cancelled', 'rescheduled'] } }),
    database.collection('appointments').countDocuments({ ...q, createdAt: period, deletedAt: { $exists: false }, status: { $nin: ['cancelled', 'rescheduled'] } }),
    database.collection('invoices').aggregate([{ $match: { ...q, createdAt: period, status: { $ne: 'cancelled' } } }, { $group: { _id: null, total: { $sum: '$totalAmount' } } }]).toArray(),
    database.collection('payments').aggregate([{ $match: { ...q, createdAt: period } }, { $group: { _id: null, total: { $sum: '$amount' } } }]).toArray(),
    database.collection('invoices').aggregate([{ $match: { ...q, status: { $ne: 'cancelled' } } }, { $group: { _id: null, total: { $sum: '$balanceAmount' } } }]).toArray(),
  ]);
  const report = formatDailyReport({ name: clinic.name, day, totalPatients, newPatients, appointments, bookedToday, billed: bills[0]?.total, received: collections[0]?.total, outstanding: balances[0]?.total });
  const reports = database.collection('whatsappDailyReports');
  let sent = 0;
  for (const phone of recipients) {
    const _id = `${clinicId}:${day}:${phone}`;
    await reports.updateOne({ _id }, { $setOnInsert: { clinicId, day, phone, status: 'pending', createdAt: now } }, { upsert: true });
    const claimed = await reports.findOneAndUpdate({ _id, status: { $ne: 'sent' }, $or: [{ lockUntil: { $exists: false } }, { lockUntil: { $lt: now } }] }, { $set: { status: 'sending', lockUntil: new Date(now.getTime() + 120000), updatedAt: now } }, { returnDocument: 'after' });
    if (!claimed) continue;
    try {
      const result = await sendEvolutionText(phone, report, instanceName);
      await reports.updateOne({ _id }, { $set: { status: 'sent', messageId: result.messageId || null, sentAt: new Date() }, $unset: { lockUntil: '' } });
      sent++;
    } catch (error) {
      await reports.updateOne({ _id }, { $set: { status: 'failed', error: String(error.message).slice(0, 200), updatedAt: new Date() }, $unset: { lockUntil: '' } });
      console.error('Daily WhatsApp report failed:', error.message);
    }
  }
  return { sent, recipients: recipients.length, day };
}
