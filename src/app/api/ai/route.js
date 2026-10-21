import { ObjectId } from 'mongodb';
import { currentUser, sameOrigin } from '@/lib/auth';
import { db } from '@/lib/db';
import { writeBlock } from '@/lib/clinic-access';
import { answerClinicQuestion, AI_MODEL } from '@/lib/ai-assistant.mjs';

export const runtime='nodejs';
export const maxDuration=240;
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
const validId=id=>typeof id==='string'&&/^[a-f\d]{24}$/i.test(id);
async function access(){const user=await currentUser();return user?.role==='clinic_admin'&&user.clinicId?user:null}
export async function GET(request){
  const user=await access();if(!user)return json({error:'Clinic administrator access required'},403);
  const database=await db(),q={clinicId:user.clinicId,userId:String(user._id)},id=new URL(request.url).searchParams.get('id');
  if(id){if(!validId(id))return json({error:'Invalid chat'},400);const chat=await database.collection('aiChats').findOne({...q,_id:new ObjectId(id)},{projection:{title:1,messages:1,updatedAt:1}});return chat?json({chat}):json({error:'Chat not found'},404)}
  return json({configured:!!process.env.GROQ_API_KEY,model:AI_MODEL,chats:await database.collection('aiChats').find(q,{projection:{title:1,updatedAt:1}}).sort({updatedAt:-1}).limit(50).toArray()});
}
export async function DELETE(request){
  if(!sameOrigin(request))return json({error:'Invalid request origin'},403);
  const user=await access();if(!user)return json({error:'Clinic administrator access required'},403);
  const id=new URL(request.url).searchParams.get('id');if(!validId(id))return json({error:'Invalid chat'},400);
  const result=await (await db()).collection('aiChats').deleteOne({_id:new ObjectId(id),clinicId:user.clinicId,userId:String(user._id),$or:[{busyUntil:{$exists:false}},{busyUntil:{$lt:new Date()}}]});return result.deletedCount?json({success:true}):json({error:'Chat unavailable or still processing'},409);
}
export async function POST(request){
  if(!sameOrigin(request))return json({error:'Invalid request origin'},403);
  const user=await access();if(!user)return json({error:'Clinic administrator access required'},403);
  const block=await writeBlock(user);if(block)return json({error:block},403);
  if(!process.env.GROQ_API_KEY)return json({error:'AI is not configured on this server yet.'},503);
  const raw=await request.text();if(raw.length>10000)return json({error:'Question too long'},413);
  let body;try{body=JSON.parse(raw)}catch{return json({error:'Invalid request'},400)}
  if(typeof body.question!=='string'||!body.question.trim()||body.question.length>2000)return json({error:'Enter a question of 1–2,000 characters'},400);
  if(body.id&&!validId(body.id))return json({error:'Invalid chat'},400);
  const range={};for(const key of ['from','to'])if(body.range?.[key]){const date=body.range[key];if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)return json({error:'Invalid date filter'},400);range[key]=date}
  if(range.from&&range.to&&range.from>range.to)return json({error:'Date range is reversed'},400);
  const database=await db(),q={clinicId:user.clinicId,userId:String(user._id)},now=new Date();
  let chat=body.id?await database.collection('aiChats').findOne({...q,_id:new ObjectId(body.id)}):null;
  if(body.id&&!chat)return json({error:'Chat not found'},404);
  if((chat?.messages?.length||0)>=80)return json({error:'Start a new chat to continue.'},400);
  // One atomic, shared per-user rate counter; works across server processes.
  const bucket=String(user._id)+':'+Math.floor(Date.now()/60000);
  const usage=await database.collection('aiUsage').findOneAndUpdate({_id:bucket},{$inc:{count:1},$setOnInsert:{expiresAt:new Date(Date.now()+86400000)}},{upsert:true,returnDocument:'after'});
  await database.collection('aiUsage').createIndex({expiresAt:1},{expireAfterSeconds:0});
  if(usage.count>10)return json({error:'Please wait a minute before asking more questions.'},429);
  if(!chat){chat={...q,title:body.question.trim().slice(0,70),messages:[],createdAt:now,updatedAt:now};const inserted=await database.collection('aiChats').insertOne(chat);chat._id=inserted.insertedId}
  const lock=await database.collection('aiChats').updateOne({...q,_id:chat._id,$or:[{busyUntil:{$exists:false}},{busyUntil:{$lt:now}}]},{$set:{busyUntil:new Date(Date.now()+240000)}});
  if(!lock.modifiedCount)return json({error:'This chat is already answering a question.'},409);
  const encoder=new TextEncoder();
  return new Response(new ReadableStream({async start(controller){
    let connected=true;const emit=data=>{if(connected)try{controller.enqueue(encoder.encode(JSON.stringify(data)+'\n'))}catch{connected=false}};
    emit({type:'status',message:'Reading your question…',id:String(chat._id)});
    try{
      const answer=await answerClinicQuestion({database,clinicId:user.clinicId,history:chat.messages,question:body.question.trim(),range,onStatus:message=>emit({type:'status',message})});
      const messages=[{role:'user',content:body.question.trim(),createdAt:new Date(),range},{role:'assistant',...answer,createdAt:new Date()}];
      await database.collection('aiChats').updateOne({...q,_id:chat._id},{$push:{messages:{$each:messages}},$set:{updatedAt:new Date()},$unset:{busyUntil:''}});
      emit({type:'done',id:String(chat._id),messages});
    }catch(error){emit({type:'error',message:error.name==='TimeoutError'?'AI took too long. Please try again.':error.status||error.message?.startsWith('AI ')?error.message:'Unable to answer right now. Please try again.',id:String(chat._id)})}
    finally{await database.collection('aiChats').updateOne({...q,_id:chat._id},{$unset:{busyUntil:''}}).catch(()=>{});if(connected)controller.close()}
  }}),{headers:{'Content-Type':'application/x-ndjson','Cache-Control':'no-store','X-Accel-Buffering':'no'}});
}
