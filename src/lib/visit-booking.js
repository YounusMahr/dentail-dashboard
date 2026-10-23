import {ObjectId} from 'mongodb';
import {db, ensureIndexes} from './db';
import {cleanRecord} from './records';
import {pakistanMobile} from './pakistan-phone.mjs';
import {enqueue,dispatchSingleNotification} from './messaging';
import {queueEmail,dispatchEmailOutbox} from './email-notifications';
import {after} from 'next/server';

// One booking owns one initial visit, invoice and editable prescription pad.
export async function bookVisit(input, user, {publicBooking=false}={}) {
  const database=await db();
  await ensureIndexes();
  const clinic=await database.collection('clinics').findOne({_id:new ObjectId(user.clinicId)});
  if(!clinic)throw new Error('Clinic not found');
  const session=database.client.startSession();
  let result;
  try{
    await session.withTransaction(async()=>{
      const now=new Date();
      let patientId, isNew=false;
      if(input.patientMode==='new'||publicBooking){
        const details=input.newPatient||{};
        const phone=pakistanMobile(details.phone);
        const existing=await database.collection('patients').findOne({clinicId:user.clinicId,phone},{session});
        if(existing){
          if(!publicBooking)throw new Error('This phone number already has a patient file. Choose Existing patient file.');
          patientId=String(existing._id);
        }else{
          const patient=await cleanRecord('patients',{name:details.name,phone,email:details.email||'',whatsappConsent:details.whatsappConsent===true,emailConsent:details.emailConsent===true,marketingConsent:details.marketingConsent===true,preferredLanguage:details.preferredLanguage==='ur'?'ur':'en'},user,null,{session,skipIndexes:true});
          const id=new ObjectId();
          await database.collection('patients').insertOne({_id:id,...patient,clinicId:user.clinicId,createdAt:now,updatedAt:now},{session});
          patientId=String(id);isNew=true;
        }
      }else{
        patientId=String(input.patientId||'');
        if(!ObjectId.isValid(patientId)||!await database.collection('patients').findOne({_id:new ObjectId(patientId),clinicId:user.clinicId},{session}))throw new Error('Choose a patient');
      }
      const appointment=await cleanRecord('appointments',{...input,patientId},user,null,{session,skipIndexes:true});
      const appointmentId=new ObjectId();
      await database.collection('appointments').insertOne({_id:appointmentId,...appointment,clinicId:user.clinicId,createdAt:now,updatedAt:now},{session});
      const service=appointment.serviceId?await database.collection('services').findOne({_id:new ObjectId(appointment.serviceId),clinicId:user.clinicId},{session}):null;
      if(appointment.serviceId&&(!service||service.active===false))throw new Error('Choose an active service');
      const checkupFee=Number(clinic.newPatientCheckupFee??500);
      const items=[];
      if(service)items.push({serviceId:String(service._id),description:service.name,quantity:1,unitPrice:Number(service.standardFee)});
      if(!service||isNew&&service.includesCheckup!==true)items.push({description:isNew?'New patient dental checkup':'Dental checkup',quantity:1,unitPrice:checkupFee});
      if(!items.length)throw new Error('No fee is configured for this visit');
      const invoice=await cleanRecord('invoices',{patientId,doctorId:appointment.doctorId,feeType:service?'treatment':'checkup',items,dueDate:appointment.appointmentDate},user,null,{session,skipIndexes:true});
      const invoiceId=new ObjectId(),visitSessionId=new ObjectId(),prescriptionId=new ObjectId();
      await database.collection('invoices').insertOne({_id:invoiceId,...invoice,clinicId:user.clinicId,appointmentId:String(appointmentId),visitInvoiceKey:String(appointmentId),createdAt:now,updatedAt:now},{session});
      await database.collection('visitSessions').insertOne({_id:visitSessionId,clinicId:user.clinicId,appointmentId:String(appointmentId),patientId,doctorId:appointment.doctorId,serviceId:appointment.serviceId||'',invoiceId:String(invoiceId),scheduledDate:appointment.appointmentDate,startsAt:appointment.startsAt,status:'scheduled',createdAt:now,updatedAt:now},{session});
      await database.collection('prescriptions').insertOne({_id:prescriptionId,clinicId:user.clinicId,appointmentId:String(appointmentId),patientId,doctorId:appointment.doctorId,language:'bilingual',diagnosis:'',instructionsEn:'',instructionsUr:'',medications:[],status:'draft',revision:1,createdAt:now,updatedAt:now},{session});
      result={id:String(appointmentId),patientId,invoiceId:String(invoiceId),visitSessionId:String(visitSessionId),prescriptionId:String(prescriptionId),newPatient:isNew,appointment};
    });
  }finally{await session.endSession()}
  try{
    const outboxId=await enqueue({clinicId:user.clinicId,patientId:result.patientId,type:'appointment_confirmation',eventKey:`booking:${result.id}:${result.appointment.appointmentDate}:${result.appointment.startsAt}`,values:[result.appointment.appointmentDate,result.appointment.startsAt],sourceCollection:'appointments',sourceId:result.id,sourceFingerprint:`${result.appointment.appointmentDate} ${result.appointment.startsAt}`});
    if(outboxId)after(async()=>{try{await dispatchSingleNotification(outboxId,user.clinicId)}catch(error){console.error('WhatsApp booking confirmation failed:',error.message)}});
  }catch{console.error('Booking saved; notification will be recovered by scheduler')}
  try{if(await queueEmail({clinicId:user.clinicId,patientId:result.patientId,type:'appointment_confirmation',eventKey:`booking:${result.id}:${result.appointment.appointmentDate}:${result.appointment.startsAt}`,details:[`Date: ${result.appointment.appointmentDate}`,`Time: ${result.appointment.startsAt}`],sourceId:result.id}))after(async()=>{try{await dispatchEmailOutbox(user.clinicId)}catch(error){console.error('Booking email failed:',error.message)}})}catch{console.error('Booking saved; email will be recovered by scheduler')}
  const {appointment,...response}=result;
  return response;
}
