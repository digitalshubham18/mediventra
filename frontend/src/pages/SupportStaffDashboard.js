import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { facilityAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const ROLE_CFG = {
  wardboy:  {
    title:'Ward Boy Dashboard', icon:'🛏️', color:'#0891b2', gradFrom:'#0c4a6e', gradTo:'#0891b2',
    tasks:['Change bed linens in Ward A','Transport patient to OT-01','Carry meal trays to Ward B','Clean and sanitize beds post-discharge','Assist nurses with patient movement','Refill IV stands with supplies','Transport specimens to laboratory','Empty waste bins in all wards','Distribute patient identification wristbands','Assist in patient admission setup'],
    responsibilities:['Patient Transport','Bed Management','Supply Delivery','Ward Maintenance','Assist Clinical Staff'],
    equipment:['Wheelchair','Stretcher','Bed Linen Cart','Waste Trolley','IV Stand']
  },
  otboy:    {
    title:'OT Boy Dashboard',   icon:'🔪', color:'#ef4444', gradFrom:'#7f1d1d', gradTo:'#dc2626',
    tasks:['Prepare OT-01 for morning surgery','Sterilize surgical instruments','Set up instrument trays for Appendectomy','Clean OT-02 post-surgery','Restock surgical gloves & masks','Prepare sterile drapes for next surgery','Dispose of surgical waste properly','Check and refill anesthesia supplies','Clean and organize instrument storage','Assist OT nurse with equipment setup'],
    responsibilities:['OT Preparation','Instrument Sterilization','Post-Op Cleaning','Supply Management','Waste Disposal'],
    equipment:['Autoclave','Sterilization Bags','Instrument Trays','Waste Containers','Sterile Drapes']
  },
  sweeper:  {
    title:'Sweeper Dashboard',  icon:'🧹', color:'#f59e0b', gradFrom:'#78350f', gradTo:'#d97706',
    tasks:['Mop all corridors on Floor 1','Deep clean both emergency bathrooms','Sanitize OPD waiting area','Empty all dustbins on Floor 2','Disinfect high-touch surfaces (doors, rails)','Clean and mop ICU anteroom','Sanitize elevator panels & buttons','Wet mop pharmacy area','Clean staff rest rooms','Disinfect admission/discharge area'],
    responsibilities:['Floor Mopping','Waste Disposal','Toilet Cleaning','Surface Sanitization','Corridor Maintenance'],
    equipment:['Mop & Bucket','Disinfectant Spray','Vacuum Cleaner','Waste Bags','Protective Gloves']
  },
};

const SHIFTS_DETAIL = {
  morning:   { label:'Morning Shift',   time:'06:00 AM – 02:00 PM', icon:'🌅', bg:'#dcfce7', color:'#15803d' },
  afternoon: { label:'Afternoon Shift', time:'02:00 PM – 10:00 PM', icon:'🌇', bg:'#fef3c7', color:'#92400e' },
  night:     { label:'Night Shift',     time:'10:00 PM – 06:00 AM', icon:'🌙', bg:'#e0e7ff', color:'#3730a3' },
  full:      { label:'Full Day',        time:'07:00 AM – 07:00 PM', icon:'☀️', bg:'#f0f9ff', color:'#0369a1' },
};

export default function SupportStaffDashboard() {
  const { user } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tasksDone, setTasksDone] = useState({});
  const [activeTab, setActiveTab] = useState('overview');
  const [weekOffset, setWeekOffset] = useState(0);

  const cfg = ROLE_CFG[user?.role] || ROLE_CFG.wardboy;
  const ac = cfg.color;

  const getWeekDates = (off=0) => {
    const now = new Date();
    const day = now.getDay();
    const mon = new Date(now); mon.setDate(now.getDate() - day + 1 + off*7);
    return Array.from({length:7},(_,i)=>{ const d=new Date(mon); d.setDate(mon.getDate()+i); return d; });
  };
  const weekDates = getWeekDates(weekOffset);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rRes, sRes] = await Promise.allSettled([
        facilityAPI.getRooms(),
        facilityAPI.getSchedules({ userId: user?._id, week: getWeekDates(weekOffset)[0].toISOString() }),
      ]);
      setRooms(rRes.data.data||[]);
      setSchedules(sRes.data.data||[]);
    } catch { toast.error('Failed to load data'); }
    setLoading(false);
  }, [user?._id, weekOffset]);

  useEffect(() => { load(); }, [load]);

  const markCleaned = async (id, name) => {
    try {
      await facilityAPI.updateRoom(id,{ status:'available', lastCleaned:new Date(), cleanedBy:user?.name });
      toast.success(`✅ ${name} marked as clean!`);
      setRooms(rs => rs.map(r => r._id===id ? {...r,status:'available'} : r));
    } catch { toast.error('Update failed'); }
  };

  const today = new Date().toDateString();
  const todaySchedules = schedules.filter(s => new Date(s.date).toDateString()===today);
  const cleaningRooms = rooms.filter(r => ['cleaning','maintenance'].includes(r.status));
  const doneCount = Object.values(tasksDone).filter(Boolean).length;
  const pct = Math.round((doneCount/cfg.tasks.length)*100);

  const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  const STAT_CARDS = [
    { icon:'🧹', label:'Need Cleaning',  val:cleaningRooms.length,                              bg:'#fef3c7', c:'#92400e' },
    { icon:'🔴', label:'Occupied Rooms', val:rooms.filter(r=>r.status==='occupied').length,      bg:'#fee2e2', c:'#dc2626' },
    { icon:'🟢', label:'Available',      val:rooms.filter(r=>r.status==='available').length,     bg:'#dcfce7', c:'#15803d' },
    { icon:'📆', label:"Today's Shifts", val:todaySchedules.length,                              bg:'#e0f2fe', c:'#0369a1' },
    { icon:'✅', label:'Tasks Done',     val:doneCount,                                          bg:'#f0fdf4', c:'#15803d' },
    { icon:'⏳', label:'Tasks Pending',  val:cfg.tasks.length - doneCount,                       bg:'#f5f3ff', c:'#6d28d9' },
  ];

  return (
    <div style={{ fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap'); @keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Hero header */}
      <div style={{ background:`linear-gradient(135deg,${cfg.gradFrom} 0%,${cfg.gradTo} 100%)`, borderRadius:20, padding:'24px 28px', marginBottom:24, position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute',top:-30,right:-30,width:160,height:160,borderRadius:'50%',background:'rgba(255,255,255,.06)',pointerEvents:'none' }} />
        <div style={{ position:'absolute',bottom:-40,left:200,width:120,height:120,borderRadius:'50%',background:'rgba(255,255,255,.04)',pointerEvents:'none' }} />
        <div style={{ display:'flex',alignItems:'center',gap:16,marginBottom:16,position:'relative' }}>
          <motion.div animate={{ rotate:[0,5,-5,0] }} transition={{ duration:3,repeat:Infinity }}
            style={{ width:62,height:62,borderRadius:18,background:'rgba(255,255,255,.2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:28 }}>
            {cfg.icon}
          </motion.div>
          <div>
            <h1 style={{ color:'#fff',fontWeight:800,fontSize:22,margin:0,letterSpacing:-.3 }}>{cfg.title}</h1>
            <p style={{ color:'rgba(255,255,255,.7)',fontSize:13,marginTop:3 }}>
              Welcome, <strong>{user?.name?.split(' ')[0]}</strong>! Good {new Date().getHours()<12?'morning':new Date().getHours()<17?'afternoon':'evening'}.
            </p>
          </div>
        </div>
        <div style={{ display:'flex',gap:10,flexWrap:'wrap',position:'relative' }}>
          <div style={{ background:'rgba(255,255,255,.15)',borderRadius:12,padding:'7px 14px',fontSize:12,fontWeight:600,color:'#fff' }}>
            📅 {new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}
          </div>
          <div style={{ background:'rgba(255,255,255,.15)',borderRadius:12,padding:'7px 14px',fontSize:12,fontWeight:600,color:'#fff',fontFamily:'monospace' }}>
            🆔 {user?._id?.slice(-8)?.toUpperCase()}
          </div>
          <div style={{ background:'rgba(74,222,128,.25)',borderRadius:12,padding:'7px 14px',fontSize:12,fontWeight:600,color:'#fff',display:'flex',alignItems:'center',gap:6 }}>
            <div style={{ width:7,height:7,borderRadius:'50%',background:'#4ade80' }} />
            On Duty
          </div>
          {todaySchedules[0] && (
            <div style={{ background:'rgba(255,255,255,.15)',borderRadius:12,padding:'7px 14px',fontSize:12,fontWeight:600,color:'#fff' }}>
              {SHIFTS_DETAIL[todaySchedules[0].shift]?.icon} {SHIFTS_DETAIL[todaySchedules[0].shift]?.time}
            </div>
          )}
          {/* Task progress pill */}
          <div style={{ background:'rgba(255,255,255,.15)',borderRadius:12,padding:'7px 14px',fontSize:12,fontWeight:600,color:'#fff',display:'flex',alignItems:'center',gap:8 }}>
            <div style={{ width:60,height:6,background:'rgba(255,255,255,.3)',borderRadius:3 }}>
              <div style={{ width:`${pct}%`,height:'100%',background:'#4ade80',borderRadius:3,transition:'width .4s' }} />
            </div>
            {pct}% tasks done
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex',gap:5,background:'#f1f5f9',borderRadius:14,padding:4,width:'fit-content',marginBottom:20 }}>
        {[['overview','📊 Overview'],['tasks','✅ Tasks'],['schedule','📆 Schedule'],['rooms','🏥 Rooms'],['equipment','🔧 Equipment']].map(([k,l]) => (
          <button key={k} onClick={()=>setActiveTab(k)}
            style={{ padding:'9px 18px',borderRadius:11,border:'none',background:activeTab===k?'#fff':'transparent',color:activeTab===k?'#0f172a':'#64748b',fontFamily:'inherit',fontWeight:700,fontSize:12.5,cursor:'pointer',boxShadow:activeTab===k?'0 2px 8px rgba(0,0,0,.08)':'none',transition:'all .2s',whiteSpace:'nowrap' }}>
            {l}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      {activeTab==='overview' && (
        <div>
          {/* Stats */}
          <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(155px,1fr))',gap:12,marginBottom:24 }}>
            {STAT_CARDS.map((s,i) => (
              <motion.div key={i} initial={{ opacity:0,y:12 }} animate={{ opacity:1,y:0 }} transition={{ delay:i*.06 }}
                style={{ background:'#fff',border:'1px solid #e8edf3',borderRadius:14,padding:'16px',display:'flex',alignItems:'center',gap:12 }}>
                <div style={{ width:44,height:44,borderRadius:12,background:s.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:21,flexShrink:0 }}>{s.icon}</div>
                <div><div style={{ fontSize:26,fontWeight:900,color:'#0f172a',lineHeight:1 }}>{s.val}</div><div style={{ fontSize:11,color:'#94a3b8',marginTop:2 }}>{s.label}</div></div>
              </motion.div>
            ))}
          </div>

          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:20 }}>
            {/* Today's schedule preview */}
            <div style={{ background:'#fff',border:'1px solid #e8edf3',borderRadius:16,overflow:'hidden' }}>
              <div style={{ padding:'14px 18px',borderBottom:'1px solid #f1f5f9',display:'flex',alignItems:'center',gap:8 }}>
                <span style={{ fontSize:18 }}>📆</span><span style={{ fontWeight:800,fontSize:15,color:'#0f172a' }}>Today's Schedule</span>
              </div>
              <div style={{ padding:'14px 16px' }}>
                {todaySchedules.length===0 ? (
                  <div style={{ textAlign:'center',padding:'24px 0',color:'#94a3b8' }}>
                    <div style={{ fontSize:32,marginBottom:8 }}>😌</div>No shifts today
                  </div>
                ) : todaySchedules.map((s,i) => {
                  const sd = SHIFTS_DETAIL[s.shift]||SHIFTS_DETAIL.morning;
                  return (
                    <div key={i} style={{ padding:'12px 14px',background:sd.bg,borderRadius:12,marginBottom:8,borderLeft:`3px solid ${sd.color}` }}>
                      <div style={{ fontWeight:700,color:'#0f172a',fontSize:13,marginBottom:4 }}>{sd.icon} {sd.label}</div>
                      <div style={{ fontSize:12,color:'#64748b',marginBottom:3 }}>⏰ {sd.time}</div>
                      {s.department&&<div style={{ fontSize:12,color:'#64748b' }}>🏥 {s.department}</div>}
                      {s.task&&<div style={{ fontSize:12,color:'#64748b',marginTop:2 }}>📋 {s.task}</div>}
                      {s.room&&<div style={{ fontSize:12,color:ac,fontWeight:600,marginTop:2 }}>📍 {s.room?.name||'Assigned Room'}</div>}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Cleaning needed */}
            <div style={{ background:'#fff',border:'1px solid #e8edf3',borderRadius:16,overflow:'hidden' }}>
              <div style={{ padding:'14px 18px',borderBottom:'1px solid #f1f5f9',display:'flex',alignItems:'center',justifyContent:'space-between' }}>
                <div style={{ display:'flex',alignItems:'center',gap:8 }}><span style={{ fontSize:18 }}>🧹</span><span style={{ fontWeight:800,fontSize:15,color:'#0f172a' }}>Needs Attention</span></div>
                {cleaningRooms.length>0&&<span style={{ padding:'3px 9px',borderRadius:20,background:'#fef3c7',color:'#92400e',fontSize:11,fontWeight:700 }}>{cleaningRooms.length} rooms</span>}
              </div>
              <div style={{ padding:'14px 16px',maxHeight:220,overflowY:'auto' }}>
                {cleaningRooms.length===0 ? (
                  <div style={{ textAlign:'center',padding:'20px 0',color:'#94a3b8' }}>
                    <div style={{ fontSize:32,marginBottom:8 }}>✨</div>All rooms clean!
                  </div>
                ) : cleaningRooms.map(room => (
                  <div key={room._id} style={{ padding:'11px 13px',background:'#fffbeb',border:'1px solid #fde68a',borderRadius:11,marginBottom:8 }}>
                    <div style={{ display:'flex',justifyContent:'space-between',marginBottom:5 }}>
                      <span style={{ fontWeight:700,fontSize:12.5,color:'#0f172a' }}>Room {room.number} — {room.name}</span>
                      <span style={{ fontSize:10.5,fontWeight:700,color:'#92400e',background:'#fef3c7',padding:'1px 6px',borderRadius:8 }}>{room.status}</span>
                    </div>
                    <div style={{ fontSize:11.5,color:'#64748b',marginBottom:8 }}>{room.type} · Floor {room.floor}</div>
                    <button onClick={()=>markCleaned(room._id,room.name)}
                      style={{ width:'100%',padding:'7px',borderRadius:9,border:'none',background:ac,color:'#fff',fontFamily:'inherit',fontWeight:700,fontSize:12,cursor:'pointer' }}>
                      ✅ Mark as Cleaned
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TASKS ── */}
      {activeTab==='tasks' && (
        <div style={{ background:'#fff',border:'1px solid #e8edf3',borderRadius:16,overflow:'hidden' }}>
          <div style={{ padding:'16px 20px',borderBottom:'1px solid #f1f5f9',display:'flex',alignItems:'center',justifyContent:'space-between' }}>
            <div style={{ display:'flex',alignItems:'center',gap:8 }}>
              <span style={{ fontSize:18 }}>✅</span>
              <span style={{ fontWeight:800,fontSize:15,color:'#0f172a' }}>Today's Task Checklist</span>
            </div>
            <span style={{ fontSize:13,fontWeight:700,color:ac }}>{doneCount} / {cfg.tasks.length} completed</span>
          </div>
          <div style={{ padding:'16px 20px' }}>
            {/* Progress */}
            <div style={{ marginBottom:20 }}>
              <div style={{ display:'flex',justifyContent:'space-between',fontSize:12,color:'#64748b',marginBottom:6 }}>
                <span>Daily Progress</span><span style={{ fontWeight:700,color:pct===100?'#15803d':ac }}>{pct}%</span>
              </div>
              <div style={{ height:10,background:'#f1f5f9',borderRadius:5,overflow:'hidden' }}>
                <motion.div initial={{ width:0 }} animate={{ width:`${pct}%` }} transition={{ duration:.8, ease:'easeOut' }}
                  style={{ height:'100%',background:`linear-gradient(90deg,${ac},${ac}cc)`,borderRadius:5 }} />
              </div>
              {pct===100 && <div style={{ marginTop:8,textAlign:'center',color:'#15803d',fontWeight:700,fontSize:13 }}>🎉 All tasks completed for today!</div>}
            </div>

            <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:8 }}>
              {cfg.tasks.map((task,i) => (
                <motion.div key={i} onClick={()=>setTasksDone(t=>({...t,[i]:!t[i]}))}
                  whileTap={{ scale:.98 }}
                  style={{ display:'flex',alignItems:'center',gap:10,padding:'11px 13px',borderRadius:12,cursor:'pointer',background:tasksDone[i]?`${ac}08`:'#f8fafc',border:`1.5px solid ${tasksDone[i]?ac+'30':'#e8edf3'}`,transition:'all .2s' }}>
                  <div style={{ width:22,height:22,borderRadius:6,border:`2px solid ${tasksDone[i]?ac:'#cbd5e1'}`,background:tasksDone[i]?ac:'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,transition:'all .2s' }}>
                    {tasksDone[i]&&<motion.span initial={{ scale:0 }} animate={{ scale:1 }} style={{ color:'#fff',fontSize:12,fontWeight:900 }}>✓</motion.span>}
                  </div>
                  <span style={{ fontSize:12.5,fontWeight:600,color:tasksDone[i]?'#94a3b8':'#374151',textDecoration:tasksDone[i]?'line-through':'none' }}>{task}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── SCHEDULE (Full Week Timetable) ── */}
      {activeTab==='schedule' && (
        <div>
          <div style={{ display:'flex',alignItems:'center',gap:12,marginBottom:16 }}>
            <button onClick={()=>setWeekOffset(w=>w-1)} style={{ padding:'7px 14px',borderRadius:10,border:'1px solid #e2e8f0',background:'#fff',cursor:'pointer',fontFamily:'inherit',fontSize:13,fontWeight:600 }}>← Prev</button>
            <div style={{ fontWeight:700,color:'#0f172a',fontSize:14 }}>
              {weekDates[0].toLocaleDateString('en-IN',{month:'short',day:'numeric'})} – {weekDates[6].toLocaleDateString('en-IN',{month:'short',day:'numeric',year:'numeric'})}
            </div>
            <button onClick={()=>setWeekOffset(w=>w+1)} style={{ padding:'7px 14px',borderRadius:10,border:'1px solid #e2e8f0',background:'#fff',cursor:'pointer',fontFamily:'inherit',fontSize:13,fontWeight:600 }}>Next →</button>
            <button onClick={()=>setWeekOffset(0)} style={{ padding:'7px 14px',borderRadius:10,border:`1px solid ${ac}`,background:`${ac}10`,color:ac,cursor:'pointer',fontFamily:'inherit',fontSize:13,fontWeight:700 }}>Today</button>
          </div>

          <div style={{ background:'#fff',border:'1px solid #e8edf3',borderRadius:16,overflow:'hidden' }}>
            <div style={{ display:'grid',gridTemplateColumns:'repeat(7,1fr)',borderBottom:'2px solid #f1f5f9' }}>
              {weekDates.map((d,i) => {
                const isToday = d.toDateString()===new Date().toDateString();
                return (
                  <div key={i} style={{ padding:'12px 8px',textAlign:'center',background:isToday?`${ac}10`:'#f8fafc',borderRight:i<6?'1px solid #f1f5f9':'none' }}>
                    <div style={{ fontSize:10.5,color:'#94a3b8',fontWeight:600 }}>{DAYS[d.getDay()]}</div>
                    <div style={{ fontSize:18,fontWeight:800,color:isToday?ac:'#0f172a',marginTop:2 }}>{d.getDate()}</div>
                    {isToday&&<div style={{ width:6,height:6,borderRadius:'50%',background:ac,margin:'4px auto 0' }} />}
                  </div>
                );
              })}
            </div>
            <div style={{ display:'grid',gridTemplateColumns:'repeat(7,1fr)',minHeight:200 }}>
              {weekDates.map((d,di) => {
                const dayScheds = schedules.filter(s=>new Date(s.date).toDateString()===d.toDateString());
                const isToday = d.toDateString()===new Date().toDateString();
                return (
                  <div key={di} style={{ padding:8,borderRight:di<6?'1px solid #f1f5f9':'none',background:isToday?`${ac}04`:undefined,minHeight:140 }}>
                    {dayScheds.length===0 ? (
                      <div style={{ height:'100%',display:'flex',alignItems:'center',justifyContent:'center' }}>
                        <span style={{ fontSize:18,opacity:.2 }}>—</span>
                      </div>
                    ) : dayScheds.map((s,si) => {
                      const sd = SHIFTS_DETAIL[s.shift]||SHIFTS_DETAIL.morning;
                      return (
                        <div key={si} style={{ padding:'6px 8px',borderRadius:9,marginBottom:5,background:sd.bg,borderLeft:`3px solid ${sd.color}` }}>
                          <div style={{ fontSize:11,fontWeight:700,color:sd.color }}>{sd.icon} {s.shift}</div>
                          {s.department&&<div style={{ fontSize:10,color:'#64748b',marginTop:1 }}>{s.department}</div>}
                          {s.task&&<div style={{ fontSize:10,color:'#64748b' }}>{s.task}</div>}
                          <div style={{ fontSize:9.5,color:'#94a3b8',marginTop:2 }}>{sd.time}</div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
            {schedules.length===0&&!loading&&(
              <div style={{ padding:'40px 0',textAlign:'center',color:'#94a3b8',gridColumn:'1/-1' }}>
                <div style={{ fontSize:36,marginBottom:10 }}>📆</div>
                <div style={{ fontWeight:700 }}>No schedule assigned this week</div>
                <div style={{ fontSize:12,marginTop:4 }}>Contact your Admin to assign shifts</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ROOMS ── */}
      {activeTab==='rooms' && (
        <div>
          <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:12 }}>
            {loading ? Array(6).fill(0).map((_,i)=><div key={i} style={{ height:160,background:'#f1f5f9',borderRadius:14 }} />) :
            rooms.map((room,i) => {
              const needsWork = ['cleaning','maintenance'].includes(room.status);
              const sc = {available:{bg:'#dcfce7',c:'#15803d',dot:'#22c55e'},occupied:{bg:'#fee2e2',c:'#dc2626',dot:'#ef4444'},cleaning:{bg:'#fef3c7',c:'#92400e',dot:'#f59e0b'},maintenance:{bg:'#fef3c7',c:'#92400e',dot:'#f59e0b'},reserved:{bg:'#f5f3ff',c:'#6d28d9',dot:'#7c3aed'}}[room.status]||{bg:'#f1f5f9',c:'#64748b',dot:'#94a3b8'};
              return (
                <motion.div key={room._id} initial={{ opacity:0,y:10 }} animate={{ opacity:1,y:0 }} transition={{ delay:i*.04 }}
                  style={{ background:'#fff',border:`1.5px solid ${needsWork?'#fde68a':'#e8edf3'}`,borderRadius:14,overflow:'hidden' }}>
                  <div style={{ height:3,background:needsWork?'#f59e0b':ac }} />
                  <div style={{ padding:'14px' }}>
                    <div style={{ display:'flex',justifyContent:'space-between',marginBottom:10 }}>
                      <div>
                        <div style={{ fontWeight:800,fontSize:13.5,color:'#0f172a' }}>{room.name}</div>
                        <div style={{ fontSize:11.5,color:'#94a3b8' }}>Room {room.number} · Floor {room.floor}</div>
                      </div>
                      <span style={{ padding:'3px 9px',borderRadius:20,fontSize:10.5,fontWeight:700,background:sc.bg,color:sc.c,height:'fit-content',display:'flex',alignItems:'center',gap:4 }}>
                        <div style={{ width:5,height:5,borderRadius:'50%',background:sc.dot }} />{room.status}
                      </span>
                    </div>
                    <div style={{ height:5,background:'#f1f5f9',borderRadius:3,marginBottom:10 }}>
                      <div style={{ height:'100%',background:room.occupiedBeds===room.capacity?'#ef4444':ac,borderRadius:3,width:`${room.capacity>0?(room.occupiedBeds/room.capacity)*100:0}%` }} />
                    </div>
                    <div style={{ fontSize:11.5,color:'#64748b',marginBottom:10 }}>{room.occupiedBeds||0}/{room.capacity} beds · {room.type}</div>
                    {needsWork&&(
                      <button onClick={()=>markCleaned(room._id,room.name)}
                        style={{ width:'100%',padding:'8px',borderRadius:9,border:'none',background:ac,color:'#fff',fontFamily:'inherit',fontWeight:700,fontSize:12,cursor:'pointer' }}>
                        ✅ Mark Cleaned
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── EQUIPMENT ── */}
      {activeTab==='equipment' && (
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:20 }}>
          <div style={{ background:'#fff',border:'1px solid #e8edf3',borderRadius:16,overflow:'hidden' }}>
            <div style={{ padding:'14px 18px',borderBottom:'1px solid #f1f5f9',display:'flex',alignItems:'center',gap:8 }}>
              <span style={{ fontSize:18 }}>🔧</span><span style={{ fontWeight:800,fontSize:15,color:'#0f172a' }}>My Equipment</span>
            </div>
            <div style={{ padding:'14px 16px' }}>
              {cfg.equipment.map((eq,i) => (
                <div key={i} style={{ display:'flex',alignItems:'center',gap:12,padding:'11px 13px',background:'#f8fafc',borderRadius:11,marginBottom:8,border:'1px solid #e8edf3' }}>
                  <div style={{ width:36,height:36,borderRadius:10,background:`${ac}15`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18 }}>🔧</div>
                  <div>
                    <div style={{ fontWeight:700,color:'#0f172a',fontSize:13 }}>{eq}</div>
                    <div style={{ fontSize:11,color:'#22c55e',fontWeight:600 }}>✅ Available</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background:'#fff',border:'1px solid #e8edf3',borderRadius:16,overflow:'hidden' }}>
            <div style={{ padding:'14px 18px',borderBottom:'1px solid #f1f5f9',display:'flex',alignItems:'center',gap:8 }}>
              <span style={{ fontSize:18 }}>📋</span><span style={{ fontWeight:800,fontSize:15,color:'#0f172a' }}>Responsibilities</span>
            </div>
            <div style={{ padding:'14px 16px' }}>
              {cfg.responsibilities.map((r,i) => (
                <div key={i} style={{ display:'flex',alignItems:'center',gap:10,padding:'10px 13px',borderRadius:10,marginBottom:8,background:`${ac}08`,border:`1px solid ${ac}20` }}>
                  <div style={{ width:8,height:8,borderRadius:'50%',background:ac,flexShrink:0 }} />
                  <span style={{ fontSize:13,fontWeight:600,color:'#374151' }}>{r}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
