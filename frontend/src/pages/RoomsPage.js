import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { facilityAPI, usersAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { getSocket } from '../utils/socket';
import toast from 'react-hot-toast';

const TYPE_CFG = {
  OT:        { icon:'🔪', color:'#ef4444', label:'Operation Theater' },
  ICU:       { icon:'❤️', color:'#dc2626', label:'ICU' },
  Ward:      { icon:'🛏️', color:'#0891b2', label:'Ward' },
  General:   { icon:'🏥', color:'#059669', label:'General' },
  Emergency: { icon:'🚨', color:'#f97316', label:'Emergency' },
  Recovery:  { icon:'💚', color:'#16a34a', label:'Recovery' },
};
const STATUS_CFG = {
  available:   { bg:'#dcfce7', color:'#15803d', label:'Available',   dot:'#22c55e' },
  occupied:    { bg:'#fee2e2', color:'#dc2626', label:'Occupied',     dot:'#ef4444' },
  maintenance: { bg:'#fef3c7', color:'#92400e', label:'Maintenance',  dot:'#f59e0b' },
  cleaning:    { bg:'#e0f2fe', color:'#0369a1', label:'Cleaning',     dot:'#0ea5e9' },
  reserved:    { bg:'#f5f3ff', color:'#6d28d9', label:'Reserved',     dot:'#7c3aed' },
};
const SHIFTS = { morning:'🌅 08:00–16:00', afternoon:'🌇 14:00–22:00', night:'🌙 22:00–08:00', full:'☀️ Full Day' };
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function getWeekDates(offset=0) {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now); monday.setDate(now.getDate() - day + 1 + offset*7);
  return Array.from({length:7},(_,i) => { const d = new Date(monday); d.setDate(monday.getDate()+i); return d; });
}

