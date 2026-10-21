import { ObjectId } from 'mongodb';
import { db } from '@/lib/db';
import { fail, ok } from '@/lib/http';
import { chairSlots } from '@/lib/availability.mjs';

export async function GET(request, { params }) {
  const { slug } = await params, query = new URL(request.url).searchParams;
  const date = query.get('date'), doctorId = query.get('doctorId');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !ObjectId.isValid(doctorId)) return fail('Choose doctor and date');
  const database = await db(), clinic = await database.collection('clinics').findOne({ slug, status: 'active' });
  if (!clinic) return fail('Clinic not found', 404);
  const clinicId = String(clinic._id), doctor = await database.collection('doctors').findOne({ _id: new ObjectId(doctorId), clinicId, active: { $ne: false } });
  if (!doctor) return fail('Doctor not found', 404);
  const existing=await database.collection('appointments').find({clinicId,appointmentDate:date,status:{$nin:['cancelled','rescheduled']},$or:[{doctorId},...(doctor.chairName?[{chairName:doctor.chairName}]:[])]},{projection:{startsAt:1,endsAt:1,status:1}}).toArray();
  return ok({slots:chairSlots({...doctor,active:true},date,existing,new Date(),clinic.timezone)});
}
