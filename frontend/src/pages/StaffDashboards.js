/**
 * Dedicated staff dashboards for all non-admin/non-doctor/non-patient roles
 * except wardboy and security (those have their own files).
 *
 * Exports: NurseDashboard, PharmacistDashboard, ReceptionistDashboard*,
 *          ITTechDashboard, AmbulanceDashboard, ElectricianDashboard,
 *          PlumberDashboard, EquipmentTechDashboard, BiomedicalDashboard,
 *          SweeperDashboard, OTBoyDashboard
 *
 * *ReceptionistDashboard has its own rich file; that one is imported
 *  separately in Dashboard.js.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  tasksAPI, leavesAPI, facilityAPI, checklistAPI, staffLogsAPI,
  medicinesAPI, alertsAPI, appointmentsAPI, ordersAPI, ambulanceTripsAPI, medicationAPI, wearableAPI, usersAPI, nurseCallAPI, maintenanceRequestAPI, systemAPI, surgeryAPI, assetsAPI,
} from '../utils/api';
import { getSocket } from '../utils/socket';
import { MyActivityWidget } from '../components/DashboardWidgets';
import toast from 'react-hot-toast';

/* ─── Shared tiny components ─────────────────────────────────── */
function StatCard({ icon, value, label, color = '#f8fafc' }) {
  return (
    <motion.div className="stat-card" initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }}>
      <div className="stat-icon" style={{ background: color }}>{icon}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </motion.div>
  );
}

function TaskItem({ t, onDone }) {
  const PRI = { urgent:'#ef4444', high:'#f97316', medium:'#3b82f6', low:'#22c55e' };
  return (
    <div style={{ padding:'10px 12px', background: t.status==='completed'?'#f0fdf4':'#f8fafc', borderRadius:10, marginBottom:7, borderLeft:`3px solid ${PRI[t.priority]||'#3b82f6'}`, display:'flex', alignItems:'center', gap:10 }}>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontWeight:700, fontSize:13, color:'#0f172a', textDecoration: t.status==='completed'?'line-through':'none' }}>{t.title}</div>
        {t.dueDate && <div style={{ fontSize:11, color:'#94a3b8', marginTop:2 }}>📅 {new Date(t.dueDate).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</div>}
      </div>
      {t.status !== 'completed'
        ? <button className="btn btn-primary btn-xs" onClick={()=>onDone(t._id)}>✓ Done</button>
        : <span style={{ color:'#22c55e', fontSize:16 }}>✓</span>}
    </div>
  );
}

function ChecklistBox({ items, checklist, onToggle, accentColor = '#3b82f6' }) {
  const done = Object.values(checklist).filter(Boolean).length;
  return (
    <motion.div className="card" initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ delay:.18 }}>
      <div className="card-header">
        <span className="card-title">✅ Daily Checklist</span>
        <span className="text-xs text-muted">{done}/{items.length} done · saved</span>
      </div>
      <div className="card-body" style={{ maxHeight:290, overflowY:'auto' }}>
        {items.map((item, i) => (
          <div key={i} onClick={()=>onToggle(i)} style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 8px', borderRadius:8, cursor:'pointer', background: checklist[i] ? `${accentColor}10` : 'transparent', marginBottom:3 }}>
            <div style={{ width:18, height:18, borderRadius:5, border:`2px solid ${checklist[i]?accentColor:'#cbd5e1'}`, background: checklist[i]?accentColor:'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              {checklist[i] && <span style={{ color:'#fff', fontSize:10, fontWeight:900 }}>✓</span>}
            </div>
            <span style={{ fontSize:12.5, color: checklist[i]?'#94a3b8':'#374151', textDecoration: checklist[i]?'line-through':'none' }}>{item}</span>
          </div>
        ))}
        <div style={{ fontSize:11, color:'#94a3b8', marginTop:8, textAlign:'center' }}>💾 Persisted — survives refresh</div>
      </div>
    </motion.div>
  );
}

