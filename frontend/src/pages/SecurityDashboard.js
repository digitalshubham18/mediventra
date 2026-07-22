import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { tasksAPI, facilityAPI, leavesAPI, checklistAPI, staffLogsAPI, alertsAPI, announcementsAPI, visitorAPI } from '../utils/api';
import { getSocket } from '../utils/socket';
import { MyActivityWidget } from '../components/DashboardWidgets';
import toast from 'react-hot-toast';

const CHECKLIST_ITEMS = [
  'CCTV monitoring round — all zones',
  'Visitor log audit at main entrance',
  'Perimeter & gate patrol',
  'Check emergency exits are unobstructed',
  'Test fire alarm panel',
  'Verify ID badges on staff entering restricted areas',
  'Inspect parking area & ambulance bay',
  'Night shift handover briefing',
];

const SHIFTS = {
  morning:  { l:'Morning',   t:'08:00–16:00', i:'🌅', bg:'#dcfce7', c:'#15803d' },
  afternoon:{ l:'Afternoon', t:'14:00–22:00', i:'🌇', bg:'#fef3c7', c:'#92400e' },
  night:    { l:'Night',     t:'22:00–06:00', i:'🌙', bg:'#e0e7ff', c:'#3730a3' },
  full:     { l:'Full Day',  t:'07:00–19:00', i:'☀️', bg:'#f0f9ff', c:'#0369a1' },
};

const LOG_TYPES = [
  { value:'incident_report', label:'🚨 Incident Report', placeholder:'e.g. Unauthorized person attempted to enter Ward C' },
  { value:'patrol_log',      label:'🔐 Patrol Log',       placeholder:'e.g. Completed 8PM perimeter round, all clear' },
  { value:'maintenance_request', label:'🔧 Maintenance Issue', placeholder:'e.g. Gate-2 CCTV camera not recording' },
  { value:'other',           label:'📝 Other',            placeholder:'Describe the entry' },
];

