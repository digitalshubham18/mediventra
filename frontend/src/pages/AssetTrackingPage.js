import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { assetsAPI } from '../utils/api';
import toast from 'react-hot-toast';

const typeIcon = { ventilator:'🫁', crash_cart:'🚨', wheelchair:'♿', infusion_pump:'💉', defibrillator:'⚡', other:'📦' };

export default function AssetTrackingPage() {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name:'', type:'ventilator', currentLocation:'' });
  const [saving, setSaving] = useState(false);

  const load = () => { setLoading(true); assetsAPI.getAll().then(res => setAssets(res.data.data || [])).catch(()=>{}).finally(()=>setLoading(false)); };
  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.currentLocation.trim()) { toast.error('Name and location are required'); return; }
    setSaving(true);
    try { await assetsAPI.create(form); toast.success('Asset added'); setShowAdd(false); setForm({name:'',type:'ventilator',currentLocation:''}); load(); }
    catch (err) { toast.error(err.response?.data?.error || 'Failed to add asset'); }
    setSaving(false);
  };

  const moveAsset = async (id, currentLocation) => {
    const newLoc = window.prompt('New location for this asset:', currentLocation);
    if (!newLoc || newLoc === currentLocation) return;
    try { await assetsAPI.update(id, { currentLocation: newLoc }); toast.success('Location updated'); load(); }
    catch { toast.error('Failed to update'); }
  };

  const remove = async (id, name) => {
    if (!window.confirm(`Remove "${name}" from tracking?`)) return;
    try { await assetsAPI.delete(id); toast.success('Removed'); load(); } catch { toast.error('Failed to remove'); }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">📍 Asset Location Tracker</div>
          <div className="page-subtitle">Live location of mobile equipment — manually updated by staff (no RFID hardware connected; ready to plug in real tags later)</div>
        </div>
        <button className="btn btn-primary" onClick={()=>setShowAdd(true)}>+ Add Asset</button>
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:60, color:'#94a3b8' }}>Loading…</div>
      ) : assets.length === 0 ? (
        <div style={{ textAlign:'center', padding:60, color:'#94a3b8' }}>No tracked assets yet — add mobile equipment like ventilators or crash carts.</div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(230px,1fr))', gap:14 }}>
          {assets.map(a => (
            <div key={a._id} className="card" style={{ padding:16 }}>
              <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:8 }}>
                <span style={{ fontSize:22 }}>{typeIcon[a.type]||'📦'}</span>
                <span style={{ fontWeight:700, fontSize:14.5 }}>{a.name}</span>
              </div>
              <div style={{ fontSize:12.5, color:'#64748b' }}>📍 {a.currentLocation}</div>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:12 }}>
                <span className={`badge ${a.status==='available'?'badge-success':a.status==='in_use'?'badge-primary':'badge-warning'}`}>{a.status.replace('_',' ')}</span>
                <div style={{ display:'flex', gap:6 }}>
                  <button className="btn btn-outline btn-xs" onClick={()=>moveAsset(a._id, a.currentLocation)}>Move</button>
                  <button className="btn btn-danger btn-xs" onClick={()=>remove(a._id, a.name)}>🗑️</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {showAdd && (
          <div className="modal-overlay" onClick={e=>{ if(e.target===e.currentTarget) setShowAdd(false); }}>
            <motion.div className="modal-box" style={{ maxWidth:400 }} initial={{ opacity:0,y:20,scale:.97 }} animate={{ opacity:1,y:0,scale:1 }}>
              <div className="modal-header"><span className="modal-title">Add Tracked Asset</span><button className="btn btn-ghost btn-icon" onClick={()=>setShowAdd(false)}>✕</button></div>
              <form onSubmit={submit}>
                <div className="modal-body">
                  <div className="form-group"><label className="form-label">Name *</label><input className="form-input" required value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Ventilator #3" /></div>
                  <div className="form-group"><label className="form-label">Type</label>
                    <select className="form-input" value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>
                      <option value="ventilator">Ventilator</option><option value="crash_cart">Crash Cart</option><option value="wheelchair">Wheelchair</option>
                      <option value="infusion_pump">Infusion Pump</option><option value="defibrillator">Defibrillator</option><option value="other">Other</option>
                    </select>
                  </div>
                  <div className="form-group"><label className="form-label">Current Location *</label><input className="form-input" required value={form.currentLocation} onChange={e=>setForm(f=>({...f,currentLocation:e.target.value}))} placeholder="e.g. ICU - Room 4" /></div>
                </div>
                <div className="modal-footer"><button type="button" className="btn btn-outline" onClick={()=>setShowAdd(false)}>Cancel</button><button type="submit" className="btn btn-primary" disabled={saving}>{saving?'Adding…':'Add'}</button></div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
