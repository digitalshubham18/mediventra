import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usersAPI } from '../utils/api';
import { getSocket } from '../utils/socket';

const ROLE_COLORS = { admin:'#6366f1',doctor:'#0891b2',patient:'#7c3aed',nurse:'#db2777',pharmacist:'#d97706',wardboy:'#059669',sweeper:'#f59e0b',otboy:'#8b5cf6',finance:'#8b5cf6',electrician:'#f59e0b',plumber:'#0891b2',it_technician:'#6366f1',equipment_tech:'#8b5cf6',biomedical:'#059669',security:'#374151',receptionist:'#db2777',ambulance_driver:'#dc2626',lab_technician:'#0d9488',radiology_tech:'#0e7490',dialysis_tech:'#be123c' };

const initials = (name='') => name.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2) || 'U';

const timeAgo = (date) => {
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (diff < 10) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
  return `${Math.floor(diff/3600)}h ago`;
};

export default function OnlineUsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState('all');

  const load = useCallback(() => {
    usersAPI.getOnline()
      .then(res => setUsers(res.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000); // periodic refresh as a fallback
    const socket = getSocket();
    const onPresence = () => load(); // any presence change → refetch (simple, avoids drift)
    if (socket) socket.on('presence_update', onPresence);
    return () => { clearInterval(interval); if (socket) socket.off('presence_update', onPresence); };
  }, [load]);

  const roles = [...new Set(users.map(u => u.role))].sort();
  const filtered = roleFilter === 'all' ? users : users.filter(u => u.role === roleFilter);

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">🟢 Online Users</div>
          <div className="page-subtitle">Staff and patients currently signed in to Mediventra</div>
        </div>
        <button className="btn btn-outline btn-sm" onClick={load}>🔄 Refresh</button>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ background:'#f0fdf4' }}>🟢</div>
          <div className="stat-value">{users.length}</div>
          <div className="stat-label">Online Now</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background:'#eff6ff' }}>👥</div>
          <div className="stat-value">{roles.length}</div>
          <div className="stat-label">Roles Active</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background:'#fef3c7' }}>📱</div>
          <div className="stat-value">{users.reduce((s,u)=>s+(u.deviceCount||1),0)}</div>
          <div className="stat-label">Active Sessions</div>
        </div>
      </div>

      <div style={{ display:'flex', gap:8, flexWrap:'wrap', margin:'18px 0' }}>
        <button onClick={()=>setRoleFilter('all')} style={{ padding:'6px 14px', borderRadius:20, border:`1.5px solid ${roleFilter==='all'?'#1648c9':'#e2e8f0'}`, background:roleFilter==='all'?'#eff6ff':'#fff', color:roleFilter==='all'?'#1648c9':'#64748b', fontSize:12.5, fontWeight:700, cursor:'pointer' }}>All ({users.length})</button>
        {roles.map(r => (
          <button key={r} onClick={()=>setRoleFilter(r)} style={{ padding:'6px 14px', borderRadius:20, border:`1.5px solid ${roleFilter===r?ROLE_COLORS[r]:'#e2e8f0'}`, background:roleFilter===r?`${ROLE_COLORS[r]}15`:'#fff', color:roleFilter===r?ROLE_COLORS[r]:'#64748b', fontSize:12.5, fontWeight:700, cursor:'pointer', textTransform:'capitalize' }}>
            {r.replace('_',' ')} ({users.filter(u=>u.role===r).length})
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:60, color:'#94a3b8' }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign:'center', padding:60, color:'#94a3b8' }}>
          <div style={{ fontSize:40, marginBottom:12 }}>💤</div>
          <div style={{ fontWeight:700, fontSize:15 }}>No one's online right now</div>
          <div style={{ fontSize:13, marginTop:4 }}>This list updates live as people sign in and out</div>
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:12 }}>
          <AnimatePresence>
            {filtered.map(u => {
              const rc = ROLE_COLORS[u.role] || '#64748b';
              return (
                <motion.div key={u._id} layout initial={{ opacity:0, scale:.95 }} animate={{ opacity:1, scale:1 }} exit={{ opacity:0, scale:.95 }}
                  className="card" style={{ padding:'14px 16px', display:'flex', alignItems:'center', gap:12 }}>
                  <div style={{ position:'relative', flexShrink:0 }}>
                    <div style={{ width:44, height:44, borderRadius:'50%', background:`${rc}20`, border:`2px solid ${rc}50`, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:15, color:rc }}>
                      {initials(u.name)}
                    </div>
                    <span style={{ position:'absolute', bottom:0, right:0, width:12, height:12, borderRadius:'50%', background:'#22c55e', border:'2px solid #fff' }} />
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:700, fontSize:13.5, color:'#0f172a', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{u.name}</div>
                    <div style={{ fontSize:11.5, color:rc, fontWeight:600, textTransform:'capitalize' }}>{u.role?.replace('_',' ')}{u.department ? ` · ${u.department}` : ''}</div>
                    <div style={{ fontSize:10.5, color:'#94a3b8', marginTop:2 }}>Active {timeAgo(u.lastSeen)}{u.deviceCount > 1 ? ` · ${u.deviceCount} sessions` : ''}</div>
                    {(u.loginLocation?.label || u.loginIp) && (
                      <div style={{ fontSize:10.5, color:'#94a3b8', marginTop:2 }} title={u.loginIp}>📍 {u.loginLocation?.label || 'Unknown location'}{u.loginIp ? ` · ${u.loginIp}` : ''}</div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
