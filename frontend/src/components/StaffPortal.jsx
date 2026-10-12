import PortalLayout from './PortalLayout';
import {EmptyState, WorkspaceSkeleton} from './WorkspaceUI';
import OrderDetails from './OrderDetails';
import PortalWelcome from './PortalWelcome';
import PagedTable from './PagedTable';
import React, { useState, useEffect, useCallback } from 'react';
import { 
  WashingMachine, ScanLine, CheckSquare, 
  ShoppingBag, Search, Check, 
  Play, Flame, UserCheck 
} from 'lucide-react';
import { API_URL } from '../config';
import { apiFetch as fetch } from '../api';
import ActivityHistory from './ActivityHistory';
import CameraScanner from './CameraScanner';
import ComplaintDesk from './ComplaintDesk';

export default function StaffPortal({ user, onLogout }) {
  const [detailOrder,setDetailOrder]=useState(null);
  const [activeTab, setActiveTab] = useState('queue');
  useEffect(()=>{const content=document.querySelector('.portal-staff .main-content');if(content)content.scrollTop=0;},[activeTab]);
  const [requests, setRequests] = useState([]);
  const [mutationBusy,setMutationBusy]=useState(false);
  const [hostel, setHostel] = useState(null);
  const [schedule, setSchedule] = useState(null);
  
  // Search and filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('Waiting for Verification');

  // Scanner States
  const [scanPayloadInput, setScanPayloadInput] = useState('');
  const [deliveryMode,setDeliveryMode]=useState(false);
  const [activeVerificationRequest, setActiveVerificationRequest] = useState(null);
  const [activeVerificationStudent, setActiveVerificationStudent] = useState(null);
  const [scannedTagsList, setScannedTagsList] = useState([]);
  const [scanError, setScanError] = useState('');
  const [scanSuccess, setScanSuccess] = useState('');
  const [weightInput, setWeightInput] = useState('');

  // Report Issue
  const [issueType, setIssueType] = useState('Wrong Quantity');
  const [issueDesc, setIssueDesc] = useState('');
  const [selectedReqForIssue, setSelectedReqForIssue] = useState('');

  const [dataError, setDataError] = useState('');
  const [dataLoading, setDataLoading] = useState(true);
  const fetchStaffData = useCallback(async () => {
    setDataLoading(true); setDataError('');
    try {
      // 1. Fetch hostel info
      const hostelRes = await fetch(`${API_URL}/api/hostels`);
      const hostelData = await hostelRes.json();
      const myHostel = hostelData.find(h => h.id === user.hostelId);
      setHostel(myHostel);

      // 1.5 Fetch schedule
      const schedRes = await fetch(`${API_URL}/api/schedules`);
      const schedData = await schedRes.json();
      const mySched = schedData.find(s => s.hostelId === user.hostelId);
      setSchedule(mySched);

      // 2. Fetch requests queue
      const reqRes = await fetch(`${API_URL}/api/requests/staff/${user.hostelId}`);
      const reqData = await reqRes.json();
      setRequests(reqData);
    } catch (err) {
      setDataError(err.message);
    } finally { setDataLoading(false); }
  }, [user.hostelId]);
  useEffect(() => {
    fetchStaffData();
  }, [fetchStaffData]);


  const handleUpdateStatus = async (requestId, nextStatus, note = '', extraArgs = {}) => {
    if(mutationBusy)return;setMutationBusy(true);
    try {
      const response = await fetch(`${API_URL}/api/requests/${requestId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus, note, ...extraArgs })
      });
      if (!response.ok) throw new Error("Failed to update status");
      
      setScanSuccess(`Order updated to ${nextStatus}.`);fetchStaffData();
      if (activeVerificationRequest?.id === requestId) {
        // Reset scanner screen if we completed verification
        setActiveVerificationRequest(null);
        setActiveVerificationStudent(null);
        setScannedTagsList([]);
        setScanPayloadInput('');
        setWeightInput('');
      }
    } catch (err) {
      setScanError(err.message);
    } finally {setMutationBusy(false);}
  };

  // QR verification handler
  const handleScan = async (payloadOverride = '',fresh = false) => {
    setScanError('');
    setScanSuccess('');
    const scanText = (payloadOverride || scanPayloadInput).trim();

    if (!scanText) {
      setScanError("Please enter or select a QR tag payload to verify.");
      return;
    }

    try {
      // Scenario A: First tag scan (No active request loaded yet)
      if (fresh || !activeVerificationRequest) {
        const response = await fetch(`${API_URL}/api/requests/scan-first`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payload: scanText })
        });
        
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Scan failed');

        setActiveVerificationRequest(data.request);
        setActiveVerificationStudent(data.student);
        setScannedTagsList(data.request.scannedTags || []);
        setScanSuccess(`Found request for student: ${data.student.name}. Loaded expected count: ${data.request.expectedTotal}`);
      } 
      // Scenario B: Subsequent tag scans (Already working on a request)
      else {
        const response = await fetch(`${API_URL}/api/requests/scan-tag`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requestId: activeVerificationRequest.id,
            payload: scanText
          })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Tag verification failed');

        setActiveVerificationRequest(data.request);
        setScannedTagsList(data.request.scannedTags);
        setScanSuccess(data.message);
      }
    } catch (err) {
      setScanError(err.message);
    }
  };

  const handleDelivery = async (payload) => {
    setScanError('');
    setScanSuccess('');

    try {
      const response = await fetch(`${API_URL}/api/requests/scan-delivery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Delivery scan failed');

      setScanSuccess(`Laundry delivered to ${data.request.studentName} successfully!`);
      fetchStaffData();
    } catch (err) {
      setScanError(err.message);
    }
  };

  const handleStaffReportIssue = async (e) => {
    e.preventDefault();
    if (!issueDesc || !selectedReqForIssue) {
      setScanError("Please select request and enter details.");
      return;
    }

    try {
      const dbReq = requests.find(r => r.id === selectedReqForIssue);
      const response = await fetch(`${API_URL}/api/issues`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: dbReq.studentId,
          type: issueType,
          description: issueDesc,
          requestId: selectedReqForIssue
        })
      });
      if (!response.ok) throw new Error("Failed to report issue");

      setScanSuccess("Issue ticket created and linked to the request.");
      setIssueDesc('');
      setSelectedReqForIssue('');
      fetchStaffData();
    } catch (err) {
      setScanError(err.message);
    }
  };

  const filteredRequests = requests.filter(r => {
    const matchesSearch = 
      r.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.laundryId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(r.room||'').includes(searchQuery) || r.id.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = !statusFilter || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <PortalLayout role="staff" user={user} activeTab={activeTab} onTabChange={tab=>{setActiveTab(tab);setScanError('');setScanSuccess('');if(tab==='scanner'){setDeliveryMode(false);setActiveVerificationRequest(null);setActiveVerificationStudent(null);setScannedTagsList([]);setScanPayloadInput('');setWeightInput('');}}} onRefresh={fetchStaffData} busy={dataLoading} subtitle={`${hostel?.name||'Assigned hostel'} · ${user.counter||'Laundry desk'}`} onLogout={onLogout}>
      
      {detailOrder&&<OrderDetails order={detailOrder} onClose={()=>setDetailOrder(null)}/>}
{activeTab==='activity'&&<ActivityHistory/>}
          {activeTab!=='scanner'&&scanError&&<p role="alert" className="form-error">{scanError}</p>}
          {activeTab!=='scanner'&&scanSuccess&&<p role="status" className="form-success">{scanSuccess}</p>}
          {dataError && <div role="alert" className="form-error">{dataError} <button onClick={fetchStaffData}>Retry</button></div>}
          {dataLoading && (!requests.length?<WorkspaceSkeleton/>:<div role="status" className="loading-bar">Refreshing records…</div>)}
          {activeTab==='queue'&&<PortalWelcome role="staff" name={user.name} onAction={()=>{setDeliveryMode(false);setActiveVerificationRequest(null);setActiveVerificationStudent(null);setScannedTagsList([]);setScanPayloadInput('');setWeightInput('');setActiveTab('scanner');}}/>}
          {activeTab==='queue'&&<div className="queue-status-grid">{[['Waiting for Verification','Verify garments',CheckSquare],['Received','Ready to wash',ShoppingBag],['Washing','Washing',WashingMachine],['Drying','Drying',Flame],['Ready','Ready to collect',UserCheck]].map(([status,label,Icon],index)=><button key={status} className={`queue-status-card ${statusFilter===status?'selected':''}`} aria-pressed={statusFilter===status} onClick={()=>setStatusFilter(status)}><span className="workflow-step">0{index+1} / <Icon size={17}/></span><strong>{requests.filter(r=>r.status===status).length}</strong><span>{label}</span><small>{statusFilter===status?'Showing in queue':'View queue'}</small></button>)}</div>}
          {activeTab==='queue'&&<div className="desk-brief"><div><span className="eyebrow">ON THE DESK</span><h2>Verify. Wash. Return.</h2></div><p>One label, one garment.<br/>Choose a stage above to focus your queue.</p><span className="desk-ready"><span className="live-dot"/>{requests.filter(r=>r.status==='Ready').length} ready for handover</span></div>}
          {/* QUEUE TAB */}
          {activeTab === 'queue' && (
            <div className="glass-card staff-queue">
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem', alignItems: 'center' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Laundry Desk Queue</h3>
                
                {/* Filters */}
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <div style={{ position: 'relative' }}>
                    <Search size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input 
                      type="text" 
                      className="custom-input"
                      aria-label="Search laundry queue" placeholder="Search student, room, order…"
                      style={{ paddingLeft: '2.5rem', maxWidth: '200px' }}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>

                  <select 
                    aria-label="Filter queue status" className="custom-input"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    style={{ width: 'auto' }}
                  >
                    <option value="">All active orders</option><option value="Waiting for Verification">Pending Verification</option>
                    <option value="Received">Received</option>
                    <option value="Washing">Washing</option>
                    <option value="Drying">Drying</option>
                    <option value="Ready">Ready</option>
                  </select>
                </div>
              </div>

              {filteredRequests.length === 0 ? (
                <EmptyState title="The queue is clear" description="No orders match this view. Choose a different stage or clear your search." action="Show all active orders" onAction={()=>{setStatusFilter('');setSearchQuery('');}}/>
              ) : (
                <PagedTable>
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Req ID</th>
                        <th>Student Name</th>
                        <th>Laundry ID</th>
                        <th>Room</th>
                        <th>Total Items</th>
                        <th>Weight / Fee</th>
                        <th>Breakdown</th>
                        <th>Status / Action</th><th>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRequests.map((r) => (
                        <tr key={r.id}>
                          <td style={{ fontWeight: 600, color: 'var(--hostel-color)' }}>{r.id}</td>
                          <td style={{ fontWeight: 600 }}>{r.studentName}{r.overdue&&<span className="badge badge-issue">Overdue</span>}</td>
                          <td>
                            <span className="badge" style={{ backgroundColor: 'var(--hostel-color-light)', color: 'var(--hostel-color)' }}>
                              {r.laundryId}
                            </span>
                          </td>
                          <td>Room {r.room}</td>
                          <td style={{ fontWeight: 700 }}>{r.expectedTotal}</td>
                          <td>
                            {r.weight !== undefined ? `${r.weight} kg` : <span style={{ color: 'var(--text-muted)' }}>-</span>}
                            {r.overLimitCharge > 0 && (
                              <span style={{ display: 'block', color: 'var(--status-issue)', fontSize: '0.75rem', fontWeight: 600, marginTop: '0.1rem' }}>
                                ₹{r.overLimitCharge}
                              </span>
                            )}
                          </td>
                          <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            {Object.entries(r.clothes).map(([name, qty]) => qty > 0 && `${name} (${qty})`).filter(Boolean).join(', ')}
                          </td>
                          <td>
                            {r.status === 'Waiting for Verification' && (
                              <button 
                                onClick={() => {
                                  setActiveTab('scanner');
                                  // Pre-load student for verification
                                  setDeliveryMode(false);handleScan(`${r.laundryId}`,true);
                                }}
                                className="btn btn-primary"
                                style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                              >
                                <ScanLine size={14} /> Verify Tags
                              </button>
                            )}

                            {r.status === 'Received' && (
                              <button 
                                disabled={mutationBusy} onClick={() => handleUpdateStatus(r.id, 'Washing', 'Washing started')}
                                className="btn btn-primary"
                                style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', backgroundColor: 'var(--status-washing)' }}
                              >
                                <Play size={14} /> Start Washing
                              </button>
                            )}

                            {r.status === 'Washing' && (
                              <button 
                                disabled={mutationBusy} onClick={() => handleUpdateStatus(r.id, 'Drying', 'Moved to dryer')}
                                className="btn btn-primary"
                                style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', backgroundColor: 'var(--status-drying)' }}
                              >
                                <Flame size={14} /> Move to Dry
                              </button>
                            )}

                            {r.status === 'Drying' && (
                              <button 
                                disabled={mutationBusy} onClick={() => handleUpdateStatus(r.id, 'Ready', 'Ironed and packed')}
                                className="btn btn-primary"
                                style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', backgroundColor: 'var(--status-ready)' }}
                              >
                                <Check size={14} /> Mark Ready
                              </button>
                            )}

                            {r.status === 'Ready' && (
                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button 
                                  onClick={() => { setActiveTab('scanner');setActiveVerificationRequest(null);setActiveVerificationStudent(null);setScannedTagsList([]);setScanPayloadInput('');setDeliveryMode(true); }}
                                  className="btn btn-primary"
                                  style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                                >
                                  <UserCheck size={14} /> Deliver
                                </button>
                              </div>
                            )}
                          </td>
                        <td><button className="btn btn-secondary" onClick={()=>setDetailOrder(r)}>View order</button></td></tr>
                      ))}
                    </tbody>
                  </table>
                </PagedTable>
              )}
            </div>
          )}

          {/* SCANNER WORKFLOW TAB */}
          {activeTab === 'scanner' && (
            <div className="scanner-workspace" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
              {/* Simulator & Camera Panel */}
              <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', textAlign: 'center' }}>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Scan QR Tag</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Scan the student's ID or physical garment labels.
                </p>

                <label className="camera-mode"><input type="checkbox" checked={deliveryMode} onChange={e=>setDeliveryMode(e.target.checked)}/> Delivery scanning mode</label><CameraScanner key={activeVerificationRequest?.id||'new'} onScan={value=>deliveryMode?handleDelivery(value):handleScan(value)}/>
                {/* Interactive Mock Scanning Panel */}
                <div style={{ background: 'var(--input-bg)', padding: '1.25rem', borderRadius: '1rem', border: '1px solid var(--border-color)', textAlign: 'left' }}>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{ color: 'var(--hostel-color)' }}></span> Manual verification
                  </h4>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                    Enter the printed tag payload below, or select an order to begin garment verification.
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                    {/* Quick select buttons */}
                    {!activeVerificationRequest ? (
                      <div>
                        <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                          STEP 1: IDENTIFY THE STUDENT
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                          {requests.filter(r => r.status === 'Waiting for Verification').map(r => (
                            <button
                              key={r.id}
                              type="button"
                              onClick={() => {
                                setScanPayloadInput(`${r.laundryId}`);
                                setDeliveryMode(false);handleScan(`${r.laundryId}`,true);
                              }}
                              className="btn btn-secondary"
                              style={{ width: '100%', justifyContent: 'flex-start', fontSize: '0.8rem', padding: '0.4rem 0.6rem' }}
                            >
                              Scan card for {r.studentName} ({r.laundryId})
                            </button>
                          ))}
                          {requests.filter(r => r.status === 'Waiting for Verification').length === 0 && (
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No students waiting in queue.</p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                          STEP 2: VERIFY EACH GARMENT
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem' }}>
                          {activeVerificationStudent?.tags.map((tag) => {
                            const isScanned = scannedTagsList.includes(tag.serialNumber);
                            return (
                              <button
                                key={tag.serialNumber}
                                type="button"
                                disabled={tag.status !== 'active' || isScanned}
                                onClick={() => {
                                  const payload = `${activeVerificationStudent.laundryId} | ${tag.serialNumber}`;
                                  setScanPayloadInput(payload);
                                  handleScan(payload);
                                }}
                                className="btn"
                                style={{
                                  fontSize: '0.75rem',
                                  padding: '0.35rem 0.25rem',
                                  backgroundColor: isScanned ? 'var(--status-ready-bg)' : 'var(--bg-secondary)',
                                  color: isScanned ? 'var(--status-ready)' : 'var(--text-primary)',
                                  border: `1px solid ${isScanned ? 'var(--status-ready)' : 'var(--border-color)'}`
                                }}
                              >
                                {tag.serialNumber}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
                      <input 
                        type="text" 
                        className="custom-input" 
                        aria-label="Manual QR payload" placeholder="Laundry ID | Tag serial"
                        value={scanPayloadInput}
                        onChange={(e) => setScanPayloadInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){if(deliveryMode)handleDelivery(scanPayloadInput);else handleScan();}}}
                        style={{ fontSize: '0.8rem' }}
                      />
                      <button 
                        onClick={() => deliveryMode?handleDelivery(scanPayloadInput):handleScan()}
                        className="btn btn-primary"
                        style={{ padding: '0.5rem' }}
                      >
                        Scan
                      </button>
                    </div>
                  </div>
                </div>

                <button className="btn btn-secondary" disabled={!scanPayloadInput.includes('|')} onClick={()=>handleDelivery(scanPayloadInput)}>Verify tag &amp; deliver ready order</button>
                {scanSuccess && (
                  <p role="status" className="form-success">{scanSuccess}</p>
                )}
                {scanError && (
                  <p role="alert" className="form-error">{scanError}</p>
                )}
              </div>

              {/* Verification Process Panel */}
              <div className="glass-card">
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '1.25rem' }}>Verification Details</h3>
                
                {activeVerificationRequest ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {/* Student Card Info */}
                    <div style={{ display: 'flex', gap: '0.75rem', background: 'var(--input-bg)', padding: '1rem', borderRadius: '0.75rem' }}>
                      <div className="user-avatar" style={{ width: '48px', height: '48px' }}>
                        {activeVerificationStudent?.name.charAt(0)}
                      </div>
                      <div>
                        <h4 style={{ fontWeight: 700 }}>{activeVerificationStudent?.name}</h4>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          Laundry ID: <b>{activeVerificationRequest.laundryId}</b> • Room: <b>{activeVerificationRequest.room}</b>
                        </p>
                      </div>
                    </div>

                    {/* Clothing Checklist */}
                    <div>
                      <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.5rem' }}>Clothes Declared</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        {Object.entries(activeVerificationRequest.clothes).map(([name, qty]) => qty > 0 && (
                          <div key={name} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', background: 'var(--bg-secondary)', borderRadius: '0.5rem', border: '1px solid var(--border-color)', fontSize: '0.9rem' }}>
                            <span>{name}</span>
                            <span style={{ fontWeight: 700 }}>{qty}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Verification Counter */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'var(--input-bg)', padding: '1rem', borderRadius: '0.75rem', border: '1px solid var(--border-color)' }}>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Scanned / Total Expected</p>
                      <h2 style={{ fontSize: '2.5rem', fontWeight: 800, margin: '0.25rem 0', color: scannedTagsList.length === activeVerificationRequest.expectedTotal ? 'var(--status-ready)' : 'var(--hostel-color)' }}>
                        {scannedTagsList.length} / {activeVerificationRequest.expectedTotal}
                      </h2>
                      
                      {scannedTagsList.length === activeVerificationRequest.expectedTotal ? (
                        <p style={{ color: 'var(--status-ready)', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          🟢 Count matches! Ready to accept.
                        </p>
                      ) : (
                        <p style={{ color: 'var(--status-pending)', fontSize: '0.8rem', fontWeight: 600 }}>
                          ⚠️ Count Mismatch! Scan all {activeVerificationRequest.expectedTotal} clothes tags.
                        </p>
                      )}
                    </div>

                    {/* Scanned Tag list */}
                    <div>
                      <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                        Scanned Tags <span style={{ fontSize: '0.75rem', fontWeight: 'normal', color: 'var(--text-muted)' }}>(Verified; duplicate scans keep the count unchanged)</span>
                      </h4>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                        {scannedTagsList.map(tag => (
                          <span 
                            key={tag} 
                            
                            className="badge badge-received" 
                            style={{ 
                              fontSize: '0.75rem', 
                              cursor: 'pointer', 
                              display: 'inline-flex', 
                              alignItems: 'center', 
                              gap: '0.25rem',
                              transition: 'all 0.2s'
                            }}
                            title="Verified tag"
                          >
                            {tag}
                          </span>
                        ))}
                        {scannedTagsList.length === 0 && <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No tags scanned yet.</span>}
                      </div>
                    </div>

                    {/* Weight Measurement Input */}
                    {(() => {
                      const maxW = schedule?.maxWeight !== undefined ? schedule.maxWeight : 5.0;
                      const rateW = schedule?.extraWeightRate !== undefined ? schedule.extraWeightRate : 20.0;
                      const measuredW = parseFloat(weightInput) || 0;
                      const isOverLimit = measuredW > maxW;
                      const extraWeight = isOverLimit ? Math.round((measuredW-maxW)*100)/100 : 0;
                      const overLimitFee = isOverLimit ? Math.round((measuredW-maxW)*rateW*100)/100 : 0;

                      return (
                        <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '0.75rem', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }} htmlFor="staffportal-control-1">
                            Measured Weight (kg) <span style={{ color: 'var(--status-issue)' }}>*</span>
                          </label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                            <input
 id="staffportal-control-1"                              type="number"
                              step="0.1"
                              max="100" min="0.1"
                              placeholder="e.g. 4.8"
                              className="custom-input"
                              style={{ maxWidth: '110px' }}
                              value={weightInput}
                              onChange={(e) => setWeightInput(e.target.value)}
                            />
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                              Limit: <b>{maxW} kg</b> (₹{rateW}/kg extra)
                            </span>
                          </div>
                          
                          {measuredW > 0 && (
                            <div style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>
                              {isOverLimit ? (
                                <p style={{ color: 'var(--status-issue)', fontWeight: 600 }}>
                                  ⚠️ +{extraWeight} kg over limit! Fee: ₹{overLimitFee}
                                </p>
                              ) : (
                                <p style={{ color: 'var(--status-washing)', fontWeight: 600 }}>
                                  🟢 Within limit ({measuredW} kg). No extra fee.
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Accept Action */}
                    {(() => {
                      const maxW = schedule?.maxWeight !== undefined ? schedule.maxWeight : 5.0;
                      const rateW = schedule?.extraWeightRate !== undefined ? schedule.extraWeightRate : 20.0;
                      const measuredW = parseFloat(weightInput) || 0;
                      const isOverLimit = measuredW > maxW;
                      const overLimitFee = isOverLimit ? Math.round((measuredW-maxW)*rateW*100)/100 : 0;

                      return (
                        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                          <button
                            onClick={() => handleUpdateStatus(
                              activeVerificationRequest.id, 
                              'Received', 
                              `Received and verified ${scannedTagsList.length} tags. Weight: ${measuredW} kg.`,
                              { weight: measuredW, overLimitCharge: overLimitFee }
                            )}
                            disabled={mutationBusy || scannedTagsList.length !== activeVerificationRequest.expectedTotal || measuredW <= 0 || measuredW > 100}
                            className="btn btn-primary"
                            style={{ flex: 1 }}
                          >
                            ✔ Accept Laundry
                          </button>
                          <button
                            onClick={() => {
                              setActiveVerificationRequest(null);
                              setActiveVerificationStudent(null);
                              setScannedTagsList([]);
                              setScanPayloadInput('');
                              setScanError('');
                              setScanSuccess('');
                              setWeightInput('');
                            }}
                            className="btn btn-secondary"
                          >
                            Cancel
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-muted)' }}>
                    <ScanLine size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
                    <p>No active scan session.</p>
                    <p style={{ fontSize: '0.8rem' }}>Please select a student's card scan from the manual controls on the left to start verification.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* FLAG ISSUES TAB */}
          {activeTab === 'issues' && (
            <><ComplaintDesk user={user}/><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
              <div className="glass-card">
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem' }}>Report Order Issue</h3>
                <form onSubmit={handleStaffReportIssue} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-secondary)' }} htmlFor="staffportal-field-1">
                      Select Pending Request
                    </label>
                    <select id="staffportal-field-1"
                      className="custom-input"
                      value={selectedReqForIssue}
                      onChange={(e) => setSelectedReqForIssue(e.target.value)}
                    >
                      <option value="">-- Select Active Request --</option>
                      {requests.map(r => (
                        <option key={r.id} value={r.id}>
                          {r.id} - {r.studentName} ({r.status})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-secondary)' }} htmlFor="staffportal-field-2">
                      Issue Type
                    </label>
                    <select id="staffportal-field-2"
                      className="custom-input"
                      value={issueType}
                      onChange={(e) => setIssueType(e.target.value)}
                    >
                      <option value="Wrong Quantity">Wrong Quantity / Mismatch</option>
                      <option value="Damaged Clothes">Damaged Clothes</option>
                      <option value="Missing Clothes">Missing Clothes</option>
                      <option value="Student Didn't Collect">Student Didn't Collect</option>
                      <option value="Lost Tag">Lost Tag / QR Damage</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-secondary)' }} htmlFor="staffportal-field-3">
                      Detailed Log Description
                    </label>
                    <textarea id="staffportal-field-3"
                      className="custom-input"
                      rows="4"
                      placeholder="Write exact details..."
                      value={issueDesc}
                      onChange={(e) => setIssueDesc(e.target.value)}
                      style={{ resize: 'vertical' }}
                    />
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
                    Submit Ticket & Flag
                  </button>
                </form>
              </div>

              {/* Flags list */}
              <div className="glass-card">
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem' }}>Active Flagged Requests</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {requests.filter(r => r.issue).map(r => (
                    <div key={r.id} style={{ padding: '1rem', background: 'var(--status-issue-bg)', color: 'var(--text-primary)', borderRadius: '0.75rem', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <h4 style={{ fontSize: '0.95rem', fontWeight: 700 }}>Request {r.id}</h4>
                        <span className="badge badge-issue">{r.issue.type}</span>
                      </div>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Student: <b>{r.studentName}</b> ({r.laundryId})</p>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>{r.issue.description}</p>
                    </div>
                  ))}
                  {requests.filter(r => r.issue).length === 0 && (
                    <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>No current orders have flagged issues.</p>
                  )}
                </div>
              </div>
            </div></>
          )}

    </PortalLayout>
  );
}
