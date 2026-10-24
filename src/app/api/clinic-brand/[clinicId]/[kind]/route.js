import { ObjectId } from 'mongodb';
import { db } from '@/lib/db';
import { currentUser } from '@/lib/auth';
export async function GET(request,{params}){
 const {clinicId,kind}=await params;if(!/^[a-f\d]{24}$/i.test(clinicId)||!['logo','favicon','paymentQr'].includes(kind))return new Response(null,{status:404});
 if(kind==='paymentQr'){const user=await currentUser();if(!user||String(user.clinicId)!==clinicId)return new Response(null,{status:403})}
 const clinic=await(await db()).collection('clinics').findOne({_id:new ObjectId(clinicId),status:'active'},{projection:{[kind+'Data']:1}});
 const data=clinic?.[kind+'Data'];if(!data)return new Response(null,{status:404});
 return new Response(new Uint8Array(data.buffer||data),{headers:{'Content-Type':'image/png','Cache-Control':kind==='paymentQr'?'private, no-store':'public, max-age=0, must-revalidate','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'"}});
}
