import PortalLayout from './PortalLayout';
import {MetricCard, EmptyState, WorkspaceSkeleton, StatusBadge} from './WorkspaceUI';
import {useConfirm} from './confirmContext';
import OrderDetails from './OrderDetails';
import PortalWelcome from './PortalWelcome';
import PagedTable from './PagedTable';
import React, { useState, useEffect, useCallback } from 'react';
import { 
  Plus, CreditCard, Check, AlertCircle, ShoppingBag, ShieldAlert,
  WashingMachine
} from 'lucide-react';
import { API_URL } from '../config';
import { apiFetch as fetch } from '../api';
import BillingStatement from './BillingStatement';
import QrTags from './QrTags';
import ProfileSettings from './ProfileSettings';

const CLOTHING_TYPES = ["Shirts", "Pants", "T-Shirts", "Towels", "Bedsheets", "Blankets", "Others"];

export default function StudentPortal({ user, onLogout, onProfileUpdate }) {
  const confirm=useConfirm();
  const [detailOrder,setDetailOrder]=useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  useEffect(()=>{const content=document.querySelector('.portal-student .main-content');if(content)content.scrollTop=0;},[activeTab]);
  const [pickupDate,setPickupDate]=useState('');const [pickupOptions,setPickupOptions]=useState([]);const [statementOrder,setStatementOrder]=useState(null);
  const [historyStatus, setHistoryStatus] = useState('');
  const [requests, setRequests] = useState([]);
  const [schedule, setSchedule] = useState(null);
  const [hostel, setHostel] = useState(null);
  const [clothesInput, setClothesInput] = useState(
    CLOTHING_TYPES.reduce((acc, type) => ({ ...acc, [type]: 0 }), {})
  );
  
  // Issue report form state
  const [issueType, setIssueType] = useState('Missing Clothes');
  const [issueDesc, setIssueDesc] = useState('');
  const [selectedRequestForIssue, setSelectedRequestForIssue] = useState('');
  const [issuesList, setIssuesList] = useState([]);
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const [dataError, setDataError] = useState('');
  const [dataLoading, setDataLoading] = useState(true);
  const fetchStudentData = useCallback(async () => {
    setDataLoading(true); setDataError('');
    try {
      // 1. Fetch requests
      const reqRes = await fetch(`${API_URL}/api/requests/student/${user.id}`);
      const reqData = await reqRes.json();
      setRequests(reqData);

      const options=await (await fetch(`${API_URL}/api/pickup-options`)).json();setPickupOptions(options.options);setPickupDate(v=>v||options.options.find(o=>o.eligible)?.date||options.today);
      // 2. Fetch hostel schedules
      const schedRes = await fetch(`${API_URL}/api/schedules`);
      const schedData = await schedRes.json();
      const mySched = schedData.find(s => s.hostelId === user.hostelId);
      setSchedule(mySched);

      // 3. Fetch hostels to get dynamic color/name
      const hostelRes = await fetch(`${API_URL}/api/hostels`);
      const hostelData = await hostelRes.json();
      const myHostel = hostelData.find(h => h.id === user.hostelId);
      setHostel(myHostel);

      // 4. Fetch student issues
      const issueRes = await fetch(`${API_URL}/api/issues`);
      const issueData = await issueRes.json();
      const myIssues = issueData.filter(iss => iss.studentId === user.id);
      setIssuesList(myIssues);


    } catch (err) {
      setDataError(err.message);
    } finally { setDataLoading(false); }
  }, [user.id,user.hostelId]);
  useEffect(() => {
    fetchStudentData();
    const timer=setInterval(fetchStudentData,30000);
    return()=>clearInterval(timer);
  }, [fetchStudentData]);


  const handleQtyChange = (type, val) => {
    const remaining=20-Object.entries(clothesInput).filter(([key])=>key!==type).reduce((total,[,qty])=>total+qty,0);
    const qty = Math.min(remaining,Math.max(0, parseInt(val) || 0));
    setError('');
    setClothesInput(prev => ({ ...prev, [type]: qty }));
  };

  const handleSubmitRequest = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    const totalCount = Object.values(clothesInput).reduce((a, b) => a + b, 0);
    if (totalCount === 0) {
      setError("Please select at least one item to wash!");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: user.id,
          clothes: clothesInput, pickupDate
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to submit request');
      }

      setSuccess("Laundry request submitted successfully!");
      // Reset form
      setClothesInput(CLOTHING_TYPES.reduce((acc, type) => ({ ...acc, [type]: 0 }), {}));
      fetchStudentData();
      setActiveTab('dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReportIssue = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!issueDesc) {
      setError("Please write details about the issue.");
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/issues`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: user.id,
          type: issueType,
          description: issueDesc,
          requestId: selectedRequestForIssue || null
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to file issue');

      setSuccess("Issue ticket created successfully! Laundry staff or Admin will resolve it.");
      setIssueDesc('');
      setSelectedRequestForIssue('');
      fetchStudentData();
    } catch (err) {
      setError(err.message);
    }
  };

  // Get current active request (not delivered)
  const activeRequest = requests.find(r => !['Delivered','Cancelled'].includes(r.status));

  // Timeline steps
  const TIMELINE_STEPS = [
    { key: "Waiting for Verification", label: "Verification Required", desc: "Show your tags at laundry counter" },
    { key: "Received", label: "Laundry Accepted", desc: "Bags verified and weight confirmed" },
    { key: "Washing", label: "Washing In Progress", desc: "Clothes inside washers" },
    { key: "Drying", label: "Drying & Ironing", desc: "Tumble dry and pressing" },
    { key: "Ready", label: "Ready for Pickup", desc: "Collect clothes using your tag scan" }
  ];

  const getTimelineStepIndex = (status) => {
    return TIMELINE_STEPS.findIndex(s => s.key === status);
  };

  const activeStepIndex = activeRequest ? getTimelineStepIndex(activeRequest.status) : -1;

  const todayDay = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const selectedOption=pickupOptions.find(o=>o.date===pickupDate);
  const canSubmit=!!selectedOption?.eligible;

  return (
    <PortalLayout role="student" user={user} activeTab={activeTab} onTabChange={setActiveTab} onRefresh={fetchStudentData} busy={dataLoading} subtitle={`${hostel?.name||'Your hostel'} · Room ${user.room}`} onLogout={onLogout}>
      {statementOrder&&<BillingStatement order={statementOrder} onClose={()=>setStatementOrder(null)} onConfirmed={fetchStudentData}/>}
      {detailOrder&&<OrderDetails order={detailOrder} onClose={()=>setDetailOrder(null)}/>}

          {dataError && <div role="alert" className="form-error">{dataError} <button onClick={fetchStudentData}>Retry</button></div>}
          {dataLoading && (!requests.length?<WorkspaceSkeleton/>:<div role="status" className="loading-bar">Refreshing records…</div>)}
          {success && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '1rem', background: 'var(--status-ready-bg)', color: 'var(--status-ready)', borderRadius: '0.75rem', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
              <Check size={20} />
              <p style={{ fontSize: '0.9rem', fontWeight: 500 }}>{success}</p>
            </div>
          )}

          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '1rem', background: 'var(--status-issue-bg)', color: 'var(--status-issue)', borderRadius: '0.75rem', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              <AlertCircle size={20} />
              <p style={{ fontSize: '0.9rem', fontWeight: 500 }}>{error}</p>
            </div>
          )}

          {/* DASHBOARD TAB */}
          {activeTab === 'dashboard' && (
            <>
              <PortalWelcome role="student" name={user.name} onAction={()=>setActiveTab('submit')}/>{/* Quick Info Grid */}
              <div className="student-home-grid"><div className="student-overview"><section className="student-booking-card"><div><span className="eyebrow">YOUR NEXT FRESH START</span><h2>Your wardrobe, refreshed.</h2><p>Choose your garments and a pickup date. Attach your labels, then drop your bag at the desk.</p><button className="btn btn-primary" onClick={()=>setActiveTab('submit')}>Book Laundry <Plus size={17}/></button></div><div className="laundry-bag-art" aria-hidden="true"><ShoppingBag size={92} strokeWidth={1}/><span>WASH.<br/>WEAR.<br/>REPEAT.</span></div></section><section className="student-schedule glass-card"><p className="eyebrow">YOUR HOSTEL SCHEDULE</p><h3>{hostel?.name||'Your residence'}</h3><div className="week-chips">{['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(d=><span key={d} className={schedule?.days.includes(d)?'scheduled':''} title={d}>{d.slice(0,1)}</span>)}</div><p>{schedule?schedule.days.length===7?'Laundry available every day':schedule.days.join(', '):dataLoading?'Loading schedule…':'No schedule configured. Contact your laundry desk.'}</p>{schedule&&<div className="schedule-times"><span><small>DROP-OFF</small><strong>{schedule.pickup}</strong></span><span><small>DELIVERY</small><strong>{schedule.delivery}</strong></span></div>}</section></div>
              {/* Live Tracking Timeline */}
              <div className="glass-card tracking-card">
                <div className="tracking-title"><span className="eyebrow">FOLLOW YOUR FRESH</span><h3>Live Laundry Tracking</h3><span className="tracking-orbit" aria-hidden="true">↗</span></div>
                {activeRequest ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
                    <ol className="timeline laundry-progress" aria-label="Laundry progress">
                      {TIMELINE_STEPS.map((step, idx) => {
                        const isCompleted = idx < activeStepIndex;
                        const isActive = idx === activeStepIndex;
                        return (
                          <li 
                            key={step.key}
                            aria-current={isActive?'step':undefined} 
                            className={`timeline-step ${isCompleted ? 'completed' : ''} ${isActive ? 'active' : ''}`}
                          >
                            <span className="progress-number" aria-hidden="true">{isCompleted?<Check size={16}/>:idx+1}</span><h4 className="timeline-title">{step.label}</h4>
                            <p className="timeline-desc">{step.desc}</p>
                          </li>
                        );
                      })}
                    </ol>
                    
                    <div style={{ background: 'var(--input-bg)', padding: '1rem', borderRadius: '0.75rem', border: '1px solid var(--border-color)' }}>
                      <h4>Order details</h4><p className="order-meta">Pickup: {activeRequest.pickupDate} · Verified: {activeRequest.scannedTags.length}/{activeRequest.expectedTotal}</p>{activeRequest.estimatedReadyAt && <p className="order-meta">Estimated ready: {new Date(activeRequest.estimatedReadyAt).toLocaleString()} · Based on configured processing time</p>}{activeRequest.status==='Waiting for Verification'&&<button className="btn btn-secondary" onClick={async()=>{if(!await confirm({title:'Cancel this booking?',description:'Your reserved pickup place will be released.',action:'Cancel booking'}))return;try{await fetch(`${API_URL}/api/requests/${activeRequest.id}/cancel`,{method:'POST'});fetchStudentData();}catch(e){setError(e.message);}}}>Cancel request</button>}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '0.5rem', fontSize: '0.85rem' }}>
                        {Object.entries(activeRequest.clothes).map(([name, qty]) => qty > 0 && (
                          <div key={name} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0.5rem', background: 'var(--bg-secondary)', borderRadius: '0.4rem' }}>
                            <span>{name}:</span>
                            <span style={{ fontWeight: 600 }}>{qty}</span>
                          </div>
                        ))}
                      </div>
                      
                      {activeRequest.weight !== undefined && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Measured Weight:</span>
                            <span style={{ fontWeight: 600 }}>{activeRequest.weight} kg</span>
                          </div>
                          {activeRequest.overLimitCharge !== undefined && activeRequest.overLimitCharge > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--status-issue)', fontWeight: 600 }}>
                              <span>Over-Limit Charge:</span>
                              <span>₹{activeRequest.overLimitCharge}</span>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {activeRequest.issue && (
                        <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--status-issue-bg)', color: 'var(--status-issue)', padding: '0.75rem', borderRadius: '0.5rem', marginTop: '1rem', fontSize: '0.85rem' }}>
                          <ShieldAlert size={18} />
                          <div>
                            <p style={{ fontWeight: 600 }}>Flagged Mismatch / Issue</p>
                            <p>{activeRequest.issue.description}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <EmptyState title="Your first fresh start awaits" description="No active laundry order. Book a wash and follow your clothes from drop-off to collection." action="Book your first wash" onAction={()=>setActiveTab('submit')} icon={ShoppingBag}/>

                )}
              </div></div>
              <div className="dashboard-grid student-metrics"><MetricCard label="Current order" value={activeRequest?.status||'No active order'} detail={activeRequest?`${activeRequest.expectedTotal} clothes submitted`:'Ready when you are'} icon={ShoppingBag}/><MetricCard label="Garment labels" value={`${user.tags.filter(t=>t.status==='active').length} active`} detail={`${user.tags.length} labels assigned to you`} icon={CreditCard}/><MetricCard label="Completed washes" value={requests.filter(r=>r.status==='Delivered').length} detail="From your laundry history" icon={Check} tone="cyan"/></div>
            </>
          )}

          {activeTab==='dashboard'&&<section className="glass-card"><header className="section-heading"><div><p className="eyebrow">YOUR LAUNDRY JOURNAL</p><h3>Recent activity</h3></div><button className="btn btn-secondary" onClick={()=>setActiveTab('history')}>View history</button></header>{requests.length?<div className="student-activity-list">{requests.slice().sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,3).map(r=><button key={r.id} onClick={()=>setDetailOrder(r)}><span className="activity-icon"><WashingMachine size={21}/></span><span><strong>{r.expectedTotal} garments · {r.id}</strong><small>{new Date(r.createdAt).toLocaleDateString(undefined,{day:'numeric',month:'short'})} · {r.weight!==undefined?`${r.weight} kg`:'Weight at drop-off'}</small></span><StatusBadge status={r.status}/></button>)}</div>:<EmptyState title="A clean slate" description="Your recent washes and updates will appear here."/>}</section>}
          {/* SUBMIT REQUEST TAB */}
          {activeTab === 'submit' && (
            <div className="glass-card booking-form">
              <div style={{ marginBottom: '1.5rem' }}>
                <p className="eyebrow">01 SELECT · 02 SCHEDULE · 03 DROP OFF</p><h1>Book your next wash.</h1>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                  Choose up to 20 garments. Attach one active QR label to each item before drop-off.
                </p>
                {schedule && (
                  <p style={{ fontSize: '0.85rem', color: 'var(--hostel-color)', fontWeight: 600, marginTop: '0.5rem' }}>
                    ⚖️ Weight Limit: {schedule.maxWeight ?? 5.0} kg per bag. Extra weight will be charged at ₹{schedule.extraWeightRate ?? 20}/kg.
                  </p>
                )}
              </div>

              {!canSubmit && (
                <div style={{ display: 'flex', gap: '0.75rem', padding: '1rem', background: 'var(--status-issue-bg)', color: 'var(--status-issue)', borderRadius: '0.75rem', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
                  <AlertCircle size={20} />
                  <div>
                    <p style={{ fontWeight: 600 }}>Not Permitted Today</p>
                    <p>Hostel schedules laundry requests only on: {schedule?.days.join(', ')}. Today is {todayDay}.</p>
                  </div>
                </div>
              )}

              {activeRequest && (
                <div style={{ display: 'flex', gap: '0.75rem', padding: '1rem', background: 'var(--status-pending-bg)', color: 'var(--status-pending)', borderRadius: '0.75rem', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
                  <AlertCircle size={20} />
                  <div>
                    <p style={{ fontWeight: 600 }}>Active Request Pending</p>
                    <p>You cannot submit a new request until your current order ({activeRequest.id}) is Delivered.</p>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmitRequest} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <label>Pickup date<select className="custom-input" value={pickupDate} onChange={e=>setPickupDate(e.target.value)} required>{pickupOptions.map(o=><option key={o.date} value={o.date} disabled={!o.eligible}>{o.date} · {o.eligible?`${o.remaining} places available`:o.remaining===0?'Full':'Closed'}</option>)}</select></label>
                <div className="garment-selection-grid">
                  {CLOTHING_TYPES.map((type) => (
                    <div 
                      key={type} className="garment-picker"
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between', 
                        padding: '0.75rem 1rem', 
                        background: 'var(--input-bg)', 
                        borderRadius: '0.75rem',
                        border: '1px solid var(--border-color)'
                      }}
                    >
                      <span className="garment-name"><ShoppingBag size={30} strokeWidth={1}/>{type}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <button 
                          type="button" 
                          aria-label={`Remove ${type}`} onClick={() => handleQtyChange(type, clothesInput[type] - 1)}
                          disabled={!canSubmit || !!activeRequest}
                          style={{ width: '32px', height: '32px', borderRadius: '50%', border: 'none', background: 'var(--bg-secondary)', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 'bold' }}
                        >
                          -
                        </button>
                        <input 
                          type="number"
                          max="20" min="0"
                          disabled={!canSubmit || !!activeRequest}
                          aria-label={`${type} count`} value={clothesInput[type]} 
                          onChange={(e) => handleQtyChange(type, e.target.value)}
                          style={{ width: '45px', textAlign: 'center', border: 'none', background: 'transparent', fontWeight: 'bold', fontSize: '1rem', color: 'var(--text-primary)' }}
                        />
                        <button 
                          type="button" 
                          aria-label={`Add ${type}`} onClick={() => handleQtyChange(type, clothesInput[type] + 1)}
                          disabled={!canSubmit || !!activeRequest}
                          style={{ width: '32px', height: '32px', borderRadius: '50%', border: 'none', background: 'var(--bg-secondary)', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 'bold' }}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '0.5rem' }}>
                  <div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Total Clothes Selected</p>
                    <h4 style={{ fontSize: '1.25rem', fontWeight: 800 }}>
                      {Object.values(clothesInput).reduce((a, b) => a + b, 0)} Items
                    </h4>
                  </div>
                  <button 
                    type="submit" 
                    className="btn btn-primary"
                    disabled={!canSubmit || !!activeRequest || loading}
                  >
                    {loading ? 'Booking…' : 'Confirm booking'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* HISTORY TAB */}
          {activeTab === 'history' && (
            <div className="glass-card">
              <h3>My Laundry History</h3><label>Filter status<select className="custom-input" value={historyStatus} onChange={e=>setHistoryStatus(e.target.value)}><option value="">All statuses</option>{['Waiting for Verification','Received','Washing','Drying','Ready','Delivered','Cancelled'].map(v=><option key={v}>{v}</option>)}</select></label>
              {requests.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>No past laundry requests found.</p>
              ) : (
                <PagedTable>
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Request ID</th>
                        <th>Date Submitted</th>
                        <th>Total Items</th>
                        <th>Weight / Fee</th>
                        <th>Clothes Breakdown</th>
                        <th>Status</th><th>Statement / handover</th>
                      </tr>
                    </thead>
                    <tbody>
                      {requests.filter(r=>!historyStatus||r.status===historyStatus).map((r) => (
                        <tr key={r.id}>
                          <td style={{ fontWeight: 600, color: 'var(--hostel-color)' }}>{r.id}</td>
                          <td>{new Date(r.createdAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                          <td style={{ fontWeight: 600 }}>{r.expectedTotal}</td>
                          <td>
                            {r.weight !== undefined ? `${r.weight} kg` : <span style={{ color: 'var(--text-muted)' }}>-</span>}
                            {r.overLimitCharge > 0 && (
                              <span style={{ display: 'block', color: 'var(--status-issue)', fontSize: '0.8rem', fontWeight: 600 }}>
                                ₹{r.overLimitCharge}
                              </span>
                            )}
                          </td>
                          <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            {Object.entries(r.clothes).map(([name, qty]) => qty > 0 && `${name} (${qty})`).filter(Boolean).join(', ')}
                          </td>
                          <td>
                            <span className={`badge badge-${r.status.split(' ')[0].toLowerCase()}`}>
                              {r.status}
                            </span>
                          </td><td>{r.pricing||r.billing?<button className="btn btn-secondary" onClick={()=>setStatementOrder(r)}>View statement</button>:<small>Awaiting verified weight</small>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </PagedTable>
              )}
            </div>
          )}

          {/* REPORT ISSUE TAB */}
          {activeTab === 'issues' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
              <div className="glass-card">
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem' }}>Report a Laundry Issue</h3>
                <form onSubmit={handleReportIssue} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-secondary)' }} htmlFor="studentportal-field-1">
                      Issue Category
                    </label>
                    <select id="studentportal-field-1" 
                      className="custom-input"
                      value={issueType}
                      onChange={(e) => setIssueType(e.target.value)}
                    >
                      <option value="Missing Clothes">Missing Clothes</option>
                      <option value="Damaged Clothes">Damaged Clothes</option>
                      <option value="Wrong Delivery">Wrong Delivery</option>
                      <option value="Lost Tag / Card">Lost Tag / QR Tag Damage</option>
                      <option value="Other Issue">Other Complaint</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-secondary)' }} htmlFor="studentportal-field-2">
                      Related Request ID (Optional)
                    </label>
                    <select id="studentportal-field-2" 
                      className="custom-input"
                      value={selectedRequestForIssue}
                      onChange={(e) => setSelectedRequestForIssue(e.target.value)}
                    >
                      <option value="">-- Select Request --</option>
                      {requests.map(r => (
                        <option key={r.id} value={r.id}>{r.id} ({new Date(r.createdAt).toLocaleDateString()})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-secondary)' }} htmlFor="studentportal-field-3">
                      Detailed Description
                    </label>
                    <textarea id="studentportal-field-3" 
                      className="custom-input"
                      rows="4"
                      placeholder="Please specify which item is missing/damaged or describe the tag issue..."
                      value={issueDesc}
                      onChange={(e) => setIssueDesc(e.target.value)}
                      style={{ resize: 'vertical' }}
                    />
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
                    Submit Ticket
                  </button>
                </form>
              </div>

              <div className="glass-card">
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem' }}>My Reported Issues</h3>
                {issuesList.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>No issues filed yet.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {issuesList.map(issue => (
                      <div key={issue.id} style={{ padding: '1rem', background: 'var(--bg-secondary)', borderRadius: '0.75rem', border: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                          <h4 style={{ fontSize: '0.95rem', fontWeight: 700 }}>{issue.type}</h4>
                          <span className={`badge ${issue.status === 'Resolved' ? 'badge-ready' : 'badge-pending'}`}>
                            {issue.status}
                          </span>
                        </div>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{issue.description}</p>
                        {issue.resolution&&<p className="form-success"><strong>Resolution:</strong> {issue.resolution}</p>}
                        {issue.resolvedAt&&<small>Resolved {new Date(issue.resolvedAt).toLocaleString()}</small>}
                        {issue.requestId && (
                          <span style={{ display: 'inline-block', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                            Linked to request: <b>{issue.requestId}</b>
                          </span>
                        )}
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', textAlign: 'right' }}>
                          {new Date(issue.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* PROFILE TAB */}
          {activeTab === 'profile' && (
            <><ProfileSettings user={user} onUpdate={onProfileUpdate}/><QrTags user={user} onUpdate={onProfileUpdate}/><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
              <div className="glass-card">
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem' }}>Student Details</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.95rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Full Name:</span>
                    <span style={{ fontWeight: 600 }}>{user.name}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Roll Number:</span>
                    <span style={{ fontWeight: 600 }}>{user.rollNumber||'Not supplied'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Reg. Number:</span>
                    <span style={{ fontWeight: 600 }}>{user.regNumber||'Not supplied'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Hostel:</span>
                    <span style={{ fontWeight: 600 }}>{hostel?.name}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Room & Floor:</span>
                    <span style={{ fontWeight: 600 }}>Room {user.room}, Floor {user.floor}{user.building?` · ${user.building}`:''}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Mobile:</span>
                    <span style={{ fontWeight: 600 }}>{user.mobile}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Email:</span>
                    <span style={{ fontWeight: 600 }}>{user.email}</span>
                  </div>
                </div>
              </div>

              <div className="glass-card">
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem' }}>My Reusable QR Tags</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                  These tags must be attached to the clothes before giving them at the laundry counter.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '0.5rem' }}>
                  {user.tags.map((tag) => (
                    <div 
                      key={tag.serialNumber} 
                      style={{ 
                        padding: '0.5rem', 
                        borderRadius: '0.5rem', 
                        border: '1px solid var(--border-color)', 
                        background: tag.status === 'active' ? 'var(--bg-secondary)' : 'var(--status-issue-bg)',
                        textAlign: 'center' 
                      }}
                    >
                      <p style={{ fontSize: '0.85rem', fontWeight: 700, color: tag.status === 'active' ? 'var(--text-primary)' : 'var(--status-issue)' }}>
                        {tag.serialNumber}
                      </p>
                      <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                        {tag.status}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div></>
          )}

    </PortalLayout>
  );
}
