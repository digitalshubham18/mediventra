import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { facilityAPI, tasksAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const SHIFTS = {
  morning:   { label:'Morning',   time:'08:00 – 16:00', icon:'🌅', bg:'#dcfce7', color:'#15803d', border:'#86efac' },
  afternoon: { label:'Afternoon', time:'14:00 – 22:00', icon:'🌇', bg:'#fef3c7', color:'#92400e', border:'#fcd34d' },
  night:     { label:'Night',     time:'22:00 – 06:00', icon:'🌙', bg:'#e0e7ff', color:'#3730a3', border:'#a5b4fc' },
  full:      { label:'Full Day',  time:'07:00 – 19:00', icon:'☀️', bg:'#f0f9ff', color:'#0369a1', border:'#7dd3fc' },
};
const STATUS_CFG = {
  scheduled:  { bg:'#eff6ff', c:'#1d4ed8', dot:'#3b82f6', label:'Scheduled' },
  completed:  { bg:'#dcfce7', c:'#15803d', dot:'#22c55e', label:'Completed' },
  absent:     { bg:'#fee2e2', c:'#dc2626', dot:'#ef4444', label:'Absent' },
  'on-leave': { bg:'#fef3c7', c:'#92400e', dot:'#f59e0b', label:'On Leave' },
};
const PRIORITY_COLOR = { urgent:'#ef4444', high:'#f97316', medium:'#3b82f6', low:'#22c55e' };
const ROLE_COLOR = { admin:'#6366f1',doctor:'#0891b2',patient:'#7c3aed',nurse:'#db2777',pharmacist:'#d97706',wardboy:'#059669',sweeper:'#f59e0b',otboy:'#ef4444',finance:'#8b5cf6' };

function getWeekDates(off=0) {
  const now = new Date(); const day = now.getDay();
  const mon = new Date(now); mon.setDate(now.getDate()-day+1+off*7);
  return Array.from({length:7},(_,i)=>{ const d=new Date(mon); d.setDate(mon.getDate()+i); return d; });
}

export default function MyTimetablePage() {
  const { user } = useAuth();
  const [schedules, setSchedules]     = useState([]);
  const [tasks, setTasks]             = useState([]);
  const [weekOffset, setWeekOffset]   = useState(0);
  const [loading, setLoading]         = useState(true);
  const [activeTab, setActiveTab]     = useState('timetable');
  const [updateModal, setUpdateModal] = useState(null); // { ...schedule } or { ...task, _type:'task' }
  const [updateForm, setUpdateForm]   = useState({ status:'completed', notes:'', task:'', department:'' });
  const [saving, setSaving]           = useState(false);
  const weekDates = getWeekDates(weekOffset);
  const ac = ROLE_COLOR[user?.role] || '#2563eb';

  const load = useCallback(async () => {
    setLoading(true);
    const uid = user?._id || user?.id;
    try {
      const [sRes, tRes] = await Promise.allSettled([
        facilityAPI.getSchedules({ userId: uid, week: weekDates[0].toISOString() }),
        tasksAPI.getAll(),  // backend auto-scopes to current user
      ]);
      if (sRes.status === 'fulfilled') setSchedules(sRes.value?.data?.data || []);
      else setSchedules([]);
      if (tRes.status === 'fulfilled') setTasks(tRes.value?.data?.data || []);
      else setTasks([]);
    } catch(e) {
      console.error('MyTimetablePage load error:', e);
    }
    setLoading(false);
  }, [user?._id, user?.id, weekOffset]);

  useEffect(() => { load(); }, [load]);

  /* ── Open update modal for a schedule ── */
  const openScheduleModal = (s) => {
    setUpdateModal(s);
    setUpdateForm({
      status:     s.status || 'scheduled',
      notes:      s.notes  || '',
      task:       s.task   || '',
      department: s.department || '',
    });
  };

  /* ── Save schedule update ── */
  const handleUpdateSchedule = async () => {
    if (!updateModal?._id) return;
    setSaving(true);
    try {
      await facilityAPI.updateSchedule(updateModal._id, {
        status:     updateForm.status,
        notes:      updateForm.notes,
        task:       updateForm.task,
        department: updateForm.department,
      });
      toast.success('✅ Schedule updated!');
      setUpdateModal(null);
      load();
    } catch(e) {
      const msg = e.response?.data?.error || e.message || 'Update failed';
      toast.error(msg);
    }
    setSaving(false);
  };

  /* ── Save task update ── */
  const handleTaskUpdate = async (id, status, notes='') => {
    setSaving(true);
    try {
      await tasksAPI.update(id, { status, notes, ...(status==='completed' ? { completedAt: new Date() } : {}) });
      setTasks(ts => ts.map(t => t._id===id ? { ...t, status, notes } : t));
      toast.success(status==='completed' ? '✅ Task marked complete!' : 'Task updated!');
      setUpdateModal(null);
    } catch(e) {
      toast.error(e.response?.data?.error || 'Update failed');
    }
    setSaving(false);
  };

  const today = new Date().toDateString();
  const todaySchedules = schedules.filter(s => new Date(s.date).toDateString() === today);
  const pendingTasks   = tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled');
  const doneTasks      = tasks.filter(t => t.status === 'completed');

  return (
    <div style={{ fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        @keyframes spin { to { transform: rotate(360deg) } }
        .shift-card { transition: transform .15s, box-shadow .15s; }
        .shift-card:hover { transform: scale(1.03); box-shadow: 0 6px 18px rgba(0,0,0,.12) !important; cursor: pointer; }
        .status-btn { border: 1.5px solid #e2e8f0; border-radius: 10px; background: #fafbfc; cursor: pointer; padding: 9px 12px; display: flex; align-items: center; gap: 8px; transition: all .18s; }
        .status-btn:hover { border-color: #94a3b8; background: #f1f5f9; }
        .status-btn.active { background: var(--sbg) !important; border-color: var(--sdot) !important; }
      `}</style>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:10 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:800, color:'#0f172a', margin:0 }}>📅 My Timetable & Tasks</h1>
          <p style={{ color:'#94a3b8', fontSize:13, marginTop:3 }}>Your personal schedule and assigned duties</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <div style={{ padding:'7px 14px', background:`${ac}10`, border:`1px solid ${ac}25`, borderRadius:12, fontSize:12.5, fontWeight:600, color:ac }}>
            🆔 {user?._id?.slice(-8)?.toUpperCase()}
          </div>
          {todaySchedules.length > 0 && (
            <div style={{ padding:'7px 14px', background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:12, fontSize:12.5, fontWeight:700, color:'#15803d', display:'flex', alignItems:'center', gap:5 }}>
              <div style={{ width:7, height:7, borderRadius:'50%', background:'#22c55e' }} /> On Duty
            </div>
          )}
        </div>
      </div>

      {/* Today banner */}
      {todaySchedules.length > 0 && (
        <motion.div initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }}
          style={{ background:`linear-gradient(135deg,${ac}15,${ac}08)`, border:`1.5px solid ${ac}30`, borderRadius:16, padding:'14px 20px', marginBottom:20, display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ width:44, height:44, borderRadius:12, background:ac, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>📆</div>
            <div>
              <div style={{ fontWeight:800, color:'#0f172a', fontSize:14 }}>Today — {new Date().toLocaleDateString('en-IN',{ weekday:'long', day:'numeric', month:'long' })}</div>
              <div style={{ fontSize:12.5, color:'#64748b', marginTop:2 }}>
                {todaySchedules.map(s => `${SHIFTS[s.shift]?.icon} ${SHIFTS[s.shift]?.label} (${SHIFTS[s.shift]?.time})`).join(' · ')}
              </div>
            </div>
          </div>
          {pendingTasks.length > 0 && (
            <div style={{ padding:'5px 13px', background:'#fef3c7', border:'1px solid #fde68a', borderRadius:20, fontSize:12, fontWeight:700, color:'#92400e' }}>
              {pendingTasks.length} pending task{pendingTasks.length!==1?'s':''}
            </div>
          )}
        </motion.div>
      )}

      {/* Tabs */}
      <div style={{ display:'flex', gap:4, background:'#f1f5f9', borderRadius:14, padding:4, width:'fit-content', marginBottom:20 }}>
        {[['timetable','📅 Weekly Timetable'],['today','🌅 Today'],['tasks','✅ My Tasks']].map(([k,l]) => (
          <button key={k} onClick={() => setActiveTab(k)}
            style={{ padding:'9px 20px', borderRadius:11, border:'none', background:activeTab===k?'#fff':'transparent', color:activeTab===k?'#0f172a':'#64748b', fontFamily:'inherit', fontWeight:700, fontSize:13, cursor:'pointer', boxShadow:activeTab===k?'0 2px 8px rgba(0,0,0,.08)':'none', transition:'all .2s', whiteSpace:'nowrap' }}>
            {l}
          </button>
        ))}
      </div>

      {/* ══ WEEKLY TIMETABLE ══ */}
      {activeTab === 'timetable' && (
        <div>
          {/* Week nav */}
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16, flexWrap:'wrap' }}>
            <button onClick={() => setWeekOffset(w=>w-1)}
              style={{ padding:'8px 16px', borderRadius:10, border:'1.5px solid #e2e8f0', background:'#fff', cursor:'pointer', fontFamily:'inherit', fontSize:13, fontWeight:600 }}>← Previous</button>
            <div style={{ fontWeight:700, color:'#0f172a', fontSize:14, flex:1, textAlign:'center', minWidth:180 }}>
              {weekDates[0].toLocaleDateString('en-IN',{day:'numeric',month:'long'})} – {weekDates[6].toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})}
            </div>
            <button onClick={() => setWeekOffset(w=>w+1)}
              style={{ padding:'8px 16px', borderRadius:10, border:'1.5px solid #e2e8f0', background:'#fff', cursor:'pointer', fontFamily:'inherit', fontSize:13, fontWeight:600 }}>Next →</button>
            {weekOffset !== 0 && (
              <button onClick={() => setWeekOffset(0)}
                style={{ padding:'8px 14px', borderRadius:10, border:`1.5px solid ${ac}`, background:`${ac}10`, color:ac, cursor:'pointer', fontFamily:'inherit', fontSize:13, fontWeight:700 }}>
                This Week
              </button>
            )}
          </div>

          <div style={{ background:'#fff', border:'1px solid #e8edf3', borderRadius:18, overflow:'hidden' }}>
            {/* Day headers */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', borderBottom:'2px solid #f1f5f9' }}>
              {weekDates.map((d,i) => {
                const isToday = d.toDateString() === new Date().toDateString();
                const dayScheds = schedules.filter(s => new Date(s.date).toDateString() === d.toDateString());
                return (
                  <div key={i} style={{ padding:'14px 8px', textAlign:'center', background:isToday?`${ac}12`:'#f8fafc', borderRight:i<6?'1px solid #f1f5f9':'none' }}>
                    <div style={{ fontSize:11, color:'#94a3b8', fontWeight:600, letterSpacing:.5 }}>{DAYS[d.getDay()]}</div>
                    <div style={{ fontSize:20, fontWeight:900, color:isToday?ac:'#0f172a', marginTop:2 }}>{d.getDate()}</div>
                    {isToday && <div style={{ width:6, height:6, borderRadius:'50%', background:ac, margin:'3px auto 0' }} />}
                    {dayScheds.length > 0 && <div style={{ fontSize:10, color:SHIFTS[dayScheds[0].shift]?.color, marginTop:3, fontWeight:700 }}>{SHIFTS[dayScheds[0].shift]?.icon}</div>}
                  </div>
                );
              })}
            </div>

            {/* Cells */}
            {loading ? (
              <div style={{ padding:40, textAlign:'center' }}>
                <div style={{ width:28, height:28, border:'3px solid #e2e8f0', borderTopColor:ac, borderRadius:'50%', animation:'spin .7s linear infinite', margin:'0 auto' }} />
              </div>
            ) : (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', minHeight:180 }}>
                {weekDates.map((d,di) => {
                  const dayScheds = schedules.filter(s => new Date(s.date).toDateString() === d.toDateString());
                  const isToday = d.toDateString() === new Date().toDateString();
                  return (
                    <div key={di} style={{ padding:6, borderRight:di<6?'1px solid #f8fafc':'none', background:isToday?`${ac}04`:undefined, minHeight:160 }}>
                      {dayScheds.length === 0
                        ? <div style={{ height:'100%', display:'flex', alignItems:'center', justifyContent:'center' }}>
                            <span style={{ fontSize:18, opacity:.12 }}>—</span>
                          </div>
                        : dayScheds.map((s,si) => {
                          const sd = SHIFTS[s.shift] || SHIFTS.morning;
                          const sc = STATUS_CFG[s.status] || STATUS_CFG.scheduled;
                          return (
                            <div key={si} className="shift-card"
                              onClick={() => openScheduleModal(s)}
                              style={{ padding:'7px 8px', borderRadius:10, marginBottom:5, background:sd.bg, borderLeft:`3px solid ${sd.color}`, border:`1px solid ${sd.border}`, borderLeft:`3px solid ${sd.color}` }}>
                              <div style={{ fontSize:11, fontWeight:800, color:sd.color }}>{sd.icon} {s.shift}</div>
                              <div style={{ fontSize:10, color:'#64748b', marginTop:1 }}>{sd.time}</div>
                              {s.department && <div style={{ fontSize:10, color:'#94a3b8', marginTop:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>🏥 {s.department}</div>}
                              {s.task && <div style={{ fontSize:10, color:'#94a3b8', marginTop:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>📋 {s.task}</div>}
                              <div style={{ marginTop:4, display:'flex', alignItems:'center', gap:3 }}>
                                <div style={{ width:5, height:5, borderRadius:'50%', background:sc.dot }} />
                                <span style={{ fontSize:9, fontWeight:700, color:sc.c }}>{sc.label}</span>
                              </div>
                            </div>
                          );
                        })
                      }
                    </div>
                  );
                })}
              </div>
            )}

            {!loading && schedules.length === 0 && (
              <div style={{ padding:'40px 0', textAlign:'center', color:'#94a3b8' }}>
                <div style={{ fontSize:36, marginBottom:10 }}>📅</div>
                <div style={{ fontWeight:700, fontSize:14 }}>No schedule this week</div>
                <div style={{ fontSize:12, marginTop:4, color:'#cbd5e1' }}>Contact your admin to assign shifts</div>
              </div>
            )}
          </div>

          {/* Legend */}
          <div style={{ display:'flex', gap:14, marginTop:14, flexWrap:'wrap', alignItems:'center', padding:'10px 14px', background:'#f8fafc', borderRadius:12, border:'1px solid #e8edf3' }}>
            {Object.entries(SHIFTS).map(([k,v]) => (
              <div key={k} style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, color:'#64748b' }}>
                <div style={{ width:12, height:12, borderRadius:3, background:v.bg, border:`1.5px solid ${v.border}` }} />
                {v.icon} {v.label}
              </div>
            ))}
            <div style={{ width:1, height:16, background:'#e2e8f0' }} />
            {Object.entries(STATUS_CFG).map(([k,v]) => (
              <div key={k} style={{ display:'flex', alignItems:'center', gap:4, fontSize:12, color:'#64748b' }}>
                <div style={{ width:7, height:7, borderRadius:'50%', background:v.dot }} />
                {v.label}
              </div>
            ))}
            <div style={{ width:1, height:16, background:'#e2e8f0' }} />
            <div style={{ fontSize:11.5, color:ac, fontWeight:600 }}>💡 Click any shift card to update status</div>
          </div>
        </div>
      )}

      {/* ══ TODAY'S SCHEDULE ══ */}
      {activeTab === 'today' && (
        <div>
          <div style={{ marginBottom:16, fontSize:14, color:'#64748b', fontWeight:500 }}>
            {new Date().toLocaleDateString('en-IN',{ weekday:'long', day:'numeric', month:'long', year:'numeric' })}
          </div>
          {loading ? (
            <div style={{ textAlign:'center', padding:48 }}>
              <div style={{ width:28, height:28, border:'3px solid #e2e8f0', borderTopColor:ac, borderRadius:'50%', animation:'spin .7s linear infinite', margin:'0 auto' }} />
            </div>
          ) : todaySchedules.length === 0 ? (
            <div style={{ background:'#fff', border:'1px solid #e8edf3', borderRadius:18, padding:'48px 24px', textAlign:'center' }}>
              <div style={{ fontSize:56, marginBottom:16 }}>😌</div>
              <div style={{ fontWeight:800, fontSize:18, color:'#0f172a', marginBottom:8 }}>No shifts today</div>
              <div style={{ fontSize:14, color:'#94a3b8' }}>You have no scheduled duties. Enjoy your time off!</div>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              {todaySchedules.map((s,i) => {
                const sd = SHIFTS[s.shift] || SHIFTS.morning;
                const sc = STATUS_CFG[s.status] || STATUS_CFG.scheduled;
                return (
                  <motion.div key={i} initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} transition={{ delay:i*.08 }}
                    style={{ background:'#fff', border:`1.5px solid ${sd.border}`, borderRadius:18, overflow:'hidden', boxShadow:'0 4px 16px rgba(0,0,0,.07)' }}>
                    <div style={{ background:`linear-gradient(135deg,${sd.bg},white)`, padding:'18px 22px', borderBottom:`1px solid ${sd.border}`, display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                        <div style={{ width:52, height:52, borderRadius:15, background:`${sd.color}15`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:26 }}>{sd.icon}</div>
                        <div>
                          <div style={{ fontWeight:800, color:'#0f172a', fontSize:17 }}>{sd.label} Shift</div>
                          <div style={{ fontSize:14, fontWeight:600, color:sd.color }}>{sd.time}</div>
                        </div>
                      </div>
                      <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                        <span style={{ padding:'5px 12px', borderRadius:20, fontSize:12, fontWeight:700, background:sc.bg, color:sc.c, display:'flex', alignItems:'center', gap:5 }}>
                          <div style={{ width:6, height:6, borderRadius:'50%', background:sc.dot }} />{sc.label}
                        </span>
                        <button onClick={() => openScheduleModal(s)}
                          style={{ padding:'7px 16px', borderRadius:10, border:`1.5px solid ${ac}`, background:`${ac}10`, color:ac, fontFamily:'inherit', fontWeight:700, fontSize:12.5, cursor:'pointer' }}>
                          ✏️ Update Status
                        </button>
                      </div>
                    </div>
                    <div style={{ padding:'16px 22px', display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(170px,1fr))', gap:10 }}>
                      {[
                        ['🏥 Department', s.department||'Not assigned'],
                        ['📋 Task/Duty',  s.task||'General duty'],
                        ['📅 Date',       new Date(s.date).toLocaleDateString('en-IN',{day:'numeric',month:'long'})],
                        ['🆔 Shift ID',   s._id?.slice(-6)?.toUpperCase()],
                      ].map(([l,v]) => (
                        <div key={l} style={{ background:'#f8fafc', borderRadius:10, padding:'10px 13px' }}>
                          <div style={{ fontSize:10.5, color:'#94a3b8', fontWeight:700, marginBottom:3 }}>{l}</div>
                          <div style={{ fontSize:13, fontWeight:600, color:'#0f172a' }}>{v}</div>
                        </div>
                      ))}
                    </div>
                    {s.notes && (
                      <div style={{ padding:'0 22px 14px', fontSize:13, color:'#64748b' }}>📝 {s.notes}</div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══ MY TASKS ══ */}
      {activeTab === 'tasks' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
          {/* Pending */}
          <div style={{ background:'#fff', border:'1px solid #e8edf3', borderRadius:16, overflow:'hidden' }}>
            <div style={{ padding:'14px 18px', borderBottom:'1px solid #f1f5f9', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ fontSize:18 }}>📋</span>
                <span style={{ fontWeight:800, fontSize:15, color:'#0f172a' }}>Pending Tasks</span>
              </div>
              {pendingTasks.length > 0 && (
                <span style={{ padding:'2px 9px', borderRadius:20, background:'#fef3c7', color:'#92400e', fontSize:12, fontWeight:700 }}>{pendingTasks.length}</span>
              )}
            </div>
            <div style={{ padding:'12px 16px', maxHeight:500, overflowY:'auto' }}>
              {loading ? <div style={{ padding:24, textAlign:'center', color:'#94a3b8' }}>Loading…</div>
              : pendingTasks.length === 0 ? (
                <div style={{ padding:'30px 0', textAlign:'center', color:'#94a3b8' }}>
                  <div style={{ fontSize:40, marginBottom:10 }}>🎉</div>
                  <div style={{ fontWeight:700, fontSize:14 }}>No pending tasks!</div>
                </div>
              ) : pendingTasks.map(t => {
                const pc = PRIORITY_COLOR[t.priority] || PRIORITY_COLOR.medium;
                return (
                  <div key={t._id} style={{ padding:'12px 13px', background:'#f8fafc', borderRadius:12, marginBottom:8, borderLeft:`3px solid ${pc}`, border:`1px solid ${t.priority==='urgent'?'#fecaca':'#e8edf3'}`, borderLeft:`3px solid ${pc}` }}>
                    <div style={{ fontWeight:700, fontSize:13, color:'#0f172a', marginBottom:4 }}>{t.title}</div>
                    {t.description && <div style={{ fontSize:12, color:'#64748b', marginBottom:5 }}>{t.description}</div>}
                    <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginBottom:8 }}>
                      <span style={{ padding:'2px 7px', borderRadius:8, fontSize:11, fontWeight:700, background:`${pc}18`, color:pc }}>{t.priority}</span>
                      <span style={{ padding:'2px 7px', borderRadius:8, fontSize:11, color:'#64748b', background:'#f1f5f9' }}>{t.category}</span>
                      {t.dueDate && <span style={{ padding:'2px 7px', borderRadius:8, fontSize:11, color:'#64748b', background:'#f1f5f9' }}>📅 {new Date(t.dueDate).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</span>}
                      {t.assignedBy && <span style={{ padding:'2px 7px', borderRadius:8, fontSize:11, color:'#94a3b8', background:'#f8fafc' }}>by {t.assignedBy.name?.split(' ')[0]}</span>}
                    </div>
                    <div style={{ display:'flex', gap:6 }}>
                      {t.status === 'pending' && (
                        <button onClick={() => handleTaskUpdate(t._id, 'in_progress')} disabled={saving}
                          style={{ flex:1, padding:'7px', borderRadius:9, border:'1px solid #bfdbfe', background:'#eff6ff', color:'#2563eb', fontFamily:'inherit', fontSize:12, fontWeight:700, cursor:'pointer' }}>
                          ▶ Start
                        </button>
                      )}
                      <button
                        onClick={() => { setUpdateModal({ ...t, _type:'task' }); setUpdateForm({ notes:'', status:'completed' }); }}
                        disabled={saving}
                        style={{ flex:2, padding:'7px', borderRadius:9, border:'none', background:ac, color:'#fff', fontFamily:'inherit', fontSize:12, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>
                        ✓ Mark Complete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Completed */}
          <div style={{ background:'#fff', border:'1px solid #e8edf3', borderRadius:16, overflow:'hidden' }}>
            <div style={{ padding:'14px 18px', borderBottom:'1px solid #f1f5f9', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ fontSize:18 }}>✅</span>
                <span style={{ fontWeight:800, fontSize:15, color:'#0f172a' }}>Completed Tasks</span>
              </div>
              <span style={{ padding:'2px 9px', borderRadius:20, background:'#dcfce7', color:'#15803d', fontSize:12, fontWeight:700 }}>{doneTasks.length}</span>
            </div>
            {tasks.length > 0 && (
              <div style={{ padding:'8px 18px 0' }}>
                <div style={{ height:6, background:'#f1f5f9', borderRadius:3, marginBottom:4 }}>
                  <div style={{ height:'100%', background:`linear-gradient(90deg,${ac},#22c55e)`, borderRadius:3, width:`${tasks.length ? Math.round((doneTasks.length/tasks.length)*100) : 0}%`, transition:'width .5s' }} />
                </div>
                <div style={{ fontSize:11, color:'#94a3b8', marginBottom:8 }}>{Math.round((doneTasks.length/(tasks.length||1))*100)}% complete</div>
              </div>
            )}
            <div style={{ padding:'12px 16px', maxHeight:500, overflowY:'auto' }}>
              {doneTasks.length === 0 ? (
                <div style={{ padding:'30px 0', textAlign:'center', color:'#94a3b8' }}>
                  <div style={{ fontSize:36, marginBottom:8 }}>📋</div>
                  <div style={{ fontSize:13 }}>No completed tasks yet</div>
                </div>
              ) : doneTasks.map(t => (
                <div key={t._id} style={{ padding:'10px 13px', background:'#f0fdf4', borderRadius:10, marginBottom:6, borderLeft:'3px solid #22c55e', opacity:.85 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ color:'#22c55e', fontSize:15 }}>✓</span>
                    <div>
                      <div style={{ fontWeight:700, fontSize:13, color:'#0f172a', textDecoration:'line-through', textDecorationColor:'#94a3b8' }}>{t.title}</div>
                      {t.notes && <div style={{ fontSize:11.5, color:'#64748b', marginTop:2 }}>{t.notes}</div>}
                      {t.completedAt && <div style={{ fontSize:11, color:'#94a3b8', marginTop:2 }}>✅ {new Date(t.completedAt).toLocaleString('en-IN',{ day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}</div>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══ UPDATE MODAL ══ */}
      <AnimatePresence>
        {updateModal && (
          <div onClick={e => { if (e.target === e.currentTarget) setUpdateModal(null); }}
            style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.55)', backdropFilter:'blur(5px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:16 }}>
            <motion.div initial={{ opacity:0, y:22, scale:.96 }} animate={{ opacity:1, y:0, scale:1 }} exit={{ opacity:0, y:22, scale:.96 }}
              style={{ background:'#fff', borderRadius:22, width:'100%', maxWidth:480, boxShadow:'0 32px 80px rgba(0,0,0,.25)', overflow:'hidden' }}>

              {/* Modal header */}
              <div style={{ background:`linear-gradient(135deg,${ac},${ac}cc)`, padding:'18px 22px' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <div>
                    <h3 style={{ color:'#fff', fontWeight:800, fontSize:17, margin:0 }}>
                      {updateModal._type === 'task' ? '✅ Complete Task' : '📋 Update Shift Status'}
                    </h3>
                    <p style={{ color:'rgba(255,255,255,.75)', fontSize:12.5, margin:'4px 0 0' }}>
                      {updateModal._type === 'task'
                        ? updateModal.title
                        : `${SHIFTS[updateModal.shift]?.icon} ${SHIFTS[updateModal.shift]?.label} — ${new Date(updateModal.date).toLocaleDateString('en-IN',{ weekday:'long', day:'numeric', month:'short' })}`
                      }
                    </p>
                  </div>
                  <button onClick={() => setUpdateModal(null)}
                    style={{ background:'rgba(255,255,255,.2)', border:'none', borderRadius:'50%', width:30, height:30, cursor:'pointer', color:'#fff', fontSize:14, display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
                </div>
              </div>

              <div style={{ padding:'22px 24px' }}>

                {/* Schedule-only fields */}
                {!updateModal._type && (
                  <>
                    {/* Status picker */}
                    <div style={{ marginBottom:16 }}>
                      <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#374151', letterSpacing:.5, textTransform:'uppercase', marginBottom:8 }}>Status *</label>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                        {Object.entries(STATUS_CFG).map(([k,v]) => (
                          <button key={k} type="button"
                            onClick={() => setUpdateForm(f => ({ ...f, status: k }))}
                            style={{ padding:'10px 12px', borderRadius:11, border:`1.5px solid ${updateForm.status===k?v.dot:'#e2e8f0'}`, background:updateForm.status===k?v.bg:'#fafbfc', cursor:'pointer', display:'flex', alignItems:'center', gap:8, transition:'all .15s', fontFamily:'inherit' }}>
                            <div style={{ width:9, height:9, borderRadius:'50%', background:v.dot, flexShrink:0 }} />
                            <span style={{ fontSize:13, fontWeight:700, color:updateForm.status===k?v.c:'#374151' }}>{v.label}</span>
                            {updateForm.status===k && <span style={{ marginLeft:'auto', color:v.c, fontSize:13 }}>✓</span>}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Department */}
                    <div style={{ marginBottom:13 }}>
                      <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#374151', letterSpacing:.5, textTransform:'uppercase', marginBottom:5 }}>Department</label>
                      <input value={updateForm.department} onChange={e => setUpdateForm(f=>({...f,department:e.target.value}))}
                        placeholder="e.g. Cardiology, ICU…"
                        style={{ width:'100%', padding:'10px 13px', border:'1.5px solid #e2e8f0', borderRadius:11, fontFamily:'inherit', fontSize:14, outline:'none', boxSizing:'border-box' }} />
                    </div>

                    {/* Task/Duty */}
                    <div style={{ marginBottom:13 }}>
                      <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#374151', letterSpacing:.5, textTransform:'uppercase', marginBottom:5 }}>Task / Duty</label>
                      <input value={updateForm.task} onChange={e => setUpdateForm(f=>({...f,task:e.target.value}))}
                        placeholder="What did/will you do this shift?"
                        style={{ width:'100%', padding:'10px 13px', border:'1.5px solid #e2e8f0', borderRadius:11, fontFamily:'inherit', fontSize:14, outline:'none', boxSizing:'border-box' }} />
                    </div>
                  </>
                )}

                {/* Notes — both schedule and task */}
                <div style={{ marginBottom:20 }}>
                  <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#374151', letterSpacing:.5, textTransform:'uppercase', marginBottom:5 }}>
                    {updateModal._type === 'task' ? 'Completion Notes *' : 'Notes / Comments'}
                  </label>
                  <textarea value={updateForm.notes} onChange={e => setUpdateForm(f=>({...f,notes:e.target.value}))}
                    rows={3}
                    placeholder={updateModal._type === 'task' ? 'Describe what was done, any issues, outcome…' : 'Any notes about this shift…'}
                    style={{ width:'100%', padding:'10px 13px', border:'1.5px solid #e2e8f0', borderRadius:11, fontFamily:'inherit', fontSize:14, outline:'none', resize:'none', boxSizing:'border-box' }} />
                </div>

                {/* Buttons */}
                <div style={{ display:'flex', gap:10 }}>
                  <button onClick={() => setUpdateModal(null)}
                    style={{ flex:1, padding:'12px', borderRadius:12, border:'1.5px solid #e2e8f0', background:'#fff', fontFamily:'inherit', fontWeight:700, cursor:'pointer', fontSize:14 }}>
                    Cancel
                  </button>
                  <button
                    disabled={saving}
                    onClick={async () => {
                      if (updateModal._type === 'task') {
                        await handleTaskUpdate(updateModal._id, 'completed', updateForm.notes);
                      } else {
                        await handleUpdateSchedule();
                      }
                    }}
                    style={{ flex:2, padding:'12px', borderRadius:12, border:'none', background:`linear-gradient(135deg,${ac},${ac}cc)`, color:'#fff', fontFamily:'inherit', fontWeight:800, cursor:saving?'not-allowed':'pointer', fontSize:14, display:'flex', alignItems:'center', justifyContent:'center', gap:8, opacity:saving?.7:1 }}>
                    {saving
                      ? <><div style={{ width:16, height:16, border:'2px solid rgba(255,255,255,.3)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin .7s linear infinite' }} />Saving…</>
                      : updateModal._type === 'task' ? '✅ Mark Complete' : '💾 Save Update'
                    }
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}