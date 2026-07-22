import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { dialysisAPI, usersAPI, inventoryAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const inp = { width:'100%', padding:'9px 12px', border:'1.5px solid #e2e8f0', borderRadius:9, fontSize:13.5, outline:'none', fontFamily:'inherit', background:'#fff' };
const lbl = { display:'block', fontSize:11.5, fontWeight:700, color:'#374151', marginBottom:5 };
const STATUS_CFG = {
  scheduled:{bg:'#eef2ff',c:'#4338ca',label:'📅 Scheduled'}, in_progress:{bg:'#fee2e2',c:'#dc2626',label:'🔴 In Progress'},
  completed:{bg:'#dcfce7',c:'#15803d',label:'✅ Completed'}, cancelled:{bg:'#f1f5f9',c:'#64748b',label:'✕ Cancelled'}, no_show:{bg:'#fef3c7',c:'#92400e',label:'⚠️ No-Show'},
};

export default function DialysisPage() {
  const { user } = useAuth();
  const canSchedule = ['doctor','nurse','dialysis_tech','admin'].includes(user?.role);
  const canOperate = ['dialysis_tech','nurse','admin'].includes(user?.role);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  const [patients, setPatients] = useState([]);
  const [techs, setTechs] = useState([]);
  const [items, setItems] = useState([]);
  const [showSchedule, setShowSchedule] = useState(false);
  const [form, setForm] = useState({ patientId:'', assignedTech:'', stationNumber:'', accessType:'', dialyzerType:'', scheduledDate:'', scheduledStart:'', scheduledDurationMinutes:240 });
  const [saving, setSaving] = useState(false);

  const [detailFor, setDetailFor] = useState(null);
  const [vitals, setVitals] = useState({ weight:'', bloodPressure:'', pulse:'', temperature:'' });
  const [postVitals, setPostVitals] = useState({ weight:'', bloodPressure:'', pulse:'', temperature:'' });
  const [complications, setComplications] = useState('');
  const [consumables, setConsumables] = useState([{ item:'', quantity:1 }]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    dialysisAPI.getSessions(statusFilter ? { status: statusFilter } : {}).then(r => setSessions(r.data.data || [])).catch(()=>toast.error('Failed to load sessions')).finally(()=>setLoading(false));
  }, [statusFilter]);
  useEffect(() => { load(); }, [load]);

  const openScheduleModal = async () => {
    try {
      const [pRes, tRes, iRes] = await Promise.all([
        usersAPI.getAll({ role:'patient', status:'approved', limit:300 }),
        usersAPI.getAll({ role:'dialysis_tech', status:'approved', limit:100 }),
        inventoryAPI.getItems({}),
      ]);
      setPatients(pRes.data.data||[]); setTechs(tRes.data.data||[]); setItems(iRes.data.data||[]);
    } catch {}
    setForm({ patientId:'', assignedTech:'', stationNumber:'', accessType:'', dialyzerType:'', scheduledDate:'', scheduledStart:'', scheduledDurationMinutes:240 });
    setShowSchedule(true);
  };

  const submitSchedule = async (e) => {
    e.preventDefault();
    if (!form.patientId || !form.scheduledDate || !form.scheduledStart) { toast.error('Patient, date, and start time are required'); return; }
    setSaving(true);
    try {
      await dialysisAPI.schedule({ ...form, patient: form.patientId, assignedTech: form.assignedTech || undefined });
      toast.success('✅ Session scheduled');
      setShowSchedule(false);
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to schedule'); }
    setSaving(false);
  };

  const openDetail = (s) => {
    setDetailFor(s);
    setVitals({ weight:'', bloodPressure:'', pulse:'', temperature:'' });
    setPostVitals({ weight:'', bloodPressure:'', pulse:'', temperature:'' });
    setComplications('');
    setConsumables([{ item:'', quantity:1 }]);
    if (items.length === 0) inventoryAPI.getItems({}).then(r=>setItems(r.data.data||[])).catch(()=>{});
  };

  const doStart = async () => {
    setBusy(true);
    try { const r = await dialysisAPI.start(detailFor._id, vitals); toast.success('Session started'); setDetailFor(r.data.data); load(); }
    catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
    setBusy(false);
  };

  const updateConsumable = (idx, patch) => setConsumables(cs => cs.map((c,i)=>i===idx?{...c,...patch}:c));
  const addConsumable = () => setConsumables(cs => [...cs, { item:'', quantity:1 }]);
  const removeConsumable = (idx) => setConsumables(cs => cs.length>1 ? cs.filter((_,i)=>i!==idx) : cs);

  const doComplete = async () => {
    setBusy(true);
    try {
      const validConsumables = consumables.filter(c => c.item && c.quantity > 0);
      const r = await dialysisAPI.complete(detailFor._id, { ...postVitals, complications, consumablesUsed: validConsumables });
      toast.success('✅ Session completed');
      setDetailFor(r.data.data); load();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
    setBusy(false);
  };

  const doRepeat = async (s) => {
    try { await dialysisAPI.repeat(s._id); toast.success('✅ Next session scheduled'); load(); }
    catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
  };

  const doCancel = async (s, noShow) => {
    const reason = window.prompt(noShow ? 'Any notes on this no-show?' : 'Reason for cancelling?', '') || '';
    try { await dialysisAPI.cancel(s._id, reason, noShow); toast.success(noShow ? 'Marked as no-show' : 'Session cancelled'); load(); setDetailFor(null); }
    catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
  };

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">💉 Dialysis Management</div><div className="page-subtitle">Session scheduling, treatment records, and consumables</div></div>
        {canSchedule && <button className="btn btn-primary" onClick={openScheduleModal}>+ Schedule Session</button>}
      </div>

      <div style={{ display:'flex', gap:6, marginBottom:18, flexWrap:'wrap' }}>
        {[['','All'],['scheduled','📅 Scheduled'],['in_progress','🔴 In Progress'],['completed','✅ Completed'],['no_show','⚠️ No-Show'],['cancelled','✕ Cancelled']].map(([k,l]) => (
          <button key={k} onClick={()=>setStatusFilter(k)} style={{ padding:'8px 14px', borderRadius:11, border:'none', background:statusFilter===k?'#eef2ff':'#f8fafc', color:statusFilter===k?'#4338ca':'#64748b', fontWeight:700, fontSize:12.5, cursor:'pointer', fontFamily:'inherit' }}>{l}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:60, color:'#94a3b8' }}>Loading…</div>
      ) : sessions.length === 0 ? (
        <div className="card"><div className="card-body" style={{ textAlign:'center', padding:48 }}>
          <div style={{ fontSize:44, marginBottom:10 }}>💉</div>
          <div style={{ fontWeight:700, fontSize:16 }}>No dialysis sessions {statusFilter ? `with status "${statusFilter}"` : 'yet'}</div>
        </div></div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:14 }}>
          {sessions.map(s => {
            const cfg = STATUS_CFG[s.status] || STATUS_CFG.scheduled;
            return (
              <motion.div key={s._id} className="card" initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} style={{ cursor:'pointer' }} onClick={()=>openDetail(s)}>
                <div className="card-body">
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                    <div>
                      <div style={{ fontWeight:800, fontSize:14 }}>{s.patient?.name}</div>
                      <div style={{ fontSize:12, color:'#64748b' }}>{s.stationNumber ? `Station ${s.stationNumber}` : 'No station set'}{s.accessType && ` · ${s.accessType}`}</div>
                    </div>
                    <span style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700, background:cfg.bg, color:cfg.c, height:'fit-content' }}>{cfg.label}</span>
                  </div>
                  <div style={{ fontSize:12.5, color:'#374151', marginBottom:4 }}>📅 {new Date(s.scheduledDate).toLocaleDateString('en-IN',{day:'numeric',month:'short'})} at {s.scheduledStart}</div>
                  {s.assignedTech && <div style={{ fontSize:11.5, color:'#94a3b8' }}>Tech: {s.assignedTech.name}</div>}
                  {s.durationMinutes != null && <div style={{ fontSize:11.5, color:'#94a3b8' }}>Duration: {s.durationMinutes} min</div>}
                  {s.status === 'completed' && (
                    <button className="btn btn-outline btn-xs" style={{ marginTop:8 }} onClick={(e)=>{e.stopPropagation(); doRepeat(s);}}>🔁 Schedule Next</button>
                  )}
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
            <motion.div className="modal-box" style={{ maxWidth:520 }} initial={{opacity:0,y:20}} animate={{opacity:1,y:0}}>
              <div className="modal-header"><span className="modal-title">💉 Schedule Dialysis Session</span><button className="btn btn-ghost btn-icon" onClick={()=>setShowSchedule(false)}>✕</button></div>
              <form onSubmit={submitSchedule}>
                <div className="modal-body" style={{ maxHeight:'70vh', overflowY:'auto' }}>
                  <div style={{ marginBottom:11 }}><label style={lbl}>Patient *</label>
                    <select style={inp} required value={form.patientId} onChange={e=>setForm(f=>({...f,patientId:e.target.value}))}>
                      <option value="">— Select patient —</option>
                      {patients.map(p=><option key={p._id} value={p._id}>{p.name} ({p.phone||p.email})</option>)}
                    </select>
                  </div>
                  <div style={{ marginBottom:11 }}><label style={lbl}>Assign Technician</label>
                    <select style={inp} value={form.assignedTech} onChange={e=>setForm(f=>({...f,assignedTech:e.target.value}))}>
                      <option value="">— Unassigned —</option>
                      {techs.map(t=><option key={t._id} value={t._id}>{t.name}</option>)}
                    </select>
                    {techs.length === 0 && (
                      <div style={{ fontSize:11, color:'#d97706', marginTop:4 }}>
                        ⚠️ No dialysis technicians found. Register a "Dialysis Tech" account and have an admin approve it under User Approvals — it'll appear here once approved. You can still schedule this session unassigned.
                      </div>
                    )}
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:11 }}>
                    <div><label style={lbl}>Station Number</label><input style={inp} value={form.stationNumber} onChange={e=>setForm(f=>({...f,stationNumber:e.target.value}))} placeholder="e.g. D-3" /></div>
                    <div><label style={lbl}>Access Type</label><select style={inp} value={form.accessType} onChange={e=>setForm(f=>({...f,accessType:e.target.value}))}><option value="">— Select —</option><option>Fistula</option><option>Graft</option><option>Catheter</option></select></div>
                  </div>
                  <div style={{ marginBottom:11 }}><label style={lbl}>Dialyzer Type</label><input style={inp} value={form.dialyzerType} onChange={e=>setForm(f=>({...f,dialyzerType:e.target.value}))} /></div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
                    <div><label style={lbl}>Date *</label><input type="date" style={inp} required value={form.scheduledDate} onChange={e=>setForm(f=>({...f,scheduledDate:e.target.value}))} /></div>
                    <div><label style={lbl}>Start Time *</label><input type="time" style={inp} required value={form.scheduledStart} onChange={e=>setForm(f=>({...f,scheduledStart:e.target.value}))} /></div>
                    <div><label style={lbl}>Duration (min)</label><input type="number" min="30" style={inp} value={form.scheduledDurationMinutes} onChange={e=>setForm(f=>({...f,scheduledDurationMinutes:Number(e.target.value)}))} /></div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-outline" onClick={()=>setShowSchedule(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>{saving?'Scheduling…':'✓ Schedule Session'}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── DETAIL MODAL ── */}
      <AnimatePresence>
        {detailFor && (
          <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)setDetailFor(null);}}>
            <motion.div className="modal-box" style={{ maxWidth:520 }} initial={{opacity:0,y:20}} animate={{opacity:1,y:0}}>
              <div className="modal-header"><span className="modal-title">💉 {detailFor.patient?.name}</span><button className="btn btn-ghost btn-icon" onClick={()=>setDetailFor(null)}>✕</button></div>
              <div className="modal-body" style={{ maxHeight:'65vh', overflowY:'auto' }}>
                <div style={{ marginBottom:14 }}>
                  <span style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700, background:STATUS_CFG[detailFor.status].bg, color:STATUS_CFG[detailFor.status].c }}>{STATUS_CFG[detailFor.status].label}</span>
                </div>
                <div style={{ fontSize:13, marginBottom:10 }}>{new Date(detailFor.scheduledDate).toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'short'})} at {detailFor.scheduledStart} · Station {detailFor.stationNumber||'—'}</div>

                {detailFor.status === 'scheduled' && canOperate && (
                  <div style={{ marginBottom:10 }}>
                    <div style={{ fontWeight:700, fontSize:12.5, marginBottom:8 }}>Pre-Session Vitals</div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                      <input placeholder="Weight (kg)" style={inp} value={vitals.weight} onChange={e=>setVitals(v=>({...v,weight:e.target.value}))} />
                      <input placeholder="BP (e.g. 120/80)" style={inp} value={vitals.bloodPressure} onChange={e=>setVitals(v=>({...v,bloodPressure:e.target.value}))} />
                      <input placeholder="Pulse" style={inp} value={vitals.pulse} onChange={e=>setVitals(v=>({...v,pulse:e.target.value}))} />
                      <input placeholder="Temp (°C)" style={inp} value={vitals.temperature} onChange={e=>setVitals(v=>({...v,temperature:e.target.value}))} />
                    </div>
                  </div>
                )}

                {detailFor.status === 'in_progress' && canOperate && (
                  <div>
                    <div style={{ fontWeight:700, fontSize:12.5, marginBottom:8 }}>Post-Session Vitals</div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:12 }}>
                      <input placeholder="Weight (kg)" style={inp} value={postVitals.weight} onChange={e=>setPostVitals(v=>({...v,weight:e.target.value}))} />
                      <input placeholder="BP (e.g. 120/80)" style={inp} value={postVitals.bloodPressure} onChange={e=>setPostVitals(v=>({...v,bloodPressure:e.target.value}))} />
                      <input placeholder="Pulse" style={inp} value={postVitals.pulse} onChange={e=>setPostVitals(v=>({...v,pulse:e.target.value}))} />
                      <input placeholder="Temp (°C)" style={inp} value={postVitals.temperature} onChange={e=>setPostVitals(v=>({...v,temperature:e.target.value}))} />
                    </div>
                    <textarea placeholder="Any complications?" style={{...inp, marginBottom:12}} rows={2} value={complications} onChange={e=>setComplications(e.target.value)} />
                    <div style={{ fontWeight:700, fontSize:12.5, marginBottom:8 }}>Consumables Used</div>
                    {consumables.map((c, idx) => (
                      <div key={idx} style={{ display:'grid', gridTemplateColumns:'2fr 1fr auto', gap:6, marginBottom:6 }}>
                        <select style={inp} value={c.item} onChange={e=>updateConsumable(idx,{item:e.target.value})}>
                          <option value="">— Select item —</option>
                          {items.map(it=><option key={it._id} value={it._id}>{it.name} ({it.currentStock} {it.unit})</option>)}
                        </select>
                        <input type="number" min="1" style={inp} value={c.quantity} onChange={e=>updateConsumable(idx,{quantity:Number(e.target.value)})} />
                        <button type="button" onClick={()=>removeConsumable(idx)} style={{ background:'none', border:'none', color:'#dc2626', cursor:'pointer' }}>✕</button>
                      </div>
                    ))}
                    <button type="button" className="btn btn-outline btn-sm" onClick={addConsumable}>+ Add Item</button>
                  </div>
                )}

                {detailFor.status === 'completed' && (
                  <div style={{ fontSize:12.5, color:'#64748b' }}>
                    Duration: {detailFor.durationMinutes} min<br/>
                    {detailFor.postVitals?.weight && `Post weight: ${detailFor.postVitals.weight}kg`}
                    {detailFor.complications && <div style={{ marginTop:6, color:'#dc2626' }}>⚠️ {detailFor.complications}</div>}
                  </div>
                )}
              </div>
              <div className="modal-footer" style={{ flexWrap:'wrap' }}>
                {detailFor.status === 'scheduled' && canOperate && <button className="btn btn-primary" disabled={busy} onClick={doStart}>🔴 Start Session</button>}
                {detailFor.status === 'in_progress' && canOperate && <button className="btn btn-primary" disabled={busy} onClick={doComplete}>✅ Complete Session</button>}
                {detailFor.status === 'scheduled' && canSchedule && <button className="btn btn-outline" onClick={()=>doCancel(detailFor,true)}>Mark No-Show</button>}
                {!['completed','cancelled','no_show'].includes(detailFor.status) && canSchedule && <button className="btn btn-outline" onClick={()=>doCancel(detailFor,false)}>Cancel</button>}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
