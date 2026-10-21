'use client';
import { useState } from 'react';
import { Stethoscope } from 'lucide-react';
export default function ClinicImage({ className = '' }) {
  const [failed, setFailed] = useState(false);
  return <div className={`clinic-image ${className}`}>{failed ? <Stethoscope size={80} strokeWidth={1}/> : <img src="/images/hero-clinic.jpg" alt="Dentist caring for a patient in a dental clinic" onError={()=>setFailed(true)}/>}</div>;
}
