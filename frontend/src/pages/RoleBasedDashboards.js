import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { facilityAPI, tasksAPI, leavesAPI, checklistAPI, staffLogsAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { getSocket } from '../utils/socket';
import toast from 'react-hot-toast';

// ── Shared config ─────────────────────────────────────────────────────
const SHIFTS = { morning:{l:'Morning',t:'08:00–16:00',i:'🌅',bg:'#dcfce7',c:'#15803d'}, afternoon:{l:'Afternoon',t:'14:00–22:00',i:'🌇',bg:'#fef3c7',c:'#92400e'}, night:{l:'Night',t:'22:00–06:00',i:'🌙',bg:'#e0e7ff',c:'#3730a3'}, full:{l:'Full Day',t:'07:00–19:00',i:'☀️',bg:'#f0f9ff',c:'#0369a1'} };
const PRIORITY_C = { urgent:'#ef4444', high:'#f97316', medium:'#3b82f6', low:'#22c55e' };
const STATUS_C = { pending:'#f59e0b', in_progress:'#3b82f6', completed:'#22c55e', cancelled:'#94a3b8' };

const ROLE_CFG = {
  receptionist:    { icon:'🏨', label:'Receptionist',          color:'#db2777', dark:'#be185d',  tasks:['Register new patient','Schedule appointment','Answer phone queries','Update patient records','Manage visitor log','Coordinate with departments','Process discharge paperwork','Verify insurance documents','Handle patient complaints','Daily admission summary'] },
  security:        { icon:'🔐', label:'Security Officer',       color:'#374151', dark:'#1f2937',  tasks:['Check CCTV cameras','Patrol hospital perimeter','Verify visitor IDs','Monitor emergency exits','Check fire alarm systems','Night security rounds','Secure medication storage','Incident report submission','Check access control systems','Maintain security log'] },
  wardboy:         { icon:'🛏️', label:'Ward Boy',               color:'#059669', dark:'#047857',  tasks:['Transport patient to OT','Change bed linens in Ward A','Carry meal trays to Ward B','Assist nurses with patient movement','Refill IV stands','Transport specimens to lab','Distribute patient ID wristbands','Assist in patient admission','Help wheelchair transfer','Update patient transfer log'] },
  nurse:           { icon:'💉', label:'Nurse',                  color:'#db2777', dark:'#be185d',  tasks:['Administer morning medications','Check vital signs for all patients','Change wound dressings','IV cannulation for new patients','Patient education session','Night duty rounds','Pre-op patient preparation','Post-op monitoring','Update patient charts','Emergency response readiness'] },
  otboy:           { icon:'🔪', label:'OT Boy',                 color:'#ef4444', dark:'#b91c1c',  tasks:['Prepare OT for surgery','Sterilize surgical instruments','Stock OT supplies','Post-op room cleaning','Transport patient to OT','Arrange sterile drapes','Check OT equipment','Waste disposal after surgery','Maintain OT cleanliness','Assist anesthesia setup'] },
  plumber:         { icon:'🔧', label:'Plumber',                color:'#0891b2', dark:'#0e7490',  tasks:['Fix leaking tap in OT-02','Unclog drainage in ICU','Check water pressure','Service hot water boilers','Replace faulty valves','Inspect sewage system','Fix broken flush in ward','Check fire suppression line','Monthly pipe inspection','Water quality check'] },
  electrician:     { icon:'⚡', label:'Electrician',            color:'#f59e0b', dark:'#d97706',  tasks:['Check all electrical panels','Replace faulty switches','Test emergency lighting','Inspect generator backup','Fix short circuit in ICU','Install power outlets in lab','Test UPS systems','Monthly electrical audit','Check earthing connections','Inspect medical equipment power'] },
  it_technician:   { icon:'💻', label:'IT Technician',          color:'#6366f1', dark:'#4338ca',  tasks:['Restart HMS server if needed','Fix network in Ward B','Update antivirus on all systems','Backup critical databases','Configure new workstation','Troubleshoot PACS/RIS','Check CCTV feeds','Monitor server room temp','Update software licenses','Cybersecurity scan'] },
  equipment_tech:  { icon:'🔩', label:'Equipment Technician',   color:'#8b5cf6', dark:'#7c3aed',  tasks:['Service ventilator ICU-01','Calibrate ECG machines','Check defibrillator batteries','Service anesthesia machines','Inspect surgical instruments','Test patient monitors','Service infusion pumps','Monthly biomedical audit','Calibrate lab analyzers','PPM schedule update'] },
  biomedical:      { icon:'🩺', label:'Biomedical Engineer',    color:'#059669', dark:'#047857',  tasks:['Validate autoclave performance','Test MRI safety protocols','Calibrate lab analyzers','Service X-ray equipment','Inspect dialysis machines','Validate sterilization equip','Test pulse oximeters','Biomedical compliance audit','Equipment lifecycle review','Update CMMS records'] },
  sweeper:         { icon:'🧹', label:'Sweeper',                color:'#f59e0b', dark:'#d97706',  tasks:['Mop all ward floors','Clean patient bathrooms','Sanitize ICU corridor','Waste disposal all wings','Clean OPD waiting area','Disinfect nurse station','Clean cafeteria area','Sanitize lift interiors','Empty all dustbins','Deep clean operation theater'] },
  ambulance_driver:{ icon:'🚑', label:'Ambulance Driver',       color:'#dc2626', dark:'#b91c1c',  tasks:['Check ambulance fuel & oil','Verify emergency equipment','Inspect first aid kit','Test GPS & communication','Route planning for transfers','Patient transport log','Vehicle maintenance check','Emergency response drill','Ambulance cleanliness','Driver fitness check'] },
  pharmacist:      { icon:'💊', label:'Pharmacist',             color:'#d97706', dark:'#b45309',  tasks:['Dispense morning prescriptions','Inventory check for critical drugs','Verify controlled substances','Drug interaction reviews','Counsel patients on medications','Reorder low stock items','Check expiry dates','Compounding medications','Insurance claim submissions','End-of-day reconciliation'] },
};

function TasksPanel({ user, ac }) {
  const [tasks, setTasks]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [completing, setComp] = useState(null);
  const [modal, setModal]     = useState(null);
  const [notes, setNotes]     = useState('');

  useEffect(() => {
    tasksAPI.getAll()
      .then(r => { setTasks(r.data.data||[]); setLoading(false); })
      .catch(() => setLoading(false));
  }, [user?._id]);

  const markDone = async () => {
    setComp(modal._id);
    try {
      await tasksAPI.update(modal._id, { status:'completed', notes, completedAt:new Date() });
      setTasks(ts => ts.map(t => t._id===modal._id ? {...t, status:'completed', notes} : t));
      toast.success('✅ Task completed!');
      setModal(null); setNotes('');
    } catch { toast.error('Update failed'); }
    setComp(null);
  };

  const markStart = async (id) => {
    try {
      await tasksAPI.update(id, { status:'in_progress' });
      setTasks(ts => ts.map(t => t._id===id ? {...t, status:'in_progress'} : t));
      toast.success('▶ Task started');
    } catch { toast.error('Failed'); }
  };

  const pending  = tasks.filter(t => ['pending','in_progress'].includes(t.status));
  const done     = tasks.filter(t => t.status === 'completed');

  return (
    <>
      <div style={{ background:'#fff', border:'1px solid #e8edf3', borderRadius:16, overflow:'hidden' }}>
        <div style={{ padding:'13px 18px', borderBottom:'1px solid #f1f5f9', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:18 }}>📋</span>
            <span style={{ fontWeight:800, fontSize:14.5, color:'#0f172a' }}>My Assigned Tasks</span>
          </div>
          {pending.length>0 && <span style={{ padding:'2px 9px', borderRadius:20, background:'#fef3c7', color:'#92400e', fontSize:12, fontWeight:700 }}>{pending.length} pending</span>}
        </div>
        {tasks.length>0 && (
          <div style={{ padding:'8px 18px 0' }}>
            <div style={{ height:5, background:'#f1f5f9', borderRadius:3, marginBottom:6 }}>
              <div style={{ height:'100%', background:`linear-gradient(90deg,${ac},#22c55e)`, borderRadius:3, width:`${tasks.length?Math.round((done.length/tasks.length)*100):0}%`, transition:'width .5s' }} />
            </div>
            <div style={{ fontSize:11, color:'#94a3b8', marginBottom:6 }}>{Math.round((done.length/(tasks.length||1))*100)}% complete</div>
          </div>
        )}
        <div style={{ padding:'10px 14px 14px', maxHeight:400, overflowY:'auto' }}>
          {loading ? <div style={{ padding:20, textAlign:'center', color:'#94a3b8' }}>Loading…</div>
          : tasks.length===0 ? (
            <div style={{ padding:'24px 0', textAlign:'center', color:'#94a3b8' }}>
              <div style={{ fontSize:36, marginBottom:8 }}>🎉</div>
              <div style={{ fontWeight:700 }}>No tasks assigned yet</div>
              <div style={{ fontSize:12, marginTop:3 }}>Check back later or contact your supervisor</div>
            </div>
          ) : (
            <>
              {pending.map(t => {
                const pc = PRIORITY_C[t.priority]||PRIORITY_C.medium;
                return (
                  <div key={t._id} style={{ padding:'12px 13px', background: t.status==='in_progress'?`${ac}08`:'#f8fafc', borderRadius:12, marginBottom:8, borderLeft:`3px solid ${pc}`, border:`1px solid ${t.priority==='urgent'?'#fecaca':'#e8edf3'}`, borderLeft:`3px solid ${pc}` }}>
                    <div style={{ fontWeight:700, fontSize:13, color:'#0f172a', marginBottom:3 }}>{t.title}</div>
                    {t.description && <div style={{ fontSize:12, color:'#64748b', marginBottom:5 }}>{t.description}</div>}
                    <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginBottom:7 }}>
                      <span style={{ padding:'2px 7px', borderRadius:8, fontSize:11, fontWeight:800, background:`${pc}18`, color:pc }}>{t.priority}</span>
                      <span style={{ padding:'2px 7px', borderRadius:8, fontSize:11, color: STATUS_C[t.status], background:`${STATUS_C[t.status]}15`, fontWeight:700 }}>{t.status.replace('_',' ')}</span>
                      {t.dueDate&&<span style={{ padding:'2px 7px', borderRadius:8, fontSize:11, color:'#64748b', background:'#f1f5f9' }}>📅 {new Date(t.dueDate).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</span>}
                      {t.assignedBy&&<span style={{ padding:'2px 7px', borderRadius:8, fontSize:11, color:'#94a3b8', background:'#f8fafc' }}>by {t.assignedBy.name?.split(' ')[0]}</span>}
                    </div>
                    <div style={{ display:'flex', gap:6 }}>
                      {t.status==='pending'&&<button onClick={()=>markStart(t._id)} style={{ flex:1, padding:'7px', borderRadius:8, border:'1px solid #bfdbfe', background:'#eff6ff', color:'#2563eb', fontFamily:'inherit', fontSize:12, fontWeight:700, cursor:'pointer' }}>▶ Start</button>}
                      <button onClick={()=>{setModal(t);setNotes('');}} style={{ flex:2, padding:'7px', borderRadius:8, border:'none', background:ac, color:'#fff', fontFamily:'inherit', fontSize:12, fontWeight:700, cursor:'pointer' }}>✓ Complete</button>
                    </div>
                  </div>
                );
              })}
              {done.length>0 && <>
                <div style={{ fontSize:10.5, color:'#94a3b8', fontWeight:700, letterSpacing:.8, textTransform:'uppercase', margin:'10px 0 7px' }}>Completed ({done.length})</div>
                {done.slice(0,4).map(t=>(
                  <div key={t._id} style={{ padding:'9px 12px', background:'#f0fdf4', borderRadius:10, marginBottom:5, display:'flex', alignItems:'center', gap:8, opacity:.8 }}>
                    <span style={{ color:'#22c55e', fontSize:14 }}>✓</span>
                    <div>
                      <div style={{ fontWeight:700, fontSize:12.5, color:'#0f172a', textDecoration:'line-through', textDecorationColor:'#94a3b8' }}>{t.title}</div>
                      {t.completedAt&&<div style={{ fontSize:10.5, color:'#94a3b8' }}>✅ {new Date(t.completedAt).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</div>}
                    </div>
                  </div>
                ))}
              </>}
            </>
          )}
        </div>
      </div>
      <AnimatePresence>
        {modal && (
          <div onClick={e=>{if(e.target===e.currentTarget)setModal(null)}} style={{ position:'fixed',inset:0,background:'rgba(0,0,0,.55)',backdropFilter:'blur(4px)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16 }}>
            <motion.div initial={{ opacity:0,y:20,scale:.96 }} animate={{ opacity:1,y:0,scale:1 }} exit={{ opacity:0,y:20,scale:.96 }}
              style={{ background:'#fff',borderRadius:20,width:'100%',maxWidth:420,overflow:'hidden',boxShadow:'0 32px 80px rgba(0,0,0,.25)' }}>
              <div style={{ background:`linear-gradient(135deg,${ac},${ac}cc)`,padding:'16px 20px' }}>
                <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between' }}>
                  <div><h3 style={{ color:'#fff',fontWeight:800,fontSize:16,margin:0 }}>✅ Complete Task</h3><p style={{ color:'rgba(255,255,255,.75)',fontSize:12,margin:'3px 0 0' }}>{modal.title}</p></div>
                  <button onClick={()=>setModal(null)} style={{ background:'rgba(255,255,255,.2)',border:'none',borderRadius:'50%',width:26,height:26,cursor:'pointer',color:'#fff',fontSize:12,display:'flex',alignItems:'center',justifyContent:'center' }}>✕</button>
                </div>
              </div>
              <div style={{ padding:'18px 20px' }}>
                <div style={{ background:'#f8fafc',borderRadius:10,padding:'11px',marginBottom:14 }}>
                  {[['Priority',modal.priority],['Category',modal.category],['Assigned by',modal.assignedBy?.name||'Admin']].map(([l,v])=>(
                    <div key={l} style={{ display:'flex',justifyContent:'space-between',padding:'3px 0',fontSize:12.5,borderBottom:'1px solid #f1f5f9' }}>
                      <span style={{ color:'#64748b' }}>{l}</span><span style={{ fontWeight:700,color:'#0f172a',textTransform:'capitalize' }}>{v}</span>
                    </div>
                  ))}
                </div>
                <label style={{ display:'block',fontSize:10.5,fontWeight:700,color:'#374151',letterSpacing:.5,textTransform:'uppercase',marginBottom:5 }}>Completion Notes</label>
                <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={3} placeholder="Describe what was done, materials used, time taken…"
                  style={{ width:'100%',padding:'10px 12px',border:'1.5px solid #e2e8f0',borderRadius:10,fontFamily:'inherit',fontSize:13.5,outline:'none',resize:'none',boxSizing:'border-box',marginBottom:14 }} />
                <div style={{ display:'flex',gap:8 }}>
                  <button onClick={()=>setModal(null)} style={{ flex:1,padding:'11px',borderRadius:11,border:'1.5px solid #e2e8f0',background:'#fff',fontFamily:'inherit',fontWeight:700,cursor:'pointer' }}>Cancel</button>
                  <button onClick={markDone} disabled={!!completing} style={{ flex:2,padding:'11px',borderRadius:11,border:'none',background:`linear-gradient(135deg,${ac},${ac}cc)`,color:'#fff',fontFamily:'inherit',fontWeight:800,cursor:'pointer',fontSize:14 }}>
                    {completing?'Saving…':'✅ Mark Complete'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

function TodaySchedulePanel({ user, ac }) {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    facilityAPI.getSchedules({ userId:user?._id, date:new Date().toISOString() })
      .then(r => { setSchedules(r.data.data||[]); setLoading(false); })
      .catch(() => setLoading(false));
  }, [user?._id]);

  return (
    <div style={{ background:'#fff', border:'1px solid #e8edf3', borderRadius:16, overflow:'hidden' }}>
      <div style={{ padding:'13px 18px', borderBottom:'1px solid #f1f5f9', display:'flex', alignItems:'center', gap:8 }}>
        <span style={{ fontSize:18 }}>📆</span>
        <span style={{ fontWeight:800, fontSize:14.5, color:'#0f172a' }}>Today's Shifts</span>
        <span style={{ fontSize:12, color:'#94a3b8', marginLeft:'auto' }}>{new Date().toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short'})}</span>
      </div>
      <div style={{ padding:'12px 14px' }}>
        {loading ? <div style={{ padding:16,textAlign:'center',color:'#94a3b8',fontSize:13 }}>Loading…</div>
        : schedules.length===0 ? (
          <div style={{ padding:'20px 0',textAlign:'center',color:'#94a3b8' }}>
            <div style={{ fontSize:30,marginBottom:6 }}>😌</div>
            <div style={{ fontWeight:600,fontSize:13 }}>No shifts today</div>
          </div>
        ) : schedules.map((s,i) => {
          const sd = SHIFTS[s.shift]||SHIFTS.morning;
          return (
            <div key={i} style={{ padding:'11px 13px',background:sd.bg,borderRadius:12,marginBottom:7,borderLeft:`3px solid ${sd.c}` }}>
              <div style={{ fontWeight:800,color:'#0f172a',fontSize:13,marginBottom:2 }}>{sd.i} {sd.l} · {sd.t}</div>
              {s.department&&<div style={{ fontSize:12,color:'#64748b' }}>🏥 {s.department}</div>}
              {s.task&&<div style={{ fontSize:12,color:'#64748b',marginTop:1 }}>📋 {s.task}</div>}
              <div style={{ display:'flex',alignItems:'center',gap:4,marginTop:5 }}>
                <div style={{ width:6,height:6,borderRadius:'50%',background:s.status==='completed'?'#22c55e':'#3b82f6' }}/>
                <span style={{ fontSize:10.5,fontWeight:700,color:s.status==='completed'?'#15803d':'#1d4ed8',textTransform:'capitalize' }}>{s.status}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ChecklistPanel({ cfg, ac }) {
  const [done, setDone] = useState({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    checklistAPI.getToday()
      .then(r => { setDone(r.data.data?.items || {}); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, []);

  const toggle = async (i) => {
    const newVal = !done[i];
    setDone(d => ({ ...d, [i]: newVal })); // optimistic
    try { await checklistAPI.toggle(i, newVal); }
    catch { setDone(d => ({ ...d, [i]: !newVal })); toast.error('Failed to save — try again'); }
  };

  const doneCount = Object.values(done).filter(Boolean).length;
  return (
    <div style={{ background:'#fff', border:'1px solid #e8edf3', borderRadius:16, overflow:'hidden' }}>
      <div style={{ padding:'13px 18px', borderBottom:'1px solid #f1f5f9', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:18 }}>✅</span>
          <span style={{ fontWeight:800, fontSize:14.5, color:'#0f172a' }}>Daily Checklist</span>
        </div>
        <span style={{ fontSize:12, fontWeight:700, color:ac }}>{doneCount}/{cfg.tasks.length}</span>
      </div>
      <div style={{ padding:'8px 16px 0', borderBottom:'1px solid #f8fafc' }}>
        <div style={{ height:5, background:'#f1f5f9', borderRadius:3, marginBottom:8 }}>
          <motion.div initial={{ width:0 }} animate={{ width:`${Math.round((doneCount/cfg.tasks.length)*100)}%`}} transition={{ duration:.5 }}
            style={{ height:'100%', background:`linear-gradient(90deg,${ac},${ac}cc)`, borderRadius:3 }} />
        </div>
      </div>
      <div style={{ padding:'10px 14px 14px', maxHeight:320, overflowY:'auto' }}>
        {!loaded ? <div style={{ textAlign:'center', color:'#94a3b8', padding:16, fontSize:12.5 }}>Loading…</div> : cfg.tasks.map((task,i) => (
          <motion.div key={i} onClick={()=>toggle(i)} whileTap={{ scale:.98 }}
            style={{ display:'flex',alignItems:'center',gap:10,padding:'9px 11px',borderRadius:10,cursor:'pointer',background:done[i]?`${ac}08`:'#f8fafc',border:`1px solid ${done[i]?ac+'25':'#e8edf3'}`,marginBottom:5,transition:'all .2s' }}>
            <div style={{ width:20,height:20,borderRadius:6,border:`2px solid ${done[i]?ac:'#cbd5e1'}`,background:done[i]?ac:'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,transition:'all .2s' }}>
              {done[i]&&<motion.span initial={{ scale:0 }} animate={{ scale:1 }} style={{ color:'#fff',fontSize:11,fontWeight:900 }}>✓</motion.span>}
            </div>
            <span style={{ fontSize:12.5,fontWeight:600,color:done[i]?'#94a3b8':'#374151',textDecoration:done[i]?'line-through':'none',transition:'all .2s' }}>{task}</span>
          </motion.div>
        ))}
        {doneCount===cfg.tasks.length&&doneCount>0&&(
          <motion.div initial={{ opacity:0,y:8 }} animate={{ opacity:1,y:0 }}
            style={{ marginTop:10,background:'#f0fdf4',border:'1.5px solid #bbf7d0',borderRadius:12,padding:'12px',textAlign:'center' }}>
            <div style={{ fontSize:28,marginBottom:4 }}>🎉</div>
            <div style={{ fontWeight:800,color:'#15803d',fontSize:14 }}>All daily tasks done!</div>
          </motion.div>
        )}
        <div style={{ fontSize:10.5, color:'#94a3b8', marginTop:10, textAlign:'center' }}>💾 Progress saves automatically and survives a refresh.</div>
      </div>
    </div>
  );
}

function LeavePanel({ user, ac }) {
  const [leaves, setLeaves]   = useState([]);
  const [showApply, setApply] = useState(false);
  const [form, setForm]       = useState({ type:'casual',from:'',to:'',reason:'' });
  const [saving, setSaving]   = useState(false);

  const load = () => leavesAPI.getAll().then(r=>setLeaves(r.data.data||[])).catch(()=>{});
  useEffect(()=>{ load(); },[user?._id]);

  const apply = async () => {
    if (!form.from||!form.to||!form.reason) { toast.error('Fill all fields'); return; }
    setSaving(true);
    try { await leavesAPI.apply(form); toast.success('Leave applied!'); setApply(false); setForm({type:'casual',from:'',to:'',reason:''}); load(); }
    catch(e) { toast.error(e.response?.data?.error||'Failed'); }
    setSaving(false);
  };

  return (
    <div style={{ background:'#fff', border:'1px solid #e8edf3', borderRadius:16, overflow:'hidden' }}>
      <div style={{ padding:'13px 18px', borderBottom:'1px solid #f1f5f9', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}><span style={{ fontSize:18 }}>🌴</span><span style={{ fontWeight:800, fontSize:14.5, color:'#0f172a' }}>My Leaves</span></div>
        <button onClick={()=>setApply(a=>!a)} style={{ padding:'5px 12px',borderRadius:8,border:`1px solid ${ac}`,background:`${ac}10`,color:ac,fontFamily:'inherit',fontSize:12,fontWeight:700,cursor:'pointer' }}>+ Apply</button>
      </div>
      {showApply&&(
        <div style={{ padding:'14px 16px',borderBottom:'1px solid #f1f5f9',background:'#f8fafc' }}>
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:9,marginBottom:9 }}>
            <div>
              <label style={{ display:'block',fontSize:10.5,fontWeight:700,color:'#374151',letterSpacing:.5,textTransform:'uppercase',marginBottom:4 }}>Type</label>
              <select value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))} style={{ width:'100%',padding:'8px 10px',border:'1.5px solid #e2e8f0',borderRadius:9,fontFamily:'inherit',fontSize:13,outline:'none',background:'#fff',boxSizing:'border-box' }}>
                {['casual','sick','earned','emergency','halfday','unpaid'].map(t=><option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
              </select>
            </div>
            <div/>
            <div>
              <label style={{ display:'block',fontSize:10.5,fontWeight:700,color:'#374151',letterSpacing:.5,textTransform:'uppercase',marginBottom:4 }}>From</label>
              <input type="date" value={form.from} onChange={e=>setForm(f=>({...f,from:e.target.value}))} style={{ width:'100%',padding:'8px 10px',border:'1.5px solid #e2e8f0',borderRadius:9,fontFamily:'inherit',fontSize:13,outline:'none',boxSizing:'border-box' }} />
            </div>
            <div>
              <label style={{ display:'block',fontSize:10.5,fontWeight:700,color:'#374151',letterSpacing:.5,textTransform:'uppercase',marginBottom:4 }}>To</label>
              <input type="date" value={form.to} onChange={e=>setForm(f=>({...f,to:e.target.value}))} style={{ width:'100%',padding:'8px 10px',border:'1.5px solid #e2e8f0',borderRadius:9,fontFamily:'inherit',fontSize:13,outline:'none',boxSizing:'border-box' }} />
            </div>
          </div>
          <textarea value={form.reason} onChange={e=>setForm(f=>({...f,reason:e.target.value}))} placeholder="Reason for leave…" rows={2}
            style={{ width:'100%',padding:'8px 10px',border:'1.5px solid #e2e8f0',borderRadius:9,fontFamily:'inherit',fontSize:13,outline:'none',resize:'none',boxSizing:'border-box',marginBottom:9 }} />
          <div style={{ display:'flex',gap:8 }}>
            <button onClick={()=>setApply(false)} style={{ flex:1,padding:'9px',borderRadius:9,border:'1.5px solid #e2e8f0',background:'#fff',fontFamily:'inherit',fontWeight:700,cursor:'pointer',fontSize:12 }}>Cancel</button>
            <button onClick={apply} disabled={saving} style={{ flex:2,padding:'9px',borderRadius:9,border:'none',background:ac,color:'#fff',fontFamily:'inherit',fontWeight:700,cursor:'pointer',fontSize:12 }}>{saving?'Submitting…':'Submit Leave'}</button>
          </div>
        </div>
      )}
      <div style={{ padding:'10px 14px 14px',maxHeight:220,overflowY:'auto' }}>
        {leaves.length===0?<div style={{ padding:'16px 0',textAlign:'center',color:'#94a3b8',fontSize:13 }}>No leave records yet</div>
        :leaves.slice(0,5).map(l=>{
          const sc={pending:{bg:'#fef3c7',c:'#92400e',i:'⏳'},approved:{bg:'#dcfce7',c:'#15803d',i:'✅'},rejected:{bg:'#fee2e2',c:'#dc2626',i:'❌'}}[l.status];
          return(
            <div key={l._id} style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 10px',background:'#f8fafc',borderRadius:9,marginBottom:5 }}>
              <div><div style={{ fontSize:12.5,fontWeight:700,color:'#0f172a' }}>{l.type} · {l.days}d</div><div style={{ fontSize:11,color:'#64748b' }}>{new Date(l.from).toLocaleDateString('en-IN',{day:'numeric',month:'short'})} – {new Date(l.to).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</div></div>
              <span style={{ padding:'2px 9px',borderRadius:20,fontSize:11.5,fontWeight:700,background:sc?.bg,color:sc?.c }}>{sc?.i} {l.status}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── MAIN ROLE-BASED DASHBOARD ─────────────────────────────────────────
function RequestLogPanel({ user, ac, role }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ category:'other', title:'', details:'', location:'', priority:'medium' });

  // Tailor the request categories slightly per role so the dropdown feels relevant
  const CATS_BY_ROLE = {
    pharmacist:    [['supply_request','📦 Stock/Supply Request'],['maintenance_request','🔧 Equipment Issue'],['other','📝 Other']],
    nurse:         [['supply_request','📦 Supply Request'],['incident_report','🚨 Incident Report'],['other','📝 Other']],
    receptionist:  [['incident_report','🚨 Incident Report'],['other','📝 Other']],
    ambulance_driver:[['maintenance_request','🔧 Vehicle Issue'],['incident_report','🚨 Incident Report'],['other','📝 Other']],
  };
  const cats = CATS_BY_ROLE[role] || [['maintenance_request','🔧 Maintenance Request'],['supply_request','📦 Supply Request'],['incident_report','🚨 Incident Report'],['other','📝 Other']];

  useEffect(() => {
    staffLogsAPI.getAll().then(r => { setLogs(r.data.data || []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { toast.error('Please describe the request'); return; }
    setSubmitting(true);
    try {
      const res = await staffLogsAPI.create(form);
      setLogs(l => [res.data.data, ...l]);
      setShowModal(false);
      setForm({ category:'other', title:'', details:'', location:'', priority:'medium' });
      toast.success('✅ Submitted!');
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to submit'); }
    setSubmitting(false);
  };

  const open = logs.filter(l => l.status !== 'resolved');

  return (
    <div style={{ background:'#fff', border:'1px solid #e8edf3', borderRadius:16, overflow:'hidden' }}>
      <div style={{ padding:'13px 18px', borderBottom:'1px solid #f1f5f9', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:18 }}>📝</span>
          <span style={{ fontWeight:800, fontSize:14.5, color:'#0f172a' }}>Requests & Reports</span>
        </div>
        <button onClick={()=>setShowModal(true)} style={{ background:ac, color:'#fff', border:'none', borderRadius:8, padding:'5px 12px', fontSize:11.5, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>+ New</button>
      </div>
      <div style={{ padding:'10px 14px 14px', maxHeight:260, overflowY:'auto' }}>
        {loading ? <div style={{ textAlign:'center', color:'#94a3b8', padding:16 }}>Loading…</div>
        : logs.length === 0 ? (
          <div style={{ textAlign:'center', padding:'20px 0', color:'#94a3b8' }}>
            <div style={{ fontSize:28, marginBottom:6 }}>📭</div>
            <div style={{ fontSize:12.5, fontWeight:600 }}>No requests logged yet</div>
          </div>
        ) : logs.map(l => (
          <div key={l._id} style={{ padding:'9px 11px', background:'#f8fafc', borderRadius:9, marginBottom:6 }}>
            <div style={{ display:'flex', justifyContent:'space-between', gap:8 }}>
              <div style={{ fontSize:12.5, fontWeight:700, color:'#374151' }}>{l.title}</div>
              <span style={{ fontSize:9.5, fontWeight:700, padding:'2px 7px', borderRadius:10, background:l.status==='resolved'?'#dcfce7':'#fef3c7', color:l.status==='resolved'?'#15803d':'#92400e', flexShrink:0 }}>{l.status==='resolved'?'✓ Resolved':'Open'}</span>
            </div>
            <div style={{ fontSize:10.5, color:'#94a3b8', marginTop:3 }}>{new Date(l.createdAt).toLocaleDateString('en-IN',{ day:'numeric', month:'short' })}</div>
          </div>
        ))}
        <div style={{ fontSize:10, color:'#94a3b8', marginTop:8, textAlign:'center' }}>{open.length} open of {logs.length} total</div>
      </div>

      {showModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:16 }} onClick={e=>{ if (e.target===e.currentTarget) setShowModal(false); }}>
          <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} style={{ background:'#fff', borderRadius:18, width:'100%', maxWidth:420, padding:22 }}>
            <h3 style={{ fontSize:16, fontWeight:800, margin:'0 0 16px' }}>📝 New Request / Report</h3>
            <form onSubmit={submit}>
              <div style={{ marginBottom:12 }}>
                <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#374151', marginBottom:5 }}>Type</label>
                <select value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))} style={{ width:'100%', padding:'9px 11px', border:'1.5px solid #e2e8f0', borderRadius:9, fontFamily:'inherit', fontSize:13 }}>
                  {cats.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div style={{ marginBottom:12 }}>
                <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#374151', marginBottom:5 }}>Description *</label>
                <input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} required style={{ width:'100%', padding:'9px 11px', border:'1.5px solid #e2e8f0', borderRadius:9, fontFamily:'inherit', fontSize:13, boxSizing:'border-box' }} />
              </div>
              <div style={{ marginBottom:12 }}>
                <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#374151', marginBottom:5 }}>Location</label>
                <input value={form.location} onChange={e=>setForm(f=>({...f,location:e.target.value}))} placeholder="e.g. Ward B, Pharmacy counter" style={{ width:'100%', padding:'9px 11px', border:'1.5px solid #e2e8f0', borderRadius:9, fontFamily:'inherit', fontSize:13, boxSizing:'border-box' }} />
              </div>
              <div style={{ marginBottom:16 }}>
                <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#374151', marginBottom:5 }}>Priority</label>
                <select value={form.priority} onChange={e=>setForm(f=>({...f,priority:e.target.value}))} style={{ width:'100%', padding:'9px 11px', border:'1.5px solid #e2e8f0', borderRadius:9, fontFamily:'inherit', fontSize:13 }}>
                  {['low','medium','high','urgent'].map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div style={{ display:'flex', gap:10 }}>
                <button type="button" onClick={()=>setShowModal(false)} style={{ flex:1, padding:'10px', borderRadius:10, border:'1.5px solid #e2e8f0', background:'#fff', fontFamily:'inherit', fontWeight:700, cursor:'pointer' }}>Cancel</button>
                <button type="submit" disabled={submitting} style={{ flex:2, padding:'10px', borderRadius:10, border:'none', background:ac, color:'#fff', fontFamily:'inherit', fontWeight:700, cursor:'pointer' }}>{submitting?'Submitting…':'Submit'}</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}

export default function RoleBasedDashboard() {
  const { user } = useAuth();
  const cfg = ROLE_CFG[user?.role] || ROLE_CFG.wardboy;
  const ac  = cfg.color;

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    socket.emit('join_user_room', user?._id);
    const mh = d => toast(`🔧 ${d.name} under maintenance`, { duration:6000, style:{background:'#fffbeb',border:'1px solid #fde68a',color:'#92400e'} });
    const th = d => toast.success(`📋 New task: ${d.title}`, { duration:5000 });
    socket.on('room_maintenance', mh);
    socket.on('task_assigned', th);
    return () => { socket.off('room_maintenance',mh); socket.off('task_assigned',th); };
  }, [user?._id]);

  return (
    <div style={{ fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap'); @keyframes spin{to{transform:rotate(360deg)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>

      {/* Role header */}
      <div style={{ background:`linear-gradient(135deg,${cfg.dark},${ac})`, borderRadius:18, padding:'20px 24px', marginBottom:20, position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute',top:-30,right:-30,width:160,height:160,borderRadius:'50%',background:'rgba(255,255,255,.07)',pointerEvents:'none' }}/>
        <div style={{ display:'flex',alignItems:'center',gap:16,position:'relative' }}>
          <motion.div animate={{ rotate:[0,5,-5,0] }} transition={{ duration:3,repeat:Infinity }}
            style={{ width:58,height:58,borderRadius:16,background:'rgba(255,255,255,.2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:26 }}>
            {cfg.icon}
          </motion.div>
          <div>
            <h1 style={{ color:'#fff',fontWeight:900,fontSize:20,margin:0 }}>{cfg.label} Dashboard</h1>
            <p style={{ color:'rgba(255,255,255,.7)',fontSize:13,margin:'3px 0 0' }}>{user?.name} · {user?.department||'Hospital'}</p>
            <div style={{ display:'flex',gap:7,marginTop:8,flexWrap:'wrap' }}>
              <div style={{ background:'rgba(255,255,255,.15)',borderRadius:11,padding:'4px 11px',fontSize:11.5,fontWeight:600,color:'#fff' }}>📅 {new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'short'})}</div>
              <div style={{ background:'rgba(255,255,255,.15)',borderRadius:11,padding:'4px 11px',fontSize:11.5,fontWeight:600,color:'#fff',fontFamily:'monospace' }}>🆔 {user?._id?.slice(-8)?.toUpperCase()}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid layout */}
      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:16 }}>
        <TodaySchedulePanel user={user} ac={ac} />
        <TasksPanel user={user} ac={ac} />
        <ChecklistPanel cfg={cfg} ac={ac} />
        <LeavePanel user={user} ac={ac} />
        <div style={{ gridColumn:'1 / -1' }}>
          <RequestLogPanel user={user} ac={ac} role={user?.role} />
        </div>
      </div>
    </div>
  );
}
