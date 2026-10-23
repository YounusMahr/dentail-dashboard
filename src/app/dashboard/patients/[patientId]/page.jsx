'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CalendarDays, Camera, HeartPulse, Mail, MapPin, Phone, Plus, Receipt, ShieldAlert, Upload, Wallet } from 'lucide-react';
import ToothHistory from '@/components/tooth-history';
import NotificationHistory from '@/components/notification-history';

const tabs = [['overview', 'Overview'], ['care', 'Clinical care'], ['billing', 'Billing'], ['files', 'Files'], ['messages', 'Messages']];
const money = value => `Rs ${Number(value || 0).toLocaleString('en-PK')}`;
const day = value => value ? new Date(`${String(value).slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const label = value => String(value || '—').replaceAll('_', ' ');
const card = 'rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,45,35,.035)]';

function Detail({ title, value, icon: Icon }) {
  return <div className="min-w-0 border-b border-slate-100 py-2.5 last:border-0"><dt className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">{Icon && <Icon size={13}/>} {title}</dt><dd className="m-0 mt-1 break-words text-xs font-semibold text-slate-800">{value || '—'}</dd></div>;
}

function Empty({ children }) { return <p className="m-0 py-4 text-xs text-slate-500">{children}</p>; }

export default function PatientDetail() {
  const { patientId } = useParams();
  const [profile, setProfile] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [tab, setTab] = useState('overview');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const [patientResponse, filesResponse] = await Promise.all([fetch(`/api/patients/${patientId}`, { cache: 'no-store' }), fetch(`/api/patients/${patientId}/documents`, { cache: 'no-store' })]);
    const [patientData, filesData] = await Promise.all([patientResponse.json(), filesResponse.json()]);
    if (!patientResponse.ok) throw new Error(patientData.error || 'Patient file could not be loaded');
    setProfile(patientData);
    if (filesResponse.ok) setDocuments(filesData.documents || []);
  }, [patientId]);
  useEffect(() => { load().catch(cause => setError(cause.message)); }, [load]);

  async function setWhatsApp(enabled) {
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch(`/api/patients/${patientId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ whatsappConsent: enabled }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not save WhatsApp preference');
      setProfile(current => ({ ...current, patient: { ...current.patient, whatsappConsent: enabled } }));
      window.dispatchEvent(new Event('clinic-notifications-changed'));
      setMessage(enabled ? 'WhatsApp care messages enabled for this patient.' : 'WhatsApp messages turned off. Pending messages were cancelled.');
    } catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  }
  async function uploadPhoto(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 2 * 1024 * 1024 || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { setError('Choose a PNG, JPEG or WebP photo under 2 MB.'); return; }
    setBusy(true); setError(''); setMessage('');
    try {
      const photoDataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Could not read the photo'));
        reader.readAsDataURL(file);
      });
      const response = await fetch(`/api/patients/${patientId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ photoDataUrl }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not save the photo');
      setProfile(current => ({ ...current, patient: { ...current.patient, photoDataUrl: result.photoDataUrl } }));
      setMessage('Patient photo updated.');
    } catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  }
  async function upload(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const form = event.currentTarget;
      const response = await fetch(`/api/patients/${patientId}/documents`, { method: 'POST', body: new FormData(form) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Upload failed');
      form.reset(); await load(); setMessage('Clinical file uploaded.');
    } catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  }
  async function removeDocument(documentId) {
    if (!confirm('Delete this document?')) return;
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/patients/${patientId}/documents/${documentId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Document could not be deleted');
      await load(); setMessage('Document deleted.');
    } catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  }

  if (!profile) return <div className={card}>{error ? <p role="alert" className="text-red-700">{error}</p> : <p className="text-slate-500">Loading patient file…</p>}<Link href="/dashboard/patients" className="text-link">Back to patients</Link></div>;
  const { patient, appointments, treatments, invoices, payments, followUps, plans, sessions, prescriptions, labCases, doctors, services, totalPaid, outstanding, userRole } = profile;
  const doctorName = id => doctors.find(item => String(item._id) === id)?.name || 'Dentist';
  const serviceName = id => services.find(item => String(item._id) === id)?.name || 'Consultation / checkup';
  const upcoming = appointments.filter(item => item.appointmentDate >= new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' }) && !['cancelled', 'no_show'].includes(item.status));
  const initials = patient.name?.split(' ').map(part => part[0]).slice(0, 2).join('') || 'PT';
  return <div className="mx-auto max-w-7xl space-y-4 pb-8">
    <div className="patient-profile-toolbar"><Link href="/dashboard/patients" className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 hover:underline"><ArrowLeft size={15}/>Patients</Link><div className="patient-profile-actions"><Link className="btn secondary" href={`/dashboard/care/plans?patient=${patientId}`}><HeartPulse size={14}/>Care plan</Link><Link className="btn" href={`/dashboard/appointments?new=1&patient=${patientId}`}><Plus size={14}/>Book appointment</Link></div></div>
    {error && <div role="alert" className="error">{error}</div>}{message && <div role="status" className="success">{message}</div>}
    <section className="patient-profile-card" aria-label="Patient profile">
      <div className="patient-profile-hero">
        <div className="patient-profile-identity">
          <div className="patient-profile-avatar">
            {patient.photoDataUrl ? <img src={patient.photoDataUrl} alt={`${patient.name} profile`}/> : <span>{initials}</span>}
            <label className="patient-avatar-upload" title="Change patient photo">
              <Camera size={15}/><span className="sr-only">Change patient photo</span>
              <input type="file" accept="image/png,image/jpeg,image/webp" aria-label="Change patient photo" disabled={busy} onChange={uploadPhoto}/>
            </label>
          </div>
          <div className="patient-profile-copy">
            <p className="patient-profile-kicker">Patient file</p>
            <h1>{patient.name}</h1>
            <div className="patient-profile-contact">
              <span><Phone size={14}/>{patient.phone || 'No phone'}</span>
              {patient.email && <span><Mail size={14}/>{patient.email}</span>}
              {patient.address && <span><MapPin size={14}/>{patient.address}</span>}
            </div>
          </div>
        </div>
        <label className="patient-consent-switch">
          <input type="checkbox" checked={patient.whatsappConsent === true} disabled={busy} onChange={event => setWhatsApp(event.target.checked)}/>
          <span>WhatsApp {patient.whatsappConsent ? 'On' : 'Off'}</span>
        </label>
      </div>
      <div className="patient-profile-stats">
        {[[CalendarDays, 'Upcoming', upcoming.length], [HeartPulse, 'Treatments', treatments.length], [Wallet, 'Paid', money(totalPaid)], [Receipt, 'Outstanding', money(outstanding)]].map(([Icon, title, value]) => <div key={title} className="patient-profile-stat"><Icon size={19}/><div><small>{title}</small><strong>{value}</strong></div></div>)}
      </div>
    </section>
    <nav className="patient-profile-tabs" aria-label="Patient profile sections">{tabs.map(([key, title]) => <button key={key} type="button" onClick={() => setTab(key)} aria-current={tab === key ? 'page' : undefined} className={tab === key ? 'is-active' : ''}>{title}{key === 'files' && documents.length ? ` (${documents.length})` : ''}</button>)}</nav>
    {tab === 'overview' && <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]"><section className={card}><h2 className="m-0 border-b border-slate-100 pb-2 text-sm">Patient information</h2><dl className="m-0 grid grid-cols-2 gap-x-4"><Detail title="Phone" value={patient.phone} icon={Phone}/><Detail title="Email" value={patient.email} icon={Mail}/><Detail title="Date of birth" value={patient.dateOfBirth ? day(patient.dateOfBirth) : ''}/><Detail title="Gender" value={label(patient.gender)}/><Detail title="Blood group" value={patient.bloodGroup}/><Detail title="Language" value={patient.preferredLanguage === 'ur' ? 'Urdu' : 'English'}/><div className="col-span-2"><Detail title="Address" value={patient.address} icon={MapPin}/></div></dl>{patient.medicalHistory && <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3"><strong className="flex items-center gap-1.5 text-xs text-amber-900"><ShieldAlert size={14}/>Medical history</strong><p className="m-0 mt-1 whitespace-pre-wrap text-xs text-amber-950">{patient.medicalHistory}</p></div>}</section><section className={card}><div className="flex items-center justify-between border-b border-slate-100 pb-2"><h2 className="m-0 text-sm">Appointments</h2><span className="text-xs text-slate-500">{appointments.length} total</span></div><div className="divide-y divide-slate-100">{appointments.slice(0, 6).map(item => <Link key={item._id} href={`/dashboard/visits/${item._id}`} className="flex items-center justify-between gap-3 py-2.5 text-xs hover:text-emerald-700"><span><strong className="block text-slate-900">{day(item.appointmentDate)} · {item.startsAt}</strong><small className="text-slate-500">{doctorName(item.doctorId)} · {serviceName(item.serviceId)}</small></span><span className="shrink-0 capitalize text-slate-500">{label(item.status)}</span></Link>)}{!appointments.length && <Empty>No appointments yet.</Empty>}</div></section><section className={`${card} lg:col-span-2`}><div className="flex items-center justify-between border-b border-slate-100 pb-2"><h2 className="m-0 text-sm">Recent care</h2><button className="text-xs font-medium text-emerald-700" onClick={() => setTab('care')}>View clinical care</button></div><div className="grid gap-x-6 md:grid-cols-2"><div>{treatments.slice(0, 3).map(item => <div key={item._id} className="border-b border-slate-100 py-2.5 text-xs"><strong className="block text-slate-800">{item.treatmentRendered}</strong><small className="text-slate-500">Teeth {item.toothNumbers || '—'} · {day(item.createdAt)}</small></div>)}{!treatments.length && <Empty>No treatment recorded yet.</Empty>}</div><div>{followUps.slice(0, 3).map(item => <div key={item._id} className="border-b border-slate-100 py-2.5 text-xs"><strong className="block text-slate-800">{item.reason}</strong><small className="text-slate-500">Follow-up {day(item.dueDate)} · {label(item.status)}</small></div>)}{!followUps.length && <Empty>No follow-up tasks.</Empty>}</div></div></section></div>}
    {tab === 'care' && <div className="space-y-4"><div className="grid gap-4 lg:grid-cols-2"><section className={card}><h2 className="m-0 border-b border-slate-100 pb-2 text-sm">Treatments & plans</h2><div className="divide-y divide-slate-100">{treatments.map(item => <div key={item._id} className="py-2.5 text-xs"><strong className="block text-slate-900">{item.treatmentRendered}</strong><span className="text-slate-500">{day(item.createdAt)} · Teeth {item.toothNumbers || '—'}</span>{item.diagnosis && <p className="m-0 mt-1 text-slate-600">{item.diagnosis}</p>}</div>)}{plans.map(item => <div key={item._id} className="py-2.5 text-xs"><strong className="block text-slate-900">{item.title}</strong><span className="text-slate-500">Plan · {label(item.status)} · {money(item.totalFee)}</span></div>)}{!treatments.length && !plans.length && <Empty>No clinical records yet.</Empty>}</div></section><section className={card}><h2 className="m-0 border-b border-slate-100 pb-2 text-sm">Sessions, labs & prescriptions</h2><div className="divide-y divide-slate-100">{sessions.map(item => <div key={item._id} className="py-2.5 text-xs"><strong className="block text-slate-900">{item.title}</strong><span className="text-slate-500">Session · {day(item.scheduledDate)} · {label(item.status)}</span></div>)}{labCases.map(item => <div key={item._id} className="py-2.5 text-xs"><strong className="block text-slate-900">{item.title}</strong><span className="text-slate-500">Lab · due {day(item.dueDate)} · {label(item.status)}</span></div>)}{prescriptions.map(item => <a key={item._id} href={`/api/prescriptions/${item._id}/print`} target="_blank" rel="noreferrer" className="block py-2.5 text-xs hover:text-emerald-700"><strong className="block text-slate-900">Prescription · {label(item.status)}</strong><span className="text-slate-500">{item.medications?.length || 0} medicines · A4 print</span></a>)}{!sessions.length && !labCases.length && !prescriptions.length && <Empty>No sessions, lab cases or prescriptions yet.</Empty>}</div></section></div><ToothHistory profile={profile} documents={documents} patientId={patientId}/></div>}
    {tab === 'billing' && <div className="grid gap-4 lg:grid-cols-2"><section className={card}><h2 className="m-0 border-b border-slate-100 pb-2 text-sm">Invoices</h2><div className="divide-y divide-slate-100">{invoices.map(item => <div key={item._id} className="flex items-center justify-between gap-3 py-3 text-xs"><div><strong className="block text-slate-900">{item.invoiceNumber || 'Invoice'}</strong><span className="text-slate-500">{item.description} · {label(item.status)}</span></div><div className="text-right"><strong className="block">{money(item.totalAmount)}</strong><a href={`/api/invoices/${item._id}/print`} target="_blank" rel="noreferrer" className="text-emerald-700">Print</a></div></div>)}{!invoices.length && <Empty>No invoices yet.</Empty>}</div></section><section className={card}><h2 className="m-0 border-b border-slate-100 pb-2 text-sm">Payments & receipts</h2><div className="divide-y divide-slate-100">{payments.map(item => <div key={item._id} className="flex items-center justify-between gap-3 py-3 text-xs"><div><strong className="block text-slate-900">{money(item.amount)}</strong><span className="text-slate-500">{day(item.createdAt)} · {label(item.paymentMethod)}</span></div><a href={`/api/payments/${item._id}/receipt`} target="_blank" rel="noreferrer" className="text-emerald-700">Receipt</a></div>)}{!payments.length && <Empty>No payments recorded.</Empty>}</div></section></div>}
    {tab === 'files' && <section className={card}><div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3"><div><h2 className="m-0 text-sm">Clinical files</h2><p className="m-0 mt-1 text-xs text-slate-500">X-rays, photos, reports and consent documents.</p></div>{userRole !== 'receptionist' && <details className="group w-full"><summary className="btn cursor-pointer list-none"><Upload size={14}/>Upload file</summary><form onSubmit={upload} className="mt-3 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2"><label className="text-xs">Title<input name="title" required/></label><label className="text-xs">Type<select name="documentType"><option value="xray">X-ray</option><option value="lab_report">Lab report</option><option value="photo">Clinical photo</option><option value="consent_form">Consent form</option><option value="prescription">Prescription</option><option value="other">Other</option></select></label><label className="text-xs">FDI teeth<input name="toothNumbers" placeholder="11, 12"/></label><label className="text-xs">File (JPEG, PNG or PDF)<input type="file" name="file" accept="image/jpeg,image/png,application/pdf" required/></label><label className="text-xs md:col-span-2">Notes<textarea name="notes" rows={2} maxLength={1000}/></label><button disabled={busy} className="md:col-span-2">{busy ? 'Uploading…' : 'Upload file'}</button></form></details>}</div><div className="divide-y divide-slate-100">{documents.map(item => <div key={item._id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-xs"><div><strong className="block text-slate-900">{item.title}</strong><span className="text-slate-500">{label(item.documentType)} · Teeth {item.toothNumbers || '—'}</span></div><div className="flex gap-3"><a href={`/api/patients/${patientId}/documents/${item._id}?view=1`} target="_blank" rel="noreferrer" className="text-emerald-700">View</a><a href={`/api/patients/${patientId}/documents/${item._id}`} className="text-emerald-700">Download</a>{userRole !== 'receptionist' && <button className="text-red-600" onClick={() => removeDocument(item._id)}>Delete</button>}</div></div>)}{!documents.length && <Empty>No files uploaded yet.</Empty>}</div></section>}
    {tab === 'messages' && <div className="space-y-4"><section className={card}><h2 className="m-0 text-sm">Communication preferences</h2><div className="mt-3 grid gap-3 text-xs sm:grid-cols-3"><label className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3"><input type="checkbox" checked={patient.whatsappConsent === true} disabled={busy} onChange={event => setWhatsApp(event.target.checked)}/><span>WhatsApp care messages</span></label><div className="rounded-xl bg-slate-50 p-3">Email reminders: <strong>{patient.emailConsent ? 'On' : 'Off'}</strong></div><div className="rounded-xl bg-slate-50 p-3">Clinic offers: <strong>{patient.marketingConsent ? 'On' : 'Off'}</strong></div></div><p className="m-0 mt-2 text-xs text-slate-500">Only enable WhatsApp after the patient has agreed to receive clinic messages. Turning it off cancels queued WhatsApp sends.</p></section><NotificationHistory patientId={patientId}/></div>}
  </div>;
}
