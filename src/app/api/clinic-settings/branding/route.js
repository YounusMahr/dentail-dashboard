import sharp from 'sharp';
import { ObjectId } from 'mongodb';
import { randomUUID } from 'node:crypto';
import { currentUser,sameOrigin } from '@/lib/auth';
import { db } from '@/lib/db';
import { writeBlock } from '@/lib/clinic-access';
import { fail,ok } from '@/lib/http';
export const runtime='nodejs';
export async function POST(request){
 const user=await currentUser();if(!sameOrigin(request)||user?.role!=='clinic_admin'||!user.clinicId)return fail('Unauthorized',403);
 const block=await writeBlock(user);if(block)return fail(block,403);
 if(Number(request.headers.get('content-length'))>2200000)return fail('Maximum image size is 2 MB',413);
 try{const form=await request.formData(),kind=form.get('kind');if(!['logo','favicon','paymentQr'].includes(kind))return fail('Invalid image type');
 const database=await db(),q={_id:new ObjectId(user.clinicId)};
 if(form.get('remove')==='true'){await database.collection('clinics').updateOne(q,{$unset:{[kind+'Data']:'',[kind+'Version']:''},$set:{updatedAt:new Date()}});return ok({url:null})}
 const file=form.get('file');if(!file||typeof file.arrayBuffer!=='function'||file.size>2*1024*1024||!file.size)return fail('Choose a PNG, JPEG or WebP image up to 2 MB');
 const bytes=Buffer.from(await file.arrayBuffer()),image=sharp(bytes,{limitInputPixels:16000000,animated:false}),meta=await image.metadata();
 if(!['png','jpeg','webp'].includes(meta.format)||meta.pages>1)return fail('Use a static PNG, JPEG or WebP image');
 const data=await image.rotate().resize(kind==='favicon'?64:512,kind==='favicon'?64:512,{fit:'contain',background:{r:255,g:255,b:255,alpha:0}}).png().toBuffer(),version=randomUUID();
 await database.collection('clinics').updateOne(q,{$set:{[kind+'Data']:data,[kind+'Version']:version,updatedAt:new Date()}});
 return ok({url:`/api/clinic-brand/${user.clinicId}/${kind}?v=${version}`});
 }catch{return fail('Unable to process this image. Choose a valid PNG, JPEG or WebP up to 2 MB.')}
}
