import {ObjectId} from 'mongodb';
const specs=[
 ['patients','Patients',['name','phone','email'],'name','/dashboard/patients'],
 ['doctors','Doctors',['name','email','specialization'],'name','/dashboard/doctors'],
 ['appointments','Appointments',['appointmentDate','status'],'appointmentDate','/dashboard/appointments'],
 ['careSessions','Sessions',['title','scheduledDate','status'],'title','/dashboard/care/sessions'],
 ['invoices','Invoices',['invoiceNumber','description','status'],'invoiceNumber','/dashboard/invoices'],
 ['labCases','Lab cases',['title','labName','status'],'title','/dashboard/care/labs'],
 ['follow-ups','Follow-ups',['dueDate','status'],'dueDate','/dashboard/follow-ups'],
 ['services','Services',['name','category'],'name','/dashboard/services'],
 ['treatments','Treatments',['toothNumbers'],'toothNumbers','/dashboard/treatments'],
 ['prescriptions','Prescriptions',['status'],'status','/dashboard/care/prescriptions'],
 ['waitingList','Waiting list',['status'],'status','/dashboard/care/waitlist'],
 ['users','Staff',['name','email'],'name','/dashboard/staff'],
 ['clinicPages','Website pages',['title','slug'],'title','/dashboard/care/website']
];
export async function searchClinic(database,user,term){
 if(!user.clinicId||!['clinic_admin','dentist','receptionist'].includes(user.role))throw new Error('Unauthorized');
 const text=String(term||'').trim().slice(0,80);if(text.length<2)return [];
 const regex={$regex:text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),$options:'i'},scope={clinicId:user.clinicId};
 const patients=await database.collection('patients').find({...scope,$or:['name','phone','email'].map(k=>({[k]:regex}))},{projection:{name:1},maxTimeMS:3000}).limit(100).toArray();
 const patientIds=patients.map(x=>String(x._id));
 return (await Promise.all(specs.filter(([col])=>!(user.role!=='clinic_admin'&&['users','clinicPages'].includes(col))&&!(user.role==='receptionist'&&col==='prescriptions')).map(async([col,label,fields,title,path])=>{
   const q={...scope,$or:fields.map(k=>({[k]:regex}))};if(ObjectId.isValid(text))q.$or.push({_id:new ObjectId(text)});
   if(!['patients','doctors','services','users','clinicPages'].includes(col)&&patientIds.length)q.$or.push({patientId:{$in:patientIds}});
   if(user.role==='dentist'&&['appointments','treatments','careSessions','prescriptions'].includes(col))q.doctorId=user.doctorId||'unassigned';
   const projection=Object.fromEntries([...new Set([title,'patientId','status','appointmentDate','startsAt','scheduledDate','dueDate','specialization'])].map(k=>[k,1]));
   const rows=await database.collection(col).find(q,{projection,maxTimeMS:3000}).sort({_id:-1}).limit(6).toArray();
   return {label,hasMore:rows.length>5,results:rows.slice(0,5).map(r=>({id:String(r._id),title:String(r[title]||label),detail:[patients.find(p=>String(p._id)===r.patientId)?.name,r.scheduledDate||r.appointmentDate||r.dueDate,r.startsAt,r.specialization,r.status].filter(Boolean).join(' · '),href:col==='patients'?`${path}/${r._id}`:`${path}?record=${r._id}`}))};
 }))).filter(g=>g.results.length);
}
