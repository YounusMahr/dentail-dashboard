'use client';

import { CalendarDays, Clock3, MapPin, Pencil, Search } from 'lucide-react';

const days = [['monday', 'Mon'], ['tuesday', 'Tue'], ['wednesday', 'Wed'], ['thursday', 'Thu'], ['friday', 'Fri'], ['saturday', 'Sat'], ['sunday', 'Sun']];
const initials = name => String(name || 'Doctor').split(' ').filter(part => part.toLowerCase() !== 'dr.').map(part => part[0]).slice(0, 2).join('').toUpperCase();

function Avatar({ doctor, size = 'md' }) {
  return <span className={`grid shrink-0 place-items-center overflow-hidden rounded-xl bg-emerald-100 font-semibold text-emerald-800 ${size === 'lg' ? 'h-12 w-12 text-sm' : 'h-9 w-9 text-xs'}`}>{doctor.photoDataUrl ? <img className="h-full w-full object-cover" src={doctor.photoDataUrl} alt=""/> : initials(doctor.name)}</span>;
}

export default function DoctorRoster({ records, onEdit, canWrite, search, onSearch, total }) {
  const active = records.filter(doctor => doctor.active !== false);
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3"><span className="text-xs font-medium text-slate-700">{total} dentists · {active.length} active on this page</span><label className="relative m-0 flex w-full items-center sm:w-64"><Search size={15} className="absolute left-3 text-slate-400"/><input aria-label="Search dentists" placeholder="Search dentists" value={search} onChange={event => onSearch(event.target.value)} className="pl-9!"/></label></div>
    <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">{records.map(doctor => {
      const working = new Set(String(doctor.workingDays || '').split(',').filter(Boolean));
      return <article key={doctor._id} className={`min-w-0 rounded-2xl border bg-white p-4 shadow-[0_8px_26px_rgba(14,70,54,.04)] ${doctor.active === false ? 'border-slate-200 opacity-75' : 'border-emerald-100'}`}>
        <div className="flex min-w-0 items-start gap-3"><Avatar doctor={doctor} size="lg"/><div className="min-w-0 flex-1"><h2 className="m-0 truncate text-sm font-semibold text-slate-900">{doctor.name}</h2><p className="m-0 mt-0.5 truncate text-xs text-slate-500">{doctor.specialization || 'Dental practitioner'}</p></div>{canWrite && <button type="button" className="secondary shrink-0 px-2.5! py-1.5! text-[11px]!" onClick={() => onEdit(doctor)} aria-label={`Edit ${doctor.name}`}><Pencil size={13}/>Edit</button>}</div>
        <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]"><span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-800"><MapPin size={11}/>{doctor.chairName || 'Chair unassigned'}</span><span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-slate-700"><Clock3 size={11}/>{doctor.startTime || '10:00'}–{doctor.endTime || '20:00'}</span><span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">{doctor.slotMinutes || 30} min slots</span>{doctor.active === false && <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-800">Inactive</span>}</div>
        <div className="mt-3 flex gap-1" aria-label={`${doctor.name} working days`}>{days.map(([key, label]) => <span key={key} title={working.has(key) ? `${label} working` : `${label} off`} className={`flex-1 rounded-md py-1 text-center text-[10px] font-medium ${working.has(key) ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-400'}`}>{label}</span>)}</div>
      </article>;
    })}{!records.length && <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500">No dentists match this view.</div>}</div>

    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_26px_rgba(14,70,54,.035)] md:p-5"><div className="mb-4 flex items-center gap-2.5"><span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-50 text-emerald-700"><CalendarDays size={17}/></span><div><h2 className="m-0 text-sm font-semibold text-slate-900">Weekly chair timetable</h2><p className="m-0 text-xs text-slate-500">Working days, shifts and protected breaks</p></div></div>
      <div className="space-y-3">{active.map(doctor => { const working = new Set(String(doctor.workingDays || '').split(',').filter(Boolean)); return <div key={doctor._id} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3"><div className="mb-3 flex min-w-0 items-center gap-2"><Avatar doctor={doctor}/><div className="min-w-0"><strong className="block truncate text-xs text-slate-900">{doctor.name}</strong><span className="text-[11px] text-slate-500">{doctor.chairName || 'Chair unassigned'}</span></div></div><div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 xl:grid-cols-7">{days.map(([key, label]) => <div key={key} className={`min-w-0 rounded-lg border px-2 py-2 ${working.has(key) ? 'border-emerald-100 bg-white' : 'border-transparent bg-slate-100/70'}`}><span className={`block text-[10px] font-semibold uppercase tracking-wide ${working.has(key) ? 'text-emerald-700' : 'text-slate-400'}`}>{label}</span>{working.has(key) ? <><strong className="mt-1 block text-[11px] text-slate-800">{doctor.startTime || '10:00'}–{doctor.endTime || '20:00'}</strong>{doctor.breakStart && doctor.breakEnd && <small className="block text-[10px] text-slate-500">Break {doctor.breakStart}–{doctor.breakEnd}</small>}</> : <span className="mt-1 block text-[11px] text-slate-400">Off</span>}</div>)}</div></div>; })}</div>
    </section>
  </div>;
}
