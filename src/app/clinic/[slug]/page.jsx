import {notFound} from 'next/navigation';
import {loadClinicSite} from '@/lib/clinic-site-data';
import PublicSite from './public-site';
export default async function ClinicHome({params,searchParams}){
  const {slug}=await params,preview=(await searchParams).preview==='1',data=await loadClinicSite(slug,preview);
  if(!data)notFound();
  return <PublicSite data={data} pageKey="home"/>;
}
