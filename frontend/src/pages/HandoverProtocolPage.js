import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { handoverAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function HandoverProtocolPage() {
  const { user } = useAuth();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ shift:'morning', criticalPatients:'', pendingTasks:'', notes:'' });
  const [saving, setSaving] = useState(false);

  const load = () => { setLoading(true); handoverAPI.getForRole(user?.role).then(res => setNotes(res.data.data || [])).catch(()=>{}).finally(()=>setLoading(false)); };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await handoverAPI.create(form);
      toast.success('Handover note submitted');
      setShowNew(false);
      setForm({ shift:'morning', criticalPatients:'', pendingTasks:'', notes:'' });
      load();
    } catch { toast.error('Failed to submit'); }
    setSaving(false);
  };

  const acknowledge = async (id) => {
    try { await handoverAPI.acknowledge(id); toast.success('Acknowledged'); load(); } catch { toast.error('Failed'); }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">🔄 Handover Protocol</div>
          <div className="page-subtitle">Structured shift handover — critical patients, pending tasks, and notes for whoever's coming on next</div>
        </div>
        <button className="btn btn-primary" onClick={()=>setShowNew(true)}>+ New Handover</button>
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:60, color:'#94a3b8' }}>Loading…</div>
      ) : notes.length === 0 ? (
        <div style={{ textAlign:'center', padding:60, color:'#94a3b8' }}>No handover notes yet for this role.</div>
      ) : (
        <div style={{ display:'grid', gap:14 }}>
          {notes.map(n => (
            <div key={n._id} className="card" style={{ padding:16 }}>
              <div style={{ display:'flex', justifyContent:'space-between' }}>
                <span style={{ fontWeight:700, fontSize:14 }}>{n.fromUser?.name} — {n.shift} shift</span>
                <span style={{ fontSize:11.5, color:'#94a3b8' }}>{new Date(n.createdAt).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</span>
              </div>
              {n.criticalPatients && <div style={{ fontSize:13, marginTop:8 }}><strong>Critical:</strong> {n.criticalPatients}</div>}
              {n.pendingTasks && <div style={{ fontSize:13, marginTop:4 }}><strong>Pending:</strong> {n.pendingTasks}</div>}
              {n.notes && <div style={{ fontSize:12.5, color:'#64748b', marginTop:4 }}>{n.notes}</div>}
              <div style={{ marginTop:10, display:'flex', alignItems:'center', gap:10 }}>
                <button className="btn btn-outline btn-sm" onClick={()=>acknowledge(n._id)}>✓ Acknowledge</button>
                {n.acknowledgedBy?.length > 0 && <span style={{ fontSize:11, color:'#94a3b8' }}>Acknowledged by {n.acknowledgedBy.length}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {showNew && (
          <div className="modal-overlay" onClick={e=>{ if(e.target===e.currentTarget) setShowNew(false); }}>
            <motion.div className="modal-box" style={{ maxWidth:460 }} initial={{ opacity:0,y:20,scale:.97 }} animate={{ opacity:1,y:0,scale:1 }}>
              <div className="modal-header"><span className="modal-title">Shift Handover</span><button className="btn btn-ghost btn-icon" onClick={()=>setShowNew(false)}>✕</button></div>
              <form onSubmit={submit}>
                <div className="modal-body">
                  <div className="form-group"><label className="form-label">Shift</label>
                    <select className="form-input" value={form.shift} onChange={e=>setForm(f=>({...f,shift:e.target.value}))}>
                      <option value="morning">Morning</option><option value="evening">Evening</option><option value="night">Night</option>
                    </select>
                  </div>
                  <div className="form-group"><label className="form-label">Critical Patients</label><textarea className="form-input" rows={2} value={form.criticalPatients} onChange={e=>setForm(f=>({...f,criticalPatients:e.target.value}))} placeholder="Names/rooms needing special attention…" /></div>
                  <div className="form-group"><label className="form-label">Pending Tasks</label><textarea className="form-input" rows={2} value={form.pendingTasks} onChange={e=>setForm(f=>({...f,pendingTasks:e.target.value}))} /></div>
                  <div className="form-group"><label className="form-label">Notes</label><textarea className="form-input" rows={2} value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} /></div>
                </div>
                <div className="modal-footer"><button type="button" className="btn btn-outline" onClick={()=>setShowNew(false)}>Cancel</button><button type="submit" className="btn btn-primary" disabled={saving}>{saving?'Submitting…':'Submit'}</button></div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
