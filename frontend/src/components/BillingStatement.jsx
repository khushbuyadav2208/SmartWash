import {useEffect,useState} from 'react';
import Modal from './Modal';
import {API_URL} from '../config';
import {apiFetch} from '../api';
export default function BillingStatement({order,onClose,onConfirmed}){
 const [data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[confirmed,setConfirmed]=useState(!!order.delivery?.studentConfirmedAt);
 useEffect(()=>{let live=true;apiFetch(`${API_URL}/api/requests/${order.id}/billing`).then(r=>r.json()).then(d=>{if(live)setData(d);}).catch(e=>{if(live)setError(e.message);});return()=>{live=false;};},[order.id]);
 const confirm=async()=>{setBusy(true);setError('');try{await apiFetch(`${API_URL}/api/requests/${order.id}/confirm-delivery`,{method:'POST'});setConfirmed(true);onConfirmed();}catch(e){setError(e.message);}finally{setBusy(false);}};
 return <Modal title="Laundry fee statement" onClose={onClose}>{error&&<p role="alert" className="form-error">{error}</p>}{!data&&!error&&<p role="status">Loading statement…</p>}{data&&<div className="billing-print"><p className="eyebrow">SMARTWASH · {data.statement.statementId}</p><h4>{data.studentName}</h4><p>{data.orderId} · {data.status}</p><dl className="fee-breakdown"><dt>Verified weight</dt><dd>{data.statement.weightKg} kg</dd><dt>Included allowance</dt><dd>{data.statement.includedWeightKg} kg</dd><dt>Additional weight rate</dt><dd>₹{data.statement.ratePerKg}/kg</dd><dt>Total additional fee</dt><dd>₹{data.statement.amount}</dd><dt>Payment</dt><dd>{data.statement.paymentStatus}</dd></dl><p>This statement records assessed charges. Payment collection is not configured.</p><div className="statement-actions"><button className="btn btn-secondary" onClick={()=>window.print()}>Print statement</button>{order.status==='Delivered'&&order.delivery?.at&&<button disabled={busy||confirmed} className="btn btn-primary" onClick={confirm}>{confirmed?'Collection confirmed':busy?'Confirming…':'Confirm I received my laundry'}</button>}</div></div>}</Modal>;
}
