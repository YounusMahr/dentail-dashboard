'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, LoaderCircle } from 'lucide-react';
import Dialog from './dialog';

export default function ConfirmDialog({ title, description, detail, confirmLabel = 'Confirm', cancelLabel = 'Keep record', onConfirm, onClose, blocked = false, link, tone = 'danger' }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);

  async function confirm() {
    if (pending.current || blocked) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      await onConfirm();
      onClose();
    } catch (cause) {
      setError(cause.message || 'This action could not be completed. Please try again.');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return <Dialog title={title} onClose={() => { if (!busy) onClose(); }} className="confirm-dialog">
    <div className={`confirm-dialog-icon ${blocked ? 'is-blocked' : tone === 'danger' ? 'is-danger' : 'is-neutral'}`} aria-hidden="true">{blocked ? <AlertTriangle size={23}/> : tone === 'danger' ? <AlertTriangle size={23}/> : <CheckCircle2 size={23}/>}</div>
    <p className="confirm-dialog-description">{description}</p>
    {detail && <p className="confirm-dialog-detail">{detail}</p>}
    {error && <p className="confirm-dialog-error" role="alert">{error}</p>}
    <div className="confirm-dialog-actions">
      {link && <Link className="btn secondary" href={link.href} onClick={onClose}>{link.label}</Link>}
      <button type="button" className="secondary" disabled={busy} onClick={onClose}>{blocked ? 'Close' : cancelLabel}</button>
      {!blocked && <button type="button" className={tone === 'danger' ? 'danger' : ''} disabled={busy} onClick={confirm}>{busy && <LoaderCircle size={15} className="animate-spin"/>}{busy ? 'Working…' : confirmLabel}</button>}
    </div>
  </Dialog>;
}
