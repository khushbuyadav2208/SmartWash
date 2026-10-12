import {useEffect,useState} from 'react';
import {API_URL} from '../config';
import {apiFetch} from '../api';
export default function ActivityHistory(){
 const [page,setPage]=useState(1),[data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{let live=true;setBusy(true);setError('');apiFetch(`${API_URL}/api/activity?page=${page}&limit=20`).then(r=>r.json()).then(d=>{if(live)setData(d);}).catch(e=>{if(live)setError(e.message);}).finally(()=>{if(live)setBusy(false);});return()=>{live=false;};},[page]);
 return <div className="glass-card"><h3>My operational activity</h3><p>Timestamped actions recorded for your account.</p>{busy&&<p role="status">Loading activity…</p>}{error&&<p role="alert" className="form-error">{error}</p>}{data&&<><div className="custom-table-container"><table className="custom-table"><thead><tr><th>Time</th><th>Action</th><th>Record</th></tr></thead><tbody>{data.items.map(a=><tr key={a.id}><td>{new Date(a.createdAt).toLocaleString()}</td><td>{a.action}</td><td>{a.entityId||'—'}</td></tr>)}</tbody></table></div>{!data.total&&<p className="empty-state">Your verified actions will appear here.</p>}<nav className="table-pagination" aria-label="Activity pages"><button className="btn btn-secondary" disabled={busy||page===1} onClick={()=>setPage(p=>p-1)}>Previous activity page</button><span>{page} / {Math.max(1,data.pages)}</span><button className="btn btn-secondary" disabled={busy||page>=data.pages} onClick={()=>setPage(p=>p+1)}>Next activity page</button></nav></>}</div>;
}
