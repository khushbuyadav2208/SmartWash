import {useState,useEffect} from 'react';
import {Bell,X} from 'lucide-react';
import {API_URL} from '../config';
import {apiFetch as fetch} from '../api';
export default function NotificationCenter({user}){
  const [open,setOpen]=useState(false),[items,setItems]=useState([]),[error,setError]=useState('');
  const load=async()=>{try{setItems(await(await fetch(`${API_URL}/api/notifications`)).json());setError('');}catch(e){setError(e.message);}};
  useEffect(()=>{load();const timer=setInterval(load,30000);return()=>clearInterval(timer);},[user.userId,user.id]);
  const read=async id=>{try{await fetch(`${API_URL}/api/notifications/${id}/read`,{method:'POST'});setItems(list=>list.map(n=>n.id===id?{...n,read:true}:n));}catch(e){setError(e.message);}};
  return <div className="notifications"><button className="notification-toggle" aria-label="Notifications" aria-expanded={open} onClick={()=>{setOpen(v=>!v);load();}}><Bell size={19}/>{items.some(n=>!n.read)&&<i/>}</button>{open&&<section className="notification-panel" aria-label="Notification center"><header><h3>Updates for you</h3><button aria-label="Close notifications" onClick={()=>setOpen(false)}><X size={18}/></button></header>{error&&<p role="alert">{error}</p>}{!items.length&&!error&&<p className="empty-state">You’re all caught up.</p>}{items.map(n=><article key={n.id} className={n.read?'read':'unread'}><p>{n.message}</p><small>{new Date(n.createdAt).toLocaleString()}</small>{!n.read&&<button onClick={()=>read(n.id)}>Mark as read</button>}</article>)}</section>}</div>;
}
