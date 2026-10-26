'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, MailCheck } from 'lucide-react';
import AuthFrame from '@/components/auth-frame';

export default function ForgotPasswordPage() {
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [sent, setSent] = useState(false);
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const response = await fetch('/api/auth/forgot-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: new FormData(event.currentTarget).get('email') }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Please try again.');
      setSent(true);
    } catch (cause) { setError(cause.message); } finally { setBusy(false); }
  }
  return <AuthFrame><h1>Forgot password?</h1>{sent ? <><div className="pill"><MailCheck size={15}/> REQUEST RECEIVED</div><p className="muted" role="status">Please check your email for a new password. Your platform administrator will process the request. If the address belongs to an active clinic admin, the temporary password will be sent there.</p><Link href="/login"><ArrowLeft size={16}/> Back to sign in</Link></> : <><p className="muted">Enter the email address you use to sign in as your clinic admin. We will send the request securely to the platform administrator.</p>{error && <div className="error" role="alert">{error}</div>}<form onSubmit={submit}><div className="field"><label htmlFor="reset-email">Admin email address</label><input id="reset-email" name="email" type="email" autoComplete="username" maxLength={254} placeholder="admin@yourclinic.com" required/></div><button type="submit" disabled={busy} style={{ width: '100%' }}>{busy ? 'Submitting…' : 'Request new password'}<ArrowRight size={16}/></button></form><p><Link href="/login"><ArrowLeft size={15}/> Back to sign in</Link></p></>}</AuthFrame>;
}
