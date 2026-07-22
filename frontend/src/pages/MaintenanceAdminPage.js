import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { tasksAPI, usersAPI, facilityAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const MAINTENANCE_ROLES = ['electrician','plumber','it_technician','equipment_tech','biomedical','security','receptionist','ambulance_driver','sweeper'];
const ROLE_CFG = {
  electrician:     { icon:'⚡', label:'Electrician',      color:'#f59e0b', bg:'#fef3c7' },
  plumber:         { icon:'🔧', label:'Plumber',          color:'#0891b2', bg:'#e0f2fe' },
  it_technician:   { icon:'💻', label:'IT Technician',    color:'#6366f1', bg:'#e0e7ff' },
  equipment_tech:  { icon:'🔩', label:'Equipment Tech',   color:'#8b5cf6', bg:'#ede9fe' },
  biomedical:      { icon:'🩺', label:'Biomedical Eng.',  color:'#059669', bg:'#d1fae5' },
  security:        { icon:'🔐', label:'Security',         color:'#374151', bg:'#f3f4f6' },
  receptionist:    { icon:'🏨', label:'Receptionist',     color:'#db2777', bg:'#fce7f3' },
  ambulance_driver:{ icon:'🚑', label:'Ambulance Driver', color:'#dc2626', bg:'#fee2e2' },
  sweeper:         { icon:'🧹', label:'Sweeper',          color:'#d97706', bg:'#fef3c7' },
};
const P_COLOR = { urgent:'#ef4444', high:'#f97316', medium:'#3b82f6', low:'#22c55e' };
const S_COLOR = { pending:'#f59e0b', in_progress:'#3b82f6', completed:'#22c55e', cancelled:'#94a3b8' };

export default function MaintenanceAdminPage() {
  const { user } = useAuth();
  const [tasks, setTasks]     = useState([]);
  const [staff, setStaff]     = useState([]);
  const [rooms, setRooms]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [tab, setTab]         = useState('overview');
  const [filterRole, setFilterRole]     = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [taskForm, setTaskForm]     = useState({ title:'', description:'', assignedTo:'', priority:'medium', dueDate:'', category:'maintenance' });
  const [creating, setCreating]     = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [tRes, sRes, rRes] = await Promise.allSettled([
        tasksAPI.getAll(),
        usersAPI.getAll({ status:'approved', limit:200 }),
        facilityAPI.getRooms({ status:'maintenance' }),
      ]);
      if (tRes.status==='fulfilled') setTasks(tRes.value?.data?.data||[]);
      else setTasks([]);
      if (sRes.status==='fulfilled') setStaff((sRes.value?.data?.data||[]).filter(u=>MAINTENANCE_ROLES.includes(u.role)));
      if (rRes.status==='fulfilled') setRooms(rRes.value?.data?.data||[]);
    } catch { setError('Failed to load data'); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const createTask = async () => {
    if (!taskForm.title||!taskForm.assignedTo) { toast.error('Title and staff required'); return; }
    setCreating(true);
    try {
      await tasksAPI.create(taskForm);
      toast.success('✅ Task assigned!');
      setShowCreate(false);
      setTaskForm({ title:'', description:'', assignedTo:'', priority:'medium', dueDate:'', category:'maintenance' });
      load();
    } catch(e) { toast.error(e.response?.data?.error||'Failed'); }
    setCreating(false);
  };

  const updateStatus = async (id, status) => {
    try {
      await tasksAPI.update(id, { status });
      setTasks(ts=>ts.map(t=>t._id===id?{...t,status}:t));
      if (selectedTask?._id===id) setSelectedTask(st=>({...st,status}));
      toast.success(`Task ${status.replace('_',' ')}`);
    } catch { toast.error('Update failed'); }
  };

  const deleteTask = async (id) => {
    if (!window.confirm('Delete this task?')) return;
    try { await tasksAPI.delete(id); setTasks(ts=>ts.filter(t=>t._id!==id)); setSelectedTask(null); toast.success('Deleted'); }
    catch { toast.error('Delete failed'); }
  };

  const filtered = tasks.filter(t => {
    const assignedStaff = staff.find(s=>s._id===(t.assignedTo?._id||t.assignedTo));
    if (filterRole!=='all' && assignedStaff?.role!==filterRole) return false;
    if (filterStatus!=='all' && t.status!==filterStatus) return false;
    return true;
  });

  const stats = MAINTENANCE_ROLES.reduce((acc,role)=>{
    const rt = tasks.filter(t=>staff.find(s=>s._id===(t.assignedTo?._id||t.assignedTo)&&s.role===role));
    acc[role]={total:rt.length,pending:rt.filter(t=>t.status==='pending').length,active:rt.filter(t=>t.status==='in_progress').length,done:rt.filter(t=>t.status==='completed').length};
    return acc;
  },{});

  return (
    <div style={{padding:'24px',fontFamily:"'Inter',system-ui,sans-serif",maxWidth:1400,margin:'0 auto'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24,flexWrap:'wrap',gap:12}}>
        <div>
          <h1 style={{fontSize:24,fontWeight:900,color:'#0f172a',margin:0}}>🔧 Maintenance Hub</h1>
          <p style={{color:'#94a3b8',fontSize:13,marginTop:4}}>Manage all maintenance staff tasks & assignments</p>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button onClick={()=>setShowCreate(true)} style={{padding:'9px 18px',background:'linear-gradient(135deg,#1648c9,#0891b2)',border:'none',borderRadius:10,color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer'}}>+ Assign Task</button>
          <button onClick={load} style={{padding:'9px 14px',background:'#f1f5f9',border:'1px solid #e2e8f0',borderRadius:10,color:'#475569',fontSize:13,cursor:'pointer'}}>🔄</button>
        </div>
      </div>
      {error&&!loading&&(
        <div style={{background:'#fef2f2',border:'1px solid #fecaca',borderRadius:12,padding:'14px 18px',marginBottom:18,display:'flex',alignItems:'center',gap:10}}>
          <span>⚠️</span><span style={{flex:1,color:'#dc2626',fontSize:13}}>{error}</span>
          <button onClick={load} style={{padding:'6px 12px',background:'#dc2626',color:'#fff',border:'none',borderRadius:7,cursor:'pointer',fontSize:12,fontWeight:700}}>Retry</button>
        </div>
      )}
      {/* Tabs */}
      <div style={{display:'flex',gap:4,marginBottom:20,background:'#f1f5f9',padding:4,borderRadius:12,width:'fit-content'}}>
        {[{id:'overview',l:'📊 Overview'},{id:'tasks',l:'📋 All Tasks'},{id:'staff',l:'👥 Staff'},{id:'rooms',l:'🏥 Rooms'}].map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{padding:'8px 16px',borderRadius:9,border:'none',fontWeight:700,fontSize:13,cursor:'pointer',background:tab===t.id?'#fff':'transparent',color:tab===t.id?'#1648c9':'#64748b',boxShadow:tab===t.id?'0 1px 6px rgba(0,0,0,.09)':'none'}}>{t.l}</button>
        ))}
      </div>
      {loading?(
        <div style={{display:'flex',justifyContent:'center',padding:'60px 0',flexDirection:'column',alignItems:'center',gap:12}}>
          <motion.div animate={{rotate:360}} transition={{duration:1,repeat:Infinity,ease:'linear'}} style={{width:36,height:36,border:'3px solid #e2e8f0',borderTopColor:'#1648c9',borderRadius:'50%'}}/>
          <span style={{color:'#94a3b8',fontSize:13}}>Loading…</span>
        </div>
      ):(
        <>
          {tab==='overview'&&(
            <div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:20}}>
                {[{l:'Total',v:tasks.length,c:'#1648c9',bg:'#eff6ff'},{l:'Pending',v:tasks.filter(t=>t.status==='pending').length,c:'#f59e0b',bg:'#fef3c7'},{l:'In Progress',v:tasks.filter(t=>t.status==='in_progress').length,c:'#3b82f6',bg:'#dbeafe'},{l:'Completed',v:tasks.filter(t=>t.status==='completed').length,c:'#22c55e',bg:'#dcfce7'}].map((s,i)=>(
                  <div key={i} style={{background:s.bg,border:`1px solid ${s.c}30`,borderRadius:13,padding:'16px'}}>
                    <div style={{fontSize:26,fontWeight:900,color:s.c}}>{s.v}</div>
                    <div style={{fontSize:13,color:s.c,fontWeight:600,opacity:.8}}>{s.l}</div>
                  </div>
                ))}
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12}}>
                {MAINTENANCE_ROLES.map(role=>{
                  const cfg=ROLE_CFG[role]; const st=stats[role]||{}; const sc=staff.filter(s=>s.role===role).length;
                  return (
                    <div key={role} style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:14,padding:'16px',cursor:'pointer'}} onClick={()=>{setFilterRole(role);setTab('tasks')}}>
                      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
                        <div style={{width:38,height:38,borderRadius:11,background:cfg.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20}}>{cfg.icon}</div>
                        <div>
                          <div style={{fontWeight:800,fontSize:14,color:'#0f172a'}}>{cfg.label}</div>
                          <div style={{fontSize:11.5,color:'#94a3b8'}}>{sc} staff</div>
                        </div>
                      </div>
                      <div style={{display:'flex',gap:6}}>
                        {[{l:'Pending',v:st.pending||0,c:'#f59e0b'},{l:'Active',v:st.active||0,c:'#3b82f6'},{l:'Done',v:st.done||0,c:'#22c55e'}].map((b,i)=>(
                          <div key={i} style={{flex:1,background:'#f8fafc',borderRadius:8,padding:'7px 4px',textAlign:'center'}}>
                            <div style={{fontSize:16,fontWeight:800,color:b.c}}>{b.v}</div>
                            <div style={{fontSize:9.5,color:'#94a3b8'}}>{b.l}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              {rooms.length>0&&(
                <div style={{marginTop:20,background:'#fffbeb',border:'1px solid #fde68a',borderRadius:14,padding:'16px'}}>
                  <div style={{fontWeight:800,fontSize:14,color:'#92400e',marginBottom:10}}>🔧 Rooms Under Maintenance ({rooms.length})</div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:8}}>
                    {rooms.map(r=>(
                      <div key={r._id} style={{background:'#fff',border:'1px solid #fde68a',borderRadius:10,padding:'10px 14px'}}>
                        <div style={{fontWeight:700,fontSize:13}}>{r.name}</div>
                        <div style={{fontSize:11.5,color:'#92400e'}}>Room {r.number}{r.floor?` · Floor ${r.floor}`:''}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          {tab==='tasks'&&(
            <div>
              <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap'}}>
                <select value={filterRole} onChange={e=>setFilterRole(e.target.value)} style={{padding:'8px 12px',border:'1px solid #e2e8f0',borderRadius:9,fontSize:13,color:'#475569',background:'#fff',cursor:'pointer'}}>
                  <option value="all">All Roles</option>
                  {MAINTENANCE_ROLES.map(r=><option key={r} value={r}>{ROLE_CFG[r]?.icon} {ROLE_CFG[r]?.label}</option>)}
                </select>
                <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={{padding:'8px 12px',border:'1px solid #e2e8f0',borderRadius:9,fontSize:13,color:'#475569',background:'#fff',cursor:'pointer'}}>
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option><option value="in_progress">In Progress</option><option value="completed">Completed</option>
                </select>
              </div>
              {filtered.length===0?(
                <div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:16,padding:'48px',textAlign:'center'}}>
                  <div style={{fontSize:36,marginBottom:10}}>📋</div>
                  <div style={{fontSize:15,fontWeight:700}}>No tasks found</div>
                </div>
              ):(
                <div style={{display:'flex',flexDirection:'column',gap:10}}>
                  {filtered.map(t=>{
                    const assignedStaff=staff.find(s=>s._id===(t.assignedTo?._id||t.assignedTo));
                    const cfg=ROLE_CFG[assignedStaff?.role]||{icon:'🔧',color:'#64748b',bg:'#f8fafc'};
                    return (
                      <motion.div key={t._id} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}}
                        style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:13,padding:'14px 18px',cursor:'pointer'}}
                        onClick={()=>setSelectedTask(t)}
                        onMouseEnter={e=>e.currentTarget.style.boxShadow='0 4px 20px rgba(0,0,0,.07)'}
                        onMouseLeave={e=>e.currentTarget.style.boxShadow='none'}>
                        <div style={{display:'flex',alignItems:'flex-start',gap:12}}>
                          <div style={{width:36,height:36,borderRadius:10,background:cfg.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>{cfg.icon}</div>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:4}}>
                              <span style={{fontWeight:700,fontSize:14,color:'#0f172a'}}>{t.title}</span>
                              <span style={{fontSize:10.5,fontWeight:700,padding:'2px 8px',borderRadius:8,background:`${P_COLOR[t.priority]}20`,color:P_COLOR[t.priority]}}>{t.priority}</span>
                              <span style={{fontSize:10.5,fontWeight:700,padding:'2px 8px',borderRadius:8,background:`${S_COLOR[t.status]}20`,color:S_COLOR[t.status]}}>{t.status?.replace('_',' ')}</span>
                            </div>
                            {t.description&&<p style={{fontSize:12.5,color:'#64748b',margin:'0 0 6px'}}>{t.description}</p>}
                            <div style={{display:'flex',gap:12,flexWrap:'wrap',fontSize:12,color:'#94a3b8'}}>
                              {assignedStaff&&<span>👤 {assignedStaff.name}</span>}
                              {t.dueDate&&<span style={{color:new Date(t.dueDate)<new Date()&&t.status!=='completed'?'#dc2626':'#94a3b8'}}>📅 Due {new Date(t.dueDate).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</span>}
                            </div>
                          </div>
                          <div style={{display:'flex',gap:6,flexShrink:0}}>
                            {t.status==='pending'&&<button onClick={e=>{e.stopPropagation();updateStatus(t._id,'in_progress')}} style={{padding:'5px 10px',background:'#dbeafe',border:'none',borderRadius:7,color:'#1d4ed8',fontSize:11.5,fontWeight:700,cursor:'pointer'}}>▶ Start</button>}
                            {t.status==='in_progress'&&<button onClick={e=>{e.stopPropagation();updateStatus(t._id,'completed')}} style={{padding:'5px 10px',background:'#d1fae5',border:'none',borderRadius:7,color:'#065f46',fontSize:11.5,fontWeight:700,cursor:'pointer'}}>✅ Done</button>}
                            <button onClick={e=>{e.stopPropagation();deleteTask(t._id)}} style={{padding:'5px 10px',background:'#fef2f2',border:'none',borderRadius:7,color:'#dc2626',fontSize:11.5,fontWeight:700,cursor:'pointer'}}>🗑</button>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          {tab==='staff'&&(
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(270px,1fr))',gap:14}}>
              {staff.length===0?(
                <div style={{gridColumn:'1/-1',background:'#fff',border:'1px solid #e2e8f0',borderRadius:16,padding:'48px',textAlign:'center'}}>
                  <div style={{fontSize:36,marginBottom:10}}>👥</div><div style={{fontSize:15,fontWeight:700}}>No maintenance staff found</div>
                </div>
              ):staff.map(s=>{
                const cfg=ROLE_CFG[s.role]||{icon:'🔧',label:s.role,color:'#64748b',bg:'#f8fafc'};
                const st=tasks.filter(t=>(t.assignedTo?._id||t.assignedTo)===s._id);
                return (
                  <div key={s._id} style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:14,padding:'18px'}}>
                    <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:12}}>
                      <div style={{width:42,height:42,borderRadius:13,background:cfg.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22}}>{cfg.icon}</div>
                      <div>
                        <div style={{fontWeight:800,fontSize:14,color:'#0f172a'}}>{s.name}</div>
                        <div style={{fontSize:12,color:cfg.color,fontWeight:600}}>{cfg.label}</div>
                      </div>
                      <div style={{marginLeft:'auto',width:9,height:9,borderRadius:'50%',background:s.isOnline?'#22c55e':'#e2e8f0'}}/>
                    </div>
                    <div style={{display:'flex',gap:6,marginBottom:10}}>
                      {[{l:'Total',v:st.length,c:'#64748b'},{l:'Active',v:st.filter(t=>t.status==='in_progress').length,c:'#3b82f6'},{l:'Done',v:st.filter(t=>t.status==='completed').length,c:'#22c55e'}].map((b,i)=>(
                        <div key={i} style={{flex:1,background:'#f8fafc',borderRadius:8,padding:'6px 4px',textAlign:'center'}}>
                          <div style={{fontSize:16,fontWeight:800,color:b.c}}>{b.v}</div>
                          <div style={{fontSize:9.5,color:'#94a3b8'}}>{b.l}</div>
                        </div>
                      ))}
                    </div>
                    <button onClick={()=>{setTaskForm(f=>({...f,assignedTo:s._id}));setShowCreate(true)}} style={{width:'100%',padding:'8px',background:`${cfg.color}15`,border:`1px solid ${cfg.color}30`,borderRadius:9,color:cfg.color,fontSize:12.5,fontWeight:700,cursor:'pointer'}}>+ Assign Task</button>
                  </div>
                );
              })}
            </div>
          )}
          {tab==='rooms'&&(
            <div>
              {rooms.length===0?(
                <div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:16,padding:'48px',textAlign:'center'}}>
                  <div style={{fontSize:36,marginBottom:10}}>🏥</div><div style={{fontSize:15,fontWeight:700}}>All rooms operational</div>
                </div>
              ):(
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))',gap:14}}>
                  {rooms.map(r=>(
                    <div key={r._id} style={{background:'#fffbeb',border:'1px solid #fde68a',borderRadius:14,padding:'16px'}}>
                      <div style={{fontWeight:800,fontSize:14,color:'#0f172a',marginBottom:4}}>{r.name}</div>
                      <div style={{fontSize:12.5,color:'#92400e'}}>Room {r.number}{r.floor?` · Floor ${r.floor}`:''}</div>
                      <div style={{fontSize:12,color:'#94a3b8',marginTop:2}}>{r.type}</div>
                      {r.notes&&<div style={{fontSize:12,color:'#78350f',marginTop:6,background:'#fff',borderRadius:8,padding:'7px 10px'}}>{r.notes}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Create task modal */}
      <AnimatePresence>
        {showCreate&&(
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',zIndex:100,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}
            onClick={()=>setShowCreate(false)}>
            <motion.div initial={{scale:.95}} animate={{scale:1}} exit={{scale:.95}} onClick={e=>e.stopPropagation()}
              style={{background:'#fff',borderRadius:20,padding:'28px',width:'100%',maxWidth:480}}>
              <h3 style={{margin:'0 0 20px',fontSize:18,fontWeight:800,color:'#0f172a'}}>📋 Assign Task</h3>
              <div style={{display:'flex',flexDirection:'column',gap:12}}>
                <div>
                  <label style={{display:'block',fontSize:12,fontWeight:700,color:'#374151',marginBottom:5}}>Task Title *</label>
                  <input value={taskForm.title} onChange={e=>setTaskForm(f=>({...f,title:e.target.value}))} placeholder="e.g. Fix electrical panel in Ward B"
                    style={{width:'100%',padding:'10px',border:'1.5px solid #e2e8f0',borderRadius:9,fontSize:13.5,outline:'none'}}/>
                </div>
                <div>
                  <label style={{display:'block',fontSize:12,fontWeight:700,color:'#374151',marginBottom:5}}>Assign To *</label>
                  <select value={taskForm.assignedTo} onChange={e=>setTaskForm(f=>({...f,assignedTo:e.target.value}))}
                    style={{width:'100%',padding:'10px',border:'1.5px solid #e2e8f0',borderRadius:9,fontSize:13.5,outline:'none'}}>
                    <option value="">Select staff…</option>
                    {MAINTENANCE_ROLES.map(role=>{
                      const cfg=ROLE_CFG[role]; const rs=staff.filter(s=>s.role===role);
                      if (!rs.length) return null;
                      return <optgroup key={role} label={`${cfg.icon} ${cfg.label}`}>{rs.map(s=><option key={s._id} value={s._id}>{s.name}</option>)}</optgroup>;
                    })}
                  </select>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                  <div>
                    <label style={{display:'block',fontSize:12,fontWeight:700,color:'#374151',marginBottom:5}}>Priority</label>
                    <select value={taskForm.priority} onChange={e=>setTaskForm(f=>({...f,priority:e.target.value}))} style={{width:'100%',padding:'10px',border:'1.5px solid #e2e8f0',borderRadius:9,fontSize:13.5,outline:'none'}}>
                      <option value="low">🟢 Low</option><option value="medium">🔵 Medium</option><option value="high">🟠 High</option><option value="urgent">🔴 Urgent</option>
                    </select>
                  </div>
                  <div>
                    <label style={{display:'block',fontSize:12,fontWeight:700,color:'#374151',marginBottom:5}}>Due Date</label>
                    <input type="date" value={taskForm.dueDate} onChange={e=>setTaskForm(f=>({...f,dueDate:e.target.value}))} style={{width:'100%',padding:'10px',border:'1.5px solid #e2e8f0',borderRadius:9,fontSize:13.5,outline:'none'}}/>
                  </div>
                </div>
                <div>
                  <label style={{display:'block',fontSize:12,fontWeight:700,color:'#374151',marginBottom:5}}>Description</label>
                  <textarea value={taskForm.description} onChange={e=>setTaskForm(f=>({...f,description:e.target.value}))} rows={2} placeholder="Task details, location, requirements…"
                    style={{width:'100%',padding:'10px',border:'1.5px solid #e2e8f0',borderRadius:9,fontSize:13.5,outline:'none',resize:'vertical'}}/>
                </div>
                <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
                  <button onClick={()=>setShowCreate(false)} style={{padding:'10px 20px',background:'#f1f5f9',border:'1px solid #e2e8f0',borderRadius:9,fontSize:13.5,fontWeight:600,cursor:'pointer',color:'#475569'}}>Cancel</button>
                  <button onClick={createTask} disabled={creating} style={{padding:'10px 20px',background:'linear-gradient(135deg,#1648c9,#0891b2)',border:'none',borderRadius:9,fontSize:13.5,fontWeight:700,cursor:'pointer',color:'#fff',opacity:creating?.7:1}}>
                    {creating?'Assigning…':'✅ Assign Task'}
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
