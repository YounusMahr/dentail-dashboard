import { db } from '@/lib/db';
import { brandingUrls } from '@/lib/clinic-profile.mjs';
export async function generateMetadata({params}){const {slug}=await params,clinic=await(await db()).collection('clinics').findOne({slug,status:'active'},{projection:{name:1,bio:1,faviconVersion:1,websitePublished:1}});return clinic?{title:clinic.websitePublished?.pages?.home?.title||clinic.name,description:clinic.websitePublished?.pages?.home?.description||clinic.bio||'Book your dental clinic appointment',icons:{icon:brandingUrls(clinic).faviconUrl||'/dentalcare-icon.svg'}}:{}}
export default function ClinicLayout({children}){return children}
