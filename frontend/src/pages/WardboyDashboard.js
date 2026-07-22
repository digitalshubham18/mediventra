import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { tasksAPI, facilityAPI, leavesAPI, checklistAPI, staffLogsAPI, entryAPI, transferAPI, assetsAPI } from '../utils/api';
import { getSocket } from '../utils/socket';
import { MyActivityWidget } from '../components/DashboardWidgets';
import toast from 'react-hot-toast';

const CHECKLIST_ITEMS = [
  'Change bed linens in assigned ward',
  'Transport patients to/from OT as needed',
  'Carry meal trays to patient beds',
  'Clean and sanitize beds after discharge',
  'Refill IV stands with supplies',
  'Assist nurses with patient movement',
  'Transport lab specimens to laboratory',
  'Empty waste bins in assigned wards',
];

const SHIFTS = {
  morning:  { l:'Morning',   t:'08:00–16:00', i:'🌅', bg:'#dcfce7', c:'#15803d' },
  afternoon:{ l:'Afternoon', t:'14:00–22:00', i:'🌇', bg:'#fef3c7', c:'#92400e' },
  night:    { l:'Night',     t:'22:00–06:00', i:'🌙', bg:'#e0e7ff', c:'#3730a3' },
  full:     { l:'Full Day',  t:'07:00–19:00', i:'☀️', bg:'#f0f9ff', c:'#0369a1' },
};

const REQUEST_TYPES = [
  { value:'transport_request', label:'🛏️ Patient Transport', placeholder:'e.g. Bed 4, Ward A → OT-2 for surgery prep' },
  { value:'supply_request',    label:'📦 Supply Request',     placeholder:'e.g. Need 10 fresh bed linens for Ward B' },
  { value:'maintenance_request', label:'🔧 Maintenance Issue', placeholder:'e.g. Wheelchair #3 has a flat tire' },
  { value:'other',              label:'📝 Other',              placeholder:'Describe the request' },
];

