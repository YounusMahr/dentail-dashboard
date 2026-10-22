"use client";
import { useEffect, useState } from 'react';
import { Printer, Activity, Wallet, Users, SlidersHorizontal } from 'lucide-react';

const money = n => Number(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 });

export default function Reports() {
  const [d, setD] = useState(null),
    [range, setRange] = useState('this_month'),
    [from, setFrom] = useState(''),
    [to, setTo] = useState(''),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true);

  useEffect(() => {
    if (range === 'custom' && (!from || !to)) return;
    setLoading(true);
    const controller = new AbortController();
    fetch(`/api/reports?${new URLSearchParams({ range, from, to })}`, { signal: controller.signal })
      .then(async r => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        setD(data);
        setError('');
      })
      .catch(e => {
        if (e.name !== 'AbortError') setError(e.message);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [range, from, to]);

  const periods = [
    ['today', 'Today'],
    ['this_week', 'This week'],
    ['this_month', 'This month'],
    ['last_month', 'Last month'],
    ['this_year', 'Year to date'],
    ['custom', 'Custom dates']
  ];

  return (
    <div className="report-workspace">
      {/* Top Header & Compact Filter Toolbar */}
      <div className="top" style={{ marginBottom: 12, alignItems: 'center' }}>
        <div>
          <div className="eyebrow">PRACTICE INTELLIGENCE</div>
          <h1 style={{ fontSize: 22, margin: '2px 0' }}>Financial & clinical reports</h1>
          <p className="muted" style={{ margin: 0, fontSize: 11 }}>
            Collections, procedures and dentist performance {d?.from ? `· ${d.from} to ${d.to}` : ''}
          </p>
        </div>

        <div className="row report-toolbar" style={{ gap: 8 }}>
          <select
            aria-label="Report period"
            value={range}
            onChange={e => setRange(e.target.value)}
            style={{ padding: '6px 10px', fontSize: 11, width: 'auto' }}
          >
            {periods.map(([v, l]) => (
              <option value={v} key={v}>{l}</option>
            ))}
          </select>

          {range === 'custom' && (
            <>
              <input
                aria-label="From date"
                type="date"
                value={from}
                onChange={e => setFrom(e.target.value)}
                style={{ padding: '5px 8px', fontSize: 11, width: 'auto' }}
              />
              <input
                aria-label="To date"
                type="date"
                value={to}
                onChange={e => setTo(e.target.value)}
                style={{ padding: '5px 8px', fontSize: 11, width: 'auto' }}
              />
            </>
          )}

          <button
            type="button"
            className="secondary"
            onClick={() => window.print()}
            style={{ padding: '6px 12px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Printer size={14} />
            <span>Print report</span>
          </button>
        </div>
      </div>

      {error && <div className="error" role="alert">{error}</div>}

      {/* 6 Executive KPI Summary Cards */}
      {d && (
        <>
          <div className="report-kpi-grid">
            <div className="report-kpi-card" style={{ borderLeft: '3px solid #10b981' }}>
              <small>
                <span>Collected</span>
                <span className="pill" style={{ padding: '2px 6px', fontSize: 9 }}>{d.currency}</span>
              </small>
              <div className="kpi-val" style={{ color: '#0e7955' }}>{money(d.totalPaid)}</div>
              <div className="kpi-sub">Realized payments</div>
            </div>

            <div className="report-kpi-card">
              <small><span>Billed Revenue</span></small>
              <div className="kpi-val">{money(d.totalBilled)}</div>
              <div className="kpi-sub">{d.invoiceCount || 0} active invoices</div>
            </div>

            <div className="report-kpi-card" style={{ borderLeft: d.outstanding > 0 ? '3px solid #f59e0b' : undefined }}>
              <small><span>Period Outstanding</span></small>
              <div className="kpi-val" style={{ color: d.outstanding > 0 ? '#b45309' : undefined }}>{money(d.outstanding)}</div>
              <div className="kpi-sub">Unpaid from this period</div>
            </div>

            <div className="report-kpi-card">
              <small><span>All Receivables</span></small>
              <div className="kpi-val">{money(d.allReceivables)}</div>
              <div className="kpi-sub">Total practice ledger debt</div>
            </div>

            <div className="report-kpi-card">
              <small><span>Discounts Given</span></small>
              <div className="kpi-val">{money(d.discounts)}</div>
              <div className="kpi-sub">Fee concessions</div>
            </div>

            <div className="report-kpi-card" style={{ borderLeft: '3px solid #14b8a6' }}>
              <small><span>Collection Rate</span></small>
              <div className="kpi-val" style={{ color: '#0f766e' }}>{d.collectionRate}%</div>
              <div className="report-bar-bg">
                <div className="report-bar-fill" style={{ width: `${Math.min(100, d.collectionRate)}%`, background: '#10b981' }} />
              </div>
            </div>
          </div>

          {/* Row 1: Chair Activity & Payment Channels */}
          <div className="report-grid-two">
            {/* Chair Activity */}
            <section className="card report-card">
              <h2><Activity size={15} className="text-emerald-600"/> Chair Productivity & Schedule</h2>
              <div className="row" style={{ gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                <span className="pill" style={{ background: '#f1f5f9', color: '#334155', fontSize: 10 }}>
                  <strong>{d.appointmentCount}</strong> total booked
                </span>
                <span className="pill" style={{ background: '#ecfdf5', color: '#166534', fontSize: 10 }}>
                  <strong>{d.completedAppointments}</strong> completed
                </span>
                <span className="pill" style={{ background: '#fef2f2', color: '#991b1b', fontSize: 10 }}>
                  <strong>{d.cancelledAppointments}</strong> cancelled / no-show
                </span>
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>
                Completion rate: <strong>{d.appointmentCount ? Math.round(d.completedAppointments / d.appointmentCount * 100) : 0}%</strong>
              </div>
              <div className="report-bar-bg" style={{ marginBottom: 12 }}>
                <div
                  className="report-bar-fill"
                  style={{
                    width: `${d.appointmentCount ? Math.round(d.completedAppointments / d.appointmentCount * 100) : 0}%`,
                    background: '#10b981'
                  }}
                />
              </div>
              <div className="row" style={{ gap: 6, flexWrap: 'wrap', paddingTop: 6, borderTop: '1px solid #f1f5f2' }}>
                {d.invoiceStatuses.map(s => (
                  <span key={s.status} className="status-badge" style={{ fontSize: 9, padding: '3px 8px' }}>
                    {s.status.replaceAll('_', ' ')}: <strong>{s.count}</strong>
                  </span>
                ))}
              </div>
            </section>

            {/* Payment Methods */}
            <section className="card report-card">
              <h2><Wallet size={15} className="text-emerald-600"/> Payment Methods Breakdown</h2>
              <div>
                {d.paymentMethods.map(([method, amount]) => {
                  const pct = d.totalPaid ? Math.round(amount / d.totalPaid * 100) : 0;
                  return (
                    <div className="report-bar-row" key={method}>
                      <div style={{ flex: 1, minWidth: 0, paddingRight: 10 }}>
                        <div className="row between">
                          <span style={{ textTransform: 'capitalize', fontWeight: 500 }}>{method.replaceAll('_', ' ')}</span>
                          <span className="muted" style={{ fontSize: 10 }}>{pct}%</span>
                        </div>
                        <div className="report-bar-bg">
                          <div className="report-bar-fill" style={{ width: `${pct}%`, background: '#0d9488' }} />
                        </div>
                      </div>
                      <strong style={{ fontSize: 12, minWidth: 80, textAlign: 'right' }}>
                        {d.currency} {money(amount)}
                      </strong>
                    </div>
                  );
                })}
                {!d.paymentMethods.length && <p className="muted" style={{ margin: '8px 0', fontSize: 11 }}>No payments recorded in this period.</p>}
              </div>
            </section>
          </div>

          {/* Row 2: Dentist Performance Table */}
          <section className="card report-card" style={{ marginBottom: 12 }}>
            <h2><Users size={15} className="text-emerald-600"/> Dentist Performance & Production</h2>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Dentist</th>
                    <th style={{ textAlign: 'center' }}>Appts</th>
                    <th style={{ textAlign: 'center' }}>Completed</th>
                    <th style={{ textAlign: 'center' }}>Treatments</th>
                    <th style={{ textAlign: 'right' }}>Billed ({d.currency})</th>
                    <th style={{ textAlign: 'right' }}>Collected ({d.currency})</th>
                  </tr>
                </thead>
                <tbody>
                  {d.doctorPerformance.map((x, i) => (
                    <tr key={i}>
                      <td>
                        <strong>{x.name}</strong>
                        <small className="block text-slate-400" style={{ fontSize: 9 }}>{x.specialization || 'Dentist'}</small>
                      </td>
                      <td style={{ textAlign: 'center' }}>{x.appointments}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="status-badge status-completed" style={{ fontSize: 9 }}>{x.completed}</span>
                      </td>
                      <td style={{ textAlign: 'center' }}>{x.treatments}</td>
                      <td style={{ textAlign: 'right', fontWeight: 500 }}>{money(x.billed)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: '#0e7955' }}>{money(x.collected)}</td>
                    </tr>
                  ))}
                  {!d.doctorPerformance.length && (
                    <tr><td colSpan={6} style={{ textAlign: 'center', color: '#94a3b8' }}>No doctor performance data available.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Row 3: Categories & Top Procedures */}
          <div className="report-grid-two">
            <section className="card report-card">
              <h2>Revenue by Service Category</h2>
              <div>
                {d.categories.map(x => (
                  <div className="report-bar-row" key={x.name}>
                    <div>
                      <strong style={{ fontSize: 11 }}>{x.name}</strong>
                      <small className="block text-slate-400" style={{ fontSize: 9 }}>{x.count} procedures</small>
                    </div>
                    <strong style={{ fontSize: 12 }}>{d.currency} {money(x.amount)}</strong>
                  </div>
                ))}
                {!d.categories.length && <p className="muted" style={{ margin: '8px 0', fontSize: 11 }}>No category revenue recorded.</p>}
              </div>
            </section>

            <section className="card report-card">
              <h2>Top Billed Procedures</h2>
              <div>
                {d.procedures.map((x, i) => (
                  <div className="report-bar-row" key={x.name || i}>
                    <div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                      <strong style={{ fontSize: 11, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.name}</strong>
                      <small className="block text-slate-400" style={{ fontSize: 9 }}>{x.count} billed</small>
                    </div>
                    <strong style={{ fontSize: 12, flexShrink: 0 }}>{d.currency} {money(x.amount)}</strong>
                  </div>
                ))}
                {!d.procedures.length && <p className="muted" style={{ margin: '8px 0', fontSize: 11 }}>No billed procedures in this period.</p>}
              </div>
            </section>
          </div>

          {/* Row 4: Recent Payment Audit Ledger */}
          <section className="card report-card" style={{ marginBottom: 12 }}>
            <h2>Recent Payment Ledger</h2>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Patient</th>
                    <th>Invoice #</th>
                    <th>Date</th>
                    <th>Method</th>
                    <th style={{ textAlign: 'right' }}>Amount ({d.currency})</th>
                    <th style={{ textAlign: 'center' }}>Receipt</th>
                  </tr>
                </thead>
                <tbody>
                  {d.transactions.map(t => (
                    <tr key={t._id}>
                      <td><strong>{t.patient}</strong></td>
                      <td><code>{t.invoice}</code></td>
                      <td>{new Date(t.date).toLocaleDateString('en-PK')}</td>
                      <td>
                        <span className="status-badge" style={{ textTransform: 'capitalize' }}>
                          {t.method?.replaceAll('_', ' ')}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: '#0e7955' }}>
                        {money(t.amount)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <a className="btn secondary" href={`/api/payments/${t._id}/receipt`} target="_blank" rel="noreferrer" style={{ padding: '3px 8px', fontSize: 10 }}>
                          Print
                        </a>
                      </td>
                    </tr>
                  ))}
                  {!d.transactions.length && (
                    <tr><td colSpan={6} style={{ textAlign: 'center', color: '#94a3b8' }}>No payment transactions in this period.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
