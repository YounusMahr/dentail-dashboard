import { ObjectId } from 'mongodb';
import { currentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { fail, ok } from '@/lib/http';
export async function GET(request) {
  const user = await currentUser(); if(!user?.clinicId)return fail('Unauthorized',401);
  const database=await db(),q={clinicId:user.clinicId};
  const requested=new URL(request.url).searchParams.get('date');
  const today=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Karachi'});
  const date=requested&&/^\d{4}-\d{2}-\d{2}$/.test(requested)&&!Number.isNaN(Date.parse(requested))?requested:today;
  const days=Array.from({length:7},(_,i)=>{const d=new Date(`${date}T12:00:00Z`);d.setUTCDate(d.getUTCDate()-6+i);return d.toISOString().slice(0,10)});
  const aq=user.role==='dentist'?{...q,doctorId:user.doctorId}:q;
  const [patients,appointments,invoices,followUps,clinic,dayAppointments,weekAppointments,recentPatients,doctors]=await Promise.all([
    database.collection('patients').countDocuments(q),database.collection('appointments').countDocuments(aq),database.collection('invoices').find(q,{projection:{paidAmount:1,balanceAmount:1}}).toArray(),
    database.collection('follow-ups').countDocuments({...q,status:'pending'}),database.collection('clinics').findOne({_id:new ObjectId(user.clinicId)},{projection:{name:1,slug:1}}),
    database.collection('appointments').find({...aq,appointmentDate:date},{projection:{patientId:1,doctorId:1,serviceId:1,startsAt:1,endsAt:1,status:1}}).sort({startsAt:1}).toArray(),
    database.collection('appointments').find({...aq,appointmentDate:{$gte:days[0],$lte:date}},{projection:{appointmentDate:1,status:1}}).toArray(),
    database.collection('patients').find(q,{projection:{name:1,phone:1,createdAt:1}}).sort({createdAt:-1,_id:-1}).limit(4).toArray(),
    database.collection('doctors').find({...q,active:true},{projection:{name:1,specialization:1}}).limit(4).toArray()
  ]);
  const ids=(field)=>dayAppointments.map(x=>x[field]).filter(x=>x&&ObjectId.isValid(x)).map(x=>new ObjectId(x));
  const [patientNames,doctorNames,serviceNames]=await Promise.all(['patients','doctors','services'].map((collection,i)=>database.collection(collection).find({...q,_id:{$in:ids(['patientId','doctorId','serviceId'][i])}},{projection:{name:1}}).toArray()));
  const name=(list,id)=>list.find(x=>String(x._id)===String(id))?.name;
  return ok({patients,appointments,followUps,date,userName:user.name,revenue:invoices.reduce((sum,x)=>sum+Number(x.paidAmount||0),0),outstanding:invoices.reduce((sum,x)=>sum+Number(x.balanceAmount||0),0),clinic:{name:clinic?.name,slug:clinic?.slug},
    schedule:dayAppointments.map(x=>({...x,patientName:name(patientNames,x.patientId)||'Patient',doctorName:name(doctorNames,x.doctorId)||'Dentist',serviceName:name(serviceNames,x.serviceId)||'Consultation'})),
    activity:days.map(day=>({date:day,total:weekAppointments.filter(x=>x.appointmentDate===day).length,completed:weekAppointments.filter(x=>x.appointmentDate===day&&x.status==='completed').length})),
    recentPatients,doctors
  });
}
