import { ObjectId } from 'mongodb';
import { currentUser, sameOrigin } from '@/lib/auth';
import { db } from '@/lib/db';
import { fail, ok, string } from '@/lib/http';
import { writeBlock } from '@/lib/clinic-access';
export async function GET(){const user=await currentUser();if(user?.role!=='clinic_admin')return fail('Unauthorized',403);const clinic=await(await db()).collection('clinics').findOne({_id:new ObjectId(user.clinicId)});return ok({clinic});}
export async function PATCH(request){const user=await currentUser();if(!sameOrigin(request)||user?.role!=='clinic_admin')return fail('Unauthorized',403);const block=await writeBlock(user);if(block)return fail(block,403);const body=await request.json();const data={};for(const key of ['name','phone','email','address','whatsappNumber','emergencyNotice'])if(key in body)data[key]=string(body[key],key==='address'||key==='emergencyNotice'?1000:150);await(await db()).collection('clinics').updateOne({_id:new ObjectId(user.clinicId)},{$set:{...data,updatedAt:new Date()}});return ok({success:true});}
