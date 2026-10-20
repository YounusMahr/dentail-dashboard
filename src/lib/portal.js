import { createHash } from 'node:crypto';
import { db } from './db';
import { ObjectId } from 'mongodb';
export async function portalContext(request){
  const token=request.headers.get('authorization')?.replace(/^Bearer /,'');
  if(!token||!/^[a-f0-9]{64}$/.test(token))return null;
  const database=await db(),access=await database.collection('portalAccess').findOne({tokenHash:createHash('sha256').update(token).digest('hex'),expiresAt:{$gt:new Date()}});
  if(!access)return null;
  const [patient,clinic]=await Promise.all([database.collection('patients').findOne({_id:new ObjectId(access.patientId),clinicId:access.clinicId},{projection:{name:1,whatsappConsent:1}}),database.collection('clinics').findOne({_id:new ObjectId(access.clinicId),status:'active'},{projection:{name:1,phone:1,slug:1,address:1}})]);
  return patient&&clinic?{database,access,patient,clinic,q:{clinicId:access.clinicId,patientId:access.patientId}}:null;
}
