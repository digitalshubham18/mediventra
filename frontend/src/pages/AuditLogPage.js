import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { auditLogAPI } from '../utils/api';

const ACTION_CFG = {
  record_deleted:            { icon:'🗑️', label:'Record Deleted',        c:'#dc2626' },
  record_created:            { icon:'📄', label:'Record Created',        c:'#059669' },
  record_updated:            { icon:'✏️', label:'Record Updated',        c:'#2563eb' },
  room_assigned:             { icon:'🚪', label:'Room Assigned',         c:'#7c3aed' },
  room_updated:              { icon:'🚪', label:'Room Updated',          c:'#2563eb' },
  room_deleted:               { icon:'🚪', label:'Room Deleted',         c:'#dc2626' },
  user_approved:             { icon:'✅', label:'User Approved',         c:'#059669' },
  user_deleted:               { icon:'🗑️', label:'User Deleted',        c:'#dc2626' },
  user_role_changed:         { icon:'🔄', label:'Role Changed',          c:'#d97706' },
  patient_created_by_staff:  { icon:'🧑‍⚕️', label:'Patient Added by Staff', c:'#0891b2' },
  email_changed:             { icon:'✉️', label:'Email Changed',         c:'#d97706' },
  password_changed:          { icon:'🔒', label:'Password Changed',      c:'#d97706' },
  bug_report_status_changed: { icon:'🐞', label:'Bug Report Updated',    c:'#6366f1' },
};

const timeAgo = (date) => {
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (diff < 10) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  return `${Math.floor(diff/86400)}d ago`;
};

export default function AuditLogPage() {
  const [logs, setLogs]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [actionFilter, setActionFilter] = useState('all');

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    auditLogAPI.getAll(actionFilter !== 'all' ? { action: actionFilter } : {})
      .then(res => setLogs(res.data.data || []))
      .catch(err => {
        setError(err.response?.status === 404
          ? 'This endpoint isn\u2019t available on the server yet — make sure the backend has been redeployed with the latest update.'
          : (err.response?.data?.error || 'Failed to load the audit log. Please try again.'));
      })
      .finally(() => setLoading(false));
  }, [actionFilter]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">📜 Audit Log</div>
          <div className="page-subtitle">Who did what, and when — accountability trail for consequential actions</div>
        </div>
        <button className="btn btn-outline btn-sm" onClick={load}>🔄 Refresh</button>
      </div>

      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:18 }}>
        <button onClick={()=>setActionFilter('all')}
          style={{ padding:'6px 14px', borderRadius:20, border:'1.5px solid', borderColor:actionFilter==='all'?'#2563eb':'#e2e8f0', background:actionFilter==='all'?'#eff6ff':'#fff', color:actionFilter==='all'?'#1d4ed8':'#64748b', fontSize:12.5, fontWeight:700, cursor:'pointer' }}>
          All Actions
        </button>
        {Object.entries(ACTION_CFG).map(([key,cfg]) => (
          <button key={key} onClick={()=>setActionFilter(key)}
            style={{ padding:'6px 14px', borderRadius:20, border:'1.5px solid', borderColor:actionFilter===key?cfg.c:'#e2e8f0', background:actionFilter===key?`${cfg.c}15`:'#fff', color:actionFilter===key?cfg.c:'#64748b', fontSize:12.5, fontWeight:700, cursor:'pointer' }}>
            {cfg.icon} {cfg.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:60, color:'#94a3b8' }}>Loading…</div>
      ) : error ? (
        <div style={{ textAlign:'center', padding:60 }}>
          <div style={{ fontSize:40, marginBottom:10 }}>⚠️</div>
          <div style={{ color:'#dc2626', fontWeight:700, marginBottom:6 }}>Couldn't load the audit log</div>
          <div style={{ color:'#94a3b8', fontSize:13, maxWidth:420, margin:'0 auto' }}>{error}</div>
          <button className="btn btn-outline btn-sm" style={{marginTop:14}} onClick={load}>🔄 Try Again</button>
        </div>
      ) : logs.length === 0 ? (
        <div style={{ textAlign:'center', padding:60, color:'#94a3b8' }}>
          <div style={{ fontSize:40, marginBottom:10 }}>📭</div>
          No actions logged {actionFilter !== 'all' ? 'for this filter' : 'yet'}.
        </div>
      ) : (
        <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e8edf3', overflow:'hidden' }}>
          <AnimatePresence>
            {logs.map((log, i) => {
              const cfg = ACTION_CFG[log.action] || { icon:'📌', label:log.action, c:'#64748b' };
              return (
                <motion.div key={log._id} initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:i*0.01 }}
                  style={{ display:'flex', gap:14, alignItems:'flex-start', padding:'14px 18px', borderBottom: i<logs.length-1 ? '1px solid #f1f5f9' : 'none' }}>
                  <div style={{ width:38, height:38, borderRadius:10, background:`${cfg.c}15`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:17, flexShrink:0 }}>
                    {cfg.icon}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13.5, color:'#0f172a', fontWeight:600, lineHeight:1.5 }}>{log.description}</div>
                    <div style={{ fontSize:11.5, color:'#94a3b8', marginTop:3 }}>
                      by <strong style={{ color:'#475569' }}>{log.actorName}</strong> ({log.actorRole}) · {timeAgo(log.createdAt)}
                    </div>
                  </div>
                  <span style={{ fontSize:10.5, fontWeight:700, color:cfg.c, background:`${cfg.c}15`, padding:'3px 9px', borderRadius:7, whiteSpace:'nowrap' }}>
                    {cfg.label}
                  </span>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
