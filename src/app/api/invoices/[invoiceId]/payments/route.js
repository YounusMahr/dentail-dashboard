import { ObjectId } from 'mongodb';
import { currentUser, sameOrigin } from '@/lib/auth';
import { db } from '@/lib/db';
import { fail, id, ok } from '@/lib/http';
import { writeBlock } from '@/lib/clinic-access';
import { careIndexes } from '@/lib/care';
import { money } from '@/lib/care-validation.mjs';
import { enqueue, dispatchSingleNotification } from '@/lib/messaging';
import { queueEmail, dispatchEmailOutbox } from '@/lib/email-notifications';
export async function GET(request,{params}){
 const user=await currentUser(),invoiceId=(await params).invoiceId;if(!user?.clinicId||!id(invoiceId))return fail('Unauthorized',401);
 const database=await db(),invoice=await database.collection('invoices').findOne({_id:new ObjectId(invoiceId),clinicId:user.clinicId});if(!invoice)return fail('Invoice not found',404);
 return ok({invoice,payments:await database.collection('payments').find({clinicId:user.clinicId,invoiceId}).sort({createdAt:-1}).toArray()});
}
export async function POST(request,{params}){
 const user=await currentUser(),invoiceId=(await params).invoiceId;
 if(!sameOrigin(request)||!['clinic_admin','receptionist'].includes(user?.role)||!id(invoiceId))return fail('Unauthorized',403);
 const block=await writeBlock(user);if(block)return fail(block,403);
 const body=await request.json().catch(()=>({})),method=String(body.paymentMethod||'cash'),sessionId=body.sessionId||null;
 let amount;try{amount=money(body.amount)}catch(e){return fail(e.message)}
 if(!(amount>0)||!['cash','card','bank_transfer','easypaisa_jazzcash'].includes(method)||sessionId&&!id(sessionId))return fail('Invalid payment');
 const idempotencyKey=String(body.idempotencyKey||'');if(idempotencyKey&&!/^[a-zA-Z0-9-]{16,100}$/.test(idempotencyKey))return fail('Invalid payment request key');
 const database=await db();await careIndexes(database);
 const session=database.client.startSession();let invoice,paymentId,replayed=false;
 try{await session.withTransaction(async()=>{
  if(idempotencyKey){const previous=await database.collection('payments').findOne({clinicId:user.clinicId,idempotencyKey},{session});if(previous){if(previous.invoiceId!==invoiceId||previous.amount!==amount||(previous.sessionId||null)!==sessionId||previous.paymentMethod!==method)throw new Error('Payment key was used for a different payment');invoice=await database.collection('invoices').findOne({_id:new ObjectId(invoiceId),clinicId:user.clinicId},{session});paymentId=previous._id;replayed=true;return}}
  invoice=await database.collection('invoices').findOneAndUpdate({_id:new ObjectId(invoiceId),clinicId:user.clinicId,status:{$ne:'cancelled'},balanceAmount:{$gte:amount}},[
    {$set:{paidAmount:{$round:[{$add:['$paidAmount',amount]},2]},balanceAmount:{$round:[{$subtract:['$balanceAmount',amount]},2]}}},
    {$set:{status:{$cond:[{$lte:['$balanceAmount',0]},'paid','partially_paid']},updatedAt:new Date()}}
  ],{returnDocument:'after',session});if(!invoice)throw new Error('Invoice missing or payment exceeds remaining balance');
  if(sessionId){const visit=await database.collection('careSessions').findOne({_id:new ObjectId(sessionId),clinicId:user.clinicId,invoiceId,status:{$ne:'cancelled'}},{session});if(!visit)throw new Error('Session does not belong to this invoice');const paid=await database.collection('payments').find({clinicId:user.clinicId,sessionId},{session}).toArray();if(money(paid.reduce((n,p)=>n+p.amount,0)+amount)>visit.amountDue)throw new Error('Payment exceeds this session fee allocation')}
  paymentId=new ObjectId();await database.collection('payments').insertOne({_id:paymentId,clinicId:user.clinicId,invoiceId,patientId:invoice.patientId,sessionId,receivedByUserId:String(user._id),amount,paymentMethod:method,transactionReference:String(body.transactionReference||'').slice(0,100),...(idempotencyKey?{idempotencyKey}:{}),createdAt:new Date()},{session});
  await database.collection('auditLogs').insertOne({clinicId:user.clinicId,module:'payments',recordId:invoiceId,actorId:String(user._id),amount,sessionId,createdAt:new Date()},{session});
 })}catch(e){return fail(e.code===11000?'Payment already recorded; refresh before retrying':e.message,409)}finally{await session.endSession()}
 if(!replayed&&paymentId&&invoice?.patientId){
  const eventKey=`payment:${paymentId}`;
  try{
    await Promise.allSettled([
      enqueue({clinicId:user.clinicId,patientId:invoice.patientId,type:'payment_receipt',eventKey,values:[`Receipt ${invoice.invoiceNumber||String(paymentId).slice(-8).toUpperCase()}`,`Rs ${Number(amount).toLocaleString('en-PK')}`,`Balance Rs ${Number(invoice.balanceAmount||0).toLocaleString('en-PK')}`],sourceCollection:'payments',sourceId:String(paymentId)}),
      queueEmail({clinicId:user.clinicId,patientId:invoice.patientId,type:'payment_receipt',eventKey,details:[`Receipt: ${invoice.invoiceNumber||String(paymentId).slice(-8).toUpperCase()}`,`Amount received: Rs ${Number(amount).toLocaleString('en-PK')}`,`Remaining balance: Rs ${Number(invoice.balanceAmount||0).toLocaleString('en-PK')}`],sourceId:String(paymentId)})
    ]);
    const [whatsDoc,emailDoc]=await Promise.all([
      database.collection('notificationOutbox').findOne({clinicId:user.clinicId,eventKey}),
      database.collection('emailOutbox').findOne({clinicId:user.clinicId,eventKey})
    ]);
    Promise.allSettled([
      whatsDoc&&whatsDoc.status!=='sent'?dispatchSingleNotification(whatsDoc._id,user.clinicId):Promise.resolve(),
      emailDoc&&emailDoc.status!=='sent'?dispatchEmailOutbox(user.clinicId,emailDoc._id):Promise.resolve()
    ]).catch(err=>console.error('Payment auto dispatch error:',err));
  }catch(e){console.error('Failed to queue payment receipt notification:',e)}
 }
 return ok({invoice,paymentId:String(paymentId),replayed});
}
