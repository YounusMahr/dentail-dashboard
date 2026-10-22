import {localInstant} from '@/lib/clinic-time.mjs';
import { createClinicalRecord, saveDoctor } from '@/lib/legacy-workflows';
import { ObjectId } from 'mongodb';
import { currentUser, sameOrigin } from '@/lib/auth';
import { db } from '@/lib/db';
import { fail, ok } from '@/lib/http';
import { modules } from '@/lib/modules';
import { cleanRecord } from '@/lib/records';
import { bookVisit } from '@/lib/visit-booking';

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
  const recordId=query.get('record');if(recordId){if(!/^[a-f\d]{24}$/i.test(recordId))return fail('Invalid record');filter._id=new ObjectId(recordId)}
  const doctor=query.get('doctor'),service=query.get('service'),gender=query.get('gender'),blood=query.get('bloodGroup'),category=query.get('category'),role=query.get('role'),active=query.get('active'),tab=query.get('tab');
  if(doctor&&['appointments','treatments'].includes(module))filter.doctorId=doctor;
  if(service&&module==='treatments')filter.serviceId=service;
  if(module==='patients'){if(gender)filter.gender=gender;if(blood)filter.bloodGroup=blood;if(query.get('medicalAlert')==='true')filter.medicalHistory={$exists:true,$nin:['',null]}}
  if(module==='services'&&category)filter.category=category;
  if(module==='staff'&&role)filter.role=role;
  if(['staff','doctors','services'].includes(module)&&['true','false'].includes(active))filter.active=active==='true';
  if(search&&!['patients','services','doctors','staff'].includes(module)){
    const regex={$regex:search.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),$options:'i'};
    const patients=await database.collection('patients').find({clinicId:user.clinicId,$or:[{name:regex},{phone:regex}]},{projection:{_id:1}}).toArray();
    const fields={appointments:['patientNotes'],treatments:user.role==='receptionist'?['treatmentRendered','toothNumbers']:['diagnosis','treatmentRendered','toothNumbers'],invoices:['invoiceNumber','description'],'follow-ups':['reason','staffNotes']}[module]||[];
    filter.$or=[{patientId:{$in:patients.map(p=>String(p._id))}},...fields.map(k=>({[k]:regex}))];
  }
  if(module==='treatments'&&query.get('tooth'))filter.toothNumbers={$regex:`(^|[,\\s])${query.get('tooth').replace(/[^0-9]/g,'')}([,\\s]|$)`};
  if(module==='invoices'){if(query.get('status'))filter.status=query.get('status');if(query.get('from')||query.get('to')){filter.createdAt={};if(query.get('from'))filter.createdAt.$gte=localInstant(query.get('from'),'00:00',user.timezone);if(query.get('to'))filter.createdAt.$lte=localInstant(query.get('to'),'23:59:59',user.timezone)}}
  if(module==='follow-ups'){
    const today=new Date().toLocaleDateString('en-CA',{timeZone:user.timezone||'Asia/Karachi'}),week=new Date(today+'T12:00:00Z');week.setUTCDate(week.getUTCDate()+7);
    if(tab==='overdue'){filter.status='pending';filter.dueDate={$lt:today}}
    else if(tab==='today'){filter.status={$in:['pending','contacted']};filter.dueDate=today}
    else if(tab==='upcoming'){filter.status='pending';filter.dueDate={$gt:today,$lte:week.toISOString().slice(0,10)}}
    else if(['contacted','booked'].includes(tab))filter.status=tab;
    else if(query.get('status'))filter.status=query.get('status');
  }
  if (module === 'appointments') {
    const date = query.get('date'), status = query.get('status');
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) filter.appointmentDate = date;
    if (status && ['pending','confirmed','checked_in','in_progress','completed','cancelled','no_show'].includes(status)) filter.status = status;
  }
  if (module === 'appointments' && user.role === 'dentist') filter.doctorId = user.doctorId;
  if (module === 'treatments' && user.role === 'dentist') filter.doctorId = user.doctorId;
  const projection = module === 'staff' ? { passwordHash: 0 } : module === 'treatments' && user.role === 'receptionist' ? { clinicalNotes: 0, diagnosis: 0 } : {};
  const sort = module === 'appointments' ? { appointmentDate: 1, startsAt: 1 } : module === 'follow-ups' ? { dueDate: 1 } : { createdAt: -1 };
  const records = await database.collection(collection).find(filter, { projection }).sort(sort).skip(query.has('page')?Math.max(0,(Number(query.get('page'))||1)-1)*30:0).limit(query.has('page')?30:300).toArray();
  const total=await database.collection(collection).countDocuments(filter);
  return ok({ records,total });
}

export async function POST(request, { params }) {
  if (!sameOrigin(request)) return fail('Invalid request origin', 403);
  const { module } = await params, user = await currentUser();
  if (!config(module, user, true)) return fail('Unauthorized', 403);
  const input = await request.json().catch(() => ({}));
  try {
    if(module==='appointments')return ok(await bookVisit(input,user),201);
    const record = await cleanRecord(module, input, user);
    if (module === 'doctors') return ok({ id: String(await saveDoctor(record, input, user)) }, 201);
    if (['treatments','invoices'].includes(module)) return ok({ id: String(await createClinicalRecord(module, input, user, record)) }, 201);
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
    return ok({ id: String(result.insertedId) }, 201);
  } catch (error) { return fail(error.code === 11000 ? 'This record already exists or slot is booked' : error.message,error.code===11000||error.message?.includes('already has a patient file')?409:400); }
}
