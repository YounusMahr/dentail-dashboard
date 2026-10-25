import {ObjectId} from 'mongodb';
import {db} from './db';
import {buildNotificationPdf} from './notification-pdf';
import {smtpSender,smtpTransport} from './clinic-smtp';

const allowed=new Set(['appointment_confirmation','payment_receipt','prescription_issued','appointment_reminder','session_reminder','follow_up']);
const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

export async function queueEmail({clinicId,patientId,type,eventKey,details=[],sourceId},session){
 if(!allowed.has(type))throw new Error('Unknown email notification');
 const database=await db(),patient=await database.collection('patients').findOne({_id:new ObjectId(patientId),clinicId},{session});
 if(!patient?.emailConsent||!emailPattern.test(patient.email||''))return false;
 const result=await database.collection('emailOutbox').updateOne({clinicId,eventKey},{$setOnInsert:{clinicId,patientId,type,eventKey,details:details.map(value=>String(value).slice(0,250)),sourceId:sourceId||'',status:'pending_provider',createdAt:new Date()}},{upsert:true,session});
 return result.upsertedCount>0;
}

export async function dispatchEmailOutbox(clinicId, outboxId){
 const database=await db(),items=await database.collection('emailOutbox').find({...(clinicId?{clinicId}:{}),...(outboxId?{_id:new ObjectId(outboxId)}:{}),status:'pending_provider'}).sort({createdAt:1}).limit(outboxId?1:20).toArray();
 let sent=0,failed=0;
 for(const item of items){
   if((item.type==='payment_receipt'&&!item.eventKey?.startsWith('print-receipt:')&&!item.eventKey?.startsWith('payment:'))||(item.type==='prescription_issued'&&!item.eventKey?.startsWith('print-prescription:')&&!item.eventKey?.startsWith('prescription:'))){
     await database.collection('emailOutbox').updateOne({_id:item._id},{$set:{status:'cancelled',cancelReason:'Print required',updatedAt:new Date()}});continue;
   }
   const [patient,clinic,smtp]=await Promise.all([database.collection('patients').findOne({_id:new ObjectId(item.patientId),clinicId:item.clinicId}),database.collection('clinics').findOne({_id:new ObjectId(item.clinicId)}),database.collection('clinicSmtpSettings').findOne({clinicId:item.clinicId,enabled:true})]);
   if(!patient?.emailConsent||!emailPattern.test(patient.email||'')){await database.collection('emailOutbox').updateOne({_id:item._id},{$set:{status:'cancelled',cancelReason:'No email consent or invalid address',updatedAt:new Date()}});continue}
   if(['appointment_confirmation','appointment_reminder'].includes(item.type)&&ObjectId.isValid(item.sourceId||'')){
     const appointment=await database.collection('appointments').findOne({_id:new ObjectId(item.sourceId),clinicId:item.clinicId});
     if(!appointment||appointment.deletedAt||['cancelled','no_show'].includes(appointment.status)||!item.eventKey.endsWith(`:${appointment.appointmentDate}:${appointment.startsAt}`)){
       await database.collection('emailOutbox').updateOne({_id:item._id},{$set:{status:'cancelled',cancelReason:'Appointment changed or cancelled',updatedAt:new Date()}});continue;
     }
   }
   const clinicName=clinic?.name||'Dental Clinic',subjects={appointment_confirmation:'Appointment confirmation',appointment_reminder:'Appointment reminder',session_reminder:'Treatment session reminder',follow_up:'Dental follow-up reminder',payment_receipt:'Payment receipt',prescription_issued:'Prescription ready'};
   const subject=`${clinicName} · ${subjects[item.type]}`;
   const paymentLines=item.type==='payment_receipt'?[clinic?.bankName&&`Bank / wallet: ${clinic.bankName}`,clinic?.accountTitle&&`Account title: ${clinic.accountTitle}`,clinic?.accountNumber&&`Account number: ${clinic.accountNumber}`,clinic?.iban&&`IBAN: ${clinic.iban}`].filter(Boolean):[];
   const paragraphs=[`Hello ${patient.name||'Patient'},`,`${subjects[item.type]} from ${clinicName}.`,...(item.details||[]),...paymentLines,...(['payment_receipt','prescription_issued'].includes(item.type)?['Your PDF copy is attached.']:[]),'For questions, contact the clinic directly.'];
   const html=`<div style="font:16px Arial,sans-serif;color:#173b35;max-width:580px;margin:auto"><h1 style="font-size:24px;color:#13866b">${escape(clinicName)}</h1>${paragraphs.map(line=>`<p>${escape(line)}</p>`).join('')}<small>This is a clinic notification.</small></div>`;
   try{
     const attachment=['payment_receipt','prescription_issued'].includes(item.type)?await buildNotificationPdf(database,item,clinic):null;
     if(smtp){
       const transporter=smtpTransport(smtp);
       let mailResult;
       try{mailResult=await transporter.sendMail({from:smtpSender(smtp),to:patient.email,subject,html,attachments:attachment?[{filename:attachment.fileName,content:attachment.buffer,contentType:'application/pdf'}]:[]})}finally{transporter.close()}
       await database.collection('emailOutbox').updateOne({_id:item._id,status:'pending_provider'},{$set:{status:'sent',sentAt:new Date(),provider:'clinic_smtp',providerMessageId:mailResult.messageId||''}});
       sent++;
     }else if(process.env.RESEND_API_KEY&&process.env.EMAIL_FROM){
       const attachments=attachment?[{filename:attachment.fileName,content:attachment.buffer.toString('base64'),content_type:'application/pdf'}]:undefined;
       const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':`dental-${item._id}`},body:JSON.stringify({from:process.env.EMAIL_FROM,to:[patient.email],subject,html,attachments}),signal:AbortSignal.timeout(15000)});
       const result=await response.json().catch(()=>({}));
       if(!response.ok)throw new Error(result.message||`Email provider returned ${response.status}`);
       await database.collection('emailOutbox').updateOne({_id:item._id,status:'pending_provider'},{$set:{status:'sent',sentAt:new Date(),provider:'resend',providerMessageId:result.id||''}});
       sent++;
     }else{
       await database.collection('emailOutbox').updateOne({_id:item._id},{$set:{status:'failed',failedAt:new Date(),error:'No email provider or clinic SMTP configured'}});
       failed++;
     }
   }catch(error){
     await database.collection('emailOutbox').updateOne({_id:item._id},{$set:{status:'failed',failedAt:new Date(),error:String(error.message).slice(0,250)}});
     failed++;
   }
 }
 return {processed:items.length,sent,failed};
}
