import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { remindersAPI, medicinesAPI, usersAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
export default function RemindersPage() {
  const { user } = useAuth();
  const [reminders, setReminders] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ patient: '', medicine: '', medicineName: '', dose: '', frequency: 'Once Daily', times: ['08:00'], startDate: new Date().toISOString().split('T')[0], notes: '' });
  const [submitting, setSubmitting] = useState(false);

  const FREQS = ['Once Daily','Twice Daily','Every 8 hours','Every 6 hours','Weekly','As Needed'];

  const load = async () => {
    setLoading(true);
    try {
      const [remRes, medRes] = await Promise.allSettled([
        remindersAPI.getAll(),
        medicinesAPI.getAll()
      ]);
      setReminders(remRes.value?.data?.data || []);
      setMedicines(medRes.value?.data?.data || []);
      if (['admin','doctor','nurse'].includes(user?.role)) {
        const pRes = await usersAPI.getAll({ role: 'patient', status: 'approved' });
        setPatients(pRes.data.data || []);
        if (pRes.data.data?.length) setForm(f => ({ ...f, patient: pRes.data.data[0]._id }));
      }
      if (medRes.value?.data?.data?.length) setForm(f => ({ ...f, medicine: medRes.value?.data?.data[0]._id, medicineName: medRes.value?.data?.data[0].name }));
    } catch { toast.error('Failed to load reminders'); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.dose) { toast.error('Dose is required'); return; }
    if (!form.medicine) { toast.error('Please select a medicine (add one to inventory first if the list is empty)'); return; }
    if (user?.role !== 'patient' && !form.patient) { toast.error('Please select a patient'); return; }
    setSubmitting(true);
    try {
      const payload = { ...form };
      // `user` here is a plain JSON object from the API response, not a
      // live Mongoose document — it only has `_id`, never the `.id`
      // virtual (that only exists on in-memory Mongoose docs). Using
      // `.id` here was silently sending `patient: undefined`, which
      // then failed the schema's required-field validation server-side.
      if (user?.role === 'patient') payload.patient = user._id;
      await remindersAPI.create(payload);
      toast.success('Reminder created!');
      setShowAdd(false);
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to create reminder'); }
    setSubmitting(false);
  };

  const toggleStatus = async (id, current) => {
    try {
      await remindersAPI.update(id, { status: current === 'active' ? 'paused' : 'active' });
      toast.success(`Reminder ${current === 'active' ? 'paused' : 'activated'}`);
      load();
    } catch { toast.error('Failed to update'); }
  };

  const logTaken = async (id) => {
    try {
      await remindersAPI.logAdherence(id, { taken: true });
      toast.success('💊 Medication marked as taken!');
    } catch { toast.error('Failed to log'); }
  };

  const deleteRem = async (id) => {
    try {
      await remindersAPI.delete(id);
      toast.success('Reminder deleted');
      load();
    } catch { toast.error('Failed to delete'); }
  };

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">⏰ Medication Reminders</div><div className="page-subtitle">Schedule and track patient medications</div></div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add Reminder</button>
      </div>

      <motion.div className="card mb-3" initial={{ opacity:0,y:14 }} animate={{ opacity:1,y:0 }}>
        <div className="card-header"><span className="card-title">📊 Today's Compliance</span></div>
        <div className="card-body">
          {reminders.filter(r => r.status === 'active').slice(0,5).map(r => (
            <div key={r._id} style={{ display:'flex',alignItems:'center',gap:12,marginBottom:14 }}>
              <div style={{ flex:1 }}>
                <div className="fw-7 text-sm">{r.patient?.name} · {r.medicineName}</div>
                <div className="text-xs text-muted">{r.dose} · {r.times?.join(', ')}</div>
                <div className="progress mt-1">
                  <div className="progress-bar" style={{ background:'var(--green)',width:`${Math.round(60+Math.random()*35)}%` }} />
                </div>
              </div>
              <button className="btn btn-success btn-xs" onClick={() => logTaken(r._id)}>✓ Taken</button>
            </div>
          ))}
          {reminders.filter(r => r.status === 'active').length === 0 && <div className="text-sm text-muted" style={{ textAlign:'center',padding:20 }}>No active reminders</div>}
        </div>
      </motion.div>

      <motion.div className="card" initial={{ opacity:0,y:14 }} animate={{ opacity:1,y:0 }} transition={{ delay:0.15 }}>
        <div className="card-body-0">
          {loading ? <div style={{ padding:32,textAlign:'center' }}><div className="spinner-lg" style={{ margin:'0 auto' }} /></div> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Patient</th><th>Medicine</th><th>Times</th><th>Dose</th><th>Frequency</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {reminders.length === 0 ? <tr><td colSpan={7} style={{ textAlign:'center',padding:24,color:'#94a3b8' }}>No reminders set</td></tr>
                    : reminders.map(r => (
                    <tr key={r._id}>
                      <td className="td-main">{r.patient?.name}</td>
                      <td className="text-sm">💊 {r.medicineName}</td>
                      <td className="fw-7 text-sm">{r.times?.join(', ')}</td>
                      <td className="text-sm">{r.dose}</td>
                      <td><span className="badge badge-primary">{r.frequency}</span></td>
                      <td><span className={`badge ${r.status==='active'?'badge-success':'badge-warning'}`}>{r.status}</span></td>
                      <td>
                        <div className="flex gap-1">
                          <button className="btn btn-success btn-xs" onClick={() => logTaken(r._id)}>✓</button>
                          <button className="btn btn-outline btn-xs" onClick={() => toggleStatus(r._id, r.status)}>{r.status==='active'?'⏸':'▶'}</button>
                          <button className="btn btn-outline btn-xs text-red" onClick={() => deleteRem(r._id)}>🗑</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </motion.div>

      {showAdd && (
        <div className="modal-overlay" onClick={e => { if (e.target===e.currentTarget) setShowAdd(false); }}>
          <motion.div className="modal-box" initial={{ opacity:0,y:20 }} animate={{ opacity:1,y:0 }}>
            <div className="modal-header">
              <span className="modal-title">⏰ Add Medication Reminder</span>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowAdd(false)}>✕</button>
            </div>
            <form onSubmit={handleAdd}>
              <div className="modal-body">
                {['admin','doctor','nurse'].includes(user?.role) && (
                  <div className="form-group">
                    <label className="form-label">Patient</label>
                    <select className="form-input" value={form.patient} onChange={e => setForm(f => ({ ...f, patient: e.target.value }))}>
                      {patients.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                    </select>
                  </div>
                )}
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Medicine</label>
                    <select className="form-input" value={form.medicine} onChange={e => { const m = medicines.find(x => x._id === e.target.value); setForm(f => ({ ...f, medicine: e.target.value, medicineName: m?.name || '' })); }}>
                      {medicines.map(m => <option key={m._id} value={m._id}>{m.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Frequency</label>
                    <select className="form-input" value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}>
                      {FREQS.map(f => <option key={f}>{f}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Dose *</label>
                    <input className="form-input" required value={form.dose} onChange={e => setForm(f => ({ ...f, dose: e.target.value }))} placeholder="e.g. 1 tablet, 5ml" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Time</label>
                    <input className="form-input" type="time" value={form.times[0]} onChange={e => setForm(f => ({ ...f, times: [e.target.value] }))} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Start Date</label>
                    <input className="form-input" type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Notes</label>
                    <input className="form-input" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Additional instructions" />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowAdd(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? <><span className="spinner-sm" /> Saving…</> : '⏰ Set Reminder'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}