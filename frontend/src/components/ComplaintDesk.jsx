import {useState,useEffect} from 'react';
import {API_URL} from '../config';
import {apiFetch as fetch} from '../api';
export default function ComplaintDesk({user}){
  const[issues,setIssues]=useState([]),[error,setError]=useState(''),[resolution,setResolution]=useState({}),[busy,setBusy]=useState('');
  const load=async()=>{try{setIssues(await(await fetch(`${API_URL}/api/issues`)).json());}catch(e){setError(e.message);}};
  useEffect(()=>{load();},[]);
  const resolve=async(e,id)=>{e.preventDefault();if(busy)return;setBusy(id);setError('');try{await fetch(`${API_URL}/api/issues/${id}/resolve`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({resolution:resolution[id]})});await load();}catch(e){setError(e.message);}finally{setBusy('');}};
  return <div className="glass-card"><header className="section-heading"><h3>Assigned complaint desk</h3><button className="btn btn-secondary" onClick={load}>Refresh complaints</button></header>{error&&<p role="alert" className="form-error">{error}</p>}{!issues.length&&<p className="empty-state">No complaints for this hostel.</p>}{issues.map(i=><article className="complaint-entry" key={i.id}><p><strong>{i.studentName}</strong> · {i.type} <span className="badge badge-pending">{i.status}</span></p><p>{i.description}</p>{i.resolution&&<p className="form-success">{i.resolution}</p>}{i.status!=='Resolved'&&(i.assignedTo===user.id||user.role==='admin')&&<form onSubmit={e=>resolve(e,i.id)} className="settings-form"><label>Resolution details<textarea className="custom-input" required value={resolution[i.id]||''} maxLength={2000} onChange={e=>setResolution(v=>({...v,[i.id]:e.target.value}))}/></label><button className="btn btn-primary" disabled={!!busy}>{busy===i.id?'Saving…':'Resolve complaint'}</button></form>}</article>)}</div>;
}
