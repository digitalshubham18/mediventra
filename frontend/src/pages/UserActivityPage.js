import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { userActivityAPI } from '../utils/api';

const fmtDuration = (secs) => {
  if (!secs) return '0m';
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};
const initials = (name='') => name.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2) || 'U';

export default function UserActivityPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [activity, setActivity] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(() => {
    userActivityAPI.overview()
      .then(res => setRows(res.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [load]);

  const openDetail = async (u) => {
    setSelected(u);
    setDetailLoading(true);
    try {
      const [sRes, aRes] = await Promise.all([
        userActivityAPI.sessions(u._id),
        userActivityAPI.activity(u._id),
      ]);
      setSessions(sRes.data.data || []);
      setActivity(aRes.data.data || []);
    } catch { /* ignore */ }
    setDetailLoading(false);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">🕒 User Activity</div>
          <div className="page-subtitle">Login/logout history, time spent on site, login location, and what each user has been doing</div>
        </div>
        <button className="btn btn-outline btn-sm" onClick={load}>🔄 Refresh</button>
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:60, color:'#94a3b8' }}>Loading…</div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead><tr><th>User</th><th>Status</th><th>Time on site today</th><th>Last login (location)</th><th>Last activity</th><th></th></tr></thead>
              <tbody>
                {rows.map(u => (
                  <tr key={u._id} style={{ cursor:'pointer' }} onClick={() => openDetail(u)}>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:9 }}>
                        <div style={{ width:32, height:32, borderRadius:'50%', background:'#eff6ff', color:'#1648c9', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:12 }}>{initials(u.name)}</div>
                        <div>
                          <div className="td-main">{u.name}</div>
                          <div className="td-sub" style={{ textTransform:'capitalize' }}>{u.role?.replace('_',' ')}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${u.isOnline ? 'badge-success' : 'badge-secondary'}`}>{u.isOnline ? '🟢 Online' : '⚪ Offline'}</span>
                    </td>
                    <td className="text-sm fw-7">{fmtDuration(u.timeSpentTodaySeconds)}</td>
                    <td className="text-sm">
                      {u.lastLogin ? (
                        <>
                          <div>📍 {u.lastLogin.location?.label || 'Unknown'}</div>
                          <div className="text-xs text-muted">{u.lastLogin.ip} · {new Date(u.lastLogin.at).toLocaleString('en-IN', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}</div>
                        </>
                      ) : <span className="text-muted">—</span>}
                    </td>
                    <td className="text-sm text-muted">{u.lastActivity ? `${u.lastActivity.label}` : '—'}</td>
                    <td><button className="btn btn-outline btn-xs" onClick={(e) => { e.stopPropagation(); openDetail(u); }}>Details →</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selected && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setSelected(null); }}>
          <motion.div className="modal-box" initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} style={{ maxWidth:560 }}>
            <div className="modal-header"><span className="modal-title">🕒 {selected.name}'s Activity</span><button className="btn btn-ghost btn-icon" onClick={() => setSelected(null)}>✕</button></div>
            <div className="modal-body" style={{ maxHeight:480, overflowY:'auto' }}>
              {detailLoading ? <div style={{ textAlign:'center', padding:30, color:'#94a3b8' }}>Loading…</div> : (
                <>
                  <h4 style={{ fontSize:12.5, fontWeight:800, color:'#0f172a', margin:'0 0 10px' }}>Login Sessions</h4>
                  {sessions.length === 0 ? <div className="text-sm text-muted" style={{ marginBottom:18 }}>No sessions recorded yet</div> : sessions.slice(0, 15).map(s => (
                    <div key={s._id} style={{ display:'flex', justifyContent:'space-between', gap:10, padding:'8px 10px', background:'#f8fafc', borderRadius:9, marginBottom:6 }}>
                      <div>
                        <div className="text-sm fw-7">🟢 In: {new Date(s.loginAt).toLocaleString('en-IN', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}</div>
                        <div className="text-sm" style={{ marginTop:2 }}>{s.active ? <span style={{ color:'#15803d', fontWeight:700 }}>🟡 Still signed in</span> : <>🔴 Out: {new Date(s.logoutAt).toLocaleString('en-IN', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}</>}</div>
                        <div className="text-xs text-muted" style={{ marginTop:2 }}>📍 {s.location?.label || 'Unknown'} · {s.ip}</div>
                      </div>
                      <div style={{ textAlign:'right' }}>
                        <span className={`badge ${s.active ? 'badge-success' : 'badge-secondary'}`} style={{ fontSize:10 }}>{s.active ? 'Active' : fmtDuration(s.durationSeconds)}</span>
                      </div>
                    </div>
                  ))}

                  <h4 style={{ fontSize:12.5, fontWeight:800, color:'#0f172a', margin:'18px 0 10px' }}>Recent Activity</h4>
                  {activity.length === 0 ? <div className="text-sm text-muted">No activity recorded yet</div> : activity.slice(0, 25).map(a => (
                    <div key={a._id} style={{ display:'flex', justifyContent:'space-between', padding:'7px 10px', borderBottom:'1px solid #f1f5f9' }}>
                      <span className="text-sm">{a.label}</span>
                      <span className="text-xs text-muted">{new Date(a.createdAt).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' })}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
