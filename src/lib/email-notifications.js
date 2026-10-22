import {ObjectId} from 'mongodb';
import {db} from './db';

const allowed=new Set(['appointment_confirmation','payment_receipt','prescription_issued','appointment_reminder','session_reminder','follow_up']);
const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

export async function queueEmail({clinicId,patientId,type,eventKey,details=[],sourceId},session){
 if(!allowed.has(type))throw new Error('Unknown email notification');
 const database=await db(),patient=await database.collection('patients').findOne({_id:new ObjectId(patientId),clinicId},{session});
 if(!patient?.emailConsent||!emailPattern.test(patient.email||''))return false;
 await database.collection('emailOutbox').updateOne({clinicId,eventKey},{$setOnInsert:{clinicId,patientId,type,eventKey,details:details.map(value=>String(value).slice(0,250)),sourceId:sourceId||'',status:'pending_provider',createdAt:new Date()}},{upsert:true,session});
 return true;
}

export async function dispatchEmailOutbox(clinicId){
 if(!process.env.RESEND_API_KEY||!process.env.EMAIL_FROM)return {processed:0,pendingProvider:true};
 const database=await db(),items=await database.collection('emailOutbox').find({...(clinicId?{clinicId}:{}),status:'pending_provider'}).sort({createdAt:1}).limit(20).toArray();
 let sent=0,failed=0;
 for(const item of items){
   const [patient,clinic]=await Promise.all([database.collection('patients').findOne({_id:new ObjectId(item.patientId),clinicId:item.clinicId}),database.collection('clinics').findOne({_id:new ObjectId(item.clinicId)})]);
   if(!patient?.emailConsent||!emailPattern.test(patient.email||'')){await database.collection('emailOutbox').updateOne({_id:item._id},{$set:{status:'cancelled',updatedAt:new Date()}});continue}
   const clinicName=clinic?.name||'Dental Clinic',subjects={appointment_confirmation:'Appointment confirmation',appointment_reminder:'Appointment reminder',session_reminder:'Treatment session reminder',follow_up:'Dental follow-up reminder',payment_receipt:'Payment receipt',prescription_issued:'Prescription ready'};
   const subject=`${clinicName} · ${subjects[item.type]}`;
   const paragraphs=[`Hello ${patient.name||'Patient'},`,`${subjects[item.type]} from ${clinicName}.`,...(item.details||[]),'For questions, contact the clinic directly.'];
   const html=`<div style="font:16px Arial,sans-serif;color:#173b35;max-width:580px;margin:auto"><h1 style="font-size:24px;color:#13866b">${escape(clinicName)}</h1>${paragraphs.map(line=>`<p>${escape(line)}</p>`).join('')}<small>This is a clinic notification.</small></div>`;
   try{
     const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':`dental-${item._id}`},body:JSON.stringify({from:process.env.EMAIL_FROM,to:[patient.email],subject,html}),signal:AbortSignal.timeout(12000)});
     const result=await response.json().catch(()=>({}));
     if(!response.ok)throw new Error(result.message||`Email provider returned ${response.status}`);
     await database.collection('emailOutbox').updateOne({_id:item._id,status:'pending_provider'},{$set:{status:'sent',sentAt:new Date(),providerMessageId:result.id||''}});sent++;
   }catch(error){await database.collection('emailOutbox').updateOne({_id:item._id},{$set:{status:'failed',failedAt:new Date(),error:String(error.message).slice(0,250)}});failed++}
 }
 return {processed:items.length,sent,failed};
}
