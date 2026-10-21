import { ObjectId } from 'mongodb';
import { portalContext } from '@/lib/portal';
import { ok,fail } from '@/lib/http';
import { sameOrigin } from '@/lib/auth';
import { ensureIndexes } from '@/lib/db';
import { cleanRecord } from '@/lib/records';
import { related } from '@/lib/care';
import { prescriptionHtml } from '@/lib/prescription-print';
import { printPage,escapeHtml as e } from '@/lib/print';
import { today } from '@/lib/care-validation.mjs';
import { writeBlock } from '@/lib/clinic-access';
export async function GET(request){
  const ctx=await portalContext(request);if(!ctx)return fail('This access link has expired or was revoked. Ask your clinic for a new link.',401);
  const {database,q,patient,clinic}=ctx,query=new URL(request.url).searchParams;
  if(query.has('print')){
    if(!ObjectId.isValid(query.get('id')||''))return fail('Not found',404);
    const type=query.get('print');let html;
    if(type==='prescription'){
      const record=await database.collection('prescriptions').findOne({...q,_id:new ObjectId(query.get('id')),status:'issued'});if(!record)return fail('Not found',404);
      const doctor=await related(database,'doctors',record.doctorId,q.clinicId);html=prescriptionHtml(record,patient,doctor,clinic);
    }else if(type==='receipt'){
      const payment=await database.collection('payments').findOne({...q,_id:new ObjectId(query.get('id'))});if(!payment)return fail('Not found',404);
      html=printPage('Payment receipt',`<h1>${e(clinic.name)}</h1><h2>Payment receipt</h2><p>Patient: ${e(patient.name)}</p><p>Receipt: ${e(payment._id)}</p><p>Date: ${e(payment.createdAt?.toISOString().slice(0,10))}</p><h2>PKR ${e(payment.amount)}</h2><p>Method: ${e(payment.paymentMethod)}</p>`);
    }else return fail('Unknown document');
    return new Response(html,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store'}});
  }
  const [plans,sessions,invoices,appointments,prescriptions,payments,offers]=await Promise.all([
    database.collection('treatmentPlans').find({...q,status:{$nin:['draft','declined']}},{projection:{title:1,summary:1,aftercare:1,toothNumbers:1,status:1,totalFee:1,nextReviewDate:1}}).toArray(),
    database.collection('careSessions').find(q,{projection:{planId:1,title:1,scheduledDate:1,status:1,amountDue:1}}).sort({scheduledDate:1}).toArray(),
    database.collection('invoices').find(q,{projection:{invoiceNumber:1,totalAmount:1,paidAmount:1,balanceAmount:1,feeType:1,status:1}}).toArray(),
    database.collection('appointments').find(q,{projection:{appointmentDate:1,startsAt:1,doctorId:1,status:1}}).sort({appointmentDate:-1}).limit(100).toArray(),
    database.collection('prescriptions').find({...q,status:'issued'},{projection:{createdAt:1,issuedAt:1,revision:1,revisionOf:1,doctorId:1}}).sort({issuedAt:-1}).toArray(),
    database.collection('payments').find(q,{projection:{amount:1,createdAt:1,paymentMethod:1,sessionId:1,invoiceId:1}}).sort({createdAt:-1}).toArray(),
    database.collection('waitingOffers').find({...q,status:'offered',expiresAt:{$gt:new Date()}}).toArray()
  ]);
  return ok({patient,clinic,plans,sessions,invoices,appointments,prescriptions,payments,offers,expiresAt:ctx.access.expiresAt});
}
export async function POST(request){
  if(!sameOrigin(request))return fail('Invalid origin',403);
  const ctx=await portalContext(request);if(!ctx)return fail('Access link expired or revoked',401);
  const {database,q}=ctx,body=await request.json().catch(()=>({}));
  const block=await writeBlock({clinicId:q.clinicId});if(block)return fail(block,403);
  try{
    if(body.action==='optout'){await database.collection('patients').updateOne({_id:new ObjectId(q.patientId),clinicId:q.clinicId},{$set:{whatsappConsent:false,whatsappOptedOutAt:new Date()}});return ok({success:true})}
    if(!ObjectId.isValid(body.id||''))throw new Error('Invalid record');
    const actor={clinicId:q.clinicId,role:'receptionist',_id:`patient:${q.patientId}`};
    await ensureIndexes();
    const session=database.client.startSession();
    try{await session.withTransaction(async()=>{
      if(body.action==='accept-offer'){
        const offer=await database.collection('waitingOffers').findOneAndUpdate({...q,_id:new ObjectId(body.id),status:'offered',expiresAt:{$gt:new Date()}},{$set:{status:'accepted',acceptedAt:new Date()}},{session,returnDocument:'after'});
        if(!offer||new Date(`${offer.appointmentDate}T${offer.startsAt}:00+05:00`)<=new Date())throw new Error('This offer has expired');
        const waiting=await database.collection('waitingList').updateOne({...q,_id:new ObjectId(offer.waitingId),status:'waiting'},{$set:{status:'booked'}},{session});if(!waiting.modifiedCount)throw new Error('Waiting-list request is no longer available');
        const record=await cleanRecord('appointments',{patientId:q.patientId,doctorId:offer.doctorId,serviceId:offer.serviceId,appointmentDate:offer.appointmentDate,startsAt:offer.startsAt,status:'confirmed'},actor);
        await database.collection('appointments').insertOne({...record,...q,createdAt:new Date()},{session});
      }else if(['cancel','confirm','reschedule'].includes(body.action)){
        const appointment=await database.collection('appointments').findOne({...q,_id:new ObjectId(body.id),status:{$in:['pending','confirmed']},appointmentDate:{$gte:today()}},{session});
        if(!appointment)throw new Error('This appointment can no longer be changed online');
        let changes={status:body.action==='cancel'?'cancelled':'confirmed'};
        if(body.action==='reschedule'){if(new Date(`${body.appointmentDate}T${body.startsAt}:00+05:00`)<=new Date())throw new Error('Choose a future date');changes=await cleanRecord('appointments',{appointmentDate:body.appointmentDate,startsAt:body.startsAt,status:'confirmed'},actor,appointment)}
        await database.collection('appointments').updateOne({...q,_id:appointment._id},{$set:{...changes,updatedAt:new Date()}},{session});
        if(body.action==='reschedule')await database.collection('careSessions').updateMany({...q,appointmentId:body.id,status:{$in:['planned','scheduled']}},{$set:{scheduledDate:body.appointmentDate}},{session});
        if(body.action==='cancel')await database.collection('careSessions').updateMany({...q,appointmentId:body.id,status:{$in:['planned','scheduled']}},{$set:{status:'planned',appointmentId:''}},{session});
      }else throw new Error('Unknown action');
      await database.collection('auditLogs').insertOne({...q,actorId:actor._id,module:'patient-portal',recordId:body.id,action:body.action,createdAt:new Date()},{session});
    })}finally{await session.endSession()}
    return ok({success:true});
  }catch(e){return fail(e.code===11000?'This slot has just been booked. Please choose another time.':e.message,409)}
}
