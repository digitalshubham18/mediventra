import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { userActivityAPI } from '../utils/api';

const fmtDuration = (secs) => {
  if (!secs) return '0m';
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

export default function MyActivityPage() {
  const [today, setToday] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      userActivityAPI.myToday(),
      userActivityAPI.mySessions(),
      userActivityAPI.myActivity(),
    ]).then(([t, s, a]) => {
      if (t.status === 'fulfilled') setToday(t.value.data?.data || null);
      if (s.status === 'fulfilled') setSessions(s.value.data?.data || []);
      if (a.status === 'fulfilled') setActivity(a.value.data?.data || []);
    }).finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">🕒 My Activity</div>
          <div className="page-subtitle">Your own login history, time spent on site, and recent activity — visible only to you</div>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:60, color:'#94a3b8' }}>Loading…</div>
      ) : (
        <>
          <div className="stat-grid">
            <motion.div className="stat-card" initial={{ opacity:0,y:14 }} animate={{ opacity:1,y:0 }}>
              <div className="stat-icon" style={{ background:'#eff6ff' }}>⏱️</div>
              <div className="stat-value">{fmtDuration(today?.timeSpentTodaySeconds)}</div>
              <div className="stat-label">Time on site today</div>
            </motion.div>
            <motion.div className="stat-card" initial={{ opacity:0,y:14 }} animate={{ opacity:1,y:0 }} transition={{ delay:.05 }}>
              <div className="stat-icon" style={{ background:'#f0fdf4' }}>🔑</div>
              <div className="stat-value">{today?.sessionsToday ?? 0}</div>
              <div className="stat-label">Logins today</div>
            </motion.div>
            <motion.div className="stat-card" initial={{ opacity:0,y:14 }} animate={{ opacity:1,y:0 }} transition={{ delay:.1 }}>
              <div className="stat-icon" style={{ background:'#fffbeb' }}>🕐</div>
              <div className="stat-value" style={{ fontSize:16 }}>{today?.firstLoginAt ? new Date(today.firstLoginAt).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}) : '—'}</div>
              <div className="stat-label">First login today</div>
            </motion.div>
          </div>

          <div className="grid-2 mt-2">
            <motion.div className="card" initial={{ opacity:0,y:14 }} animate={{ opacity:1,y:0 }} transition={{ delay:.15 }}>
              <div className="card-header"><span className="card-title">🔐 Login History</span></div>
              <div className="card-body" style={{ maxHeight:420, overflowY:'auto' }}>
                {sessions.length === 0 ? (
                  <div style={{ textAlign:'center', padding:24, color:'#94a3b8', fontSize:13 }}>No login history yet</div>
                ) : sessions.map(s => (
                  <div key={s._id} style={{ display:'flex', justifyContent:'space-between', gap:10, padding:'9px 11px', background:'#f8fafc', borderRadius:9, marginBottom:6 }}>
                    <div>
                      <div className="text-sm fw-7">{new Date(s.loginAt).toLocaleString('en-IN', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}</div>
                      <div className="text-xs text-muted">📍 {s.location?.label || 'Unknown location'}{s.ip ? ` · ${s.ip}` : ''}</div>
                    </div>
                    <span className={`badge ${s.active ? 'badge-success' : 'badge-secondary'}`} style={{ fontSize:10, alignSelf:'center', flexShrink:0 }}>
                      {s.active ? 'Active now' : fmtDuration(s.durationSeconds)}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div className="card" initial={{ opacity:0,y:14 }} animate={{ opacity:1,y:0 }} transition={{ delay:.2 }}>
              <div className="card-header"><span className="card-title">📜 Recent Activity</span></div>
              <div className="card-body" style={{ maxHeight:420, overflowY:'auto' }}>
                {activity.length === 0 ? (
                  <div style={{ textAlign:'center', padding:24, color:'#94a3b8', fontSize:13 }}>No activity recorded yet</div>
                ) : activity.map(a => (
                  <div key={a._id} style={{ display:'flex', justifyContent:'space-between', padding:'7px 11px', borderBottom:'1px solid #f1f5f9' }}>
                    <span className="text-sm">{a.label}</span>
                    <span className="text-xs text-muted">{new Date(a.createdAt).toLocaleString('en-IN', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </div>
  );
}
