import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { facilityAPI, tasksAPI, leavesAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { getSocket } from '../utils/socket';
import toast from 'react-hot-toast';

const ROLE_CFG = {
  electrician:     { icon:'⚡', label:'Electrician',       color:'#f59e0b', dark:'#d97706', bg:'#fffbeb', tasks:['Check all electrical panels','Replace faulty switches','Test emergency lighting','Inspect generator backup','Fix short circuits','Install power outlets','Test UPS systems','Monthly safety audit'] },
  plumber:         { icon:'🔧', label:'Plumber',           color:'#0891b2', dark:'#0e7490', bg:'#e0f2fe', tasks:['Fix leaking taps','Unclog drainage','Check water pressure','Service hot water boilers','Replace faulty valves','Inspect sewage system','Fix broken flush','Check fire suppression line'] },
  it_technician:   { icon:'💻', label:'IT Technician',     color:'#6366f1', dark:'#4338ca', bg:'#e0e7ff', tasks:['Restart HMS server','Fix network issues','Update antivirus','Backup databases','Configure workstations','Troubleshoot PACS/RIS','Check CCTV feeds','Monitor server room temp'] },
  equipment_tech:  { icon:'🔩', label:'Equipment Tech',    color:'#8b5cf6', dark:'#7c3aed', bg:'#ede9fe', tasks:['Service ventilators','Calibrate ECG machines','Check defibrillators','Service anesthesia machines','Inspect surgical instruments','Test monitoring systems','Service infusion pumps','Equipment audit'] },
  biomedical:      { icon:'🩺', label:'Biomedical Eng.',   color:'#059669', dark:'#047857', bg:'#d1fae5', tasks:['Validate autoclave','Test MRI safety','Calibrate lab analyzers','Service X-ray','Inspect dialysis','Validate sterilization','Test oximeters','Compliance audit'] },
  security:        { icon:'🔐', label:'Security Officer',  color:'#374151', dark:'#1f2937', bg:'#f3f4f6', tasks:['Check CCTV cameras','Verify access control','Patrol perimeter','Monitor emergency exits','Check fire alarms','Visitor log audit','Secure medication storage','Night security rounds'] },
  receptionist:    { icon:'🏨', label:'Receptionist',      color:'#db2777', dark:'#be185d', bg:'#fce7f3', tasks:['Register patients','Update appointments','Handle queries','Coordinate departments','Manage visitor passes','Update records','Answer phones','Coordinate discharge'] },
  ambulance_driver:{ icon:'🚑', label:'Ambulance Driver',  color:'#dc2626', dark:'#b91c1c', bg:'#fee2e2', tasks:['Check fuel & oil','Test emergency equipment','Inspect first aid kit','Verify GPS & comms','Emergency readiness','Route planning','Update transport log','Vehicle maintenance'] },
  sweeper:         { icon:'🧹', label:'Sweeper',           color:'#d97706', dark:'#b45309', bg:'#fef3c7', tasks:['Mop ward corridors','Clean OT rooms','Sanitize bathrooms','Disinfect ICU','Empty waste bins','Clean waiting area','Mop emergency bay','Monthly deep clean'] },
};

const SHIFTS = {
  morning:   { label:'Morning',   time:'08:00–16:00', icon:'🌅', bg:'#dcfce7', c:'#15803d' },
  afternoon: { label:'Afternoon', time:'14:00–22:00', icon:'🌇', bg:'#fef3c7', c:'#92400e' },
  night:     { label:'Night',     time:'22:00–06:00', icon:'🌙', bg:'#e0e7ff', c:'#3730a3' },
  full:      { label:'Full Day',  time:'07:00–19:00', icon:'☀️', bg:'#f0f9ff', c:'#0369a1' },
};
const P_COLOR = { urgent:'#ef4444', high:'#f97316', medium:'#3b82f6', low:'#22c55e' };
const S_COLOR = { pending:'#f59e0b', in_progress:'#3b82f6', completed:'#22c55e', cancelled:'#94a3b8' };
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function getWeekDates(off=0){
  const now=new Date(), day=now.getDay();
  const mon=new Date(now); mon.setDate(now.getDate()-day+1+off*7);
  return Array.from({length:7},(_,i)=>{const d=new Date(mon);d.setDate(mon.getDate()+i);return d;});
}

export default function MaintenanceDashboard() {
  const { user } = useAuth();
  const [tasks, setTasks]           = useState([]);
  const [schedules, setSchedules]   = useState([]);
  const [leaveHistory, setLeaveHistory] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [activeTab, setActiveTab]   = useState('overview');
  const [weekOffset, setWeekOffset] = useState(0);
  const [completeModal, setCompleteModal] = useState(null); // task to complete
  const [completeNotes, setCompleteNotes] = useState('');
  const [leaveModal, setLeaveModal] = useState(false);
  const [leaveForm, setLeaveForm]   = useState({ type:'sick', from:'', to:'', reason:'' });
  const weekDates = getWeekDates(weekOffset);

  const cfg = ROLE_CFG[user?.role] || ROLE_CFG.electrician;
  const ac  = cfg.color;
  const userId = user?._id || user?.id;

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [tRes, sRes, lRes] = await Promise.allSettled([
        tasksAPI.getAll(),                                                        // backend scopes to current user
        facilityAPI.getSchedules({ userId, week: weekDates[0].toISOString() }),
        leavesAPI.getAll(),
      ]);
      if (tRes.status==='fulfilled') setTasks(tRes.value?.data?.data || []);
      else setTasks([]);
      if (sRes.status==='fulfilled') setSchedules(sRes.value?.data?.data || []);
      else setSchedules([]);
      if (lRes.status==='fulfilled') setLeaveHistory(lRes.value?.data?.data || []);
      else setLeaveHistory([]);
    } catch(e) {
      setError('Could not load dashboard data');
    }
    setLoading(false);
  }, [userId, weekOffset]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    socket.emit('join_user_room', userId);
    const onTask = (data) => { toast(`📋 New task: ${data.title}`, {duration:5000}); load(); };
    const onMaint = (data) => { toast(`🔧 Maintenance alert: ${data.name}`, {duration:5000,style:{background:'#fffbeb',border:'1px solid #fde68a',color:'#92400e'}}); };
    socket.on('task_assigned', onTask);
    socket.on('room_maintenance', onMaint);
    return () => { socket.off('task_assigned', onTask); socket.off('room_maintenance', onMaint); };
  }, [userId, load]);

  const startTask = async (id) => {
    try {
      await tasksAPI.update(id, { status:'in_progress' });
      setTasks(ts => ts.map(t => t._id===id ? {...t, status:'in_progress'} : t));
      toast.success('▶ Task started!');
    } catch { toast.error('Failed to update'); }
  };

  const completeTask = async () => {
    if (!completeModal) return;
    try {
      await tasksAPI.update(completeModal._id, { status:'completed', notes: completeNotes, completedAt: new Date() });
      setTasks(ts => ts.map(t => t._id===completeModal._id ? {...t, status:'completed', notes:completeNotes} : t));
      toast.success('✅ Task completed!');
      setCompleteModal(null); setCompleteNotes('');
    } catch { toast.error('Failed to update'); }
  };

  const applyLeave = async () => {
    if (!leaveForm.from||!leaveForm.to||!leaveForm.reason) { toast.error('Fill all fields'); return; }
    try {
      await leavesAPI.apply(leaveForm);
      toast.success('Leave applied!'); setLeaveModal(false);
      setLeaveForm({ type:'sick', from:'', to:'', reason:'' }); load();
    } catch(e) { toast.error(e.response?.data?.error||'Failed'); }
  };

  const today = new Date().toDateString();
  const todaySchedules = schedules.filter(s => new Date(s.date).toDateString()===today);
  const pendingTasks   = tasks.filter(t => t.status==='pending');
  const activeTasks    = tasks.filter(t => t.status==='in_progress');
  const doneTasks      = tasks.filter(t => t.status==='completed');
  const urgentTasks    = tasks.filter(t => t.priority==='urgent' && t.status!=='completed');

  const TABS = [
    { id:'overview', label:'Overview',    icon:'📊' },
    { id:'tasks',    label:'My Tasks',    icon:'📋', badge: pendingTasks.length + activeTasks.length },
    { id:'schedule', label:'Schedule',    icon:'📅' },
    { id:'leaves',   label:'My Leaves',   icon:'🌴' },
  ];

  return (
    <div style={{fontFamily:"'Inter',system-ui,sans-serif",minHeight:'100vh',background:'#f8fafc'}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap'); *{box-sizing:border-box}`}</style>

      {/* Hero header */}
      <div style={{background:`linear-gradient(135deg,${cfg.dark} 0%,${ac} 100%)`,padding:'24px 28px',marginBottom:24,position:'relative',overflow:'hidden',borderRadius:20}}>
        <div style={{position:'absolute',top:-40,right:-40,width:220,height:220,borderRadius:'50%',background:'rgba(255,255,255,.08)',pointerEvents:'none'}}/>
        <div style={{position:'absolute',bottom:-30,left:300,width:160,height:160,borderRadius:'50%',background:'rgba(255,255,255,.05)',pointerEvents:'none'}}/>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:16,position:'relative'}}>
          <div style={{display:'flex',alignItems:'center',gap:16}}>
            <motion.div animate={{rotate:[0,5,-5,0]}} transition={{duration:3,repeat:Infinity}}
              style={{width:60,height:60,borderRadius:18,background:'rgba(255,255,255,.2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:28}}>
              {cfg.icon}
            </motion.div>
            <div>
              <h1 style={{color:'#fff',fontWeight:900,fontSize:22,margin:0}}>{cfg.label} Dashboard</h1>
              <p style={{color:'rgba(255,255,255,.7)',margin:0,fontSize:13}}>Welcome, {user?.name?.split(' ')[0]} · {new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'})}</p>
            </div>
          </div>
          <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
            {[
              {label:'Active Tasks', val:activeTasks.length, icon:'▶️', bg:'rgba(255,255,255,.15)'},
              {label:'Pending',      val:pendingTasks.length, icon:'⏳', bg:'rgba(255,255,255,.15)'},
              {label:'Completed',    val:doneTasks.length,    icon:'✅', bg:'rgba(255,255,255,.15)'},
            ].map((s,i)=>(
              <div key={i} style={{background:s.bg,borderRadius:12,padding:'12px 16px',textAlign:'center',backdropFilter:'blur(10px)'}}>
                <div style={{fontSize:20,marginBottom:2}}>{s.icon}</div>
                <div style={{color:'#fff',fontWeight:800,fontSize:20}}>{s.val}</div>
                <div style={{color:'rgba(255,255,255,.7)',fontSize:11}}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Urgent banner */}
      {urgentTasks.length > 0 && (
        <motion.div initial={{opacity:0,y:-10}} animate={{opacity:1,y:0}}
          style={{background:'linear-gradient(135deg,#fef2f2,#fff7ed)',border:'1px solid #fecaca',borderRadius:14,padding:'14px 20px',marginBottom:20,display:'flex',alignItems:'center',gap:12}}>
          <motion.div animate={{scale:[1,1.2,1]}} transition={{duration:1,repeat:Infinity}} style={{fontSize:24}}>🚨</motion.div>
          <div style={{flex:1}}>
            <div style={{fontWeight:800,color:'#dc2626',fontSize:14}}>Urgent Tasks Require Immediate Attention</div>
            <div style={{color:'#ef4444',fontSize:12.5,marginTop:2}}>{urgentTasks.map(t=>t.title).join(' · ')}</div>
          </div>
          <button onClick={()=>setActiveTab('tasks')} style={{padding:'7px 14px',background:'#dc2626',border:'none',borderRadius:8,color:'#fff',fontWeight:700,fontSize:12.5,cursor:'pointer'}}>View Tasks →</button>
        </motion.div>
      )}

      {/* Error */}
      {error && !loading && (
        <div style={{background:'#fef2f2',border:'1px solid #fecaca',borderRadius:12,padding:'14px 18px',marginBottom:18,display:'flex',alignItems:'center',gap:10}}>
          <span>⚠️</span>
          <div style={{flex:1,color:'#dc2626',fontSize:13}}>{error}</div>
          <button onClick={load} style={{padding:'6px 12px',background:'#dc2626',color:'#fff',border:'none',borderRadius:7,cursor:'pointer',fontSize:12,fontWeight:700}}>Retry</button>
        </div>
      )}

      {/* Tabs */}
      <div style={{display:'flex',gap:4,marginBottom:20,background:'#fff',padding:4,borderRadius:13,border:'1px solid #e2e8f0',width:'fit-content'}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setActiveTab(t.id)}
            style={{padding:'9px 16px',borderRadius:10,border:'none',fontWeight:700,fontSize:13,cursor:'pointer',transition:'all .18s',background:activeTab===t.id?`linear-gradient(135deg,${ac},${cfg.dark})`:'transparent',color:activeTab===t.id?'#fff':'#64748b',display:'flex',alignItems:'center',gap:6,position:'relative'}}>
            {t.icon} {t.label}
            {t.badge>0&&<span style={{position:'absolute',top:-6,right:-4,background:'#dc2626',color:'#fff',fontSize:9,fontWeight:800,padding:'1px 5px',borderRadius:10,minWidth:16,textAlign:'center'}}>{t.badge}</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{display:'flex',justifyContent:'center',padding:'60px 0',flexDirection:'column',alignItems:'center',gap:12}}>
          <motion.div animate={{rotate:360}} transition={{duration:1,repeat:Infinity,ease:'linear'}}
            style={{width:36,height:36,border:'3px solid #e2e8f0',borderTopColor:ac,borderRadius:'50%'}}/>
          <span style={{color:'#94a3b8',fontSize:13}}>Loading dashboard…</span>
        </div>
      ) : (
        <>
          {/* ── OVERVIEW ── */}
          {activeTab==='overview'&&(
            <div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))',gap:16,marginBottom:24}}>
                {/* Today's shift */}
                <div style={{background:'#fff',borderRadius:16,padding:'20px',border:'1px solid #e2e8f0'}}>
                  <div style={{fontWeight:800,fontSize:15,marginBottom:14,color:'#0f172a'}}>📅 Today's Shift</div>
                  {todaySchedules.length===0 ? (
                    <div style={{textAlign:'center',padding:'20px 0',color:'#94a3b8',fontSize:13}}>No shifts scheduled today</div>
                  ) : todaySchedules.map(s=>{
                    const sh=SHIFTS[s.shift]||SHIFTS.morning;
                    return (
                      <div key={s._id} style={{background:sh.bg,border:`1px solid ${sh.c}30`,borderRadius:12,padding:'14px'}}>
                        <div style={{fontWeight:800,fontSize:16,color:sh.c}}>{sh.icon} {sh.label} Shift</div>
                        <div style={{color:sh.c,fontSize:13,opacity:.8,marginTop:2}}>{sh.time}</div>
                        {s.task&&<div style={{marginTop:8,fontSize:13,color:'#374151',fontWeight:500}}>{s.task}</div>}
                        {s.notes&&<div style={{fontSize:12,color:'#64748b',marginTop:4}}>{s.notes}</div>}
                      </div>
                    );
                  })}
                </div>

                {/* Quick task stats */}
                <div style={{background:'#fff',borderRadius:16,padding:'20px',border:'1px solid #e2e8f0'}}>
                  <div style={{fontWeight:800,fontSize:15,marginBottom:14,color:'#0f172a'}}>📋 Task Summary</div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                    {[
                      {l:'Urgent',    v:urgentTasks.length,  c:'#ef4444', bg:'#fef2f2'},
                      {l:'Pending',   v:pendingTasks.length, c:'#f59e0b', bg:'#fef3c7'},
                      {l:'In Progress',v:activeTasks.length, c:'#3b82f6', bg:'#dbeafe'},
                      {l:'Completed', v:doneTasks.length,    c:'#22c55e', bg:'#dcfce7'},
                    ].map((s,i)=>(
                      <div key={i} style={{background:s.bg,borderRadius:10,padding:'12px',textAlign:'center',cursor:'pointer'}} onClick={()=>setActiveTab('tasks')}>
                        <div style={{fontSize:22,fontWeight:900,color:s.c}}>{s.v}</div>
                        <div style={{fontSize:11.5,color:s.c,fontWeight:600,opacity:.8}}>{s.l}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Routine checklist */}
              <div style={{background:'#fff',borderRadius:16,padding:'20px',border:'1px solid #e2e8f0'}}>
                <div style={{fontWeight:800,fontSize:15,marginBottom:14,color:'#0f172a'}}>{cfg.icon} Standard {cfg.label} Duties</div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:10}}>
                  {cfg.tasks.map((task,i)=>(
                    <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',background:cfg.bg,border:`1px solid ${ac}20`,borderRadius:10}}>
                      <div style={{width:20,height:20,borderRadius:'50%',background:`${ac}25`,border:`1.5px solid ${ac}50`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:10,color:ac,fontWeight:800}}>{i+1}</div>
                      <span style={{fontSize:13,color:'#374151',fontWeight:500}}>{task}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── MY TASKS ── */}
          {activeTab==='tasks'&&(
            <div>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16,flexWrap:'wrap',gap:10}}>
                <h2 style={{fontSize:17,fontWeight:800,color:'#0f172a',margin:0}}>My Assigned Tasks</h2>
                <div style={{fontSize:12.5,color:'#94a3b8'}}>{tasks.length} total · {pendingTasks.length+activeTasks.length} active</div>
              </div>
              {tasks.length===0 ? (
                <div style={{background:'#fff',borderRadius:16,padding:'48px',textAlign:'center',border:'1px solid #e2e8f0'}}>
                  <div style={{fontSize:40,marginBottom:12}}>📋</div>
                  <div style={{fontSize:16,fontWeight:700,color:'#0f172a'}}>No tasks assigned yet</div>
                  <div style={{fontSize:13,color:'#94a3b8',marginTop:6}}>Tasks assigned by admin will appear here.</div>
                </div>
              ) : (
                <div style={{display:'flex',flexDirection:'column',gap:12}}>
                  {tasks.map(t=>(
                    <motion.div key={t._id} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}}
                      style={{background:'#fff',borderRadius:14,padding:'16px 20px',border:'1px solid #e2e8f0',borderLeft:`4px solid ${P_COLOR[t.priority]||'#94a3b8'}`,boxShadow:'0 1px 4px rgba(0,0,0,.04)'}}>
                      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:6}}>
                            <span style={{fontWeight:700,fontSize:15,color:'#0f172a'}}>{t.title}</span>
                            <span style={{fontSize:10.5,fontWeight:700,padding:'2px 8px',borderRadius:8,background:`${P_COLOR[t.priority]}20`,color:P_COLOR[t.priority]}}>{t.priority?.toUpperCase()}</span>
                            <span style={{fontSize:10.5,fontWeight:700,padding:'2px 8px',borderRadius:8,background:`${S_COLOR[t.status]}20`,color:S_COLOR[t.status]}}>{t.status?.replace('_',' ')}</span>
                          </div>
                          {t.description&&<p style={{fontSize:13,color:'#64748b',margin:'0 0 8px',lineHeight:1.5}}>{t.description}</p>}
                          <div style={{display:'flex',gap:14,fontSize:12,color:'#94a3b8',flexWrap:'wrap'}}>
                            {t.assignedBy?.name&&<span>👤 Assigned by {t.assignedBy.name}</span>}
                            {t.dueDate&&<span style={{color:new Date(t.dueDate)<new Date()&&t.status!=='completed'?'#dc2626':'#94a3b8'}}>📅 Due {new Date(t.dueDate).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</span>}
                            {t.createdAt&&<span>🕐 {new Date(t.createdAt).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</span>}
                            {t.notes&&<span>📝 {t.notes}</span>}
                          </div>
                        </div>
                        <div style={{display:'flex',gap:6,flexShrink:0}}>
                          {t.status==='pending'&&<button onClick={()=>startTask(t._id)} style={{padding:'7px 13px',background:'#dbeafe',border:'none',borderRadius:8,color:'#1d4ed8',fontWeight:700,fontSize:12.5,cursor:'pointer'}}>▶ Start</button>}
                          {t.status==='in_progress'&&<button onClick={()=>setCompleteModal(t)} style={{padding:'7px 13px',background:'#d1fae5',border:'none',borderRadius:8,color:'#065f46',fontWeight:700,fontSize:12.5,cursor:'pointer'}}>✅ Complete</button>}
                          {t.status==='completed'&&<span style={{padding:'7px 13px',background:'#dcfce7',border:'1px solid #86efac',borderRadius:8,color:'#15803d',fontWeight:700,fontSize:12.5}}>✓ Done</span>}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── SCHEDULE ── */}
          {activeTab==='schedule'&&(
            <div>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16,flexWrap:'wrap',gap:10}}>
                <h2 style={{fontSize:17,fontWeight:800,color:'#0f172a',margin:0}}>My Weekly Schedule</h2>
                <div style={{display:'flex',gap:8}}>
                  <button onClick={()=>setWeekOffset(o=>o-1)} style={{padding:'7px 14px',background:'#f1f5f9',border:'1px solid #e2e8f0',borderRadius:9,cursor:'pointer',fontSize:13,fontWeight:600,color:'#475569'}}>‹ Prev</button>
                  <button onClick={()=>setWeekOffset(0)} style={{padding:'7px 14px',background:weekOffset===0?`${ac}20`:'#f1f5f9',border:`1px solid ${weekOffset===0?ac:'#e2e8f0'}`,borderRadius:9,cursor:'pointer',fontSize:13,fontWeight:600,color:weekOffset===0?ac:'#475569'}}>Today</button>
                  <button onClick={()=>setWeekOffset(o=>o+1)} style={{padding:'7px 14px',background:'#f1f5f9',border:'1px solid #e2e8f0',borderRadius:9,cursor:'pointer',fontSize:13,fontWeight:600,color:'#475569'}}>Next ›</button>
                </div>
              </div>
              <div style={{background:'#fff',borderRadius:16,border:'1px solid #e2e8f0',overflow:'hidden'}}>
                <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',borderBottom:'2px solid #e2e8f0'}}>
                  {weekDates.map((d,i)=>{
                    const isToday=d.toDateString()===today;
                    return (
                      <div key={i} style={{padding:'12px 8px',textAlign:'center',background:isToday?`${ac}10`:'#f8fafc',borderRight:i<6?'1px solid #e2e8f0':'none'}}>
                        <div style={{fontSize:10,fontWeight:700,color:isToday?ac:'#94a3b8',textTransform:'uppercase'}}>{DAYS[d.getDay()]}</div>
                        <div style={{fontSize:18,fontWeight:900,color:isToday?ac:'#0f172a',marginTop:2}}>{d.getDate()}</div>
                        {isToday&&<div style={{width:6,height:6,borderRadius:'50%',background:ac,margin:'4px auto 0'}}/>}
                      </div>
                    );
                  })}
                </div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',minHeight:120}}>
                  {weekDates.map((d,i)=>{
                    const isToday=d.toDateString()===today;
                    const dayS=schedules.filter(s=>new Date(s.date).toDateString()===d.toDateString());
                    return (
                      <div key={i} style={{padding:'8px',background:isToday?`${ac}05`:'#fff',borderRight:i<6?'1px solid #f1f5f9':'none',minHeight:100}}>
                        {dayS.map(s=>{
                          const sh=SHIFTS[s.shift]||SHIFTS.morning;
                          return (
                            <div key={s._id} style={{padding:'5px 7px',background:sh.bg,border:`1px solid ${sh.c}30`,borderRadius:7,marginBottom:4}}>
                              <div style={{fontSize:10.5,fontWeight:700,color:sh.c}}>{sh.icon} {sh.label}</div>
                              <div style={{fontSize:9.5,color:sh.c,opacity:.75}}>{sh.time}</div>
                              {s.task&&<div style={{fontSize:9.5,color:sh.c,opacity:.7,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{s.task}</div>}
                            </div>
                          );
                        })}
                        {dayS.length===0&&<div style={{height:'100%',display:'flex',alignItems:'center',justifyContent:'center',color:'#e2e8f0',fontSize:18}}>—</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── LEAVES ── */}
          {activeTab==='leaves'&&(
            <div>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
                <h2 style={{fontSize:17,fontWeight:800,color:'#0f172a',margin:0}}>My Leaves</h2>
                <button onClick={()=>setLeaveModal(true)} style={{padding:'9px 18px',background:`linear-gradient(135deg,${ac},${cfg.dark})`,border:'none',borderRadius:10,color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer'}}>+ Apply Leave</button>
              </div>
              {leaveHistory.length===0 ? (
                <div style={{background:'#fff',borderRadius:16,padding:'48px',textAlign:'center',border:'1px solid #e2e8f0'}}>
                  <div style={{fontSize:36,marginBottom:10}}>🌴</div>
                  <div style={{fontSize:15,fontWeight:700,color:'#0f172a'}}>No leave history</div>
                  <div style={{fontSize:13,color:'#94a3b8',marginTop:6}}>Your leave applications will appear here.</div>
                </div>
              ) : (
                <div style={{display:'flex',flexDirection:'column',gap:10}}>
                  {leaveHistory.map(l=>{
                    const statusColor={pending:'#f59e0b',approved:'#22c55e',rejected:'#ef4444',cancelled:'#94a3b8'}[l.status]||'#94a3b8';
                    return (
                      <div key={l._id} style={{background:'#fff',borderRadius:12,padding:'14px 18px',border:'1px solid #e2e8f0',display:'flex',alignItems:'center',gap:14,flexWrap:'wrap'}}>
                        <div style={{width:40,height:40,borderRadius:11,background:`${statusColor}20`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,flexShrink:0}}>🌴</div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontWeight:700,fontSize:14,color:'#0f172a',marginBottom:3}}>{l.type?.charAt(0).toUpperCase()+l.type?.slice(1)} Leave</div>
                          <div style={{fontSize:12.5,color:'#64748b'}}>{new Date(l.from).toLocaleDateString('en-IN',{day:'numeric',month:'short'})} – {new Date(l.to).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</div>
                          {l.reason&&<div style={{fontSize:12,color:'#94a3b8',marginTop:2}}>{l.reason}</div>}
                        </div>
                        <span style={{padding:'4px 12px',borderRadius:8,background:`${statusColor}20`,color:statusColor,fontWeight:700,fontSize:12.5,flexShrink:0}}>{l.status?.charAt(0).toUpperCase()+l.status?.slice(1)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Complete task modal */}
      <AnimatePresence>
        {completeModal&&(
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',zIndex:100,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}
            onClick={()=>setCompleteModal(null)}>
            <motion.div initial={{scale:.95}} animate={{scale:1}} exit={{scale:.95}} onClick={e=>e.stopPropagation()}
              style={{background:'#fff',borderRadius:18,padding:'26px',width:'100%',maxWidth:420}}>
              <h3 style={{margin:'0 0 16px',fontSize:17,fontWeight:800,color:'#0f172a'}}>✅ Complete Task</h3>
              <p style={{color:'#64748b',fontSize:13.5,marginBottom:16}}><strong>{completeModal.title}</strong></p>
              <label style={{display:'block',fontSize:12,fontWeight:700,color:'#374151',marginBottom:6}}>Completion notes (optional)</label>
              <textarea value={completeNotes} onChange={e=>setCompleteNotes(e.target.value)} rows={3} placeholder="What was done, any issues encountered…"
                style={{width:'100%',padding:'10px',border:'1.5px solid #e2e8f0',borderRadius:9,fontSize:13.5,outline:'none',resize:'vertical'}}/>
              <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:16}}>
                <button onClick={()=>setCompleteModal(null)} style={{padding:'9px 18px',background:'#f1f5f9',border:'1px solid #e2e8f0',borderRadius:9,fontSize:13.5,fontWeight:600,cursor:'pointer',color:'#475569'}}>Cancel</button>
                <button onClick={completeTask} style={{padding:'9px 18px',background:'linear-gradient(135deg,#059669,#047857)',border:'none',borderRadius:9,color:'#fff',fontSize:13.5,fontWeight:700,cursor:'pointer'}}>✅ Mark Complete</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Leave modal */}
      <AnimatePresence>
        {leaveModal&&(
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',zIndex:100,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}
            onClick={()=>setLeaveModal(false)}>
            <motion.div initial={{scale:.95}} animate={{scale:1}} exit={{scale:.95}} onClick={e=>e.stopPropagation()}
              style={{background:'#fff',borderRadius:18,padding:'26px',width:'100%',maxWidth:420}}>
              <h3 style={{margin:'0 0 18px',fontSize:17,fontWeight:800,color:'#0f172a'}}>🌴 Apply Leave</h3>
              <div style={{display:'flex',flexDirection:'column',gap:12}}>
                <div>
                  <label style={{display:'block',fontSize:12,fontWeight:700,color:'#374151',marginBottom:5}}>Leave Type</label>
                  <select value={leaveForm.type} onChange={e=>setLeaveForm(f=>({...f,type:e.target.value}))} style={{width:'100%',padding:'10px',border:'1.5px solid #e2e8f0',borderRadius:9,fontSize:13.5,outline:'none'}}>
                    <option value="sick">Sick Leave</option>
                    <option value="casual">Casual Leave</option>
                    <option value="emergency">Emergency Leave</option>
                    <option value="annual">Annual Leave</option>
                  </select>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                  <div>
                    <label style={{display:'block',fontSize:12,fontWeight:700,color:'#374151',marginBottom:5}}>From *</label>
                    <input type="date" value={leaveForm.from} onChange={e=>setLeaveForm(f=>({...f,from:e.target.value}))} style={{width:'100%',padding:'10px',border:'1.5px solid #e2e8f0',borderRadius:9,fontSize:13.5,outline:'none'}}/>
                  </div>
                  <div>
                    <label style={{display:'block',fontSize:12,fontWeight:700,color:'#374151',marginBottom:5}}>To *</label>
                    <input type="date" value={leaveForm.to} onChange={e=>setLeaveForm(f=>({...f,to:e.target.value}))} style={{width:'100%',padding:'10px',border:'1.5px solid #e2e8f0',borderRadius:9,fontSize:13.5,outline:'none'}}/>
                  </div>
                </div>
                <div>
                  <label style={{display:'block',fontSize:12,fontWeight:700,color:'#374151',marginBottom:5}}>Reason *</label>
                  <textarea value={leaveForm.reason} onChange={e=>setLeaveForm(f=>({...f,reason:e.target.value}))} rows={2} placeholder="Reason for leave…"
                    style={{width:'100%',padding:'10px',border:'1.5px solid #e2e8f0',borderRadius:9,fontSize:13.5,outline:'none',resize:'vertical'}}/>
                </div>
                <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
                  <button onClick={()=>setLeaveModal(false)} style={{padding:'9px 18px',background:'#f1f5f9',border:'1px solid #e2e8f0',borderRadius:9,fontSize:13.5,fontWeight:600,cursor:'pointer',color:'#475569'}}>Cancel</button>
                  <button onClick={applyLeave} style={{padding:'9px 18px',background:`linear-gradient(135deg,${ac},${cfg.dark})`,border:'none',borderRadius:9,color:'#fff',fontSize:13.5,fontWeight:700,cursor:'pointer'}}>Apply Leave</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
