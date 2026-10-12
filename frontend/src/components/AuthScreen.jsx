import LandingPage from './LandingPage';
import LaundryScene from './LaundryScene';
import { useState,useEffect } from 'react';
import { WashingMachine,ArrowRight,Eye,EyeOff,ShieldCheck,ScanLine,Clock3 } from 'lucide-react';
import { API_URL } from '../config';
import { apiFetch as fetch } from '../api';
export default function AuthScreen({onLoginSuccess}){
  const query=new URLSearchParams(window.location.search);
  const initialPortal=window.location.pathname.split('/')[1];const [portal,setPortal]=useState(['student','staff','admin'].includes(initialPortal)?initialPortal:'');
  const selectPortal=role=>{setPortal(role);history.replaceState(null,'',`/${role}`);switchMode('login');};
  const [mode,setMode]=useState(query.has('reset')?'reset':query.has('verify')?'verify':'login');
  const [form,setForm]=useState({name:'',email:'',password:'',confirmPassword:'',hostelId:'',room:''});
  const [hostels,setHostels]=useState([]);const [visible,setVisible]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [message,setMessage]=useState('');
  useEffect(()=>{fetch(`${API_URL}/api/auth/hostels`).then(r=>r.json()).then(setHostels).catch(e=>setError(e.message));},[]);
  const change=e=>setForm(f=>({...f,[e.target.name]:e.target.value,...(e.target.name==='hostelId'?{room:''}:{})}));
  const switchMode=m=>{setMode(m);setError('');setMessage('');setForm(f=>({...f,password:'',confirmPassword:''}));};
  const strong=form.password.length>=12&&/[a-z]/.test(form.password)&&/[A-Z]/.test(form.password)&&/[0-9]/.test(form.password);
  const submit=async e=>{e.preventDefault();if(busy)return;setError('');setMessage('');setBusy(true);
    try{if(['register','reset'].includes(mode)){if(!strong)throw new Error('Use at least 12 characters with uppercase, lowercase and a number.');if(form.password!==form.confirmPassword)throw new Error('Passwords do not match.');}
      const endpoint={login:'login',register:'register',forgot:'forgot-password',reset:'reset-password',verify:'verify-email',resend:'resend-verification'}[mode];
      const r=await fetch(`${API_URL}/api/auth/${endpoint}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...form,...(portal?{portal}:{}),token:query.get(mode)})});const data=await r.json();
      if(mode==='login')onLoginSuccess(null,data.user);else{setMessage(data.message);setForm(f=>({...f,password:'',confirmPassword:''}));if(['reset','verify'].includes(mode)){history.replaceState(null,'',window.location.pathname);setMode('login');}}
    }catch(e){setError(e.message);}finally{setBusy(false);}
  };
  const titles={login:['Welcome back.','Your laundry, beautifully organized.'],register:['A fresh start.','Create your student account.'],forgot:['Let’s get you back in.','Receive a secure password reset link.'],reset:['Choose a new password.','Your reset link can be used only once.'],verify:['Verify your email.','Confirm your account to start using Smart Wash.'],resend:['Check your inbox.','Request a new account verification link.']};
  const field=(name,label,type='text',required=true)=><label className="auth-field">{label}<input name={name} type={type} value={form[name]} onChange={change} required={required} autoComplete={name==='email'?'email':name==='name'?'name':undefined} className="custom-input" maxLength={name==='name'?200:undefined}/></label>;
  if(!portal&&mode==='login'&&!query.has('verify')&&!query.has('reset'))return <LandingPage onStart={selectPortal} onRegister={()=>{setPortal('student');history.replaceState(null,'','/student');switchMode('register');}}/>;
  return <main className={`auth-layout ${portal?'auth-portal':'auth-landing'}`}><section className="auth-story"><button className="auth-home-link" onClick={()=>{setPortal('');history.replaceState(null,'','/');switchMode('login');}}>← Back to SmartWash</button><div className="auth-brand"><WashingMachine size={28}/> SmartWash <span>RESIDENCE CARE</span></div>
    <div><p className="eyebrow">LESS LAUNDRY. MORE LIVING.</p><h1>A fresh spin on<br/><span>campus living.</span></h1><p className="auth-intro">From your hostel door to freshly folded clothes. One thoughtful place to book, track, and collect.</p>
      <LaundryScene/>
    </div><div className="auth-benefits"><span><ScanLine size={18}/> Every garment tracked</span><span><Clock3 size={18}/> Every step visible</span></div></section>
    <section className="auth-form-panel"><div className="auth-form-wrap"><span className="eyebrow">YOUR CAMPUS LAUNDRY, SIMPLIFIED</span><h2>{titles[mode][0]}</h2><p>{titles[mode][1]}</p>
      {['login','register'].includes(mode)&&<div className="portal-choices" aria-label="Choose your portal">{[['student','Student','Book & track'],['staff','Staff','Verify & process'],['admin','Admin','Manage campus']].map(([role,label,caption])=><button type="button" key={role} aria-pressed={portal===role} onClick={()=>selectPortal(role)}><strong>{label} Portal</strong><span>{caption}</span></button>)}</div>}
      {['login','register'].includes(mode)&&<div className="auth-tabs"><button type="button" className={mode==='login'?'selected':''} onClick={()=>switchMode('login')}>Sign in</button>{(!portal||portal==='student')&&<button type="button" className={mode==='register'?'selected':''} onClick={()=>switchMode('register')}>Create account</button>}</div>}
      <form onSubmit={submit}>
        {mode==='register'&&field('name','Full name')}
        {!['reset','verify'].includes(mode)&&field('email','Email address','email')}
        {['login','register','reset'].includes(mode)&&<label className="auth-field">Password<div className="password-field"><input name="password" type={visible?'text':'password'} value={form.password} onChange={change} required autoComplete={mode==='login'?'current-password':'new-password'} className="custom-input"/><button type="button" aria-label={visible?'Hide password':'Show password'} onClick={()=>setVisible(v=>!v)}>{visible?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></label>}
        {['register','reset'].includes(mode)&&<>{field('confirmPassword','Confirm password','password')}<p className={`strength ${strong?'valid':''}`}>{strong?'✓ Password meets requirements':'12+ characters · uppercase · lowercase · number'}</p></>}
        {mode==='register'&&<div className="form-two"><label className="auth-field">Hostel<select aria-label="Hostel" name="hostelId" value={form.hostelId} onChange={change} className="custom-input" required><option value="">Select hostel</option>{hostels.map(h=><option key={h.id} value={h.id}>{h.name}</option>)}</select></label><label className="auth-field">Room<select aria-label="Room" name="room" value={form.room} onChange={change} className="custom-input" required><option value="">Select room</option>{hostels.find(h=>h.id===form.hostelId)?.rooms.map(r=><option key={r}>{r}</option>)}</select></label></div>}
        {mode==='register'&&!hostels.length&&<p role="status">Ask your administrator to configure a hostel before registering.</p>}
        {error&&<div role="alert" className="form-error">{error}</div>}{message&&<div role="status" className="form-success">{message}</div>}
        <button className="btn btn-primary auth-submit" disabled={busy||mode==='register'&&!hostels.length}>{busy?'Please wait…':{login:'Sign in',register:'Create student account',forgot:'Send reset link',reset:'Reset password',verify:'Verify email',resend:'Resend verification'}[mode]}<ArrowRight size={18}/></button>
      </form><div className="auth-links">{mode==='login'?<><button onClick={()=>switchMode('forgot')}>Forgot password?</button><button onClick={()=>switchMode('resend')}>Resend verification</button></>:<button onClick={()=>switchMode('login')}>Back to sign in</button>}</div>
      <p className="auth-security"><ShieldCheck size={16}/> Secure access for students, staff and administrators</p>
    </div></section></main>;
}
