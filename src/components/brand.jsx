import { Stethoscope } from 'lucide-react';
export default function Brand({ light = false, name, logoUrl }) {
  if(name)return <div className="clinic-custom-brand">{logoUrl?<img src={logoUrl} alt=""/>:<span className="brand-symbol"><Stethoscope size={24}/></span>}<span><strong>{name}</strong><small>DENTAL CLINIC</small></span></div>;
  return <div className={`brand-lockup ${light ? 'brand-light' : ''}`}><span className="brand-symbol"><Stethoscope size={24} strokeWidth={1.8}/></span><span>Dental<span className="brand-accent">Care</span><small>CLINIC MANAGEMENT</small></span></div>;
}
