import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { surgeryAPI, facilityAPI, usersAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { getSocket } from '../utils/socket';
import toast from 'react-hot-toast';

const inp = { width:'100%', padding:'9px 12px', border:'1.5px solid #e2e8f0', borderRadius:9, fontSize:13.5, outline:'none', fontFamily:'inherit', background:'#fff' };
const lbl = { display:'block', fontSize:11.5, fontWeight:700, color:'#374151', marginBottom:5 };
const STATUS_CFG = {
  scheduled:   { bg:'#eef2ff', c:'#4338ca', label:'📅 Scheduled' },
  pre_op:      { bg:'#fef3c7', c:'#92400e', label:'🧼 Pre-Op' },
  in_progress: { bg:'#fee2e2', c:'#dc2626', label:'🔴 In Progress' },
  completed:   { bg:'#dcfce7', c:'#15803d', label:'✅ Completed' },
  cancelled:   { bg:'#f1f5f9', c:'#64748b', label:'✕ Cancelled' },
};
const PHASE_LABEL = { sign_in: '1️⃣ Sign In (before anaesthesia)', time_out: '2️⃣ Time Out (before incision)', sign_out: '3️⃣ Sign Out (before leaving OT)' };

export default function SurgeryPage() {
  const { user } = useAuth();
  const [surgeries, setSurgeries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');

  const [rooms, setRooms] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [staff, setStaff] = useState([]); // nurses + anesthetists (doctors) for team picking
  const [patients, setPatients] = useState([]);

  const [showSchedule, setShowSchedule] = useState(false);
  const [form, setForm] = useState({
    patientId:'', procedureName:'', reason:'', primarySurgeonId:'', assistantIds:[], anesthetistId:'', nurseIds:[],
    otRoomId:'', date:'', startTime:'', endTime:'', notes:'',
  });
  const [scheduling, setScheduling] = useState(false);

  const [checklistFor, setChecklistFor] = useState(null); // surgery being viewed/checklisted
  const [savingItem, setSavingItem] = useState(null);
  const [busyAction, setBusyAction] = useState(false);
  const [completeNotes, setCompleteNotes] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await surgeryAPI.getAll(filterStatus ? { status: filterStatus } : {});
      setSurgeries(res.data.data || []);
    } catch { toast.error('Failed to load surgeries'); }
    setLoading(false);
  }, [filterStatus]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onChange = () => load();
    socket.on('surgery_scheduled', onChange);
    socket.on('surgery_started', onChange);
    socket.on('surgery_completed', onChange);
    return () => { socket.off('surgery_scheduled', onChange); socket.off('surgery_started', onChange); socket.off('surgery_completed', onChange); };
  }, [load]);

  const openScheduleModal = async () => {
    try {
      const [rRes, dRes, nRes, pRes] = await Promise.all([
        facilityAPI.getRooms(), usersAPI.getAll({ role:'doctor', status:'approved', limit:300 }),
        usersAPI.getAll({ role:'nurse', status:'approved', limit:300 }), usersAPI.getAll({ role:'patient', status:'approved', limit:300 }),
      ]);
      setRooms((rRes.data.data||[]).filter(r => r.type === 'OT'));
      setDoctors(dRes.data.data||[]);
      setStaff(nRes.data.data||[]);
      setPatients(pRes.data.data||[]);
      setForm({ patientId:'', procedureName:'', reason:'', primarySurgeonId:'', assistantIds:[], anesthetistId:'', nurseIds:[], otRoomId:'', date:'', startTime:'', endTime:'', notes:'' });
    } catch { toast.error('Failed to load scheduling data'); }
    setShowSchedule(true);
  };

  const toggleMulti = (key, id) => {
    setForm(f => {
      const cur = f[key];
      return { ...f, [key]: cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id] };
    });
  };

  const submitSchedule = async (e) => {
    e.preventDefault();
    if (!form.patientId || !form.procedureName.trim() || !form.primarySurgeonId || !form.otRoomId || !form.date || !form.startTime || !form.endTime) {
      toast.error('Fill in patient, procedure, surgeon, OT room, and the scheduled window'); return;
    }
    setScheduling(true);
    try {
      await surgeryAPI.schedule({
        patient: form.patientId, procedureName: form.procedureName.trim(), reason: form.reason.trim(),
        primarySurgeon: form.primarySurgeonId, assistants: form.assistantIds, anesthetist: form.anesthetistId || null, nurses: form.nurseIds,
        otRoom: form.otRoomId,
        scheduledStart: new Date(`${form.date}T${form.startTime}`).toISOString(),
        scheduledEnd:   new Date(`${form.date}T${form.endTime}`).toISOString(),
        notes: form.notes.trim(),
      });
      toast.success('✅ Surgery scheduled — team & OT boys notified');
      setShowSchedule(false);
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to schedule surgery'); }
    setScheduling(false);
  };

  const toggleChecklistItem = async (surgery, idx, checked) => {
    setSavingItem(idx);
    try {
      const res = await surgeryAPI.updateChecklistItem(surgery._id, idx, checked);
      setChecklistFor(res.data.data);
      setSurgeries(ss => ss.map(s => s._id === surgery._id ? res.data.data : s));
    } catch (e) { toast.error(e.response?.data?.error || 'Failed to update checklist'); }
    setSavingItem(null);
  };

  const moveToPreOp = async (surgery) => {
    setBusyAction(true);
    try { await surgeryAPI.moveToPreOp(surgery._id); toast.success('Moved to Pre-Op'); load(); if (checklistFor?._id===surgery._id) { const r = await surgeryAPI.getOne(surgery._id); setChecklistFor(r.data.data); } }
    catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
    setBusyAction(false);
  };

  const startSurgery = async (surgery) => {
    setBusyAction(true);
    try {
      const res = await surgeryAPI.start(surgery._id);
      toast.success('🔴 Surgery started');
      load();
      if (checklistFor?._id === surgery._id) setChecklistFor(res.data.data);
    } catch (e) { toast.error(e.response?.data?.error || 'Pre-op checklist incomplete'); }
    setBusyAction(false);
  };

  const completeSurgery = async (surgery) => {
    setBusyAction(true);
    try {
      await surgeryAPI.complete(surgery._id, completeNotes);
      toast.success('✅ Surgery completed');
      setCompleteNotes('');
      setChecklistFor(null);
      load();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
    setBusyAction(false);
  };

  const cancelSurgery = async (surgery) => {
    const reason = window.prompt('Reason for cancelling this surgery?', '') || '';
    setBusyAction(true);
    try { await surgeryAPI.cancel(surgery._id, reason); toast.success('Surgery cancelled'); load(); }
    catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
    setBusyAction(false);
  };

  const preOpDone = (s) => s.checklist.filter(c => c.phase!=='sign_out').every(c => c.checked);
  const allDone = (s) => s.checklist.every(c => c.checked);

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">🔪 OT / Surgery Scheduling</div><div className="page-subtitle">Book operating theatre time, assemble the surgical team, and run the WHO pre-op safety checklist</div></div>
        {['doctor','admin'].includes(user?.role) && <button className="btn btn-primary" onClick={openScheduleModal}>+ Schedule Surgery</button>}
      </div>

      <div style={{ display:'flex', gap:6, marginBottom:18, flexWrap:'wrap' }}>
        {[['','All'],['scheduled','📅 Scheduled'],['pre_op','🧼 Pre-Op'],['in_progress','🔴 In Progress'],['completed','✅ Completed'],['cancelled','✕ Cancelled']].map(([k,l]) => (
          <button key={k} onClick={()=>setFilterStatus(k)} style={{ padding:'8px 14px', borderRadius:11, border:'none', background:filterStatus===k?'#eef2ff':'#f8fafc', color:filterStatus===k?'#4338ca':'#64748b', fontWeight:700, fontSize:12.5, cursor:'pointer', fontFamily:'inherit' }}>{l}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:60, color:'#94a3b8' }}>Loading…</div>
      ) : surgeries.length === 0 ? (
        <div className="card"><div className="card-body" style={{ textAlign:'center', padding:48 }}>
          <div style={{ fontSize:44, marginBottom:10 }}>🔪</div>
          <div style={{ fontWeight:700, fontSize:16 }}>No surgeries {filterStatus ? `with status "${filterStatus}"` : 'scheduled'}</div>
        </div></div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))', gap:14 }}>
          {surgeries.map(s => {
            const cfg = STATUS_CFG[s.status] || STATUS_CFG.scheduled;
            return (
              <motion.div key={s._id} className="card" initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }}>
                <div className="card-body">
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                    <div>
                      <div style={{ fontWeight:800, fontSize:15 }}>{s.procedureName}</div>
                      <div style={{ fontSize:12, color:'#64748b' }}>{s.patient?.name} · {s.otRoom?.name} (Floor {s.otRoom?.floor})</div>
                    </div>
                    <span style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700, background:cfg.bg, color:cfg.c, height:'fit-content' }}>{cfg.label}</span>
                  </div>
                  <div style={{ fontSize:12.5, color:'#374151', marginBottom:4 }}>👨‍⚕️ Dr. {s.primarySurgeon?.name} (surgeon){s.anesthetist ? ` · Dr. ${s.anesthetist.name} (anaesthetist)` : ''}</div>
                  {s.assistants?.length > 0 && <div style={{ fontSize:11.5, color:'#64748b', marginBottom:4 }}>Assistants: {s.assistants.map(a=>a.name).join(', ')}</div>}
                  {s.nurses?.length > 0 && <div style={{ fontSize:11.5, color:'#64748b', marginBottom:4 }}>Nurses: {s.nurses.map(n=>n.name).join(', ')}</div>}
                  <div style={{ fontSize:11.5, color:'#94a3b8', marginBottom:10 }}>
                    Scheduled {new Date(s.scheduledStart).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})} → {new Date(s.scheduledEnd).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}
                    {s.durationMinutes != null && <div>Actual duration: <strong>{s.durationMinutes} min</strong></div>}
                  </div>
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                    {!['completed','cancelled'].includes(s.status) && (
                      <button className="btn btn-outline btn-sm" onClick={async()=>{ const r = await surgeryAPI.getOne(s._id); setChecklistFor(r.data.data); }}>📋 Checklist & Actions</button>
                    )}
                    {s.status === 'scheduled' && ['doctor','admin'].includes(user?.role) && (
                      <button className="btn btn-outline btn-sm" onClick={()=>cancelSurgery(s)}>Cancel</button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ── SCHEDULE MODAL ── */}
      <AnimatePresence>
        {showSchedule && (
          <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)setShowSchedule(false);}}>
            <motion.div className="modal-box" style={{ maxWidth:560 }} initial={{opacity:0,y:20}} animate={{opacity:1,y:0}}>
              <div className="modal-header"><span className="modal-title">🔪 Schedule Surgery</span><button className="btn btn-ghost btn-icon" onClick={()=>setShowSchedule(false)}>✕</button></div>
              <form onSubmit={submitSchedule}>
                <div className="modal-body" style={{ maxHeight:'70vh', overflowY:'auto' }}>
                  <div style={{ marginBottom:11 }}><label style={lbl}>Patient *</label>
                    <select style={inp} required value={form.patientId} onChange={e=>setForm(f=>({...f,patientId:e.target.value}))}>
                      <option value="">— Select patient —</option>
                      {patients.map(p=><option key={p._id} value={p._id}>{p.name} ({p.phone||p.email})</option>)}
                    </select>
                  </div>
                  <div style={{ marginBottom:11 }}><label style={lbl}>Procedure Name *</label><input style={inp} required value={form.procedureName} onChange={e=>setForm(f=>({...f,procedureName:e.target.value}))} placeholder="e.g. Laparoscopic Appendectomy" /></div>
                  <div style={{ marginBottom:11 }}><label style={lbl}>Reason / Indication</label><textarea style={inp} rows={2} value={form.reason} onChange={e=>setForm(f=>({...f,reason:e.target.value}))} /></div>

                  <div style={{ marginBottom:11 }}><label style={lbl}>Primary Surgeon *</label>
                    <select style={inp} required value={form.primarySurgeonId} onChange={e=>setForm(f=>({...f,primarySurgeonId:e.target.value}))}>
                      <option value="">— Select surgeon —</option>
                      {doctors.map(d=><option key={d._id} value={d._id}>Dr. {d.name}{d.specialization?` (${d.specialization})`:''}</option>)}
                    </select>
                  </div>
                  <div style={{ marginBottom:11 }}><label style={lbl}>Anaesthetist</label>
                    <select style={inp} value={form.anesthetistId} onChange={e=>setForm(f=>({...f,anesthetistId:e.target.value}))}>
                      <option value="">— Select anaesthetist (optional) —</option>
                      {doctors.filter(d=>d._id!==form.primarySurgeonId).map(d=><option key={d._id} value={d._id}>Dr. {d.name}</option>)}
                    </select>
                  </div>
                  <div style={{ marginBottom:11 }}>
                    <label style={lbl}>Assisting Surgeons</label>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                      {doctors.filter(d=>d._id!==form.primarySurgeonId).map(d => (
                        <label key={d._id} style={{ display:'flex', alignItems:'center', gap:4, fontSize:11.5, background: form.assistantIds.includes(d._id)?'#eef2ff':'#f8fafc', padding:'5px 9px', borderRadius:8, cursor:'pointer', fontWeight:600, color: form.assistantIds.includes(d._id)?'#4338ca':'#64748b' }}>
                          <input type="checkbox" checked={form.assistantIds.includes(d._id)} onChange={()=>toggleMulti('assistantIds', d._id)} /> Dr. {d.name}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div style={{ marginBottom:11 }}>
                    <label style={lbl}>OT Nurses</label>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                      {staff.map(n => (
                        <label key={n._id} style={{ display:'flex', alignItems:'center', gap:4, fontSize:11.5, background: form.nurseIds.includes(n._id)?'#eef2ff':'#f8fafc', padding:'5px 9px', borderRadius:8, cursor:'pointer', fontWeight:600, color: form.nurseIds.includes(n._id)?'#4338ca':'#64748b' }}>
                          <input type="checkbox" checked={form.nurseIds.includes(n._id)} onChange={()=>toggleMulti('nurseIds', n._id)} /> {n.name}
                        </label>
                      ))}
                      {staff.length === 0 && <span style={{ fontSize:11.5, color:'#94a3b8' }}>No nurses on roster</span>}
                    </div>
                  </div>

                  <div style={{ marginBottom:11 }}><label style={lbl}>OT Room *</label>
                    <select style={inp} required value={form.otRoomId} onChange={e=>setForm(f=>({...f,otRoomId:e.target.value}))}>
                      <option value="">— Select OT room —</option>
                      {rooms.map(r=><option key={r._id} value={r._id}>{r.name} — {r.number} (Floor {r.floor})</option>)}
                    </select>
                    {rooms.length === 0 && <div style={{ fontSize:11.5, color:'#dc2626', marginTop:4 }}>No rooms of type "OT" found — add one on the Rooms page first.</div>}
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:11 }}>
                    <div><label style={lbl}>Date *</label><input style={inp} type="date" required value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} /></div>
                    <div><label style={lbl}>Start Time *</label><input style={inp} type="time" required value={form.startTime} onChange={e=>setForm(f=>({...f,startTime:e.target.value}))} /></div>
                    <div><label style={lbl}>Est. End Time *</label><input style={inp} type="time" required value={form.endTime} onChange={e=>setForm(f=>({...f,endTime:e.target.value}))} /></div>
                  </div>
                  <div style={{ marginBottom:4 }}><label style={lbl}>Notes</label><textarea style={inp} rows={2} value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} /></div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-outline" onClick={()=>setShowSchedule(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={scheduling}>{scheduling?'Scheduling…':'✓ Schedule Surgery'}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── CHECKLIST / ACTIONS MODAL ── */}
      <AnimatePresence>
        {checklistFor && (
          <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)setChecklistFor(null);}}>
            <motion.div className="modal-box" style={{ maxWidth:520 }} initial={{opacity:0,y:20}} animate={{opacity:1,y:0}}>
              <div className="modal-header"><span className="modal-title">📋 {checklistFor.procedureName} — {checklistFor.patient?.name}</span><button className="btn btn-ghost btn-icon" onClick={()=>setChecklistFor(null)}>✕</button></div>
              <div className="modal-body" style={{ maxHeight:'65vh', overflowY:'auto' }}>
                <div style={{ marginBottom:14, display:'flex', gap:8, flexWrap:'wrap' }}>
                  <span style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700, background:STATUS_CFG[checklistFor.status].bg, color:STATUS_CFG[checklistFor.status].c }}>{STATUS_CFG[checklistFor.status].label}</span>
                  <span style={{ fontSize:12, color:'#64748b' }}>{checklistFor.otRoom?.name} · {new Date(checklistFor.scheduledStart).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</span>
                </div>

                {['sign_in','time_out','sign_out'].map(phase => (
                  <div key={phase} style={{ marginBottom:14 }}>
                    <div style={{ fontWeight:800, fontSize:12.5, color:'#374151', marginBottom:6 }}>{PHASE_LABEL[phase]}</div>
                    {checklistFor.checklist.map((c, idx) => c.phase === phase && (
                      <label key={idx} style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 10px', background: c.checked ? '#f0fdf4' : '#f8fafc', borderRadius:8, marginBottom:5, fontSize:12.5, cursor: checklistFor.status==='completed'||checklistFor.status==='cancelled' ? 'default' : 'pointer' }}>
                        <input type="checkbox" checked={c.checked} disabled={savingItem===idx || checklistFor.status==='completed' || checklistFor.status==='cancelled'}
                          onChange={e=>toggleChecklistItem(checklistFor, idx, e.target.checked)} />
                        <span style={{ color: c.checked ? '#15803d' : '#374151' }}>{c.item}</span>
                      </label>
                    ))}
                  </div>
                ))}

                {checklistFor.status === 'in_progress' && (
                  <div style={{ marginTop:10 }}>
                    <label style={lbl}>Post-op notes (for completion)</label>
                    <textarea style={inp} rows={2} value={completeNotes} onChange={e=>setCompleteNotes(e.target.value)} placeholder="Findings, blood loss, complications, etc." />
                  </div>
                )}
              </div>
              <div className="modal-footer" style={{ flexWrap:'wrap' }}>
                {checklistFor.status === 'scheduled' && (
                  <button className="btn btn-outline" disabled={busyAction} onClick={()=>moveToPreOp(checklistFor)}>🧼 Move to Pre-Op</button>
                )}
                {['scheduled','pre_op'].includes(checklistFor.status) && (
                  <button className="btn btn-primary" disabled={busyAction || !preOpDone(checklistFor)} onClick={()=>startSurgery(checklistFor)} title={!preOpDone(checklistFor) ? 'Complete all Sign In & Time Out items first' : ''}>
                    🔴 Start Surgery {!preOpDone(checklistFor) && '(checklist incomplete)'}
                  </button>
                )}
                {checklistFor.status === 'in_progress' && (
                  <button className="btn btn-success" disabled={busyAction || !allDone(checklistFor)} onClick={()=>completeSurgery(checklistFor)} title={!allDone(checklistFor) ? 'Complete all Sign Out items first' : ''}>
                    ✅ Complete Surgery {!allDone(checklistFor) && '(sign-out incomplete)'}
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
