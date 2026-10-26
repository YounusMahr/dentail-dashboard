import Link from 'next/link';
import { ShieldCheck, ArrowRight } from 'lucide-react';
import AuthFrame from '@/components/auth-frame';

export default function RegisterClinic() {
  return <AuthFrame><div className="space-y-4"><span className="inline-grid h-12 w-12 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><ShieldCheck size={25}/></span><h1>Clinic setup is managed for you.</h1><p className="muted">A DentalCare administrator creates each clinic workspace and shares a secure first sign-in. Please contact your platform administrator to get started.</p><Link href="/login" className="btn">Go to sign in <ArrowRight size={16}/></Link></div></AuthFrame>;
}
