import OperationsCanvas from './OperationsCanvas';
import PortalLayout from './PortalLayout';
import {WorkspaceSkeleton, StatusBadge} from './WorkspaceUI';
import {useConfirm} from './confirmContext';
import OrderDetails from './OrderDetails';
import Modal from './Modal';
import PortalWelcome from './PortalWelcome';
import PagedTable from './PagedTable';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Plus, Trash2, 
  Search, X, ChevronRight
} from 'lucide-react';
import { API_URL } from '../config';
import { apiFetch as fetch } from '../api';
import RoomInventory from './RoomInventory';
import RecordEditor from './RecordEditor';
import AdminOperations from './AdminOperations';
import AnalyticsFilters from './AnalyticsFilters';

export default function AdminPortal({ user, onLogout }) {
  const confirm=useConfirm();
  const [resolvingIssue,setResolvingIssue]=useState(null),[resolutionText,setResolutionText]=useState('');
  const [detailOrder,setDetailOrder]=useState(null);
  const [orderSearch,setOrderSearch]=useState(''),[orderStatus,setOrderStatus]=useState('');
  const [editor,setEditor]=useState(null),[inventory,setInventory]=useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  useEffect(()=>{const content=document.querySelector('.portal-admin .main-content');if(content)content.scrollTop=0;},[activeTab]);
  const [stats, setStats] = useState(null);
  
  // Data lists
  const [hostels, setHostels] = useState([]);
  const [students, setStudents] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [requests, setRequests] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [issuesList, setIssuesList] = useState([]);
  
  // Search states
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal toggle & Form states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState(''); // addHostel, addStudent, addStaff, replaceTag
  
  // New Hostel Form State
  const [newHostelName, setNewHostelName] = useState('');
  const [newHostelColor, setNewHostelColor] = useState('#3b82f6');
  const [newHostelRooms, setNewHostelRooms] = useState('101,102,103,201,202,203');

  // New Student Form State
  const [studentName, setStudentName] = useState('');
  const [studentPassword, setStudentPassword] = useState('');
  const [schedCapacity,setSchedCapacity]=useState(100);
  const [schedHours,setSchedHours]=useState(24);
  const [monitorHostel,setMonitorHostel]=useState('');
  const [monitorStatus,setMonitorStatus]=useState('');
  const [monitorDate,setMonitorDate]=useState('');
  const [feedback,setFeedback]=useState('');const [mutationBusy,setMutationBusy]=useState(false);
  const [studentRoll, setStudentRoll] = useState('');
  const [studentReg, setStudentReg] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [studentMobile, setStudentMobile] = useState('');
  const [studentHostelId, setStudentHostelId] = useState('');
  const [studentFloor, setStudentFloor] = useState('1');
  const [studentRoom, setStudentRoom] = useState('101');

  // New Staff Form State
  const [staffName, setStaffName] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [staffHostelId, setStaffHostelId] = useState('');
  const [staffCounter, setStaffCounter] = useState('Counter A');

  // Replace Tag State
  const [selectedStudentForTag, setSelectedStudentForTag] = useState('');
  const [selectedTagToReplace, setSelectedTagToReplace] = useState('');
  const [tagReplaceReason, setTagReplaceReason] = useState('lost');

  // Schedule setup
  const [selectedSchedHostel, setSelectedSchedHostel] = useState('');
  const [selectedDays, setSelectedDays] = useState([]);
  const [schedPickup, setSchedPickup] = useState('08:00');
  const [schedDelivery, setSchedDelivery] = useState('18:00');
  const [schedEmergency, setSchedEmergency] = useState(false);
  const [schedMaxWeight, setSchedMaxWeight] = useState(5.0);
  const [schedExtraWeightRate, setSchedExtraWeightRate] = useState(20.0);

  const [dataError, setDataError] = useState('');
  const [dataLoading, setDataLoading] = useState(true);
  const schedSelection=useRef('');
  schedSelection.current=selectedSchedHostel;
  const fetchAdminData = useCallback(async () => {
    setDataLoading(true); setDataError('');
    try {
      // 1. Fetch dashboard stats
      const statsRes = await fetch(`${API_URL}/api/dashboard/admin`);
      const statsData = await statsRes.json();
      setStats(statsData);

      // 2. Fetch hostels
      const hostelRes = await fetch(`${API_URL}/api/hostels?includeInactive=true`);
      const hostelData = await hostelRes.json();
      setHostels(hostelData);
      if (hostelData.length > 0) {
        setStudentHostelId(v=>v||hostelData.find(h=>h.active)?.id);
        setStaffHostelId(v=>v||hostelData.find(h=>h.active)?.id);
        setSelectedSchedHostel(v=>v||hostelData.find(h=>h.active)?.id);
      }

      // 3. Fetch students
      const studRes = await fetch(`${API_URL}/api/students`);
      const studData = await studRes.json();
      setStudents(studData);

      // 4. Fetch staff
      const staffRes = await fetch(`${API_URL}/api/staff`);
      const staffData = await staffRes.json();
      setStaffList(staffData);

      // 5. Fetch schedules
      const schedRes = await fetch(`${API_URL}/api/schedules`);
      const schedData = await schedRes.json();
      setSchedules(schedData);

      // Load specific schedule state if schedule selection matches
      const currentSched = schedData.find(s => s.hostelId === (schedSelection.current || hostelData.find(h=>h.active)?.id));
      if (currentSched) {
        setSchedCapacity(currentSched.capacity||100);setSchedHours(currentSched.processingHours||24);
        setSelectedDays(currentSched.days);
        setSchedPickup(currentSched.pickup);
        setSchedDelivery(currentSched.delivery);
        setSchedEmergency(currentSched.emergencyEnabled);
        setSchedMaxWeight(currentSched.maxWeight !== undefined ? currentSched.maxWeight : 5.0);
        setSchedExtraWeightRate(currentSched.extraWeightRate !== undefined ? currentSched.extraWeightRate : 20.0);
      }

      // 6. Fetch requests
      const reqRes = await fetch(`${API_URL}/api/requests`);
      const reqData = await reqRes.json();
      setRequests(reqData);

      // 7. Fetch issues
      const issueRes = await fetch(`${API_URL}/api/issues`);
      const issueData = await issueRes.json();
      setIssuesList(issueData);

    } catch (err) {
      setDataError(err.message);
    } finally { setDataLoading(false); }
  }, []);
  useEffect(() => {
    fetchAdminData();
    // Default blue theme for Admin
    document.documentElement.style.setProperty('--hostel-color', '#3b82f6');
    document.documentElement.style.setProperty('--hostel-color-light', 'rgba(59, 130, 246, 0.12)');
    document.documentElement.style.setProperty('--hostel-color-hover', '#2563eb');
  }, [fetchAdminData]);

  useEffect(()=>{if(!isModalOpen)return;const prev=document.activeElement;const el=document.querySelector('.modal-content');const focus=()=>Array.from(el?.querySelectorAll('button,input,select,textarea')||[]).filter(e=>!e.disabled);focus()[0]?.focus();const key=e=>{if(e.key==='Escape')setIsModalOpen(false);if(e.key==='Tab'){const a=focus(),first=a[0],last=a.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}};document.addEventListener('keydown',key);return()=>{document.removeEventListener('keydown',key);prev?.focus();};},[isModalOpen]);

  const handleCreateHostel = async (e) => {
    e.preventDefault();if(mutationBusy)return;
    setMutationBusy(true);setDataError('');
    try {
      const roomArr = newHostelRooms.split(',').map(r => r.trim());
      const response = await fetch(`${API_URL}/api/hostels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newHostelName,
          color: newHostelColor,
          rooms: roomArr
        })
      });
      if (!response.ok) throw new Error("Failed to create hostel");
      
      setNewHostelName('');
      setIsModalOpen(false);
      fetchAdminData();
    } catch (err) {
      setDataError(err.message);
    } finally {setMutationBusy(false);}
  };

  const editHostel=record=>setEditor({type:'hostel',record});
  const editStudent=record=>setEditor({type:'student',record});
  const editStaff=record=>setEditor({type:'staff',record});
  const handleDeleteHostel = async (id) => {
    if (!await confirm({title:'Archive hostel?',description:'Archive this empty hostel? Existing records are retained.',action:'Archive hostel'})) return;
    try {
      const response = await fetch(`${API_URL}/api/hostels/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error("Failed to delete");
      fetchAdminData();
    } catch (err) {
      setDataError(err.message);
    }
  };

  const handleCreateStudent = async (e) => {
    e.preventDefault();if(mutationBusy)return;
    setMutationBusy(true);setDataError('');
    try {
      const response = await fetch(`${API_URL}/api/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: studentName,
          rollNumber: studentRoll,
          regNumber: studentReg,
          email: studentEmail, password: studentPassword,
          mobile: studentMobile,
          hostelId: studentHostelId,
          floor: parseInt(studentFloor),
          room: studentRoom
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to create student");

      // Reset
      setStudentPassword('');setStudentName('');
      setStudentRoll('');
      setStudentReg('');
      setStudentEmail('');
      setStudentMobile('');
      setIsModalOpen(false);
      fetchAdminData();
    } catch (err) {
      setDataError(err.message);
    } finally {setMutationBusy(false);}
  };

  const handleToggleStudent = async (id) => {
    const current=students.find(s=>s.id===id);if(current?.status==='active'&&!await confirm({title:'Deactivate student?',description:'This student will lose access until reactivated. Their laundry history will be retained.',action:'Deactivate student'}))return;
    try {
      const response = await fetch(`${API_URL}/api/students/${id}/toggle-status`, { method: 'POST' });
      if (!response.ok) throw new Error("Failed to toggle status");
      fetchAdminData();
    } catch (err) {
      setDataError(err.message);
    }
  };

  const handleCreateStaff = async (e) => {
    e.preventDefault();if(mutationBusy)return;
    setMutationBusy(true);setDataError('');
    try {
      const response = await fetch(`${API_URL}/api/staff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: staffName,
          email: staffEmail,
          password: staffPassword,
          hostelId: staffHostelId,
          counter: staffCounter
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to create staff");

      setStaffName('');
      setStaffEmail('');
      setStaffPassword('');
      setIsModalOpen(false);
      fetchAdminData();
    } catch (err) {
      setDataError(err.message);
    } finally {setMutationBusy(false);}
  };

  const handleDeleteStaff = async (id) => {
    if (!await confirm({title:'Deactivate staff account?',description:'This staff member will lose access. Their records and activity will be retained.',action:'Deactivate account'})) return;
    try {
      const response = await fetch(`${API_URL}/api/staff/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error("Failed to delete");
      fetchAdminData();
    } catch (err) {
      setDataError(err.message);
    }
  };

  const handleReplaceTag = async (e) => {
    e.preventDefault();if(mutationBusy)return;
    if (!selectedStudentForTag || !selectedTagToReplace) return;
    setMutationBusy(true);setDataError('');
    try {
      const response = await fetch(`${API_URL}/api/students/${selectedStudentForTag}/replace-tag`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          oldTagSerial: selectedTagToReplace,
          reason: tagReplaceReason
        })
      });
      if (!response.ok) throw new Error("Failed to replace tag");
      
      setIsModalOpen(false);
      setSelectedStudentForTag('');
      setSelectedTagToReplace('');
      fetchAdminData();
    } catch (err) {
      setDataError(err.message);
    } finally {setMutationBusy(false);}
  };

  const handleToggleTagStatus = async (studentId, tagSerial) => {
    if(!await confirm({title:'Disable garment tag?',description:'This label will no longer be accepted for garment verification.',action:'Disable tag'}))return;
    try {
      const response = await fetch(`${API_URL}/api/students/${studentId}/disable-tag`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tagSerial })
      });
      if (!response.ok) throw new Error("Failed to update status");
      fetchAdminData();
    } catch (err) {
      setDataError(err.message);
    }
  };

  const handleResolveIssue = async (e) => {
    e.preventDefault();if(mutationBusy)return;
    setMutationBusy(true);setDataError('');
    try {
      await fetch(`${API_URL}/api/issues/${resolvingIssue}/resolve`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({resolution:resolutionText.trim()})});
      setResolvingIssue(null);setResolutionText('');setFeedback('Complaint resolved. The student can see your resolution.');fetchAdminData();
    } catch (err) {setDataError(err.message);} finally {setMutationBusy(false);}
  };

  const handleSaveSchedule = async (e) => {
    e.preventDefault();if(mutationBusy)return;
    if (!selectedSchedHostel) return;
    setMutationBusy(true);setDataError('');
    try {
      const response = await fetch(`${API_URL}/api/schedules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hostelId: selectedSchedHostel,
          days: selectedDays,
          pickup: schedPickup,
          delivery: schedDelivery,
          emergencyEnabled: schedEmergency,
          maxWeight: schedMaxWeight,
          extraWeightRate: schedExtraWeightRate, capacity:schedCapacity, processingHours:schedHours
        })
      });
      if (!response.ok) throw new Error("Failed to save schedule");
      
      setFeedback("Hostel schedule saved successfully!");
      fetchAdminData();
    } catch (err) {
      setDataError(err.message);
    } finally {setMutationBusy(false);}
  };

  const handleSchedHostelChange = (hostelId) => {
    setSelectedSchedHostel(hostelId);
    const sched = schedules.find(s => s.hostelId === hostelId);
    if (sched) {
      setSchedCapacity(sched.capacity||100); setSchedHours(sched.processingHours||24);
      setSelectedDays(sched.days);
      setSchedPickup(sched.pickup);
      setSchedDelivery(sched.delivery);
      setSchedEmergency(sched.emergencyEnabled);
      setSchedMaxWeight(sched.maxWeight !== undefined ? sched.maxWeight : 5.0);
      setSchedExtraWeightRate(sched.extraWeightRate !== undefined ? sched.extraWeightRate : 20.0);
    } else {
      setSelectedDays([]);
      setSchedPickup('08:00');
      setSchedDelivery('18:00');
      setSchedEmergency(false);
      setSchedMaxWeight(5.0);
      setSchedExtraWeightRate(20.0);
    }
  };

  const handleDayCheckboxChange = (day) => {
    setSelectedDays(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  // Get active student details for tag replacement modal
  const activeStudentForTag = students.find(s => s.id === selectedStudentForTag);

  // Filter students
  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.rollNumber||'').toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.laundryId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Filter requests
  const filteredRequests = requests.filter(r => (!monitorHostel||r.hostelId===monitorHostel)&&(!monitorStatus||r.status===monitorStatus)&&(!monitorDate||r.createdAt.slice(0,10)===monitorDate)).filter(r => 
    r.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.laundryId.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <PortalLayout role="admin" user={user} activeTab={activeTab} onTabChange={tab=>{setActiveTab(tab);setSearchQuery('');}} onRefresh={fetchAdminData} busy={dataLoading} subtitle="Campus management" onLogout={onLogout}>
      {resolvingIssue&&<Modal title="Resolve complaint" onClose={()=>setResolvingIssue(null)}><form className="settings-form" onSubmit={handleResolveIssue}><label>Resolution for the student<textarea required minLength={1} maxLength={2000} className="custom-input" value={resolutionText} onChange={e=>setResolutionText(e.target.value)}/></label>{dataError&&<p role="alert" className="form-error">{dataError}</p>}<button disabled={mutationBusy||!resolutionText.trim()} className="btn btn-primary">{mutationBusy?'Saving…':'Resolve complaint'}</button></form></Modal>}
      {inventory&&<RoomInventory hostel={inventory} onClose={()=>setInventory(null)} onSaved={()=>{setInventory(null);fetchAdminData();}}/>}{editor&&<RecordEditor {...editor} hostels={hostels.filter(h=>h.active)} onClose={()=>setEditor(null)} onSaved={()=>{setEditor(null);fetchAdminData();}}/>}
      {detailOrder&&<OrderDetails order={detailOrder} onClose={()=>setDetailOrder(null)}/>}

          {feedback&&<p role="status" className="form-success">{feedback}</p>}
          {activeTab!=='dashboard'&&<div className="page-intro"><p className="eyebrow">CAMPUS MANAGEMENT</p><h1>{({hostels:'A place for every student.',students:'Your campus community.',tags:'Every garment, identified.',staff:'The people behind the service.',schedules:'A rhythm that works.',monitoring:'Every order, in view.',issues:'Support that follows through.',announcements:'Keep your campus informed.',audit:'A clear record of every action.'})[activeTab]}</h1><p>Manage your campus laundry service with complete, connected records.</p></div>}
          {['announcements','audit'].includes(activeTab)&&<AdminOperations hostels={hostels} view={activeTab}/>}
          {dataError && <div role="alert" className="form-error">{dataError} <button onClick={fetchAdminData}>Retry</button></div>}
          {dataLoading && (!stats?<WorkspaceSkeleton/>:<div role="status" className="loading-bar">Refreshing records…</div>)}

          {/* DASHBOARD TAB */}
          {activeTab === 'dashboard' && stats && (
            <><PortalWelcome role="admin" name={user.name} onAction={()=>setActiveTab('monitoring')}/>
              <OperationsCanvas stats={stats} onNavigate={setActiveTab}/>
              <section className="glass-card recent-orders"><header className="section-heading"><div><p className="eyebrow">ORDER MANAGEMENT</p><h3>Recent laundry orders</h3></div><button className="btn btn-secondary" onClick={()=>setActiveTab('monitoring')}>View monitoring <ChevronRight size={15}/></button></header><div className="orders-toolbar"><label className="search-field"><Search size={17}/><input className="custom-input" placeholder="Search student, laundry or order ID" value={orderSearch} onChange={e=>setOrderSearch(e.target.value)}/><span className="sr-only">Search recent orders</span></label><label><span className="sr-only">Filter recent orders by status</span><select className="custom-input" value={orderStatus} onChange={e=>setOrderStatus(e.target.value)}><option value="">All statuses</option>{['Waiting for Verification','Received','Washing','Drying','Ready','Delivered','Cancelled'].map(v=><option key={v}>{v}</option>)}</select></label></div>
                <PagedTable emptyTitle="No orders to show" emptyDescription="Bookings will appear here as students submit laundry. Try clearing your filters."><table className="custom-table"><thead><tr><th>Order / student</th><th>Hostel</th><th>Items / weight</th><th>Pickup</th><th>Status</th><th>Details</th></tr></thead><tbody>{requests.filter(r=>(!orderStatus||r.status===orderStatus)&&`${r.studentName} ${r.id} ${r.laundryId}`.toLowerCase().includes(orderSearch.toLowerCase())).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).map(r=><tr key={r.id}><td><strong>{r.studentName}</strong><small className="table-subtext">{r.id} · {r.laundryId}</small></td><td>{r.hostelName}</td><td>{r.expectedTotal} items<small className="table-subtext">{r.weight!==undefined?`${r.weight} kg`:'Awaiting weight'}</small></td><td>{r.pickupDate||new Date(r.createdAt).toLocaleDateString()}</td><td><StatusBadge status={r.status}/></td><td><button className="btn btn-secondary" onClick={()=>setDetailOrder(r)}>View order</button></td></tr>)}</tbody></table></PagedTable>
              </section>
              <AnalyticsFilters hostels={hostels}/>
              {/* Recent activity timeline */}
              <div className="glass-card">
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' }}>Recent Laundry Activities</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {stats.recentActivities.map((act, index) => (
                    <div key={index} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 1rem', background: 'var(--bg-secondary)', borderRadius: '0.75rem', border: '1px solid var(--border-color)', fontSize: '0.9rem' }}>
                      <div>
                        <span>Student <b>{act.studentName}</b> ({act.laundryId}) status moved to </span>
                        <span className={`badge badge-${act.status.split(' ')[0].toLowerCase()}`} style={{ marginLeft: '0.25rem' }}>{act.status}</span>
                      </div>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                  {stats.recentActivities.length === 0 && (
                    <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>No recent activity logged.</p>
                  )}
                </div>
              </div>
            </>
          )}

          {/* HOSTELS TAB */}
          {activeTab === 'hostels' && (
            <div className="glass-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Hostel Campus Configurations</h3>
                <button onClick={() => { setModalType('addHostel'); setIsModalOpen(true); }} className="btn btn-primary">
                  <Plus size={16} /> Add Hostel
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
                {hostels.map(h => (
                  <div key={h.id} className="glass-card" style={{ borderLeft: `6px solid ${h.color}`, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '1rem' }}>
                    <div>
                      <h4 style={{ fontSize: '1.1rem', fontWeight: 800 }}>{h.name} <span className="badge badge-received">{h.active?'Active':'Archived'}{h.demoBatch?' · Demo':''}</span></h4>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                        ID: <b>{h.id}</b> • Assigned Theme Color: 
                        <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: h.color, marginLeft: '0.5rem' }}></span>
                      </p>
                    </div>

                    <div style={{ display: 'flex', flexWrap:'wrap', gap: '0.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.8rem' }}>
                      <button className="btn btn-secondary" onClick={()=>editHostel(h)}>Edit details</button><button className="btn btn-secondary" onClick={()=>setInventory(h)}>Rooms & buildings</button><button disabled={!h.active} aria-label={`Archive hostel ${h.name}`} onClick={() => handleDeleteHostel(h.id)} className="btn btn-danger" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
                        <Trash2 size={14} /> Archive
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STUDENT MAPPING TAB */}
          {activeTab === 'students' && (
            <div className="glass-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem', alignItems: 'center' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Registered Students & Room Mapping</h3>
                
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <div style={{ position: 'relative' }}>
                    <Search size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input 
                      type="text" 
                      className="custom-input"
                      placeholder="Search students..."
                      style={{ paddingLeft: '2.5rem', maxWidth: '240px' }}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <button onClick={() => { setModalType('addStudent'); setIsModalOpen(true); }} className="btn btn-primary">
                    <Plus size={16} /> Register Student
                  </button>
                </div>
              </div>

              <PagedTable>
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Roll Number</th>
                      <th>Hostel</th>
                      <th>Room & Floor</th>
                      <th>Laundry ID</th>
                      <th>Email / Phone</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map(s => (
                      <tr key={s.id}>
                        <td style={{ fontWeight: 600 }}>{s.name}</td>
                        <td>{s.rollNumber}</td>
                        <td>
                          <span className="badge" style={{ backgroundColor: `${s.hostelColor}1e`, color: s.hostelColor }}>
                            {s.hostelName}
                          </span>
                        </td>
                        <td>Room {s.room} (Flr {s.floor})</td>
                        <td style={{ fontWeight: 700, color: 'var(--hostel-color)' }}>{s.laundryId}</td>
                        <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          {s.email} <br/> {s.mobile}
                        </td>
                        <td>
                          <button className="btn btn-secondary" onClick={()=>editStudent(s)}>Edit</button><button 
                            onClick={() => handleToggleStudent(s.id)}
                            className={`btn ${s.status === 'active' ? 'btn-secondary' : 'btn-danger'}`}
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                          >
                            {s.status === 'active' ? 'Deactivate' : 'Activate'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </PagedTable>
            </div>
          )}

          {/* LAUNDRY ID & TAGS TAB */}
          {activeTab === 'tags' && (
            <div className="glass-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem', alignItems: 'center' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>QR Tag Allocation & Management</h3>
                <button onClick={() => { setModalType('replaceTag'); setIsModalOpen(true); }} className="btn btn-primary">
                  Replace Lost Tag
                </button>
              </div>

              <PagedTable>
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Laundry ID</th>
                      <th>Tag Allocation & Statuses</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map(s => (
                      <tr key={s.id}>
                        <td>
                          <p style={{ fontWeight: 600 }}>{s.name}{s.demoBatch&&<small> · Demo</small>}</p>
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Room {s.room}, {s.email}</p>
                        </td>
                        <td style={{ fontWeight: 700, color: 'var(--hostel-color)' }}>{s.laundryId}</td>
                        <td>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                            {s.tags.map(t => (
                              <div 
                                key={t.serialNumber}
                                role="button" tabIndex={0} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();handleToggleTagStatus(s.id,t.serialNumber);}}} onClick={() => handleToggleTagStatus(s.id, t.serialNumber)}
                                title="Click to Toggle Active/Disabled status"
                                style={{ 
                                  padding: '0.2rem 0.4rem', 
                                  borderRadius: '0.25rem', 
                                  border: '1px solid var(--border-color)', 
                                  background: t.status === 'active' ? 'var(--input-bg)' : 'var(--status-issue-bg)',
                                  color: t.status === 'active' ? 'var(--text-primary)' : 'var(--status-issue)',
                                  fontSize: '0.75rem',
                                  cursor: 'pointer',
                                  fontWeight: '600'
                                }}
                              >
                                {t.serialNumber} ({t.status.charAt(0)})
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </PagedTable>
            </div>
          )}

          {/* STAFF TAB */}
          {activeTab === 'staff' && (
            <div className="glass-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Laundry Staff Credentials</h3>
                <button onClick={() => { setModalType('addStaff'); setIsModalOpen(true); }} className="btn btn-primary">
                  <Plus size={16} /> Add Staff Account
                </button>
              </div>

              <PagedTable>
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Staff Name</th>
                      <th>Email ID</th>
                      <th>Assigned Hostel</th>
                      <th>Assigned Counter</th>
                      <th>Security</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffList.map(s => (
                      <tr key={s.id}>
                        <td style={{ fontWeight: 600 }}>{s.name}</td>
                        <td>{s.email}</td>
                        <td>
                          <span className="badge" style={{ backgroundColor: `${s.hostelColor}1e`, color: s.hostelColor }}>
                            {s.hostelName}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600 }}>{s.counter}</td>
                        <td><span className={`badge ${s.active?'badge-ready':'badge-issue'}`}>{s.active?'Active':'Inactive'}</span>{s.demoBatch&&<small> · Demo</small>}</td>
                        <td>
                          <button className="btn btn-secondary" onClick={()=>editStaff(s)}>Edit</button><button disabled={!s.active} onClick={() => handleDeleteStaff(s.id)} className="btn btn-danger" style={{ padding: '0.35rem 0.7rem', fontSize: '0.75rem' }}>
                            Deactivate
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </PagedTable>
            </div>
          )}

          {/* SCHEDULING TAB */}
          {activeTab === 'schedules' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
              <div className="glass-card">
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem' }}>Configure Hostel Schedule</h3>
                
                <form onSubmit={handleSaveSchedule} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-secondary)' }} htmlFor="adminportal-field-1">
                      Select Hostel
                    </label>
                    <select id="adminportal-field-1"
                      className="custom-input"
                      value={selectedSchedHostel}
                      onChange={(e) => handleSchedHostelChange(e.target.value)}
                    >
                      {hostels.filter(h=>h.active).map(h => (
                        <option key={h.id} value={h.id}>{h.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                      Assigned Laundry Days
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                      {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map(day => (
                        <label key={day} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={selectedDays.includes(day)}
                            onChange={() => handleDayCheckboxChange(day)}
                          />
                          {day}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-secondary)' }} htmlFor="adminportal-field-2">
                        Pickup Start Time
                      </label>
                      <input id="adminportal-field-2" 
                        type="time" 
                        className="custom-input"
                        value={schedPickup}
                        onChange={(e) => setSchedPickup(e.target.value)}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-secondary)' }} htmlFor="adminportal-field-3">
                        Delivery Time
                      </label>
                      <input id="adminportal-field-3" 
                        type="time" 
                        className="custom-input"
                        value={schedDelivery}
                        onChange={(e) => setSchedDelivery(e.target.value)}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-secondary)' }} htmlFor="adminportal-field-4">
                        Max Weight Limit (kg)
                      </label>
                      <input id="adminportal-field-4" 
                        type="number" 
                        step="0.1"
                        min="0.1"
                        className="custom-input"
                        value={schedMaxWeight}
                        onChange={(e) => setSchedMaxWeight(parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-secondary)' }} htmlFor="adminportal-field-5">
                        Extra Weight Rate (₹/kg)
                      </label>
                      <input id="adminportal-field-5" 
                        type="number" 
                        step="0.5"
                        min="0"
                        className="custom-input"
                        value={schedExtraWeightRate}
                        onChange={(e) => setSchedExtraWeightRate(parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', cursor: 'pointer', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                    <input
                      type="checkbox"
                      checked={schedEmergency}
                      onChange={(e) => setSchedEmergency(e.target.checked)}
                    />
                    Enable Emergency Laundry submissions (overrides schedule check)
                  </label>

                  <label>Daily pickup capacity<input type="number" min="1" max="10000" className="custom-input" value={schedCapacity} onChange={e=>setSchedCapacity(e.target.value)} required/></label><label>Estimated processing hours<input type="number" min="1" max="336" className="custom-input" value={schedHours} onChange={e=>setSchedHours(e.target.value)} required/></label>
                  <button type="submit" disabled={mutationBusy} className="btn btn-primary" style={{ alignSelf: 'flex-start', marginTop: '0.5rem' }}>
                    Save Schedule config
                  </button>
                </form>
              </div>

              {/* Schedules list */}
              <div className="glass-card">
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem' }}>Hostel Calendars</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {schedules.map(s => {
                    const hostelDetails = hostels.find(h => h.id === s.hostelId);
                    return (
                      <div 
                        key={s.hostelId} 
                        style={{ 
                          padding: '1rem', 
                          background: 'var(--bg-secondary)', 
                          borderRadius: '0.75rem', 
                          border: '1px solid var(--border-color)',
                          borderLeft: `5px solid ${hostelDetails?.color || '#ccc'}`
                        }}
                      >
                        <h4 style={{ fontSize: '0.95rem', fontWeight: 700 }}>{hostelDetails?.name}</h4>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                          Days: <b>{s.days.length > 0 ? s.days.join(', ') : 'None configured'}</b>
                        </p>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          Time: {s.pickup} to {s.delivery} • Emergency Allowed: {s.emergencyEnabled ? 'Yes 🟢' : 'No 🔴'}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* MONITORING TAB */}
          {activeTab === 'monitoring' && (
            <div className="glass-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem', alignItems: 'center' }}>
                <h3>Laundry monitoring</h3><div className="filter-row"><label>Hostel<select className="custom-input" value={monitorHostel} onChange={e=>setMonitorHostel(e.target.value)}><option value="">All hostels</option>{hostels.map(h=><option key={h.id} value={h.id}>{h.name}</option>)}</select></label><label>Status<select className="custom-input" value={monitorStatus} onChange={e=>setMonitorStatus(e.target.value)}><option value="">All statuses</option>{['Waiting for Verification','Received','Washing','Drying','Ready','Delivered','Cancelled'].map(v=><option key={v}>{v}</option>)}</select></label><label>Submitted date<input className="custom-input" type="date" value={monitorDate} onChange={e=>setMonitorDate(e.target.value)}/></label></div>
                
                <div style={{ position: 'relative' }}>
                  <Search size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input 
                    type="text" 
                    aria-label="Search records" className="custom-input"
                    placeholder="Search requests..."
                    style={{ paddingLeft: '2.5rem', maxWidth: '240px' }}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              <PagedTable>
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Req ID</th>
                      <th>Student Name</th>
                      <th>Laundry ID</th>
                      <th>Hostel</th>
                      <th>Total Items</th>
                      <th>Weight & Fee</th>
                      <th>Scanned Tags</th>
                      <th>Status</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRequests.map(r => (
                      <tr key={r.id}>
                        <td style={{ fontWeight: 600, color: 'var(--hostel-color)' }}>{r.id}</td>
                        <td style={{ fontWeight: 600 }}>{r.studentName}</td>
                        <td>
                          <span className="badge" style={{ backgroundColor: 'var(--hostel-color-light)', color: 'var(--hostel-color)' }}>
                            {r.laundryId}
                          </span>
                        </td>
                        <td>
                          <span className="badge" style={{ backgroundColor: `${r.hostelColor}1e`, color: r.hostelColor }}>
                            {r.hostelName}
                          </span>
                        </td>
                        <td style={{ fontWeight: 700 }}>{r.expectedTotal}</td>
                        <td>
                          {r.weight !== undefined ? `${r.weight} kg` : <span style={{ color: 'var(--text-muted)' }}>-</span>}
                          {r.overLimitCharge > 0 && (
                            <span style={{ display: 'block', color: 'var(--status-issue)', fontSize: '0.75rem', fontWeight: 600, marginTop: '0.1rem' }}>
                              ₹{r.overLimitCharge}
                            </span>
                          )}
                        </td>
                        <td style={{ fontSize: '0.8rem', fontFamily: 'monospace' }}>
                          {r.scannedTags.length > 0 ? r.scannedTags.join(', ') : 'None'}
                        </td>
                        <td>
                          <span className={`badge badge-${r.status.split(' ')[0].toLowerCase()}`}>
                            {r.status}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {new Date(r.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </PagedTable>
            </div>
          )}

          {/* ISSUES TAB */}
          {activeTab === 'issues' && (
            <div className="glass-card">
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem' }}>Active Helpdesk complaints</h3>

              {issuesList.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>No student issues reported.</p>
              ) : (
                <PagedTable>
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Issue ID</th>
                        <th>Student Details</th>
                        <th>Category</th>
                        <th>Complaint Details</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {issuesList.map(iss => (
                        <tr key={iss.id}>
                          <td style={{ fontWeight: 600, color: 'var(--status-issue)' }}>{iss.id}</td>
                          <td>
                            <p style={{ fontWeight: 600 }}>{iss.studentName}</p>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>LID: {iss.laundryId}</p>
                          </td>
                          <td>
                            <span className="badge badge-issue">{iss.type}</span>
                          </td>
                          <td>
                            <p style={{ fontSize: '0.9rem' }}>{iss.description}</p>
                            {iss.requestId && (
                              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                Linked request: <b>{iss.requestId}</b>
                              </p>
                            )}
                          </td>
                          <td>
                            <span className={`badge ${iss.status === 'Resolved' ? 'badge-ready' : 'badge-pending'}`}>
                              {iss.status}
                            </span>
                          </td>
                          <td>
                            {iss.status !== 'Resolved' && <select aria-label="Assign complaint" className="custom-input" value={iss.assignedTo||''} onChange={async e=>{try{await fetch(`${API_URL}/api/issues/${iss.id}/assign`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({staffId:e.target.value})});fetchAdminData();}catch(e){setDataError(e.message);}}}><option value="">Assign staff</option>{staffList.filter(u=>u.active&&u.hostelId===iss.hostelId).map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select>}
                            {iss.status !== 'Resolved' ? (
                              <button 
                                onClick={() => {setDataError('');setResolutionText('');setResolvingIssue(iss.id);}}
                                className="btn btn-primary"
                                style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', backgroundColor: 'var(--status-ready)' }}
                              >
                                Resolve
                              </button>
                            ) : (
                              <span style={{ color: 'var(--status-ready)', fontSize: '0.85rem', fontWeight: 600 }}>Closed</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </PagedTable>
              )}
            </div>
          )}



      {/* POPUP MODALS PANEL */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="glass-card modal-content" role="dialog" aria-modal="true" aria-label="Manage Smart Wash record">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>
                {modalType === 'addHostel' && 'Add Hostel Campus'}
                {modalType === 'addStudent' && 'Register New Student'}
                {modalType === 'addStaff' && 'Create Staff Account'}
                {modalType === 'replaceTag' && 'Replace Student Lost Tag'}
              </h3>
              <button aria-label="Close dialog" onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
            </div>

            {dataError&&<p className="form-error" role="alert">{dataError}</p>}
            {/* ADD HOSTEL FORM */}
            {modalType === 'addHostel' && (
              <form onSubmit={handleCreateHostel} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }} htmlFor="adminportal-field-6">Hostel Name</label>
                  <input id="adminportal-field-6" type="text" required placeholder="Girls Hostel C" className="custom-input" value={newHostelName} onChange={(e) => setNewHostelName(e.target.value)} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }} htmlFor="adminportal-control-14">Theme Color</label>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input id="adminportal-control-14" type="color" className="custom-input" style={{ width: '60px', padding: '0.2rem', height: '40px' }} value={newHostelColor} onChange={(e) => setNewHostelColor(e.target.value)} />
                    <span style={{ fontSize: '0.9rem', fontFamily: 'monospace' }}>{newHostelColor}</span>
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }} htmlFor="adminportal-field-7">Rooms list (comma separated)</label>
                  <input id="adminportal-field-7" type="text" placeholder="101, 102, 103..." className="custom-input" value={newHostelRooms} onChange={(e) => setNewHostelRooms(e.target.value)} />
                </div>
                <button type="submit" disabled={mutationBusy} className="btn btn-primary" style={{ marginTop: '0.5rem' }}>Create Hostel</button>
              </form>
            )}

            {/* ADD STUDENT FORM */}
            {modalType === 'addStudent' && (
              <form onSubmit={handleCreateStudent} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <label>Initial password<input type="password" required minLength={12} className="custom-input" value={studentPassword} onChange={e=>setStudentPassword(e.target.value)} autoComplete="new-password" placeholder="12+ characters, mixed case and number"/></label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }} htmlFor="adminportal-field-8">Full Name</label>
                    <input id="adminportal-field-8" type="text" required placeholder="Rohan Das" className="custom-input" value={studentName} onChange={(e) => setStudentName(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }} htmlFor="adminportal-field-9">Roll Number</label>
                    <input id="adminportal-field-9" type="text" required placeholder="2026ME304" className="custom-input" value={studentRoll} onChange={(e) => setStudentRoll(e.target.value)} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }} htmlFor="adminportal-field-10">Reg. Number</label>
                    <input id="adminportal-field-10" type="text" required placeholder="REG88410" className="custom-input" value={studentReg} onChange={(e) => setStudentReg(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }} htmlFor="adminportal-field-11">Mobile</label>
                    <input id="adminportal-field-11" type="text" required placeholder="9123456789" className="custom-input" value={studentMobile} onChange={(e) => setStudentMobile(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }} htmlFor="adminportal-field-12">Email</label>
                  <input id="adminportal-field-12" type="email" required placeholder="rohan@univ.edu" className="custom-input" value={studentEmail} onChange={(e) => setStudentEmail(e.target.value)} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '0.5rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }} htmlFor="adminportal-field-13">Hostel</label>
                    <select id="adminportal-field-13" className="custom-input" value={studentHostelId} onChange={(e) => setStudentHostelId(e.target.value)}>
                      {hostels.filter(h=>h.active).map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }} htmlFor="adminportal-field-14">Floor</label>
                    <input id="adminportal-field-14" type="number" required min="1" className="custom-input" value={studentFloor} onChange={(e) => setStudentFloor(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }} htmlFor="adminportal-field-15">Room</label>
                    <input id="adminportal-field-15" type="text" required placeholder="102" className="custom-input" value={studentRoom} onChange={(e) => setStudentRoom(e.target.value)} />
                  </div>
                </div>
                <button type="submit" disabled={mutationBusy} className="btn btn-primary" style={{ marginTop: '0.5rem' }}>Register Student & Allocate Tags</button>
              </form>
            )}

            {/* ADD STAFF FORM */}
            {modalType === 'addStaff' && (
              <form onSubmit={handleCreateStaff} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }} htmlFor="adminportal-field-16">Staff Name</label>
                  <input id="adminportal-field-16" type="text" required placeholder="Ramesh Prasad" className="custom-input" value={staffName} onChange={(e) => setStaffName(e.target.value)} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }} htmlFor="adminportal-field-17">Email Address</label>
                  <input id="adminportal-field-17" type="email" required placeholder="ramesh@univ.edu" className="custom-input" value={staffEmail} onChange={(e) => setStaffEmail(e.target.value)} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }} htmlFor="adminportal-field-18">Password</label>
                    <input id="adminportal-field-18" type="password" required minLength={12} placeholder="12+ characters, mixed case and number" className="custom-input" value={staffPassword} onChange={(e) => setStaffPassword(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }} htmlFor="adminportal-field-19">Desk Counter</label>
                    <input id="adminportal-field-19" type="text" required placeholder="Counter B" className="custom-input" value={staffCounter} onChange={(e) => setStaffCounter(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }} htmlFor="adminportal-field-20">Assign Hostel Assignment</label>
                  <select id="adminportal-field-20" className="custom-input" value={staffHostelId} onChange={(e) => setStaffHostelId(e.target.value)}>
                    {hostels.filter(h=>h.active).map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                  </select>
                </div>
                <button type="submit" disabled={mutationBusy} className="btn btn-primary" style={{ marginTop: '0.5rem' }}>Create Account</button>
              </form>
            )}

            {/* REPLACE LOST TAG FORM */}
            {modalType === 'replaceTag' && (
              <form onSubmit={handleReplaceTag} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }} htmlFor="adminportal-field-21">Select Student</label>
                  <select id="adminportal-field-21" 
                    className="custom-input" 
                    value={selectedStudentForTag} 
                    required
                    onChange={(e) => {
                      setSelectedStudentForTag(e.target.value);
                      setSelectedTagToReplace('');
                    }}
                  >
                    <option value="">-- Choose Student --</option>
                    {students.map(s => <option key={s.id} value={s.id}>{s.name} ({s.laundryId})</option>)}
                  </select>
                </div>
                {selectedStudentForTag && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }} htmlFor="adminportal-field-22">Select Tag to Replace</label>
                    <select id="adminportal-field-22" 
                      className="custom-input" 
                      value={selectedTagToReplace} 
                      required
                      onChange={(e) => setSelectedTagToReplace(e.target.value)}
                    >
                      <option value="">-- Choose Tag Serial --</option>
                      {activeStudentForTag?.tags.filter(t => t.status === 'active').map(t => (
                        <option key={t.serialNumber} value={t.serialNumber}>{t.serialNumber}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }} htmlFor="adminportal-field-23">Reason for Replacement</label>
                  <select id="adminportal-field-23" className="custom-input" value={tagReplaceReason} onChange={(e) => setTagReplaceReason(e.target.value)}>
                    <option value="lost">Lost Tag</option>
                    <option value="damaged">Damaged Tag</option>
                  </select>
                </div>
                <button type="submit" disabled={mutationBusy} className="btn btn-primary" style={{ marginTop: '0.5rem' }}>Deactivate Old & Issue Replacement</button>
              </form>
            )}

          </div>
        </div>
      )}
    </PortalLayout>
  );
}
