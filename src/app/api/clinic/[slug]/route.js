import {localInstant,clinicDay} from '@/lib/clinic-time.mjs';
import { publicProfile } from '@/lib/clinic-profile.mjs';
import { ObjectId } from 'mongodb';
import { db, ensureIndexes } from '@/lib/db';
import { fail, ok, string } from '@/lib/http';
import { sameOrigin } from '@/lib/auth';
import { enqueue } from '@/lib/messaging';
import { chairSlots } from '@/lib/availability.mjs';

async function clinicFor(slug) { return (await db()).collection('clinics').findOne({ slug, status: 'active' }); }
function validDate(value,timezone) { return /^\d{4}-\d{2}-\d{2}$/.test(value) && value >= clinicDay(timezone); }
function validTime(value) { return /^([01]\d|2[0-3]):[0-5]\d$/.test(value); }

export async function GET(request, { params }) {
  const clinic = await clinicFor((await params).slug);
  if (!clinic) return fail('Clinic not found', 404);
  const database = await db(), clinicId = String(clinic._id);
  const [doctors, services] = await Promise.all([
    database.collection('doctors').find({ clinicId, active: { $ne: false } }, { projection: { name: 1, specialization: 1, slotMinutes: 1, workingDays: 1, startTime: 1, endTime: 1, breakStart: 1, breakEnd: 1 } }).toArray(),
    database.collection('services').find({ clinicId, active: { $ne: false } }, { projection: { name: 1, description: 1, standardFee: 1, durationMinutes: 1 } }).toArray()
  ]);
  const pages=await database.collection('clinicPages').find({clinicId,published:{$ne:null}},{projection:{slug:1,'published.title':1,'published.sortOrder':1}}).toArray();
  return ok({ pages:pages.map(p=>({slug:p.slug,title:p.published.title,sortOrder:p.published.sortOrder||0})).sort((a,b)=>a.sortOrder-b.sortOrder), clinic: publicProfile(clinic), doctors, services });
}

export async function POST(request, { params }) {
  if (!sameOrigin(request)) return fail('Invalid request origin', 403);
  const clinic = await clinicFor((await params).slug);
  if (!clinic) return fail('Clinic not found', 404);
  const body = await request.json().catch(() => ({})), database = await db(), clinicId = String(clinic._id);
  const name = string(body.patientName, 150), phone = string(body.patientPhone, 30);
  const date = string(body.appointmentDate, 10), time = string(body.startsAt, 5);
  if (!name || !phone || !validDate(date,clinic.timezone) || !validTime(time) || localInstant(date,time,clinic.timezone)<=new Date() || !ObjectId.isValid(body.doctorId)) return fail('Complete name, phone, doctor, date and time');
  const doctor = await database.collection('doctors').findOne({ _id: new ObjectId(body.doctorId), clinicId, active: { $ne: false } });
  if (!doctor) return fail('Doctor is unavailable');
  const day = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`)).toLowerCase();
  if (doctor.workingDays && !doctor.workingDays.split(',').map(x => x.trim()).includes(day)) return fail('Doctor does not work on that day');
  const start = Number(time.slice(0, 2)) * 60 + Number(time.slice(3)), duration = Number(doctor.slotMinutes || 30);
  const toMin = v => Number(v.slice(0, 2)) * 60 + Number(v.slice(3));
  const first = toMin(doctor.startTime || '10:00');
  if (start < first || start + duration > toMin(doctor.endTime || '20:00') || (start - first) % duration !== 0 || doctor.breakStart && doctor.breakEnd && start < toMin(doctor.breakEnd) && start + duration > toMin(doctor.breakStart)) return fail('Time is outside the doctor schedule');
  const existingAppointments=await database.collection('appointments').find({clinicId,appointmentDate:date,status:{$nin:['cancelled','rescheduled']},$or:[{doctorId:body.doctorId},...(doctor.chairName?[{chairName:doctor.chairName}]:[])]},{projection:{startsAt:1,endsAt:1,status:1}}).toArray();
  if(!chairSlots({...doctor,active:true},date,existingAppointments,new Date(),clinic.timezone).includes(time))return fail('This doctor or chair is unavailable at that time',409);
  let serviceId = '';
  if (body.serviceId) {
    if (!ObjectId.isValid(body.serviceId) || !await database.collection('services').findOne({ _id: new ObjectId(body.serviceId), clinicId, active: { $ne: false } })) return fail('Invalid service');
    serviceId = body.serviceId;
  }
  await ensureIndexes();
  const patient = await database.collection('patients').findOneAndUpdate({ clinicId, phone }, { $setOnInsert: { clinicId, name, phone, email: string(body.patientEmail), whatsappConsent:body.whatsappConsent===true, preferredLanguage:body.preferredLanguage==='ur'?'ur':'en', createdAt: new Date() } }, { upsert: true, returnDocument: 'after' });
  try {
    const end = start + duration;
    const appointment = await database.collection('appointments').insertOne({ clinicId, patientId: String(patient._id), doctorId: body.doctorId, chairName:doctor.chairName||'', serviceId, appointmentDate: date, startsAt: time, endsAt: `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`, status: 'confirmed', patientNotes: string(body.patientNotes), createdAt: new Date() });
    try{await enqueue({clinicId,patientId:String(patient._id),type:'appointment_confirmation',eventKey:'booking:'+appointment.insertedId+':'+date+':'+time,values:[date,time],sourceCollection:'appointments',sourceId:String(appointment.insertedId),sourceFingerprint:date+' '+time})}catch{console.error('Booking saved; notification will be recovered by scheduler')}
    return ok({ confirmationId: String(appointment.insertedId) }, 201);
  } catch (error) { return fail(error.code === 11000 ? 'This slot was just booked. Please choose another.' : 'Booking failed', 409); }
}

