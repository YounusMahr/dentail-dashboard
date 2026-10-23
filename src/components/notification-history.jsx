'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { RefreshCw, MessageCircle, Mail } from 'lucide-react';

const dateLabel = value => value ? new Date(value).toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
const statusLabel = status => ({ pending_provider: 'Queued', sent: 'Sent', failed: 'Failed', cancelled: 'Cancelled' })[status] || status;

export default function NotificationHistory({ patientId = '' }) {
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const load = useCallback(async signal => {
    setLoading(true);
    try {
      const response = await fetch(`/api/notifications?limit=60${patientId ? `&patient=${patientId}` : ''}`, { cache: 'no-store', signal });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not load messages');
      setData(result); setError('');
    } catch (cause) { if (cause.name !== 'AbortError') setError(cause.message); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [patientId]);
  useEffect(() => { const controller = new AbortController(); load(controller.signal); return () => controller.abort(); }, [load]);
  const records = (data?.records || []).filter(item => filter === 'all' || filter === 'attention' && ['pending_provider', 'failed'].includes(item.status) || filter === item.channel);
  return <section className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="m-0 text-sm font-semibold text-slate-900">Message history</h2><p className="m-0 mt-1 text-xs text-slate-500">Booking confirmations, care reminders and receipts sent through the connected providers.</p></div><button type="button" className="secondary" onClick={() => load()} disabled={loading}><RefreshCw size={14}/>{loading ? 'Loading…' : 'Refresh'}</button></div>
    {error && <p role="alert" className="mt-3 text-xs text-red-700">{error}</p>}
    <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Filter messages">{[['all', 'All'], ['attention', 'Needs attention'], ['WhatsApp', 'WhatsApp'], ['Email', 'Email']].map(([value, label]) => <button key={value} type="button" onClick={() => setFilter(value)} className={`rounded-full px-3 py-1.5 text-xs ${filter === value ? 'bg-emerald-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{label}</button>)}</div>
    <div className="mt-3 divide-y divide-slate-100">{records.map(item => <div key={`${item.channel}-${item._id}`} className="grid gap-2 py-3 text-xs sm:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_auto] sm:items-center"><div className="flex min-w-0 items-start gap-2">{item.channel === 'WhatsApp' ? <MessageCircle size={15} className="mt-0.5 shrink-0 text-emerald-700"/> : <Mail size={15} className="mt-0.5 shrink-0 text-sky-700"/>}<div className="min-w-0"><strong className="block truncate text-slate-900">{item.type?.replaceAll('_', ' ')}</strong><span className="text-slate-500">{item.channel} · {dateLabel(item.sentAt || item.createdAt)}</span></div></div><div className="min-w-0"><Link href={`/dashboard/patients/${item.patientId}`} className="font-medium text-emerald-700 hover:underline">{item.patient?.name || 'Patient'}</Link><p className="m-0 truncate text-slate-500">{(item.details || []).filter(Boolean).join(' · ')}</p>{item.error && <p className="m-0 truncate text-red-600" title={item.error}>{item.error}</p>}</div><span className={`w-fit rounded-full px-2.5 py-1 font-medium ${item.status === 'sent' ? 'bg-emerald-50 text-emerald-700' : item.status === 'failed' ? 'bg-red-50 text-red-700' : item.status === 'cancelled' ? 'bg-slate-100 text-slate-500' : 'bg-amber-50 text-amber-800'}`}>{statusLabel(item.status)}</span></div>)}{!records.length && <p className="py-5 text-center text-xs text-slate-500">{loading ? 'Loading messages…' : 'No messages in this view.'}</p>}</div>
  </section>;
}
