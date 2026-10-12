import {useState} from 'react';
import {API_URL} from '../config';
import {apiFetch as fetch} from '../api';
export default function ProfileSettings({user,onUpdate}){
  const[name,setName]=useState(user.name),[mobile,setMobile]=useState(user.mobile||''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false);
  const save=async e=>{e.preventDefault();setBusy(true);setError('');setSaved(false);try{const r=await fetch(`${API_URL}/api/profile`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,mobile})});onUpdate((await r.json()).user);setSaved(true);}catch(e){setError(e.message);}finally{setBusy(false);}};
  return <div className="glass-card"><h3>Profile settings</h3><form onSubmit={save} className="settings-form"><label>Full name<input className="custom-input" required value={name} maxLength={200} onChange={e=>setName(e.target.value)}/></label><label>Mobile<input className="custom-input" value={mobile} maxLength={30} onChange={e=>setMobile(e.target.value)}/></label>{error&&<p className="form-error" role="alert">{error}</p>}{saved&&<p className="form-success" role="status">Profile saved.</p>}<button className="btn btn-primary" disabled={busy}>{busy?'Saving…':'Save profile'}</button></form></div>;
}
