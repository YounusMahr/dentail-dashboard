'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, CalendarDays, CheckCircle2, CircleDollarSign, ClipboardPlus, FileText, HeartPulse, Printer, RefreshCw, UserRound } from 'lucide-react';
import VisitPrescriptionEditor from './visit-prescription-editor';

const label = value => String(value || '').replaceAll('_', ' ');
const amount = value => Number(value || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 });
const today = timezone => new Date().toLocaleDateString('en-CA', { timeZone: timezone || 'Asia/Karachi' });
const card = 'rounded-2xl border border-emerald-950/10 bg-white p-5 shadow-[0_12px_35px_rgba(12,54,42,.04)] md:p-6';
const field = 'rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm';

export default function VisitPage() {
  const { appointmentId } = useParams();
  const [visit, setVisit] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState('');
  const [treatment, setTreatment] = useState({ diagnosis: '', treatmentRendered: '', clinicalNotes: '', toothNumbers: '', serviceId: '', createInvoice: false, completeAppointment: true });
  const [fee, setFee] = useState({ feeType: 'consultation', serviceId: '', description: '', unitPrice: '', discountAmount: 0 });
  const [payment, setPayment] = useState({ invoiceId: '', amount: '', paymentMethod: 'cash', transactionReference: '' });
  const [next, setNext] = useState({ date: '', time: '', serviceId: '' });
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [rx, setRx] = useState({ language: 'bilingual', medications: [], instructionsEn: '', instructionsUr: '', reviewDate: '' });
  const rxLoaded = useRef('');
  const paymentKey = useRef('');

  const load = useCallback(async () => {
    const response = await fetch(`/api/visits/${appointmentId}`, { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not load this visit');
    setVisit(data);
    if (data.prescription && rxLoaded.current !== String(data.prescription._id)) {
      setRx({ language: data.prescription.language || 'bilingual', medications: data.prescription.medications || [], instructionsEn: data.prescription.instructionsEn || '', instructionsUr: data.prescription.instructionsUr || '', reviewDate: data.prescription.reviewDate || '' });
      rxLoaded.current = String(data.prescription._id);
    }
    return data;
  }, [appointmentId]);
  useEffect(() => { load().catch(e => setError(e.message)); }, [load]);
  useEffect(() => {
    if (!visit) return;
    setTreatment(value => ({ ...value, serviceId: value.serviceId || visit.appointment.serviceId || '' }));
    setNext(value => ({ ...value, serviceId: value.serviceId || visit.appointment.serviceId || '' }));
    setFee(value => value.description ? value : visit.service ? { ...value, feeType: 'treatment', serviceId: String(visit.service._id), description: visit.service.name, unitPrice: visit.service.standardFee ?? '' } : { ...value, feeType: 'consultation', description: 'Doctor consultation fee', unitPrice: visit.doctor?.consultationFee ?? '' });
  }, [visit?.appointment?._id]);
  useEffect(() => {
    if (!visit?.appointment?.doctorId || !next.date) { setSlots([]); return; }
    const controller = new AbortController();
    setSlotsLoading(true);
    fetch(`/api/appointments/slots?doctorId=${visit.appointment.doctorId}&date=${next.date}`, { signal: controller.signal })
      .then(r => r.json()).then(data => { if (!controller.signal.aborted) setSlots(data.slots || []); })
      .catch(e => { if (e.name !== 'AbortError') setError('Available times could not be loaded'); })
      .finally(() => { if (!controller.signal.aborted) setSlotsLoading(false); });
    return () => controller.abort();
  }, [visit?.appointment?.doctorId, next.date]);

  async function send(path, body, task, success, method = 'POST') {
    setError(''); setNotice(''); setBusy(task);
    try {
      const response = await fetch(path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not save changes');
      await load();
      setNotice(success);
      return result;
    } catch (e) { setError(e.message); return null; }
    finally { setBusy(''); }
  }
  async function changeStatus(status) {
    await send(`/api/records/appointments/${appointmentId}`, { status }, 'status', `Visit marked ${label(status)}.`, 'PATCH');
  }
  async function saveTreatment(event) {
    event.preventDefault();
    const result = await send('/api/records/treatments', { ...treatment, appointmentId, patientId: visit.appointment.patientId, doctorId: visit.appointment.doctorId, createInvoice: treatment.createInvoice && !visit.invoices.length, ...(!visit.prescription || visit.prescription.status === 'draft' ? { prescriptionDraft: rx } : {}) }, 'treatment', 'Treatment saved to the patient file.');
    if (result) setTreatment(value => ({ ...value, diagnosis: '', treatmentRendered: '', clinicalNotes: '', toothNumbers: '', createInvoice: false }));
  }
  async function saveInvoice(event) {
    event.preventDefault();
    await send('/api/records/invoices', { appointmentId, patientId: visit.appointment.patientId, doctorId: visit.appointment.doctorId, feeType: fee.feeType, items: [{ serviceId: fee.feeType === 'treatment' ? fee.serviceId : '', description: fee.description, quantity: 1, unitPrice: fee.unitPrice }], discountAmount: fee.discountAmount, dueDate: today(visit.timezone) }, 'invoice', 'Invoice created with the visit details.');
  }
  async function savePayment(event) {
    event.preventDefault();
    if (!paymentKey.current) paymentKey.current = crypto.randomUUID();
    const result = await send(`/api/invoices/${payment.invoiceId || openInvoice?._id}/payments`, { amount: payment.amount, paymentMethod: payment.paymentMethod, transactionReference: payment.transactionReference, idempotencyKey: paymentKey.current }, 'payment', 'Payment recorded. The invoice balance is updated.');
    if (result) { paymentKey.current = ''; setPayment(value => ({ ...value, amount: '', transactionReference: '' })); }
  }
  async function bookNext(event) {
    event.preventDefault();
    const result = await send('/api/records/appointments', { patientId: visit.appointment.patientId, doctorId: visit.appointment.doctorId, serviceId: next.serviceId, appointmentDate: next.date, startsAt: next.time, patientNotes: `Follow-up to visit on ${visit.appointment.appointmentDate}` }, 'booking', 'Next appointment booked for this patient.');
    if (result) setNext(value => ({ ...value, date: '', time: '' }));
  }
  if (!visit) return <div className={card}>{error ? <p role="alert" className="text-red-700">{error}</p> : <p className="text-slate-500">Loading visit…</p>}<Link className="text-link" href="/dashboard/appointments">Back to appointments</Link></div>;
  const { appointment, patient, doctor, service, invoices, treatments, payments, otherAppointments, role, currency, visitSession, prescription } = visit;
  const financial = role === 'clinic_admin' || role === 'receptionist';
  const clinical = role === 'clinic_admin' || role === 'dentist';
  const active = !['cancelled', 'no_show'].includes(appointment.status);
  const openInvoice = invoices.find(invoice => Number(invoice.balanceAmount) > 0);
  const selectedInvoice = invoices.find(invoice => String(invoice._id) === payment.invoiceId) || openInvoice;
  const upcoming = otherAppointments.filter(item => item.appointmentDate >= today(visit.timezone) && !['cancelled', 'no_show'].includes(item.status));
  const balance = invoices.reduce((total, invoice) => total + Number(invoice.balanceAmount || 0), 0);
  return <div className="mx-auto max-w-7xl space-y-5 pb-10">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><Link href="/dashboard/appointments" className="mb-3 inline-flex items-center gap-2 text-xs text-emerald-700 hover:underline"><ArrowLeft size={15}/>Appointments</Link><div className="eyebrow">CONNECTED PATIENT VISIT</div><h1 className="mb-1">{patient.name}</h1><p className="muted">{appointment.appointmentDate} · {appointment.startsAt}–{appointment.endsAt || ''} · {doctor?.name || 'Dentist'}</p></div><div className="visit-header-actions"><span className={`status-badge status-${appointment.status}`}>{label(appointment.status)}</span>{active && ['pending', 'confirmed'].includes(appointment.status) && <button type="button" disabled={!!busy} onClick={() => changeStatus('checked_in')}>Check in</button>}{active && appointment.status === 'checked_in' && <button type="button" disabled={!!busy} onClick={() => changeStatus('in_progress')}>Start visit</button>}{active && appointment.status === 'in_progress' && <button type="button" disabled={!!busy} onClick={() => changeStatus('completed')}>Complete visit</button>}<button className="secondary" onClick={() => load().catch(e => setError(e.message))} aria-label="Refresh visit"><RefreshCw size={15}/></button>{prescription && <a className="btn secondary" href={`/api/prescriptions/${prescription._id}/print`} target="_blank" rel="noreferrer"><Printer size={15}/>A4 prescription</a>}<Link className="btn secondary" href={`/dashboard/patients/${patient._id}`}><UserRound size={15}/>Patient file</Link></div></div>
    {error && <div role="alert" className="error">{error}</div>}{notice && <div role="status" className="success">{notice}</div>}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[[CalendarDays, 'Appointment', `${appointment.startsAt} · ${label(appointment.status)}`], [HeartPulse, 'Procedure', service?.name || 'Consultation / checkup'], [ClipboardPlus, 'Visit session', visitSession?label(visitSession.status):'Legacy booking'], [CircleDollarSign, 'Balance due', `${currency} ${amount(balance)}`]].map(([Icon, title, detail]) => <div key={title} className="rounded-2xl border border-emerald-100 bg-white p-4"><Icon size={19} className="mb-3 text-emerald-700"/><small className="block text-slate-500">{title}</small><strong className="mt-1 block text-sm text-slate-900">{detail}</strong></div>)}</div>

    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(300px,1fr)]"><div className="space-y-5">
      <details className="visit-context" defaultOpen={Boolean(patient.medicalHistory)}>
        <summary><UserRound size={17}/><strong>Patient context</strong><span>{patient.medicalHistory ? 'Medical history on file · review before treatment' : patient.phone || 'View patient details'}</span></summary>
        <div className="visit-context-content"><div><small>Phone</small><strong>{patient.phone || '—'}</strong></div><div><small>Email</small><strong>{patient.email || '—'}</strong></div><div><small>Visit note</small><strong>{appointment.patientNotes || 'No visit note recorded.'}</strong></div>{patient.medicalHistory && <div className="visit-medical-alert"><small>Medical history</small><strong>{patient.medicalHistory}</strong></div>}</div>
      </details>
      {clinical && active && <section className={`${card} visit-treatment-card`} id="record-treatment">
        <div className="visit-treatment-heading"><div className="flex items-center gap-3"><span className="rounded-xl bg-sky-50 p-2 text-sky-700"><HeartPulse size={20}/></span><div><h2 className="mb-0">Record treatment</h2><p className="mb-0 text-xs text-slate-500">Patient, dentist and appointment are linked.</p></div></div></div>
        <form onSubmit={saveTreatment} className="visit-treatment-form">
          <div className="grid gap-3 md:grid-cols-2"><label>Procedure<select className={field} value={treatment.serviceId} onChange={e => setTreatment({ ...treatment, serviceId: e.target.value })}><option value="">No procedure selected</option>{visit.services.map(item => <option key={item._id} value={item._id}>{item.name}</option>)}</select></label><label>FDI tooth numbers<input className={field} value={treatment.toothNumbers} onChange={e => setTreatment({ ...treatment, toothNumbers: e.target.value })} placeholder="e.g. 11, 12"/></label></div>
          <div className="grid gap-3 md:grid-cols-2"><label>Diagnosis *<textarea required rows={2} value={treatment.diagnosis} onChange={e => setTreatment({ ...treatment, diagnosis: e.target.value })}/></label><label>Treatment rendered *<textarea required rows={2} value={treatment.treatmentRendered} onChange={e => setTreatment({ ...treatment, treatmentRendered: e.target.value })}/></label></div>
          <details className="visit-optional-notes"><summary>Clinical notes <span>Optional</span></summary><label className="mt-2 block">Private treatment notes<textarea rows={2} value={treatment.clinicalNotes} onChange={e => setTreatment({ ...treatment, clinicalNotes: e.target.value })}/></label></details>
          <VisitPrescriptionEditor value={rx} onChange={setRx} printUrl={prescription ? `/api/prescriptions/${prescription._id}/print` : null} locked={prescription?.status === 'issued'}/>
          <div className="visit-treatment-actions"><div className="visit-treatment-options"><label><input className="check" type="checkbox" checked={treatment.completeAppointment} onChange={e => setTreatment({ ...treatment, completeAppointment: e.target.checked })}/>Complete appointment</label>{!invoices.length && treatment.serviceId && <label><input className="check" type="checkbox" checked={treatment.createInvoice} onChange={e => setTreatment({ ...treatment, createInvoice: e.target.checked })}/>Create service invoice</label>}</div><button disabled={!!busy} type="submit"><CheckCircle2 size={16}/>{busy === 'treatment' ? 'Saving…' : 'Save treatment'}</button></div>
        </form>
      </section>}
      <section className={card}><div className="mb-3 flex items-center justify-between"><h2 className="mb-0">Care history for this visit</h2><span className="subtle-chip">{treatments.length} records</span></div>{treatments.length ? <div className="divide-y divide-slate-100">{treatments.map(item => <div key={item._id} className="py-3 text-xs"><strong className="block text-sm">{item.treatmentRendered}</strong>{item.diagnosis && <p className="mb-1 text-slate-600">Diagnosis: {item.diagnosis}</p>}{item.toothNumbers && <p className="mb-1 text-slate-500">Teeth: {item.toothNumbers}</p>}{item.createdAt && <small className="text-slate-400">{new Date(item.createdAt).toLocaleString('en-GB')}</small>}{role !== 'receptionist' && <a className="mt-2 inline-flex items-center gap-1 text-emerald-700" href={`/api/treatments/${item._id}/print`} target="_blank" rel="noreferrer"><Printer size={13}/>Print treatment record</a>}</div>)}</div> : <p className="mb-0 text-xs text-slate-500">Treatment notes saved during this visit will appear here.</p>}</section>
    </div><div className="space-y-5">
      <section className={card}><div className="mb-4 flex items-center gap-3"><span className="rounded-xl bg-violet-50 p-2 text-violet-700"><FileText size={20}/></span><div><h2 className="mb-0">Billing & payments</h2><p className="mb-0 text-xs text-slate-500">Consultation, checkup or treatment fee</p></div></div>{invoices.map(invoice => <div key={invoice._id} className="mb-3 rounded-xl border border-slate-200 p-3 text-xs"><div className="flex justify-between gap-2"><strong>{invoice.invoiceNumber}</strong><span className={`status-badge status-${invoice.status}`}>{label(invoice.status)}</span></div><p className="mb-1 mt-2 text-slate-600">{label(invoice.feeType)} · {invoice.description}</p><div className="flex justify-between"><span>Total {currency} {amount(invoice.totalAmount)}</span><strong>Due {currency} {amount(invoice.balanceAmount)}</strong></div><a href={`/api/invoices/${invoice._id}/print`} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-emerald-700"><Printer size={13}/>Print invoice</a></div>)}{!invoices.length && financial && active && <form onSubmit={saveInvoice} className="space-y-3"><label>Fee type<select value={fee.feeType} onChange={e => { const type = e.target.value; setFee(type === 'treatment' ? { ...fee, feeType: type, serviceId: service?._id ? String(service._id) : '', description: service?.name || '', unitPrice: service?.standardFee ?? '' } : { ...fee, feeType: type, serviceId: '', description: type === 'checkup' ? 'Dental checkup fee' : 'Doctor consultation fee', unitPrice: doctor?.consultationFee ?? '' }); }}><option value="consultation">Consultation</option><option value="checkup">Checkup</option><option value="treatment">Treatment</option></select></label>{fee.feeType === 'treatment' && <label>Service<select value={fee.serviceId} onChange={e => { const item = visit.services.find(s => String(s._id) === e.target.value); setFee({ ...fee, serviceId: e.target.value, description: item?.name || '', unitPrice: item?.standardFee ?? '' }); }}><option value="">Custom fee</option>{visit.services.map(item => <option key={item._id} value={item._id}>{item.name}</option>)}</select></label>}<label>Description<input required value={fee.description} onChange={e => setFee({ ...fee, description: e.target.value })}/></label><div className="grid grid-cols-2 gap-3"><label>Fee ({currency})<input required type="number" min="0" step="0.01" value={fee.unitPrice} onChange={e => setFee({ ...fee, unitPrice: e.target.value })}/></label><label>Discount<input type="number" min="0" step="0.01" value={fee.discountAmount} onChange={e => setFee({ ...fee, discountAmount: e.target.value })}/></label></div><button type="submit" disabled={!!busy}><FileText size={15}/>{busy === 'invoice' ? 'Creating…' : 'Create invoice'}</button></form>}{!invoices.length && !financial && <p className="text-xs text-slate-500">The front desk can add a consultation or treatment invoice here.</p>}{invoices.length > 0 && financial && openInvoice && <form onSubmit={savePayment} className="mt-4 space-y-3 border-t border-slate-100 pt-4"><h3 className="mb-1 text-sm">Receive payment</h3><label>Invoice<select value={payment.invoiceId || String(openInvoice._id)} onChange={e => setPayment({ ...payment, invoiceId: e.target.value, amount: '' })}>{invoices.filter(i => Number(i.balanceAmount) > 0).map(i => <option key={i._id} value={i._id}>{i.invoiceNumber} · due {currency} {amount(i.balanceAmount)}</option>)}</select></label><div className="grid grid-cols-2 gap-3"><label>Amount ({currency})<input required type="number" min="0.01" max={selectedInvoice?.balanceAmount} step="0.01" value={payment.amount} onChange={e => setPayment({ ...payment, amount: e.target.value })}/></label><label>Method<select value={payment.paymentMethod} onChange={e => setPayment({ ...payment, paymentMethod: e.target.value })}><option value="cash">Cash</option><option value="card">Card</option><option value="bank_transfer">Bank transfer</option><option value="easypaisa_jazzcash">Easypaisa / JazzCash</option></select></label></div><label>Reference (optional)<input value={payment.transactionReference} onChange={e => setPayment({ ...payment, transactionReference: e.target.value })}/></label><button type="submit" disabled={!!busy}><CircleDollarSign size={15}/>{busy === 'payment' ? 'Recording…' : 'Record payment'}</button></form>}{payments.length > 0 && <div className="mt-4 border-t border-slate-100 pt-3"><h3 className="text-xs">Recent receipts</h3>{payments.slice(0, 3).map(item => <a key={item._id} href={`/api/payments/${item._id}/receipt`} target="_blank" rel="noreferrer" className="block py-1 text-xs text-emerald-700">{currency} {amount(item.amount)} · {label(item.paymentMethod)} · Print receipt</a>)}</div>}</section>
      <section className={card}><div className="mb-4 flex items-center gap-3"><span className="rounded-xl bg-amber-50 p-2 text-amber-700"><CalendarDays size={20}/></span><div><h2 className="mb-0">Next visit & follow-up</h2><p className="mb-0 text-xs text-slate-500">The patient and dentist carry over automatically. For patients with messaging enabled, WhatsApp and email reminders run two days before; WhatsApp repeats about one hour before.</p></div></div>{upcoming.map(item => <Link key={item._id} href={`/dashboard/visits/${item._id}`} className="mb-3 flex items-center justify-between rounded-xl bg-emerald-50 p-3 text-xs text-emerald-900"><span><strong>{item.appointmentDate}</strong> · {item.startsAt}</span><ArrowRight size={15}/></Link>)}{active && <form onSubmit={bookNext} className="space-y-3"><label>Next appointment date<input type="date" min={today(visit.timezone)} required value={next.date} onChange={e => setNext({ ...next, date: e.target.value, time: '' })}/></label><label>Available time<select required disabled={!next.date || slotsLoading} value={next.time} onChange={e => setNext({ ...next, time: e.target.value })}><option value="">{slotsLoading ? 'Loading…' : 'Choose a time'}</option>{slots.map(time => <option key={time} value={time}>{time}</option>)}</select></label><label>Procedure<select value={next.serviceId} onChange={e => setNext({ ...next, serviceId: e.target.value })}><option value="">Consultation / checkup</option>{visit.services.map(item => <option key={item._id} value={item._id}>{item.name}</option>)}</select></label><button disabled={!!busy || !next.time} type="submit"><CalendarDays size={15}/>{busy === 'booking' ? 'Booking…' : 'Book next visit'}</button></form>}</section>

      <section className={card}><h2 className="mb-3">Earlier appointments</h2>{otherAppointments.length ? otherAppointments.map(item => <Link key={item._id} href={`/dashboard/visits/${item._id}`} className="flex items-center justify-between border-b border-slate-100 py-2 text-xs last:border-0"><span>{item.appointmentDate} · {item.startsAt}</span><span className="capitalize text-slate-500">{label(item.status)}</span></Link>) : <p className="mb-0 text-xs text-slate-500">This is the first recorded appointment.</p>}</section>
    </div></div>
  </div>;
}
