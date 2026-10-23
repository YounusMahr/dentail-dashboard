import { fail,ok } from '@/lib/http';
import { db,ensureIndexes } from '@/lib/db';
import { careIndexes } from '@/lib/care';
import { queueReminders } from '@/lib/messaging';
import {dispatchEmailOutbox} from '@/lib/email-notifications';
async function run(request) {
 const authorization=request.headers.get('authorization');
 const allowed=[process.env.CRON_SECRET,process.env.REMINDER_CRON_SECRET].filter(Boolean).some(secret=>authorization===`Bearer ${secret}`);
 if(!allowed)return fail('Unauthorized',401);
 await Promise.all([careIndexes(await db()),ensureIndexes()]);
 const queued=await queueReminders(undefined,true);
 return ok(queued);
}
export const GET=run;
export const POST=run;