export default function RoomsPage() {
  const { user } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('rooms');
  const [filterType, setFilterType] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [weekOffset, setWeekOffset] = useState(0);
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [showMaintModal, setShowMaintModal] = useState(false);
  const [maintRoom, setMaintRoom] = useState(null); // room being set to maintenance
  const [maintForm, setMaintForm] = useState({ reason:'', estimatedDays:1, assignedTo:'', notes:'' });
  const [maintSaving, setMaintSaving] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [editRoom, setEditRoom] = useState(null);
  const [roomForm, setRoomForm] = useState({ name:'', type:'OT', number:'', floor:1, capacity:1, occupiedBeds:0, status:'available', equipment:'', notes:'', cleanedBy:'', assignedDoctor:'' });
  const [scheduleForm, setScheduleForm] = useState({ user:'', role:'doctor', date:'', shift:'morning', department:'', task:'', notes:'' });
  const [saving, setSaving] = useState(false);
  const [roomAssignConfirm, setRoomAssignConfirm] = useState(null); // { data, prevDoctorName, newDoctorName }

  const isAdmin = user?.role === 'admin';
  const weekDates = getWeekDates(weekOffset);
  const ac = '#2563eb';

  const load = async () => {
    setLoading(true);
    try {
      const [rRes, sRes, uRes] = await Promise.allSettled([
        facilityAPI.getRooms(),
        facilityAPI.getSchedules({ week: weekDates[0].toISOString() }),
        isAdmin ? usersAPI.getAll({ status:'approved' }) : Promise.resolve({ data:{ data:[] } }),
      ]);
      setRooms(rRes.value?.data?.data || []);
      setSchedules(sRes.value?.data?.data || []);
      setAllUsers(uRes.value?.data?.data || []);
    } catch { toast.error('Failed to load data'); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [weekOffset]);

  // Real-time room updates
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handler = ({ roomId, status }) => {
      setRooms(rs => rs.map(r => r._id === roomId ? { ...r, status } : r));
    };
    socket.on('room_updated', handler);
    return () => socket.off('room_updated', handler);
  }, []);

  const handleRoomStatusChange = async (id, status) => {
    try {
      await facilityAPI.updateRoom(id, { status });
      toast.success(`Room marked as ${status}`);
      load();
    } catch { toast.error('Update failed'); }
  };

  const handleStartMaintenance = async () => {
    if (!maintRoom) return;
    setMaintSaving(true);
    try {
      const notes = [
        maintForm.reason && `Reason: ${maintForm.reason}`,
        maintForm.estimatedDays && `Est. ${maintForm.estimatedDays} day(s)`,
        maintForm.assignedTo && `Assigned to: ${maintForm.assignedTo}`,
        maintForm.notes,
      ].filter(Boolean).join(' | ');
      await facilityAPI.updateRoom(maintRoom._id, {
        status: 'maintenance',
        notes,
        lastCleaned: new Date(),
        cleanedBy: maintForm.assignedTo || user?.name,
      });
      toast.success(`🔧 ${maintRoom.name} is now under maintenance`);
      setShowMaintModal(false);
      setMaintRoom(null);
      setMaintForm({ reason:'', estimatedDays:1, assignedTo:'', notes:'' });
      load();
    } catch(e) { toast.error(e.response?.data?.error || 'Failed to update'); }
    setMaintSaving(false);
  };

  const handleEndMaintenance = async (room) => {
    try {
      await facilityAPI.updateRoom(room._id, { status:'available', notes:'' });
      toast.success(`✅ ${room.name} maintenance complete — now available`);
      load();
    } catch { toast.error('Failed to update'); }
  };

  const doSaveRoom = async (data) => {
    setSaving(true);
    try {
      if (editRoom) {
        await facilityAPI.updateRoom(editRoom._id, data);
        toast.success('Room updated!');
      } else {
        await facilityAPI.createRoom(data);
        toast.success('Room created!');
      }
      setShowRoomModal(false);
      setEditRoom(null);
      setRoomForm({ name:'', type:'OT', number:'', floor:1, capacity:1, occupiedBeds:0, status:'available', equipment:'', notes:'', cleanedBy:'', assignedDoctor:'' });
      load();
    } catch(e) { toast.error(e.response?.data?.error || 'Save failed'); }
    setSaving(false);
  };

  const handleSaveRoom = async () => {
    const data = { ...roomForm, floor: Number(roomForm.floor)||1, capacity: Number(roomForm.capacity)||1, occupiedBeds: Number(roomForm.occupiedBeds)||0, equipment: roomForm.equipment ? roomForm.equipment.split(',').map(e=>e.trim()).filter(Boolean) : [] };

    // Conflict check: this room is already assigned to a different doctor
    // than the one just selected — confirm with the admin before
    // overwriting that assignment, exactly like reassigning a real ward.
    const prevDoctorId = editRoom?.assignedDoctor?._id || editRoom?.assignedDoctor || '';
    const newDoctorId  = roomForm.assignedDoctor || '';
    if (editRoom && newDoctorId && prevDoctorId && prevDoctorId !== newDoctorId) {
      const prevDoctorName = editRoom.assignedDoctor?.name || allUsers.find(u=>u._id===prevDoctorId)?.name || 'another doctor';
      const newDoctorName  = allUsers.find(u=>u._id===newDoctorId)?.name || 'this doctor';
      setRoomAssignConfirm({ data, prevDoctorName, newDoctorName });
      return;
    }
    doSaveRoom(data);
  };

  const handleSaveSchedule = async () => {
    setSaving(true);
    try {
      await facilityAPI.createSchedule(scheduleForm);
      toast.success('Schedule added!');
      setShowScheduleModal(false);
      setScheduleForm({ user:'', role:'doctor', date:'', shift:'morning', department:'', task:'', notes:'' });
      load();
    } catch(e) { toast.error(e.response?.data?.error || 'Save failed'); }
    setSaving(false);
  };

  const handleDeleteRoom = async (id) => {
    if (!window.confirm('Delete this room?')) return;
    try { await facilityAPI.deleteRoom(id); toast.success('Deleted'); load(); }
    catch { toast.error('Delete failed'); }
  };

  const filteredRooms = rooms.filter(r => (filterType==='All'||r.type===filterType) && (filterStatus==='All'||r.status===filterStatus));
  const stats = Object.keys(STATUS_CFG).map(s => ({ status:s, count:rooms.filter(r=>r.status===s).length }));

  return (
    <div style={{ fontFamily:"'Outfit',system-ui,sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap');`}</style>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:10 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:800, color:'#0f172a', margin:0 }}>🏥 Rooms & OT Management</h1>
          <p style={{ color:'#94a3b8', fontSize:13, marginTop:3 }}>Real-time room availability, OT schedule & staff timetable</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          {isAdmin && activeTab==='rooms' && <button onClick={()=>{ setEditRoom(null); setRoomForm({ name:'', type:'OT', number:'', floor:1, capacity:1, occupiedBeds:0, status:'available', equipment:'', notes:'', cleanedBy:'', assignedDoctor:'' }); setShowRoomModal(true); }} style={{ padding:'9px 18px', borderRadius:12, border:'none', background:'#2563eb', color:'#fff', fontFamily:'inherit', fontWeight:700, fontSize:13, cursor:'pointer' }}>+ Add Room</button>}
          {isAdmin && activeTab==='timetable' && <button onClick={()=>setShowScheduleModal(true)} style={{ padding:'9px 18px', borderRadius:12, border:'none', background:'#059669', color:'#fff', fontFamily:'inherit', fontWeight:700, fontSize:13, cursor:'pointer' }}>+ Add Schedule</button>}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:6, marginBottom:20, background:'#f1f5f9', borderRadius:14, padding:4, width:'fit-content' }}>
        {[['rooms','🏥 Rooms & OT'],['maintenance','🔧 Maintenance'],['timetable','📆 Timetable']].map(([k,l]) => (
          <button key={k} onClick={()=>setActiveTab(k)}
            style={{ padding:'9px 20px', borderRadius:11, border:'none', background:activeTab===k?'#fff':'transparent', color:activeTab===k?'#0f172a':'#64748b', fontFamily:'inherit', fontWeight:700, fontSize:13, cursor:'pointer', boxShadow:activeTab===k?'0 2px 8px rgba(0,0,0,.08)':'none', transition:'all .2s' }}>
            {l}
          </button>
        ))}
      </div>

      {activeTab === 'rooms' && (
        <>
          {/* Stats */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))', gap:10, marginBottom:20 }}>
            {stats.map(s => (
              <div key={s.status} style={{ background:'#fff', border:'1px solid #e8edf3', borderRadius:12, padding:'12px 14px', display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:10, height:10, borderRadius:'50%', background:STATUS_CFG[s.status]?.dot, flexShrink:0 }} />
                <div>
                  <div style={{ fontSize:18, fontWeight:800, color:'#0f172a' }}>{s.count}</div>
                  <div style={{ fontSize:11, color:'#94a3b8', textTransform:'capitalize' }}>{s.status}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:16 }}>
            {['All',...Object.keys(TYPE_CFG)].map(t => (
              <button key={t} onClick={()=>setFilterType(t)}
                style={{ padding:'5px 14px', borderRadius:20, border:`1.5px solid ${filterType===t?ac:'#e2e8f0'}`, background:filterType===t?ac:'#fff', color:filterType===t?'#fff':'#64748b', fontFamily:'inherit', fontSize:12, fontWeight:600, cursor:'pointer', transition:'all .15s' }}>
                {t==='All'?'All Types':`${TYPE_CFG[t]?.icon} ${t}`}
              </button>
            ))}
            <div style={{ width:1, background:'#e2e8f0', margin:'0 4px' }} />
            {['All','available','occupied','cleaning','maintenance'].map(s => (
              <button key={s} onClick={()=>setFilterStatus(s)}
                style={{ padding:'5px 14px', borderRadius:20, border:`1.5px solid ${filterStatus===s?(STATUS_CFG[s]?.dot||ac):'#e2e8f0'}`, background:filterStatus===s?(STATUS_CFG[s]?.dot||ac):'#fff', color:filterStatus===s?'#fff':'#64748b', fontFamily:'inherit', fontSize:12, fontWeight:600, cursor:'pointer', transition:'all .15s' }}>
                {s==='All'?'All Status':s.charAt(0).toUpperCase()+s.slice(1)}
              </button>
            ))}
          </div>

          {/* Room Grid */}
          {loading ? (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))', gap:12 }}>
              {Array(8).fill(0).map((_,i)=><div key={i} style={{ height:200, background:'#f1f5f9', borderRadius:14 }} />)}
            </div>
          ) : filteredRooms.length === 0 ? (
            <div style={{ textAlign:'center', padding:64, color:'#94a3b8' }}><div style={{ fontSize:48,marginBottom:12 }}>🏥</div><div style={{ fontWeight:700 }}>No rooms found</div></div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))', gap:12 }}>
              {filteredRooms.map((room,i) => {
                const tc = TYPE_CFG[room.type] || TYPE_CFG.General;
                const sc = STATUS_CFG[room.status] || STATUS_CFG.available;
                return (
                  <motion.div key={room._id} initial={{ opacity:0,y:12 }} animate={{ opacity:1,y:0 }} transition={{ delay:i*.04 }}
                    style={{ background:'#fff', border:'1.5px solid #e8edf3', borderRadius:14, overflow:'hidden', transition:'all .2s' }}
                    onMouseEnter={e=>{e.currentTarget.style.boxShadow='0 8px 24px rgba(0,0,0,.1)';e.currentTarget.style.transform='translateY(-2px)';}}
                    onMouseLeave={e=>{e.currentTarget.style.boxShadow='none';e.currentTarget.style.transform='none';}}>
                    {/* Top bar */}
                    <div style={{ height:4, background:`linear-gradient(90deg,${tc.color},${tc.color}80)` }} />
                    <div style={{ padding:'16px' }}>
                      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:12 }}>
                        <div>
                          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
                            <span style={{ fontSize:20 }}>{tc.icon}</span>
                            <div>
                              <div style={{ fontWeight:800, color:'#0f172a', fontSize:14 }}>{room.name}</div>
                              <div style={{ fontSize:11, color:'#94a3b8' }}>Room {room.number} · Floor {room.floor}</div>
                            </div>
                          </div>
                          <span style={{ display:'inline-block', padding:'2px 8px', borderRadius:20, fontSize:10.5, fontWeight:700, background:tc.color+'15', color:tc.color }}>{room.type}</span>
                        </div>
                        <span style={{ padding:'3px 9px', borderRadius:20, fontSize:11, fontWeight:700, background:sc.bg, color:sc.color, display:'flex', alignItems:'center', gap:4 }}>
                          <div style={{ width:6,height:6,borderRadius:'50%',background:sc.dot }} />{sc.label}
                        </span>
                      </div>

                      {/* Occupancy bar */}
                      <div style={{ marginBottom:10 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                          <span style={{ fontSize:11, color:'#64748b' }}>Occupancy</span>
                          <span style={{ fontSize:11, fontWeight:700, color:'#0f172a' }}>{room.occupiedBeds}/{room.capacity}</span>
                        </div>
                        <div style={{ height:6, background:'#f1f5f9', borderRadius:3 }}>
                          <div style={{ height:'100%', background: room.occupiedBeds===room.capacity?'#ef4444':tc.color, borderRadius:3, width:`${(room.occupiedBeds/room.capacity)*100}%`, transition:'width .3s' }} />
                        </div>
                      </div>

                      {room.assignedPatient && (
                        <div style={{ background:'#fef2f2', borderRadius:8, padding:'6px 9px', fontSize:11.5, color:'#dc2626', marginBottom:8, display:'flex', alignItems:'center', gap:5 }}>
                          👤 <span style={{ fontWeight:600 }}>{room.assignedPatient.name}</span>
                        </div>
                      )}
                      {room.assignedDoctor && (
                        <div style={{ background:'#ecfeff', borderRadius:8, padding:'6px 9px', fontSize:11.5, color:'#0891b2', marginBottom:8, display:'flex', alignItems:'center', gap:5 }}>
                          ⚕️ Dr. {room.assignedDoctor.name}
                        </div>
                      )}

                      {/* Actions */}
                      <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginTop:8 }}>
                        {room.status !== 'available' && (
                          <button onClick={e=>{e.stopPropagation();handleRoomStatusChange(room._id,'available');}}
                            style={{ flex:1, padding:'6px', borderRadius:8, border:'1px solid #bbf7d0', background:'#f0fdf4', color:'#15803d', fontFamily:'inherit', fontSize:11, fontWeight:700, cursor:'pointer' }}>
                            ✓ Available
                          </button>
                        )}
                        {room.status === 'available' && (
                          <button onClick={e=>{e.stopPropagation();handleRoomStatusChange(room._id,'occupied');}}
                            style={{ flex:1, padding:'6px', borderRadius:8, border:'1px solid #fecaca', background:'#fef2f2', color:'#dc2626', fontFamily:'inherit', fontSize:11, fontWeight:700, cursor:'pointer' }}>
                            Occupied
                          </button>
                        )}
                        {['admin','nurse','wardboy','sweeper','otboy'].includes(user?.role) && (
                          <button onClick={e=>{e.stopPropagation();handleRoomStatusChange(room._id,'cleaning');}}
                            style={{ padding:'6px 10px', borderRadius:8, border:'1px solid #bae6fd', background:'#f0f9ff', color:'#0369a1', fontFamily:'inherit', fontSize:11, fontWeight:700, cursor:'pointer' }}>
                            🧹
                          </button>
                        )}
                        {isAdmin && (
                          <>
                            <button onClick={e=>{e.stopPropagation();setEditRoom(room);setRoomForm({ name:room.name, type:room.type, number:room.number, floor:room.floor, capacity:room.capacity, occupiedBeds:room.occupiedBeds||0, status:room.status||'available', equipment:(room.equipment||[]).join(', '), notes:room.notes||'', cleanedBy:room.cleanedBy||'', assignedDoctor:room.assignedDoctor?._id||room.assignedDoctor||'' });setShowRoomModal(true);}}
                              style={{ padding:'6px 10px', borderRadius:8, border:'1px solid #e2e8f0', background:'#f8fafc', color:'#374151', fontFamily:'inherit', fontSize:11, fontWeight:700, cursor:'pointer' }}>✏️</button>
                            <button onClick={e=>{e.stopPropagation();handleDeleteRoom(room._id);}}
                              style={{ padding:'6px 10px', borderRadius:8, border:'1px solid #fecaca', background:'#fef2f2', color:'#dc2626', fontFamily:'inherit', fontSize:11, fontWeight:700, cursor:'pointer' }}>🗑</button>
                          </>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ══ MAINTENANCE TAB ══ */}
      {activeTab === 'maintenance' && (
        <div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:10 }}>
            <div>
              <h2 style={{ fontSize:18, fontWeight:800, color:'#0f172a', margin:0 }}>🔧 Maintenance Management</h2>
              <p style={{ color:'#94a3b8', fontSize:13, marginTop:3 }}>Mark rooms/OTs under maintenance. Notifications sent to all staff instantly.</p>
            </div>
            {isAdmin && (
              <div style={{ padding:'8px 14px', background:'#fffbeb', border:'1px solid #fde68a', borderRadius:12, fontSize:12.5, color:'#92400e', fontWeight:600 }}>
                ⚡ Staff notified in real-time via notifications
              </div>
            )}
          </div>

          {/* Stats row */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))', gap:12, marginBottom:24 }}>
            {[
              { icon:'🔧', label:'Under Maintenance', val:rooms.filter(r=>r.status==='maintenance').length, bg:'#fffbeb', c:'#92400e' },
              { icon:'✅', label:'Available',          val:rooms.filter(r=>r.status==='available').length,   bg:'#f0fdf4', c:'#15803d' },
              { icon:'🔴', label:'Occupied',           val:rooms.filter(r=>r.status==='occupied').length,    bg:'#fef2f2', c:'#dc2626' },
              { icon:'🧹', label:'Cleaning',           val:rooms.filter(r=>r.status==='cleaning').length,    bg:'#eff6ff', c:'#1d4ed8' },
            ].map((s,i) => (
              <motion.div key={i} initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay:i*.06 }}
                style={{ background:'#fff', border:'1px solid #e8edf3', borderRadius:14, padding:'14px', display:'flex', alignItems:'center', gap:12 }}>
                <div style={{ width:42, height:42, borderRadius:12, background:s.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>{s.icon}</div>
                <div><div style={{ fontSize:24, fontWeight:900, color:'#0f172a', lineHeight:1 }}>{s.val}</div><div style={{ fontSize:11, color:'#94a3b8', marginTop:2 }}>{s.label}</div></div>
              </motion.div>
            ))}
          </div>

          {/* Currently under maintenance */}
          {rooms.filter(r => r.status === 'maintenance').length > 0 && (
            <div style={{ marginBottom:24 }}>
              <div style={{ fontSize:11, color:'#92400e', fontWeight:700, letterSpacing:.8, textTransform:'uppercase', marginBottom:10, display:'flex', alignItems:'center', gap:6 }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background:'#f59e0b', animation:'pulse 1.5s ease-in-out infinite' }} />
                Currently Under Maintenance ({rooms.filter(r=>r.status==='maintenance').length})
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:12 }}>
                {rooms.filter(r => r.status === 'maintenance').map(room => {
                  const tc = TYPE_CFG[room.type] || TYPE_CFG.General;
                  return (
                    <motion.div key={room._id} initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
                      style={{ background:'#fff', border:'2px solid #fde68a', borderRadius:14, overflow:'hidden', boxShadow:'0 4px 16px rgba(245,158,11,.15)' }}>
                      <div style={{ height:3, background:'linear-gradient(90deg,#f59e0b,#ef4444)' }} />
                      <div style={{ padding:'16px' }}>
                        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:10 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                            <div style={{ width:40, height:40, borderRadius:11, background:`${tc.color}15`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>{tc.icon}</div>
                            <div>
                              <div style={{ fontWeight:800, color:'#0f172a', fontSize:14 }}>{room.name}</div>
                              <div style={{ fontSize:12, color:'#64748b' }}>Room {room.number} · Floor {room.floor} · {room.type}</div>
                            </div>
                          </div>
                          <div style={{ padding:'3px 9px', borderRadius:20, fontSize:11, fontWeight:700, background:'#fef3c7', color:'#92400e', display:'flex', alignItems:'center', gap:4 }}>
                            <div style={{ width:5, height:5, borderRadius:'50%', background:'#f59e0b' }} />🔧 Maintenance
                          </div>
                        </div>
                        {room.notes && (
                          <div style={{ background:'#fffbeb', borderRadius:9, padding:'8px 11px', fontSize:12.5, color:'#92400e', marginBottom:10, border:'1px solid #fde68a' }}>
                            📋 {room.notes}
                          </div>
                        )}
                        {isAdmin && (
                          <button onClick={() => handleEndMaintenance(room)}
                            style={{ width:'100%', padding:'9px', borderRadius:10, border:'none', background:'linear-gradient(135deg,#059669,#34d399)', color:'#fff', fontFamily:'inherit', fontWeight:700, fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                            ✅ Mark Maintenance Complete
                          </button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}

          {/* All rooms — admin can set any to maintenance */}
          {isAdmin && (
            <div>
              <div style={{ fontSize:11, color:'#94a3b8', fontWeight:700, letterSpacing:.8, textTransform:'uppercase', marginBottom:10 }}>
                All Rooms — Click to Schedule Maintenance
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:10 }}>
                {rooms.filter(r => r.status !== 'maintenance').map((room,i) => {
                  const tc = TYPE_CFG[room.type] || TYPE_CFG.General;
                  const sc = STATUS_CFG[room.status] || STATUS_CFG.available;
                  return (
                    <motion.div key={room._id} initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ delay:i*.04 }}
                      style={{ background:'#fff', border:'1.5px solid #e8edf3', borderRadius:13, padding:'14px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, transition:'all .2s' }}
                      onMouseEnter={e=>{e.currentTarget.style.borderColor='#f59e0b';e.currentTarget.style.boxShadow='0 4px 16px rgba(245,158,11,.12)';}}
                      onMouseLeave={e=>{e.currentTarget.style.borderColor='#e8edf3';e.currentTarget.style.boxShadow='none';}}>
                      <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:0 }}>
                        <div style={{ width:38, height:38, borderRadius:10, background:`${tc.color}15`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>{tc.icon}</div>
                        <div style={{ minWidth:0 }}>
                          <div style={{ fontWeight:700, fontSize:13, color:'#0f172a', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{room.name}</div>
                          <div style={{ fontSize:11.5, color:'#94a3b8' }}>Room {room.number} · Floor {room.floor}</div>
                          <span style={{ padding:'2px 7px', borderRadius:8, fontSize:10.5, fontWeight:700, background:sc.bg, color:sc.color, marginTop:2, display:'inline-block' }}>{room.status}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => { setMaintRoom(room); setMaintForm({ reason:'', estimatedDays:1, assignedTo:'', notes:'' }); setShowMaintModal(true); }}
                        style={{ padding:'7px 13px', borderRadius:9, border:'1.5px solid #fde68a', background:'#fffbeb', color:'#92400e', fontFamily:'inherit', fontSize:11.5, fontWeight:700, cursor:'pointer', flexShrink:0, transition:'all .15s', whiteSpace:'nowrap' }}
                        onMouseEnter={e=>{e.currentTarget.style.background='#f59e0b';e.currentTarget.style.color='#fff';e.currentTarget.style.borderColor='#f59e0b';}}
                        onMouseLeave={e=>{e.currentTarget.style.background='#fffbeb';e.currentTarget.style.color='#92400e';e.currentTarget.style.borderColor='#fde68a';}}>
                        🔧 Maintenance
                      </button>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}

          <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
        </div>
      )}

      {activeTab === 'timetable' && (
        <div>
          {/* Week nav */}
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
            <button onClick={()=>setWeekOffset(w=>w-1)} style={{ padding:'7px 14px', borderRadius:10, border:'1px solid #e2e8f0', background:'#fff', cursor:'pointer', fontFamily:'inherit', fontSize:13, fontWeight:600 }}>← Prev</button>
            <div style={{ fontWeight:700, color:'#0f172a', fontSize:14 }}>
              {weekDates[0].toLocaleDateString('en',{month:'short',day:'numeric'})} – {weekDates[6].toLocaleDateString('en',{month:'short',day:'numeric',year:'numeric'})}
            </div>
            <button onClick={()=>setWeekOffset(w=>w+1)} style={{ padding:'7px 14px', borderRadius:10, border:'1px solid #e2e8f0', background:'#fff', cursor:'pointer', fontFamily:'inherit', fontSize:13, fontWeight:600 }}>Next →</button>
            <button onClick={()=>setWeekOffset(0)} style={{ padding:'7px 14px', borderRadius:10, border:'1px solid #2563eb', background:'#eff6ff', color:'#2563eb', cursor:'pointer', fontFamily:'inherit', fontSize:13, fontWeight:700 }}>Today</button>
          </div>

          {/* Timetable grid */}
          <div style={{ background:'#fff', border:'1px solid #e8edf3', borderRadius:16, overflow:'hidden' }}>
            <div style={{ display:'grid', gridTemplateColumns:'160px repeat(7,1fr)', borderBottom:'2px solid #f1f5f9' }}>
              <div style={{ padding:'12px 14px', fontWeight:700, color:'#64748b', fontSize:12, background:'#f8fafc' }}>Staff</div>
              {weekDates.map((d,i) => {
                const isToday = d.toDateString() === new Date().toDateString();
                return (
                  <div key={i} style={{ padding:'12px 8px', textAlign:'center', background: isToday?'#eff6ff':'#f8fafc', borderLeft:'1px solid #f1f5f9' }}>
                    <div style={{ fontSize:11, color:'#94a3b8', fontWeight:600 }}>{DAYS[d.getDay()]}</div>
                    <div style={{ fontSize:16, fontWeight:800, color: isToday?'#2563eb':'#0f172a', marginTop:2 }}>{d.getDate()}</div>
                    {isToday && <div style={{ width:6,height:6,borderRadius:'50%',background:'#2563eb',margin:'3px auto 0' }} />}
                  </div>
                );
              })}
            </div>
            {loading ? (
              <div style={{ padding:40,textAlign:'center',color:'#94a3b8' }}>Loading schedules…</div>
            ) : schedules.length === 0 ? (
              <div style={{ padding:48, textAlign:'center', color:'#94a3b8' }}>
                <div style={{ fontSize:36, marginBottom:8 }}>📆</div>
                <div style={{ fontWeight:700 }}>No schedules this week</div>
                {isAdmin && <div style={{ fontSize:12, marginTop:4 }}>Click "+ Add Schedule" to add staff shifts</div>}
              </div>
            ) : (() => {
              const staffMap = {};
              schedules.forEach(s => {
                const uid = s.user?._id;
                if (!uid) return;
                if (!staffMap[uid]) staffMap[uid] = { user:s.user, days:{} };
                const day = new Date(s.date).toDateString();
                if (!staffMap[uid].days[day]) staffMap[uid].days[day] = [];
                staffMap[uid].days[day].push(s);
              });
              return Object.values(staffMap).map((staff, si) => (
                <div key={si} style={{ display:'grid', gridTemplateColumns:'160px repeat(7,1fr)', borderBottom:'1px solid #f1f5f9' }}>
                  <div style={{ padding:'12px 14px', display:'flex', alignItems:'center', gap:8, background:'#fafbfc' }}>
                    <div style={{ width:30,height:30,borderRadius:'50%',background:`linear-gradient(135deg,#2563eb,#0ea5e9)`,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:700,fontSize:12,flexShrink:0 }}>
                      {staff.user?.name?.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize:12, fontWeight:700, color:'#0f172a' }}>{staff.user?.name?.split(' ')[0]}</div>
                      <div style={{ fontSize:10, color:'#94a3b8', textTransform:'capitalize' }}>{staff.user?.role}</div>
                    </div>
                  </div>
                  {weekDates.map((d,di) => {
                    const day = d.toDateString();
                    const daySchedules = staff.days[day] || [];
                    const isToday = d.toDateString() === new Date().toDateString();
                    return (
                      <div key={di} style={{ padding:5, borderLeft:'1px solid #f1f5f9', background:isToday?'#f8fbff':undefined, minHeight:60 }}>
                        {daySchedules.map((s,ssi) => (
                          <div key={ssi} style={{ padding:'4px 6px', borderRadius:7, marginBottom:3, fontSize:11, fontWeight:600,
                            background: s.shift==='morning'?'#dcfce7':s.shift==='afternoon'?'#fef3c7':s.shift==='night'?'#e0e7ff':'#f0fdf4',
                            color: s.shift==='morning'?'#15803d':s.shift==='afternoon'?'#92400e':s.shift==='night'?'#3730a3':'#15803d',
                            display:'flex', alignItems:'center', gap:3 }}>
                            <span>{s.shift==='morning'?'🌅':s.shift==='afternoon'?'🌇':s.shift==='night'?'🌙':'☀️'}</span>
                            {s.department||s.task||s.shift}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              ));
            })()}
          </div>
        </div>
      )}

      {/* ══ MAINTENANCE MODAL ══ */}
      <AnimatePresence>
        {showMaintModal && maintRoom && (
          <div onClick={e=>{if(e.target===e.currentTarget){setShowMaintModal(false);setMaintRoom(null);}}}
            style={{ position:'fixed',inset:0,background:'rgba(0,0,0,.6)',backdropFilter:'blur(5px)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16 }}>
            <motion.div initial={{ opacity:0,y:22,scale:.96 }} animate={{ opacity:1,y:0,scale:1 }} exit={{ opacity:0,y:22,scale:.96 }}
              style={{ background:'#fff',borderRadius:24,width:'100%',maxWidth:480,boxShadow:'0 40px 100px rgba(0,0,0,.3)',overflow:'hidden' }}>

              {/* Header */}
              <div style={{ background:'linear-gradient(135deg,#78350f,#d97706)',padding:'20px 24px' }}>
                <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between' }}>
                  <div style={{ display:'flex',alignItems:'center',gap:12 }}>
                    <div style={{ width:44,height:44,borderRadius:13,background:'rgba(255,255,255,.2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22 }}>🔧</div>
                    <div>
                      <h3 style={{ color:'#fff',fontWeight:800,fontSize:17,margin:0 }}>Schedule Maintenance</h3>
                      <p style={{ color:'rgba(255,255,255,.75)',fontSize:12.5,margin:'3px 0 0' }}>{maintRoom.name} · Room {maintRoom.number} · Floor {maintRoom.floor}</p>
                    </div>
                  </div>
                  <button onClick={()=>{setShowMaintModal(false);setMaintRoom(null);}}
                    style={{ background:'rgba(255,255,255,.2)',border:'none',borderRadius:'50%',width:30,height:30,cursor:'pointer',color:'#fff',fontSize:14,display:'flex',alignItems:'center',justifyContent:'center' }}>✕</button>
                </div>
              </div>

              <div style={{ padding:'22px 24px' }}>
                {/* Room info */}
                <div style={{ background:'#fffbeb',border:'1px solid #fde68a',borderRadius:12,padding:'12px 14px',marginBottom:18,display:'flex',gap:14 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:11,color:'#92400e',fontWeight:700,textTransform:'uppercase',letterSpacing:.5,marginBottom:4 }}>Room Details</div>
                    {[['Type',maintRoom.type],['Floor',`Floor ${maintRoom.floor}`],['Capacity',`${maintRoom.capacity} bed${maintRoom.capacity!==1?'s':''}`],['Current Status',maintRoom.status]].map(([l,v])=>(
                      <div key={l} style={{ display:'flex',justifyContent:'space-between',fontSize:12.5,padding:'3px 0',borderBottom:'1px solid #fef3c7' }}>
                        <span style={{ color:'#92400e' }}>{l}</span>
                        <span style={{ fontWeight:700,color:'#0f172a',textTransform:'capitalize' }}>{v}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Warning */}
                <div style={{ background:'#fef2f2',border:'1px solid #fecaca',borderRadius:10,padding:'10px 13px',marginBottom:18,display:'flex',gap:8,alignItems:'flex-start' }}>
                  <span style={{ fontSize:16,flexShrink:0 }}>⚠️</span>
                  <div style={{ fontSize:12.5,color:'#dc2626' }}>
                    <strong>All doctors, nurses, ward boys and admin will be notified instantly</strong> when this room is put under maintenance. Patients will NOT receive this notification.
                  </div>
                </div>

                {/* Form fields */}
                <div style={{ display:'flex',flexDirection:'column',gap:13 }}>
                  <div>
                    <label style={{ display:'block',fontSize:11,fontWeight:700,color:'#374151',letterSpacing:.5,textTransform:'uppercase',marginBottom:5 }}>Reason for Maintenance *</label>
                    <select value={maintForm.reason} onChange={e=>setMaintForm(f=>({...f,reason:e.target.value}))}
                      style={{ width:'100%',padding:'10px 12px',border:'1.5px solid #e2e8f0',borderRadius:10,fontFamily:'inherit',fontSize:13.5,outline:'none',background:'#fff',boxSizing:'border-box' }}>
                      <option value="">Select reason…</option>
                      {['Deep Cleaning & Sterilization','Equipment Repair','Electrical Work','Plumbing Work','HVAC / Air Conditioning','Structural Repair','Painting & Renovation','Medical Equipment Calibration','IT / Systems Upgrade','Routine Preventive Maintenance','Emergency Repair','Infection Control Protocol','Other'].map(r=><option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>

                  <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12 }}>
                    <div>
                      <label style={{ display:'block',fontSize:11,fontWeight:700,color:'#374151',letterSpacing:.5,textTransform:'uppercase',marginBottom:5 }}>Estimated Duration (days)</label>
                      <div style={{ display:'flex',gap:5,alignItems:'center' }}>
                        <button type="button" onClick={()=>setMaintForm(f=>({...f,estimatedDays:Math.max(1,f.estimatedDays-1)}))}
                          style={{ width:34,height:40,borderRadius:8,border:'1.5px solid #e2e8f0',background:'#f8fafc',cursor:'pointer',fontSize:16,fontWeight:700,color:'#374151',display:'flex',alignItems:'center',justifyContent:'center' }}>−</button>
                        <input type="number" min={1} value={maintForm.estimatedDays} onChange={e=>setMaintForm(f=>({...f,estimatedDays:Math.max(1,Number(e.target.value))}))}
                          style={{ flex:1,padding:'10px',border:'1.5px solid #e2e8f0',borderRadius:9,fontFamily:'inherit',fontSize:14,fontWeight:700,textAlign:'center',outline:'none',boxSizing:'border-box' }} />
                        <button type="button" onClick={()=>setMaintForm(f=>({...f,estimatedDays:f.estimatedDays+1}))}
                          style={{ width:34,height:40,borderRadius:8,border:'1.5px solid #e2e8f0',background:'#f8fafc',cursor:'pointer',fontSize:16,fontWeight:700,color:'#374151',display:'flex',alignItems:'center',justifyContent:'center' }}>+</button>
                      </div>
                    </div>
                    <div>
                      <label style={{ display:'block',fontSize:11,fontWeight:700,color:'#374151',letterSpacing:.5,textTransform:'uppercase',marginBottom:5 }}>Assigned To</label>
                      <input type="text" value={maintForm.assignedTo} onChange={e=>setMaintForm(f=>({...f,assignedTo:e.target.value}))}
                        placeholder="Technician / staff name…"
                        style={{ width:'100%',padding:'10px 12px',border:'1.5px solid #e2e8f0',borderRadius:10,fontFamily:'inherit',fontSize:13.5,outline:'none',boxSizing:'border-box' }} />
                    </div>
                  </div>

                  <div>
                    <label style={{ display:'block',fontSize:11,fontWeight:700,color:'#374151',letterSpacing:.5,textTransform:'uppercase',marginBottom:5 }}>Additional Notes</label>
                    <textarea value={maintForm.notes} onChange={e=>setMaintForm(f=>({...f,notes:e.target.value}))} rows={2}
                      placeholder="Describe the work to be done, any precautions…"
                      style={{ width:'100%',padding:'10px 12px',border:'1.5px solid #e2e8f0',borderRadius:10,fontFamily:'inherit',fontSize:13.5,outline:'none',resize:'none',boxSizing:'border-box' }} />
                  </div>
                </div>

                <div style={{ display:'flex',gap:10,marginTop:20 }}>
                  <button onClick={()=>{setShowMaintModal(false);setMaintRoom(null);}}
                    style={{ flex:1,padding:'12px',borderRadius:12,border:'1.5px solid #e2e8f0',background:'#fff',fontFamily:'inherit',fontWeight:700,cursor:'pointer',fontSize:14 }}>Cancel</button>
                  <button onClick={handleStartMaintenance} disabled={maintSaving||!maintForm.reason}
                    style={{ flex:2,padding:'12px',borderRadius:12,border:'none',background:maintForm.reason?'linear-gradient(135deg,#d97706,#f59e0b)':'#e2e8f0',color:maintForm.reason?'#fff':'#94a3b8',fontFamily:'inherit',fontWeight:800,cursor:maintForm.reason?'pointer':'not-allowed',fontSize:14,display:'flex',alignItems:'center',justifyContent:'center',gap:8 }}>
                    {maintSaving
                      ? <><div style={{ width:16,height:16,border:'2px solid rgba(255,255,255,.3)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin .7s linear infinite' }} />Processing…</>
                      : '🔧 Put Under Maintenance'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ══ ROOM MODAL ══ */}
      {/* Room Modal */}
      <AnimatePresence>
        {showRoomModal && (
          <div onClick={e=>{if(e.target===e.currentTarget)setShowRoomModal(false)}} style={{ position:'fixed',inset:0,background:'rgba(0,0,0,.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16 }}>
            <motion.div initial={{ opacity:0,y:20,scale:.96 }} animate={{ opacity:1,y:0,scale:1 }} exit={{ opacity:0,y:20,scale:.96 }}
              style={{ background:'#fff',borderRadius:20,padding:'28px',width:'100%',maxWidth:480,boxShadow:'0 24px 60px rgba(0,0,0,.2)' }}>
              <h3 style={{ fontSize:18,fontWeight:800,color:'#0f172a',marginBottom:4 }}>{editRoom?'✏️ Edit Room Details':'🏥 Add New Room'}</h3><p style={{ fontSize:13,color:'#64748b',marginBottom:20 }}>{editRoom?`Editing: ${editRoom.name} · Room ${editRoom.number} · Floor ${editRoom.floor}`:'Fill in all details for the new room'}</p>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                {/* Row 1: Name + Number */}
                {[['Room Name *','name','text'],['Room Number *','number','text']].map(([l,k,t]) => (
                  <div key={k}>
                    <label style={{ display:'block',fontSize:11,fontWeight:700,color:'#374151',marginBottom:5,letterSpacing:.4,textTransform:'uppercase' }}>{l}</label>
                    <input type={t} value={roomForm[k]} onChange={e=>setRoomForm(f=>({...f,[k]:e.target.value}))}
                      style={{ width:'100%',padding:'10px 12px',border:'1.5px solid #e2e8f0',borderRadius:10,fontFamily:'inherit',fontSize:13.5,outline:'none',boxSizing:'border-box',transition:'border-color .2s' }}
                      onFocus={e=>e.target.style.borderColor='#2563eb'} onBlur={e=>e.target.style.borderColor='#e2e8f0'} />
                  </div>
                ))}

                {/* Row 2: Type + Status */}
                <div>
                  <label style={{ display:'block',fontSize:11,fontWeight:700,color:'#374151',marginBottom:5,letterSpacing:.4,textTransform:'uppercase' }}>Room Type *</label>
                  <select value={roomForm.type} onChange={e=>setRoomForm(f=>({...f,type:e.target.value}))}
                    style={{ width:'100%',padding:'10px 12px',border:'1.5px solid #e2e8f0',borderRadius:10,fontFamily:'inherit',fontSize:13.5,outline:'none',background:'#fff',boxSizing:'border-box' }}>
                    {Object.entries(TYPE_CFG).map(([k,v])=><option key={k} value={k}>{v.icon} {k}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display:'block',fontSize:11,fontWeight:700,color:'#374151',marginBottom:5,letterSpacing:.4,textTransform:'uppercase' }}>Status</label>
                  <select value={roomForm.status||'available'} onChange={e=>setRoomForm(f=>({...f,status:e.target.value}))}
                    style={{ width:'100%',padding:'10px 12px',border:'1.5px solid #e2e8f0',borderRadius:10,fontFamily:'inherit',fontSize:13.5,outline:'none',background:'#fff',boxSizing:'border-box' }}>
                    {[['available','🟢 Available'],['occupied','🔴 Occupied'],['maintenance','🟡 Maintenance'],['cleaning','🔵 Cleaning'],['reserved','🟣 Reserved']].map(([v,l])=><option key={v} value={v}>{l}</option>)}
                  </select>
                </div>

                {/* Assign Doctor — conflict-checked on save: if this room is
                    already assigned to a different doctor, the admin is
                    warned before it's reassigned. */}
                <div style={{ gridColumn:'1/-1' }}>
                  <label style={{ display:'block',fontSize:11,fontWeight:700,color:'#374151',marginBottom:5,letterSpacing:.4,textTransform:'uppercase' }}>Assign Doctor</label>
                  <select value={roomForm.assignedDoctor||''} onChange={e=>setRoomForm(f=>({...f,assignedDoctor:e.target.value}))}
                    style={{ width:'100%',padding:'10px 12px',border:'1.5px solid #e2e8f0',borderRadius:10,fontFamily:'inherit',fontSize:13.5,outline:'none',background:'#fff',boxSizing:'border-box' }}>
                    <option value="">— No doctor assigned —</option>
                    {allUsers.filter(u=>u.role==='doctor').map(d=><option key={d._id} value={d._id}>Dr. {d.name}{d.specialization?` (${d.specialization})`:''}</option>)}
                  </select>
                  {editRoom?.assignedDoctor && (
                    <div style={{ fontSize:10.5,color:'#94a3b8',marginTop:4 }}>Currently assigned to: Dr. {editRoom.assignedDoctor.name||editRoom.assignedDoctor}</div>
                  )}
                </div>

                {/* Row 3: Floor + Capacity */}
                <div>
                  <label style={{ display:'block',fontSize:11,fontWeight:700,color:'#374151',marginBottom:5,letterSpacing:.4,textTransform:'uppercase' }}>Floor Number *</label>
                  <div style={{ display:'flex',gap:6,alignItems:'center' }}>
                    <button type="button" onClick={()=>setRoomForm(f=>({...f,floor:Math.max(1,Number(f.floor)-1)}))}
                      style={{ width:36,height:40,borderRadius:9,border:'1.5px solid #e2e8f0',background:'#f8fafc',cursor:'pointer',fontSize:18,fontWeight:700,color:'#374151',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>−</button>
                    <div style={{ flex:1,position:'relative' }}>
                      <input type="number" min={1} max={20} value={roomForm.floor}
                        onChange={e=>setRoomForm(f=>({...f,floor:Math.max(1,Math.min(20,Number(e.target.value)))}))}
                        style={{ width:'100%',padding:'10px 12px',border:'1.5px solid #e2e8f0',borderRadius:10,fontFamily:'inherit',fontSize:14,fontWeight:700,textAlign:'center',outline:'none',boxSizing:'border-box',transition:'border-color .2s' }}
                        onFocus={e=>e.target.style.borderColor='#2563eb'} onBlur={e=>e.target.style.borderColor='#e2e8f0'} />
                    </div>
                    <button type="button" onClick={()=>setRoomForm(f=>({...f,floor:Math.min(20,Number(f.floor)+1)}))}
                      style={{ width:36,height:40,borderRadius:9,border:'1.5px solid #e2e8f0',background:'#f8fafc',cursor:'pointer',fontSize:18,fontWeight:700,color:'#374151',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>+</button>
                  </div>
                  <div style={{ fontSize:10.5,color:'#94a3b8',marginTop:4 }}>Ground = Floor 1 · Max 20 floors</div>
                </div>
                <div>
                  <label style={{ display:'block',fontSize:11,fontWeight:700,color:'#374151',marginBottom:5,letterSpacing:.4,textTransform:'uppercase' }}>Total Beds / Capacity</label>
                  <input type="number" min={1} value={roomForm.capacity} onChange={e=>setRoomForm(f=>({...f,capacity:e.target.value}))}
                    style={{ width:'100%',padding:'10px 12px',border:'1.5px solid #e2e8f0',borderRadius:10,fontFamily:'inherit',fontSize:13.5,outline:'none',boxSizing:'border-box',transition:'border-color .2s' }}
                    onFocus={e=>e.target.style.borderColor='#2563eb'} onBlur={e=>e.target.style.borderColor='#e2e8f0'} />
                </div>

                {/* Row 4: Occupied Beds + Last Cleaned */}
                <div>
                  <label style={{ display:'block',fontSize:11,fontWeight:700,color:'#374151',marginBottom:5,letterSpacing:.4,textTransform:'uppercase' }}>Occupied Beds</label>
                  <input type="number" min={0} max={roomForm.capacity||1} value={roomForm.occupiedBeds||0}
                    onChange={e=>setRoomForm(f=>({...f,occupiedBeds:Math.min(Number(e.target.value),Number(f.capacity||1))}))}
                    style={{ width:'100%',padding:'10px 12px',border:'1.5px solid #e2e8f0',borderRadius:10,fontFamily:'inherit',fontSize:13.5,outline:'none',boxSizing:'border-box',transition:'border-color .2s' }}
                    onFocus={e=>e.target.style.borderColor='#2563eb'} onBlur={e=>e.target.style.borderColor='#e2e8f0'} />
                  <div style={{ fontSize:10.5,color:'#94a3b8',marginTop:4 }}>Max: {roomForm.capacity||1} beds</div>
                </div>
                <div>
                  <label style={{ display:'block',fontSize:11,fontWeight:700,color:'#374151',marginBottom:5,letterSpacing:.4,textTransform:'uppercase' }}>Last Cleaned By</label>
                  <input type="text" value={roomForm.cleanedBy||''} onChange={e=>setRoomForm(f=>({...f,cleanedBy:e.target.value}))}
                    placeholder="Staff name…"
                    style={{ width:'100%',padding:'10px 12px',border:'1.5px solid #e2e8f0',borderRadius:10,fontFamily:'inherit',fontSize:13.5,outline:'none',boxSizing:'border-box',transition:'border-color .2s' }}
                    onFocus={e=>e.target.style.borderColor='#2563eb'} onBlur={e=>e.target.style.borderColor='#e2e8f0'} />
                </div>

                {/* Equipment full-width */}
                <div style={{ gridColumn:'1/-1' }}>
                  <label style={{ display:'block',fontSize:11,fontWeight:700,color:'#374151',marginBottom:5,letterSpacing:.4,textTransform:'uppercase' }}>Equipment (comma-separated)</label>
                  <input type="text" value={roomForm.equipment} onChange={e=>setRoomForm(f=>({...f,equipment:e.target.value}))}
                    placeholder="e.g. Ventilator, ECG Machine, Defibrillator"
                    style={{ width:'100%',padding:'10px 12px',border:'1.5px solid #e2e8f0',borderRadius:10,fontFamily:'inherit',fontSize:13.5,outline:'none',boxSizing:'border-box',transition:'border-color .2s' }}
                    onFocus={e=>e.target.style.borderColor='#2563eb'} onBlur={e=>e.target.style.borderColor='#e2e8f0'} />
                  <div style={{ fontSize:10.5,color:'#94a3b8',marginTop:4 }}>Separate multiple items with commas</div>
                </div>

                {/* Notes full-width */}
                <div style={{ gridColumn:'1/-1' }}>
                  <label style={{ display:'block',fontSize:11,fontWeight:700,color:'#374151',marginBottom:5,letterSpacing:.4,textTransform:'uppercase' }}>Notes / Remarks</label>
                  <textarea value={roomForm.notes} onChange={e=>setRoomForm(f=>({...f,notes:e.target.value}))} rows={2}
                    placeholder="Any special instructions or notes about this room…"
                    style={{ width:'100%',padding:'10px 12px',border:'1.5px solid #e2e8f0',borderRadius:10,fontFamily:'inherit',fontSize:13.5,outline:'none',resize:'none',boxSizing:'border-box',transition:'border-color .2s' }}
                    onFocus={e=>e.target.style.borderColor='#2563eb'} onBlur={e=>e.target.style.borderColor='#e2e8f0'} />
                </div>
              </div>
              <div style={{ display:'flex',gap:10,marginTop:20 }}>
                <button onClick={()=>{setShowRoomModal(false);setEditRoom(null);}} style={{ flex:1,padding:'11px',borderRadius:12,border:'1.5px solid #e2e8f0',background:'#fff',fontFamily:'inherit',fontWeight:700,cursor:'pointer' }}>Cancel</button>
                <button onClick={handleSaveRoom} disabled={saving} style={{ flex:2,padding:'11px',borderRadius:12,border:'none',background:'#2563eb',color:'#fff',fontFamily:'inherit',fontWeight:700,cursor:'pointer' }}>{saving?'Saving…':'💾 Save Room'}</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Room reassignment conflict confirmation */}
      <AnimatePresence>
        {roomAssignConfirm && (
          <div onClick={e=>{if(e.target===e.currentTarget)setRoomAssignConfirm(null)}} style={{ position:'fixed',inset:0,background:'rgba(0,0,0,.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1100,padding:16 }}>
            <motion.div initial={{ opacity:0,y:20,scale:.96 }} animate={{ opacity:1,y:0,scale:1 }} exit={{ opacity:0,y:20,scale:.96 }}
              style={{ background:'#fff',borderRadius:20,padding:'26px',width:'100%',maxWidth:420,boxShadow:'0 24px 60px rgba(0,0,0,.2)' }}>
              <div style={{ fontSize:32,marginBottom:10 }}>⚠️</div>
              <h3 style={{ fontSize:16,fontWeight:800,color:'#0f172a',marginBottom:8 }}>Room already assigned</h3>
              <p style={{ fontSize:13.5,color:'#475569',lineHeight:1.6,marginBottom:20 }}>
                This room is already assigned to <strong>Dr. {roomAssignConfirm.prevDoctorName}</strong>. Do you still want to assign it to <strong>Dr. {roomAssignConfirm.newDoctorName}</strong> instead?
              </p>
              <div style={{ display:'flex',gap:10 }}>
                <button onClick={()=>setRoomAssignConfirm(null)} style={{ flex:1,padding:'11px',borderRadius:12,border:'1.5px solid #e2e8f0',background:'#fff',fontFamily:'inherit',fontWeight:700,cursor:'pointer' }}>Cancel</button>
                <button onClick={()=>{ const d=roomAssignConfirm.data; setRoomAssignConfirm(null); doSaveRoom(d); }} style={{ flex:1,padding:'11px',borderRadius:12,border:'none',background:'#dc2626',color:'#fff',fontFamily:'inherit',fontWeight:700,cursor:'pointer' }}>Yes, Reassign</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Schedule Modal */}
      <AnimatePresence>
        {showScheduleModal && (
          <div onClick={e=>{if(e.target===e.currentTarget)setShowScheduleModal(false)}} style={{ position:'fixed',inset:0,background:'rgba(0,0,0,.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16 }}>
            <motion.div initial={{ opacity:0,y:20,scale:.96 }} animate={{ opacity:1,y:0,scale:1 }} exit={{ opacity:0,y:20,scale:.96 }}
              style={{ background:'#fff',borderRadius:20,padding:'28px',width:'100%',maxWidth:460,boxShadow:'0 24px 60px rgba(0,0,0,.2)' }}>
              <h3 style={{ fontSize:18,fontWeight:800,color:'#0f172a',marginBottom:20 }}>📆 Add Staff Schedule</h3>
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <div><label style={{ display:'block',fontSize:11,fontWeight:700,color:'#374151',marginBottom:5,letterSpacing:.4,textTransform:'uppercase' }}>Staff Member</label>
                <select value={scheduleForm.user} onChange={e=>setScheduleForm(f=>({...f,user:e.target.value}))} style={{ width:'100%',padding:'10px 12px',border:'1.5px solid #e2e8f0',borderRadius:10,fontFamily:'inherit',fontSize:13.5,outline:'none',background:'#fff',boxSizing:'border-box' }}>
                  <option value="">Select staff…</option>
                  {allUsers.filter(u=>u.role!=='patient').map(u=><option key={u._id} value={u._id}>{u.name} ({u.role})</option>)}
                </select></div>
                <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12 }}>
                  <div><label style={{ display:'block',fontSize:11,fontWeight:700,color:'#374151',marginBottom:5,letterSpacing:.4,textTransform:'uppercase' }}>Date</label>
                  <input type="date" value={scheduleForm.date} onChange={e=>setScheduleForm(f=>({...f,date:e.target.value}))} style={{ width:'100%',padding:'10px 12px',border:'1.5px solid #e2e8f0',borderRadius:10,fontFamily:'inherit',fontSize:13.5,outline:'none',boxSizing:'border-box' }} /></div>
                  <div><label style={{ display:'block',fontSize:11,fontWeight:700,color:'#374151',marginBottom:5,letterSpacing:.4,textTransform:'uppercase' }}>Shift</label>
                  <select value={scheduleForm.shift} onChange={e=>setScheduleForm(f=>({...f,shift:e.target.value}))} style={{ width:'100%',padding:'10px 12px',border:'1.5px solid #e2e8f0',borderRadius:10,fontFamily:'inherit',fontSize:13.5,outline:'none',background:'#fff',boxSizing:'border-box' }}>
                    {Object.entries(SHIFTS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
                  </select></div>
                </div>
                {[['Department','department','text','e.g. Cardiology'],['Task','task','text','e.g. ICU monitoring']].map(([l,k,t,p]) => (
                  <div key={k}><label style={{ display:'block',fontSize:11,fontWeight:700,color:'#374151',marginBottom:5,letterSpacing:.4,textTransform:'uppercase' }}>{l}</label>
                  <input type={t} value={scheduleForm[k]} onChange={e=>setScheduleForm(f=>({...f,[k]:e.target.value}))} placeholder={p} style={{ width:'100%',padding:'10px 12px',border:'1.5px solid #e2e8f0',borderRadius:10,fontFamily:'inherit',fontSize:13.5,outline:'none',boxSizing:'border-box' }} /></div>
                ))}
              </div>
              <div style={{ display:'flex',gap:10,marginTop:20 }}>
                <button onClick={()=>setShowScheduleModal(false)} style={{ flex:1,padding:'11px',borderRadius:12,border:'1.5px solid #e2e8f0',background:'#fff',fontFamily:'inherit',fontWeight:700,cursor:'pointer' }}>Cancel</button>
                <button onClick={handleSaveSchedule} disabled={saving} style={{ flex:2,padding:'11px',borderRadius:12,border:'none',background:'#059669',color:'#fff',fontFamily:'inherit',fontWeight:700,cursor:'pointer' }}>{saving?'Saving…':'📆 Add Schedule'}</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}