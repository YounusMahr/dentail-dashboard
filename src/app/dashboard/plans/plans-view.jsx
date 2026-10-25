'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, BadgePercent, Check, Clock3, CreditCard, ShieldCheck, Sparkles } from 'lucide-react';
import { formatPkr, monthlyBaseline, planDiscount, planSavings, subscriptionPlans } from '@/lib/subscription-plans';

const features = ['Full clinic workspace', 'Appointments and patient records', 'Invoices and care workflows', 'Clinic website and AI assistance', 'WhatsApp and email tools'];

export default function PlansView() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    fetch('/api/subscriptions', { cache: 'no-store' })
      .then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error); return data; })
      .then(data => { if (active) setRequests(data.requests || []); })
      .catch(cause => { if (active) setError(cause.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const pending = requests.find(request => request.status === 'pending_review');

  return <div className="plans-page">
    <div className="plans-heading"><div><span className="eyebrow">DENTALCARE MEMBERSHIP</span><h1>Choose your plan</h1><p>One workspace for your clinic team, patients, appointments and payments.</p></div><span className="plans-heading-icon"><Sparkles size={26}/></span></div>
    {error && <div className="error" role="alert">{error}</div>}
    {pending && <div className="plans-pending" role="status"><Clock3 size={21}/><div><strong>Payment receipt is awaiting review</strong><p>Your {subscriptionPlans.find(plan => plan.id === pending.planId)?.name || 'selected'} plan request was submitted on {new Date(pending.createdAt).toLocaleDateString('en-PK')}. Activation follows super admin approval.</p></div><a href={`/api/subscriptions/${pending._id}/receipt`} target="_blank" rel="noreferrer">View receipt</a></div>}
    <div className="plans-grid">{subscriptionPlans.map(plan => <article key={plan.id} className={`plans-card ${plan.id === 'six-month' ? 'plans-card-featured' : ''}`}>
      <div className="plans-card-top"><span>{plan.id === 'six-month' ? 'MOST POPULAR' : plan.id === 'yearly' ? 'ANNUAL VALUE' : 'FLEXIBLE START'}</span>{plan.months > 1 && <span className="plans-discount"><BadgePercent size={14}/>{planDiscount(plan)}% off</span>}</div>
      <h2>{plan.name}</h2><p className="plans-card-description">{plan.months === 1 ? 'Simple month-to-month access.' : plan.months === 6 ? 'Six months of care, at a lower monthly rate.' : 'A full year of predictable clinic operations.'}</p>
      <div className="plans-price"><strong>{formatPkr(plan.price)}</strong><span>/{plan.months === 1 ? 'month' : plan.months === 6 ? '6 months' : 'year'}</span></div>
      <div className="plans-effective">{formatPkr(plan.monthlyPrice)} per month{plan.months > 1 && <small>Save {formatPkr(planSavings(plan))} vs {formatPkr(monthlyBaseline)}/month</small>}</div>
      {pending ? <span className="plans-activate is-disabled">Awaiting review</span> : <Link className="plans-activate" href={`/dashboard/plans/checkout?plan=${plan.id}`}>Activate plan<ArrowRight size={17}/></Link>}
      <ul>{features.map(feature => <li key={feature}><Check size={15}/>{feature}</li>)}</ul>
    </article>)}</div>
    <div className="plans-footnote"><ShieldCheck size={17}/><span>Pay via JazzCash, upload your receipt, and track the request here. A super admin will review payment before activation.</span></div>
    {!loading && requests.length > 0 && <section className="plans-history"><div><CreditCard size={18}/><h2>Payment requests</h2></div>{requests.map(request => <div className="plans-history-row" key={request._id}><span><strong>{subscriptionPlans.find(plan => plan.id === request.planId)?.name || request.planId}</strong><small>{new Date(request.createdAt).toLocaleString('en-PK')}</small></span><span>{formatPkr(request.amount)}</span><span className={`plans-status status-${request.status}`}>{request.status.replaceAll('_', ' ')}</span><a href={`/api/subscriptions/${request._id}/receipt`} target="_blank" rel="noreferrer">Receipt</a></div>)}</section>}
  </div>;
}
