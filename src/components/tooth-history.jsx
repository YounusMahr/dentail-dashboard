'use client';
import { useState } from 'react';
import ToothPicker from '@/app/dashboard/[module]/tooth-picker';
export default function ToothHistory({profile,documents,patientId}){
 const [teeth,setTeeth]=useState('');const selected=teeth.split(',').map(x=>x.trim()).filter(Boolean);
 const match=r=>!selected.length||String(r.toothNumbers||'').split(',').map(x=>x.trim()).some(x=>selected.includes(x));
 const treatments=profile?.treatments?.filter(match)||[],files=documents.filter(match);
 return <section className="card span-full"><div className="section-heading"><div><h2>Tooth-by-tooth care history</h2><p className="muted">Select teeth to see treatments and clinical files.</p></div></div><div className="grid two"><div><ToothPicker name="historyTeeth" value={teeth} onChange={setTeeth}/>{selected.length>0&&<button className="secondary mt-3" onClick={()=>setTeeth('')}>Show all teeth</button>}</div><div className="tooth-history-list">{treatments.map(t=><div className="timeline-row" key={t._id}><span className="timeline-dot"/><div><strong>{t.treatmentRendered}</strong><small>Teeth {t.toothNumbers||'not specified'}</small></div></div>)}{files.map(d=><a href={`/api/patients/${patientId}/documents/${d._id}`} className="timeline-row" key={d._id}><span className="timeline-dot"/><div><strong>{d.title}</strong><small>{d.documentType} · Teeth {d.toothNumbers||'not specified'} · Download</small></div></a>)}{!treatments.length&&!files.length&&<p className="muted">No records linked to these teeth yet.</p>}</div></div></section>;
}
