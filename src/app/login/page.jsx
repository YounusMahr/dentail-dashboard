'use client';
import { useState } from 'react';
import Link from 'next/link';
export default function Login() {
  const [error,setError]=useState(''),[busy,setBusy]=useState(false);
  async function submit(event) {event.preventDefault();setBusy(true);setError('');const form=new FormData(event.currentTarget);try{const response=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(form))});const result=await response.json();if(!response.ok)throw new Error(result.error);window.location.href='/dashboard';}catch(e){setError(e.message);setBusy(false)}}
  return <main className="auth"><div className="card"><h1>Welcome back</h1><p className="muted">Sign in to your clinic workspace.</p>{error&&<div className="error">{error}</div>}<form onSubmit={submit}><div className="field"><label>Email</label><input name="email" type="email" required /></div><div className="field"><label>Password</label><input name="password" type="password" required /></div><button disabled={busy} style={{width:'100%'}}>{busy?'Signing in…':'Sign in'}</button></form><p>New clinic? <Link href="/register-clinic">Register here</Link></p></div></main>;
}
