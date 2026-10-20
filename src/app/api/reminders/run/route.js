import { fail,ok } from '@/lib/http';
import { db } from '@/lib/db';
import { careIndexes } from '@/lib/care';
import { queueReminders } from '@/lib/messaging';
export async function POST(request){
 if(!process.env.REMINDER_CRON_SECRET||request.headers.get('authorization')!==`Bearer ${process.env.REMINDER_CRON_SECRET}`)return fail('Unauthorized',401);
 await careIndexes(await db());return ok(await queueReminders());
}
