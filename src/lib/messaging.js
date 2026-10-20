import { ObjectId } from 'mongodb';
import { db } from './db';
import { today } from './care-validation.mjs';
export const messageTypes=['appointment_confirmation','appointment_reminder','session_reminder','follow_up','payment_receipt','waitlist_offer'];
export const defaultTemplates={
 appointment_confirmation:{en:'Hello {{patient}}, your appointment at {{clinic}} is confirmed: {{details}}. Please contact us for changes.',ur:'السلام علیکم {{patient}}، {{clinic}} میں آپ کی اپائنٹمنٹ کی تصدیق ہو گئی ہے: {{details}}۔ تبدیلی کے لیے کلینک سے رابطہ کریں۔'},
 appointment_reminder:{en:'Hello {{patient}}, a reminder from {{clinic}} about your appointment: {{details}}.',ur:'السلام علیکم {{patient}}، {{clinic}} کی طرف سے اپائنٹمنٹ کی یاد دہانی: {{details}}۔'},
 session_reminder:{en:'Hello {{patient}}, your next treatment session at {{clinic}} is due: {{details}}. Please contact us to confirm.',ur:'السلام علیکم {{patient}}، {{clinic}} میں آپ کا اگلا سیشن: {{details}}۔ تصدیق کے لیے رابطہ کریں۔'},
 follow_up:{en:'Hello {{patient}}, {{clinic}} would like to arrange your follow-up: {{details}}. Please contact the clinic.',ur:'السلام علیکم {{patient}}، {{clinic}} کی طرف سے فالو اپ کی یاد دہانی: {{details}}۔ کلینک سے رابطہ کریں۔'},
 payment_receipt:{en:'Hello {{patient}}, {{clinic}} has recorded your payment: {{details}}. Thank you.',ur:'السلام علیکم {{patient}}، {{clinic}} میں آپ کی ادائیگی درج ہو گئی ہے: {{details}}۔ شکریہ۔'},
 waitlist_offer:{en:'Hello {{patient}}, a slot is available at {{clinic}}: {{details}}. Open your patient portal to accept; the slot is subject to availability.',ur:'السلام علیکم {{patient}}، {{clinic}} میں وقت دستیاب ہے: {{details}}۔ قبول کرنے کے لیے اپنا پیشنٹ پورٹل کھولیں۔ بکنگ دستیابی سے مشروط ہے۔'}
};
export const normalizePhone=value=>{let phone=String(value||'').replace(/\D/g,'');if(phone.startsWith('00'))phone=phone.slice(2);if(/^03\d{9}$/.test(phone))phone='92'+phone.slice(1);return phone};
export function renderMessage(template,{patient,clinic,details}){return template.replace(/\{\{(patient|clinic|details)\}\}/g,(_,key)=>({patient,clinic,details})[key]||'')}
export async function publicMessagingSettings(clinicId){const stored=await(await db()).collection('messagingSettings').findOne({clinicId});return {templates:{...defaultTemplates,...stored?.templates},providerConnected:false};}
export async function saveMessagingSettings(clinicId,body){
 const templates={};for(const type of messageTypes){templates[type]={};for(const lang of ['en','ur']){const text=String(body.templates?.[type]?.[lang]||'').trim();if(!text||text.length>1500)throw new Error('Each template needs 1–1500 characters');if(/\{\{(?!patient\}\}|clinic\}\}|details\}\})/.test(text))throw new Error('Only {{patient}}, {{clinic}} and {{details}} variables are supported');templates[type][lang]=text}}
 await(await db()).collection('messagingSettings').updateOne({clinicId},{$set:{templates,updatedAt:new Date()}},{upsert:true});
}
export async function enqueue({clinicId,patientId,type,eventKey,values=[],sourceCollection,sourceId,sourceFingerprint},session){
 if(!messageTypes.includes(type))throw new Error('Unknown notification type');const database=await db();
 const patient=await database.collection('patients').findOne({_id:new ObjectId(patientId),clinicId},{session});if(!patient?.whatsappConsent)return;
 if(!/^\d{10,15}$/.test(normalizePhone(patient.phone)))return;
 await database.collection('notificationOutbox').updateOne({clinicId,eventKey},{$setOnInsert:{clinicId,patientId,type,eventKey,values:values.map(v=>String(v).slice(0,250)),sourceCollection:sourceCollection||null,sourceId:sourceId||null,sourceFingerprint:sourceFingerprint||null,status:'pending_provider',createdAt:new Date()}},{upsert:true,session});
}
export async function queueReminders(clinicId){
 const database=await db(),now=today(),tomorrow=new Date(Date.now()+86400000).toLocaleDateString('en-CA',{timeZone:'Asia/Karachi'}),q=clinicId?{clinicId}:{};
 const appointments=await database.collection('appointments').find({...q,appointmentDate:{$gte:now},status:{$in:['pending','confirmed']}}).limit(2000).toArray();
 for(const a of appointments){const base={clinicId:a.clinicId,patientId:a.patientId,sourceCollection:'appointments',sourceId:String(a._id),sourceFingerprint:`${a.appointmentDate} ${a.startsAt}`,values:[a.appointmentDate,a.startsAt]};await enqueue({...base,type:'appointment_confirmation',eventKey:`booking:${a._id}:${a.appointmentDate}:${a.startsAt}`});if(a.appointmentDate===tomorrow)await enqueue({...base,type:'appointment_reminder',eventKey:`reminder:${a._id}:${a.appointmentDate}:${a.startsAt}`})}
 const sessions=await database.collection('careSessions').find({...q,scheduledDate:tomorrow,status:{$in:['planned','scheduled']}}).limit(2000).toArray();
 for(const s of sessions)await enqueue({clinicId:s.clinicId,patientId:s.patientId,type:'session_reminder',eventKey:`session:${s._id}:${s.scheduledDate}`,values:[s.scheduledDate,'Your next treatment visit'],sourceCollection:'careSessions',sourceId:String(s._id),sourceFingerprint:s.scheduledDate});
 const followUps=await database.collection('follow-ups').find({...q,status:'pending',dueDate:{$lte:now}}).limit(2000).toArray();
 for(const f of followUps)await enqueue({clinicId:f.clinicId,patientId:f.patientId,type:'follow_up',eventKey:`follow-up:${f._id}:${f.dueDate}`,values:[f.dueDate,'Please contact the clinic to arrange your follow-up'],sourceCollection:'follow-ups',sourceId:String(f._id)});
 return {success:true,appointmentsScanned:appointments.length,sessionsScanned:sessions.length,followUpsScanned:followUps.length,delivery:'Not sent — API integration deferred'};
}
