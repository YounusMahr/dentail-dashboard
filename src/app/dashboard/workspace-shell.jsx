'use client';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { LayoutDashboard, CalendarDays, Users, Stethoscope, Receipt, BellRing, UserRound, HeartPulse, ChartNoAxesCombined, Settings2, CreditCard, ShieldCheck, Search, Menu, X, ChevronRight, LogOut, ArrowUpRight } from 'lucide-react';
import Brand from '@/components/brand';
const icons = { 'Care workspace': HeartPulse, Dashboard: LayoutDashboard, Appointments: CalendarDays, Patients: Users, Treatments: HeartPulse, Invoices: Receipt, 'Follow-ups': BellRing, Doctors: Stethoscope, Services: ShieldCheck, Reports: ChartNoAxesCombined, Staff: Users, 'Clinic settings': Settings2, Subscription: CreditCard, Platform: LayoutDashboard, 'My account': UserRound };
export default function WorkspaceShell({ children, links, user, clinicName }) {
  const pathname = usePathname(), [open,setOpen] = useState(false), [search,setSearch] = useState(''), [loggingOut,setLoggingOut] = useState(false);
  useEffect(()=>{setOpen(false);setSearch('')},[pathname]);
  const current = [...links].sort((a,b)=>b[1].length-a[1].length).find(([,url])=>pathname===url||pathname.startsWith(url+'/'))?.[0] || 'Workspace';
  const mainLinks=links.filter(([label])=>!['Reports','Staff','Clinic settings','Subscription','My account'].includes(label));
  const manageLinks=links.filter(([label])=>['Reports','Staff','Clinic settings','Subscription','My account'].includes(label));
  const initials=user.name?.split(' ').map(x=>x[0]).slice(0,2).join('') || 'DC';
  const renderLink=([label,href])=>{const Icon=icons[label]||LayoutDashboard,active=pathname===href||(href!=='/dashboard'&&pathname.startsWith(href+'/')||href==='/dashboard/care/plans'&&pathname.startsWith('/dashboard/care/'));return <Link key={href} href={href} className={`nav-link ${active?'active':''}`} aria-current={active?'page':undefined}><Icon size={19}/><span>{label}</span>{active&&<span className="nav-active-dot"/>}</Link>};
  async function logout(){setLoggingOut(true);try{const r=await fetch('/api/auth/logout',{method:'POST'});if(r.ok)location.href='/login';else setLoggingOut(false)}catch{setLoggingOut(false)}}
  return <div className="workspace">
    <a href="#workspace-content" className="skip-link">Skip to content</a>
    {open&&<button className="sidebar-overlay" aria-label="Close navigation" onClick={()=>setOpen(false)}/>}
    <aside className={`workspace-sidebar ${open?'is-open':''}`}>
      <div className="sidebar-brand"><Link href={user.role==='platform_owner'?'/dashboard/platform':'/dashboard'}><Brand/></Link><button className="icon-button mobile-only" aria-label="Close navigation" onClick={()=>setOpen(false)}><X size={20}/></button></div>
      <div className="workspace-clinic"><span className="clinic-mark"><Stethoscope size={19}/></span><div><strong>{clinicName}</strong><small>{user.role==='platform_owner'?'Platform workspace':'Clinic workspace'}</small></div><ShieldCheck size={15} className="text-emerald-600 shrink-0"/></div>
      <nav aria-label="Main navigation"><p className="nav-caption">WORKSPACE</p>{mainLinks.map(renderLink)}{manageLinks.length>0&&<p className="nav-caption mt-7!">MANAGEMENT</p>}{manageLinks.map(renderLink)}</nav>
      <div className="sidebar-bottom"><div className="care-note"><HeartPulse size={21}/><strong>Better care. Every day.</strong><p>Your team, patients and practice. Connected.</p></div><button className="logout-button" onClick={logout} disabled={loggingOut}><LogOut size={18}/>{loggingOut?'Signing out…':'Sign out'}</button><span className="sidebar-version">DentalCare · Practice workspace</span></div>
    </aside>
    <div className="workspace-body">
      <header className="workspace-header"><div className="flex items-center gap-3"><button className="icon-button mobile-only" aria-label="Open navigation" onClick={()=>setOpen(true)}><Menu size={21}/></button><span className="breadcrumb-root">Workspace</span><ChevronRight size={14} className="breadcrumb-root text-slate-400"/><span className="header-current">{current}</span></div>
        <div className="header-actions"><div className="workspace-search"><Search size={17}/><input aria-label="Find a workspace page" placeholder="Find a page…" value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>{if(e.key==='Escape')setSearch('')}}/>{search&&<div className="search-results">{links.filter(([label])=>label.toLowerCase().includes(search.toLowerCase())).map(([label,href])=><Link href={href} key={href}>{label}<ArrowUpRight size={14}/></Link>)}{!links.some(([label])=>label.toLowerCase().includes(search.toLowerCase()))&&<p>No matching pages</p>}</div>}</div>{user.role!=='platform_owner'&&<Link className="icon-button" title="Follow-ups" aria-label="Open follow-ups" href="/dashboard/follow-ups"><BellRing size={19}/></Link>}<Link href="/dashboard/account" className="header-user"><span className="avatar">{initials}</span><span className="user-copy"><strong>{user.name}</strong><small>{user.role.replaceAll('_',' ')}</small></span></Link></div>
      </header>
      <main id="workspace-content" className="main">{children}<footer className="workspace-footer"><span>DentalCare <span className="text-slate-300 mx-2">/</span> Made for better patient care</span><span className="flex items-center gap-1.5"><ShieldCheck size={14}/> Your clinic workspace</span></footer></main>
    </div>
  </div>;
}
