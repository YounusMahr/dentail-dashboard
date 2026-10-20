import Link from 'next/link';
import { ShieldCheck, HeartPulse } from 'lucide-react';
import Brand from './brand';
import ClinicImage from './clinic-image';
export default function AuthFrame({children}) {
  return <main className="auth"><aside className="auth-visual"><ClinicImage/><Link href="/"><Brand light/></Link><div className="auth-story"><div className="eyebrow">DESIGNED AROUND YOUR PRACTICE</div><h2>Great care starts<br/>with a connected clinic.</h2><p>A thoughtful workspace for your team. A smoother experience for your patients. More time for the smiles that matter.</p><div className="auth-story-footer"><span className="flex items-center gap-2"><HeartPulse size={17}/> Patient-first workflows</span><span className="flex items-center gap-2"><ShieldCheck size={17}/> One connected workspace</span></div></div><span className="text-[9px] text-emerald-100/50">DentalCare · Built for better patient care</span></aside><section className="auth-form-area"><div className="card"><div className="auth-mobile-brand"><Link href="/"><Brand/></Link></div><span className="pill">YOUR CLINIC WORKSPACE</span>{children}<div className="auth-lock"><ShieldCheck size={14}/> A dedicated workspace for your clinic team</div></div></section></main>;
}
