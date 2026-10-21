import { ObjectId } from 'mongodb';
import { currentUser, sameOrigin } from '@/lib/auth';
import { db } from '@/lib/db';
import { fail, ok, string } from '@/lib/http';
import { writeBlock } from '@/lib/clinic-access';
import { cleanClinicProfile, publicProfile } from '@/lib/clinic-profile.mjs';
export async function GET(){const user=await currentUser();if(user?.role!=='clinic_admin'||!user.clinicId)return fail('Unauthorized',403);const clinic=await(await db()).collection('clinics').findOne({_id:new ObjectId(user.clinicId)},{projection:{logoData:0,faviconData:0}});return clinic?ok({clinic:publicProfile(clinic)}):fail('Clinic not found',404);}
export async function PATCH(request){const user=await currentUser();if(!sameOrigin(request)||user?.role!=='clinic_admin'||!user.clinicId)return fail('Unauthorized',403);const block=await writeBlock(user);if(block)return fail(block,403);try{const body=await request.json();if(!body||typeof body!=='object'||Array.isArray(body))return fail('Invalid profile');const data=cleanClinicProfile(body);await(await db()).collection('clinics').updateOne({_id:new ObjectId(user.clinicId)},{$set:{...data,updatedAt:new Date()}});return ok({success:true});}catch(e){return fail(e.message||'Invalid clinic profile')}}
