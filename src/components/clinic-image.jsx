'use client';
import { useState } from 'react';
import { Stethoscope } from 'lucide-react';
export default function ClinicImage({ className = '' }) {
  const [failed, setFailed] = useState(false);
  return <div className={`clinic-image ${className}`}>{failed ? <Stethoscope size={80} strokeWidth={1}/> : <img src="https://images.unsplash.com/photo-1657470179447-0f5aa16daa91?auto=format&fit=crop&w=1200&q=85" alt="Dentist caring for a patient in a dental clinic" onError={()=>setFailed(true)}/>}</div>;
}
