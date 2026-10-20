import { Stethoscope } from 'lucide-react';
export default function Brand({ light = false }) {
  return <div className={`brand-lockup ${light ? 'brand-light' : ''}`}><span className="brand-symbol"><Stethoscope size={24} strokeWidth={1.8}/></span><span>Dental<span className="brand-accent">Care</span><small>CLINIC MANAGEMENT</small></span></div>;
}
