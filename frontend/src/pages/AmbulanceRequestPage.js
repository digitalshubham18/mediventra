import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ambulanceTripsAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { getSocket } from '../utils/socket';
import toast from 'react-hot-toast';

const STEPS = ['requested', 'dispatched', 'en_route', 'arrived', 'completed'];
const STEP_LABELS = { requested: 'Requested', dispatched: 'Dispatched', en_route: 'En Route', arrived: 'Arrived', completed: 'Completed' };

function ProgressTracker({ status }) {
  if (status === 'cancelled') {
    return <div style={{ color:'#dc2626', fontWeight:700, fontSize:13 }}>❌ This request was cancelled</div>;
  }
  const idx = STEPS.indexOf(status);
  return (
    <div style={{ display:'flex', alignItems:'center', marginTop:10, marginBottom:4 }}>
      {STEPS.map((s, i) => (
        <React.Fragment key={s}>
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', minWidth:56 }}>
            <div style={{ width:26, height:26, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:800, background: i<=idx ? '#dc2626' : '#e2e8f0', color: i<=idx ? '#fff' : '#94a3b8' }}>
              {i < idx ? '✓' : i+1}
            </div>
            <div style={{ fontSize:9.5, color: i<=idx?'#0f172a':'#94a3b8', fontWeight: i===idx?800:500, marginTop:4, textAlign:'center' }}>{STEP_LABELS[s]}</div>
          </div>
          {i < STEPS.length-1 && <div style={{ flex:1, height:2, background: i<idx ? '#dc2626' : '#e2e8f0', marginBottom:16 }} />}
        </React.Fragment>
      ))}
    </div>
  );
}

