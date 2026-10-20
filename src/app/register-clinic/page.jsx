'use client';
import { useState } from 'react';
import Link from 'next/link';
import AuthFrame from '@/components/auth-frame';
export default function Register() {
  const [error,setError]=useState(''),[busy,setBusy]=useState(false);
  async function submit(event){event.preventDefault();setBusy(true);setError('');const body=Object.fromEntries(new FormData(event.currentTarget));try{const r=await fetch('/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),data=await r.json();if(!r.ok)throw new Error(data.error);window.location.href='/dashboard';}catch(e){setError(e.message);setBusy(false)}}
  return <AuthFrame><h1>A fresh start for your clinic.</h1><p className="muted">Bring your team and patient care together.</p>{error&&<div className="error" role="alert">{error}</div>}<form onSubmit={submit}>{[['clinicName','Clinic name'],['clinicPhone','Clinic phone'],['address','Address'],['ownerName','Your name'],['email','Email'],['ownerPhone','Your phone'],['password','Password']].map(([key,label])=><div className="field" key={key}><label htmlFor={key}>{label}</label><input id={key} name={key} type={key==='password'?'password':key==='email'?'email':key.toLowerCase().includes('phone')?'tel':'text'} autoComplete={key==='password'?'new-password':undefined} required={['clinicName','clinicPhone','ownerName','email','password'].includes(key)} minLength={key==='password'?8:undefined}/></div>)}<button disabled={busy} style={{width:'100%'}}>{busy?'Creating…':'Create clinic workspace'}</button></form><p>Already registered? <Link href="/login">Sign in</Link></p></AuthFrame>;
}
