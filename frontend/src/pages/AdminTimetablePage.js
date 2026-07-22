import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { facilityAPI, usersAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const SHIFT_CFG = {
  morning:   { label:'Morning',   time:'08:00–16:00', icon:'🌅', bg:'#dcfce7', text:'#15803d', border:'#86efac' },
  afternoon: { label:'Afternoon', time:'14:00–22:00', icon:'🌇', bg:'#fef3c7', text:'#92400e', border:'#fcd34d' },
  night:     { label:'Night',     time:'22:00–06:00', icon:'🌙', bg:'#e0e7ff', text:'#3730a3', border:'#a5b4fc' },
  full:      { label:'Full Day',  time:'07:00–19:00', icon:'☀️', bg:'#f0f9ff', text:'#0369a1', border:'#7dd3fc' },
};
const ROLE_COLORS = { admin:'#6366f1',doctor:'#0891b2',nurse:'#db2777',pharmacist:'#d97706',wardboy:'#059669',sweeper:'#f59e0b',electrician:'#f59e0b',plumber:'#0891b2',it_technician:'#6366f1',equipment_tech:'#8b5cf6',biomedical:'#059669',security:'#374151',receptionist:'#db2777',ambulance_driver:'#dc2626',finance:'#8b5cf6',lab_technician:'#0d9488',radiology_tech:'#0e7490',dialysis_tech:'#be123c' };
const DAYS_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function getWeekDates(off=0){
  const now=new Date(), day=now.getDay();
  const mon=new Date(now); mon.setDate(now.getDate()-day+1+off*7);
  return Array.from({length:7},(_,i)=>{const d=new Date(mon);d.setDate(mon.getDate()+i);return d;});
}

export default function AdminTimetablePage() {
  const { user } = useAuth();
  const [tab, setTab]               = useState('all');
  const [weekOffset, setWeekOffset] = useState(0);
  const [schedules, setSchedules]   = useState([]);
  const [mySchedules, setMySchedules] = useState([]);
  const [users, setUsers]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [filterRole, setFilterRole] = useState('all');
  const [filterUser, setFilterUser] = useState('all');
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [showCreate, setShowCreate] = useState(null);
  const [createForm, setCreateForm] = useState({ userId:'', shift:'morning', date:'', task:'', notes:'' });
  const [creating, setCreating]     = useState(false);
  const [generating, setGenerating] = useState(false);
  const weekDates = getWeekDates(weekOffset);
  const today = new Date().toDateString();
  const adminId = user?._id || user?.id;

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const week = weekDates[0].toISOString();
      const [allRes, myRes, uRes] = await Promise.allSettled([
        facilityAPI.getSchedules({ week }),                        // admin gets all
        facilityAPI.getSchedules({ userId: adminId, week }),       // admin's own
        usersAPI.getAll({ status:'approved', limit:300 }),
      ]);
      if (allRes.status==='fulfilled') setSchedules(allRes.value?.data?.data||[]);
      else setSchedules([]);
      if (myRes.status==='fulfilled') setMySchedules(myRes.value?.data?.data||[]);
      else setMySchedules([]);
      if (uRes.status==='fulfilled') setUsers(uRes.value?.data?.data||[]);
    } catch { setError('Failed to load timetable'); }
    setLoading(false);
  }, [weekOffset, adminId]);

  useEffect(() => { load(); }, [load]);

  const createSchedule = async () => {
    const uid = createForm.userId || showCreate?.userId;
    if (!uid||!createForm.date||!createForm.shift) { toast.error('Fill required fields'); return; }
    setCreating(true);
    try {
      const staffUser = users.find(u=>u._id===uid);
      await facilityAPI.createSchedule({ user:uid, shift:createForm.shift, date:createForm.date, task:createForm.task, notes:createForm.notes, role:staffUser?.role||'' });
      toast.success('✅ Schedule created!');
      setShowCreate(null); setCreateForm({userId:'',shift:'morning',date:'',task:'',notes:''});
      load();
    } catch(e) { toast.error(e.response?.data?.error||'Failed'); }
    setCreating(false);
  };

  const deleteSchedule = async (id) => {
    if (!window.confirm('Delete this schedule?')) return;
    try { await facilityAPI.deleteSchedule(id); toast.success('Deleted'); setSelectedSchedule(null); load(); }
    catch { toast.error('Delete failed'); }
  };

  const generateRoutine = async (overwrite) => {
    const msg = overwrite
      ? 'This will REPLACE existing shift assignments for this week (approved leave days are preserved) and randomly assign new shifts to every staff member. Continue?'
      : 'This will randomly assign a Mon–Sun shift routine to every staff member for any day they don\'t already have a schedule (leave days are skipped). Continue?';
    if (!window.confirm(msg)) return;
    setGenerating(true);
    try {
      const res = await facilityAPI.generateRoutine(weekDates[0].toISOString(), overwrite);
      toast.success(`✅ ${res.data.message}`);
      load();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed to generate routine'); }
    setGenerating(false);
  };

  // Filter all-staff schedules
  const filtered = schedules.filter(s => {
    if (filterRole!=='all' && s.user?.role!==filterRole) return false;
    if (filterUser!=='all' && (s.user?._id||s.user)!==filterUser) return false;
    return true;
  });

  // Group by user
  const byUser = {};
  filtered.forEach(s => {
    const uid = s.user?._id||s.user;
    if (!byUser[uid]) byUser[uid]={ user:s.user, slots:{} };
    const dk = new Date(s.date).toDateString();
    if (!byUser[uid].slots[dk]) byUser[uid].slots[dk]=[];
    byUser[uid].slots[dk].push(s);
  });

  // Admin's own schedules grouped by day
  const myByDay = {};
  mySchedules.forEach(s => {
    const dk = new Date(s.date).toDateString();
    if (!myByDay[dk]) myByDay[dk]=[];
    myByDay[dk].push(s);
  });

  const allRoles = [...new Set(users.map(u=>u.role))].sort();

  return (
    <div style={{padding:'24px',fontFamily:"'Inter',system-ui,sans-serif",maxWidth:1400,margin:'0 auto'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:22,flexWrap:'wrap',gap:12}}>
        <div>
          <h1 style={{fontSize:24,fontWeight:900,color:'#0f172a',margin:0}}>📆 Timetable Management</h1>
          <p style={{color:'#94a3b8',fontSize:13,marginTop:4}}>{tab==='all'?'All staff schedules':'Your personal schedule'} · Routine buttons apply to the week shown below ({weekDates[0].toLocaleDateString('en-IN',{day:'numeric',month:'short'})} – {weekDates[6].toLocaleDateString('en-IN',{day:'numeric',month:'short'})})</p>
        </div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          <button onClick={()=>generateRoutine(false)} disabled={generating} style={{padding:'9px 16px',background:'#fff',border:'1.5px solid #c4b5fd',borderRadius:10,color:'#7c3aed',fontSize:13,fontWeight:700,cursor:generating?'not-allowed':'pointer',opacity:generating?.6:1}}>
            {generating?'⏳ Generating…':'🎲 Fill Empty Days'}
          </button>
          <button onClick={()=>generateRoutine(true)} disabled={generating} style={{padding:'9px 16px',background:'linear-gradient(135deg,#7c3aed,#a855f7)',border:'none',borderRadius:10,color:'#fff',fontSize:13,fontWeight:700,cursor:generating?'not-allowed':'pointer',opacity:generating?.6:1}}>
            {generating?'⏳ Generating…':'🔄 Regenerate Week'}
          </button>
          <button onClick={()=>setShowCreate({date:new Date().toISOString().split('T')[0]})} style={{padding:'9px 18px',background:'linear-gradient(135deg,#1648c9,#0891b2)',border:'none',borderRadius:10,color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer'}}>+ Add Schedule</button>
          <button onClick={load} style={{padding:'9px 14px',background:'#f1f5f9',border:'1px solid #e2e8f0',borderRadius:10,color:'#475569',fontSize:13,cursor:'pointer'}}>🔄</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:'flex',gap:4,marginBottom:18,background:'#f1f5f9',padding:4,borderRadius:12,width:'fit-content'}}>
        {[{id:'all',l:'👥 All Staff'},{id:'mine',l:'🗓️ My Schedule'}].map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{padding:'8px 18px',borderRadius:9,border:'none',fontWeight:700,fontSize:13,cursor:'pointer',background:tab===t.id?'#fff':'transparent',color:tab===t.id?'#1648c9':'#64748b',boxShadow:tab===t.id?'0 1px 6px rgba(0,0,0,.09)':'none'}}>{t.l}</button>
        ))}
      </div>

      {/* Week nav */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16,background:'#fff',border:'1px solid #e2e8f0',borderRadius:14,padding:'12px 20px'}}>
        <button onClick={()=>setWeekOffset(o=>o-1)} style={{padding:'7px 14px',background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:9,cursor:'pointer',fontSize:13,fontWeight:600,color:'#475569'}}>‹ Prev</button>
        <div style={{textAlign:'center'}}>
          <div style={{fontWeight:800,fontSize:15,color:'#0f172a'}}>{weekDates[0].getDate()} {MONTHS[weekDates[0].getMonth()]} – {weekDates[6].getDate()} {MONTHS[weekDates[6].getMonth()]} {weekDates[0].getFullYear()}</div>
          <div style={{fontSize:11.5,color:'#94a3b8',marginTop:2}}>{weekOffset===0?'This Week':weekOffset===1?'Next Week':weekOffset===-1?'Last Week':weekOffset>0?`+${weekOffset} weeks`:`${weekOffset} weeks`}</div>
        </div>
        <button onClick={()=>setWeekOffset(o=>o+1)} style={{padding:'7px 14px',background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:9,cursor:'pointer',fontSize:13,fontWeight:600,color:'#475569'}}>Next ›</button>
      </div>

      {error&&!loading&&(
        <div style={{background:'#fef2f2',border:'1px solid #fecaca',borderRadius:12,padding:'14px 18px',marginBottom:16,display:'flex',alignItems:'center',gap:10}}>
          <span>⚠️</span><span style={{flex:1,color:'#dc2626',fontSize:13}}>{error}</span>
          <button onClick={load} style={{padding:'6px 12px',background:'#dc2626',color:'#fff',border:'none',borderRadius:7,cursor:'pointer',fontSize:12,fontWeight:700}}>Retry</button>
        </div>
      )}

      {loading?(
        <div style={{display:'flex',justifyContent:'center',padding:'60px 0',flexDirection:'column',alignItems:'center',gap:12}}>
          <motion.div animate={{rotate:360}} transition={{duration:1,repeat:Infinity,ease:'linear'}} style={{width:36,height:36,border:'3px solid #e2e8f0',borderTopColor:'#1648c9',borderRadius:'50%'}}/>
          <span style={{color:'#94a3b8',fontSize:13}}>Loading timetable…</span>
        </div>
      ):(
        <>
          {/* ── MY SCHEDULE ── */}
          {tab==='mine'&&(
            <div>
              <div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:16,overflow:'hidden',marginBottom:16}}>
                <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',borderBottom:'2px solid #e2e8f0'}}>
                  {weekDates.map((d,i)=>{
                    const isToday=d.toDateString()===today;
                    return (
                      <div key={i} style={{padding:'12px 8px',textAlign:'center',background:isToday?'#eff6ff':'#f8fafc',borderRight:i<6?'1px solid #e2e8f0':'none'}}>
                        <div style={{fontSize:10,fontWeight:700,color:isToday?'#1648c9':'#94a3b8',textTransform:'uppercase'}}>{DAYS_SHORT[d.getDay()]}</div>
                        <div style={{fontSize:18,fontWeight:900,color:isToday?'#1648c9':'#0f172a',marginTop:2}}>{d.getDate()}</div>
                        {isToday&&<div style={{width:6,height:6,borderRadius:'50%',background:'#1648c9',margin:'4px auto 0'}}/>}
                      </div>
                    );
                  })}
                </div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)'}}>
                  {weekDates.map((d,i)=>{
                    const isToday=d.toDateString()===today;
                    const dayS=myByDay[d.toDateString()]||[];
                    return (
                      <div key={i} style={{padding:'8px',minHeight:110,background:isToday?'#fafcff':'#fff',borderRight:i<6?'1px solid #f1f5f9':'none',cursor:'pointer'}}
                        onClick={()=>dayS.length>0?setSelectedSchedule(dayS[0]):setShowCreate({date:d.toISOString().split('T')[0],userId:adminId})}>
                        {dayS.map(s=>{
                          const sh=SHIFT_CFG[s.shift]||SHIFT_CFG.morning;
                          return (
                            <div key={s._id} onClick={e=>{e.stopPropagation();setSelectedSchedule(s)}}
                              style={{padding:'5px 7px',background:sh.bg,border:`1px solid ${sh.border}`,borderRadius:7,marginBottom:4,cursor:'pointer'}}
                              onMouseEnter={e=>e.currentTarget.style.transform='scale(1.02)'}
                              onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}>
                              <div style={{fontSize:10.5,fontWeight:700,color:sh.text}}>{sh.icon} {sh.label}</div>
                              <div style={{fontSize:9.5,color:sh.text,opacity:.75}}>{sh.time}</div>
                              {s.task&&<div style={{fontSize:9.5,color:sh.text,opacity:.7,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{s.task}</div>}
                            </div>
                          );
                        })}
                        {dayS.length===0&&<div style={{height:'100%',minHeight:90,display:'flex',alignItems:'center',justifyContent:'center',color:'#e2e8f0',fontSize:20}}>+</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
              {/* Stats */}
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12}}>
                {[{l:'This Week',v:mySchedules.filter(s=>weekDates.some(d=>d.toDateString()===new Date(s.date).toDateString())).length,i:'📅',c:'#1648c9'},{l:'Morning',v:mySchedules.filter(s=>s.shift==='morning').length,i:'🌅',c:'#059669'},{l:'Afternoon',v:mySchedules.filter(s=>s.shift==='afternoon').length,i:'🌇',c:'#d97706'},{l:'Night',v:mySchedules.filter(s=>s.shift==='night').length,i:'🌙',c:'#6366f1'}].map((s,i)=>(
                  <div key={i} style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:12,padding:'14px',textAlign:'center'}}>
                    <div style={{fontSize:20,marginBottom:4}}>{s.i}</div>
                    <div style={{fontSize:22,fontWeight:900,color:s.c}}>{s.v}</div>
                    <div style={{fontSize:11.5,color:'#94a3b8'}}>{s.l}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── ALL STAFF ── */}
          {tab==='all'&&(
            <div>
              <div style={{display:'flex',gap:10,marginBottom:14,flexWrap:'wrap'}}>
                <select value={filterRole} onChange={e=>setFilterRole(e.target.value)} style={{padding:'8px 12px',border:'1px solid #e2e8f0',borderRadius:9,fontSize:13,color:'#475569',background:'#fff',cursor:'pointer'}}>
                  <option value="all">All Roles</option>
                  {allRoles.map(r=><option key={r} value={r}>{r.replace(/_/g,' ')}</option>)}
                </select>
                <select value={filterUser} onChange={e=>setFilterUser(e.target.value)} style={{padding:'8px 12px',border:'1px solid #e2e8f0',borderRadius:9,fontSize:13,color:'#475569',background:'#fff',cursor:'pointer',maxWidth:220}}>
                  <option value="all">All Staff</option>
                  {users.filter(u=>filterRole==='all'||u.role===filterRole).map(u=><option key={u._id} value={u._id}>{u.name} ({u.role})</option>)}
                </select>
              </div>
              {Object.keys(byUser).length===0&&!error?(
                <div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:16,padding:'48px',textAlign:'center'}}>
                  <div style={{fontSize:36,marginBottom:10}}>📋</div><div style={{fontSize:15,fontWeight:700}}>No schedules this week</div>
                  <div style={{fontSize:13,color:'#94a3b8',marginTop:6}}>Click "Add Schedule" to create one.</div>
                </div>
              ):(
                <div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:16,overflow:'hidden'}}>
                  {/* Header */}
                  <div style={{display:'grid',gridTemplateColumns:'180px repeat(7,1fr)',background:'#f8fafc',borderBottom:'2px solid #e2e8f0'}}>
                    <div style={{padding:'12px 14px',fontSize:11,fontWeight:800,color:'#64748b',textTransform:'uppercase',borderRight:'1px solid #e2e8f0'}}>STAFF MEMBER</div>
                    {weekDates.map((d,i)=>{
                      const isToday=d.toDateString()===today;
                      return (
                        <div key={i} style={{padding:'10px 6px',textAlign:'center',background:isToday?'#eff6ff':'#f8fafc',borderRight:i<6?'1px solid #e2e8f0':'none'}}>
                          <div style={{fontSize:9.5,fontWeight:700,color:isToday?'#1648c9':'#94a3b8',textTransform:'uppercase'}}>{DAYS_SHORT[d.getDay()]}</div>
                          <div style={{fontSize:16,fontWeight:900,color:isToday?'#1648c9':'#0f172a'}}>{d.getDate()}</div>
                          <div style={{fontSize:9,color:'#94a3b8'}}>{MONTHS[d.getMonth()]}</div>
                        </div>
                      );
                    })}
                  </div>
                  {/* Rows */}
                  {Object.values(byUser).map((entry,ri)=>{
                    const u=entry.user; const rc=ROLE_COLORS[u?.role]||'#64748b';
                    return (
                      <div key={ri} style={{display:'grid',gridTemplateColumns:'180px repeat(7,1fr)',borderBottom:'1px solid #f1f5f9'}}>
                        <div style={{padding:'10px 12px',borderRight:'1px solid #e2e8f0',display:'flex',alignItems:'center',gap:8,background:'#fafafa'}}>
                          <div style={{width:30,height:30,borderRadius:'50%',background:`${rc}20`,border:`1.5px solid ${rc}50`,display:'flex',alignItems:'center',justifyContent:'center',color:rc,fontWeight:800,fontSize:11,flexShrink:0}}>
                            {u?.name?.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2)||'U'}
                          </div>
                          <div style={{minWidth:0}}>
                            <div style={{fontSize:12,fontWeight:700,color:'#0f172a',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{u?.name||'?'}</div>
                            <div style={{fontSize:9.5,color:rc,fontWeight:600}}>{u?.role?.replace(/_/g,' ')}</div>
                          </div>
                        </div>
                        {weekDates.map((d,i)=>{
                          const isToday=d.toDateString()===today;
                          const dayS=entry.slots[d.toDateString()]||[];
                          return (
                            <div key={i} style={{padding:'5px',minHeight:70,background:isToday?'#fafcff':'#fff',borderRight:i<6?'1px solid #f1f5f9':'none',cursor:'pointer'}}
                              onClick={()=>dayS.length>0?setSelectedSchedule(dayS[0]):setShowCreate({date:d.toISOString().split('T')[0],userId:u?._id})}>
                              {dayS.map(s=>{
                                const sh=SHIFT_CFG[s.shift]||SHIFT_CFG.morning;
                                return (
                                  <div key={s._id} onClick={e=>{e.stopPropagation();setSelectedSchedule(s)}}
                                    style={{padding:'4px 6px',background:sh.bg,border:`1px solid ${sh.border}`,borderRadius:6,marginBottom:3,fontSize:10}}>
                                    <span style={{fontWeight:700,color:sh.text}}>{sh.icon} {sh.label}</span>
                                    {s.task&&<div style={{color:sh.text,opacity:.75,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{s.task}</div>}
                                  </div>
                                );
                              })}
                              {dayS.length===0&&<div style={{height:'100%',minHeight:60,display:'flex',alignItems:'center',justifyContent:'center',color:'#e2e8f0',fontSize:16}}>+</div>}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Schedule detail modal */}
      <AnimatePresence>
        {selectedSchedule&&(
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',zIndex:100,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}
            onClick={()=>setSelectedSchedule(null)}>
            <motion.div initial={{scale:.95}} animate={{scale:1}} exit={{scale:.95}} onClick={e=>e.stopPropagation()}
              style={{background:'#fff',borderRadius:20,padding:'28px',width:'100%',maxWidth:460}}>
              {(()=>{
                const s=selectedSchedule; const sh=SHIFT_CFG[s.shift]||SHIFT_CFG.morning; const assignedUser=s.user; const rc=ROLE_COLORS[assignedUser?.role]||'#64748b';
                return <>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'start',marginBottom:18}}>
                    <div>
                      <div style={{display:'inline-flex',alignItems:'center',gap:8,background:sh.bg,border:`1px solid ${sh.border}`,borderRadius:9,padding:'6px 12px',marginBottom:8}}>
                        <span>{sh.icon}</span><span style={{fontWeight:700,color:sh.text,fontSize:13}}>{sh.label} · {sh.time}</span>
                      </div>
                      <h2 style={{margin:0,fontSize:17,fontWeight:800,color:'#0f172a'}}>{new Date(s.date).toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</h2>
                    </div>
                    <button onClick={()=>setSelectedSchedule(null)} style={{background:'none',border:'none',fontSize:20,cursor:'pointer',color:'#94a3b8'}}>✕</button>
                  </div>
                  <div style={{background:'#f8fafc',borderRadius:12,padding:'14px',marginBottom:14}}>
                    <div style={{fontSize:10.5,color:'#94a3b8',fontWeight:700,textTransform:'uppercase',marginBottom:8}}>Assigned To</div>
                    <div style={{display:'flex',alignItems:'center',gap:12}}>
                      <div style={{width:40,height:40,borderRadius:'50%',background:`${rc}20`,border:`2px solid ${rc}40`,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:14,color:rc}}>
                        {assignedUser?.name?.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2)||'U'}
                      </div>
                      <div>
                        <div style={{fontWeight:700,color:'#0f172a',fontSize:15}}>{assignedUser?.name||'Unknown'}</div>
                        <div style={{fontSize:12,color:rc,fontWeight:600}}>{assignedUser?.role?.replace(/_/g,' ')}</div>
                        {assignedUser?.department&&<div style={{fontSize:11,color:'#94a3b8'}}>{assignedUser.department}</div>}
                      </div>
                    </div>
                  </div>
                  {s.task&&<div style={{marginBottom:12}}><div style={{fontSize:10.5,color:'#94a3b8',fontWeight:700,textTransform:'uppercase',marginBottom:5}}>Task</div><div style={{background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:9,padding:'10px 14px',fontSize:13.5,color:'#1e40af',fontWeight:600}}>{s.task}</div></div>}
                  {s.notes&&<div style={{marginBottom:16}}><div style={{fontSize:10.5,color:'#94a3b8',fontWeight:700,textTransform:'uppercase',marginBottom:5}}>Notes</div><div style={{background:'#f8fafc',borderRadius:9,padding:'10px',fontSize:13,color:'#475569'}}>{s.notes}</div></div>}
                  <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
                    <button onClick={()=>deleteSchedule(s._id)} style={{padding:'9px 16px',background:'#fef2f2',border:'1px solid #fecaca',borderRadius:9,color:'#dc2626',fontSize:13,fontWeight:700,cursor:'pointer'}}>🗑 Delete</button>
                    <button onClick={()=>setSelectedSchedule(null)} style={{padding:'9px 16px',background:'linear-gradient(135deg,#1648c9,#0891b2)',border:'none',borderRadius:9,color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer'}}>Close</button>
                  </div>
                </>;
              })()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create schedule modal */}
      <AnimatePresence>
        {showCreate&&(
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',zIndex:100,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}
            onClick={()=>setShowCreate(null)}>
            <motion.div initial={{scale:.95}} animate={{scale:1}} exit={{scale:.95}} onClick={e=>e.stopPropagation()}
              style={{background:'#fff',borderRadius:20,padding:'28px',width:'100%',maxWidth:460}}>
              <h3 style={{margin:'0 0 20px',fontSize:18,fontWeight:800,color:'#0f172a'}}>📅 Create Schedule</h3>
              <div style={{display:'flex',flexDirection:'column',gap:14}}>
                <div>
                  <label style={{display:'block',fontSize:12,fontWeight:700,color:'#374151',marginBottom:5}}>Staff Member *</label>
                  <select value={createForm.userId||showCreate?.userId||''} onChange={e=>setCreateForm(f=>({...f,userId:e.target.value}))} style={{width:'100%',padding:'10px',border:'1.5px solid #e2e8f0',borderRadius:9,fontSize:13.5,outline:'none'}}>
                    <option value="">Select…</option>
                    {users.map(u=><option key={u._id} value={u._id}>{u.name} — {u.role?.replace(/_/g,' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{display:'block',fontSize:12,fontWeight:700,color:'#374151',marginBottom:5}}>Date *</label>
                  <input type="date" value={createForm.date||showCreate?.date||''} onChange={e=>setCreateForm(f=>({...f,date:e.target.value}))} style={{width:'100%',padding:'10px',border:'1.5px solid #e2e8f0',borderRadius:9,fontSize:13.5,outline:'none'}}/>
                </div>
                <div>
                  <label style={{display:'block',fontSize:12,fontWeight:700,color:'#374151',marginBottom:5}}>Shift *</label>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8}}>
                    {Object.entries(SHIFT_CFG).map(([key,sh])=>(
                      <button key={key} type="button" onClick={()=>setCreateForm(f=>({...f,shift:key}))}
                        style={{padding:'8px 4px',border:`1.5px solid ${createForm.shift===key?sh.border:'#e2e8f0'}`,borderRadius:9,background:createForm.shift===key?sh.bg:'#f8fafc',cursor:'pointer',textAlign:'center'}}>
                        <div style={{fontSize:16}}>{sh.icon}</div>
                        <div style={{fontSize:10.5,fontWeight:700,color:createForm.shift===key?sh.text:'#64748b'}}>{sh.label}</div>
                        <div style={{fontSize:9.5,color:'#94a3b8'}}>{sh.time}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={{display:'block',fontSize:12,fontWeight:700,color:'#374151',marginBottom:5}}>Task / Duty</label>
                  <input value={createForm.task} onChange={e=>setCreateForm(f=>({...f,task:e.target.value}))} placeholder="e.g. ICU monitoring…" style={{width:'100%',padding:'10px',border:'1.5px solid #e2e8f0',borderRadius:9,fontSize:13.5,outline:'none'}}/>
                </div>
                <div>
                  <label style={{display:'block',fontSize:12,fontWeight:700,color:'#374151',marginBottom:5}}>Notes</label>
                  <textarea value={createForm.notes} onChange={e=>setCreateForm(f=>({...f,notes:e.target.value}))} rows={2} placeholder="Additional notes…" style={{width:'100%',padding:'10px',border:'1.5px solid #e2e8f0',borderRadius:9,fontSize:13.5,outline:'none',resize:'vertical'}}/>
                </div>
                <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
                  <button onClick={()=>setShowCreate(null)} style={{padding:'10px 20px',background:'#f1f5f9',border:'1px solid #e2e8f0',borderRadius:9,fontSize:13.5,fontWeight:600,cursor:'pointer',color:'#475569'}}>Cancel</button>
                  <button onClick={createSchedule} disabled={creating} style={{padding:'10px 20px',background:'linear-gradient(135deg,#1648c9,#0891b2)',border:'none',borderRadius:9,fontSize:13.5,fontWeight:700,cursor:'pointer',color:'#fff',opacity:creating?.7:1}}>
                    {creating?'Creating…':'✅ Create'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