export default function AmbulanceRequestPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ from:'', to:'Mediventra', purpose:'', contactPhone:'', isEmergency:false });

  const load = () => {
    setLoading(true);
    ambulanceTripsAPI.getMine().then(res => setRequests(res.data.data || [])).catch(()=>{}).finally(()=>setLoading(false));
  };
  useEffect(() => { load(); }, []);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onDispatched = (d) => { toast.success(`🚑 Ambulance dispatched! Driver: ${d.driverName}`, { duration:8000 }); load(); };
    const onStatusUpdate = (d) => {
      const label = { en_route:'is on the way 🚗', arrived:'has arrived 📍', completed:'trip completed ✅', cancelled:'was cancelled' }[d.status] || d.status;
      toast(`Ambulance ${label}`, { duration:6000 });
      load();
    };
    socket.on('ambulance_dispatched', onDispatched);
    socket.on('ambulance_status_update', onStatusUpdate);
    return () => { socket.off('ambulance_dispatched', onDispatched); socket.off('ambulance_status_update', onStatusUpdate); };
  }, []);

  const openForm = () => {
    setForm({ from:'', to:'Mediventra', purpose:'', contactPhone: user?.phone || '', isEmergency:false });
    setShowForm(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.from.trim()) { toast.error('Pickup location is required'); return; }
    setSubmitting(true);
    try {
      await ambulanceTripsAPI.request(form);
      toast.success('🚑 Ambulance requested — hospital staff have been notified!');
      setShowForm(false);
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to submit request'); }
    setSubmitting(false);
  };

  const activeRequest = requests.find(r => !['completed','cancelled'].includes(r.status));

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">🚑 Ambulance</div>
          <div className="page-subtitle">Request pickup and track your ambulance in real time</div>
        </div>
        {!activeRequest && <button className="btn btn-primary" onClick={openForm}>🆘 Request Ambulance</button>}
      </div>

      {activeRequest && (
        <div className="card" style={{ marginBottom:22, border: activeRequest.isEmergency ? '1px solid #fecaca' : '1px solid #e2e8f0' }}>
          <div className="card-body">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div style={{ fontWeight:800, fontSize:14 }}>{activeRequest.isEmergency && '🚨 '}📍 {activeRequest.from} → {activeRequest.to}</div>
              <span style={{ fontSize:11, color:'#94a3b8' }}>{new Date(activeRequest.createdAt).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</span>
            </div>
            <ProgressTracker status={activeRequest.status} />
            {activeRequest.driver && (
              <div style={{ background:'#f0fdf4', borderRadius:9, padding:'9px 12px', marginTop:10, fontSize:12.5, color:'#166534' }}>
                🚑 Driver: <strong>{activeRequest.driver.name}</strong>{activeRequest.driver.phone && ` · ${activeRequest.driver.phone}`}
              </div>
            )}
            {!activeRequest.driver && activeRequest.status === 'requested' && (
              <div style={{ fontSize:12, color:'#92400e', marginTop:6 }}>⏳ Waiting for a driver to be assigned…</div>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign:'center', padding:60, color:'#94a3b8' }}>Loading…</div>
      ) : (
        <div className="card">
          <div className="card-header"><span className="card-title">History</span></div>
          <div className="card-body">
            {requests.length === 0 ? (
              <div style={{ textAlign:'center', padding:20, color:'#94a3b8', fontSize:13 }}>No ambulance requests yet.</div>
            ) : requests.map(r => (
              <div key={r._id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px', background: r.status==='completed'?'#f0fdf4':r.status==='cancelled'?'#f8fafc':'#fffbeb', borderRadius:9, marginBottom:7 }}>
                <div>
                  <div style={{ fontWeight:700, fontSize:12.5 }}>{r.from} → {r.to}</div>
                  <div style={{ fontSize:11, color:'#64748b', marginTop:1 }}>{new Date(r.createdAt).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})} {r.driver?.name && `· Driver: ${r.driver.name}`}</div>
                </div>
                <span style={{ fontSize:11, fontWeight:800, color: r.status==='completed'?'#059669':r.status==='cancelled'?'#64748b':'#d97706' }}>{STEP_LABELS[r.status] || r.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <AnimatePresence>
        {showForm && (
          <div className="modal-overlay" onClick={e=>{ if(e.target===e.currentTarget) setShowForm(false); }}>
            <motion.div className="modal-box" style={{ maxWidth:420 }} initial={{ opacity:0,y:20,scale:.97 }} animate={{ opacity:1,y:0,scale:1 }}>
              <div className="modal-header"><span className="modal-title">🆘 Request Ambulance</span><button className="btn btn-ghost btn-icon" onClick={()=>setShowForm(false)}>✕</button></div>
              <form onSubmit={submit}>
                <div className="modal-body">
                  <button type="button" onClick={()=>setForm(f=>({...f,isEmergency:!f.isEmergency}))}
                    style={{ width:'100%', marginBottom:14, padding:'10px 12px', borderRadius:9, border:`1.5px solid ${form.isEmergency?'#dc2626':'#e2e8f0'}`, background:form.isEmergency?'#fef2f2':'#fff', color:form.isEmergency?'#dc2626':'#64748b', fontWeight:800, fontSize:12.5, cursor:'pointer' }}>
                    {form.isEmergency ? '🚨 Marked as EMERGENCY — tap to unmark' : '🚨 Mark as Emergency'}
                  </button>
                  <div className="form-group"><label className="form-label">Pickup Location *</label><input className="form-input" required value={form.from} onChange={e=>setForm(f=>({...f,from:e.target.value}))} placeholder="Your current address" /></div>
                  <div className="form-group"><label className="form-label">Destination</label><input className="form-input" value={form.to} onChange={e=>setForm(f=>({...f,to:e.target.value}))} /></div>
                  <div className="form-group"><label className="form-label">Contact Phone</label><input className="form-input" value={form.contactPhone} onChange={e=>setForm(f=>({...f,contactPhone:e.target.value}))} /></div>
                  <div className="form-group"><label className="form-label">Reason / Notes</label><textarea className="form-input" rows={2} value={form.purpose} onChange={e=>setForm(f=>({...f,purpose:e.target.value}))} placeholder="Brief description of the situation" /></div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-outline" onClick={()=>setShowForm(false)}>Cancel</button>
                  <button type="submit" className="btn btn-danger" disabled={submitting}>{submitting?'Submitting…':'🆘 Submit Request'}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
