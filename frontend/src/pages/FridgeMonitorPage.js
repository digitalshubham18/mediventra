import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fridgeAPI } from '../utils/api';
import toast from 'react-hot-toast';

export default function FridgeMonitorPage() {
  const [latest, setLatest] = useState([]);
  const [allLogs, setAllLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ unitName:'', temperature:'' });
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    fridgeAPI.getAll().then(res => { setLatest(res.data.latestByUnit || []); setAllLogs(res.data.data || []); }).catch(()=>{}).finally(()=>setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.unitName.trim() || form.temperature==='') { toast.error('Unit name and temperature are required'); return; }
    setSaving(true);
    try {
      const res = await fridgeAPI.addReading({ ...form, temperature: Number(form.temperature) });
      if (res.data.alert) toast.error(`⚠️ ${form.unitName} is outside the safe range!`);
      else toast.success('Reading logged');
      setShowAdd(false);
      setForm({ unitName:'', temperature:'' });
      load();
    } catch { toast.error('Failed to log reading'); }
    setSaving(false);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">🌡️ Fridge & Cold Chain Monitor</div>
          <div className="page-subtitle">Temperature tracking for blood banks and vaccine storage — manually logged with real alert thresholds (no IoT sensors connected yet)</div>
        </div>
        <button className="btn btn-primary" onClick={()=>setShowAdd(true)}>+ Log Reading</button>
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:60, color:'#94a3b8' }}>Loading…</div>
      ) : latest.length === 0 ? (
        <div style={{ textAlign:'center', padding:60, color:'#94a3b8' }}>No temperature readings logged yet.</div>
      ) : (
        <>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:14, marginBottom:24 }}>
            {latest.map(l => (
              <div key={l.unitName} className="card" style={{ padding:18, background: l.isAlert ? '#fef2f2' : '#fff', border:`1px solid ${l.isAlert?'#fecaca':'#e8edf3'}` }}>
                <div style={{ fontWeight:700, fontSize:14 }}>{l.unitName}</div>
                <div style={{ fontSize:30, fontWeight:800, color: l.isAlert?'#dc2626':'#059669', marginTop:6 }}>{l.temperature}°C</div>
                <div style={{ fontSize:12, color:'#64748b', marginTop:4 }}>Safe range: {l.safeMin}–{l.safeMax}°C</div>
                {l.isAlert && <div style={{ fontSize:12, color:'#dc2626', fontWeight:700, marginTop:6 }}>⚠️ OUT OF RANGE</div>}
              </div>
            ))}
          </div>
          <div className="card">
            <div className="card-header"><span className="card-title">Recent Readings</span></div>
            <div className="card-body">
              {allLogs.slice(0,15).map(l => (
                <div key={l._id} style={{ display:'flex', justifyContent:'space-between', padding:'8px 12px', background:'#f8fafc', borderRadius:8, marginBottom:5 }}>
                  <span className="text-sm">{l.unitName}</span>
                  <span className="text-xs" style={{ color: l.isAlert ? '#dc2626' : '#64748b' }}>{l.temperature}°C · {l.loggedBy?.name} · {new Date(l.createdAt).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <AnimatePresence>
        {showAdd && (
          <div className="modal-overlay" onClick={e=>{ if(e.target===e.currentTarget) setShowAdd(false); }}>
            <motion.div className="modal-box" style={{ maxWidth:380 }} initial={{ opacity:0,y:20,scale:.97 }} animate={{ opacity:1,y:0,scale:1 }}>
              <div className="modal-header"><span className="modal-title">Log Temperature</span><button className="btn btn-ghost btn-icon" onClick={()=>setShowAdd(false)}>✕</button></div>
              <form onSubmit={submit}>
                <div className="modal-body">
                  <div className="form-group"><label className="form-label">Unit *</label><input className="form-input" required value={form.unitName} onChange={e=>setForm(f=>({...f,unitName:e.target.value}))} placeholder="e.g. Vaccine Fridge - Pharmacy" /></div>
                  <div className="form-group"><label className="form-label">Temperature (°C) *</label><input type="number" step="0.1" className="form-input" required value={form.temperature} onChange={e=>setForm(f=>({...f,temperature:e.target.value}))} /></div>
                </div>
                <div className="modal-footer"><button type="button" className="btn btn-outline" onClick={()=>setShowAdd(false)}>Cancel</button><button type="submit" className="btn btn-primary" disabled={saving}>{saving?'Logging…':'Log'}</button></div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
