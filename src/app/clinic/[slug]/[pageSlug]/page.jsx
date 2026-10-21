import {notFound} from 'next/navigation';
import {currentUser} from '@/lib/auth';
import {db} from '@/lib/db';
import {loadClinicSite} from '@/lib/clinic-site-data';
import {websitePages,websiteFor} from '@/lib/clinic-website.mjs';
import PublicSite from '../public-site';
import Brand from '@/components/brand';
import {brandingUrls} from '@/lib/clinic-profile.mjs';
import Link from 'next/link';
import {ArrowRight} from 'lucide-react';

const builtIn={ 'about-us':'about', services:'services', 'contact-us':'contact' };
const themeColors={emerald:'#0a756d',ocean:'#1674a1',navy:'#142e61',rose:'#a95d68',sand:'#98704f'};
async function customPage(slug,pageSlug,preview){
  const database=await db(),clinic=await database.collection('clinics').findOne({slug,status:'active'});if(!clinic)return null;
  const clinicId=String(clinic._id),record=await database.collection('clinicPages').findOne({clinicId,slug:pageSlug});if(!record)return null;
  if(preview){const user=await currentUser();if(user?.role!=='clinic_admin'||user.clinicId!==clinicId)return null;return {clinic,page:record,draft:true}}
  return record.published?{clinic,page:record.published,draft:false}:null;
}
export async function generateMetadata({params,searchParams}){
  const {slug,pageSlug}=await params,preview=(await searchParams).preview==='1';
  if(builtIn[pageSlug]){const data=await loadClinicSite(slug,preview);if(!data)return {title:'Clinic not found'};const page=data.website.pages[builtIn[pageSlug]];return {title:`${page.title} | ${data.clinic.name}`,description:page.description,robots:preview?{index:false,follow:false}:undefined}}
  const result=await customPage(slug,pageSlug,preview);
  return result?{title:`${result.page.title} | ${result.clinic.name}`,description:result.page.description,robots:preview?{index:false,follow:false}:undefined}:{title:'Page not found'};
}
export default async function ClinicPage({params,searchParams}){
  const {slug,pageSlug}=await params,preview=(await searchParams).preview==='1';
  if(builtIn[pageSlug]){const data=await loadClinicSite(slug,preview);if(!data)notFound();return <PublicSite data={data} pageKey={builtIn[pageSlug]}/>}
  const result=await customPage(slug,pageSlug,preview);if(!result)notFound();
  const {clinic,page,draft}=result,base=`/clinic/${slug}`,website=websiteFor(clinic,preview),link=(path)=>preview?`${path}${path.includes('?')?'&':'?'}preview=1`:path;
  return <div className={`clinic-site clinic-theme-${website.theme}`} style={{'--clinic-primary':themeColors[website.theme]||themeColors.emerald,'--clinic-accent':website.accent||'#109b89'}}><header className="clinic-site-header"><div className="clinic-shell"><Link href={link(base)} className="clinic-site-brand"><Brand name={clinic.name} logoUrl={brandingUrls(clinic).logoUrl}/></Link><nav aria-label="Clinic pages">{websitePages.map(([key,label,path])=><Link key={key} href={link(base+(path==='/'?'':path))}>{label}</Link>)}</nav><Link className="clinic-header-book" href={`${base}#appointment`}>Book appointment <ArrowRight size={15}/></Link></div></header><main>{draft&&<div className="clinic-preview-note">Draft preview · visible only to the clinic administrator</div>}<section className="clinic-custom-page clinic-shell"><span className="clinic-eyebrow">{clinic.name}</span><h1>{page.title}</h1>{page.description&&<p className="clinic-custom-lead">{page.description}</p>}{page.imageUrl&&<img src={page.imageUrl} alt={page.imageAlt||page.title}/>}<div className="clinic-custom-copy" dir="auto">{String(page.content||'').split('\n\n').map((text,i)=><p key={i}>{text}</p>)}</div><Link className="clinic-button" href={`${base}#appointment`}>Book a visit <ArrowRight size={16}/></Link></section></main><footer className="clinic-site-footer"><div className="clinic-shell clinic-footer-bottom"><span>{clinic.name}</span><span>{clinic.phone}</span></div></footer></div>;
}
