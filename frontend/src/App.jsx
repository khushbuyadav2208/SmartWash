import { useState, useEffect, lazy, Suspense } from 'react';
import ConfirmProvider from './components/ConfirmDialog';
import {WorkspaceSkeleton} from './components/WorkspaceUI';
import AuthScreen from './components/AuthScreen';
const StudentPortal=lazy(()=>import('./components/StudentPortal'));
const StaffPortal=lazy(()=>import('./components/StaffPortal'));
const AdminPortal=lazy(()=>import('./components/AdminPortal'));
import { Sun, Moon } from 'lucide-react';
import { API_URL } from './config';
import { apiFetch } from './api';
export default function App(){
  const [user,setUser]=useState(null);const [checking,setChecking]=useState(true);const [error,setError]=useState('');
  const [theme,setTheme]=useState(localStorage.getItem('theme')||'light');
  const refresh=async()=>{try{const r=await apiFetch(`${API_URL}/api/auth/me`);setUser((await r.json()).user);setError('');}catch(e){if(!/Sign in|Session expired|inactive/.test(e.message))setError(e.message);setUser(null);}finally{setChecking(false);}};
  useEffect(()=>{localStorage.removeItem('token');localStorage.removeItem('user');refresh();const expired=()=>setUser(null);window.addEventListener('session-expired',expired);return()=>window.removeEventListener('session-expired',expired);},[]);
  useEffect(()=>{if(user)history.replaceState(null,'',`/${user.role}`);},[user]);
  useEffect(()=>{document.documentElement.dataset.theme=theme;localStorage.setItem('theme',theme);},[theme]);
  const logout=async()=>{try{await apiFetch(`${API_URL}/api/auth/logout`,{method:'POST'});setUser(null);history.replaceState(null,'','/');}catch(e){setError(e.message);}};
  return <ConfirmProvider><button className="theme-toggle" aria-label="Toggle color theme" onClick={()=>setTheme(t=>t==='light'?'dark':'light')}>{theme==='light'?<Moon size={18}/>:<Sun size={18}/>}</button>
    {error&&<div role="alert" className="global-error">{error}<button onClick={refresh}>Retry connection</button></div>}
    {checking?<div className="session-loading"><WorkspaceSkeleton/></div>:!user?<AuthScreen onLoginSuccess={(_,u)=>setUser(u)}/>:<>
      {user.demoBatch&&<div className="demo-indicator">Development demo account</div>}<Suspense fallback={<div className="session-loading" role="status">Loading your workspace…</div>}> 
      {user.role==='student'&&<StudentPortal user={user} onLogout={logout} onProfileUpdate={setUser}/>}
      {user.role==='staff'&&<StaffPortal user={user} onLogout={logout}/>}
      {user.role==='admin'&&<AdminPortal user={user} onLogout={logout}/>}</Suspense>
    </>}
  </ConfirmProvider>;
}
