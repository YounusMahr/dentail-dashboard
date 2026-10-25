import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import PlansView from './plans-view';
import './plans.css';

export const metadata = { title: 'Plans | DentalCare' };

export default async function PlansPage() {
  const user = await currentUser();
  if (user?.role !== 'clinic_admin') redirect('/dashboard');
  return <PlansView />;
}
