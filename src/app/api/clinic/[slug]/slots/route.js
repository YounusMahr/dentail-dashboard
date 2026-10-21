import { ObjectId } from 'mongodb';
import { db } from '@/lib/db';
import { fail, ok } from '@/lib/http';

export async function GET(request, { params }) {
  const { slug } = await params, query = new URL(request.url).searchParams;
  const date = query.get('date'), doctorId = query.get('doctorId');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !ObjectId.isValid(doctorId)) return fail('Choose doctor and date');
  const database = await db(), clinic = await database.collection('clinics').findOne({ slug, status: 'active' });
  if (!clinic) return fail('Clinic not found', 404);
  const clinicId = String(clinic._id), doctor = await database.collection('doctors').findOne({ _id: new ObjectId(doctorId), clinicId, active: { $ne: false } });
  if (!doctor) return fail('Doctor not found', 404);
  const day = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`)).toLowerCase();
  if (doctor.workingDays && !doctor.workingDays.split(',').map(x => x.trim()).includes(day)) return ok({ slots: [] });
  const existing = await database.collection('appointments').find({ clinicId, doctorId, appointmentDate: date, status: { $ne: 'cancelled' } }, { projection: { startsAt: 1 } }).toArray();
  const booked = new Set(existing.map(x => x.startsAt));
  const toMin = v => Number(v.slice(0, 2)) * 60 + Number(v.slice(3));
  const duration = Number(doctor.slotMinutes || 30), slots = [];
  for (let start = toMin(doctor.startTime || '10:00'); start + duration <= toMin(doctor.endTime || '20:00'); start += duration) {
    const time = `${String(Math.floor(start / 60)).padStart(2, '0')}:${String(start % 60).padStart(2, '0')}`;
    if (new Date(`${date}T${time}:00+05:00`)>new Date() && !booked.has(time) && !(doctor.breakStart && doctor.breakEnd && start < toMin(doctor.breakEnd) && start + duration > toMin(doctor.breakStart))) slots.push(time);
  }
  return ok({ slots });
}
