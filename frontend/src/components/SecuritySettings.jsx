import {useState} from 'react';
import Modal from './Modal';
import {API_URL} from '../config';
import {apiFetch} from '../api';
export default function SecuritySettings({onChanged}){
  const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');const [form,setForm]=useState({currentPassword:'',password:'',confirmPassword:''});
  const save=async e=>{e.preventDefault();setBusy(true);setError('');try{await apiFetch(`${API_URL}/api/auth/change-password`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)});setForm({currentPassword:'',password:'',confirmPassword:''});setOpen(false);onChanged();}catch(e){setError(e.message);}finally{setBusy(false);}};
  return <><button className="security-toggle" onClick={()=>{setError('');setOpen(true);}}>Account security</button>{open&&<Modal title="Change password" onClose={()=>{setOpen(false);setForm({currentPassword:'',password:'',confirmPassword:''});}}><form className="settings-form" onSubmit={save}>{[['currentPassword','Current password'],['password','New password'],['confirmPassword','Confirm new password']].map(([key,label])=><label key={key}>{label}<input className="custom-input" type="password" autoComplete={key==='currentPassword'?'current-password':'new-password'} required value={form[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))}/></label>)}<p>Use 12+ characters, uppercase, lowercase and a number. All sessions will be signed out.</p>{error&&<p role="alert" className="form-error">{error}</p>}<button className="btn btn-primary" disabled={busy}>{busy?'Updating…':'Change password & sign out'}</button></form></Modal>}</>;
}
