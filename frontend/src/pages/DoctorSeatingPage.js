import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { doctorCabinsAPI, usersAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function DoctorSeatingPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [cabins, setCabins] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // doctor object being assigned, or 'new'
  const [form, setForm] = useState({ doctorId:'', cabinNo:'', floor:1, building:'Main Block', wing:'', notes:'' });
  const [saving, setSaving] = useState(false);
  const [conflictConfirm, setConflictConfirm] = useState(null); // { conflictDoctorName }

  const load = () => {
    setLoading(true);
    Promise.allSettled([
      doctorCabinsAPI.getAll(),
      isAdmin ? usersAPI.getAll({ role:'doctor', status:'approved' }) : Promise.resolve({ value:{ data:{ data: [] } } }),
    ]).then(([cRes, dRes]) => {
      if (cRes.status === 'fulfilled') setCabins(cRes.value.data?.data || []);
      if (dRes.status === 'fulfilled') setDoctors(dRes.value.data?.data || []);
    }).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const openAssign = (doctor, existing) => {
    setModal(doctor);
    setForm({
      doctorId: doctor._id, cabinNo: existing?.cabinNo || '', floor: existing?.floor || 1,
      building: existing?.building || 'Main Block', wing: existing?.wing || '', notes: existing?.notes || '',
    });
  };

  const doSubmit = async () => {
    setSaving(true);
    try {
      await doctorCabinsAPI.upsert(form);
      toast.success('✅ Seating area saved!');
      setModal(null);
      setConflictConfirm(null);
      load();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed to save'); }
    setSaving(false);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.cabinNo.trim()) { toast.error('Cabin number is required'); return; }

    // Conflict check: is this exact cabin number already given to a
    // DIFFERENT doctor? Nothing in the backend stops two doctors from
    // sharing a cabin number, so warn here before it happens silently.
    const conflict = cabins.find(c =>
      c.cabinNo.trim().toLowerCase() === form.cabinNo.trim().toLowerCase() &&
      c.doctor?._id !== form.doctorId
    );
    if (conflict) {
      setConflictConfirm({ conflictDoctorName: conflict.doctor?.name || 'another doctor' });
      return;
    }
    doSubmit();
  };

  const cabinFor = (doctorId) => cabins.find(c => c.doctor?._id === doctorId);

  if (!isAdmin) {
    // Doctor's own view — simple, single card
    const mine = cabins[0];
    return (
      <div>
        <div className="page-header">
          <div><div className="page-title">🪑 My Seating Area</div><div className="page-subtitle">Where patients will find you after booking an appointment</div></div>
        </div>
        {loading ? (
          <div style={{ textAlign:'center', padding:50, color:'#94a3b8' }}>Loading…</div>
        ) : !mine ? (
          <div className="card"><div className="card-body" style={{ textAlign:'center', padding:40, color:'#94a3b8' }}>
            <div style={{ fontSize:36, marginBottom:10 }}>🪑</div>
            No seating area assigned yet. Please contact admin to get your cabin assigned — patients won't see a "where to meet" location until then.
          </div></div>
        ) : (
          <motion.div className="card" initial={{ opacity:0,y:14 }} animate={{ opacity:1,y:0 }}>
            <div className="card-body" style={{ textAlign:'center', padding:30 }}>
              <div style={{ fontSize:42, marginBottom:10 }}>🪑</div>
              <div style={{ fontSize:24, fontWeight:900, color:'#0f172a' }}>{mine.cabinNo}</div>
              <div style={{ fontSize:14, color:'#64748b', marginTop:4 }}>{mine.building} · Floor {mine.floor}{mine.wing ? ` · ${mine.wing}` : ''}</div>
              {mine.notes && <div style={{ marginTop:10, fontSize:13, color:'#94a3b8' }}>{mine.notes}</div>}
            </div>
          </motion.div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">🪑 Doctor Seating Layout</div><div className="page-subtitle">Assign cabins so patients know exactly where to meet their doctor</div></div>
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:50, color:'#94a3b8' }}>Loading…</div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead><tr><th>Doctor</th><th>Department</th><th>Cabin No.</th><th>Location</th><th></th></tr></thead>
              <tbody>
                {doctors.map(d => {
                  const c = cabinFor(d._id);
                  return (
                    <tr key={d._id}>
                      <td><div className="td-main">Dr. {d.name}</div><div className="td-sub">{d.specialization}</div></td>
                      <td className="text-sm">{d.department}</td>
                      <td>{c ? <span className="badge badge-primary">{c.cabinNo}</span> : <span className="text-muted text-sm">Not assigned</span>}</td>
                      <td className="text-sm">{c ? `${c.building} · Floor ${c.floor}${c.wing?` · ${c.wing}`:''}` : '—'}</td>
                      <td><button className="btn btn-outline btn-xs" onClick={() => openAssign(d, c)}>{c ? '✏️ Edit' : '+ Assign'}</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AnimatePresence>
        {modal && (
          <div className="modal-overlay" onClick={e=>{ if(e.target===e.currentTarget) setModal(null); }}>
            <motion.div className="modal-box" style={{ maxWidth:420 }} initial={{ opacity:0,y:20 }} animate={{ opacity:1,y:0 }}>
              <div className="modal-header"><span className="modal-title">🪑 Seating — Dr. {modal.name}</span><button className="btn btn-ghost btn-icon" onClick={()=>setModal(null)}>✕</button></div>
              <form onSubmit={submit}>
                <div className="modal-body">
                  <div className="form-group"><label className="form-label">Cabin Number *</label><input className="form-input" required value={form.cabinNo} onChange={e=>setForm(f=>({...f,cabinNo:e.target.value}))} placeholder="e.g. OPD-12" /></div>
                  <div className="form-group"><label className="form-label">Floor</label><input type="number" className="form-input" value={form.floor} onChange={e=>setForm(f=>({...f,floor:Number(e.target.value)}))} /></div>
                  <div className="form-group"><label className="form-label">Building</label><input className="form-input" value={form.building} onChange={e=>setForm(f=>({...f,building:e.target.value}))} /></div>
                  <div className="form-group"><label className="form-label">Wing (optional)</label><input className="form-input" value={form.wing} onChange={e=>setForm(f=>({...f,wing:e.target.value}))} placeholder="e.g. East Wing" /></div>
                  <div className="form-group"><label className="form-label">Notes (optional)</label><input className="form-input" value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="e.g. Next to Pharmacy" /></div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-outline" onClick={()=>setModal(null)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>{saving?'Saving…':'💾 Save'}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {conflictConfirm && (
          <div className="modal-overlay" onClick={e=>{ if(e.target===e.currentTarget) setConflictConfirm(null); }}>
            <motion.div className="modal-box" style={{ maxWidth:420, padding:26 }} initial={{ opacity:0,y:20,scale:.96 }} animate={{ opacity:1,y:0,scale:1 }}>
              <div style={{ fontSize:32, marginBottom:10 }}>⚠️</div>
              <h3 style={{ fontSize:16, fontWeight:800, color:'#0f172a', marginBottom:8 }}>Cabin already in use</h3>
              <p style={{ fontSize:13.5, color:'#475569', lineHeight:1.6, marginBottom:20 }}>
                Cabin <strong>{form.cabinNo}</strong> is already assigned to <strong>Dr. {conflictConfirm.conflictDoctorName}</strong>. Do you still want to assign it to <strong>Dr. {modal?.name}</strong> as well?
              </p>
              <div style={{ display:'flex', gap:10 }}>
                <button onClick={()=>setConflictConfirm(null)} style={{ flex:1, padding:'11px', borderRadius:12, border:'1.5px solid #e2e8f0', background:'#fff', fontFamily:'inherit', fontWeight:700, cursor:'pointer' }}>Cancel</button>
                <button onClick={doSubmit} disabled={saving} style={{ flex:1, padding:'11px', borderRadius:12, border:'none', background:'#dc2626', color:'#fff', fontFamily:'inherit', fontWeight:700, cursor:'pointer' }}>{saving?'Saving…':'Yes, Assign Anyway'}</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
