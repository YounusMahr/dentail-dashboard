'use client';
import { useState } from 'react';
import Link from 'next/link';
import ToothPicker from '@/app/dashboard/[module]/tooth-picker';
export default function ToothHistory({profile,documents,patientId}){
 const [teeth,setTeeth]=useState('');const selected=teeth.split(',').map(x=>x.trim()).filter(Boolean);
 const match=r=>!selected.length||String(r.toothNumbers||'').split(',').map(x=>x.trim()).some(x=>selected.includes(x));
 const plans=profile?.plans?.filter(match)||[],treatments=profile?.treatments?.filter(match)||[],files=documents.filter(match);
 return <section className="card span-full"><div className="section-heading"><div><h2>Tooth-by-tooth care history</h2><p className="muted">Select teeth to see linked plans, treatments and clinical files.</p></div><Link className="text-link" href={`/dashboard/care/plans?patient=${patientId}`}>Open treatment plans →</Link></div><div className="grid two"><div><ToothPicker name="historyTeeth" value={teeth} onChange={setTeeth}/>{selected.length>0&&<button className="secondary mt-3" onClick={()=>setTeeth('')}>Show all teeth</button>}</div><div className="tooth-history-list">{plans.map(p=><div className="timeline-row" key={p._id}><span className="timeline-dot"/><div><strong>{p.title}</strong><small>Plan · {p.status} · Teeth {p.toothNumbers||'not specified'}</small></div></div>)}{treatments.map(t=><div className="timeline-row" key={t._id}><span className="timeline-dot"/><div><strong>{t.treatmentRendered}</strong><small>Teeth {t.toothNumbers||'not specified'}</small></div></div>)}{files.map(d=><a href={`/api/patients/${patientId}/documents/${d._id}`} className="timeline-row" key={d._id}><span className="timeline-dot"/><div><strong>{d.title}</strong><small>{d.documentType} · Teeth {d.toothNumbers||'not specified'} · Download</small></div></a>)}{!plans.length&&!treatments.length&&!files.length&&<p className="muted">No records linked to these teeth yet.</p>}</div></div></section>;
}
