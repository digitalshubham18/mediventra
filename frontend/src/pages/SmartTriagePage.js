import React, { useState, useEffect } from 'react';
import { triageAPI } from '../utils/api';

const bandColor = { critical:'#dc2626', urgent:'#d97706', moderate:'#2563eb', normal:'#64748b' };
const bandBg    = { critical:'#fef2f2', urgent:'#fef3c7', moderate:'#eff6ff', normal:'#f8fafc' };

export default function SmartTriagePage() {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => { setLoading(true); triageAPI.getQueue().then(res => setQueue(res.data.data || [])).catch(()=>{}).finally(()=>setLoading(false)); };
  useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t); }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">🚦 Smart Triage Queue</div>
          <div className="page-subtitle">Color-coded priority queue combining active alerts with real appointment wait times — auto-refreshes every minute</div>
        </div>
        <button className="btn btn-outline" onClick={load}>🔄 Refresh</button>
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:60, color:'#94a3b8' }}>Loading…</div>
      ) : queue.length === 0 ? (
        <div style={{ textAlign:'center', padding:60, color:'#94a3b8' }}>
          <div style={{ fontSize:40, marginBottom:10 }}>✅</div>
          No active alerts or waiting patients right now.
        </div>
      ) : (
        <div style={{ display:'grid', gap:10 }}>
          {queue.map(item => (
            <div key={item.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'14px 18px', background:bandBg[item.band], borderRadius:12, borderLeft:`4px solid ${bandColor[item.band]}` }}>
              <div>
                <div style={{ fontWeight:700, fontSize:14.5 }}>{item.patientName}</div>
                <div style={{ fontSize:12.5, color:'#64748b', marginTop:2 }}>{item.reason}</div>
              </div>
              <span style={{ fontSize:11.5, fontWeight:800, color:bandColor[item.band], textTransform:'uppercase', padding:'4px 12px', background:'#fff', borderRadius:14 }}>{item.band}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
