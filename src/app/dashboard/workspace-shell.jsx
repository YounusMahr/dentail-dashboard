'use client';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Sparkles, LayoutDashboard, CalendarDays, Users, Stethoscope, Receipt, BellRing, MessageCircle, UserRound, HeartPulse, ChartNoAxesCombined, Settings2, ShieldCheck, Search, Menu, X, ChevronRight, LogOut, Globe2, BadgePercent } from 'lucide-react';
import Brand from '@/components/brand';
import UniversalSearch from '@/components/universal-search';
import PwaInstallPrompt from '@/components/pwa-install-prompt';
import NotificationBell from '@/components/notification-bell';
const icons = { 'AI Assistant': Sparkles, 'Care workspace': HeartPulse, Dashboard: LayoutDashboard, Appointments: CalendarDays, Patients: Users, Treatments: HeartPulse, Invoices: Receipt, 'Follow-ups': BellRing, WhatsApp: MessageCircle, Doctors: Stethoscope, Services: ShieldCheck, 'Website studio':Globe2, Reports: ChartNoAxesCombined, Staff: Users, Plans: BadgePercent, 'Clinic settings': Settings2, Platform: LayoutDashboard, 'My account': UserRound };
export default function WorkspaceShell({ children, links, user, clinicName, clinicSlug, clinicLogo, clinicStatus, subscriptionEndsAt, managed }) {
  const pathname = usePathname(), [open,setOpen] = useState(false), [search,setSearch] = useState(''), [loggingOut,setLoggingOut] = useState(false);
  useEffect(()=>{setOpen(false);setSearch('')},[pathname]);
  useEffect(()=>{if(!open)return;const previous=document.body.style.overflow;document.body.style.overflow='hidden';const close=event=>{if(event.key==='Escape')setOpen(false)};document.addEventListener('keydown',close);return()=>{document.body.style.overflow=previous;document.removeEventListener('keydown',close)}},[open]);
  const current = [...links].sort((a,b)=>b[1].length-a[1].length).find(([,url])=>pathname===url||pathname.startsWith(url+'/'))?.[0] || 'Workspace';
  const mainLinks=links.filter(([label])=>!['Website studio','Reports','Staff','Plans','Clinic settings','My account'].includes(label));
  const manageLinks=links.filter(([label])=>['Website studio','Reports','Staff','Plans','Clinic settings','My account'].includes(label));
  const initials=user.name?.split(' ').map(x=>x[0]).slice(0,2).join('') || 'DC';
  const renderLink=([label,href])=>{const Icon=icons[label]||LayoutDashboard,active=pathname===href||(href!=='/dashboard'&&pathname.startsWith(href+'/')||href==='/dashboard/care/sessions'&&pathname.startsWith('/dashboard/care/'));return <Link key={href} href={href} className={`nav-link ${active?'active':''}`} aria-current={active?'page':undefined}><Icon size={19}/><span>{label}</span>{active&&<span className="nav-active-dot"/>}</Link>};
  async function logout(){setLoggingOut(true);try{const r=await fetch('/api/auth/logout',{method:'POST'});if(r.ok)location.href='/login';else setLoggingOut(false)}catch{setLoggingOut(false)}}
  return <div className={`workspace ${pathname?.startsWith('/dashboard/ai')?'workspace-ai':''}`}>
    <a href="#workspace-content" className="skip-link">Skip to content</a>
    {open&&<button className="sidebar-overlay" aria-label="Close navigation" onClick={()=>setOpen(false)}/>}
    <aside id="workspace-navigation" className={`workspace-sidebar ${open?'is-open':''}`}>
      <div className="sidebar-brand"><Link href={user.role==='platform_owner'?'/dashboard/platform':'/dashboard'}><Brand/></Link><button className="icon-button mobile-only" aria-label="Close navigation" onClick={()=>setOpen(false)}><X size={20}/></button></div>
      <div className="workspace-clinic">{clinicLogo?<img src={clinicLogo} alt="Clinic logo"/>:<span className="clinic-mark"><Stethoscope size={19}/></span>}<div><strong>{clinicName}</strong><small>{user.role==='platform_owner'?'Platform workspace':'Clinic workspace'}</small></div><ShieldCheck size={15} className="text-emerald-600 shrink-0"/></div>
      <nav aria-label="Main navigation"><p className="nav-caption">WORKSPACE</p>{mainLinks.map(renderLink)}{manageLinks.length>0&&<p className="nav-caption mt-7!">MANAGEMENT</p>}{manageLinks.map(renderLink)}</nav>
      <div className="sidebar-bottom"><div className="care-note"><HeartPulse size={21}/><strong>Better care. Every day.</strong><p>Your team, patients and practice. Connected.</p></div><button className="logout-button" onClick={logout} disabled={loggingOut}><LogOut size={18}/>{loggingOut?'Signing out…':'Sign out'}</button><span className="sidebar-version">DentalCare · Practice workspace</span></div>
    </aside>
    <div className="workspace-body">
      <header className="workspace-header"><div className="flex items-center gap-3"><button className="icon-button mobile-only" aria-label="Open navigation" aria-controls="workspace-navigation" aria-expanded={open} onClick={()=>setOpen(true)}><Menu size={21}/></button><span className="breadcrumb-root">Workspace</span><ChevronRight size={14} className="breadcrumb-root text-slate-400"/><span className="header-current">{current}</span></div>
        <div className="header-actions">{user.role!=='platform_owner'&&<div className="desktop-search"><UniversalSearch links={links}/></div>} {clinicSlug&&<Link className="view-clinic-link inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 hover:text-white" href={managed || clinicSlug === "zentra" ? "/" : `/clinic/${clinicSlug}`} target="_blank" rel="noopener noreferrer">Clinic</Link>}{user.role!=='platform_owner'&&<NotificationBell/>}<Link href="/dashboard/account" className="header-user"><span className="avatar overflow-hidden">{user.photoDataUrl?<img src={user.photoDataUrl} alt="" className="h-full w-full object-cover"/>:initials}</span><span className="user-copy"><strong>{user.name}</strong><small>{user.role.replaceAll('_',' ')}</small></span></Link></div>
      </header>
      {user.mustChangePassword&&<div className="mx-4 mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 sm:mx-8">For security, change your temporary password before editing clinic records. <Link className="font-semibold underline" href="/dashboard/account">Open My account</Link></div>}
      {managed&&(clinicStatus!=='active'||subscriptionEndsAt&&new Date(subscriptionEndsAt)<=new Date())&&<div className="mx-4 mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 sm:mx-8">Clinic subscription is inactive. Patient records stay available to view; clinical changes need an active plan. <Link className="font-semibold underline" href="/dashboard/plans">View plans</Link></div>}
      {user.role!=='platform_owner'&&<div className="mobile-search-row"><UniversalSearch links={links}/></div>}
      <main id="workspace-content" className="main">{children}<footer className="workspace-footer"><span>DentalCare <span className="text-slate-300 mx-2">/</span> Made for better patient care</span><span className="flex items-center gap-1.5"><ShieldCheck size={14}/> Your clinic workspace</span></footer></main>
    </div>
    <PwaInstallPrompt visible={pathname === '/dashboard'}/>
  </div>;
}


