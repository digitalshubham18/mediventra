import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { usersAPI, recordsAPI, appointmentsAPI, medicationAPI, transferAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function PatientsPage() {
  const { user } = useAuth();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [viewPatient, setViewPatient] = useState(null);
  const [patientRecords, setPatientRecords] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name:'',email:'',password:'password123',role:'patient',phone:'',age:'',bloodGroup:'A+',weight:'',height:'' });
  const [adding, setAdding] = useState(false);
  const [vitalsForm, setVitalsForm] = useState({ bloodPressure:'', pulse:'', temperature:'', spo2:'' });
  const [savingVitals, setSavingVitals] = useState(false);
  const canEditVitals = ['doctor','nurse','admin'].includes(user?.role);

  useEffect(() => {
    if (viewPatient) {
      setVitalsForm({
        bloodPressure: viewPatient.currentVitals?.bloodPressure || '',
        pulse: viewPatient.currentVitals?.pulse ?? '',
        temperature: viewPatient.currentVitals?.temperature ?? '',
        spo2: viewPatient.currentVitals?.spo2 ?? '',
      });
    }
  }, [viewPatient]);

  const saveVitals = async () => {
    setSavingVitals(true);
    try {
      const res = await usersAPI.updateVitals(viewPatient._id, vitalsForm);
      setViewPatient(res.data.data);
      setPatients(ps => ps.map(p => p._id === res.data.data._id ? res.data.data : p));
      toast.success('✅ Vitals recorded');
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to save vitals'); }
    setSavingVitals(false);
  };

  // ── Medication schedules (MAR) ──────────────────────────────────────
  const canManageMeds = ['doctor','nurse','admin'].includes(user?.role);
  const [medSchedules, setMedSchedules] = useState([]);
  const [medLoading, setMedLoading] = useState(false);
  const [showMedForm, setShowMedForm] = useState(false);
  const [medForm, setMedForm] = useState({ medicineName:'', dosage:'', route:'oral', frequency:'twice_daily', endDate:'', notes:'', assignedNurse:'' });
  const [onDutyNurses, setOnDutyNurses] = useState([]);
  const [loadingNurses, setLoadingNurses] = useState(false);

  const openMedForm = () => {
    const opening = !showMedForm;
    setShowMedForm(opening);
    if (opening && onDutyNurses.length === 0) {
      setLoadingNurses(true);
      usersAPI.getOnDuty('nurse').then(r => setOnDutyNurses(r.data.data || [])).catch(()=>{}).finally(()=>setLoadingNurses(false));
    }
  };
  const [savingMed, setSavingMed] = useState(false);

  const loadMeds = (patientId) => {
    setMedLoading(true);
    medicationAPI.getPatientSchedules(patientId).then(r => setMedSchedules(r.data.data || [])).catch(()=>{}).finally(()=>setMedLoading(false));
  };

  useEffect(() => {
    if (viewPatient && canManageMeds) loadMeds(viewPatient._id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewPatient]);

  const addMedSchedule = async () => {
    if (!medForm.medicineName.trim() || !medForm.dosage.trim()) { toast.error('Medicine name and dosage are required'); return; }
    setSavingMed(true);
    try {
      await medicationAPI.createSchedule({ patientId: viewPatient._id, ...medForm });
      toast.success(medForm.assignedNurse ? '💊 Medication started — nurse notified' : '💊 Medication schedule started');
      setShowMedForm(false);
      setMedForm({ medicineName:'', dosage:'', route:'oral', frequency:'twice_daily', endDate:'', notes:'', assignedNurse:'' });
      loadMeds(viewPatient._id);
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to add schedule'); }
    setSavingMed(false);
  };

  const discontinueMed = async (id) => {
    if (!window.confirm('Stop this medication?')) return;
    try { await medicationAPI.discontinueSchedule(id); toast.success('Medication discontinued'); loadMeds(viewPatient._id); }
    catch { toast.error('Failed to discontinue'); }
  };

  // ── Ward/bed transfer request ────────────────────────────────────────
  const canRequestTransfer = ['doctor','nurse','receptionist','admin'].includes(user?.role);
  const [showTransferForm, setShowTransferForm] = useState(false);
  const [transferForm, setTransferForm] = useState({ fromLocation:'', toLocation:'', reason:'', priority:'routine' });
  const [savingTransfer, setSavingTransfer] = useState(false);

  const submitTransfer = async () => {
    if (!transferForm.fromLocation.trim() || !transferForm.toLocation.trim()) { toast.error('From and To locations are required'); return; }
    setSavingTransfer(true);
    try {
      await transferAPI.create({ patientId: viewPatient._id, patientName: viewPatient.name, ...transferForm });
      toast.success('🛏️ Transfer request submitted — a wardboy will be notified');
      setShowTransferForm(false);
      setTransferForm({ fromLocation:'', toLocation:'', reason:'', priority:'routine' });
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to request transfer'); }
    setSavingTransfer(false);
  };

  const load = async () => {
    setLoading(true);
    try {
      if (user?.role === 'doctor') {
        // Doctors see patients with any active appointments
        const apptRes = await appointmentsAPI.getAll({ doctorId: user._id });
        const appts = apptRes.data.data || [];
        const uniquePatients = [];
        const seen = new Set();
        for (const a of appts) {
          if (a.patient && !seen.has(a.patient._id)) {
            seen.add(a.patient._id);
            uniquePatients.push({ ...a.patient, lastAppointment: a.date, appointmentType: a.type });
          }
        }
        setPatients(uniquePatients.filter(p => !search || p.name?.toLowerCase().includes(search.toLowerCase())));
      } else {
        const res = await usersAPI.getAll({ role:'patient', status:'approved', ...(search?{ search }:{}) });
        setPatients(res.data.data || []);
      }
    } catch { toast.error('Failed to load patients'); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [search, user?._id]);

  const viewDetails = async (p) => {
    setViewPatient(p);
    try {
      const res = await recordsAPI.getAll({ patientId: p._id });
      setPatientRecords(res.data.data || []);
    } catch { setPatientRecords([]); }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    setAdding(true);
    try {
      const res = await usersAPI.createPatient(form);
      toast.success(res.data.tempPassword ? `Patient added! Temp password: ${res.data.tempPassword}` : 'Patient added!');
      setShowAdd(false);
      setForm({ name:'',email:'',password:'',role:'patient',phone:'',age:'',bloodGroup:'A+',weight:'',height:'' });
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to add patient'); }
    setAdding(false);
  };

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">Patient Management</div><div className="page-subtitle">{patients.length} patients registered</div></div>
        {['admin','doctor'].includes(user?.role) && <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add Patient</button>}
      </div>
      <div className="search-wrap mb-3">
        <span className="search-icon">🔍</span>
        <input className="form-input" style={{ paddingLeft:34 }} placeholder="Search by name, email…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <motion.div className="card" initial={{ opacity:0,y:14 }} animate={{ opacity:1,y:0 }}>
        <div className="card-body-0">
          {loading ? <div style={{ padding:32,textAlign:'center' }}><div className="spinner-lg" style={{ margin:'0 auto' }} /></div> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Patient</th><th>Age / Blood</th><th>Phone</th><th>Joined</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {patients.length === 0 ? <tr><td colSpan={6} style={{ textAlign:'center',padding:24,color:'#94a3b8' }}>No patients found</td></tr>
                    : patients.map(p => (
                    <tr key={p._id}>
                      <td><div style={{ display:'flex',alignItems:'center',gap:10 }}>
                        <div style={{ width:32,height:32,borderRadius:'50%',background:'linear-gradient(135deg,#1648c9,#0891b2)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:700,fontSize:11,flexShrink:0 }}>{p.name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()}</div>
                        <div><div className="td-main">{p.name}</div><div className="td-sub">{p.email}</div></div>
                      </div></td>
                      <td className="text-sm">{p.age||'—'} yr · {p.bloodGroup||'—'}</td>
                      <td className="text-sm">{p.phone||'—'}</td>
                      <td className="text-sm">{new Date(p.createdAt).toLocaleDateString()}</td>
                      <td><span className={`badge ${p.status==='approved'?'badge-success':'badge-warning'}`}>{p.status}</span></td>
                      <td><div className="flex gap-1"><button className="btn btn-primary btn-xs" onClick={() => viewDetails(p)}>View</button></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </motion.div>

      {viewPatient && (
        <div className="modal-overlay" onClick={e => { if(e.target===e.currentTarget)setViewPatient(null); }}>
          <motion.div className="modal-box" initial={{ opacity:0,y:20 }} animate={{ opacity:1,y:0 }}>
            <div className="modal-header"><span className="modal-title">Patient: {viewPatient.name}</span><button className="btn btn-ghost btn-icon" onClick={()=>setViewPatient(null)}>✕</button></div>
            <div className="modal-body">
              <div style={{ display:'flex',gap:12,padding:12,background:'#f8fafc',borderRadius:10,marginBottom:16 }}>
                <div style={{ width:48,height:48,borderRadius:'50%',background:'linear-gradient(135deg,#1648c9,#0891b2)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:800,fontSize:16 }}>{viewPatient.name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()}</div>
                <div><div className="fw-7" style={{ fontSize:15 }}>{viewPatient.name}</div><div className="text-xs text-muted">{viewPatient.email} · {viewPatient.phone}</div><div className="text-xs text-muted">Blood: {viewPatient.bloodGroup||'—'} · Age: {viewPatient.age||'—'} · Weight: {viewPatient.weight||'—'}kg</div></div>
              </div>

              <div className="fw-7 text-sm mb-2">🩺 Current Vitals {viewPatient.currentVitals?.recordedAt && <span className="text-xs text-muted" style={{fontWeight:400}}>· last recorded {new Date(viewPatient.currentVitals.recordedAt).toLocaleDateString('en-IN',{day:'numeric',month:'short'})} by {viewPatient.currentVitals.recordedByName}</span>}</div>
              {canEditVitals ? (
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16, background:'#f8fafc', padding:12, borderRadius:10 }}>
                  <div className="form-group" style={{marginBottom:0}}><label className="form-label">Blood Pressure</label><input className="form-input" placeholder="120/80" value={vitalsForm.bloodPressure} onChange={e=>setVitalsForm(v=>({...v,bloodPressure:e.target.value}))} /></div>
                  <div className="form-group" style={{marginBottom:0}}><label className="form-label">Pulse (bpm)</label><input type="number" className="form-input" value={vitalsForm.pulse} onChange={e=>setVitalsForm(v=>({...v,pulse:e.target.value}))} /></div>
                  <div className="form-group" style={{marginBottom:0}}><label className="form-label">Temperature (°F)</label><input type="number" step="0.1" className="form-input" value={vitalsForm.temperature} onChange={e=>setVitalsForm(v=>({...v,temperature:e.target.value}))} /></div>
                  <div className="form-group" style={{marginBottom:0}}><label className="form-label">SpO2 (%)</label><input type="number" className="form-input" value={vitalsForm.spo2} onChange={e=>setVitalsForm(v=>({...v,spo2:e.target.value}))} /></div>
                  <div style={{ gridColumn:'1 / -1' }}><button type="button" className="btn btn-primary btn-sm" disabled={savingVitals} onClick={saveVitals}>{savingVitals?'Saving…':'💾 Save Vitals'}</button></div>
                </div>
              ) : (
                <div className="text-sm text-muted" style={{ marginBottom:16 }}>
                  BP: {viewPatient.currentVitals?.bloodPressure || '—'} · Pulse: {viewPatient.currentVitals?.pulse ?? '—'} · Temp: {viewPatient.currentVitals?.temperature ?? '—'}°F · SpO2: {viewPatient.currentVitals?.spo2 ?? '—'}%
                </div>
              )}

              <div className="fw-7 text-sm mb-2" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span>💊 Medications</span>
                {canManageMeds && <button type="button" className="btn btn-outline btn-xs" onClick={openMedForm}>{showMedForm?'Cancel':'+ Add'}</button>}
              </div>
              {showMedForm && (
                <div style={{ background:'#f8fafc', padding:12, borderRadius:10, marginBottom:12, display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                  <div className="form-group" style={{marginBottom:0}}><label className="form-label">Medicine Name *</label><input className="form-input" value={medForm.medicineName} onChange={e=>setMedForm(f=>({...f,medicineName:e.target.value}))} /></div>
                  <div className="form-group" style={{marginBottom:0}}><label className="form-label">Dosage *</label><input className="form-input" placeholder="500mg" value={medForm.dosage} onChange={e=>setMedForm(f=>({...f,dosage:e.target.value}))} /></div>
                  <div className="form-group" style={{marginBottom:0}}><label className="form-label">Route</label>
                    <select className="form-input" value={medForm.route} onChange={e=>setMedForm(f=>({...f,route:e.target.value}))}>
                      {['oral','iv','im','subcutaneous','topical','inhaled','other'].map(r=><option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{marginBottom:0}}><label className="form-label">Frequency</label>
                    <select className="form-input" value={medForm.frequency} onChange={e=>setMedForm(f=>({...f,frequency:e.target.value}))}>
                      <option value="once_daily">Once daily</option><option value="twice_daily">Twice daily</option>
                      <option value="three_times_daily">3x daily</option><option value="four_times_daily">4x daily</option>
                      <option value="every_6_hours">Every 6 hours</option><option value="every_8_hours">Every 8 hours</option>
                      <option value="every_12_hours">Every 12 hours</option><option value="as_needed">As needed (PRN)</option>
                    </select>
                  </div>
                  <div className="form-group" style={{marginBottom:0}}><label className="form-label">End Date (optional)</label><input type="date" className="form-input" value={medForm.endDate} onChange={e=>setMedForm(f=>({...f,endDate:e.target.value}))} /></div>
                  <div className="form-group" style={{marginBottom:0, gridColumn:'1 / -1'}}>
                    <label className="form-label">Assign to Nurse (on duty now)</label>
                    <select className="form-input" value={medForm.assignedNurse} onChange={e=>setMedForm(f=>({...f,assignedNurse:e.target.value}))}>
                      <option value="">— Leave unassigned (any on-duty nurse can administer) —</option>
                      {onDutyNurses.map(n => <option key={n._id} value={n._id}>{n.name}{n.notCurrentlyInShift ? ` (scheduled ${n.shift})` : ` — on shift now (${n.startTime}–${n.endTime})`}</option>)}
                    </select>
                    {loadingNurses && <div className="text-xs text-muted" style={{marginTop:3}}>Checking who's on duty…</div>}
                    {!loadingNurses && onDutyNurses.length === 0 && <div className="text-xs text-muted" style={{marginTop:3}}>No nurse shifts found for today — leave unassigned or check the Shift Scheduler.</div>}
                  </div>
                  <div className="form-group" style={{marginBottom:0}}><label className="form-label">Notes</label><input className="form-input" value={medForm.notes} onChange={e=>setMedForm(f=>({...f,notes:e.target.value}))} /></div>
                  <div style={{ gridColumn:'1 / -1' }}><button type="button" className="btn btn-primary btn-sm" disabled={savingMed} onClick={addMedSchedule}>{savingMed?'Saving…':'💾 Start Medication'}</button></div>
                </div>
              )}
              {canManageMeds ? (
                medLoading ? <div className="text-sm text-muted mb-2">Loading…</div>
                : medSchedules.length === 0 ? <div className="text-sm text-muted mb-2">No medications on record</div>
                : medSchedules.slice(0,5).map(m => (
                  <div key={m._id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 10px', background: m.active?'#f0fdf4':'#f8fafc', borderRadius:8, marginBottom:5 }}>
                    <div className="text-sm">
                      {m.medicineName} ({m.dosage}) — {m.frequency.replace(/_/g,' ')} {!m.active && <span className="text-xs text-muted">· discontinued</span>}
                      {m.assignedNurse?.name && <div className="text-xs text-muted">👩‍⚕️ Assigned to {m.assignedNurse.name}</div>}
                    </div>
                    {m.active && <button className="btn btn-outline btn-xs" onClick={()=>discontinueMed(m._id)}>Stop</button>}
                  </div>
                ))
              ) : <div className="text-sm text-muted mb-2">Only visible to clinical staff</div>}

              {canRequestTransfer && (
                <div style={{ marginTop:10, marginBottom:16 }}>
                  <button type="button" className="btn btn-outline btn-sm" onClick={()=>setShowTransferForm(s=>!s)}>🛏️ {showTransferForm?'Cancel':'Request Ward/Bed Transfer'}</button>
                  {showTransferForm && (
                    <div style={{ background:'#f8fafc', padding:12, borderRadius:10, marginTop:8, display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                      <div className="form-group" style={{marginBottom:0}}><label className="form-label">From *</label><input className="form-input" placeholder="e.g. Emergency Ward, Bed 4" value={transferForm.fromLocation} onChange={e=>setTransferForm(f=>({...f,fromLocation:e.target.value}))} /></div>
                      <div className="form-group" style={{marginBottom:0}}><label className="form-label">To *</label><input className="form-input" placeholder="e.g. ICU, Bed 2" value={transferForm.toLocation} onChange={e=>setTransferForm(f=>({...f,toLocation:e.target.value}))} /></div>
                      <div className="form-group" style={{marginBottom:0, gridColumn:'1 / -1'}}><label className="form-label">Reason</label><input className="form-input" value={transferForm.reason} onChange={e=>setTransferForm(f=>({...f,reason:e.target.value}))} /></div>
                      <div className="form-group" style={{marginBottom:0}}><label className="form-label">Priority</label>
                        <select className="form-input" value={transferForm.priority} onChange={e=>setTransferForm(f=>({...f,priority:e.target.value}))}>
                          <option value="routine">Routine</option><option value="urgent">Urgent</option>
                        </select>
                      </div>
                      <div style={{ gridColumn:'1 / -1' }}><button type="button" className="btn btn-primary btn-sm" disabled={savingTransfer} onClick={submitTransfer}>{savingTransfer?'Submitting…':'Submit Request'}</button></div>
                    </div>
                  )}
                </div>
              )}

              <div className="fw-7 text-sm mb-2">Recent Records</div>
              {patientRecords.length === 0 ? <div className="text-sm text-muted">No records found</div>
                : patientRecords.slice(0,4).map(r => (
                <div key={r._id} style={{ padding:'9px 11px',border:'1.5px solid #e2e8f0',borderRadius:8,marginBottom:6 }}>
                  <div className="fw-7 text-sm">{r.type} · {new Date(r.createdAt).toLocaleDateString()}</div>
                  <div className="text-xs text-muted">{r.notes?.slice(0,80)}</div>
                </div>
              ))}
            </div>
            <div className="modal-footer"><button className="btn btn-outline" onClick={()=>setViewPatient(null)}>Close</button></div>
          </motion.div>
        </div>
      )}

      {showAdd && (
        <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)setShowAdd(false);}}>
          <motion.div className="modal-box" initial={{opacity:0,y:20}} animate={{opacity:1,y:0}}>
            <div className="modal-header"><span className="modal-title">+ Add New Patient</span><button className="btn btn-ghost btn-icon" onClick={()=>setShowAdd(false)}>✕</button></div>
            <form onSubmit={handleAdd}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group"><label className="form-label">Full Name *</label><input className="form-input" required value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Patient full name"/></div>
                  <div className="form-group"><label className="form-label">Email <span style={{color:'#94a3b8',fontWeight:400}}>(optional for walk-ins)</span></label><input className="form-input" type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} placeholder="email@example.com — leave blank if none"/></div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label className="form-label">Phone</label><input className="form-input" value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} placeholder="+1-555-0000"/></div>
                  <div className="form-group"><label className="form-label">Blood Group</label><select className="form-input" value={form.bloodGroup} onChange={e=>setForm(f=>({...f,bloodGroup:e.target.value}))}>{['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(b=><option key={b}>{b}</option>)}</select></div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label className="form-label">Age</label><input className="form-input" type="number" value={form.age} onChange={e=>setForm(f=>({...f,age:e.target.value}))} placeholder="Age"/></div>
                  <div className="form-group"><label className="form-label">Weight (kg)</label><input className="form-input" type="number" value={form.weight} onChange={e=>setForm(f=>({...f,weight:e.target.value}))} placeholder="kg"/></div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={()=>setShowAdd(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={adding}>{adding?<><span className="spinner-sm"/> Adding…</>:'Add Patient'}</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}