import { ObjectId } from 'mongodb';
import { currentUser,hashPassword,sameOrigin,verifyPassword } from '@/lib/auth';
import { db } from '@/lib/db';
import { fail,ok } from '@/lib/http';
export async function GET(){const user=await currentUser();if(!user)return fail('Unauthorized',403);return ok({user:{name:user.name,email:user.email,phone:user.phone||'',role:user.role}})}
export async function PATCH(request){
 const user=await currentUser();if(!sameOrigin(request)||!user)return fail('Unauthorized',403);
 const body=await request.json().catch(()=>({})),database=await db();
 if(!body||typeof body!=='object'||Array.isArray(body))return fail('Invalid account details');
 if(body.action==='profile'){
  if(typeof body.name!=='string'||!body.name.trim()||body.name.trim().length>150)return fail('Enter your name (up to 150 characters)');
  if(typeof body.phone!=='string'||body.phone.length>40||body.phone&&!/^\+?[\d\s().-]{7,40}$/.test(body.phone))return fail('Enter a valid phone number');
  await database.collection('users').updateOne({_id:user._id},{$set:{name:body.name.trim(),phone:body.phone.trim(),updatedAt:new Date()}});return ok({success:true});
 }
 const password=String(body.password||'');if(password.length<8||password.length>128)return fail('New password needs 8–128 characters');
 const record=await database.collection('users').findOne({_id:new ObjectId(user._id)});
 if(!verifyPassword(String(body.currentPassword||'').slice(0,128),record?.passwordHash))return fail('Current password is incorrect',403);
 await database.collection('users').updateOne({_id:user._id},{$set:{passwordHash:hashPassword(password),updatedAt:new Date()}});return ok({success:true});
}