export default function SecurityDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [tasks, setTasks] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [logs, setLogs] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [checklist, setChecklist] = useState({});
  const [loading, setLoading] = useState(true);
  const [showLogModal, setShowLogModal] = useState(false);
  const [logForm, setLogForm] = useState({ category:'incident_report', title:'', details:'', location:'', priority:'medium' });
  const [submittingLog, setSubmittingLog] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ startDate:'', endDate:'', reason:'', type:'casual' });
  const [visitors, setVisitors] = useState([]);
  const [visitorsLoading, setVisitorsLoading] = useState(true);
  const [showVisitorModal, setShowVisitorModal] = useState(false);
  const [visitorForm, setVisitorForm] = useState({ visitorName:'', phone:'', purpose:'', personToMeet:'', department:'', idProofType:'', idProofNumber:'', vehicleNumber:'', badgeNumber:'' });
  const [loggingVisitor, setLoggingVisitor] = useState(false);
  const [respondingAlertId, setRespondingAlertId] = useState(null);
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [broadcastForm, setBroadcastForm] = useState({ title:'', content:'' });
  const [sendingBroadcast, setSendingBroadcast] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      tasksAPI.getAll().catch(()=>({ data:{ data:[] } })),
      facilityAPI.getSchedules({ userId: user?._id, week: new Date().toISOString() }).catch(()=>({ data:{ data:[] } })),
      leavesAPI.getAll().catch(()=>({ data:{ data:[] } })),
      staffLogsAPI.getAll().catch(()=>({ data:{ data:[] } })),
      checklistAPI.getToday().catch(()=>({ data:{ data:{ items:{} } } })),
      alertsAPI.getAll({ limit: 15 }).catch(()=>({ data:{ data:[] } })),
    ]).then(([tRes, sRes, lRes, logRes, cRes, aRes]) => {
      setTasks(tRes.data.data || []);
      setSchedules(sRes.data.data || []);
      setLeaves(lRes.data.data || []);
      setLogs(logRes.data.data || []);
      setChecklist(cRes.data.data?.items || {});
      setAlerts(aRes.data.data || []);
      setLoading(false);
    });
    loadVisitors();
  };

  const loadVisitors = () => {
    setVisitorsLoading(true);
    visitorAPI.getAll().then(r => setVisitors(r.data.data || [])).catch(()=>{}).finally(()=>setVisitorsLoading(false));
  };

  const submitVisitorLog = async (e) => {
    e.preventDefault();
    if (!visitorForm.visitorName.trim() || !visitorForm.purpose.trim()) { toast.error('Visitor name and purpose are required'); return; }
    setLoggingVisitor(true);
    try {
      await visitorAPI.checkIn(visitorForm);
      toast.success('✅ Visitor logged in');
      setShowVisitorModal(false);
      setVisitorForm({ visitorName:'', phone:'', purpose:'', personToMeet:'', department:'', idProofType:'', idProofNumber:'', vehicleNumber:'', badgeNumber:'' });
      loadVisitors();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to log visitor'); }
    setLoggingVisitor(false);
  };

  const checkOutVisitor = async (id) => {
    try { await visitorAPI.checkOut(id); toast.success('✅ Visitor checked out'); loadVisitors(); }
    catch (e) { toast.error(e.response?.data?.error || 'Failed to check out'); }
  };

  useEffect(() => {
    load();
    const socket = getSocket();
    if (!socket) return;
    const taskHandler  = () => load();
    const alertHandler = () => alertsAPI.getAll({ limit: 15 }).then(r => setAlerts(r.data.data || [])).catch(()=>{});
    socket.on('task_assigned', taskHandler);
    socket.on('emergency_alert', alertHandler);
    socket.on('alert_acknowledged', alertHandler);
    const onVisitorChange = () => loadVisitors();
    socket.on('visitor_checked_in', onVisitorChange);
    socket.on('visitor_checked_out', onVisitorChange);
    return () => { socket.off('task_assigned', taskHandler); socket.off('emergency_alert', alertHandler); socket.off('alert_acknowledged', alertHandler); socket.off('visitor_checked_in', onVisitorChange); socket.off('visitor_checked_out', onVisitorChange); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id]);

  const acknowledgeAlert = async (id) => {
    setRespondingAlertId(id);
    try { const res = await alertsAPI.acknowledge(id); setAlerts(as => as.map(a => a._id===id ? res.data.data : a)); toast.success('🚓 Responding — marked as acknowledged'); }
    catch (e) { toast.error(e.response?.data?.error || 'Failed to acknowledge'); }
    setRespondingAlertId(null);
  };
  const resolveAlertEntry = async (id) => {
    const notes = window.prompt('Resolution notes (optional):', '') || '';
    setRespondingAlertId(id);
    try { const res = await alertsAPI.resolve(id, { resolutionNotes: notes }); setAlerts(as => as.map(a => a._id===id ? res.data.data : a)); toast.success('✅ Alert resolved'); }
    catch (e) { toast.error(e.response?.data?.error || 'Failed to resolve'); }
    setRespondingAlertId(null);
  };

  const submitBroadcast = async (e) => {
    e.preventDefault();
    if (!broadcastForm.title.trim() || !broadcastForm.content.trim()) { toast.error('Title and message are required'); return; }
    setSendingBroadcast(true);
    try {
      await announcementsAPI.create({ title: broadcastForm.title.trim(), content: broadcastForm.content.trim(), type:'emergency', priority:'urgent' });
      toast.success('🚨 Emergency broadcast sent hospital-wide');
      setShowBroadcast(false);
      setBroadcastForm({ title:'', content:'' });
    } catch (e) { toast.error(e.response?.data?.error || 'Failed to send broadcast'); }
    setSendingBroadcast(false);
  };

  const toggleChecklistItem = async (index) => {
    const newVal = !checklist[index];
    setChecklist(c => ({ ...c, [index]: newVal }));
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

  const submitLog = async (e) => {
    e.preventDefault();
    if (!logForm.title.trim()) { toast.error('Please describe the entry'); return; }
    setSubmittingLog(true);
    try {
      const res = await staffLogsAPI.create(logForm);
      setLogs(l => [res.data.data, ...l]);
      setShowLogModal(false);
      setLogForm({ category:'incident_report', title:'', details:'', location:'', priority:'medium' });
      toast.success('✅ Logged!');
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

  const closeLogEntry = async (id) => {
    const notes = window.prompt('Add a closing note (what was done to resolve this) — optional:', '');
    if (notes === null) return; // cancelled
    try {
      const res = await staffLogsAPI.close(id, notes);
      setLogs(ls => ls.map(l => l._id === id ? res.data.data : l));
      toast.success('✅ Marked as closed!');
    } catch (e) { toast.error(e.response?.data?.error || 'Failed to close entry'); }
  };

  const pendingTasks  = tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled');
  const doneTasks     = tasks.filter(t => t.status === 'completed');
  const todayStr      = new Date().toDateString();
  const todayScheds   = schedules.filter(s => new Date(s.date).toDateString() === todayStr);
  const openIncidents = logs.filter(l => l.category === 'incident_report' && l.status !== 'resolved' && l.status !== 'closed');
  const activeAlerts  = alerts.filter(a => a.status !== 'resolved');
  const checklistDone = Object.values(checklist).filter(Boolean).length;

  return (
    <div>
      <div style={{ background:'linear-gradient(135deg,#1f2937cc,#374151)', borderRadius:16, padding:'22px 26px', marginBottom:20, color:'#fff', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:-40, right:-40, width:160, height:160, borderRadius:'50%', background:'rgba(255,255,255,.1)', pointerEvents:'none' }}/>
        <div style={{ position:'relative' }}>
          <div style={{ fontSize:26, fontWeight:800, marginBottom:6 }}>🔐 Security Officer Dashboard</div>
          <div style={{ opacity:.9, fontSize:14 }}>{user?.name} · {user?.department || 'Security Operations'} · {new Date().toLocaleDateString('en-IN',{ weekday:'long', day:'numeric', month:'long' })}</div>
          <div style={{ display:'flex', gap:8, marginTop:12, flexWrap:'wrap' }}>
            <span style={{ background:'rgba(255,255,255,.18)', borderRadius:20, padding:'4px 14px', fontSize:12.5, fontWeight:600 }}>📋 {pendingTasks.length} pending task{pendingTasks.length!==1?'s':''}</span>
            <span style={{ background: openIncidents.length>0 ? '#dc2626' : 'rgba(255,255,255,.18)', borderRadius:20, padding:'4px 14px', fontSize:12.5, fontWeight:600 }}>🚨 {openIncidents.length} open incident{openIncidents.length!==1?'s':''}</span>
            {activeAlerts.length > 0 && <span style={{ background:'#dc2626', borderRadius:20, padding:'4px 14px', fontSize:12.5, fontWeight:700 }}>🆘 {activeAlerts.length} active SOS</span>}
          </div>
        </div>
      </div>

      {activeAlerts.length > 0 && (
        <div style={{ background:'#fef2f2', border:'1.5px solid #fecaca', borderRadius:12, padding:'14px 16px', marginBottom:18 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
            <span style={{ fontSize:22 }}>🆘</span>
            <div style={{ fontWeight:800, color:'#dc2626', fontSize:13.5 }}>{activeAlerts.length} active emergency alert{activeAlerts.length!==1?'s':''}</div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {activeAlerts.map(a => (
              <div key={a._id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', background:'#fff', borderRadius:10, padding:'10px 12px', flexWrap:'wrap', gap:8 }}>
                <div>
                  <div style={{ fontWeight:700, fontSize:12.5, color:'#0f172a' }}>{a.type} — {a.patient?.name || 'Unknown patient'}</div>
                  <div style={{ fontSize:12, color:'#64748b', marginTop:2 }}>{a.message}</div>
                  {a.status==='acknowledged' && <div style={{ fontSize:11.5, color:'#92400e', marginTop:2 }}>🚓 {a.respondedBy?.name} is responding</div>}
                </div>
                <div style={{ display:'flex', gap:6 }}>
                  {a.status==='pending' && <button className="btn btn-sm" style={{ background:'#dc2626', color:'#fff' }} disabled={respondingAlertId===a._id} onClick={()=>acknowledgeAlert(a._id)}>🚓 Respond</button>}
                  <button className="btn btn-outline btn-sm" disabled={respondingAlertId===a._id} onClick={()=>resolveAlertEntry(a._id)}>✅ Resolve</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="stat-grid">
        <StatCard icon="📋" value={pendingTasks.length} label="Pending Tasks" color="#fffbeb" />
        <StatCard icon="✅" value={doneTasks.length} label="Completed Tasks" color="#f0fdf4" />
        <StatCard icon="✓" value={`${checklistDone}/${CHECKLIST_ITEMS.length}`} label="Patrol Checklist" color="#eff6ff" />
        <StatCard icon="🚨" value={openIncidents.length} label="Open Incidents" color="#fef2f2" />
      </div>

      <div style={{ marginTop:14 }}><MyActivityWidget /></div>

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
          <div className="card-header"><span className="card-title">✅ Patrol & Duty Checklist</span><span className="text-xs text-muted">{checklistDone}/{CHECKLIST_ITEMS.length} done</span></div>
          <div className="card-body" style={{ maxHeight:320, overflowY:'auto' }}>
            {CHECKLIST_ITEMS.map((item, i) => (
              <div key={i} onClick={()=>toggleChecklistItem(i)}
                style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', borderRadius:8, cursor:'pointer', background:checklist[i]?'#37415112':'transparent', marginBottom:3 }}>
                <div style={{ width:18, height:18, borderRadius:5, border:`2px solid ${checklist[i]?'#374151':'#cbd5e1'}`, background:checklist[i]?'#374151':'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
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
            <span className="card-title">🚨 Incident & Patrol Logs</span>
            <button className="btn btn-primary btn-xs" onClick={()=>setShowLogModal(true)}>+ New Entry</button>
          </div>
          <div className="card-body" style={{ maxHeight:280, overflowY:'auto' }}>
            {logs.length === 0 ? (
              <div style={{ textAlign:'center', padding:24, color:'#94a3b8' }}>No entries logged yet</div>
            ) : logs.map(l => (
              <div key={l._id} style={{ padding:'9px 12px', background: l.category==='incident_report' ? '#fef2f2' : '#f8fafc', borderRadius:9, marginBottom:6 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8 }}>
                  <div>
                    <div style={{ fontWeight:700, fontSize:12.5 }}>{LOG_TYPES.find(r=>r.value===l.category)?.label || l.category}</div>
                    <div style={{ fontSize:12, color:'#374151', marginTop:2 }}>{l.title}</div>
                    {l.location && <div style={{ fontSize:11, color:'#94a3b8', marginTop:1 }}>📍 {l.location}</div>}
                  </div>
                  <span className={`badge ${l.status==='closed' ? 'badge-success' : l.status==='resolved' ? 'badge-success' : 'badge-warning'}`} style={{ fontSize:10, flexShrink:0 }}>
                    {l.status==='closed' ? '✓ Closed' : l.status==='resolved' ? '✓ Resolved' : l.status==='in_progress' ? 'In Progress' : 'Open'}
                  </span>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:4 }}>
                  <div style={{ fontSize:10.5, color:'#94a3b8' }}>{new Date(l.createdAt).toLocaleString('en-IN',{ day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}</div>
                  {l.status !== 'closed' && l.status !== 'resolved' && (
                    <button className="btn btn-success btn-xs" style={{ fontSize:10.5, padding:'2px 9px' }} onClick={()=>closeLogEntry(l._id)}>✅ Mark Complete & Close</button>
                  )}
                </div>
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

      <motion.div className="card mt-2" initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ delay:.3 }}>
        <div className="card-header">
          <span className="card-title">🪪 Visitor Gate Register — Today</span>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <span className="badge badge-primary">{visitors.filter(v=>v.status!=='checked_out').length} on premises</span>
            <button className="btn btn-primary btn-xs" onClick={()=>setShowVisitorModal(true)}>+ Log Visitor</button>
          </div>
        </div>
        <div className="card-body" style={{ maxHeight:320, overflowY:'auto' }}>
          {visitorsLoading ? <div style={{ textAlign:'center', color:'#94a3b8', padding:20 }}>Loading…</div>
          : visitors.length === 0 ? (
            <div style={{ textAlign:'center', padding:24, color:'#94a3b8' }}>No visitors logged at the gate today</div>
          ) : visitors.map(v => (
            <div key={v._id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'9px 12px', background: v.status==='checked_out' ? '#f8fafc' : '#eff6ff', borderRadius:9, marginBottom:6, flexWrap:'wrap', gap:8 }}>
              <div>
                <div style={{ fontWeight:700, fontSize:12.5 }}>{v.visitorName} {v.vehicleNumber && <span style={{ fontWeight:500, color:'#94a3b8' }}>· 🚗 {v.vehicleNumber}</span>}</div>
                <div style={{ fontSize:11.5, color:'#64748b', marginTop:1 }}>{v.purpose}{v.personToMeet ? ` · To meet: ${v.personToMeet}` : ''}</div>
                <div style={{ fontSize:10.5, color:'#94a3b8', marginTop:2 }}>In: {new Date(v.entryTime).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}{v.exitTime ? ` · Out: ${new Date(v.exitTime).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}` : ''} · Logged by {v.loggedBy?.name}</div>
              </div>
              {v.status !== 'checked_out' ? (
                <button className="btn btn-outline btn-xs" onClick={()=>checkOutVisitor(v._id)}>✅ Check Out</button>
              ) : (
                <span className="badge badge-success" style={{ fontSize:10 }}>Checked Out</span>
              )}
            </div>
          ))}
        </div>
      </motion.div>

      <div className="mt-2" style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
        <button className="btn btn-danger btn-sm" onClick={()=>setShowBroadcast(true)}>🚨 Broadcast Emergency Notice</button>
        <button className="btn btn-outline btn-sm" style={{ borderColor:'#fecaca', color:'#dc2626' }} onClick={()=>navigate('/emergency')}>🚨 Emergency Center</button>
        <button className="btn btn-outline btn-sm" onClick={()=>navigate('/notice-board')}>📢 Notice Board</button>
        <button className="btn btn-outline btn-sm" onClick={()=>navigate('/chat')}>💬 Chat</button>
        <button className="btn btn-outline btn-sm" onClick={()=>navigate('/salary')}>💰 My Salary</button>
      </div>

      {showLogModal && (
        <div className="modal-overlay" onClick={e=>{ if(e.target===e.currentTarget) setShowLogModal(false); }}>
          <motion.div className="modal-box" initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }}>
            <div className="modal-header"><span className="modal-title">🚨 New Log Entry</span><button className="btn btn-ghost btn-icon" onClick={()=>setShowLogModal(false)}>✕</button></div>
            <form onSubmit={submitLog}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Entry Type</label>
                  <select className="form-input" value={logForm.category} onChange={e=>setLogForm(f=>({...f,category:e.target.value}))}>
                    {LOG_TYPES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Description *</label>
                  <input className="form-input" required value={logForm.title} onChange={e=>setLogForm(f=>({...f,title:e.target.value}))} placeholder={LOG_TYPES.find(r=>r.value===logForm.category)?.placeholder} />
                </div>
                <div className="form-group">
                  <label className="form-label">Location</label>
                  <input className="form-input" value={logForm.location} onChange={e=>setLogForm(f=>({...f,location:e.target.value}))} placeholder="e.g. Main Gate, Ward C corridor" />
                </div>
                <div className="form-group">
                  <label className="form-label">Additional Details</label>
                  <textarea className="form-input" rows={3} value={logForm.details} onChange={e=>setLogForm(f=>({...f,details:e.target.value}))} placeholder="Optional — any further details" />
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
                <button type="submit" className="btn btn-primary" disabled={submittingLog}>{submittingLog ? 'Submitting…' : 'Submit Entry'}</button>
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
      {showVisitorModal && (
        <div className="modal-overlay" onClick={e=>{ if(e.target===e.currentTarget) setShowVisitorModal(false); }}>
          <motion.div className="modal-box" initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }}>
            <div className="modal-header"><span className="modal-title">🪪 Log Visitor at Gate</span><button className="btn btn-ghost btn-icon" onClick={()=>setShowVisitorModal(false)}>✕</button></div>
            <form onSubmit={submitVisitorLog}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group"><label className="form-label">Visitor Name *</label><input className="form-input" required value={visitorForm.visitorName} onChange={e=>setVisitorForm(f=>({...f,visitorName:e.target.value}))} /></div>
                  <div className="form-group"><label className="form-label">Phone</label><input className="form-input" value={visitorForm.phone} onChange={e=>setVisitorForm(f=>({...f,phone:e.target.value}))} /></div>
                </div>
                <div className="form-group"><label className="form-label">Purpose of Visit *</label><input className="form-input" required value={visitorForm.purpose} onChange={e=>setVisitorForm(f=>({...f,purpose:e.target.value}))} placeholder="e.g. Meeting patient, Vendor delivery" /></div>
                <div className="form-row">
                  <div className="form-group"><label className="form-label">Person / Patient to Meet</label><input className="form-input" value={visitorForm.personToMeet} onChange={e=>setVisitorForm(f=>({...f,personToMeet:e.target.value}))} /></div>
                  <div className="form-group"><label className="form-label">Department</label><input className="form-input" value={visitorForm.department} onChange={e=>setVisitorForm(f=>({...f,department:e.target.value}))} /></div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">ID Proof Type</label>
                    <select className="form-input" value={visitorForm.idProofType} onChange={e=>setVisitorForm(f=>({...f,idProofType:e.target.value}))}>
                      <option value="">— Select —</option>
                      {['Aadhaar','PAN','Driving License','Passport','Voter ID','Other'].map(t=><option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="form-group"><label className="form-label">ID Proof Number</label><input className="form-input" value={visitorForm.idProofNumber} onChange={e=>setVisitorForm(f=>({...f,idProofNumber:e.target.value}))} /></div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label className="form-label">Vehicle Number</label><input className="form-input" value={visitorForm.vehicleNumber} onChange={e=>setVisitorForm(f=>({...f,vehicleNumber:e.target.value}))} placeholder="e.g. DL 3C AB 1234" /></div>
                  <div className="form-group"><label className="form-label">Gate Pass / Badge #</label><input className="form-input" value={visitorForm.badgeNumber} onChange={e=>setVisitorForm(f=>({...f,badgeNumber:e.target.value}))} /></div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={()=>setShowVisitorModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={loggingVisitor}>{loggingVisitor ? 'Logging…' : '✓ Log Visitor In'}</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {showBroadcast && (
        <div className="modal-overlay" onClick={e=>{ if(e.target===e.currentTarget) setShowBroadcast(false); }}>
          <motion.div className="modal-box" initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }}>
            <div className="modal-header"><span className="modal-title">🚨 Broadcast Emergency Notice</span><button className="btn btn-ghost btn-icon" onClick={()=>setShowBroadcast(false)}>✕</button></div>
            <form onSubmit={submitBroadcast}>
              <div className="modal-body">
                <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:10, padding:'10px 13px', marginBottom:14, fontSize:12, color:'#991b1b' }}>
                  This posts an urgent, pinned announcement visible to every staff member hospital-wide. Use for genuine emergencies only (lockdown, fire, evacuation, etc.)
                </div>
                <div className="form-group"><label className="form-label">Title *</label><input className="form-input" required value={broadcastForm.title} onChange={e=>setBroadcastForm(f=>({...f,title:e.target.value}))} placeholder="e.g. LOCKDOWN — Building C" /></div>
                <div className="form-group"><label className="form-label">Message *</label><textarea className="form-input" required rows={3} value={broadcastForm.content} onChange={e=>setBroadcastForm(f=>({...f,content:e.target.value}))} placeholder="Instructions for staff — what's happening and what to do" /></div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={()=>setShowBroadcast(false)}>Cancel</button>
                <button type="submit" className="btn btn-danger" disabled={sendingBroadcast}>{sendingBroadcast?'Sending…':'🚨 Send Broadcast'}</button>
              </div>
            </form>
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
