import PagedTable from './PagedTable';
import {useState,useEffect} from 'react';
import {API_URL} from '../config';
import {apiFetch as fetch} from '../api';
export default function AdminOperations({hostels,view}){
  const[audit,setAudit]=useState([]),[message,setMessage]=useState(''),[hostelId,setHostelId]=useState(''),[feedback,setFeedback]=useState(''),[busy,setBusy]=useState(false);
  const load=()=>fetch(`${API_URL}/api/audit`).then(r=>r.json()).then(setAudit).catch(e=>setFeedback(e.message));
  useEffect(()=>{load();},[]);
  const send=async e=>{e.preventDefault();setBusy(true);try{await fetch(`${API_URL}/api/notifications`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message,targetType:hostelId?'hostel':'all',hostelId})});setMessage('');setFeedback('Announcement sent.');load();}catch(e){setFeedback(e.message);}finally{setBusy(false);}};
  return <>{view==='announcements'&&<div className="glass-card announcements-card"><h3>Campus announcements</h3><form onSubmit={send} className="settings-form"><label>Audience<select className="custom-input" value={hostelId} onChange={e=>setHostelId(e.target.value)}><option value="">All users</option>{hostels.map(h=><option key={h.id} value={h.id}>{h.name}</option>)}</select></label><label>Message<textarea className="custom-input" required maxLength={1000} value={message} onChange={e=>setMessage(e.target.value)}/></label><button disabled={busy} className="btn btn-primary">{busy?'Sending…':'Send announcement'}</button>{feedback&&<p role="status">{feedback}</p>}</form></div>}
    {view==='audit'&&<div className="glass-card"><header className="section-heading"><h3>Audit history</h3><button className="btn btn-secondary" onClick={load}>Refresh audit</button></header><PagedTable><table className="custom-table"><thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Record</th></tr></thead><tbody>{audit.map(a=><tr key={a.id}><td>{new Date(a.createdAt).toLocaleString()}</td><td>{a.actorId}</td><td>{a.action}</td><td>{a.entityId||'—'}</td></tr>)}</tbody></table></PagedTable>{!audit.length&&<p className="empty-state">No events yet.</p>}</div>}</>;
}
