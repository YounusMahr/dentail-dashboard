import { ObjectId } from 'mongodb';
import { db } from './db';
import { careSections,careCollections,clinicalRoles,teamRoles } from './care-schema';
import { money,validDate } from './care-validation.mjs';
export function careAllowed(section,user,write=false) {
  const schema=careSections[section];
  return !!schema&&!!user?.clinicId&&(schema.admin?user.role==='clinic_admin':schema.clinical?clinicalRoles.includes(user.role):teamRoles.includes(user.role))&&(!write||!['plans'].includes(section)||clinicalRoles.includes(user.role));
}
let indexesPromise;
export async function careIndexes(database) {
  if (!indexesPromise) indexesPromise=Promise.all([
    database.collection('notificationOutbox').createIndex({clinicId:1,eventKey:1},{unique:true}),
    database.collection('portalAccess').createIndex({tokenHash:1},{unique:true}),
    database.collection('portalAccess').createIndex({expiresAt:1},{expireAfterSeconds:0}),
    database.collection('clinicPages').createIndex({clinicId:1,slug:1},{unique:true}),
    database.collection('payments').createIndex({clinicId:1,idempotencyKey:1},{unique:true,partialFilterExpression:{idempotencyKey:{$type:'string'}}}),
    database.collection('careSessions').createIndex({clinicId:1,planId:1}),
    database.collection('waitingOffers').createIndex({clinicId:1,waitingId:1,appointmentId:1},{unique:true}),
  ]).catch(error=>{indexesPromise=undefined;throw error});
  return indexesPromise;
}
export async function related(database,collection,id,clinicId,session) {
  if(!ObjectId.isValid(id||''))throw new Error(`Choose a valid ${collection}`);
  const record=await database.collection(collection).findOne({_id:new ObjectId(id),clinicId},{session});
  if(!record)throw new Error(`Linked ${collection} record not found`);
  return record;
}
export async function cleanCare(section,input,user,existing=null) {
  const database=await db(),schema=careSections[section],record={};
  for(const [key,label,type,required] of schema.fields){
    if(!(key in input)&&existing)continue;
    let value=type==='number'?money(input[key]||0,label):String(input[key]??'').trim().slice(0,type==='textarea'||type==='urdu'?12000:500);
    if(required&&value==='')throw new Error(`${label} is required`);
    if(type==='date'&&value&&!validDate(value))throw new Error(`Invalid ${label}`);
    if(type==='time'&&value&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(value))throw new Error(`Invalid ${label}`);
    if(type.startsWith('select:')&&!type.slice(7).split(',').includes(value))throw new Error(`Invalid ${label}`);
    const refs={patient:'patients',doctor:'doctors',service:'services',plan:'treatmentPlans',session:'careSessions',appointment:'appointments'};
    if(refs[type]&&value)await related(database,refs[type],value,user.clinicId);
    if(type==='url'&&value&&!/^https:\/\/[^\s]+$/i.test(value))throw new Error('Use an HTTPS image URL');
    if(type==='teeth'&&value&&!value.split(/[\s,]+/).every(n=>/^[1-8][1-8]$/.test(n)&&(+n[0]<5||+n[1]<=5)))throw new Error('Use valid FDI tooth numbers');
    record[key]=value;
  }
  const full={...existing,...record};
  if(user.role==='dentist'&&full.doctorId&&full.doctorId!==user.doctorId)throw new Error('Choose your own dentist profile');
  if(section==='website'&&!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(full.slug))throw new Error('Page address needs lowercase letters, numbers and hyphens');
  if(section==='waitlist'&&(full.latestDate<full.earliestDate||full.latestTime<=full.earliestTime||full.durationMinutes<10||full.durationMinutes>180))throw new Error('Check availability dates, times and duration (10–180 minutes)');
  if(section==='labs'){
    if(full.planId){const p=await related(database,'treatmentPlans',full.planId,user.clinicId);if(p.patientId!==full.patientId)throw new Error('Plan belongs to another patient')}
    if(full.sessionId){const s=await related(database,'careSessions',full.sessionId,user.clinicId);if(s.patientId!==full.patientId||full.planId&&s.planId!==full.planId)throw new Error('Session does not match this patient / plan')}
  }
  return record;
}
export async function audit(database,user,section,recordId,action,session) {
  await database.collection('auditLogs').insertOne({clinicId:user.clinicId,actorId:String(user._id),module:section,recordId:String(recordId),action,createdAt:new Date()},{session});
}
