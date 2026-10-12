import {useEffect, useRef, useState} from 'react';
import {WashingMachine, LayoutDashboard, Home, Users, Tags, Briefcase, CalendarDays, Activity, ShieldAlert, Megaphone, History, Plus, UserRound, ScanLine, ClipboardList, PanelLeftClose, PanelLeftOpen, Menu, X, ChevronRight, ChevronDown, RefreshCw, LogOut, LockKeyhole} from 'lucide-react';
import NotificationCenter from './NotificationCenter';
import SecuritySettings from './SecuritySettings';
const menus = {
  admin: [['dashboard','Overview',LayoutDashboard],['hostels','Hostels',Home],['students','Student Mapping',Users],['tags','Laundry ID & Tags',Tags],['staff','Staff Accounts',Briefcase],['schedules','Scheduling',CalendarDays],['monitoring','Monitoring',Activity],['issues','Issues & Complaints',ShieldAlert],['announcements','Announcements',Megaphone],['audit','Audit History',History]],
  student: [['dashboard','Dashboard',LayoutDashboard],['submit','Book Laundry',Plus],['history','Laundry History',History],['profile','My Profile',UserRound],['issues','Report Issue',ShieldAlert]],
  staff: [['queue','Laundry Queue',ClipboardList],['scanner','QR Scanner',ScanLine],['issues','Flag Issues',ShieldAlert],['activity','My activity',History]]
};
const roles = {admin:'Campus operations',student:'Student workspace',staff:'Laundry desk'};
export default function PortalLayout({role, user, activeTab, onTabChange, onRefresh, busy, subtitle, onLogout, children}) {
  const [collapsed,setCollapsed]=useState(false),[mobile,setMobile]=useState(false),[account,setAccount]=useState(false);
  const [isMobile,setIsMobile]=useState(()=>window.matchMedia('(max-width:760px)').matches);
  useEffect(()=>{const q=window.matchMedia('(max-width:760px)');const changed=()=>{setIsMobile(q.matches);setMobile(false);};q.addEventListener('change',changed);return()=>q.removeEventListener('change',changed);},[]);
  const menuRef=useRef(null),accountRef=useRef(null),menuTrigger=useRef(null);
  const current=menus[role].find(([id])=>id===activeTab)?.[1]||'Overview';
  useEffect(()=>{if(!account)return;const close=e=>{if(!accountRef.current?.contains(e.target))setAccount(false);};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close);},[account]);
  useEffect(()=>{if(!mobile)return;const previous=document.activeElement;const items=()=>Array.from(menuRef.current?.querySelectorAll('button')||[]).filter(b=>b.offsetParent!==null);items()[0]?.focus();const key=e=>{if(e.key==='Escape')setMobile(false);if(e.key==='Tab'){const all=items(),first=all[0],last=all.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}};document.addEventListener('keydown',key);return()=>{document.removeEventListener('keydown',key);previous?.focus();};},[mobile]);
  const select=id=>{onTabChange(id);setMobile(false);};
  return <div className={`app-container portal-${role} ${collapsed?'nav-collapsed':''} ${mobile?'nav-open':''}`}>
    <a className="skip-link" href="#workspace-content">Skip to workspace</a>
    {mobile&&<button className="nav-scrim" aria-label="Close navigation" onClick={()=>setMobile(false)}/>}
    <aside className="sidebar" ref={menuRef} inert={isMobile&&!mobile} aria-label={`${role} navigation`}>
      <div className="sidebar-brand"><span className="brand-mark"><WashingMachine size={22}/></span><div><strong>SmartWash<span className="brand-dot">.</span></strong><small>{roles[role]}</small></div><button className="mobile-nav-close icon-button" aria-label="Close navigation" onClick={()=>setMobile(false)}><X size={20}/></button></div>
      <div className="nav-section-label">THE FRESH<br/>DEPARTMENT</div>
      <nav className="sidebar-menu">{menus[role].map(([id,label,Icon],i)=><button key={id} title={collapsed?label:undefined} aria-label={label} aria-current={activeTab===id?'page':undefined} className={`sidebar-item ${activeTab===id?'active':''} ${role==='admin'&&i===8?'nav-divider':''}`} onClick={()=>select(id)}><Icon size={19}/><span>{label}</span><small className="nav-index">{String(i+1).padStart(2,'0')}</small>{activeTab===id&&<ChevronRight className="nav-chevron" size={14}/>}</button>)}</nav>
      <div className="sidebar-help"><LockKeyhole size={17}/><div><strong>Your secure workspace</strong><p>{role==='staff'?'Assigned hostel access':role==='student'?'Your records. Your privacy.':'Role-based campus access'}</p></div></div>
      <button className="collapse-toggle" onClick={()=>setCollapsed(v=>!v)} aria-label={collapsed?'Expand sidebar':'Collapse sidebar'} aria-expanded={!collapsed}>{collapsed?<PanelLeftOpen size={18}/>:<PanelLeftClose size={18}/>}<span>Collapse sidebar</span></button>
      <div className="sidebar-footer"><span className="user-avatar">{user.name.charAt(0)}</span><div><strong>{user.name}</strong><small>{role==='staff'?user.counter:role==='student'?user.laundryId:'Administrator'}</small></div><button className="icon-button" aria-label="Logout" title="Sign out" onClick={onLogout}><LogOut size={18}/></button></div>
    </aside>
    <main className="main-content">
      <header className="main-header"><div className="header-heading"><button ref={menuTrigger} className="mobile-menu icon-button" aria-label="Open navigation" aria-expanded={mobile} onClick={()=>setMobile(true)}><Menu size={21}/></button><div><div className="breadcrumb"><span className="department-mark">SW /</span><span>{roles[role]}</span><ChevronRight size={12}/><span>{current}</span></div><h2>{current}</h2></div></div>
        <div className="header-actions"><span className="header-context">{subtitle}</span><button className="icon-button refresh-button" aria-label="Refresh workspace" title="Refresh workspace" disabled={busy} onClick={onRefresh}><RefreshCw size={18} className={busy?'is-refreshing':''}/></button><NotificationCenter user={user}/><div className="account-control" ref={accountRef}><button className="account-trigger" aria-label="Account menu" aria-expanded={account} onClick={()=>setAccount(v=>!v)} onKeyDown={e=>{if(e.key==='Escape')setAccount(false);}}><span className="user-avatar">{user.name.charAt(0)}</span><ChevronDown size={14}/></button>{account&&<div className="account-menu" onKeyDown={e=>{if(e.key==='Escape'){setAccount(false);accountRef.current?.querySelector('button')?.focus();}}}><strong>{user.name}</strong><small>{roles[role]}</small><SecuritySettings onChanged={()=>{history.replaceState(null,'','/');window.dispatchEvent(new Event('session-expired'));}}/><button onClick={onLogout}><LogOut size={15}/>Sign out</button></div>}</div></div>
      </header>
      <div className="page-container" id="workspace-content" tabIndex={-1}>{children}<footer className="workspace-footer"><span>SmartWash · Campus laundry, connected.</span><span>{roles[role]}</span></footer></div>
    </main>
  </div>;
}
