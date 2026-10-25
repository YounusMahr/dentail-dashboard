import { ObjectId } from 'mongodb';
import { db } from './db';
import { currentUser } from './auth';
import { websiteFor,websitePages } from './clinic-website.mjs';

export async function loadClinicSite(slug,preview=false){
  const database=await db(),clinic=await database.collection('clinics').findOne({slug,status:'active'});
  if(!clinic)return null;
  const clinicId=String(clinic._id);
  if(preview){const user=await currentUser();if(user?.role!=='clinic_admin'||user.clinicId!==clinicId)return null}
  const [services,doctors,extraPages,patientCount]=await Promise.all([
    database.collection('services').find({clinicId,active:{$ne:false}},{projection:{name:1,category:1,description:1,standardFee:1,durationMinutes:1}}).sort({name:1}).toArray(),
    database.collection('doctors').find({clinicId,active:{$ne:false}},{projection:{name:1,specialization:1,specialtyBio:1,consultationFee:1,photoDataUrl:1}}).sort({name:1}).toArray(),
    database.collection('clinicPages').find({clinicId,published:{$ne:null}},{projection:{slug:1,published:1}}).toArray(),
    database.collection('patients').countDocuments({clinicId}),
  ]);
  const existing=new Set(websitePages.map(([, ,path])=>path.replace(/^\//,'')));
  return {clinic:{_id:clinic._id,name:clinic.name,slug:clinic.slug,bio:clinic.bio,phone:clinic.phone,email:clinic.email,address:clinic.address,city:clinic.city,country:clinic.country,openingHours:clinic.openingHours,emergencyNotice:clinic.emergencyNotice,whatsappNumber:clinic.whatsappNumber,currency:clinic.currency||'PKR',timezone:clinic.timezone||'Asia/Karachi',logoVersion:clinic.logoVersion,faviconVersion:clinic.faviconVersion},website:websiteFor(clinic,preview),services,doctors,patientCount,extraPages:extraPages.filter(p=>!existing.has(p.slug)).map(p=>({slug:p.slug,title:p.published.title,sortOrder:p.published.sortOrder||0})).sort((a,b)=>a.sortOrder-b.sortOrder),preview};
}
