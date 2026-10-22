import { fail,ok } from '@/lib/http';
import { db,ensureIndexes } from '@/lib/db';
import { careIndexes } from '@/lib/care';
import { queueReminders } from '@/lib/messaging';
import {dispatchEmailOutbox} from '@/lib/email-notifications';
export async function POST(request){
 if(!process.env.REMINDER_CRON_SECRET||request.headers.get('authorization')!==`Bearer ${process.env.REMINDER_CRON_SECRET}`)return fail('Unauthorized',401);
 await Promise.all([careIndexes(await db()),ensureIndexes()]);const queued=await queueReminders();return ok({...queued,emailDispatch:await dispatchEmailOutbox()});
}