export default function WardboyDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [tasks, setTasks] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [logs, setLogs] = useState([]);
  const [deletingLogId, setDeletingLogId] = useState(null);
  const deleteLogEntry = async (id) => {
    if (!window.confirm('Delete this request? This cannot be undone.')) return;
    setDeletingLogId(id);
    const prev = logs;
    setLogs(ls => ls.filter(l => l._id !== id));
    try { await staffLogsAPI.delete(id); toast.success('Deleted'); }
    catch (e) { setLogs(prev); toast.error(e.response?.data?.error || 'Failed to delete'); }
    setDeletingLogId(null);
  };
  const [checklist, setChecklist] = useState({});
  const [loading, setLoading] = useState(true);
  const [showLogModal, setShowLogModal] = useState(false);
  const [logForm, setLogForm] = useState({ category:'transport_request', title:'', details:'', location:'', priority:'medium' });
  const [submittingLog, setSubmittingLog] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ startDate:'', endDate:'', reason:'', type:'casual' });
  const [escortQueue, setEscortQueue] = useState([]);
  const [acknowledging, setAcknowledging] = useState(null);
  const [transfers, setTransfers] = useState([]);
  const [acceptingTransferId, setAcceptingTransferId] = useState(null);
  const [progressingTransferId, setProgressingTransferId] = useState(null);
  const [equipment, setEquipment] = useState([]);
  const [equipLoading, setEquipLoading] = useState(true);
  const [checkoutFor, setCheckoutFor] = useState(null);
  const [checkoutLocation, setCheckoutLocation] = useState('');
  const [checkingOut, setCheckingOut] = useState(false);

  const loadEquipment = () => {
    setEquipLoading(true);
    assetsAPI.getAll({ types: 'wheelchair,stretcher,oxygen_cylinder,infusion_pump' })
      .then(r => setEquipment(r.data.data || [])).catch(()=>{}).finally(()=>setEquipLoading(false));
  };

  const checkinEquipment = async (asset) => {
    try { await assetsAPI.checkin(asset._id); toast.success(`${asset.name} returned`); loadEquipment(); }
    catch (e) { toast.error(e.response?.data?.error || 'Failed to check in'); }
  };

  const submitCheckout = async () => {
    if (!checkoutLocation.trim()) { toast.error('Enter where this is going (e.g. Ward B, Bed 4)'); return; }
    setCheckingOut(true);
    try {
      await assetsAPI.checkout(checkoutFor._id, checkoutLocation.trim(), checkoutLocation.trim());
      toast.success(`✅ ${checkoutFor.name} checked out to you`);
      setCheckoutFor(null); setCheckoutLocation('');
      loadEquipment();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed to check out'); }
    setCheckingOut(false);
  };

  const loadTransfers = () => {
    transferAPI.getAll().then(r => setTransfers(r.data.data || [])).catch(()=>{});
  };

  const acceptTransfer = async (id) => {
    setAcceptingTransferId(id);
    try { await transferAPI.accept(id); toast.success('🛏️ Transfer accepted'); loadTransfers(); }
    catch (e) { toast.error(e.response?.data?.error || 'Someone else already accepted this'); loadTransfers(); }
    setAcceptingTransferId(null);
  };

  const advanceTransfer = async (id, status) => {
    setProgressingTransferId(id);
    try { await transferAPI.updateProgress(id, status); loadTransfers(); }
    catch { toast.error('Failed to update'); }
    setProgressingTransferId(null);
  };

  const openTransfers = transfers.filter(t => t.status === 'requested');
  const myActiveTransfers = transfers.filter(t => ['assigned','in_transit'].includes(t.status) && t.wardboy && (t.wardboy._id === user?._id || t.wardboy === user?._id));

  const load = () => {
    setLoading(true);
    Promise.all([
      tasksAPI.getAll().catch(()=>({ data:{ data:[] } })),
      facilityAPI.getSchedules({ userId: user?._id, week: new Date().toISOString() }).catch(()=>({ data:{ data:[] } })),
      leavesAPI.getAll().catch(()=>({ data:{ data:[] } })),
      staffLogsAPI.getAll().catch(()=>({ data:{ data:[] } })),
      checklistAPI.getToday().catch(()=>({ data:{ data:{ items:{} } } })),
      entryAPI.getWardboyQueue().catch(()=>({ data:{ data:[] } })),
    ]).then(([tRes, sRes, lRes, logRes, cRes, eRes]) => {
      setTasks(tRes.data.data || []);
      setSchedules(sRes.data.data || []);
      setLeaves(lRes.data.data || []);
      setLogs(logRes.data.data || []);
      setChecklist(cRes.data.data?.items || {});
      setEscortQueue(eRes.data.data || []);
      setLoading(false);
    });
  };

  useEffect(() => {
    load();
    loadTransfers();
    loadEquipment();
    const socket = getSocket();
    if (!socket) return;
    const taskHandler = () => load();
    const escortHandler = (data) => {
      toast(`🛏️ New patient to escort: ${data.patient?.name} → Room ${data.room?.number}`, { duration: 8000, icon: '🚶' });
      load();
    };
    const transferHandler = (data) => {
      if (data.patientName) toast(`🛏️ Transfer requested: ${data.patientName} (${data.fromLocation} → ${data.toLocation})`, { duration: 8000, icon: '🛏️' });
      loadTransfers();
    };
    socket.on('task_assigned', taskHandler);
    socket.on('patient_room_assigned', escortHandler);
    socket.on('transfer_requested', transferHandler);
    socket.on('transfer_updated', loadTransfers);
    return () => { socket.off('task_assigned', taskHandler); socket.off('patient_room_assigned', escortHandler); socket.off('transfer_requested', transferHandler); socket.off('transfer_updated', loadTransfers); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id]);

  const toggleChecklistItem = async (index) => {
    const newVal = !checklist[index];
    setChecklist(c => ({ ...c, [index]: newVal })); // optimistic
    try { await checklistAPI.toggle(index, newVal); }
    catch { setChecklist(c => ({ ...c, [index]: !newVal })); toast.error('Failed to save — try again'); }
  };

  const markTaskDone = async (id) => {
    try {
      await tasksAPI.update(id, { status:'completed', completedAt: new Date() });
      setTasks(ts => ts.map(t => t._id===id ? { ...t, status:'completed' } : t));
      toast.success('✅ Task completed!');
    } catch { toast.error('Failed to update task'); }
  };

  const acknowledgeEscort = async (entryId) => {
    setAcknowledging(entryId);
    try {
      await entryAPI.acknowledge(entryId);
      setEscortQueue(q => q.map(e => e._id===entryId ? { ...e, wardboyAcknowledgedAt: new Date() } : e));
      toast.success('✅ Marked as escorted!');
    } catch { toast.error('Failed to update'); }
    setAcknowledging(null);
  };

  const submitLog = async (e) => {
    e.preventDefault();
    if (!logForm.title.trim()) { toast.error('Please describe the request'); return; }
    setSubmittingLog(true);
    try {
      const res = await staffLogsAPI.create(logForm);
      setLogs(l => [res.data.data, ...l]);
      setShowLogModal(false);
      setLogForm({ category:'transport_request', title:'', details:'', location:'', priority:'medium' });
      toast.success('✅ Request logged!');
    } catch (e) { toast.error(e.response?.data?.error || 'Failed to submit'); }
    setSubmittingLog(false);
  };

  const submitLeave = async (e) => {
    e.preventDefault();
    if (!leaveForm.startDate || !leaveForm.endDate) { toast.error('Select dates'); return; }
    try {
      await leavesAPI.apply(leaveForm);
      toast.success('✅ Leave request submitted!');
      setShowLeaveModal(false);
      setLeaveForm({ startDate:'', endDate:'', reason:'', type:'casual' });
      load();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed to apply'); }
  };

  const pendingTasks = tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled');
  const doneTasks    = tasks.filter(t => t.status === 'completed');
  const todayStr     = new Date().toDateString();
  const todayScheds  = schedules.filter(s => new Date(s.date).toDateString() === todayStr);
  const openLogs     = logs.filter(l => l.status !== 'resolved');
  const checklistDone = Object.values(checklist).filter(Boolean).length;

  return (
    <div>
      <div style={{ background:'linear-gradient(135deg,#0c4a6ecc,#0891b2)', borderRadius:16, padding:'22px 26px', marginBottom:20, color:'#fff', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:-40, right:-40, width:160, height:160, borderRadius:'50%', background:'rgba(255,255,255,.12)', pointerEvents:'none' }}/>
        <div style={{ position:'relative' }}>
          <div style={{ fontSize:26, fontWeight:800, marginBottom:6 }}>🛏️ Ward Boy Dashboard</div>
          <div style={{ opacity:.9, fontSize:14 }}>{user?.name} · {user?.department || 'Ward Operations'} · {new Date().toLocaleDateString('en-IN',{ weekday:'long', day:'numeric', month:'long' })}</div>
          <div style={{ display:'flex', gap:8, marginTop:12, flexWrap:'wrap' }}>
            <span style={{ background:'rgba(255,255,255,.2)', borderRadius:20, padding:'4px 14px', fontSize:12.5, fontWeight:600 }}>📋 {pendingTasks.length} pending task{pendingTasks.length!==1?'s':''}</span>
            <span style={{ background:'rgba(255,255,255,.2)', borderRadius:20, padding:'4px 14px', fontSize:12.5, fontWeight:600 }}>📦 {openLogs.length} open request{openLogs.length!==1?'s':''}</span>
            {todayScheds.length > 0 && <span style={{ background:'rgba(255,255,255,.2)', borderRadius:20, padding:'4px 14px', fontSize:12.5, fontWeight:600 }}>📅 On shift today</span>}
          </div>
        </div>
      </div>

      <div className="stat-grid">
        <StatCard icon="🛏️" value={escortQueue.filter(e=>!e.wardboyAcknowledgedAt).length} label="Patients to Escort" color="#fef2f2" />
        <StatCard icon="📋" value={pendingTasks.length} label="Pending Tasks" color="#fffbeb" />
        <StatCard icon="✅" value={doneTasks.length} label="Completed Tasks" color="#f0fdf4" />
        <StatCard icon="✓" value={`${checklistDone}/${CHECKLIST_ITEMS.length}`} label="Daily Checklist" color="#eff6ff" />
      </div>

      <div style={{ marginTop:14 }}><MyActivityWidget /></div>

      <motion.div className="card" initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} style={{ marginTop:16 }}>
        <div className="card-header"><span className="card-title">🦽 Equipment Tracker</span><span className="badge">{equipment.filter(e=>e.status==='available').length} available</span></div>
        <div className="card-body" style={{ maxHeight:280, overflowY:'auto' }}>
          {equipLoading ? (
            <div style={{ textAlign:'center', color:'#94a3b8', padding:16 }}>Loading…</div>
          ) : equipment.length === 0 ? (
            <div style={{ textAlign:'center', color:'#94a3b8', padding:16, fontSize:12.5 }}>No wheelchairs/stretchers/oxygen cylinders registered yet — ask admin to add some under Assets.</div>
          ) : equipment.map(a => {
            const mine = a.assignedTo && (a.assignedTo._id === user?._id || a.assignedTo === user?._id);
            return (
              <div key={a._id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'9px 12px', background: a.status==='available'?'#f0fdf4':'#fffbeb', borderRadius:9, marginBottom:6, flexWrap:'wrap', gap:8 }}>
                <div>
                  <div style={{ fontWeight:700, fontSize:12.5 }}>{a.name}</div>
                  <div style={{ fontSize:11, color:'#94a3b8' }}>📍 {a.currentLocation}{a.assignedNote ? ` · ${a.assignedNote}` : ''}{a.assignedTo?.name ? ` · with ${a.assignedTo.name}` : ''}</div>
                </div>
                {a.status === 'available' ? (
                  <button className="btn btn-outline btn-xs" onClick={()=>{ setCheckoutFor(a); setCheckoutLocation(''); }}>Check Out</button>
                ) : mine ? (
                  <button className="btn btn-primary btn-xs" onClick={()=>checkinEquipment(a)}>Return</button>
                ) : (
                  <span className="badge badge-warning" style={{ fontSize:10 }}>In use</span>
                )}
              </div>
            );
          })}
        </div>
      </motion.div>

      {escortQueue.filter(e=>!e.wardboyAcknowledgedAt).length > 0 && (
        <motion.div className="card" initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} style={{ marginTop:16, border:'1.5px solid #fecaca' }}>
          <div className="card-header" style={{ background:'#fef2f2' }}>
            <span className="card-title">🛏️ Patients Awaiting Escort</span>
            <span className="badge badge-danger">{escortQueue.filter(e=>!e.wardboyAcknowledgedAt).length} waiting</span>
          </div>
          <div className="card-body">
            {escortQueue.filter(e=>!e.wardboyAcknowledgedAt).map(entry => (
              <div key={entry._id} style={{ padding:'14px 16px', background:'#fffbfb', border:'1.5px solid #fecaca', borderRadius:12, marginBottom:10, display:'flex', alignItems:'center', gap:14, flexWrap:'wrap' }}>
                <div style={{ flex:1, minWidth:220 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                    <span style={{ fontWeight:800, fontSize:15 }}>{entry.patient?.name}</span>
                    {entry.patient?.bloodGroup && <span className="badge badge-danger" style={{ fontSize:10 }}>🩸 {entry.patient.bloodGroup}</span>}
                  </div>
                  <div style={{ fontSize:12.5, color:'#64748b' }}>📞 {entry.patient?.phone || '—'} · 👨‍⚕️ Dr. {entry.appointment?.doctor?.name}</div>
                  {entry.notes && <div style={{ fontSize:12, color:'#94a3b8', marginTop:3 }}>📝 {entry.notes}</div>}
                </div>
                <div style={{ textAlign:'center', padding:'8px 16px', background:'#fef3c7', borderRadius:10, border:'1px solid #fde68a' }}>
                  <div style={{ fontSize:10, color:'#92400e', fontWeight:700, textTransform:'uppercase' }}>Take to</div>
                  <div style={{ fontSize:18, fontWeight:900, color:'#92400e' }}>{entry.room?.name} {entry.room?.number}</div>
                  <div style={{ fontSize:11, color:'#92400e' }}>Floor {entry.room?.floor} · {entry.room?.type}</div>
                </div>
                <button className="btn btn-primary btn-sm" disabled={acknowledging===entry._id} onClick={()=>acknowledgeEscort(entry._id)}>
                  {acknowledging===entry._id ? '…' : '✓ Escorted'}
                </button>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {openTransfers.length > 0 && (
        <motion.div className="card mt-2" initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} style={{ border:'1.5px solid #fde68a' }}>
          <div className="card-header"><span className="card-title">🛏️ Open Transfer Requests</span><span className="badge badge-warning">{openTransfers.length}</span></div>
          <div className="card-body">
            {openTransfers.map(t => (
              <div key={t._id} style={{ padding:'11px 14px', background: t.priority==='urgent'?'#fef2f2':'#fffbeb', borderRadius:10, borderLeft:`3px solid ${t.priority==='urgent'?'#dc2626':'#f59e0b'}`, marginBottom:8 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontWeight:800, fontSize:13, color: t.priority==='urgent'?'#dc2626':'#0f172a' }}>{t.priority==='urgent' && '🚨 URGENT — '}{t.patient?.name || t.patientName}</span>
                  <span style={{ fontSize:11, color:'#94a3b8' }}>Req. by {t.requestedBy?.name}</span>
                </div>
                <div style={{ fontSize:12.5, color:'#374151', marginTop:4 }}>📍 {t.fromLocation} → {t.toLocation}</div>
                {t.reason && <div style={{ fontSize:11.5, color:'#64748b' }}>{t.reason}</div>}
                <button className="btn btn-primary btn-xs" style={{marginTop:8}} disabled={acceptingTransferId===t._id} onClick={()=>acceptTransfer(t._id)}>{acceptingTransferId===t._id?'Accepting…':'🛏️ Accept Transfer'}</button>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {myActiveTransfers.length > 0 && (
        <motion.div className="card mt-2" initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }}>
          <div className="card-header"><span className="card-title">🛏️ My Active Transfers</span></div>
          <div className="card-body">
            {myActiveTransfers.map(t => (
              <div key={t._id} style={{ padding:'11px 14px', background:'#eff6ff', borderRadius:10, borderLeft:'3px solid #2563eb', marginBottom:8 }}>
                <div style={{ fontWeight:700, fontSize:13 }}>{t.patient?.name || t.patientName} · <span style={{color:'#2563eb'}}>{t.status.replace('_',' ')}</span></div>
                <div style={{ fontSize:12.5, color:'#374151', marginTop:4 }}>📍 {t.fromLocation} → {t.toLocation}</div>
                <div style={{ display:'flex', gap:6, marginTop:8 }}>
                  {t.status === 'assigned' && <button className="btn btn-primary btn-xs" disabled={progressingTransferId===t._id} onClick={()=>advanceTransfer(t._id,'in_transit')}>🚶 In Transit</button>}
                  {t.status === 'in_transit' && <button className="btn btn-success btn-xs" disabled={progressingTransferId===t._id} onClick={()=>advanceTransfer(t._id,'completed')}>✅ Complete</button>}
                  <button className="btn btn-outline btn-xs" onClick={()=>advanceTransfer(t._id,'cancelled')}>Cancel</button>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      <div className="grid-2 mt-2">
        <motion.div className="card" initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ delay:.1 }}>
          <div className="card-header"><span className="card-title">📋 My Assigned Tasks</span><span className="badge badge-warning">{pendingTasks.length} pending</span></div>
          <div className="card-body" style={{ maxHeight:320, overflowY:'auto' }}>
            {loading ? <div style={{ textAlign:'center', color:'#94a3b8', padding:20 }}>Loading…</div>
            : tasks.length === 0 ? (
              <div style={{ textAlign:'center', padding:28, color:'#94a3b8' }}>
                <div style={{ fontSize:32, marginBottom:8 }}>🎉</div>
                <div style={{ fontWeight:700 }}>No tasks assigned</div>
              </div>
            ) : tasks.map(t => (
              <div key={t._id} style={{ padding:'10px 12px', background:t.status==='completed'?'#f0fdf4':'#f8fafc', borderRadius:10, marginBottom:7, borderLeft:`3px solid ${t.priority==='urgent'?'#ef4444':t.priority==='high'?'#f97316':'#3b82f6'}`, display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:700, fontSize:13, color:'#0f172a', textDecoration:t.status==='completed'?'line-through':'none' }}>{t.title}</div>
                  <div style={{ fontSize:11, color:'#94a3b8', marginTop:3 }}>
                    <span className={`badge ${t.priority==='urgent'?'badge-danger':t.priority==='high'?'badge-warning':'badge-primary'}`} style={{ fontSize:10 }}>{t.priority}</span>
                    {t.dueDate && <span style={{ marginLeft:6 }}>📅 {new Date(t.dueDate).toLocaleDateString('en-IN',{ day:'numeric', month:'short' })}</span>}
                  </div>
                </div>
                {t.status !== 'completed'
                  ? <button className="btn btn-primary btn-xs" style={{ flexShrink:0 }} onClick={()=>markTaskDone(t._id)}>✓ Done</button>
                  : <span style={{ color:'#22c55e', fontSize:16, flexShrink:0 }}>✓</span>}
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div className="card" initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ delay:.17 }}>
          <div className="card-header"><span className="card-title">✅ Daily Duties Checklist</span><span className="text-xs text-muted">{checklistDone}/{CHECKLIST_ITEMS.length} done</span></div>
          <div className="card-body" style={{ maxHeight:320, overflowY:'auto' }}>
            {CHECKLIST_ITEMS.map((item, i) => (
              <div key={i} onClick={()=>toggleChecklistItem(i)}
                style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', borderRadius:8, cursor:'pointer', background:checklist[i]?'#0891b212':'transparent', marginBottom:3 }}>
                <div style={{ width:18, height:18, borderRadius:5, border:`2px solid ${checklist[i]?'#0891b2':'#cbd5e1'}`, background:checklist[i]?'#0891b2':'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  {checklist[i] && <span style={{ color:'#fff', fontSize:10, fontWeight:900 }}>✓</span>}
                </div>
                <span style={{ fontSize:12.5, color:checklist[i]?'#94a3b8':'#374151', textDecoration:checklist[i]?'line-through':'none' }}>{item}</span>
              </div>
            ))}
            <div style={{ fontSize:11, color:'#94a3b8', marginTop:10, textAlign:'center' }}>💾 Your progress is saved automatically and survives a page refresh.</div>
          </div>
        </motion.div>
      </div>

      <div className="grid-2 mt-2">
        <motion.div className="card" initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ delay:.24 }}>
          <div className="card-header">
            <span className="card-title">📦 Transport & Supply Requests</span>
            <button className="btn btn-primary btn-xs" onClick={()=>setShowLogModal(true)}>+ New Request</button>
          </div>
          <div className="card-body" style={{ maxHeight:280, overflowY:'auto' }}>
            {logs.length === 0 ? (
              <div style={{ textAlign:'center', padding:24, color:'#94a3b8' }}>No requests logged yet</div>
            ) : logs.map(l => (
              <div key={l._id} style={{ padding:'9px 12px', background:'#f8fafc', borderRadius:9, marginBottom:6 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8 }}>
                  <div>
                    <div style={{ fontWeight:700, fontSize:12.5 }}>{REQUEST_TYPES.find(r=>r.value===l.category)?.label || l.category}</div>
                    <div style={{ fontSize:12, color:'#374151', marginTop:2 }}>{l.title}</div>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
                    <span className={`badge ${l.status==='resolved'?'badge-success':'badge-warning'}`} style={{ fontSize:10 }}>{l.status==='resolved'?'✓ Resolved':'Open'}</span>
                    <button onClick={()=>deleteLogEntry(l._id)} disabled={deletingLogId===l._id} title="Delete"
                      style={{ background:'none', border:'none', cursor:'pointer', color:'#dc2626', fontSize:12, padding:0, opacity:deletingLogId===l._id?0.5:1 }}>🗑️</button>
                  </div>
                </div>
                <div style={{ fontSize:10.5, color:'#94a3b8', marginTop:4 }}>{new Date(l.createdAt).toLocaleString('en-IN',{ day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}</div>
              </div>
            ))}
          </div>
        </motion.div>

        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <motion.div className="card" initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ delay:.31 }}>
            <div className="card-header"><span className="card-title">📅 Today's Shifts</span><button className="btn btn-outline btn-xs" onClick={()=>navigate('/my-timetable')}>Full Timetable</button></div>
            <div className="card-body">
              {todayScheds.length === 0 ? (
                <div style={{ textAlign:'center', padding:'14px 0', color:'#94a3b8' }}><div style={{ fontSize:24, marginBottom:4 }}>😌</div><div style={{ fontSize:12.5, fontWeight:600 }}>No shifts today</div></div>
              ) : todayScheds.map((s,i) => {
                const sd = SHIFTS[s.shift] || SHIFTS.morning;
                return (
                  <div key={i} style={{ padding:'9px 12px', background:sd.bg, borderRadius:9, borderLeft:`3px solid ${sd.c}`, marginBottom:6 }}>
                    <div style={{ fontWeight:700, color:'#0f172a', fontSize:12.5 }}>{sd.i} {sd.l} · {sd.t}</div>
                    {s.department && <div style={{ fontSize:11.5, color:'#64748b', marginTop:2 }}>🏥 {s.department}</div>}
                  </div>
                );
              })}
            </div>
          </motion.div>

          <motion.div className="card" initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ delay:.38 }}>
            <div className="card-header"><span className="card-title">🌴 Leave</span><button className="btn btn-primary btn-xs" onClick={()=>setShowLeaveModal(true)}>+ Apply</button></div>
            <div className="card-body">
              {leaves.length === 0 ? <div style={{ textAlign:'center', color:'#94a3b8', fontSize:12.5, padding:'10px 0' }}>No leave requests</div>
              : leaves.slice(0,3).map(l => (
                <div key={l._id} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', fontSize:12 }}>
                  <span>{new Date(l.startDate).toLocaleDateString('en-IN',{day:'numeric',month:'short'})} – {new Date(l.endDate).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</span>
                  <span className={`badge ${l.status==='approved'?'badge-success':l.status==='rejected'?'badge-danger':'badge-warning'}`} style={{ fontSize:10 }}>{l.status}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      <div className="mt-2" style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
        <button className="btn btn-outline btn-sm" onClick={()=>navigate('/notice-board')}>📢 Notice Board</button>
        <button className="btn btn-outline btn-sm" onClick={()=>navigate('/chat')}>💬 Chat</button>
        <button className="btn btn-outline btn-sm" onClick={()=>navigate('/salary')}>💰 My Salary</button>
      </div>

      {showLogModal && (
        <div className="modal-overlay" onClick={e=>{ if(e.target===e.currentTarget) setShowLogModal(false); }}>
          <motion.div className="modal-box" initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }}>
            <div className="modal-header"><span className="modal-title">📦 New Request</span><button className="btn btn-ghost btn-icon" onClick={()=>setShowLogModal(false)}>✕</button></div>
            <form onSubmit={submitLog}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Request Type</label>
                  <select className="form-input" value={logForm.category} onChange={e=>setLogForm(f=>({...f,category:e.target.value}))}>
                    {REQUEST_TYPES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Description *</label>
                  <input className="form-input" required value={logForm.title} onChange={e=>setLogForm(f=>({...f,title:e.target.value}))} placeholder={REQUEST_TYPES.find(r=>r.value===logForm.category)?.placeholder} />
                </div>
                <div className="form-group">
                  <label className="form-label">Location</label>
                  <input className="form-input" value={logForm.location} onChange={e=>setLogForm(f=>({...f,location:e.target.value}))} placeholder="e.g. Ward A, Bed 4" />
                </div>
                <div className="form-group">
                  <label className="form-label">Priority</label>
                  <select className="form-input" value={logForm.priority} onChange={e=>setLogForm(f=>({...f,priority:e.target.value}))}>
                    {['low','medium','high','urgent'].map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={()=>setShowLogModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submittingLog}>{submittingLog ? 'Submitting…' : 'Submit Request'}</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {showLeaveModal && (
        <div className="modal-overlay" onClick={e=>{ if(e.target===e.currentTarget) setShowLeaveModal(false); }}>
          <motion.div className="modal-box" initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }}>
            <div className="modal-header"><span className="modal-title">🌴 Apply for Leave</span><button className="btn btn-ghost btn-icon" onClick={()=>setShowLeaveModal(false)}>✕</button></div>
            <form onSubmit={submitLeave}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group"><label className="form-label">Start Date</label><input className="form-input" type="date" required value={leaveForm.startDate} onChange={e=>setLeaveForm(f=>({...f,startDate:e.target.value}))} /></div>
                  <div className="form-group"><label className="form-label">End Date</label><input className="form-input" type="date" required value={leaveForm.endDate} onChange={e=>setLeaveForm(f=>({...f,endDate:e.target.value}))} /></div>
                </div>
                <div className="form-group">
                  <label className="form-label">Leave Type</label>
                  <select className="form-input" value={leaveForm.type} onChange={e=>setLeaveForm(f=>({...f,type:e.target.value}))}>
                    {['casual','sick','earned','unpaid'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-group"><label className="form-label">Reason</label><textarea className="form-input" rows={3} value={leaveForm.reason} onChange={e=>setLeaveForm(f=>({...f,reason:e.target.value}))} placeholder="Brief reason for leave" /></div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={()=>setShowLeaveModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Submit Request</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
      {checkoutFor && (
        <div className="modal-overlay" onClick={e=>{ if(e.target===e.currentTarget) setCheckoutFor(null); }}>
          <motion.div className="modal-box" initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }}>
            <div className="modal-header"><span className="modal-title">🦽 Check Out — {checkoutFor.name}</span><button className="btn btn-ghost btn-icon" onClick={()=>setCheckoutFor(null)}>✕</button></div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Taking it to *</label>
                <input className="form-input" required value={checkoutLocation} onChange={e=>setCheckoutLocation(e.target.value)} placeholder="e.g. Ward B, Bed 4" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={()=>setCheckoutFor(null)}>Cancel</button>
              <button className="btn btn-primary" disabled={checkingOut} onClick={submitCheckout}>{checkingOut ? 'Checking out…' : '✓ Check Out'}</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, value, label, color }) {
  return (
    <motion.div className="stat-card" initial={{ opacity:0, y:14 }} animate={{ opacity:1, y:0 }}>
      <div className="stat-icon" style={{ background:color }}>{icon}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </motion.div>
  );
}
