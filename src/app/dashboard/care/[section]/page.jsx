'use client';
import { useEffect,useState,useCallback } from 'react';
import { useParams,useSearchParams,useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus,ArrowUpRight,Check,FileText,FlaskConical,CalendarDays,Wallet,Copy,RefreshCw,Search,HeartPulse,Users,MessageSquare,ArrowRight,Printer,Clock3,Activity,QrCode,Smartphone,Send,CheckCircle2,XCircle,LogOut } from 'lucide-react';
import { careSections,clinicalRoles } from '@/lib/care-schema';
import ToothPicker from '../../[module]/tooth-picker';
import Dialog from '@/components/dialog';
import VoiceDraft from '@/components/voice-draft';
const tabs=[['plans','Plans',HeartPulse],['sessions','Sessions',CalendarDays],['prescriptions','Prescriptions',FileText],['labs','Lab work',FlaskConical],['waitlist','Waiting list',Clock3],['portal','Patient access',Users],['insights','Practice insights',Activity],['automation','Message templates',MessageSquare]];
const money=n=>Number(n||0).toLocaleString('en-PK',{maximumFractionDigits:2});
const blankMedicine=()=>({name:'',strength:'',dose:'',frequency:'',duration:'',instructions:''});
export default function CareWorkspace(){
 const selectedRecord=useSearchParams().get('record')||'',router=useRouter();
 const {section}=useParams(),schema=careSections[section];
 const [data,setData]=useState(null),[user,setUser]=useState(null),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[search,setSearch]=useState(''),[patientFilter,setPatientFilter]=useState(''),[edit,setEdit]=useState(null),[form,setForm]=useState({}),[meds,setMeds]=useState([blankMedicine()]),[detail,setDetail]=useState(null),[payment,setPayment]=useState(null),[portalPatient,setPortalPatient]=useState(''),[portalLink,setPortalLink]=useState(''),[templates,setTemplates]=useState({}),[templateType,setTemplateType]=useState('appointment_confirmation'),[templateLanguage,setTemplateLanguage]=useState('en'),[costs,setCosts]=useState(null),[paymentKey,setPaymentKey]=useState(''),[templateName,setTemplateName]=useState('');
 const [connectModal,setConnectModal]=useState(false),[connectTab,setConnectTab]=useState('qr'),[qrCode,setQrCode]=useState(''),[pairingCode,setPairingCode]=useState(''),[pairingPhone,setPairingPhone]=useState(''),[instanceInput,setInstanceInput]=useState(''),[testModal,setTestModal]=useState(false),[testPhone,setTestPhone]=useState(''),[testMessage,setTestMessage]=useState('Hello! This is a test message from your Dental Clinic via WhatsApp.');
 const close=useCallback(()=>{setEdit(null);setDetail(null);setPayment(null);setCosts(null);setConnectModal(false);setTestModal(false)},[]);
 const load=useCallback(async()=>{try{const [r,u]=await Promise.all([fetch(`/api/care/${section}${selectedRecord?`?record=${selectedRecord}`:''}`),fetch('/api/auth/me')]);const d=await r.json();if(!r.ok)throw new Error(d.error);setData(d);setUser((await u.json()).user);if(d.settings)setTemplates(d.settings.templates)}catch(e){setError(e.message)}},[section,selectedRecord]);
 useEffect(()=>{setData(null);setError('');setSearch('');setPatientFilter(new URLSearchParams(window.location.search).get('patient')||'');close();load()},[load,close]);
 async function action(body,success='Updated successfully'){setBusy(true);setError('');try{const r=await fetch(`/api/care/${section}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),d=await r.json();if(!r.ok)throw new Error(d.error);setMessage(success);await load();return d}catch(e){setError(e.message);return null}finally{setBusy(false)}}
 async function connectWhatsApp(mode=connectTab,phone=pairingPhone){
  setBusy(true);setError('');
  try{
   const target=(instanceInput||data?.settings?.instanceName||'hremes').trim().replace(/\s+/g,'_');setInstanceInput(target);
   const r=await fetch('/api/care/automation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'connect',instanceName:target,number:mode==='code'?phone:''})}),d=await r.json();
   if(!r.ok)throw new Error(d.error);
   if(d.base64)setQrCode(d.base64);
   if(d.pairingCode)setPairingCode(d.pairingCode);
   if(d.state==='open'){setMessage('WhatsApp is already live and connected!');setConnectModal(false);await load()}else if(mode==='qr'&&!d.base64){throw new Error('Provider connected but did not return a QR image. Try Generate QR again or use a new instance name.')}else if(mode==='code'&&!d.pairingCode){throw new Error('Provider did not return a pairing code. Check the phone number and try again.')}else{setMessage(mode==='code'?'Pairing code generated! Enter it on your phone.':'QR code ready! Scan with your phone.')}
  }catch(e){setError(e.message)}finally{setBusy(false)}
 }
 async function sendTestMessage(e){
  e.preventDefault();setBusy(true);setError('');
  try{
   const r=await fetch('/api/care/automation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'send-test',number:testPhone,text:testMessage,instanceName:data?.settings?.instanceName||'hremes'})}),d=await r.json();
   if(!r.ok)throw new Error(d.error);
   setMessage(`Test message sent successfully to ${testPhone}!`);
   setTestModal(false);
   await load();
  }catch(e){setError(e.message)}finally{setBusy(false)}
 }
 useEffect(()=>{
  if(!connectModal||data?.settings?.providerConnected||!qrCode&&!pairingCode)return;
  const t=setInterval(async()=>{
   try{
    const r=await fetch('/api/care/automation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'status',instanceName:instanceInput||data?.settings?.instanceName||'hremes'})});
    const d=await r.json();
    if(d.connected){setMessage('WhatsApp connected successfully!');setConnectModal(false);clearInterval(t);load()}
    else if(['unauthorized','unconfigured'].includes(d.state)){setError(d.error||'WhatsApp provider authorization failed.');clearInterval(t)}
   }catch{}
  },4000);
  return ()=>clearInterval(t);
 },[connectModal,instanceInput,data?.settings?.instanceName,data?.settings?.providerConnected,qrCode,pairingCode,load]);
  function openEdit(record={}){
    const todayDate=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Karachi'});
    const inTwoWeeks=new Date(Date.now()+14*86400000).toLocaleDateString('en-CA',{timeZone:'Asia/Karachi'});
    const inThreeDays=new Date(Date.now()+3*86400000).toLocaleDateString('en-CA',{timeZone:'Asia/Karachi'});
    const defaultDoc=record.doctorId||(user?.role==='dentist'?user.doctorId:(data?.options?.doctors?.[0]?._id||''));
    const defaultPat=record.patientId||patientFilter||data?.options?.patients?.[0]?._id||'';
    const defaults=!record._id?{
      patientId:defaultPat,
      doctorId:defaultDoc,
      scheduledDate:todayDate,
      nextReviewDate:todayDate,
      reviewDate:todayDate,
      dueDate:inThreeDays,
      earliestDate:todayDate,
      latestDate:inTwoWeeks,
      earliestTime:'10:00',
      latestTime:'18:00',
      durationMinutes:30,
      language:'bilingual',
      planId:data?.options?.plans?.[0]?._id||'',
      serviceId:data?.options?.services?.[0]?._id||'',
      totalFee:5000,
      amountDue:2500,
      cost:3000
    }:{};
    setError('');setTemplateName('');setEdit(record);
    setForm({...defaults,...record,language:record.language||'bilingual',doctorId:defaultDoc,sortOrder:record.sortOrder||0});
    setMeds(record.medications?.map(x=>({...x}))||[blankMedicine()]);
  }
 async function save(e){e.preventDefault();const result=await action({...form,id:edit?._id,action:'save',...(section==='prescriptions'?{medications:meds}:{})},'Saved successfully');if(result)setEdit(null)}
 const options=data?.options||{},name=(type,id)=>options[type]?.find(x=>x._id===id)?.name||options[type]?.find(x=>x._id===id)?.title||'—';
 const clinical=clinicalRoles.includes(user?.role),canWrite=section!=='plans'||clinical;
 const records=(data?.records||[]).filter(r=>(!selectedRecord||r._id===selectedRecord)&&(!patientFilter||r.patientId===patientFilter)&&[r.title,r.labName,r.status,name('patients',r.patientId)].join(' ').toLowerCase().includes(search.toLowerCase()));
 const title=schema?.title||({portal:'Patient portal access',insights:'Practice insights',automation:'Message templates'})[section]||'Care workspace';
 function pay(record){setPayment(record);setPaymentKey(crypto.randomUUID());setError('')}
 async function submitPayment(e){e.preventDefault();setBusy(true);setError('');const body=Object.fromEntries(new FormData(e.currentTarget));try{const invoiceId=payment.invoiceId;const r=await fetch(`/api/invoices/${invoiceId}/payments`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,idempotencyKey:paymentKey,sessionId:payment.sessionPayment?payment._id:null})}),d=await r.json();if(!r.ok)throw new Error(d.error);setPayment(null);setMessage('Payment recorded. Receipt is available under Invoices.');await load()}catch(e){setError(e.message)}finally{setBusy(false)}}
 const getInvoice=p=>p.invoice||options.invoices?.find(i=>i._id===p.invoiceId);
 const badge=status=><span className={`status-badge status-${status}`}>{String(status||'draft').replaceAll('_',' ')}</span>;
 const notifyError=error&&<div className="error" role="alert">{error}</div>;
 return <>
 <div className="top"><div><div className="eyebrow">CONNECTED DENTAL CARE</div><h1>{title}</h1><p className="muted">{schema?.subtitle||({portal:'Give patients a private, expiring link to their own records.',insights:'See unfinished care, lab delays and recorded treatment margins.',automation:'Prepare bilingual messages now. Connect your chosen provider later.'})[section]}</p></div><div className="row"><button className="icon-button" aria-label="Refresh" onClick={load}><RefreshCw size={17}/></button>{schema&&canWrite&&<button onClick={()=>openEdit()}><Plus size={16}/>Add {section==='website'?'page':section==='prescriptions'?'prescription':section==='sessions'?'session':section==='plans'?'plan':section==='labs'?'lab case':'patient'}</button>}</div></div>
 {selectedRecord&&<div className="notice-panel">Showing the record selected in search. <button className="secondary" onClick={()=>router.push(`/dashboard/care/${section}`)}>Show all records</button></div>}
 <nav className="care-tabs" aria-label="Care workspace">{tabs.filter(([key])=>(!['automation','insights'].includes(key)||user?.role==='clinic_admin')&&(key!=='prescriptions'||clinical)).map(([key,label,Icon])=><Link href={`/dashboard/care/${key}`} key={key} className={key===section?'active':''}><Icon size={16}/>{label}</Link>)}</nav>
 {notifyError}{message&&<div role="status" className="success">{message}</div>}
 {!data&&!error&&<div className="skeleton h-64"/>}
 {data&&schema&&<div className="care-filter"><div className="relative"><Search size={16}/><input aria-label="Search records" placeholder="Search records…" value={search} onChange={e=>setSearch(e.target.value)}/></div>{section!=='website'&&<select aria-label="Filter patient" value={patientFilter} onChange={e=>setPatientFilter(e.target.value)}><option value="">All patients</option>{options.patients?.map(p=><option key={p._id} value={p._id}>{p.name}</option>)}</select>}<span>{records.length} records</span></div>}
 {data&&section==='plans'&&<div className="care-plan-grid">{records.map(p=><article className="card plan-card" key={p._id}><div className="row between"><span className="metric-icon mint"><HeartPulse size={21}/></span>{badge(p.status)}</div><h2>{p.title}</h2><p>{name('patients',p.patientId)} <span>· {name('doctors',p.doctorId)}</span></p><div className="plan-teeth">Teeth {p.toothNumbers||'Full-mouth / not specified'}</div><div className="plan-money"><div><small>Agreed fee</small><strong>PKR {money(p.totalFee)}</strong></div><div><small>Remaining</small><strong>{p.invoice?`PKR ${money(p.invoice.balanceAmount)}`:'Not invoiced'}</strong></div></div><div className="plan-progress"><span style={{width:`${p.totalFee?Math.min(100,(p.invoice?.paidAmount||0)/p.totalFee*100):0}%`}}/></div><div className="row mt-5"><button className="secondary" onClick={()=>setDetail(p)}>Care journey <ArrowRight size={14}/></button>{clinical&&<button className="secondary" onClick={()=>openEdit(p)}>Edit</button>}{p.status==='draft'&&clinical&&<button disabled={busy} onClick={()=>action({id:p._id,action:'accept'},'Plan accepted and treatment invoice created')}>Accept & invoice</button>}{p.invoice&&['clinic_admin','receptionist'].includes(user?.role)&&p.invoice.balanceAmount>0&&<button onClick={()=>pay(p)}>Record advance</button>}</div></article>)}</div>}
 {data&&['sessions','prescriptions','labs','waitlist','website'].includes(section)&&<div className="card p-0! overflow-hidden"><div className="table-wrap"><table className="table"><thead><tr><th>{section==='website'?'Page':'Patient / record'}</th><th>Details</th><th>Status</th><th>Actions</th></tr></thead><tbody>{records.map(r=><tr key={r._id}><td><strong>{section==='website'?r.title:name('patients',r.patientId)}</strong><small className="block mt-1 text-slate-400">{r.title||r.diagnosis||new Date(r.createdAt).toLocaleDateString()}</small></td><td>{section==='sessions'?<><strong>{r.scheduledDate}</strong><div className="text-xs mt-1">Fee {money(r.amountDue)} · Paid {money(r.paidAmount)}</div><small className={r.labReady?'text-emerald-600':'text-amber-600'}>{r.labReady?'Lab work ready / not required':'Lab work pending'}</small></>:section==='labs'?<>{r.labName}<small className="block">Due {r.dueDate} · PKR {money(r.cost)}</small></>:section==='prescriptions'?<>{r.language}<small className="block">{r.medications?.length} medicines · Rev {r.revision||1}</small></>:section==='waitlist'?<>{r.earliestDate} – {r.latestDate}<small className="block">{r.earliestTime} – {r.latestTime} · {r.durationMinutes} min</small></>:<><code>/{r.slug}</code><small className="block">{r.published?'Published version saved':'Not published'}</small></>}</td><td>{badge(r.status)}</td><td><div className="row">
 {!(section==='prescriptions'&&r.status==='issued')&&<button className="secondary" onClick={()=>openEdit(r)}>Edit</button>}
 {section==='sessions'&&<>{['clinic_admin','receptionist'].includes(user?.role)&&r.status!=='cancelled'&&getInvoice(r)?.balanceAmount>0&&r.amountDue>r.paidAmount&&<button onClick={()=>pay({...r,sessionPayment:true})}>Payment</button>}{clinical&&r.status!=='completed'&&r.status!=='cancelled'&&<button disabled={busy} onClick={()=>action({id:r._id,action:'status',status:'completed'})}>Complete</button>}{r.status!=='completed'&&<select aria-label="Session status" value={r.status} onChange={e=>action({id:r._id,action:'status',status:e.target.value})}><option value="planned" disabled>Planned</option><option value="scheduled">Scheduled</option><option value="cancelled">Cancelled</option></select>}</>}
 {section==='labs'&&<select aria-label="Lab status" value={r.status} onChange={e=>action({id:r._id,action:'status',status:e.target.value})}>{['ordered','in_progress','received','fitted','remake','cancelled'].map(s=><option key={s} value={s}>{s.replaceAll('_',' ')}</option>)}</select>}
 {section==='prescriptions'&&<><a className="btn secondary" href={`/api/prescriptions/${r._id}/print`} target="_blank" rel="noreferrer"><Printer size={13}/>A4 / PDF</a>{r.status==='draft'?<button onClick={()=>setDetail(r)}>Review & issue</button>:<button className="secondary" onClick={()=>action({id:r._id,action:'revise'},'Editable revision created')}>Create revision</button>}</>}
 {section==='waitlist'&&<>{r.matches?.map(slot=><button key={slot._id} onClick={()=>action({id:r._id,action:'offer',appointmentId:slot._id},'Offer added to patient portal. No WhatsApp was sent.')} disabled={busy}>Offer {slot.appointmentDate} {slot.startsAt}</button>)}{r.status==='waiting'&&!r.matches?.length&&<small className="muted">No matching cancelled slots</small>}{r.status==='waiting'&&<button className="secondary" onClick={()=>action({id:r._id,action:'status',status:'cancelled'})}>Remove from waiting</button>}</>}
 {section==='website'&&<><a className="btn secondary" href={`/clinic/${data.clinicSlug}/${r.slug}?preview=1`} target="_blank" rel="noreferrer">Preview draft</a><button onClick={()=>action({id:r._id,action:'publish'},'Page published')}>Publish</button>{r.published&&<button className="secondary" onClick={()=>action({id:r._id,action:'unpublish'},'Page unpublished')}>Unpublish</button>}</>}
 </div></td></tr>)}</tbody></table></div></div>}
 {data&&schema&&!records.length&&<div className="empty-state card mt-4"><HeartPulse/><h3>No {title.toLowerCase()} yet</h3><p>{search||patientFilter?'Try another filter.':'Add your first record to start this workflow.'}</p></div>}
 {data&&section==='portal'&&<><section className="card max-w-3xl"><h2>Private patient access</h2><p className="muted">A link is valid for 7 days and opens only that patient’s published care information. Share it directly with the patient. Revoke access at any time.</p><div className="row"><select className="max-w-sm" aria-label="Patient for portal" value={portalPatient} onChange={e=>{setPortalPatient(e.target.value);setPortalLink('')}}><option value="">Choose patient</option>{options.patients?.map(p=><option value={p._id} key={p._id}>{p.name}</option>)}</select><button disabled={!portalPatient||busy} onClick={async()=>{const r=await action({action:'create',patientId:portalPatient},'Private link created');if(r)setPortalLink(r.link)}}>Create access link</button></div>{portalLink&&<div className="portal-link-box"><input readOnly aria-label="Private patient access link" value={portalLink}/><button className="secondary" onClick={async()=>{try{await navigator.clipboard.writeText(portalLink);setMessage('Link copied')}catch{setMessage('Select and copy the link above')}}}><Copy size={15}/>Copy</button><a className="btn secondary" href={portalLink} target="_blank" rel="noreferrer">Open portal</a></div>}</section><section className="card mt-5"><h2>Access links</h2>{data.records.map(r=><div className="access-row" key={r._id}><div><strong>{name('patients',r.patientId)}</strong><small>Expires {new Date(r.expiresAt).toLocaleString()}</small></div><button className="danger" onClick={()=>action({action:'revoke',patientId:r.patientId},'All access links for this patient revoked')}>Revoke patient access</button></div>)}</section></>}
 {data&&section==='insights'&&<><div className="grid mb-6">{[['Patients waiting',data.waiting],['Lab cases due',data.labAlerts],['Overdue treatment plans',data.records.filter(p=>p.overdue).length],['Accepted, no sessions',data.records.filter(p=>p.status==='accepted'&&!p.sessionCount).length]].map(([label,value])=><div className="card" key={label}><span className="muted">{label}</span><div className="metric">{value}</div></div>)}</div><div className="card"><h2>Treatment collections & recorded costs</h2><p className="muted">Net collected = received payments − lab, material and provider costs. This excludes unrecorded overheads and is not an accounting profit statement.</p><div className="table-wrap"><table className="table"><thead><tr><th>Patient / treatment</th><th>Progress</th><th>Collected</th><th>Recorded costs</th><th>Net collected</th><th>Next action</th></tr></thead><tbody>{data.records.map(p=><tr key={p._id}><td><strong>{name('patients',p.patientId)}</strong><small className="block">{p.title}</small></td><td>{p.completed}/{p.sessionCount} sessions</td><td>{money(p.invoice?.paidAmount)}</td><td>{money(p.recordedCosts)}</td><td>{money(p.netCollected)}</td><td>{p.overdue?'Follow up: overdue session':p.status==='accepted'&&!p.sessionCount?'Schedule first session':'On track'}<button className="secondary ml-2" onClick={()=>setCosts(p)}>Record costs</button></td></tr>)}</tbody></table></div></div></>}
 {data&&section==='automation'&&<>
    <section className="card mb-6" style={{background:'linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%)',border:'1px solid #bbf7d0'}}>
      <div className="row between">
        <div className="flex items-center gap-3">
          <div style={{width:44,height:44,borderRadius:12,background:'#16a34a',color:'white',display:'grid',placeItems:'center',boxShadow:'0 4px 12px rgba(22,163,74,0.25)'}}>
            <MessageSquare size={22}/>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 style={{margin:0,fontSize:16}}>Evolution API WhatsApp Gateway</h2>
              {data.settings?.providerConnected?(
                <span className="pill" style={{background:'#dcfce7',color:'#15803d',border:'1px solid #86efac',fontWeight:600}}>
                  <span style={{width:7,height:7,borderRadius:'50%',background:'#22c55e',display:'inline-block',marginRight:6}}/>
                  Live & Connected
                </span>
              ):(
                <span className="pill" style={{background:'#fee2e2',color:'#b91c1c',border:'1px solid #fca5a5'}}>
                  <span style={{width:7,height:7,borderRadius:'50%',background:'#ef4444',display:'inline-block',marginRight:6}}/>
                  {data.settings?.connectionState==='connecting'?'Connecting…':'Disconnected'}
                </span>
              )}
            </div>
            <p className="muted" style={{margin:'4px 0 0',fontSize:11}}>
              {data.settings?.providerConnected?(
                <>Instance: <strong>{data.settings?.instanceName}</strong> · Linked Account: <strong>{data.settings?.profileName||'WhatsApp'}</strong> {data.settings?.ownerNumber?`(+${data.settings?.ownerNumber})`:''}</>
              ):(
                <>Connect your WhatsApp account to enable real-time booking confirmations, reminders, and digital receipts.</>
              )}
            </p>
            {data.settings?.providerError&&<p role="alert" className="mt-2 text-xs font-medium text-red-700">{data.settings.providerError}</p>}
          </div>
        </div>
        <div className="row">
          {data.settings?.providerConnected?(
            <>
              <button className="secondary" onClick={()=>{setTestPhone(data.settings?.ownerNumber||'');setTestModal(true)}}>
                <Send size={14}/>Test Message
              </button>
              <button className="secondary" onClick={()=>{setInstanceInput(data.settings?.instanceName||'hremes');setQrCode('');setPairingCode('');setError('');setConnectModal(true)}}>
                <QrCode size={14}/>Switch / Re-link
              </button>
              <button className="danger" disabled={busy} onClick={()=>action({action:'disconnect',instanceName:data.settings?.instanceName},'WhatsApp disconnected')}>
                <LogOut size={14}/>Disconnect
              </button>
            </>
          ):(
            <>
              {data.settings?.allInstances?.some(i=>i.name==='hremes'&&i.state==='open')&&data.settings?.instanceName!=='hremes'&&(
                <button className="secondary" disabled={busy} onClick={()=>action({action:'connect',instanceName:'hremes'},'Switched to live hremes instance')}>
                  Use Connected (hremes)
                </button>
              )}
              <button onClick={()=>{setInstanceInput(data.settings?.instanceName||'hremes');setQrCode('');setPairingCode('');setError('');setConnectModal(true)}}>
                <QrCode size={14}/>Connect WhatsApp
              </button>
            </>
          )}
        </div>
      </div>
    </section>

    <div className="grid two">
      <section className="card">
        <h2>Message template editor</h2>
        <div className="row mb-4">
          <select aria-label="Message type" value={templateType} onChange={e=>setTemplateType(e.target.value)}>
            {Object.keys(templates).map(t=><option value={t} key={t}>{t.replaceAll('_',' ')}</option>)}
          </select>
          <select aria-label="Template language" value={templateLanguage} onChange={e=>setTemplateLanguage(e.target.value)}>
            <option value="en">English</option>
            <option value="ur">اردو</option>
          </select>
        </div>
        <label htmlFor="template-body">Message text</label>
        <textarea
          id="template-body"
          className={templateLanguage==='ur'?'urdu':''}
          dir={templateLanguage==='ur'?'rtl':'ltr'}
          value={templates[templateType]?.[templateLanguage]||''}
          onChange={e=>setTemplates(t=>({...t,[templateType]:{...t[templateType],[templateLanguage]:e.target.value}}))}
        />
        <p className="muted mt-3">Available variables: {'{{patient}}, {{clinic}}, {{details}}'}</p>
        <button disabled={busy} onClick={()=>action({action:'configure',templates},'Templates saved')}>Save templates</button>
      </section>

      <section className="card">
        <h2>Patient message preview</h2>
        <div className={`message-bubble ${templateLanguage==='ur'?'urdu':''}`} dir={templateLanguage==='ur'?'rtl':'ltr'}>
          {(templates[templateType]?.[templateLanguage]||'').replaceAll('{{patient}}',templateLanguage==='ur'?'مریض':'Patient name').replaceAll('{{clinic}}',templateLanguage==='ur'?'آپ کا کلینک':'Your clinic').replaceAll('{{details}}',templateLanguage==='ur'?'تاریخ اور وقت':'24 October · 10:30 AM')}
        </div>
        <p className="muted mt-5">Preview uses sample details. Patient language preference dictates which version is delivered.</p>
      </section>
    </div>

    <section className="card mt-6">
      <div className="row between mb-3">
        <div>
          <h2>Notification Outbox & Delivery History</h2>
          <p className="muted">Live WhatsApp records sent via Evolution API and queued automated visits.</p>
        </div>
        <div className="row">
          <button className="secondary" disabled={busy} onClick={()=>action({action:'dispatch-pending'},'Dispatched pending notifications to WhatsApp')}>
            <Send size={14}/>Dispatch Pending
          </button>
          <button disabled={busy} onClick={()=>action({action:'queue'},'Reminders prepared and sent via WhatsApp!')}>
            <Clock3 size={14}/>Prepare & Send Reminders
          </button>
        </div>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Recipient & Details</th>
              <th>Status</th>
              <th>Date / Time</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {data.records?.map(r=><tr key={r._id}>
              <td><strong>{r.type.replaceAll('_',' ')}</strong></td>
              <td>
                <div>{r.recipientPhone?<strong>+{r.recipientPhone} · </strong>:''}{r.values?.join(' · ')}</div>
                {r.error&&<small className="text-red-500 block">{r.error}</small>}
              </td>
              <td>
                {r.status==='sent'?(
                  <span className="status-badge status-confirmed">✓ Sent</span>
                ):r.status==='failed'?(
                  <span className="status-badge status-cancelled">Failed</span>
                ):(
                  <span className="status-badge status-pending">Pending</span>
                )}
              </td>
              <td><small>{new Date(r.sentAt||r.createdAt).toLocaleString()}</small></td>
              <td>
                {r.status!=='sent'?(
                  <button className="secondary" disabled={busy} onClick={()=>action({action:'send-single',id:r._id},'Message sent to WhatsApp!')}>
                    <Send size={11}/>Send Now
                  </button>
                ):(
                  <small className="text-emerald-700 font-medium">Delivered</small>
                )}
              </td>
            </tr>)}
            {!data.records?.length&&<tr><td colSpan={5} className="text-center text-slate-400 py-6">No notifications in outbox yet. Click "Prepare & Send Reminders" or book an appointment.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  </>}
 {edit&&<Dialog title={`${edit._id?'Edit':'New'} ${title.toLowerCase()}`} onClose={close} wide>{notifyError}<form className="care-form" onSubmit={save}>{schema.fields.map(([key,label,type,required])=><div key={key} className={`field ${['textarea','urdu','teeth'].includes(type)?'span-full':''}`}><label htmlFor={`care-${key}`}>{label}{required?' *':''}</label>{type==='teeth'?<ToothPicker name={key} value={form[key]||''} onChange={value=>setForm(f=>({...f,[key]:value}))}/>:['textarea','urdu'].includes(type)?<textarea id={`care-${key}`} dir={type==='urdu'?'rtl':'auto'} className={type==='urdu'?'urdu':''} value={form[key]||''} required={required} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))}/>:['patient','doctor','service','plan','session','appointment'].includes(type)?<select id={`care-${key}`} required={required} value={form[key]||''} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))}><option value="">Choose {type}</option>{(options[{patient:'patients',doctor:'doctors',service:'services',plan:'plans',session:'sessions',appointment:'appointments'}[type]]||[]).filter(o=>!form.patientId||!o.patientId||o.patientId===form.patientId).map(o=><option value={o._id} key={o._id}>{o.name||o.title||`${o.appointmentDate} ${o.startsAt}`} {o.patientId?`· ${name('patients',o.patientId)}`:''}</option>)}</select>:type.startsWith('select:')?<select id={`care-${key}`} required={required} value={form[key]||''} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))}>{type.slice(7).split(',').map(v=><option value={v} key={v}>{v}</option>)}</select>:<input id={`care-${key}`} type={type} min={type==='number'?0:undefined} step={type==='number'?'0.01':undefined} required={required} value={form[key]??''} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))}/>}</div>)}
 {['plans','sessions','prescriptions'].includes(section)&&<div className="span-full"><VoiceDraft onText={text=>setForm(f=>{const key=section==='prescriptions'?'diagnosis':section==='plans'?'summary':'notes';return {...f,[key]:[f[key],text].filter(Boolean).join('\n')}})}/></div>}
 {section==='prescriptions'&&<div className="span-full"><div className="prescription-template-tools"><label htmlFor="rx-template">Start from a saved template</label><select id="rx-template" defaultValue="" onChange={e=>{const t=data.prescriptionTemplates?.find(t=>t._id===e.target.value);if(t){setMeds(t.medications.map(m=>({...m})));setForm(f=>({...f,language:t.language,instructionsEn:t.instructionsEn,instructionsUr:t.instructionsUr}))}}}><option value="">Choose a template (optional)</option>{data.prescriptionTemplates?.map(t=><option value={t._id} key={t._id}>{t.name}</option>)}</select><p className="muted mt-2">Review all copied medicine details for this patient before issuing.</p></div><h3>Medicine details</h3><p className="muted">Enter clinician-selected medicines and directions. Nothing is prescribed automatically.</p>{meds.map((m,i)=><div className="medicine-row" key={i}><span className="pill">Medicine {i+1}</span><div className="medicine-fields">{['name','strength','dose','frequency','duration','instructions'].map(key=><div className="field" key={key}><label htmlFor={`medicine-${i}-${key}`}>{key}</label><input id={`medicine-${i}-${key}`} dir="auto" value={m[key]} required={['name','dose','frequency','duration'].includes(key)} onChange={e=>setMeds(rows=>rows.map((r,n)=>n===i?{...r,[key]:e.target.value}:r))}/></div>)}</div><button className="danger" type="button" disabled={meds.length===1} onClick={()=>setMeds(rows=>rows.filter((_,n)=>n!==i))}>Remove medicine</button></div>)}<button className="secondary" type="button" onClick={()=>setMeds(rows=>[...rows,blankMedicine()])}>Add medicine</button></div>}
 {section==='prescriptions'&&<div className="span-full row mt-5"><input className="max-w-xs" aria-label="Prescription template name" placeholder="Save this as a reusable template…" value={templateName} onChange={e=>setTemplateName(e.target.value)}/><button type="button" className="secondary" disabled={busy||!templateName.trim()} onClick={()=>action({action:'save-template',templateName,medications:meds,language:form.language,instructionsEn:form.instructionsEn,instructionsUr:form.instructionsUr},'Reusable prescription template saved')}>Save template</button></div>}<div className="span-full form-footer"><span>Saved as {section==='prescriptions'||section==='plans'||section==='website'?'a draft':'a clinic record'}.</span><button disabled={busy}>{busy?'Saving…':'Save record'}</button></div></form></Dialog>}
 {detail&&<Dialog title={section==='prescriptions'?'Review prescription':detail.title} onClose={close} wide>{notifyError}{section==='prescriptions'?<><p className="muted">Review the patient, dentist and every medicine before issuing. The issued version is locked; changes create a new revision.</p><p><strong>{name('patients',detail.patientId)}</strong> · {name('doctors',detail.doctorId)}</p><p dir="auto">{detail.diagnosis}</p>{detail.medications.map((m,i)=><div className="medicine-review" key={i}><strong>{m.name} {m.strength}</strong><p>{m.dose} · {m.frequency} · {m.duration}</p><p dir="auto">{m.instructions}</p></div>)}<p>{detail.instructionsEn}</p><p className="urdu" dir="rtl">{detail.instructionsUr}</p><button disabled={busy} onClick={async()=>{if(await action({id:detail._id,action:'issue',confirmed:true},'Prescription issued'))setDetail(null)}}><Check size={16}/>I reviewed the details — issue prescription</button></>:<><div className="plan-summary"><p>{detail.summary||'No patient explanation added yet.'}</p><span className="pill">Teeth {detail.toothNumbers||'Not specified'}</span><p className="mt-3">Aftercare: {detail.aftercare||'Not added yet'}</p></div><h3 className="mt-5">Session timeline</h3>{options.sessions?.filter(s=>s.planId===detail._id).map(s=><div className="timeline-row" key={s._id}><span className="timeline-dot"/><div><strong>{s.title}</strong><small>{s.scheduledDate} · {s.status}</small></div><span>PKR {money(s.paidAmount)} / {money(s.amountDue)}</span></div>)}<div className="row mt-6"><Link className="btn secondary" href="/dashboard/care/sessions">Manage sessions <ArrowRight size={15}/></Link>{detail.invoice&&<a className="btn secondary" href={`/api/invoices/${detail.invoiceId}/print`} target="_blank" rel="noreferrer">Print treatment invoice</a>}{clinical&&['accepted','in_progress'].includes(detail.status)&&<button disabled={busy} onClick={async()=>{if(await action({id:detail._id,action:'status',status:'completed'},'Treatment plan completed'))setDetail(null)}}>Complete plan</button>}</div><p className="muted mt-4">Advance payments reduce the overall invoice balance. Session payments additionally identify the visit being paid for.</p></>}</Dialog>}
 {payment&&<Dialog title={payment.sessionPayment?'Session payment':'Treatment advance / payment'} onClose={close}>{notifyError}<p className="muted">Invoice balance: PKR {money(getInvoice(payment)?.balanceAmount)}{payment.sessionPayment?` · Session remaining: PKR ${money(payment.amountDue-payment.paidAmount)}`:''}</p><form className="block!" onSubmit={submitPayment}><div className="field"><label htmlFor="pay-amount">Amount (PKR)</label><input id="pay-amount" name="amount" type="number" min=".01" step=".01" max={payment.sessionPayment?Math.min(payment.amountDue-payment.paidAmount,getInvoice(payment)?.balanceAmount):getInvoice(payment)?.balanceAmount} required/></div><div className="field"><label htmlFor="pay-method">Method</label><select id="pay-method" name="paymentMethod">{['cash','card','bank_transfer','easypaisa_jazzcash'].map(m=><option value={m} key={m}>{m.replaceAll('_',' ')}</option>)}</select></div><div className="field"><label htmlFor="pay-ref">Reference</label><input id="pay-ref" name="transactionReference"/></div><button disabled={busy}>{busy?'Recording…':'Record payment'}</button></form></Dialog>}
 {costs&&<Dialog title="Record treatment costs" onClose={close}>{notifyError}<form className="block!" onSubmit={async e=>{e.preventDefault();setBusy(true);try{const r=await fetch('/api/care/plans',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...Object.fromEntries(new FormData(e.currentTarget)),id:costs._id,action:'costs'})}),d=await r.json();if(!r.ok)throw new Error(d.error);setCosts(null);load()}catch(e){setError(e.message)}finally{setBusy(false)}}}>{[['materialCost','Material cost'],['providerCost','Recorded doctor / provider cost']].map(([k,label])=><div className="field" key={k}><label htmlFor={k}>{label} (PKR)</label><input id={k} name={k} type="number" min="0" step=".01" defaultValue={costs[k]||0}/></div>)}<p className="muted">Lab costs are taken from linked lab cases automatically.</p><button disabled={busy}>Save costs</button></form></Dialog>}
 {connectModal&&<Dialog title="Connect WhatsApp (Evolution API)" onClose={()=>setConnectModal(false)} wide>
    <div className="p-2">
      {error&&<div className="error mb-4" role="alert">{error}</div>}
      <div className="row between mb-4" style={{borderBottom:'1px solid #e5e7eb',paddingBottom:12}}>
        <div className="row gap-2">
          <button type="button" className={connectTab==='qr'?'':'secondary'} onClick={()=>{setConnectTab('qr');setPairingCode('');setQrCode('')}}>
            <QrCode size={15}/>Option 1: Scan QR Code
          </button>
          <button type="button" className={connectTab==='code'?'':'secondary'} onClick={()=>setConnectTab('code')}>
            <Smartphone size={15}/>Option 2: 8-Digit Pairing Code
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Instance:</span>
          <input style={{width:140,padding:'6px 10px',fontSize:11}} value={instanceInput} onChange={e=>{setInstanceInput(e.target.value);setQrCode('');setPairingCode('')}} placeholder="Instance name"/>
        </div>
      </div>
      {connectTab==='qr'&&(
        <div style={{textAlign:'center',padding:'15px 0'}}>
          {qrCode?(
            <div style={{display:'inline-block',padding:16,background:'#fff',borderRadius:16,border:'2px solid #10b981',boxShadow:'0 8px 30px rgba(0,0,0,0.08)'}}>
              <img src={qrCode.startsWith('data:')?qrCode:`data:image/png;base64,${qrCode}`} alt="WhatsApp QR Code" style={{width:260,height:260,display:'block',margin:'auto'}}/>
              <div className="flex items-center justify-center gap-2 mt-3 text-xs text-emerald-700 font-medium">
                <span style={{width:8,height:8,borderRadius:'50%',background:'#10b981',display:'inline-block'}}/>
                Waiting for scan… Auto-detecting connection
              </div>
            </div>
          ):(
            <div style={{padding:'40px 20px',background:'#f9fafb',borderRadius:12,border:'1px dashed #d1d5db'}}>
              <QrCode size={48} className="text-slate-400 mx-auto mb-3"/>
              <p className="text-sm font-medium text-slate-700">Click below to generate WhatsApp QR code</p>
              <button disabled={busy} onClick={()=>connectWhatsApp('qr')}>{busy?'Generating QR…':'Generate QR Code'}</button>
            </div>
          )}
          <div style={{maxWidth:440,margin:'20px auto 0',textAlign:'left',background:'#f8fafc',padding:16,borderRadius:10,fontSize:12,color:'#475569',lineHeight:1.8}}>
            <strong>How to scan:</strong>
            <ol style={{paddingLeft:18,margin:'6px 0 0'}}>
              <li>Open <strong>WhatsApp</strong> on your mobile phone</li>
              <li>Tap <strong>Settings</strong> (iOS) or <strong>Three Dots ⋮</strong> (Android)</li>
              <li>Tap <strong>Linked Devices</strong> → <strong>Link a Device</strong></li>
              <li>Point your camera at this QR code to connect</li>
            </ol>
          </div>
        </div>
      )}
      {connectTab==='code'&&(
        <div style={{padding:'15px 0'}}>
          <div style={{maxWidth:440,margin:'auto'}}>
            <label className="text-xs font-medium text-slate-700 block mb-1">
              Your WhatsApp Phone Number (with country code):
            </label>
            <div className="row gap-2 mb-3">
              <input type="tel" placeholder="e.g. 03267073002 or 923267073002" value={pairingPhone} onChange={e=>setPairingPhone(e.target.value)} style={{flex:1}}/>
              <button disabled={busy||!pairingPhone.trim()} onClick={()=>connectWhatsApp('code',pairingPhone)}>{busy?'Getting Code…':'Get Pairing Code'}</button>
            </div>
            {pairingCode&&(
              <div style={{textAlign:'center',margin:'20px 0',padding:20,background:'#f0fdf4',border:'2px solid #86efac',borderRadius:14}}>
                <span className="text-xs text-emerald-800 font-semibold block mb-2">YOUR 8-CHARACTER PAIRING CODE</span>
                <div style={{fontSize:32,letterSpacing:6,fontWeight:700,color:'#166534',fontFamily:'monospace'}}>
                  {pairingCode}
                </div>
                <button type="button" className="secondary mt-3" onClick={async()=>{try{await navigator.clipboard.writeText(pairingCode);setMessage('Pairing code copied!')}catch{}}}>
                  <Copy size={14}/>Copy Code
                </button>
              </div>
            )}
            <div style={{background:'#f8fafc',padding:16,borderRadius:10,fontSize:12,color:'#475569',lineHeight:1.8}}>
              <strong>How to connect with code:</strong>
              <ol style={{paddingLeft:18,margin:'6px 0 0'}}>
                <li>Open <strong>WhatsApp</strong> on your phone</li>
                <li>Go to <strong>Linked Devices</strong> → <strong>Link a Device</strong></li>
                <li>Tap <strong>"Link with phone number instead"</strong> at the bottom</li>
                <li>Enter the 8-character code shown above</li>
              </ol>
            </div>
          </div>
        </div>
      )}
      <div className="row between mt-4 pt-3" style={{borderTop:'1px solid #e5e7eb'}}>
        <button type="button" className="secondary" onClick={()=>setConnectModal(false)}>Close</button>
        <button type="button" className="secondary" disabled={busy} onClick={()=>action({action:'status',instanceName:instanceInput||data.settings?.instanceName||'hremes'},'Checked connection')}>
          <RefreshCw size={14}/>Check Connection Status
        </button>
      </div>
    </div>
  </Dialog>}
 {testModal&&<Dialog title="Send Live WhatsApp Test Message" onClose={()=>setTestModal(false)}>
    <form onSubmit={sendTestMessage} className="block!">
      <div className="field">
        <label htmlFor="test-phone">Recipient Phone Number (with country code or 03...)</label>
        <input id="test-phone" type="tel" required placeholder="e.g. 03267073002 or 923267073002" value={testPhone} onChange={e=>setTestPhone(e.target.value)}/>
      </div>
      <div className="field">
        <label htmlFor="test-text">Message Text</label>
        <textarea id="test-text" rows={3} required value={testMessage} onChange={e=>setTestMessage(e.target.value)}/>
      </div>
      <div className="row end gap-2 mt-4">
        <button type="button" className="secondary" onClick={()=>setTestModal(false)}>Cancel</button>
        <button disabled={busy||!testPhone.trim()||!testMessage.trim()}><Send size={15}/>{busy?'Sending…':'Send Test WhatsApp'}</button>
      </div>
    </form>
  </Dialog>}
 </>;
}
