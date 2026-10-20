import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import WorkspaceShell from './workspace-shell';
import { db } from '@/lib/db';
import { ObjectId } from 'mongodb';
export default async function DashboardLayout({ children }) {
  const user = await currentUser();
  if (!user) redirect('/login');
  const links = [['Dashboard','/dashboard'],['Appointments','/dashboard/appointments'],['Patients','/dashboard/patients'],['Care workspace','/dashboard/care/plans'],['Treatments','/dashboard/treatments'],['Invoices','/dashboard/invoices'],['Follow-ups','/dashboard/follow-ups'],['Doctors','/dashboard/doctors'],['Services','/dashboard/services']];
  if (user.role === 'clinic_admin') links.push(['Reports','/dashboard/reports'],['Staff','/dashboard/staff'],['Clinic settings','/dashboard/settings'],['Subscription','/dashboard/subscription']);
  if (user.role === 'platform_owner') links.splice(0, links.length, ['Platform','/dashboard/platform']);
  links.push(['My account','/dashboard/account']);
  const clinic=user.clinicId&&ObjectId.isValid(user.clinicId)?await (await db()).collection('clinics').findOne({_id:new ObjectId(user.clinicId)},{projection:{name:1}}):null;
  return <WorkspaceShell links={links} user={{name:user.name,role:user.role}} clinicName={clinic?.name||'DentalCare Platform'}>{children}</WorkspaceShell>;
}
