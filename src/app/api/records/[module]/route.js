import { currentUser, sameOrigin } from '@/lib/auth';
import { db } from '@/lib/db';
import { fail, ok } from '@/lib/http';
import { modules } from '@/lib/modules';
import { cleanRecord } from '@/lib/records';
import { enqueue } from '@/lib/messaging';

function config(module, user, write = false) {
  const schema = modules[module];
  return schema && user && (write ? (schema.writeRoles || schema.roles) : schema.roles).includes(user.role) ? schema : null;
}

export async function GET(request, { params }) {
  const { module } = await params, user = await currentUser();
  if (!config(module, user)) return fail('Unauthorized', 403);
  const database = await db(), collection = module === 'staff' ? 'users' : module;
  const filter = { clinicId: user.clinicId };
  const search = new URL(request.url).searchParams.get('search')?.trim().slice(0, 100);
  if (search && ['patients', 'services', 'doctors', 'staff'].includes(module)) {
    const pattern = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (module === 'patients') filter.$or = ['name','phone','email'].map(field => ({ [field]: { $regex: pattern, $options: 'i' } }));
    else filter.name = { $regex: pattern, $options: 'i' };
  }
  const query = new URL(request.url).searchParams;
  if (module === 'appointments') {
    const date = query.get('date'), status = query.get('status');
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) filter.appointmentDate = date;
    if (status && ['pending','confirmed','checked_in','in_progress','completed','cancelled','no_show'].includes(status)) filter.status = status;
  }
  if (module === 'appointments' && user.role === 'dentist') filter.doctorId = user.doctorId;
  if (module === 'treatments' && user.role === 'dentist') filter.doctorId = user.doctorId;
  const projection = module === 'staff' ? { passwordHash: 0 } : module === 'treatments' && user.role === 'receptionist' ? { clinicalNotes: 0, diagnosis: 0 } : {};
  const sort = module === 'appointments' ? { appointmentDate: 1, startsAt: 1 } : module === 'follow-ups' ? { dueDate: 1 } : { createdAt: -1 };
  const records = await database.collection(collection).find(filter, { projection }).sort(sort).limit(300).toArray();
  return ok({ records });
}

export async function POST(request, { params }) {
  if (!sameOrigin(request)) return fail('Invalid request origin', 403);
  const { module } = await params, user = await currentUser();
  if (!config(module, user, true)) return fail('Unauthorized', 403);
  const input = await request.json().catch(() => ({}));
  try {
    const record = await cleanRecord(module, input, user);
    const database = await db(), collection = module === 'staff' ? 'users' : module;
    const result = await database.collection(collection).insertOne({ ...record, clinicId: user.clinicId, createdAt: new Date(), updatedAt: new Date() });
    if (module === 'doctors' && record.email) {
      const dentist = await database.collection('users').findOne({ clinicId: user.clinicId, email: record.email, role: 'dentist' });
      if (dentist) await database.collection('doctors').updateOne({ _id: result.insertedId }, { $set: { userId: String(dentist._id) } });
    }
    if (module === 'staff' && record.role === 'dentist') {
      const doctor = await database.collection('doctors').findOne({ clinicId: user.clinicId, email: record.email });
      if (doctor) await database.collection('doctors').updateOne({ _id: doctor._id }, { $set: { userId: String(result.insertedId) } });
      else await database.collection('doctors').insertOne({ clinicId: user.clinicId, userId: String(result.insertedId), name: record.name, email: record.email, specialization: 'General Dentist', slotMinutes: 30, workingDays: 'monday,tuesday,wednesday,thursday,friday,saturday', startTime: '10:00', endTime: '20:00', active: true, createdAt: new Date() });
    }
    if(module==='appointments')try{await enqueue({clinicId:user.clinicId,patientId:record.patientId,type:'appointment_confirmation',eventKey:'booking:'+result.insertedId+':'+record.appointmentDate+':'+record.startsAt,values:[record.appointmentDate,record.startsAt],sourceCollection:'appointments',sourceId:String(result.insertedId),sourceFingerprint:record.appointmentDate+' '+record.startsAt})}catch{console.error('Booking saved; notification will be recovered by scheduler')}
    return ok({ id: String(result.insertedId) }, 201);
  } catch (error) { return fail(error.code === 11000 ? 'This record already exists or slot is booked' : error.message); }
}
