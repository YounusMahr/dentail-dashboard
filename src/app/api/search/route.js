import {currentUser} from '@/lib/auth';
import {db} from '@/lib/db';
import {searchClinic} from '@/lib/search.mjs';
export async function GET(request){const user=await currentUser();if(!user?.clinicId||!['clinic_admin','dentist','receptionist'].includes(user.role))return Response.json({error:'Unauthorized'},{status:403});try{return Response.json({groups:await searchClinic(await db(),user,new URL(request.url).searchParams.get('q'))},{headers:{'Cache-Control':'no-store'}})}catch{return Response.json({error:'Search is unavailable. Try again.'},{status:503})}}
