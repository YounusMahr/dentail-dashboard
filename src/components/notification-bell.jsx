'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { BellRing } from 'lucide-react';

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);
  const container = useRef(null);
  useEffect(() => {
    let active = true;
    const load = () => fetch('/api/notifications?limit=5', { cache: 'no-store' }).then(response => response.ok ? response.json() : null).then(result => { if (active && result) setData(result); }).catch(() => {});
    load(); const timer = setInterval(load, 60000);
    window.addEventListener('clinic-notifications-changed', load);
    return () => { active = false; clearInterval(timer); window.removeEventListener('clinic-notifications-changed', load); };
  }, []);
  useEffect(() => {
    if (!open) return;
    const close = event => { if (!container.current?.contains(event.target)) setOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);
  const attention = data?.attentionCount || 0;
  return <div className="relative" ref={container}><button type="button" className="icon-button relative" title="Notifications" aria-label={`Notifications${attention ? `, ${attention} need attention` : ''}`} aria-expanded={open} onClick={() => setOpen(value => !value)}><BellRing size={19}/>{attention > 0 && <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-red-500 px-1 text-center text-[9px] font-semibold leading-4 text-white">{attention > 99 ? '99+' : attention}</span>}</button>{open && <div className="notification-popover absolute right-0 top-full z-50 mt-2 w-[min(360px,calc(100vw-24px))] rounded-2xl border border-slate-200 bg-white p-3 shadow-xl"><div className="flex items-center justify-between border-b border-slate-100 pb-2"><strong className="text-sm text-slate-900">Notifications</strong><Link href="/dashboard/follow-ups" onClick={() => setOpen(false)} className="text-xs font-medium text-emerald-700">View all</Link></div>{attention > 0 && <p className="m-0 py-2 text-xs text-amber-800">{attention} messages need attention</p>}{data?.records?.slice(0, 5).map(item => <Link key={`${item.channel}-${item._id}`} href={`/dashboard/patients/${item.patientId}`} onClick={() => setOpen(false)} className="notification-item block border-t border-slate-100 py-2 text-xs hover:bg-slate-50"><span className="font-medium text-slate-900">{item.patient?.name || 'Patient'} · {item.type?.replaceAll('_', ' ')}</span><small className="block text-slate-500">{item.channel} · {item.status === 'pending_provider' ? 'Queued' : item.status}</small></Link>)}{!data?.records?.length && <p className="m-0 py-4 text-xs text-slate-500">No recent messages.</p>}</div>}</div>;
}
