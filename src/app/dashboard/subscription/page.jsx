'use client';
import { useEffect, useState } from 'react';
export default function Subscription() {
  const [data,setData]=useState(null),[message,setMessage]=useState(''),[interval,setInterval]=useState('monthly');
  async function load(){setData(await(await fetch('/api/subscription')).json())}
  useEffect(()=>{load()},[]);
  async function requestPlan(plan){const r=await fetch('/api/subscription',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({plan,interval})});setMessage(r.ok?'Request sent to platform owner.':'Could not send request');load()}
  return <><div className="top"><h1>Subscription</h1></div>{message&&<div className="success">{message}</div>}{data?.error&&<div className="error">{data.error}</div>}
    <div className="card"><h2>Current plan: {data?.subscription?.plan||'—'}</h2><p>Status: {data?.subscription?.status||'—'} · Ends: {data?.subscription?.periodEndsAt?.slice(0,10)||'—'}</p>{data?.request&&<p>Pending {data.request.action}: {data.request.plan} ({data.request.interval})</p>}</div>
    <div className="field" style={{maxWidth:220,marginTop:20}}><label>Billing interval</label><select value={interval} onChange={e=>setInterval(e.target.value)}><option value="monthly">Monthly</option><option value="yearly">Yearly</option></select></div>
    <div className="grid" style={{marginTop:20}}>{data?.plans?.map(plan=><div className="card" key={plan.slug}><h2>{plan.name}</h2><div className="metric">PKR {Number(interval==='monthly'?plan.priceMonthly:plan.priceAnnual).toLocaleString()}</div><p>per {interval==='monthly'?'month':'year'}</p><p>{plan.maxDoctors} doctors · {plan.maxStaff} staff · {plan.maxPatients} patients</p><button className="secondary" onClick={()=>requestPlan(plan.slug)}>{data.subscription?.plan===plan.slug?'Request renewal':'Request plan'}</button></div>)}</div>
    <div className="card" style={{marginTop:20}}><h2>Billing history</h2>{data?.invoices?.map(invoice=><p key={invoice._id}>{invoice.invoiceNumber} · PKR {Number(invoice.amount).toLocaleString()} · {invoice.status}</p>)}</div>
  </>;
}
