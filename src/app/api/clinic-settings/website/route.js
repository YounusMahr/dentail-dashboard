import { ObjectId } from 'mongodb';
import { currentUser, sameOrigin } from '@/lib/auth';
import { db } from '@/lib/db';
import { fail, ok } from '@/lib/http';
import { writeBlock } from '@/lib/clinic-access';
import { cleanWebsite, defaultWebsite } from '@/lib/clinic-website.mjs';

async function context(request,mutation=false){
  const user=await currentUser();
  if(user?.role!=='clinic_admin'||!ObjectId.isValid(user.clinicId)||mutation&&!sameOrigin(request))return null;
  const database=await db(),clinic=await database.collection('clinics').findOne({_id:new ObjectId(user.clinicId)});
  return clinic?{user,database,clinic}:null;
}
export async function GET(request){
  const ctx=await context(request);if(!ctx)return fail('Unauthorized',403);
  return ok({draft:ctx.clinic.websiteDraft||ctx.clinic.websitePublished||defaultWebsite,published:!!ctx.clinic.websitePublished,slug:ctx.clinic.slug,updatedAt:ctx.clinic.websiteUpdatedAt||null});
}
export async function PATCH(request){
  const ctx=await context(request,true);if(!ctx)return fail('Unauthorized',403);
  const block=await writeBlock(ctx.user);if(block)return fail(block,403);
  try{const body=await request.json(),draft=cleanWebsite(body);
    await ctx.database.collection('clinics').updateOne({_id:ctx.clinic._id},{$set:{websiteDraft:draft,websiteUpdatedAt:new Date()}});
    return ok({success:true});
  }catch(error){return fail(error.message||'Invalid website draft')}
}
export async function POST(request){
  const ctx=await context(request,true);if(!ctx)return fail('Unauthorized',403);
  const block=await writeBlock(ctx.user);if(block)return fail(block,403);
  const body=await request.json().catch(()=>({}));
  if(body.action!=='publish')return fail('Unknown website action');
  try{const published=cleanWebsite(body.website||ctx.clinic.websiteDraft||defaultWebsite);
    await ctx.database.collection('clinics').updateOne({_id:ctx.clinic._id},{$set:{websiteDraft:published,websitePublished:published,websiteUpdatedAt:new Date(),websitePublishedAt:new Date()}});
    return ok({success:true});
  }catch(error){return fail(error.message||'Could not publish website')}
}
