'use client';
import { useState } from 'react';
import Link from 'next/link';
import AuthFrame from '@/components/auth-frame';
import { Eye, EyeOff, ArrowRight } from 'lucide-react';
export default function Login() {
  const [error,setError]=useState(''),[busy,setBusy]=useState(false),[show,setShow]=useState(false);
  async function submit(event) {event.preventDefault();setBusy(true);setError('');const form=new FormData(event.currentTarget);try{const response=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(form))});const result=await response.json();if(!response.ok)throw new Error(result.error);window.location.href='/dashboard';}catch(e){setError(e.message);setBusy(false)}}
  return <AuthFrame><h1>Welcome back.</h1><p className="muted">Your team and your patients are waiting.<br/>Sign in to pick up where you left off.</p>{error&&<div className="error" role="alert">{error}</div>}<form onSubmit={submit}><div className="field"><label htmlFor="email">Email or username</label><input id="email" name="email" type="text" autoComplete="username" placeholder="you@yourclinic.com or username" required /></div><div className="field"><label htmlFor="password">Password</label><div className="relative"><input id="password" name="password" type={show?'text':'password'} autoComplete="current-password" placeholder="Enter your password" className="pr-12" required /><button type="button" className="icon-button absolute right-1 top-1" aria-label={show?'Hide password':'Show password'} onClick={()=>setShow(!show)}>{show?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></div><p className="text-right"><Link href="/forgot-password">Forgot password?</Link></p><button disabled={busy} style={{width:'100%'}}>{busy?'Signing in…':'Sign in to workspace'}<ArrowRight size={16}/></button></form><p>New to DentalCare? <Link href="/register-clinic">Create your clinic</Link></p></AuthFrame>;
}
