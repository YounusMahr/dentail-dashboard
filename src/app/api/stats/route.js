import { currentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { fail, ok } from '@/lib/http';
export async function GET() {
  const user = await currentUser(); if(!user?.clinicId)return fail('Unauthorized',401);
  const database=await db(),q={clinicId:user.clinicId};
  const [patients,appointments,invoices,followUps,clinic]=await Promise.all([
    database.collection('patients').countDocuments(q),database.collection('appointments').countDocuments(q),database.collection('invoices').find(q).toArray(),
    database.collection('follow-ups').countDocuments({...q,status:'pending'}),database.collection('clinics').findOne({_id:new (await import('mongodb')).ObjectId(user.clinicId)})
  ]);
  return ok({patients,appointments,followUps,revenue:invoices.reduce((sum,x)=>sum+Number(x.paidAmount||0),0),outstanding:invoices.reduce((sum,x)=>sum+Number(x.balanceAmount||0),0),clinic:{name:clinic?.name,slug:clinic?.slug}});
}
