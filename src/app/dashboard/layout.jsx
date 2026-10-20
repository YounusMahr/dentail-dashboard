import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import Logout from './logout';
export default async function DashboardLayout({ children }) {
  const user = await currentUser();
  if (!user) redirect('/login');
  const links = [['Dashboard','/dashboard'],['Appointments','/dashboard/appointments'],['Patients','/dashboard/patients'],['Treatments','/dashboard/treatments'],['Invoices','/dashboard/invoices'],['Follow-ups','/dashboard/follow-ups'],['Doctors','/dashboard/doctors'],['Services','/dashboard/services']];
  if (user.role === 'clinic_admin') links.push(['Reports','/dashboard/reports'],['Staff','/dashboard/staff'],['Clinic settings','/dashboard/settings'],['Subscription','/dashboard/subscription']);
  if (user.role === 'platform_owner') links.splice(0, links.length, ['Platform','/dashboard/platform']);
  links.push(['My account','/dashboard/account']);
  return <div className="shell"><aside className="sidebar"><div className="brand">✦ DentalCare</div><nav className="nav">{links.map(([name,url])=><Link href={url} key={url}>{name}</Link>)}<Logout /></nav></aside><main className="main">{children}</main></div>;
}
