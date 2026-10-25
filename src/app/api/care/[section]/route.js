import { ObjectId } from 'mongodb';
import { randomBytes,createHash } from 'node:crypto';
import { currentUser,sameOrigin } from '@/lib/auth';
import { db,ensureIndexes } from '@/lib/db';
import { fail,ok } from '@/lib/http';
import { writeBlock } from '@/lib/clinic-access';
import { careAllowed,careIndexes,cleanCare,related,audit } from '@/lib/care';
import { careCollections,clinicalRoles,teamRoles } from '@/lib/care-schema';
import { medications,money,today,matchesSlot,minutes } from '@/lib/care-validation.mjs';
import { enqueue,queueReminders,publicMessagingSettings,saveMessagingSettings,dispatchPendingNotifications,dispatchSingleNotification } from '@/lib/messaging';
import { createOrConnectInstance, disconnectInstance, getLiveConnection, sendEvolutionText } from '@/lib/evolution';

const viewExtras=['insights','portal','automation'];
export async function GET(request,{params}) {
  const user=await currentUser(),{section}=await params;
  if(!user?.clinicId||!teamRoles.includes(user.role)||(!careAllowed(section,user)&&!viewExtras.includes(section)))return fail('Unauthorized',403);
  const database=await db(),q={clinicId:user.clinicId};
  const recordId=new URL(request.url).searchParams.get('record');if(recordId&&!/^[a-f\d]{24}$/i.test(recordId))return fail('Invalid record');
  if(section==='automation'){
    if(user.role!=='clinic_admin')return fail('Admin access required',403);
    const settings=await publicMessagingSettings(user.clinicId);
    return ok({settings});
  }
  const [patients,doctors,services,plans,sessions,appointments,payments,labs]=await Promise.all([
    database.collection('patients').find(q,{projection:{name:1,phone:1,whatsappConsent:1,preferredLanguage:1}}).sort({name:1}).toArray(),
    database.collection('doctors').find(q,{projection:{name:1,consultationFee:1}}).toArray(),
    database.collection('services').find(q,{projection:{name:1,standardFee:1}}).toArray(),
    database.collection('treatmentPlans').find(q).sort({createdAt:-1}).toArray(),
    database.collection('careSessions').find(q).sort({scheduledDate:1}).toArray(),
    database.collection('appointments').find({...q,deletedAt:{$exists:false},appointmentDate:{$gte:today()}}).sort({appointmentDate:1,startsAt:1}).limit(300).toArray(),
    database.collection('payments').find(q,{projection:{amount:1,sessionId:1,invoiceId:1}}).toArray(),
    database.collection('labCases').find(q).toArray()
  ]);
  const invoices=await database.collection('invoices').find(q,{projection:{invoiceNumber:1,patientId:1,paidAmount:1,balanceAmount:1,totalAmount:1}}).toArray();
  const enrichedPlans=plans.map(p=>({...p,invoice:invoices.find(i=>String(i._id)===p.invoiceId)}));
  const enrichedSessions=sessions.map(s=>({...s,paidAmount:money(payments.filter(p=>p.sessionId===String(s._id)).reduce((n,p)=>n+p.amount,0)),labReady:!labs.some(l=>l.sessionId===String(s._id)&&!['received','fitted','cancelled'].includes(l.status))}));
  const options={patients,doctors,services,plans:enrichedPlans,sessions:enrichedSessions,appointments,invoices};
  if(section==='insights'){
    if(user.role!=='clinic_admin')return fail('Admin access required',403);
    const waiting=await database.collection('waitingList').countDocuments({...q,status:'waiting'});
    const rows=enrichedPlans.map(p=>{const planSessions=enrichedSessions.filter(s=>s.planId===String(p._id));const labCost=labs.filter(l=>l.planId===String(p._id)&&l.status!=='cancelled').reduce((s,l)=>s+Number(l.cost||0),0);return {...p,sessionCount:planSessions.length,completed:planSessions.filter(s=>s.status==='completed').length,overdue:planSessions.some(s=>s.scheduledDate<today()&&!['completed','cancelled'].includes(s.status)),labCost,recordedCosts:Number(p.materialCost||0)+Number(p.providerCost||0)+labCost,netCollected:Number(p.invoice?.paidAmount||0)-Number(p.materialCost||0)-Number(p.providerCost||0)-labCost}});
    return ok({records:rows,options,waiting,labAlerts:labs.filter(l=>!['received','fitted','cancelled'].includes(l.status)&&l.dueDate<=today()).length});
  }
  if(section==='portal')return ok({options,records:await database.collection('portalAccess').find(q,{projection:{tokenHash:0}}).sort({createdAt:-1}).limit(100).toArray()});
  let records=section==='plans'?enrichedPlans:section==='sessions'?enrichedSessions:section==='labs'?labs:await database.collection(careCollections[section]).find({...q,...(recordId?{_id:new ObjectId(recordId)}:{})}).sort({createdAt:-1}).limit(300).toArray();
  if(user.role==='dentist'&&['plans','sessions','prescriptions'].includes(section))records=records.filter(x=>x.doctorId===user.doctorId);
  if(section==='waitlist'){
    records=records.map(w=>({...w,matches:appointments.filter(a=>a.status==='cancelled'&&matchesSlot(w,a,minutes(a.endsAt)-minutes(a.startsAt))).slice(0,5)}));
    return ok({records,options,offers:await database.collection('waitingOffers').find(q).sort({createdAt:-1}).limit(50).toArray()});
  }
  const clinic=section==='website'?await database.collection('clinics').findOne({_id:new ObjectId(user.clinicId)},{projection:{slug:1}}):null;
  const prescriptionTemplates=section==='prescriptions'?await database.collection('prescriptionTemplates').find(q).sort({name:1}).toArray():[];
  return ok({records,options,clinicSlug:clinic?.slug,prescriptionTemplates});
}
export async function POST(request,{params}) {
  if(!sameOrigin(request))return fail('Invalid request origin',403);
  const user=await currentUser(),{section}=await params;
  if(!user?.clinicId||!teamRoles.includes(user.role))return fail('Unauthorized',403);
  const block=await writeBlock(user);if(block)return fail(block,403);
  const body=await request.json().catch(()=>({})),database=await db(),q={clinicId:user.clinicId};
  try{
    await careIndexes(database);
    if(section==='automation'){
      if(user.role!=='clinic_admin')return fail('Admin access required',403);
      if(body.action==='configure'){await saveMessagingSettings(user.clinicId,body);return ok({success:true})}
      if(body.action==='queue'){return ok(await queueReminders(user.clinicId,false))}
      if(body.action==='connect'){
        const res=await createOrConnectInstance({instanceName:body.instanceName,number:body.number});
        if(body.instanceName)await saveMessagingSettings(user.clinicId,{instanceName:body.instanceName});
        return ok(res);
      }
      if(body.action==='disconnect'){
        const res=await disconnectInstance(body.instanceName);
        return ok(res);
      }
      if(body.action==='status'){
        const live=await getLiveConnection(body.instanceName);
        return ok(live);
      }
      if(body.action==='dispatch-pending'){
        const res=await dispatchPendingNotifications(user.clinicId);
        return ok(res);
      }
      if(body.action==='send-single'){
        const res=await dispatchSingleNotification(body.id,user.clinicId);
        return ok(res);
      }
      if(body.action==='send-test'){
        const res=await sendEvolutionText(body.number,body.text||'Hello from Dental Care Clinic! WhatsApp automation is connected and live.',body.instanceName);
        return ok({success:true,res});
      }
      throw new Error('Unknown action');
    }
    if(section==='portal'){
      const patient=await related(database,'patients',body.patientId,user.clinicId);
      if(body.action==='revoke'){await database.collection('portalAccess').deleteMany({...q,patientId:String(patient._id)});await audit(database,user,'portal',patient._id,'revoke');return ok({success:true})}
      if(body.action!=='create')throw new Error('Unknown portal action');
      const token=randomBytes(32).toString('hex'),expiresAt=new Date(Date.now()+7*86400000);
      await database.collection('portalAccess').insertOne({...q,patientId:String(patient._id),tokenHash:createHash('sha256').update(token).digest('hex'),expiresAt,createdAt:new Date()});
      await audit(database,user,'portal',patient._id,'create');
      return ok({link:`${new URL(request.url).origin}/patient-portal#${token}`,expiresAt});
    }
    if(!careAllowed(section,user,true))return fail('Not allowed for your role',403);
    if(section==='prescriptions'&&body.action==='save-template'){
      const name=String(body.templateName||'').trim().slice(0,100);if(!name)throw new Error('Enter a template name');
      await database.collection('prescriptionTemplates').insertOne({...q,name,medications:medications(body.medications),language:['english','urdu','bilingual'].includes(body.language)?body.language:'bilingual',instructionsEn:String(body.instructionsEn||'').slice(0,12000),instructionsUr:String(body.instructionsUr||'').slice(0,12000),createdAt:new Date()});
      return ok({success:true},201);
    }
    const collection=database.collection(careCollections[section]);
    const existing=body.id?await related(database,careCollections[section],body.id,user.clinicId):null;
    if(existing&&user.role==='dentist'&&existing.doctorId&&existing.doctorId!==user.doctorId)throw new Error('Record belongs to another dentist');
    const action=body.action||'save';
    if(action==='save'){
      if(existing&&body.version!==undefined&&body.version!==existing.version)throw new Error('This record changed since you opened it. Refresh before editing.');
      if(existing&&section==='prescriptions'&&existing.status==='issued')throw new Error('Issued prescription is read-only. Create a revision.');
      const record=await cleanCare(section,body,user,existing);
      if(section==='prescriptions'){record.medications=medications(body.medications);record.status='draft'}
      if(section==='sessions'){
        if(existing&&['patientId','doctorId','amountDue'].some(k=>String(record[k]??existing[k])!==String(existing[k])))throw new Error('Patient, dentist and fee cannot change after invoicing');
        if(record.appointmentId){
          const a=await related(database,'appointments',record.appointmentId,user.clinicId);
          if(a.patientId!==(record.patientId||existing?.patientId)||a.doctorId!==(record.doctorId||existing?.doctorId)||a.appointmentDate!==(record.scheduledDate||existing?.scheduledDate))throw new Error('Appointment must match patient, dentist and session date');
        }
        if(existing&&existing.status==='completed')throw new Error('Completed sessions cannot be edited');
      }
      if(section==='plans'&&existing?.invoiceId&&['totalFee','patientId','doctorId','title'].some(k=>k in record&&record[k]!==existing[k]))throw new Error('Accepted plan identity and agreed fee are locked');
      if(section==='labs'&&existing&&['patientId','planId','sessionId'].some(k=>k in record&&record[k]!==existing[k]))throw new Error('Lab case links cannot be changed');
      const session=database.client.startSession();let recordId;
      try{await session.withTransaction(async()=>{
        if(existing){
          const update=await collection.updateOne({...q,_id:existing._id,version:existing.version??0},{$set:{...record,updatedAt:new Date()},$inc:{version:1}},{session});
          if(!update.modifiedCount)throw new Error('Record changed. Refresh before saving.');
          recordId=existing._id;
        } else {
          if(section==='sessions'){
            const invoiceId=new ObjectId();
            record.invoiceId=String(invoiceId);
            await database.collection('invoices').insertOne({_id:invoiceId,...q,patientId:record.patientId,doctorId:record.doctorId,feeType:'treatment',invoiceNumber:`INV-${Date.now()}-${randomBytes(3).toString('hex')}`,description:record.title,items:[{description:record.title,quantity:1,unitPrice:record.amountDue,totalPrice:record.amountDue}],discountAmount:0,totalAmount:record.amountDue,paidAmount:0,balanceAmount:record.amountDue,status:record.amountDue?'unpaid':'paid',createdAt:new Date()},{session});
          }
          const status={plans:'draft',sessions:'planned',prescriptions:'draft',labs:'ordered',waitlist:'waiting',website:'draft'}[section];
          const inserted=await collection.insertOne({...record,...q,status,version:0,createdAt:new Date(),updatedAt:new Date()},{session});recordId=inserted.insertedId;
        }
        await audit(database,user,section,recordId,existing?'edit':'create',session);
      })}finally{await session.endSession()}
      return ok({id:String(recordId)},existing?200:201);
    }
    if(!existing)throw new Error('Record not found');
    if(section==='plans'&&action==='accept'){
      if(!clinicalRoles.includes(user.role))throw new Error('Dentist approval required');
      const session=database.client.startSession();
      try{await session.withTransaction(async()=>{
        const changed=await collection.findOneAndUpdate({...q,_id:existing._id,status:'draft'},{$set:{status:'accepted',allocatedFee:0,acceptedAt:new Date()},$inc:{version:1}},{session,returnDocument:'after'});
        if(!changed)throw new Error('Plan is already accepted');
        const invoiceId=new ObjectId();
        await database.collection('invoices').insertOne({_id:invoiceId,...q,patientId:existing.patientId,doctorId:existing.doctorId,planId:String(existing._id),feeType:'treatment',invoiceNumber:`INV-${Date.now()}-${randomBytes(3).toString('hex')}`,description:existing.title,items:[{description:existing.title,quantity:1,unitPrice:existing.totalFee,totalPrice:existing.totalFee}],discountAmount:0,totalAmount:existing.totalFee,paidAmount:0,balanceAmount:existing.totalFee,status:existing.totalFee?'unpaid':'paid',createdAt:new Date()},{session});
        await collection.updateOne({_id:existing._id},{$set:{invoiceId:String(invoiceId)}},{session});
        await audit(database,user,section,existing._id,'accept-and-invoice',session);
      })}finally{await session.endSession()}
      return ok({success:true});
    }
    if(section==='plans'&&action==='costs'){
      if(user.role!=='clinic_admin')throw new Error('Only clinic admin can record costs');
      await collection.updateOne({...q,_id:existing._id},{$set:{materialCost:money(body.materialCost),providerCost:money(body.providerCost)},$inc:{version:1}});
      await audit(database,user,section,existing._id,'costs');return ok({success:true});
    }
    if(section==='prescriptions'&&action==='revise'){
      if(existing.status!=='issued')throw new Error('Only issued prescriptions need a revision');
      const {_id,issuedAt,...copy}=existing;const inserted=await collection.insertOne({...copy,status:'draft',revisionOf:String(_id),revision:Number(existing.revision||1)+1,version:0,createdAt:new Date(),updatedAt:new Date()});
      await audit(database,user,section,inserted.insertedId,'revision');return ok({id:String(inserted.insertedId)});
    }
    if(section==='prescriptions'&&action==='issue'){
      if(!clinicalRoles.includes(user.role)||body.confirmed!==true)throw new Error('Review all medicine details and confirm issuance');
      medications(existing.medications);
      const changed=await collection.updateOne({...q,_id:existing._id,status:'draft'},{$set:{status:'issued',issuedAt:new Date(),issuedBy:String(user._id)},$inc:{version:1}});
      if(!changed.modifiedCount)throw new Error('Prescription is already issued');
      await audit(database,user,section,existing._id,'issue');
      return ok({success:true});
    }
    if(section==='website'&&['publish','unpublish'].includes(action)){
      const {_id,published,status,version,...snapshot}=existing;
      await collection.updateOne({...q,_id:existing._id},{$set:{status:action==='publish'?'published':'draft',published:action==='publish'?{...snapshot,publishedAt:new Date()}:null},$inc:{version:1}});
      await audit(database,user,section,existing._id,action);return ok({success:true});
    }
    if(section==='waitlist'&&action==='offer'){
      await ensureIndexes();
      const slot=await related(database,'appointments',body.appointmentId,user.clinicId);
      if(slot.status!=='cancelled'||slot.appointmentDate<today()||!matchesSlot(existing,slot,minutes(slot.endsAt)-minutes(slot.startsAt)))throw new Error('This slot no longer matches the waiting patient');
      const occupied=await database.collection('appointments').findOne({...q,doctorId:slot.doctorId,appointmentDate:slot.appointmentDate,startsAt:slot.startsAt,status:{$ne:'cancelled'}});
      if(occupied)throw new Error('Slot is already booked');
      await database.collection('waitingOffers').updateOne({...q,waitingId:String(existing._id),appointmentId:String(slot._id)},{$set:{patientId:existing.patientId,doctorId:slot.doctorId,appointmentDate:slot.appointmentDate,startsAt:slot.startsAt,endsAt:slot.endsAt,serviceId:existing.serviceId||'',status:'offered',expiresAt:new Date(Date.now()+12*3600000),createdAt:new Date()}},{upsert:true});
      await enqueue({clinicId:user.clinicId,patientId:existing.patientId,type:'waitlist_offer',eventKey:`offer:${existing._id}:${slot._id}`,values:[slot.appointmentDate,slot.startsAt]});
      return ok({success:true});
    }
    const allowed={plans:['completed','declined'],sessions:['scheduled','completed','cancelled'],labs:['ordered','in_progress','received','fitted','remake','cancelled'],waitlist:['waiting','cancelled']};
    if(action==='status'&&allowed[section]?.includes(body.status)){
      if(section==='plans'&&body.status==='completed'&&!['accepted','in_progress'].includes(existing.status))throw new Error('Only an accepted treatment plan can be completed');
      if(section==='sessions'&&body.status==='completed'){
        if(!clinicalRoles.includes(user.role))throw new Error('Only a dentist or clinic admin can complete a clinical session');
        if(await database.collection('labCases').findOne({...q,sessionId:String(existing._id),status:{$nin:['received','fitted','cancelled']}}))throw new Error('Receive the linked lab work before completing this session');
      }
      if(section==='plans'&&body.status==='completed'&&await database.collection('careSessions').findOne({...q,planId:String(existing._id),status:{$nin:['completed','cancelled']}}))throw new Error('Complete or cancel remaining sessions first');
      if(section==='plans'&&body.status==='declined'&&existing.invoiceId)throw new Error('An accepted financial plan cannot be declined');
      if(section==='sessions'&&existing.status==='completed')throw new Error('Completed sessions are locked');
      await collection.updateOne({...q,_id:existing._id},{$set:{status:body.status,updatedAt:new Date()},$inc:{version:1},$push:{statusHistory:{status:body.status,at:new Date(),actorId:String(user._id)}}});
      await audit(database,user,section,existing._id,body.status);
      return ok({success:true});
    }
    throw new Error('Unsupported action');
  }catch(e){const message=e.code===11000?'This record already exists':e.message;return fail(message,section==='automation'&&/provider rejected|provider is unavailable/i.test(message)?502:section==='automation'&&/provider is not configured/i.test(message)?503:400)}
}
