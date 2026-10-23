import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import WorkspaceShell from './workspace-shell';
import { db } from '@/lib/db';
import { ObjectId } from 'mongodb';
import { brandingUrls } from '@/lib/clinic-profile.mjs';
export async function generateMetadata(){const user=await currentUser();if(!user?.clinicId||!ObjectId.isValid(user.clinicId))return {};const clinic=await(await db()).collection('clinics').findOne({_id:new ObjectId(user.clinicId)},{projection:{name:1,faviconVersion:1}});return clinic?{title:`${clinic.name} | DentalCare`,icons:{icon:brandingUrls(clinic).faviconUrl||'/dentalcare-icon.svg',apple:'/pwa/apple-touch-icon.png'}}:{}}
export default async function DashboardLayout({ children }) {
  const user = await currentUser();
  if (!user) redirect('/login');
  const links = [['Dashboard','/dashboard'],['Appointments','/dashboard/appointments'],['Patients','/dashboard/patients'],['Care workspace','/dashboard/care/plans'],['Treatments','/dashboard/treatments'],['Invoices','/dashboard/invoices'],['Follow-ups','/dashboard/follow-ups'],['Doctors','/dashboard/doctors'],['Services','/dashboard/services']];
  if (user.role === 'clinic_admin') {
    links.splice(links.findIndex(([label]) => label === 'Doctors'), 0, ['WhatsApp','/dashboard/whatsapp']);
    links.push(['Website studio','/dashboard/website'],['Reports','/dashboard/reports'],['Staff','/dashboard/staff'],['Clinic settings','/dashboard/settings']);
  }
  if (user.role === 'clinic_admin') links.unshift(['AI Assistant','/dashboard/ai']);
  if (user.role === 'platform_owner') links.splice(0, links.length, ['Platform','/dashboard/platform']);
  links.push(['My account','/dashboard/account']);
  const clinic=user.clinicId&&ObjectId.isValid(user.clinicId)?await (await db()).collection('clinics').findOne({_id:new ObjectId(user.clinicId)},{projection:{name:1,logoVersion:1,slug:1}}):null;
  return <WorkspaceShell links={links} user={{name:user.name,role:user.role}} clinicName={clinic?.name||'DentalCare Platform'} clinicSlug={clinic?.slug} clinicLogo={clinic?brandingUrls(clinic).logoUrl:null}>{children}</WorkspaceShell>;
}