function LeaveCard({ leaves, onApply }) {
  return (
    <motion.div className="card" initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ delay:.28 }}>
      <div className="card-header"><span className="card-title">🌴 My Leave</span><button className="btn btn-primary btn-xs" onClick={onApply}>+ Apply</button></div>
      <div className="card-body">
        {leaves.length === 0 ? <div style={{ textAlign:'center', fontSize:12.5, color:'#94a3b8' }}>No leave requests yet</div>
        : leaves.slice(0,4).map(l => (
          <div key={l._id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 0', borderBottom:'1px solid #f1f5f9', fontSize:12.5 }}>
            <span style={{ color:'#374151' }}>{new Date(l.startDate).toLocaleDateString('en-IN',{day:'numeric',month:'short'})} – {new Date(l.endDate).toLocaleDateString('en-IN',{day:'numeric',month:'short'})} <span style={{ color:'#94a3b8', fontSize:11, textTransform:'capitalize' }}>({l.type})</span></span>
            <span className={`badge ${l.status==='approved'?'badge-success':l.status==='rejected'?'badge-danger':'badge-warning'}`} style={{ fontSize:10 }}>{l.status}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function LeaveModal({ show, onClose, onSubmit }) {
  const [form, setForm] = useState({ startDate:'', endDate:'', reason:'', type:'casual' });
  if (!show) return null;
  const submit = async (e) => {
    e.preventDefault();
    await onSubmit(form);
    setForm({ startDate:'', endDate:'', reason:'', type:'casual' });
  };
  return (
    <div className="modal-overlay" onClick={e=>{ if(e.target===e.currentTarget) onClose(); }}>
      <motion.div className="modal-box" initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }}>
        <div className="modal-header"><span className="modal-title">🌴 Apply for Leave</span><button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button></div>
        <form onSubmit={submit}>
          <div className="modal-body">
            <div className="form-row">
              <div className="form-group"><label className="form-label">Start Date</label><input className="form-input" type="date" required value={form.startDate} onChange={e=>setForm(f=>({...f,startDate:e.target.value}))} /></div>
              <div className="form-group"><label className="form-label">End Date</label><input className="form-input" type="date" required value={form.endDate} onChange={e=>setForm(f=>({...f,endDate:e.target.value}))} /></div>
            </div>
            <div className="form-group"><label className="form-label">Type</label><select className="form-input" value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>{['casual','sick','earned','unpaid'].map(t=><option key={t}>{t}</option>)}</select></div>
            <div className="form-group"><label className="form-label">Reason</label><textarea className="form-input" rows={3} value={form.reason} onChange={e=>setForm(f=>({...f,reason:e.target.value}))} placeholder="Reason for leave" /></div>
          </div>
          <div className="modal-footer"><button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button><button type="submit" className="btn btn-primary">Submit</button></div>
        </form>
      </motion.div>
    </div>
  );
}

/* ─── Shared hook for common staff data ─────────────────────── */
function useStaffData(userId) {
  const [tasks,     setTasks]     = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [leaves,    setLeaves]    = useState([]);
  const [checklist, setChecklist] = useState({});
  const [logs,      setLogs]      = useState([]);
  const [loading,   setLoading]   = useState(true);

  const reload = () => {
    setLoading(true);
    Promise.all([
      tasksAPI.getAll().catch(()=>({data:{data:[]}})),
      facilityAPI.getSchedules({ userId, week: new Date().toISOString() }).catch(()=>({data:{data:[]}})),
      leavesAPI.getAll().catch(()=>({data:{data:[]}})),
      checklistAPI.getToday().catch(()=>({data:{data:{items:{}}}})),
      staffLogsAPI.getAll().catch(()=>({data:{data:[]}})),
    ]).then(([tR,sR,lR,cR,logR]) => {
      setTasks(tR.data.data||[]);
      setSchedules(sR.data.data||[]);
      setLeaves(lR.data.data||[]);
      setChecklist(cR.data.data?.items||{});
      setLogs(logR.data.data||[]);
      setLoading(false);
    });
  };

  useEffect(() => {
    reload();
    const socket = getSocket();
    if (socket) {
      const h = () => reload();
      socket.on('task_assigned', h);
      return () => socket.off('task_assigned', h);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const toggleChecklist = async (index) => {
    const v = !checklist[index];
    setChecklist(c=>({...c,[index]:v}));
    try { await checklistAPI.toggle(index, v); }
    catch { setChecklist(c=>({...c,[index]:!v})); toast.error('Save failed'); }
  };

  const markTaskDone = async (id) => {
    try {
      await tasksAPI.update(id, { status:'completed', completedAt: new Date() });
      setTasks(ts=>ts.map(t=>t._id===id?{...t,status:'completed'}:t));
      toast.success('✅ Task completed!');
    } catch { toast.error('Failed'); }
  };

  const applyLeave = async (form) => {
    try {
      await leavesAPI.apply(form);
      toast.success('✅ Leave request submitted!');
      reload();
    } catch (e) { toast.error(e.response?.data?.error||'Failed'); }
  };

  const submitLog = async (data) => {
    try {
      const res = await staffLogsAPI.create(data);
      setLogs(l=>[res.data.data,...l]);
      toast.success('✅ Logged!');
    } catch (e) { toast.error(e.response?.data?.error||'Failed'); }
  };

  const deleteLog = async (id) => {
    const prev = logs;
    setLogs(l => l.filter(x => x._id !== id)); // optimistic
    try { await staffLogsAPI.delete(id); toast.success('Deleted'); }
    catch (e) { setLogs(prev); toast.error(e.response?.data?.error || 'Failed to delete'); }
  };

  return { tasks, schedules, leaves, checklist, logs, loading, toggleChecklist, markTaskDone, applyLeave, submitLog, deleteLog, reload };
}

/* ─── Shared layout shell ────────────────────────────────────── */
const SHIFTS = {
  morning:  {l:'Morning',  t:'08:00–16:00',i:'🌅',bg:'#dcfce7',c:'#15803d'},
  afternoon:{l:'Afternoon',t:'14:00–22:00',i:'🌇',bg:'#fef3c7',c:'#92400e'},
  night:    {l:'Night',    t:'22:00–06:00',i:'🌙',bg:'#e0e7ff',c:'#3730a3'},
  full:     {l:'Full Day', t:'07:00–19:00',i:'☀️',bg:'#f0f9ff',c:'#0369a1'},
};

function ScheduleCard({ schedules }) {
  const today = new Date().toDateString();
  const todayS = schedules.filter(s=>new Date(s.date).toDateString()===today);
  return (
    <motion.div className="card" initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ delay:.22 }}>
      <div className="card-header"><span className="card-title">📅 Today's Shifts</span></div>
      <div className="card-body">
        {todayS.length===0 ? <div style={{ textAlign:'center', color:'#94a3b8', padding:'14px 0' }}>😌 No shifts today</div>
        : todayS.map((s,i)=>{
          const sd = SHIFTS[s.shift]||SHIFTS.morning;
          return <div key={i} style={{ padding:'9px 12px', background:sd.bg, borderRadius:9, borderLeft:`3px solid ${sd.c}`, marginBottom:6 }}>
            <div style={{ fontWeight:700, fontSize:12.5, color:'#0f172a' }}>{sd.i} {sd.l} · {sd.t}</div>
            {s.department && <div style={{ fontSize:11.5, color:'#64748b', marginTop:2 }}>🏥 {s.department}</div>}
          </div>;
        })}
      </div>
    </motion.div>
  );
}

function LogPanel({ logs, title, logTypes, onNew, onDelete, accentColor='#3b82f6' }) {
  const [showModal, setShowModal] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [form, setForm] = useState({ category: logTypes[0]?.value||'other', title:'', location:'', priority:'medium' });
  const submit = async (e) => {
    e.preventDefault();
    await onNew(form);
    setShowModal(false);
    setForm({ category: logTypes[0]?.value||'other', title:'', location:'', priority:'medium' });
  };
  const handleDelete = async (id) => {
    if (!window.confirm('Delete this log entry? This cannot be undone.')) return;
    setDeletingId(id);
    await onDelete?.(id);
    setDeletingId(null);
  };
  return (
    <>
      <motion.div className="card" initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ delay:.33 }}>
        <div className="card-header">
          <span className="card-title">{title}</span>
          <button className="btn btn-primary btn-xs" onClick={()=>setShowModal(true)}>+ New</button>
        </div>
        <div className="card-body" style={{ maxHeight:240, overflowY:'auto' }}>
          {logs.length===0 ? <div style={{ textAlign:'center', color:'#94a3b8', fontSize:12.5 }}>No entries yet</div>
          : logs.slice(0,6).map(l=>(
            <div key={l._id} style={{ padding:'8px 10px', background:'#f8fafc', borderRadius:8, marginBottom:5, borderLeft:`3px solid ${l.status==='resolved'?'#22c55e':accentColor}` }}>
              <div style={{ display:'flex', justifyContent:'space-between', gap:6, alignItems:'flex-start' }}>
                <span style={{ fontWeight:600, fontSize:12.5, color:'#0f172a' }}>{l.title}</span>
                <div style={{ display:'flex', alignItems:'center', gap:5, flexShrink:0 }}>
                  <span className={`badge ${l.status==='resolved'?'badge-success':'badge-warning'}`} style={{ fontSize:10 }}>{l.status}</span>
                  {onDelete && (
                    <button onClick={()=>handleDelete(l._id)} disabled={deletingId===l._id} title="Delete this entry"
                      style={{ background:'none', border:'none', cursor:'pointer', color:'#dc2626', fontSize:12, padding:'0 2px', opacity:deletingId===l._id?0.5:1 }}>
                      🗑️
                    </button>
                  )}
                </div>
              </div>
              {l.location && <div style={{ fontSize:11, color:'#94a3b8', marginTop:2 }}>📍 {l.location}</div>}
              <div style={{ fontSize:10.5, color:'#94a3b8', marginTop:2 }}>{new Date(l.createdAt).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</div>
            </div>
          ))}
        </div>
      </motion.div>
      {showModal && (
        <div className="modal-overlay" onClick={e=>{ if(e.target===e.currentTarget) setShowModal(false); }}>
          <motion.div className="modal-box" initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }}>
            <div className="modal-header"><span className="modal-title">{title}</span><button className="btn btn-ghost btn-icon" onClick={()=>setShowModal(false)}>✕</button></div>
            <form onSubmit={submit}>
              <div className="modal-body">
                <div className="form-group"><label className="form-label">Type</label>
                  <select className="form-input" value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}>
                    {logTypes.map(lt=><option key={lt.value} value={lt.value}>{lt.label}</option>)}
                  </select>
                </div>
                <div className="form-group"><label className="form-label">Description *</label><input className="form-input" required value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="Describe the entry" /></div>
                <div className="form-group"><label className="form-label">Location</label><input className="form-input" value={form.location} onChange={e=>setForm(f=>({...f,location:e.target.value}))} placeholder="Room / Ward / Location" /></div>
                <div className="form-group"><label className="form-label">Priority</label>
                  <select className="form-input" value={form.priority} onChange={e=>setForm(f=>({...f,priority:e.target.value}))}>
                    {['low','medium','high','urgent'].map(p=><option key={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div className="modal-footer"><button type="button" className="btn btn-outline" onClick={()=>setShowModal(false)}>Cancel</button><button type="submit" className="btn btn-primary">Submit</button></div>
            </form>
          </motion.div>
        </div>
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   NURSE DASHBOARD
═══════════════════════════════════════════════════════════════ */
const NURSE_CHECKLIST = [
  'Morning medication round — all assigned patients',
  'Record vital signs (BP, temp, pulse, SpO2)',
  'Check IV lines & drip rates',
  'Wound dressing change as per chart',
  'Update nursing notes in patient records',
  'Confirm medication stock at nursing station',
  'Assist doctor during ward rounds',
  'Hand over shift to incoming nurse',
];
const NURSE_LOGS = [
  { value:'other', label:'🩺 Nursing Note / Observation' },
  { value:'supply_request', label:'💊 Supply / Medication Request' },
  { value:'maintenance_request', label:'🔧 Equipment Issue' },
];

export function NurseDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { tasks, schedules, leaves, checklist, logs, loading, toggleChecklist, markTaskDone, applyLeave, submitLog, deleteLog } = useStaffData(user?._id);
  const [patients, setPatients] = useState([]);
  const [allPatients, setAllPatients] = useState([]);
  const [showLeave, setShowLeave] = useState(false);
  const [doses, setDoses] = useState([]);
  const [dosesLoading, setDosesLoading] = useState(true);
  const [loggingKey, setLoggingKey] = useState(null);
  const [vitalsPatientId, setVitalsPatientId] = useState('');
  const [vitalsForm, setVitalsForm] = useState({ temperature:'', bpSystolic:'', bpDiastolic:'', heartRate:'', respiratoryRate:'', spo2:'', bloodGlucose:'' });
  const [recentVitals, setRecentVitals] = useState([]);
  const [savingVitals, setSavingVitals] = useState(false);
  const [nurseCalls, setNurseCalls] = useState([]);
  const [respondingCallId, setRespondingCallId] = useState(null);

  const loadDoses = () => {
    setDosesLoading(true);
    medicationAPI.getTodayDue().then(r => setDoses(r.data.data || [])).catch(()=>{}).finally(()=>setDosesLoading(false));
  };

  useEffect(() => {
    appointmentsAPI.getAll({ status:'confirmed', limit:20 }).then(r=>setPatients(r.data.data||[])).catch(()=>{});
    // The vitals picker needs every patient a nurse might be caring for,
    // not just today's confirmed OPD bookings (which is often empty —
    // admitted/ward patients usually don't have a "confirmed appointment"
    // at all), so it's fed from the real patient roster instead.
    usersAPI.getAll({ role:'patient', status:'approved', limit:200 }).then(r=>setAllPatients(r.data.data||[])).catch(()=>{});
    loadDoses();
    loadNurseCalls();
    const socket = getSocket();
    if (!socket) return;
    const onAssigned = (d) => {
      toast.success(`💊 ${d.assignedBy} assigned you a medication for ${d.patientName} (${d.medicineName})`, { duration: 8000 });
      loadDoses();
    };
    socket.on('medication_assigned', onAssigned);
    const onNurseCall = (d) => {
      toast(`🔔 ${d.patientName} — ${d.location}${d.reason ? `: ${d.reason}` : ''}`, { duration: 9000, icon: '🔔' });
      loadNurseCalls();
    };
    const onNurseCallUpdated = () => loadNurseCalls();
    socket.on('nurse_call', onNurseCall);
    socket.on('nurse_call_updated', onNurseCallUpdated);
    return () => { socket.off('medication_assigned', onAssigned); socket.off('nurse_call', onNurseCall); socket.off('nurse_call_updated', onNurseCallUpdated); };
  }, []);

  const loadNurseCalls = () => nurseCallAPI.getActive().then(r => setNurseCalls(r.data.data || [])).catch(()=>{});

  const respondToCall = async (call) => {
    setRespondingCallId(call._id);
    try {
      if (call.status === 'active') await nurseCallAPI.acknowledge(call._id);
      else await nurseCallAPI.resolve(call._id);
      loadNurseCalls();
    } catch { toast.error('Failed to update call'); }
    setRespondingCallId(null);
  };

  const logDose = async (dose, status) => {
    const key = `${dose.scheduleId}_${dose.doseTime}`;
    setLoggingKey(key);
    try {
      await medicationAPI.logDose(dose.scheduleId, dose.doseTime, status);
      toast.success(status === 'given' ? '✅ Dose logged as given' : status === 'missed' ? 'Marked as missed' : 'Marked as refused');
      loadDoses();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed to log dose'); }
    setLoggingKey(null);
  };

  const duePending = doses.filter(d => d.status === 'pending' || d.status === 'overdue');
  const doneDoses = doses.filter(d => ['given','missed','refused'].includes(d.status));

  // De-duplicated patient list for the vitals picker, drawn from the real
  // patient roster (not today's confirmed appointments — that list is
  // often empty since most admitted/ward patients don't have one).
  const uniquePatients = React.useMemo(() => {
    const map = new Map();
    allPatients.forEach(p => { if (p?._id) map.set(p._id, p); });
    return [...map.values()];
  }, [allPatients]);

  useEffect(() => {
    if (!vitalsPatientId) { setRecentVitals([]); return; }
    wearableAPI.getForPatient(vitalsPatientId).then(r => setRecentVitals(r.data.data || [])).catch(() => setRecentVitals([]));
  }, [vitalsPatientId]);

  const submitVitals = async (e) => {
    e.preventDefault();
    if (!vitalsPatientId) { toast.error('Select a patient first'); return; }
    const hasAny = Object.values(vitalsForm).some(v => v !== '');
    if (!hasAny) { toast.error('Enter at least one vital reading'); return; }
    setSavingVitals(true);
    try {
      const res = await wearableAPI.recordForPatient(vitalsPatientId, vitalsForm);
      if (res.data.flagged) toast.error(`⚠️ Abnormal reading — the treating doctor has been notified: ${res.data.reasons?.[0]}`, { duration: 7000 });
      else toast.success('✅ Vitals recorded');
      setVitalsForm({ temperature:'', bpSystolic:'', bpDiastolic:'', heartRate:'', respiratoryRate:'', spo2:'', bloodGlucose:'' });
      const r2 = await wearableAPI.getForPatient(vitalsPatientId);
      setRecentVitals(r2.data.data || []);
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to save vitals'); }
    setSavingVitals(false);
  };

  const pending = tasks.filter(t=>t.status!=='completed'&&t.status!=='cancelled');
  return (
    <div>
      <div style={{ background:'linear-gradient(135deg,#be185dcc,#db2777)', borderRadius:16, padding:'20px 26px', marginBottom:20, color:'#fff' }}>
        <div style={{ fontSize:24, fontWeight:800 }}>💉 Nurse Dashboard</div>
        <div style={{ opacity:.85, fontSize:13, marginTop:4 }}>{user?.name} · {user?.department||'Nursing'} · {new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'})}</div>
        <div style={{ display:'flex', gap:8, marginTop:10, flexWrap:'wrap' }}>
          <span style={{ background:'rgba(255,255,255,.2)', borderRadius:20, padding:'3px 12px', fontSize:12, fontWeight:600 }}>📋 {pending.length} tasks</span>
          <span style={{ background:'rgba(255,255,255,.2)', borderRadius:20, padding:'3px 12px', fontSize:12, fontWeight:600 }}>🏥 {patients.length} active appointments</span>
        </div>
      </div>
      <div className="stat-grid">
        <StatCard icon="📋" value={pending.length} label="Pending Tasks" color="#fef3c7" />
        <StatCard icon="💊" value={duePending.length} label="Doses Due" color="#fef2f2" />
        <StatCard icon="🏥" value={patients.length} label="Active Patients" color="#eff6ff" />
        <StatCard icon="✓" value={`${Object.values(checklist).filter(Boolean).length}/${NURSE_CHECKLIST.length}`} label="Checklist" color="#fdf4ff" />
      </div>
      <div style={{ marginTop:14 }}><MyActivityWidget /></div>

      <motion.div className="card mt-2" initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }}>
        <div className="card-header"><span className="card-title">💊 Medication Administration — Today</span><span className="badge badge-warning">{duePending.length} due</span></div>
        <div className="card-body" style={{ maxHeight:340, overflowY:'auto' }}>
          {dosesLoading ? <div style={{ color:'#94a3b8', textAlign:'center' }}>Loading…</div>
          : doses.length === 0 ? <div style={{ color:'#94a3b8', textAlign:'center', padding:24 }}>No active medication schedules right now</div>
          : (<>
            {duePending.map(d => {
              const key = `${d.scheduleId}_${d.doseTime}`;
              return (
                <div key={key} style={{ padding:'10px 13px', background: d.status==='overdue' ? '#fef2f2' : '#fffbeb', borderRadius:9, marginBottom:7, borderLeft:`3px solid ${d.status==='overdue'?'#dc2626':'#f59e0b'}` }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:6 }}>
                    <div>
                      <div style={{ fontWeight:700, fontSize:12.5 }}>{d.patient?.name} — {d.medicineName} ({d.dosage})</div>
                      <div style={{ fontSize:11, color:'#64748b' }}>{d.route} · {d.isPRN ? 'As needed (PRN)' : `Due ${d.doseTime}`}{d.status==='overdue' && ' · ⚠️ Overdue'}</div>
                      {d.assignedNurse?.name && d.assignedNurse._id !== user?._id && <div style={{ fontSize:10.5, color:'#7c3aed' }}>👩‍⚕️ Assigned to {d.assignedNurse.name}</div>}
                      {d.assignedNurse?._id === user?._id && <div style={{ fontSize:10.5, color:'#059669', fontWeight:700 }}>👩‍⚕️ Assigned to you</div>}
                      {d.notes && <div style={{ fontSize:10.5, color:'#94a3b8' }}>{d.notes}</div>}
                    </div>
                    <div style={{ display:'flex', gap:5 }}>
                      <button className="btn btn-success btn-xs" disabled={loggingKey===key} onClick={()=>logDose(d,'given')}>✅ Given</button>
                      <button className="btn btn-outline btn-xs" disabled={loggingKey===key} onClick={()=>logDose(d,'refused')}>🚫 Refused</button>
                      <button className="btn btn-danger btn-xs" disabled={loggingKey===key} onClick={()=>logDose(d,'missed')}>❌ Missed</button>
                    </div>
                  </div>
                </div>
              );
            })}
            {duePending.length === 0 && <div style={{ color:'#059669', textAlign:'center', padding:12, fontSize:12.5 }}>✅ All due doses logged</div>}
            {doneDoses.length > 0 && (
              <details style={{ marginTop:10 }}>
                <summary style={{ fontSize:11.5, color:'#94a3b8', cursor:'pointer' }}>Already logged today ({doneDoses.length})</summary>
                {doneDoses.map(d => (
                  <div key={`${d.scheduleId}_${d.doseTime}`} style={{ fontSize:11.5, color:'#64748b', padding:'5px 0' }}>
                    {d.patient?.name} — {d.medicineName} · {d.doseTime} · <strong style={{color: d.status==='given'?'#059669':'#dc2626'}}>{d.status}</strong>
                  </div>
                ))}
              </details>
            )}
          </>)}
        </div>
      </motion.div>

      {/* Nurse Call queue — patients admitted to a ward can now summon a
          nurse; this is where those calls actually land. */}
      {nurseCalls.length > 0 && (
        <motion.div className="card mt-2" initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} style={{ borderLeft:'4px solid #dc2626' }}>
          <div className="card-header"><span className="card-title">🔔 Active Nurse Calls</span><span className="badge badge-danger">{nurseCalls.length}</span></div>
          <div className="card-body">
            {nurseCalls.map(c => (
              <div key={c._id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px', background: c.status==='active' ? '#fef2f2' : '#fffbeb', borderRadius:10, marginBottom:8, flexWrap:'wrap', gap:8 }}>
                <div>
                  <div style={{ fontWeight:700, fontSize:13.5 }}>{c.patient?.name}</div>
                  <div style={{ fontSize:12, color:'#64748b' }}>{c.room?.type} — Room {c.room?.number}, Floor {c.room?.floor}{c.reason ? ` · ${c.reason}` : ''}</div>
                  {c.status==='acknowledged' && <div style={{ fontSize:11.5, color:'#92400e', marginTop:2 }}>🩺 {c.acknowledgedBy?.name} is responding</div>}
                </div>
                <button className="btn btn-sm" style={{ background: c.status==='active' ? '#dc2626' : '#059669', color:'#fff' }} disabled={respondingCallId===c._id} onClick={()=>respondToCall(c)}>
                  {respondingCallId===c._id ? '…' : c.status==='active' ? '🩺 I\'m responding' : '✅ Resolve'}
                </button>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Bedside vitals — the one thing every nursing station needs that
          wasn't anywhere in the system before (wearables cover patients'
          own devices, but ward patients need manual readings too). */}
      <motion.div className="card mt-2" initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }}>
        <div className="card-header"><span className="card-title">🩺 Record Patient Vitals</span></div>
        <div className="card-body">
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
            <div>
              <select className="form-input" value={vitalsPatientId} onChange={e=>setVitalsPatientId(e.target.value)} style={{ marginBottom:10 }}>
                <option value="">— Select a patient —</option>
                {uniquePatients.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
              </select>
              {vitalsPatientId && (
                <form onSubmit={submitVitals}>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
                    <input className="form-input" type="number" step="0.1" placeholder="Temp (°F)" value={vitalsForm.temperature} onChange={e=>setVitalsForm(f=>({...f,temperature:e.target.value}))} />
                    <input className="form-input" type="number" placeholder="Pulse (bpm)" value={vitalsForm.heartRate} onChange={e=>setVitalsForm(f=>({...f,heartRate:e.target.value}))} />
                    <input className="form-input" type="number" placeholder="BP Systolic" value={vitalsForm.bpSystolic} onChange={e=>setVitalsForm(f=>({...f,bpSystolic:e.target.value}))} />
                    <input className="form-input" type="number" placeholder="BP Diastolic" value={vitalsForm.bpDiastolic} onChange={e=>setVitalsForm(f=>({...f,bpDiastolic:e.target.value}))} />
                    <input className="form-input" type="number" placeholder="Resp. Rate /min" value={vitalsForm.respiratoryRate} onChange={e=>setVitalsForm(f=>({...f,respiratoryRate:e.target.value}))} />
                    <input className="form-input" type="number" placeholder="SpO2 %" value={vitalsForm.spo2} onChange={e=>setVitalsForm(f=>({...f,spo2:e.target.value}))} />
                    <input className="form-input" type="number" placeholder="Blood Glucose mg/dL" value={vitalsForm.bloodGlucose} onChange={e=>setVitalsForm(f=>({...f,bloodGlucose:e.target.value}))} style={{ gridColumn:'1/-1' }} />
                  </div>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={savingVitals}>{savingVitals?'Saving…':'✅ Save Vitals'}</button>
                </form>
              )}
            </div>
            <div>
              <div style={{ fontSize:11.5, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:.4, marginBottom:8 }}>Recent Readings</div>
              {!vitalsPatientId ? (
                <div style={{ color:'#94a3b8', fontSize:12.5, padding:10 }}>Select a patient to see their vitals history.</div>
              ) : recentVitals.length === 0 ? (
                <div style={{ color:'#94a3b8', fontSize:12.5, padding:10 }}>No vitals recorded for this patient yet.</div>
              ) : (
                <div style={{ maxHeight:220, overflowY:'auto' }}>
                  {recentVitals.map(v => (
                    <div key={v._id} style={{ padding:'8px 10px', background: v.flagged ? '#fef2f2' : '#f8fafc', borderLeft:`3px solid ${v.flagged?'#dc2626':'#db2777'}`, borderRadius:8, marginBottom:6 }}>
                      <div style={{ fontSize:11, color:'#94a3b8' }}>{new Date(v.date).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})} · {v.source==='nurse'?'Nurse entry':v.source}</div>
                      <div style={{ fontSize:12, color:'#374151', marginTop:2 }}>
                        {[v.temperature!=null&&`🌡️${v.temperature}°F`, v.bpSystolic!=null&&`🩸${v.bpSystolic}/${v.bpDiastolic}`, v.heartRate!=null&&`💓${v.heartRate}bpm`, v.spo2!=null&&`🫁${v.spo2}%`, v.respiratoryRate!=null&&`🌬️${v.respiratoryRate}/min`, v.bloodGlucose!=null&&`🍬${v.bloodGlucose}mg/dL`].filter(Boolean).join('  ·  ')}
                      </div>
                      {v.flagged && <div style={{ fontSize:11, color:'#dc2626', fontWeight:700, marginTop:3 }}>⚠️ {v.flagReasons?.[0]}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      <div className="grid-2 mt-2">
        <motion.div className="card" initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }}>
          <div className="card-header"><span className="card-title">📋 Assigned Tasks</span><span className="badge badge-warning">{pending.length}</span></div>
          <div className="card-body" style={{ maxHeight:300, overflowY:'auto' }}>
            {loading ? <div style={{ color:'#94a3b8', textAlign:'center' }}>Loading…</div>
            : tasks.length===0 ? <div style={{ color:'#94a3b8', textAlign:'center', padding:24 }}>🎉 No tasks assigned</div>
            : tasks.map(t=><TaskItem key={t._id} t={t} onDone={markTaskDone}/>)}
          </div>
        </motion.div>
        <ChecklistBox items={NURSE_CHECKLIST} checklist={checklist} onToggle={toggleChecklist} accentColor="#db2777" />
        <ScheduleCard schedules={schedules} />
        <LeaveCard leaves={leaves} onApply={()=>setShowLeave(true)} />
        <div style={{ gridColumn:'1/-1' }}>
          <LogPanel logs={logs} title="📝 Nursing Notes & Requests" logTypes={NURSE_LOGS} onNew={submitLog} onDelete={deleteLog} accentColor="#db2777" />
        </div>
      </div>
      <div className="mt-2" style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
        <button className="btn btn-outline btn-sm" onClick={()=>navigate('/appointments')}>📅 Appointments</button>
        <button className="btn btn-outline btn-sm" onClick={()=>navigate('/emergency')}>🚨 Emergency</button>
        <button className="btn btn-outline btn-sm" onClick={()=>navigate('/notice-board')}>📢 Notices</button>
        <button className="btn btn-outline btn-sm" onClick={()=>navigate('/salary')}>💰 Salary</button>
      </div>
      <LeaveModal show={showLeave} onClose={()=>setShowLeave(false)} onSubmit={async f=>{ await applyLeave(f); setShowLeave(false); }} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PHARMACIST DASHBOARD
═══════════════════════════════════════════════════════════════ */
const PHARM_CHECKLIST = [
  'Dispense morning prescriptions',
  'Check expiry dates of slow-moving stock',
  'Update stock levels in system',
  'Verify controlled drugs count',
  'Counsel patients on new prescriptions',
  'Raise reorder for low-stock medicines',
  'Verify cold-chain medicines in refrigerator',
  'Reconcile end-of-day billing',
];
const PHARM_LOGS = [
  { value:'supply_request', label:'📦 Stock Reorder Request' },
  { value:'other', label:'📝 Pharmacy Note' },
  { value:'maintenance_request', label:'🔧 Equipment Issue' },
];

export function PharmacistDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { tasks, schedules, leaves, checklist, logs, loading, toggleChecklist, markTaskDone, applyLeave, submitLog, deleteLog } = useStaffData(user?._id);
  const [medicines, setMedicines] = useState([]);
  const [orders, setOrders] = useState([]);
  const [showLeave, setShowLeave] = useState(false);

  useEffect(() => {
    medicinesAPI.getAll().then(r=>setMedicines(r.data.data||[])).catch(()=>{});
    ordersAPI.getAll({ status:'processing' }).then(r=>setOrders(r.data.data||[])).catch(()=>{});
  }, []);

  const pending = tasks.filter(t=>t.status!=='completed'&&t.status!=='cancelled');
  const lowStock = medicines.filter(m=>m.stock<=m.reorderLevel);
  const nearExpiry = medicines.filter(m => m.expiryDate && (new Date(m.expiryDate) - new Date()) / (1000*60*60*24) <= 60)
    .sort((a,b) => new Date(a.expiryDate) - new Date(b.expiryDate));
  return (
    <div>
      <div style={{ background:'linear-gradient(135deg,#b45309cc,#d97706)', borderRadius:16, padding:'20px 26px', marginBottom:20, color:'#fff' }}>
        <div style={{ fontSize:24, fontWeight:800 }}>💊 Pharmacist Dashboard</div>
        <div style={{ opacity:.85, fontSize:13, marginTop:4 }}>{user?.name} · {user?.department||'Pharmacy'} · {new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'})}</div>
        <div style={{ display:'flex', gap:8, marginTop:10, flexWrap:'wrap' }}>
          <span style={{ background:'rgba(255,255,255,.2)', borderRadius:20, padding:'3px 12px', fontSize:12, fontWeight:600 }}>💊 {medicines.length} medicines</span>
          {lowStock.length>0 && <span style={{ background:'rgba(239,68,68,.35)', borderRadius:20, padding:'3px 12px', fontSize:12, fontWeight:600 }}>⚠️ {lowStock.length} low stock</span>}
          {nearExpiry.length>0 && <span style={{ background:'rgba(234,88,12,.35)', borderRadius:20, padding:'3px 12px', fontSize:12, fontWeight:600 }}>⏳ {nearExpiry.length} expiring soon</span>}
          <span style={{ background:'rgba(255,255,255,.2)', borderRadius:20, padding:'3px 12px', fontSize:12, fontWeight:600 }}>📦 {orders.length} pending orders</span>
        </div>
      </div>
      <div className="stat-grid">
        <StatCard icon="💊" value={medicines.length} label="Total Medicines" color="#fef3c7" />
        <StatCard icon="⚠️" value={lowStock.length} label="Low Stock" color="#fef2f2" />
        <StatCard icon="📦" value={orders.length} label="Pending Orders" color="#eff6ff" />
        <StatCard icon="📋" value={pending.length} label="My Tasks" color="#f5f3ff" />
      </div>
      <div style={{ marginTop:14 }}><MyActivityWidget /></div>

      <div className="grid-2 mt-2">
        <motion.div className="card" initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }}>
          <div className="card-header"><span className="card-title">⚠️ Low Stock Alerts</span><button className="btn btn-outline btn-xs" onClick={()=>navigate('/pharmacy')}>View All</button></div>
          <div className="card-body" style={{ maxHeight:280, overflowY:'auto' }}>
            {lowStock.length===0 ? <div style={{ color:'#94a3b8', textAlign:'center', padding:20 }}>✅ All medicines adequately stocked</div>
            : lowStock.map(m=>(
              <div key={m._id} style={{ display:'flex', justifyContent:'space-between', padding:'9px 0', borderBottom:'1px solid #f1f5f9', fontSize:13 }}>
                <div><div style={{ fontWeight:700 }}>{m.name}</div><div style={{ fontSize:11, color:'#94a3b8' }}>{m.category}</div></div>
                <div style={{ textAlign:'right' }}>
                  <span style={{ fontWeight:800, color:'#dc2626' }}>{m.stock}</span>
                  <span style={{ color:'#94a3b8', fontSize:11 }}> / {m.reorderLevel} min</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
        <motion.div className="card" initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ delay:.1 }}>
          <div className="card-header"><span className="card-title">📦 Pending Orders</span><button className="btn btn-outline btn-xs" onClick={()=>navigate('/orders')}>Manage</button></div>
          <div className="card-body" style={{ maxHeight:280, overflowY:'auto' }}>
            {orders.length===0 ? <div style={{ color:'#94a3b8', textAlign:'center', padding:20 }}>No pending orders</div>
            : orders.map(o=>(
              <div key={o._id} style={{ padding:'8px 0', borderBottom:'1px solid #f1f5f9', fontSize:13 }}>
                <div style={{ fontWeight:700 }}>Order #{o.orderNumber}</div>
                <div style={{ fontSize:11.5, color:'#64748b' }}>{o.patient?.name} · {o.items?.length} item{o.items?.length!==1?'s':''} · ₹{o.totalAmount?.toLocaleString('en-IN')}</div>
              </div>
            ))}
          </div>
        </motion.div>
        <ChecklistBox items={PHARM_CHECKLIST} checklist={checklist} onToggle={toggleChecklist} accentColor="#d97706" />
        <ScheduleCard schedules={schedules} />
        <LeaveCard leaves={leaves} onApply={()=>setShowLeave(true)} />
        <LogPanel logs={logs} title="📝 Pharmacy Logs & Requests" logTypes={PHARM_LOGS} onNew={submitLog} onDelete={deleteLog} accentColor="#d97706" />
        <div style={{ gridColumn:'1/-1' }}>
          <motion.div className="card" initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} style={{ borderLeft:'4px solid #ea580c' }}>
            <div className="card-header"><span className="card-title">⏳ Near-Expiry Medicines (next 60 days)</span><span className="badge badge-warning">{nearExpiry.length}</span></div>
            <div className="card-body" style={{ maxHeight:260, overflowY:'auto' }}>
              {nearExpiry.length===0 ? <div style={{ color:'#94a3b8', textAlign:'center', padding:20 }}>✅ Nothing expiring soon</div>
              : nearExpiry.map(m => {
                const daysLeft = Math.ceil((new Date(m.expiryDate) - new Date()) / (1000*60*60*24));
                return (
                  <div key={m._id} style={{ display:'flex', justifyContent:'space-between', padding:'9px 0', borderBottom:'1px solid #f1f5f9', fontSize:13 }}>
                    <div><div style={{ fontWeight:700 }}>{m.name}</div><div style={{ fontSize:11, color:'#94a3b8' }}>Batch {m.batchNumber || '—'} · Stock {m.stock}</div></div>
                    <div style={{ textAlign:'right' }}>
                      <span style={{ fontWeight:800, color: daysLeft<=14 ? '#dc2626' : '#ea580c' }}>{daysLeft <= 0 ? 'EXPIRED' : `${daysLeft}d left`}</span>
                      <div style={{ fontSize:10.5, color:'#94a3b8' }}>{new Date(m.expiryDate).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </div>
      </div>
      <div className="mt-2" style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
        <button className="btn btn-outline btn-sm" onClick={()=>navigate('/pharmacy')}>💊 Pharmacy</button>
        <button className="btn btn-outline btn-sm" onClick={()=>navigate('/orders')}>📦 Orders</button>
        <button className="btn btn-outline btn-sm" onClick={()=>navigate('/inventory')}>📋 Request from Central Store</button>
        <button className="btn btn-outline btn-sm" onClick={()=>navigate('/notice-board')}>📢 Notices</button>
        <button className="btn btn-outline btn-sm" onClick={()=>navigate('/salary')}>💰 Salary</button>
      </div>
      <LeaveModal show={showLeave} onClose={()=>setShowLeave(false)} onSubmit={async f=>{ await applyLeave(f); setShowLeave(false); }} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   IT TECHNICIAN DASHBOARD
═══════════════════════════════════════════════════════════════ */
const IT_CHECKLIST = [
  'Server health & uptime check',
  'Network connectivity — all departments',
  'Backup verification & status',
  'Antivirus / EDR updates',
  'CCTV feed check & recording',
  'EMR system performance check',
  'Printer / scanner maintenance',
  'IT helpdesk ticket review',
];
const IT_LOGS = [
  { value:'maintenance_request', label:'🔧 IT Issue / Ticket' },
  { value:'other', label:'📝 IT Log Entry' },
  { value:'supply_request', label:'📦 Hardware Request' },
];

export function ITTechDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { tasks, schedules, leaves, checklist, logs, loading, toggleChecklist, markTaskDone, applyLeave, submitLog, deleteLog } = useStaffData(user?._id);
  const [showLeave, setShowLeave] = useState(false);
  const [health, setHealth] = useState(null);
  const [maintRequests, setMaintRequests] = useState([]);
  const [claimingId, setClaimingId] = useState(null);
  const [itAssets, setItAssets] = useState([]);
  const [itAssetsLoading, setItAssetsLoading] = useState(true);
  const [assetCheckoutFor, setAssetCheckoutFor] = useState(null);
  const [assetLocation, setAssetLocation] = useState('');
  const [checkingOutAsset, setCheckingOutAsset] = useState(false);

  const loadItAssets = () => {
    setItAssetsLoading(true);
    assetsAPI.getAll({ type: 'it_hardware' }).then(r => setItAssets(r.data.data || [])).catch(()=>{}).finally(()=>setItAssetsLoading(false));
  };

  const checkinItAsset = async (asset) => {
    try { await assetsAPI.checkin(asset._id); toast.success(`${asset.name} returned to store`); loadItAssets(); }
    catch (e) { toast.error(e.response?.data?.error || 'Failed to check in'); }
  };

  const submitAssetCheckout = async () => {
    if (!assetLocation.trim()) { toast.error('Enter where this is being deployed'); return; }
    setCheckingOutAsset(true);
    try {
      await assetsAPI.checkout(assetCheckoutFor._id, assetLocation.trim(), assetLocation.trim());
      toast.success(`✅ ${assetCheckoutFor.name} assigned to you`);
      setAssetCheckoutFor(null); setAssetLocation('');
      loadItAssets();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed to check out'); }
    setCheckingOutAsset(false);
  };

  const loadMaintRequests = () => maintenanceRequestAPI.getAll({ category:'it' }).then(r => setMaintRequests(r.data.data || [])).catch(()=>{});

  useEffect(() => {
    // Real process/DB metrics — this used to be a hardcoded fake array
    // that never changed no matter what was actually happening server-side.
    const loadHealth = () => systemAPI.getHealth().then(r => setHealth(r.data.data)).catch(()=>{});
    loadHealth();
    const healthTimer = setInterval(loadHealth, 15000);
    loadMaintRequests();
    loadItAssets();
    const socket = getSocket();
    let onNew;
    if (socket) {
      onNew = (d) => { if (d.category === 'it') { toast(`🛠️ New IT ticket — ${d.location}`, { icon:'💻' }); loadMaintRequests(); } };
      socket.on('maintenance_request_created', onNew);
    }
    return () => { clearInterval(healthTimer); if (socket && onNew) socket.off('maintenance_request_created', onNew); };
  }, []);

  const claimRequest = async (id) => {
    setClaimingId(id);
    try { await maintenanceRequestAPI.claim(id); loadMaintRequests(); toast.success('✅ Claimed'); }
    catch (e) { toast.error(e.response?.data?.error || 'Failed to claim'); }
    setClaimingId(null);
  };
  const resolveRequest = async (id) => {
    const notes = window.prompt('Resolution notes (optional):', '') || '';
    setClaimingId(id);
    try { await maintenanceRequestAPI.resolve(id, notes); loadMaintRequests(); toast.success('✅ Resolved'); }
    catch (e) { toast.error(e.response?.data?.error || 'Failed to resolve'); }
    setClaimingId(null);
  };

  const pending = tasks.filter(t=>t.status!=='completed'&&t.status!=='cancelled');
  const openLogs = logs.filter(l=>l.status!=='resolved');
  const openMaintRequests = maintRequests.filter(r=>r.status!=='resolved');
  return (
    <div>
      <div style={{ background:'linear-gradient(135deg,#4338cacc,#6366f1)', borderRadius:16, padding:'20px 26px', marginBottom:20, color:'#fff' }}>
        <div style={{ fontSize:24, fontWeight:800 }}>💻 IT Technician Dashboard</div>
        <div style={{ opacity:.85, fontSize:13, marginTop:4 }}>{user?.name} · {user?.department||'IT Department'} · {new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'})}</div>
        <div style={{ display:'flex', gap:8, marginTop:10, flexWrap:'wrap' }}>
          <span style={{ background:'rgba(255,255,255,.2)', borderRadius:20, padding:'3px 12px', fontSize:12, fontWeight:600 }}>🖥️ Server {health ? 'online' : '…'} · DB {health?.database?.status || '…'}</span>
          {openLogs.length>0 && <span style={{ background:'rgba(239,68,68,.35)', borderRadius:20, padding:'3px 12px', fontSize:12, fontWeight:600 }}>🎫 {openLogs.length} open tickets</span>}
          {openMaintRequests.length>0 && <span style={{ background:'rgba(239,68,68,.35)', borderRadius:20, padding:'3px 12px', fontSize:12, fontWeight:700 }}>🛠️ {openMaintRequests.length} reported issue{openMaintRequests.length!==1?'s':''}</span>}
        </div>
      </div>
      <div className="stat-grid">
        <StatCard icon="🖥️" value={health?.database?.status === 'connected' ? 'Healthy' : '…'} label="Server Status" color="#eff6ff" />
        <StatCard icon="🎫" value={openLogs.length} label="Open Tickets" color="#fef3c7" />
        <StatCard icon="📋" value={pending.length} label="My Tasks" color="#f5f3ff" />
        <StatCard icon="✅" value={tasks.filter(t=>t.status==='completed').length} label="Resolved Today" color="#f0fdf4" />
      </div>
      <div style={{ marginTop:14 }}><MyActivityWidget /></div>

      <div className="grid-2 mt-2">
        <motion.div className="card" initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }}>
          <div className="card-header"><span className="card-title">🖥️ System Health</span><span className="text-xs text-muted">Live · refreshes every 15s</span></div>
          <div className="card-body">
            {!health ? <div style={{ color:'#94a3b8', textAlign:'center', padding:20 }}>Loading…</div> : (
              <>
                {[
                  ['Database', health.database.status === 'connected' ? 'Connected' : health.database.status, health.database.status === 'connected'],
                  ['Server Uptime', `${Math.floor(health.uptimeSeconds/3600)}h ${Math.floor((health.uptimeSeconds%3600)/60)}m`, true],
                  ['Memory (Heap)', `${health.memory.heapUsedMB} MB / ${health.memory.heapTotalMB} MB`, health.memory.heapUsedMB < health.memory.heapTotalMB*0.9],
                  ['Memory (RSS)', `${health.memory.rssMB} MB`, true],
                  ['Node.js Version', health.nodeVersion, true],
                  ['Live Connections', health.realtime.connectedClients ?? '—', true],
                ].map(([label, val, ok]) => (
                  <div key={label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px solid #f1f5f9' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <div style={{ width:8, height:8, borderRadius:'50%', background: ok ? '#22c55e' : '#ef4444', flexShrink:0 }}/>
                      <span style={{ fontWeight:600, fontSize:13 }}>{label}</span>
                    </div>
                    <div style={{ fontSize:11.5, color:'#64748b' }}>{val}</div>
                  </div>
                ))}
                <div style={{ fontSize:10.5, color:'#94a3b8', marginTop:10, textAlign:'center' }}>Server time: {health.serverTime ? new Date(health.serverTime).toLocaleString('en-IN') : '—'}</div>
              </>
            )}
          </div>
        </motion.div>
        <ChecklistBox items={IT_CHECKLIST} checklist={checklist} onToggle={toggleChecklist} accentColor="#6366f1" />
        <motion.div className="card" initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ delay:.12 }}>
          <div className="card-header"><span className="card-title">📋 Assigned Tasks</span><span className="badge badge-warning">{pending.length}</span></div>
          <div className="card-body" style={{ maxHeight:250, overflowY:'auto' }}>
            {loading ? <div style={{ color:'#94a3b8', textAlign:'center' }}>Loading…</div>
            : tasks.length===0 ? <div style={{ color:'#94a3b8', textAlign:'center', padding:20 }}>No tasks</div>
            : tasks.map(t=><TaskItem key={t._id} t={t} onDone={markTaskDone}/>)}
          </div>
        </motion.div>
        <ScheduleCard schedules={schedules} />
        <LeaveCard leaves={leaves} onApply={()=>setShowLeave(true)} />
        <div style={{ gridColumn:'1/-1' }}>
          <motion.div className="card" initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} style={{ borderLeft:'4px solid #6366f1' }}>
            <div className="card-header"><span className="card-title">💻 IT Hardware Assets</span><span className="badge">{itAssets.filter(a=>a.status==='available').length} available</span></div>
            <div className="card-body" style={{ maxHeight:260, overflowY:'auto' }}>
              {itAssetsLoading ? <div style={{ color:'#94a3b8', textAlign:'center', padding:16 }}>Loading…</div>
              : itAssets.length === 0 ? <div style={{ color:'#94a3b8', textAlign:'center', padding:16, fontSize:12.5 }}>No IT hardware registered yet — ask admin to add some under Assets.</div>
              : itAssets.map(a => {
                const mine = a.assignedTo && (a.assignedTo._id === user?._id || a.assignedTo === user?._id);
                return (
                  <div key={a._id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'9px 12px', background: a.status==='available'?'#f0fdf4':'#fffbeb', borderRadius:9, marginBottom:6, flexWrap:'wrap', gap:8 }}>
                    <div>
                      <div style={{ fontWeight:700, fontSize:12.5 }}>{a.name}</div>
                      <div style={{ fontSize:11, color:'#94a3b8' }}>📍 {a.currentLocation}{a.assignedNote ? ` · ${a.assignedNote}` : ''}{a.assignedTo?.name ? ` · with ${a.assignedTo.name}` : ''}</div>
                    </div>
                    {a.status === 'available' ? (
                      <button className="btn btn-outline btn-xs" onClick={()=>{ setAssetCheckoutFor(a); setAssetLocation(''); }}>Deploy</button>
                    ) : mine ? (
                      <button className="btn btn-primary btn-xs" onClick={()=>checkinItAsset(a)}>Return to Store</button>
                    ) : (
                      <span className="badge badge-warning" style={{ fontSize:10 }}>In use</span>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        </div>
        <div style={{ gridColumn:'1/-1' }}>
          <motion.div className="card" initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} style={{ borderLeft:'4px solid #6366f1' }}>
            <div className="card-header"><span className="card-title">🛠️ Reported IT Issues (from staff)</span><span className="badge badge-warning">{openMaintRequests.length} open</span></div>
            <div className="card-body" style={{ maxHeight:260, overflowY:'auto' }}>
              {maintRequests.length===0 ? <div style={{ color:'#94a3b8', textAlign:'center', padding:20 }}>No issues reported yet.</div> : maintRequests.map(r => (
                <div key={r._id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 12px', background: r.status==='resolved' ? '#f0fdf4' : '#f8fafc', borderRadius:9, marginBottom:7, flexWrap:'wrap', gap:8 }}>
                  <div>
                    <div style={{ fontWeight:700, fontSize:12.5 }}>{r.location} <span style={{ fontWeight:600, color: r.priority==='urgent'?'#dc2626':'#94a3b8', fontSize:10.5, textTransform:'uppercase', marginLeft:6 }}>{r.priority}</span></div>
                    <div style={{ fontSize:12, color:'#374151', marginTop:2 }}>{r.description}</div>
                    <div style={{ fontSize:10.5, color:'#94a3b8', marginTop:2 }}>Reported by {r.reportedBy?.name} ({r.reportedBy?.role}) · {new Date(r.createdAt).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</div>
                  </div>
                  {r.status==='open' && <button className="btn btn-primary btn-xs" disabled={claimingId===r._id} onClick={()=>claimRequest(r._id)}>Claim</button>}
                  {r.status==='claimed' && <button className="btn btn-success btn-xs" disabled={claimingId===r._id} onClick={()=>resolveRequest(r._id)}>✅ Resolve</button>}
                  {r.status==='resolved' && <span className="badge badge-success" style={{ fontSize:10 }}>Resolved</span>}
                </div>
              ))}
            </div>
          </motion.div>
        </div>
        <div style={{ gridColumn:'1/-1' }}>
          <LogPanel logs={logs} title="🎫 IT Helpdesk Tickets" logTypes={IT_LOGS} onNew={submitLog} onDelete={deleteLog} accentColor="#6366f1" />
        </div>
      </div>
      <div className="mt-2" style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
        <button className="btn btn-outline btn-sm" onClick={()=>navigate('/notice-board')}>📢 Notices</button>
        <button className="btn btn-outline btn-sm" onClick={()=>navigate('/salary')}>💰 Salary</button>
      </div>
      <LeaveModal show={showLeave} onClose={()=>setShowLeave(false)} onSubmit={async f=>{ await applyLeave(f); setShowLeave(false); }} />
      {assetCheckoutFor && (
        <div className="modal-overlay" onClick={e=>{ if(e.target===e.currentTarget) setAssetCheckoutFor(null); }}>
          <motion.div className="modal-box" initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }}>
            <div className="modal-header"><span className="modal-title">💻 Deploy — {assetCheckoutFor.name}</span><button className="btn btn-ghost btn-icon" onClick={()=>setAssetCheckoutFor(null)}>✕</button></div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Deploying to *</label>
                <input className="form-input" required value={assetLocation} onChange={e=>setAssetLocation(e.target.value)} placeholder="e.g. Reception desk 2, Dr. Sharma's cabin" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={()=>setAssetCheckoutFor(null)}>Cancel</button>
              <button className="btn btn-primary" disabled={checkingOutAsset} onClick={submitAssetCheckout}>{checkingOutAsset ? 'Deploying…' : '✓ Deploy'}</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   AMBULANCE DRIVER DASHBOARD
═══════════════════════════════════════════════════════════════ */
const AMB_CHECKLIST = [
  'Fuel level — full before shift',
  'Engine oil & coolant check',
  'Oxygen cylinder pressure check',
  'Defibrillator battery status',
  'First aid kit inventory',
  'Stretcher & straps inspection',
  'GPS tracker & radio working',
  'Log mileage in transport logbook',
];
const AMB_LOGS = [
  { value:'transport_request', label:'🚑 Transport Trip Log' },
  { value:'maintenance_request', label:'🔧 Vehicle Issue Report' },
  { value:'other', label:'📝 Other Log' },
];

export function AmbulanceDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { tasks, schedules, leaves, checklist, logs, loading, toggleChecklist, markTaskDone, applyLeave, submitLog, deleteLog } = useStaffData(user?._id);
  const [showLeave, setShowLeave] = useState(false);
  const [trips, setTrips] = useState([]);
  const [tripsLoading, setTripsLoading] = useState(true);
  const [showLogTrip, setShowLogTrip] = useState(false);
  const [tripForm, setTripForm] = useState({ from:'', to:'', purpose:'', patientName:'', scheduledTime:'' });
  const [submittingTrip, setSubmittingTrip] = useState(false);
  const [completingId, setCompletingId] = useState(null);

  const loadTrips = useCallback(() => {
    ambulanceTripsAPI.getAll()
      .then(res => setTrips(res.data?.data || []))
      .catch(() => toast.error('Failed to load trips'))
      .finally(() => setTripsLoading(false));
  }, []);
  useEffect(() => { loadTrips(); }, [loadTrips]);

  const pending = tasks.filter(t=>t.status!=='completed'&&t.status!=='cancelled');
  const totalTrips = logs.filter(l=>l.category==='transport_request').length;
  const completedTripsToday = trips.filter(t=>t.status==='completed').length;

  const logNewTrip = async (e) => {
    e.preventDefault();
    if (!tripForm.from.trim() || !tripForm.to.trim()) { toast.error('Pickup and destination are required'); return; }
    setSubmittingTrip(true);
    try {
      await ambulanceTripsAPI.create(tripForm);
      toast.success('✅ Trip logged!');
      setShowLogTrip(false);
      setTripForm({ from:'', to:'', purpose:'', patientName:'', scheduledTime:'' });
      loadTrips();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed to log trip'); }
    setSubmittingTrip(false);
  };

  const completeTrip = async (id) => {
    setCompletingId(id);
    try {
      await ambulanceTripsAPI.update(id, { status:'completed' });
      toast.success('✅ Trip marked complete!');
      loadTrips();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed to complete trip'); }
    setCompletingId(null);
  };

  const cancelTrip = async (id) => {
    try { await ambulanceTripsAPI.update(id, { status:'cancelled' }); toast.success('Trip cancelled'); loadTrips(); }
    catch { toast.error('Failed to cancel trip'); }
  };

  const [acceptingId, setAcceptingId] = useState(null);
  const [progressingId, setProgressingId] = useState(null);

  const acceptRequest = async (id) => {
    setAcceptingId(id);
    try { await ambulanceTripsAPI.accept(id); toast.success('🚑 Trip accepted — patient notified'); loadTrips(); }
    catch (e) { toast.error(e.response?.data?.error || 'Someone else already accepted this request'); loadTrips(); }
    setAcceptingId(null);
  };

  const advanceTrip = async (id, status) => {
    setProgressingId(id);
    try { await ambulanceTripsAPI.updateProgress(id, status); loadTrips(); }
    catch (e) { toast.error(e.response?.data?.error || 'Failed to update'); }
    setProgressingId(null);
  };

  const openRequests = trips.filter(t => t.status === 'requested');
  const myActiveTrips = trips.filter(t => ['dispatched','en_route','arrived'].includes(t.status) && t.driver && (t.driver._id === user?._id || t.driver === user?._id));

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onRequested = () => loadTrips();
    socket.on('ambulance_requested', onRequested);
    return () => socket.off('ambulance_requested', onRequested);
  }, [loadTrips]);

  return (
    <div>
      <div style={{ background:'linear-gradient(135deg,#b91c1ccc,#dc2626)', borderRadius:16, padding:'20px 26px', marginBottom:20, color:'#fff' }}>
        <div style={{ fontSize:24, fontWeight:800 }}>🚑 Ambulance Driver Dashboard</div>
        <div style={{ opacity:.85, fontSize:13, marginTop:4 }}>{user?.name} · {user?.department||'Transport'} · {new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'})}</div>
        <div style={{ display:'flex', gap:8, marginTop:10, flexWrap:'wrap' }}>
          <span style={{ background:'rgba(255,255,255,.2)', borderRadius:20, padding:'3px 12px', fontSize:12, fontWeight:600 }}>🚑 {trips.length} trip{trips.length===1?'':'s'} today</span>
          <span style={{ background:'rgba(255,255,255,.2)', borderRadius:20, padding:'3px 12px', fontSize:12, fontWeight:600 }}>📋 {totalTrips} logged trips</span>
        </div>
      </div>
      <div className="stat-grid">
        <StatCard icon="🚑" value={trips.length} label="Today's Trips" color="#fef2f2" />
        <StatCard icon="✅" value={completedTripsToday} label="Completed" color="#f0fdf4" />
        <StatCard icon="📋" value={pending.length} label="My Tasks" color="#fffbeb" />
        <StatCard icon="📝" value={totalTrips} label="Total Logged Trips" color="#eff6ff" />
      </div>
      <div style={{ marginTop:14 }}><MyActivityWidget /></div>

      {openRequests.length > 0 && (
        <motion.div className="card mt-2" initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} style={{ border:'1px solid #fecaca' }}>
          <div className="card-header"><span className="card-title">🆘 Open Pickup Requests ({openRequests.length})</span></div>
          <div className="card-body">
            {openRequests.map(t => (
              <div key={t._id} style={{ padding:'11px 14px', background: t.isEmergency ? '#fef2f2' : '#fffbeb', borderRadius:10, borderLeft:`3px solid ${t.isEmergency?'#dc2626':'#f59e0b'}`, marginBottom:8 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontWeight:800, fontSize:13, color: t.isEmergency?'#dc2626':'#0f172a' }}>{t.isEmergency && '🚨 EMERGENCY — '}{t.patientName}</span>
                  <span style={{ fontSize:11, color:'#94a3b8' }}>{new Date(t.createdAt).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</span>
                </div>
                <div style={{ fontSize:12.5, color:'#374151', marginTop:4 }}>📍 {t.from} → {t.to}</div>
                {t.purpose && <div style={{ fontSize:11.5, color:'#64748b' }}>{t.purpose}</div>}
                {t.contactPhone && <div style={{ fontSize:11.5, color:'#64748b' }}>📞 {t.contactPhone}</div>}
                <button className="btn btn-danger btn-xs" style={{marginTop:8}} disabled={acceptingId===t._id} onClick={()=>acceptRequest(t._id)}>{acceptingId===t._id?'Accepting…':'🚑 Accept & Dispatch'}</button>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {myActiveTrips.length > 0 && (
        <motion.div className="card mt-2" initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }}>
          <div className="card-header"><span className="card-title">🚑 My Active Pickups</span></div>
          <div className="card-body">
            {myActiveTrips.map(t => (
              <div key={t._id} style={{ padding:'11px 14px', background:'#eff6ff', borderRadius:10, borderLeft:'3px solid #2563eb', marginBottom:8 }}>
                <div style={{ fontWeight:700, fontSize:13 }}>{t.patientName} · <span style={{color:'#2563eb'}}>{t.status.replace('_',' ')}</span></div>
                <div style={{ fontSize:12.5, color:'#374151', marginTop:4 }}>📍 {t.from} → {t.to}</div>
                {t.contactPhone && <div style={{ fontSize:11.5, color:'#64748b' }}>📞 {t.contactPhone}</div>}
                <div style={{ display:'flex', gap:6, marginTop:8 }}>
                  {t.status === 'dispatched' && <button className="btn btn-primary btn-xs" disabled={progressingId===t._id} onClick={()=>advanceTrip(t._id,'en_route')}>🚗 En Route</button>}
                  {t.status === 'en_route' && <button className="btn btn-primary btn-xs" disabled={progressingId===t._id} onClick={()=>advanceTrip(t._id,'arrived')}>📍 Arrived</button>}
                  {t.status === 'arrived' && <button className="btn btn-success btn-xs" disabled={progressingId===t._id} onClick={()=>advanceTrip(t._id,'completed')}>✅ Complete</button>}
                  <button className="btn btn-outline btn-xs" onClick={()=>advanceTrip(t._id,'cancelled')}>Cancel</button>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      <div className="grid-2 mt-2">
        <motion.div className="card" initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }}>
          <div className="card-header">
            <span className="card-title">🚑 Today's Trip Schedule</span>
            <button className="btn btn-primary btn-xs" onClick={()=>setShowLogTrip(true)}>+ Log Trip</button>
          </div>
          <div className="card-body">
            {tripsLoading ? (
              <div style={{ textAlign:'center', padding:20, color:'#94a3b8' }}>Loading…</div>
            ) : trips.length === 0 ? (
              <div style={{ textAlign:'center', padding:20, color:'#94a3b8', fontSize:13 }}>No trips logged today yet.</div>
            ) : trips.map(t=>(
              <div key={t._id} style={{ padding:'10px 12px', background: t.status==='completed'?'#f0fdf4':t.status==='cancelled'?'#f8fafc':'#fffbeb', borderRadius:10, borderLeft:`3px solid ${t.status==='completed'?'#22c55e':t.status==='cancelled'?'#94a3b8':'#f59e0b'}`, marginBottom:8 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontWeight:700, fontSize:13 }}>⏰ {t.scheduledTime || new Date(t.createdAt).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</span>
                  <span className={`badge ${t.status==='completed'?'badge-success':t.status==='cancelled'?'badge-secondary':'badge-warning'}`} style={{ fontSize:10 }}>{t.status}</span>
                </div>
                <div style={{ fontSize:12.5, color:'#374151', marginTop:4 }}>📍 {t.from} → {t.to}</div>
                {t.patientName && <div style={{ fontSize:11.5, color:'#64748b', marginTop:2 }}>Patient: {t.patientName}</div>}
                {t.purpose && <div style={{ fontSize:11.5, color:'#64748b' }}>Purpose: {t.purpose}</div>}
                {t.status === 'pending' && (
                  <div style={{ display:'flex', gap:6, marginTop:8 }}>
                    <button className="btn btn-success btn-xs" disabled={completingId===t._id} onClick={()=>completeTrip(t._id)}>{completingId===t._id?'Saving…':'✅ Complete Trip'}</button>
                    <button className="btn btn-outline btn-xs" onClick={()=>cancelTrip(t._id)}>Cancel</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </motion.div>
        <ChecklistBox items={AMB_CHECKLIST} checklist={checklist} onToggle={toggleChecklist} accentColor="#dc2626" />
        <ScheduleCard schedules={schedules} />
        <LeaveCard leaves={leaves} onApply={()=>setShowLeave(true)} />
        <div style={{ gridColumn:'1/-1' }}>
          <LogPanel logs={logs} title="📝 Trip & Vehicle Log" logTypes={AMB_LOGS} onNew={submitLog} onDelete={deleteLog} accentColor="#dc2626" />
        </div>
      </div>
      <div className="mt-2" style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
        <button className="btn btn-outline btn-sm" onClick={()=>navigate('/emergency')}>🚨 Emergency Alerts</button>
        <button className="btn btn-outline btn-sm" onClick={()=>navigate('/notice-board')}>📢 Notices</button>
        <button className="btn btn-outline btn-sm" onClick={()=>navigate('/salary')}>💰 Salary</button>
      </div>
      <LeaveModal show={showLeave} onClose={()=>setShowLeave(false)} onSubmit={async f=>{ await applyLeave(f); setShowLeave(false); }} />

      {showLogTrip && (
        <div className="modal-overlay" onClick={e=>{ if(e.target===e.currentTarget) setShowLogTrip(false); }}>
          <div className="modal-box" style={{ maxWidth:440 }}>
            <div className="modal-header"><span className="modal-title">🚑 Log a Trip</span><button className="btn btn-ghost btn-icon" onClick={()=>setShowLogTrip(false)}>✕</button></div>
            <form onSubmit={logNewTrip}>
              <div className="modal-body">
                <div className="form-group"><label className="form-label">From *</label><input className="form-input" required value={tripForm.from} onChange={e=>setTripForm(f=>({...f,from:e.target.value}))} placeholder="e.g. Hospital, Sector 12" /></div>
                <div className="form-group"><label className="form-label">To *</label><input className="form-input" required value={tripForm.to} onChange={e=>setTripForm(f=>({...f,to:e.target.value}))} placeholder="e.g. Patient's residence" /></div>
                <div className="form-group"><label className="form-label">Patient Name</label><input className="form-input" value={tripForm.patientName} onChange={e=>setTripForm(f=>({...f,patientName:e.target.value}))} /></div>
                <div className="form-group"><label className="form-label">Purpose</label><input className="form-input" value={tripForm.purpose} onChange={e=>setTripForm(f=>({...f,purpose:e.target.value}))} placeholder="e.g. Emergency pickup, Transfer to ICU" /></div>
                <div className="form-group"><label className="form-label">Scheduled Time</label><input type="time" className="form-input" value={tripForm.scheduledTime} onChange={e=>setTripForm(f=>({...f,scheduledTime:e.target.value}))} /></div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={()=>setShowLogTrip(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submittingTrip}>{submittingTrip?'Saving…':'📝 Log Trip'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   GENERIC TECHNICAL STAFF DASHBOARD
   Used for: electrician, plumber, equipment_tech, biomedical, sweeper, otboy
═══════════════════════════════════════════════════════════════ */
const TECH_CFG = {
  electrician: {
    icon:'⚡', color:'#b45309', grad:'linear-gradient(135deg,#92400ecc,#d97706)',
    title:'Electrician Dashboard', dept:'Electrical',
    checklist:['Check main electrical panels','Test emergency lighting','Inspect generator fuel level','Verify UPS units in ICU & OT','Replace burnt-out fixtures','Test earthing / grounding','Inspect fire alarm wiring','Log meter readings'],
    logs:[{value:'maintenance_request',label:'⚡ Electrical Issue'},{value:'other',label:'📝 Maintenance Log'}],
  },
  plumber: {
    icon:'🔧', color:'#0369a1', grad:'linear-gradient(135deg,#0c4a6ecc,#0891b2)',
    title:'Plumber Dashboard', dept:'Maintenance',
    checklist:['Check water pressure — all wards','Inspect boiler / water heater','Clear blocked drains in OPD','Check fire hydrant pressure','Test hand-wash stations','Inspect sewage pump','Flush tank checks & levels','Log daily water meter reading'],
    logs:[{value:'maintenance_request',label:'🔧 Plumbing Issue'},{value:'other',label:'📝 Maintenance Log'}],
  },
  equipment_tech: {
    icon:'🔩', color:'#7c3aed', grad:'linear-gradient(135deg,#5b21b6cc,#8b5cf6)',
    title:'Equipment Technician', dept:'Biomedical Equipment',
    checklist:['Ventilator calibration check','Infusion pump battery status','ECG machine paper & leads','Defibrillator self-test','Syringe pump flow rate verification','Autoclave cycle log','Oximeter probe check','Log PPM audit entries'],
    logs:[{value:'maintenance_request',label:'🔩 Equipment Issue'},{value:'other',label:'📝 Service Log'}],
  },
  biomedical: {
    icon:'🩺', color:'#047857', grad:'linear-gradient(135deg,#064e3bcc,#059669)',
    title:'Biomedical Engineer', dept:'Biomedical Engineering',
    checklist:['X-ray machine inspection','MRI safety checklist','Dialysis machine calibration','Lab analyzer QC check','Radiation safety survey','Autoclave validation record','Medical gas pipeline check','Submit biomedical report'],
    logs:[{value:'maintenance_request',label:'🩺 Equipment Service Report'},{value:'other',label:'📝 Biomedical Log'}],
  },
  sweeper: {
    icon:'🧹', color:'#c2410c', grad:'linear-gradient(135deg,#9a3412cc,#ea580c)',
    title:'Housekeeping / Sweeper', dept:'Housekeeping',
    checklist:['Mop all ward floors','Clean & disinfect bathrooms','Empty waste bins — all areas','Sanitize OPD waiting area','Deep-clean isolation rooms','Collect biomedical waste','Clean cafeteria & pantry','Final round — general wards'],
    logs:[{value:'supply_request',label:'🧹 Cleaning Supply Request'},{value:'other',label:'📝 Housekeeping Log'}],
  },
  otboy: {
    icon:'🔪', color:'#dc2626', grad:'linear-gradient(135deg,#991b1bcc,#ef4444)',
    title:'OT Boy Dashboard', dept:'Operation Theatre',
    checklist:['Set up OT for first case of day','Sterilize instruments (autoclave)','Stock suture & surgical supplies','Check OT lamp & suction unit','Lay sterile drapes & gowns','Post-op room cleaning & disinfect','Restock OT trolley','Handover to next OT Boy'],
    logs:[{value:'supply_request',label:'🔪 OT Supply Request'},{value:'maintenance_request',label:'🔧 OT Equipment Issue'},{value:'other',label:'📝 OT Log'}],
  },
  radiology_tech: {
    icon:'🩻', color:'#0e7490', grad:'linear-gradient(135deg,#155e75cc,#0891b2)',
    title:'Radiology Technician', dept:'Radiology',
    checklist:['Check X-ray machine warm-up','Verify CT/MRI safety zone signage','Inspect lead aprons & shields','Calibrate imaging equipment','Restock contrast media','Check darkroom / printer supplies','Log radiation dosimeter readings','Clean imaging suite between patients'],
    logs:[{value:'maintenance_request',label:'🩻 Equipment Issue'},{value:'other',label:'📝 Radiology Log'}],
  },
  dialysis_tech: {
    icon:'💉', color:'#be123c', grad:'linear-gradient(135deg,#9f1239cc,#e11d48)',
    title:'Dialysis Technician', dept:'Dialysis Unit',
    checklist:['Check dialysis machine water treatment','Verify dialyzer & tubing stock','Inspect vascular access supplies','Test machine alarms & safety cutoffs','Log water quality test results','Clean & disinfect stations between sessions','Check emergency crash cart nearby','Verify consumables expiry dates'],
    logs:[{value:'maintenance_request',label:'💉 Equipment Issue'},{value:'other',label:'📝 Dialysis Log'}],
  },
};

const TECH_MAINT_CATEGORY = { electrician:'electrical', plumber:'plumbing', equipment_tech:'biomedical', biomedical:'biomedical' };
const TECH_ASSET_TYPE = {
  electrician: 'electrical_equipment',
  plumber: 'plumbing_equipment',
  equipment_tech: ['ventilator', 'crash_cart', 'infusion_pump', 'defibrillator'],
  biomedical: ['ventilator', 'crash_cart', 'infusion_pump', 'defibrillator'],
};
const TECH_ASSET_LABEL = { electrician: 'Electrical', plumber: 'Plumbing', equipment_tech: 'Medical Equipment', biomedical: 'Medical Equipment' };

export function GenericTechDashboard({ roleKey }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const cfg = TECH_CFG[roleKey] || TECH_CFG.electrician;
  const { tasks, schedules, leaves, checklist, logs, loading, toggleChecklist, markTaskDone, applyLeave, submitLog, deleteLog } = useStaffData(user?._id);
  const [showLeave, setShowLeave] = useState(false);
  const [maintRequests, setMaintRequests] = useState([]);
  const [claimingId, setClaimingId] = useState(null);
  const [todaySurgeries, setTodaySurgeries] = useState([]);
  const maintCategory = TECH_MAINT_CATEGORY[roleKey];
  const assetType = TECH_ASSET_TYPE[roleKey];
  const assetLabel = TECH_ASSET_LABEL[roleKey] || 'Equipment';
  const assetQuery = Array.isArray(assetType) ? { types: assetType.join(',') } : (assetType ? { type: assetType } : null);
  const assetTypeSet = assetType ? new Set(Array.isArray(assetType) ? assetType : [assetType]) : null;
  const [techAssets, setTechAssets] = useState([]);
  const [techAssetsLoading, setTechAssetsLoading] = useState(true);
  const [dueService, setDueService] = useState([]);
  const [serviceModalFor, setServiceModalFor] = useState(null);
  const [serviceNextDue, setServiceNextDue] = useState('');
  const [serviceNotes, setServiceNotes] = useState('');
  const [savingService, setSavingService] = useState(false);

  useEffect(() => {
    if (!assetQuery) return;
    const load = () => {
      setTechAssetsLoading(true);
      assetsAPI.getAll(assetQuery).then(r => setTechAssets(r.data.data || [])).catch(()=>{}).finally(()=>setTechAssetsLoading(false));
    };
    load();
    assetsAPI.getDueForService().then(r => setDueService((r.data.data || []).filter(a => assetTypeSet.has(a.type)))).catch(()=>{});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleKey]);

  const openServiceModal = (asset) => { setServiceModalFor(asset); setServiceNextDue(''); setServiceNotes(''); };
  const submitService = async () => {
    setSavingService(true);
    try {
      await assetsAPI.markServiced(serviceModalFor._id, serviceNextDue || undefined, serviceNotes);
      toast.success(`✅ ${serviceModalFor.name} marked as serviced`);
      setServiceModalFor(null);
      assetsAPI.getAll(assetQuery).then(r => setTechAssets(r.data.data || []));
      assetsAPI.getDueForService().then(r => setDueService((r.data.data || []).filter(a => assetTypeSet.has(a.type))));
    } catch (e) { toast.error(e.response?.data?.error || 'Failed to save'); }
    setSavingService(false);
  };

  useEffect(() => {
    if (roleKey !== 'otboy') return;
    const load = () => surgeryAPI.getToday().then(r => setTodaySurgeries(r.data.data || [])).catch(()=>{});
    load();
    const socket = getSocket();
    if (!socket) return;
    socket.on('surgery_scheduled', load);
    socket.on('surgery_started', load);
    socket.on('surgery_completed', load);
    return () => { socket.off('surgery_scheduled', load); socket.off('surgery_started', load); socket.off('surgery_completed', load); };
  }, [roleKey]);

  const loadMaintRequests = () => {
    if (!maintCategory) return;
    maintenanceRequestAPI.getAll({ category: maintCategory }).then(r => setMaintRequests(r.data.data || [])).catch(()=>{});
  };
  useEffect(() => {
    loadMaintRequests();
    if (!maintCategory) return;
    const socket = getSocket();
    if (!socket) return;
    const onNew = (d) => { if (d.category === maintCategory) { toast(`🛠️ New request — ${d.location}`, { icon:'🛠️' }); loadMaintRequests(); } };
    socket.on('maintenance_request_created', onNew);
    return () => socket.off('maintenance_request_created', onNew);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maintCategory]);

  const claimRequest = async (id) => {
    setClaimingId(id);
    try { await maintenanceRequestAPI.claim(id); loadMaintRequests(); toast.success('✅ Claimed — get to it!'); }
    catch (e) { toast.error(e.response?.data?.error || 'Failed to claim'); }
    setClaimingId(null);
  };
  const resolveRequest = async (id) => {
    const notes = window.prompt('What was done to resolve this? (optional)', '') || '';
    setClaimingId(id);
    try { await maintenanceRequestAPI.resolve(id, notes); loadMaintRequests(); toast.success('✅ Marked resolved'); }
    catch (e) { toast.error(e.response?.data?.error || 'Failed to resolve'); }
    setClaimingId(null);
  };

  const pending = tasks.filter(t=>t.status!=='completed'&&t.status!=='cancelled');
  const openLogs = logs.filter(l=>l.status!=='resolved');
  const openMaintRequests = maintRequests.filter(r=>r.status!=='resolved');
  return (
    <div>
      <div style={{ background: cfg.grad, borderRadius:16, padding:'20px 26px', marginBottom:20, color:'#fff' }}>
        <div style={{ fontSize:24, fontWeight:800 }}>{cfg.icon} {cfg.title}</div>
        <div style={{ opacity:.85, fontSize:13, marginTop:4 }}>{user?.name} · {user?.department||cfg.dept} · {new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'})}</div>
        <div style={{ display:'flex', gap:8, marginTop:10, flexWrap:'wrap' }}>
          <span style={{ background:'rgba(255,255,255,.2)', borderRadius:20, padding:'3px 12px', fontSize:12, fontWeight:600 }}>📋 {pending.length} tasks</span>
          <span style={{ background:'rgba(255,255,255,.2)', borderRadius:20, padding:'3px 12px', fontSize:12, fontWeight:600 }}>📝 {openLogs.length} open requests</span>
          {maintCategory && <span style={{ background: openMaintRequests.length>0 ? '#dc2626' : 'rgba(255,255,255,.2)', borderRadius:20, padding:'3px 12px', fontSize:12, fontWeight:700 }}>🛠️ {openMaintRequests.length} reported issue{openMaintRequests.length!==1?'s':''}</span>}
        </div>
      </div>
      <div className="stat-grid">
        <StatCard icon="📋" value={pending.length} label="Pending Tasks" color="#fffbeb" />
        <StatCard icon="✅" value={tasks.filter(t=>t.status==='completed').length} label="Completed" color="#f0fdf4" />
        <StatCard icon="✓" value={`${Object.values(checklist).filter(Boolean).length}/${cfg.checklist.length}`} label="Checklist" color="#eff6ff" />
        <StatCard icon="📝" value={openLogs.length} label="Open Requests" color="#fef3c7" />
      </div>
      <div style={{ marginTop:14 }}><MyActivityWidget /></div>

      {roleKey === 'otboy' && (
        <motion.div className="card mt-2" initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} style={{ borderLeft:`4px solid ${cfg.color}` }}>
          <div className="card-header"><span className="card-title">🔪 Today's Surgeries</span><span className="badge badge-warning">{todaySurgeries.length}</span></div>
          <div className="card-body" style={{ maxHeight:320, overflowY:'auto' }}>
            {todaySurgeries.length === 0 ? (
              <div style={{ color:'#94a3b8', textAlign:'center', padding:20 }}>No surgeries scheduled for today</div>
            ) : todaySurgeries.map(s => {
              const statusCfg = {
                scheduled:{bg:'#eef2ff',c:'#4338ca',label:'📅 Scheduled'}, pre_op:{bg:'#fef3c7',c:'#92400e',label:'🧼 Pre-Op'},
                in_progress:{bg:'#fee2e2',c:'#dc2626',label:'🔴 In Progress'}, completed:{bg:'#dcfce7',c:'#15803d',label:'✅ Done'},
              }[s.status] || {bg:'#f1f5f9',c:'#64748b',label:s.status};
              return (
                <div key={s._id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 12px', background:'#f8fafc', borderRadius:9, marginBottom:7, flexWrap:'wrap', gap:8 }}>
                  <div>
                    <div style={{ fontWeight:700, fontSize:12.5 }}>🚪 {s.otRoom?.name} — {s.procedureName}</div>
                    <div style={{ fontSize:11.5, color:'#374151', marginTop:2 }}>{s.patient?.name} · Dr. {s.primarySurgeon?.name}</div>
                    <div style={{ fontSize:10.5, color:'#94a3b8', marginTop:2 }}>{new Date(s.scheduledStart).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})} – {new Date(s.scheduledEnd).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</div>
                  </div>
                  <span style={{ padding:'3px 10px', borderRadius:20, fontSize:10.5, fontWeight:700, background:statusCfg.bg, color:statusCfg.c }}>{statusCfg.label}</span>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {assetType && (
        <motion.div className="card mt-2" initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} style={{ borderLeft:`4px solid ${cfg.color}` }}>
          <div className="card-header">
            <span className="card-title">{cfg.icon} {assetLabel} Assets</span>
            {dueService.length > 0 && <span className="badge badge-danger">{dueService.length} due for service</span>}
          </div>
          <div className="card-body" style={{ maxHeight:300, overflowY:'auto' }}>
            {dueService.length > 0 && (
              <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:10, padding:'10px 12px', marginBottom:12 }}>
                <div style={{ fontWeight:700, fontSize:12, color:'#991b1b', marginBottom:6 }}>⚠️ Preventive maintenance due within 7 days</div>
                {dueService.map(a => (
                  <div key={a._id} style={{ fontSize:12, color:'#7f1d1d', marginBottom:3 }}>
                    • {a.name} — due {new Date(a.nextServiceDue).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}
                    {new Date(a.nextServiceDue) < new Date() && <strong> (OVERDUE)</strong>}
                  </div>
                ))}
              </div>
            )}
            {techAssetsLoading ? <div style={{ color:'#94a3b8', textAlign:'center', padding:16 }}>Loading…</div>
            : techAssets.length === 0 ? <div style={{ color:'#94a3b8', textAlign:'center', padding:16, fontSize:12.5 }}>No {assetLabel.toLowerCase()} assets registered yet — ask admin to add some under Assets.</div>
            : techAssets.map(a => (
              <div key={a._id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'9px 12px', background:'#f8fafc', borderRadius:9, marginBottom:6, flexWrap:'wrap', gap:8 }}>
                <div>
                  <div style={{ fontWeight:700, fontSize:12.5 }}>{a.name}</div>
                  <div style={{ fontSize:11, color:'#94a3b8' }}>📍 {a.currentLocation}
                    {a.lastServicedAt && ` · Last serviced ${new Date(a.lastServicedAt).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}`}
                    {a.nextServiceDue && ` · Next due ${new Date(a.nextServiceDue).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}`}
                  </div>
                </div>
                <button className="btn btn-outline btn-xs" onClick={()=>openServiceModal(a)}>✓ Mark Serviced</button>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      <div className="grid-2 mt-2">
        <motion.div className="card" initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }}>
          <div className="card-header"><span className="card-title">📋 Assigned Tasks</span><span className="badge badge-warning">{pending.length}</span></div>
          <div className="card-body" style={{ maxHeight:300, overflowY:'auto' }}>
            {loading ? <div style={{ color:'#94a3b8', textAlign:'center' }}>Loading…</div>
            : tasks.length===0 ? <div style={{ color:'#94a3b8', textAlign:'center', padding:20 }}>🎉 No tasks assigned</div>
            : tasks.map(t=><TaskItem key={t._id} t={t} onDone={markTaskDone}/>)}
          </div>
        </motion.div>
        <ChecklistBox items={cfg.checklist} checklist={checklist} onToggle={toggleChecklist} accentColor={cfg.color} />
        <ScheduleCard schedules={schedules} />
        <LeaveCard leaves={leaves} onApply={()=>setShowLeave(true)} />
        {maintCategory && (
          <div style={{ gridColumn:'1/-1' }}>
            <motion.div className="card" initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} style={{ borderLeft:`4px solid ${cfg.color}` }}>
              <div className="card-header"><span className="card-title">🛠️ Reported Issues (from staff)</span><span className="badge badge-warning">{openMaintRequests.length} open</span></div>
              <div className="card-body" style={{ maxHeight:260, overflowY:'auto' }}>
                {maintRequests.length===0 ? <div style={{ color:'#94a3b8', textAlign:'center', padding:20 }}>No issues reported yet.</div> : maintRequests.map(r => (
                  <div key={r._id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 12px', background: r.status==='resolved' ? '#f0fdf4' : '#f8fafc', borderRadius:9, marginBottom:7, flexWrap:'wrap', gap:8 }}>
                    <div>
                      <div style={{ fontWeight:700, fontSize:12.5 }}>{r.location} <span style={{ fontWeight:600, color: r.priority==='urgent'?'#dc2626':'#94a3b8', fontSize:10.5, textTransform:'uppercase', marginLeft:6 }}>{r.priority}</span></div>
                      <div style={{ fontSize:12, color:'#374151', marginTop:2 }}>{r.description}</div>
                      <div style={{ fontSize:10.5, color:'#94a3b8', marginTop:2 }}>Reported by {r.reportedBy?.name} ({r.reportedBy?.role}) · {new Date(r.createdAt).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</div>
                    </div>
                    {r.status==='open' && <button className="btn btn-primary btn-xs" disabled={claimingId===r._id} onClick={()=>claimRequest(r._id)}>Claim</button>}
                    {r.status==='claimed' && <button className="btn btn-success btn-xs" disabled={claimingId===r._id} onClick={()=>resolveRequest(r._id)}>✅ Resolve</button>}
                    {r.status==='resolved' && <span className="badge badge-success" style={{ fontSize:10 }}>Resolved</span>}
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
        <div style={{ gridColumn:'1/-1' }}>
          <LogPanel logs={logs} title={`📝 ${cfg.title} — Logs & Requests`} logTypes={cfg.logs} onNew={submitLog} onDelete={deleteLog} accentColor={cfg.color} />
        </div>
      </div>
      <div className="mt-2" style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
        {roleKey === 'radiology_tech' && <button className="btn btn-primary btn-sm" onClick={()=>navigate('/radiology')}>🩻 Imaging Orders</button>}
        {roleKey === 'dialysis_tech' && <button className="btn btn-primary btn-sm" onClick={()=>navigate('/dialysis')}>💉 Dialysis Sessions</button>}
        <button className="btn btn-outline btn-sm" onClick={()=>navigate('/notice-board')}>📢 Notices</button>
        <button className="btn btn-outline btn-sm" onClick={()=>navigate('/attendance')}>🕒 Attendance</button>
        <button className="btn btn-outline btn-sm" onClick={()=>navigate('/inventory')}>📦 Inventory</button>
        <button className="btn btn-outline btn-sm" onClick={()=>navigate('/salary')}>💰 Salary</button>
        <button className="btn btn-outline btn-sm" onClick={()=>navigate('/chat')}>💬 Chat</button>
      </div>
      <LeaveModal show={showLeave} onClose={()=>setShowLeave(false)} onSubmit={async f=>{ await applyLeave(f); setShowLeave(false); }} />
      {serviceModalFor && (
        <div className="modal-overlay" onClick={e=>{ if(e.target===e.currentTarget) setServiceModalFor(null); }}>
          <motion.div className="modal-box" initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }}>
            <div className="modal-header"><span className="modal-title">✓ Mark Serviced — {serviceModalFor.name}</span><button className="btn btn-ghost btn-icon" onClick={()=>setServiceModalFor(null)}>✕</button></div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Next Service Due</label>
                <input type="date" className="form-input" value={serviceNextDue} onChange={e=>setServiceNextDue(e.target.value)} />
                <div style={{ fontSize:11, color:'#94a3b8', marginTop:4 }}>Leave blank to default to 90 days from today</div>
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea className="form-input" rows={2} value={serviceNotes} onChange={e=>setServiceNotes(e.target.value)} placeholder="What was checked/replaced" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={()=>setServiceModalFor(null)}>Cancel</button>
              <button className="btn btn-primary" disabled={savingService} onClick={submitService}>{savingService ? 'Saving…' : '✓ Confirm Serviced'}</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
export const ElectricianDashboard    = () => <GenericTechDashboard roleKey="electrician" />;
export const PlumberDashboard        = () => <GenericTechDashboard roleKey="plumber" />;
export const EquipmentTechDashboard  = () => <GenericTechDashboard roleKey="equipment_tech" />;
export const BiomedicalDashboard     = () => <GenericTechDashboard roleKey="biomedical" />;
export const SweeperDashboard        = () => <GenericTechDashboard roleKey="sweeper" />;
export const OTBoyDashboard          = () => <GenericTechDashboard roleKey="otboy" />;
export const RadiologyTechDashboard  = () => <GenericTechDashboard roleKey="radiology_tech" />;
export const DialysisTechDashboard   = () => <GenericTechDashboard roleKey="dialysis_tech" />;
