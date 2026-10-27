import { fail,ok } from '@/lib/http';
import { db,ensureIndexes } from '@/lib/db';
import { careIndexes } from '@/lib/care';
import { queueReminders } from '@/lib/messaging';
import { homeClinicSlug } from '@/lib/clinic-site-data';
import { ensurePatientWebhook, getEvolutionConfig } from '@/lib/evolution';
import { sendEndOfDayReports } from '@/lib/daily-whatsapp-report';
export const maxDuration = 60;
async function run(request) {
 const authorization=request.headers.get('authorization');
 const allowed=[process.env.CRON_SECRET,process.env.REMINDER_CRON_SECRET].filter(Boolean).some(secret=>authorization===`Bearer ${secret}`);
 if(!allowed)return fail('Unauthorized',401);
 const database=await db();
 await Promise.all([careIndexes(database),ensureIndexes()]);
 let report={sent:0};
 const clinic=await database.collection('clinics').findOne({slug:await homeClinicSlug(),status:'active'},{projection:{_id:1}});
 if(clinic){
   const clinicId=String(clinic._id),settings=await database.collection('messagingSettings').findOne({clinicId},{projection:{instanceName:1}});
   const instanceName=settings?.instanceName||getEvolutionConfig().defaultInstance;
   if(!settings?.instanceName)await database.collection('messagingSettings').updateOne({clinicId},{$set:{instanceName,updatedAt:new Date()}},{upsert:true});
   try{await ensurePatientWebhook(clinicId,instanceName,new URL(request.url).origin)}catch(error){console.error('Automatic patient WhatsApp webhook setup failed:',error.message)}
   try{report=await sendEndOfDayReports({clinicId,instanceName})}catch(error){console.error('Daily WhatsApp report failed:',error.message)}
 }
 const queued=await queueReminders(undefined,true);
 return ok({...queued,dailyReport:report});
}
export const GET=run;
export const POST=run;
