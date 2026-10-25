'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Copy, ImagePlus, Landmark, LockKeyhole, QrCode, UploadCloud } from 'lucide-react';
import { formatPkr, jazzCashAccount, planDiscount, planSavings } from '@/lib/subscription-plans';

export default function Checkout({ plan }) {
  const [file, setFile] = useState(null);
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [copied, setCopied] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (!file) { setError('Upload your JazzCash payment receipt to continue.'); return; }
    if (file.size > 3 * 1024 * 1024) { setError('Choose a receipt image under 3 MB.'); return; }
    setBusy(true); setError('');
    try {
      const body = new FormData();
      body.set('planId', plan.id);
      body.set('receipt', file);
      body.set('transactionReference', reference);
      const response = await fetch('/api/subscriptions', { method: 'POST', body });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Receipt upload failed');
      setSubmitted(true);
    } catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  }

  if (submitted) return <div className="plans-checkout-success"><span><CheckCircle2 size={34}/></span><p className="eyebrow">PAYMENT REQUEST RECEIVED</p><h1>Receipt submitted for review</h1><p>Your {plan.name} payment request is saved. The super admin will review your receipt before activating the plan.</p><Link className="btn" href="/dashboard/plans">View payment status</Link></div>;

  return <div className="plans-checkout"><Link className="plans-back" href="/dashboard/plans"><ArrowLeft size={16}/> All plans</Link><div className="plans-checkout-heading"><p className="eyebrow">SECURE MANUAL CHECKOUT</p><h1>Activate {plan.name}</h1><p>Pay the exact amount to the JazzCash account below, then upload a clear receipt.</p></div>
    <div className="plans-checkout-grid"><div className="plans-checkout-main">
      <section className="plans-payment-card"><div className="plans-section-title"><span><Landmark size={20}/></span><div><h2>JazzCash payment</h2><p>Transfer to this account using your JazzCash app.</p></div></div><div className="plans-payment-details"><div><small>Account name</small><strong>{jazzCashAccount.name}</strong></div><div><small>JazzCash account number</small><strong>{jazzCashAccount.number}</strong></div><button className="secondary" type="button" onClick={async () => { try { await navigator.clipboard.writeText(jazzCashAccount.number); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { setError('Could not copy. Please select the number above.'); } }}><Copy size={15}/>{copied ? 'Copied' : 'Copy number'}</button></div><div className="plans-qr-placeholder"><QrCode size={30}/><span><strong>Scan to pay</strong><small>QR code will appear here when available. Use the account number above for now.</small></span></div></section>
      <form className="plans-upload-card" onSubmit={submit}><div className="plans-section-title"><span><UploadCloud size={20}/></span><div><h2>Upload your receipt</h2><p>Payment stays pending until the super admin reviews it.</p></div></div><label className="plans-file-drop" htmlFor="subscription-receipt"><ImagePlus size={28}/><strong>{file ? file.name : 'Choose payment receipt'}</strong><small>JPEG, PNG or WebP · maximum 3 MB</small><input id="subscription-receipt" type="file" accept="image/jpeg,image/png,image/webp" required onChange={event => { setFile(event.target.files?.[0] || null); setError(''); }}/></label><label className="plans-reference" htmlFor="subscription-reference">Transaction ID <span>(optional)</span><input id="subscription-reference" value={reference} maxLength={100} onChange={event => setReference(event.target.value)} placeholder="Enter the JazzCash transaction ID"/></label>{error && <p className="error" role="alert">{error}</p>}<button className="plans-submit" type="submit" disabled={busy}>{busy ? 'Uploading receipt…' : 'Submit payment for review'}</button><p className="plans-upload-note"><LockKeyhole size={14}/> Your receipt is visible only to your clinic admin and platform super admin.</p></form>
    </div><aside className="plans-summary"><p className="eyebrow">ORDER SUMMARY</p><h2>{plan.name} plan</h2><div className="plans-summary-line"><span>Billing period</span><strong>{plan.months} {plan.months === 1 ? 'month' : 'months'}</strong></div><div className="plans-summary-line"><span>Monthly equivalent</span><strong>{formatPkr(plan.monthlyPrice)}</strong></div>{plan.months > 1 && <div className="plans-summary-saving">Save {formatPkr(planSavings(plan))} · {planDiscount(plan)}% off monthly pricing</div>}<div className="plans-summary-total"><span>Amount to transfer</span><strong>{formatPkr(plan.price)}</strong></div><p>Use the exact amount so your receipt can be reviewed quickly.</p></aside></div>
  </div>;
}
