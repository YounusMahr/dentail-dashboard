'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Building2, CalendarDays, Search, Users } from 'lucide-react';

export default function Platform() {
  const [data, setData] = useState(null), [search, setSearch] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState('');
  async function load() {
    const response = await fetch('/api/platform');
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not load clinics');
    setData(result);
  }
  useEffect(() => { load().catch(e => setError(e.message)); }, []);
  async function changeStatus(clinic) {
    setBusy(String(clinic._id)); setError('');
    try {
      const response = await fetch('/api/platform', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clinicId: clinic._id, status: clinic.status === 'active' ? 'suspended' : 'active' }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not update clinic');
      await load();
    } catch (e) { setError(e.message); } finally { setBusy(''); }
  }
  const rows = data?.clinics?.filter(clinic => `${clinic.name} ${clinic.slug} ${clinic.city || ''}`.toLowerCase().includes(search.toLowerCase())) || [];
  return <div className="space-y-5"><div className="top"><div><div className="eyebrow">PLATFORM OPERATIONS</div><h1>Clinics</h1><p className="muted">Clinic status and workspace activity in one place.</p></div></div>{error && <div className="error" role="alert">{error}</div>}
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[[Building2, 'Clinics', data?.metrics?.total], [Building2, 'Active clinics', data?.metrics?.active], [Users, 'Patients', data?.metrics?.patients], [CalendarDays, 'Appointments', data?.metrics?.appointments]].map(([Icon, label, value]) => <div className="card" key={label}><Icon size={18} className="text-emerald-700"/><small className="mt-3 block text-slate-500">{label}</small><strong className="mt-1 block text-2xl">{value?.toLocaleString('en-PK') ?? '—'}</strong></div>)}</div>
    <section className="card"><label className="flex items-center gap-2"><Search size={17}/> Find clinic<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Clinic name, URL or city"/></label><div className="table-wrap mt-4"><table className="table"><thead><tr><th>Clinic</th><th>Activity</th><th>Status</th><th>Actions</th></tr></thead><tbody>{rows.map(clinic => { const usage = data.counts.find(item => item.id === clinic._id); return <tr key={clinic._id}><td><strong>{clinic.name}</strong><small className="block">/{clinic.slug}{clinic.city ? ` · ${clinic.city}` : ''}</small></td><td>{usage?.patients || 0} patients · {usage?.appointments || 0} appointments<small className="block">{usage?.staff || 0} staff · {usage?.treatments || 0} treatments</small></td><td><span className={`status-badge status-${clinic.status}`}>{clinic.status}</span></td><td><div className="row"><Link className="btn secondary" href={`/clinic/${clinic.slug}`} target="_blank">Clinic <ArrowUpRight size={14}/></Link><button className="secondary" disabled={!!busy} onClick={() => changeStatus(clinic)}>{busy === String(clinic._id) ? 'Saving…' : clinic.status === 'active' ? 'Suspend' : 'Activate'}</button></div></td></tr>; })}</tbody></table>{data && !rows.length && <p className="py-8 text-center text-sm text-slate-500">No clinics match your search.</p>}</div></section></div>;
}
