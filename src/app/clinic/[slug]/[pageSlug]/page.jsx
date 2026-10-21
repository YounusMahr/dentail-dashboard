import Brand from '@/components/brand';
import { brandingUrls } from '@/lib/clinic-profile.mjs';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { currentUser } from '@/lib/auth';
import { ArrowRight,Stethoscope } from 'lucide-react';
async function resolvePage(params,preview){
 const {slug,pageSlug}=await params,database=await db(),clinic=await database.collection('clinics').findOne({slug,status:'active'});
 if(!clinic)return null;const clinicId=String(clinic._id),page=await database.collection('clinicPages').findOne({clinicId,slug:pageSlug});if(!page)return null;
 if(preview){const user=await currentUser();if(user?.role!=='clinic_admin'||user.clinicId!==clinicId)return null;return {clinic,page,draft:true}}
 return page.published?{clinic,page:page.published,draft:false}:null;
}
export async function generateMetadata({params,searchParams}){
 const preview=(await searchParams).preview==='1',result=await resolvePage(params,preview);
 return result?{title:`${result.page.title} | ${result.clinic.name}`,description:result.page.description,robots:preview?{index:false,follow:false}:undefined}:{title:'Page not found'};
}
export default async function ClinicContentPage({params,searchParams}){
 const result=await resolvePage(params,(await searchParams).preview==='1');if(!result)notFound();
 const {clinic,page,draft}=result,database=await db(),pages=await database.collection('clinicPages').find({clinicId:String(clinic._id),published:{$ne:null}},{projection:{slug:1,published:1}}).toArray();
 return <main className="marketing-home min-h-screen"><div className="container"><nav className="row between mb-8"><Link href={`/clinic/${clinic.slug}`} className="flex items-center gap-3 font-semibold"><Brand name={clinic.name} logoUrl={brandingUrls(clinic).logoUrl}/></Link><Link className="btn" href={`/clinic/${clinic.slug}#booking`}>Book appointment <ArrowRight size={15}/></Link></nav><div className="care-tabs"><Link href={`/clinic/${clinic.slug}`}>Home & booking</Link>{pages.sort((a,b)=>(a.published.sortOrder||0)-(b.published.sortOrder||0)).map(p=><Link key={p.slug} href={`/clinic/${clinic.slug}/${p.slug}`} className={p.slug===page.slug?'active':''}>{p.published.title}</Link>)}</div>{draft&&<div className="notice-panel">Draft preview — only clinic administrators can view this version.</div>}<article className="public-content"><span className="eyebrow">{clinic.name}</span><h1>{page.title}</h1>{page.description&&<p className="muted text-base!">{page.description}</p>}{page.imageUrl&&<img className="public-page-photo" src={page.imageUrl} alt={page.imageAlt||page.title}/>}<div className="public-copy" dir="auto">{(page.content||'').split('\n\n').map((paragraph,i)=><p key={i}>{paragraph}</p>)}</div></article><footer className="public-footer"><span>{clinic.name} · {clinic.address}</span><span>{clinic.phone}</span></footer></div></main>;
}

