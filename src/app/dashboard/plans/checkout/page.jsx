import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { subscriptionPlan } from '@/lib/subscription-plans';
import Checkout from './checkout';
import '../plans.css';

export const metadata = { title: 'Plan checkout | DentalCare' };

export default async function CheckoutPage({ searchParams }) {
  const user = await currentUser();
  if (user?.role !== 'clinic_admin') redirect('/dashboard');
  const { plan: planId } = await searchParams;
  const plan = subscriptionPlan(planId);
  if (!plan) redirect('/dashboard/plans');
  return <Checkout plan={plan} />;
}
