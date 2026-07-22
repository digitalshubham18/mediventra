import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { dischargePlanAPI, appointmentsAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

function Timeline({ plan, onMarkDone, readOnly }) {
  return (
    <div style={{ position:'relative', paddingLeft:26 }}>
      <div style={{ position:'absolute', left:8, top:6, bottom:6, width:2, background:'#e2e8f0' }} />
      {plan.milestones.map(m => (
        <div key={m._id} style={{ position:'relative', marginBottom:20 }}>
          <div style={{ position:'absolute', left:-26, top:2, width:18, height:18, borderRadius:'50%',
            background: m.status==='done' ? '#059669' : m.status==='missed' ? '#dc2626' : '#fff',
            border: `2.5px solid ${m.status==='done' ? '#059669' : m.status==='missed' ? '#dc2626' : '#cbd5e1'}`,
            display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, color:'#fff' }}>
            {m.status==='done' && '✓'}
          </div>
          <div style={{ fontWeight:700, fontSize:14, color: m.status==='done' ? '#059669' : '#0f172a' }}>{m.title}</div>
          {m.description && <div style={{ fontSize:12.5, color:'#64748b', marginTop:3 }}>{m.description}</div>}
          <div style={{ fontSize:11.5, color:'#94a3b8', marginTop:3 }}>
            {m.status==='done' ? `Completed ${new Date(m.completedAt).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}` : `Target: ${new Date(m.targetDate).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}`}
          </div>
          {!readOnly && m.status!=='done' && (
            <button className="btn btn-outline btn-sm" style={{marginTop:8}} onClick={()=>onMarkDone(plan._id, m._id)}>✓ Mark Complete</button>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Patient view — see & complete your own recovery plan(s) ──────────
function PatientView() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => { setLoading(true); dischargePlanAPI.getMine().then(res => setPlans(res.data.data || [])).catch(()=>{}).finally(()=>setLoading(false)); };
  useEffect(() => { load(); }, []);

  const markDone = async (planId, milestoneId) => {
    try { await dischargePlanAPI.updateMilestone(planId, milestoneId, 'done'); toast.success('Milestone marked complete!'); load(); }
    catch { toast.error('Failed to update'); }
  };

  if (loading) return <div style={{ textAlign:'center', padding:60, color:'#94a3b8' }}>Loading…</div>;
  const active = plans.filter(p=>p.active);
  if (active.length === 0) return (
    <div style={{ textAlign:'center', padding:60, color:'#94a3b8' }}>
      <div style={{ fontSize:40, marginBottom:10 }}>🩹</div>
      No active recovery plan right now — your doctor will set one up after a procedure or discharge.
    </div>
  );

  return active.map(plan => (
    <div key={plan._id} className="card" style={{ marginBottom:18 }}>
      <div className="card-header"><span className="card-title">{plan.title}</span></div>
      <div className="card-body">
        <div style={{ fontSize:12, color:'#94a3b8', marginBottom:16 }}>Set by Dr. {plan.doctor?.name}{plan.doctor?.specialization?` (${plan.doctor.specialization})`:''}</div>
        <Timeline plan={plan} onMarkDone={markDone} />
      </div>
    </div>
  ));
}

// ── Doctor view — pick a patient, build a milestone plan, track progress ──
function DoctorView() {
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState('');
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();
  const [form, setForm] = useState({ title:'', milestones:[{ title:'', description:'', targetDate:'' }] });

  useEffect(() => {
    appointmentsAPI.getAll({ doctorId: user._id || user.id }).then(res => {
      const appts = res.data.data || [];
      const seen = new Set(); const list = [];
      appts.forEach(a => { if (a.patient && !seen.has(a.patient._id)) { seen.add(a.patient._id); list.push(a.patient); } });
      list.sort((a,b)=>(a.name||'').localeCompare(b.name||''));
      setPatients(list);
    }).catch(()=>{}).finally(()=>setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadPlansFor = (patientId) => {
    if (!patientId) { setPlans([]); return; }
    dischargePlanAPI.getForPatient(patientId).then(res => setPlans(res.data.data || [])).catch(()=>{});
  };

  useEffect(() => { loadPlansFor(selectedPatient); }, [selectedPatient]); // eslint-disable-line react-hooks/exhaustive-deps

  const addMilestone = () => setForm(f => ({ ...f, milestones: [...f.milestones, { title:'', description:'', targetDate:'' }] }));
  const removeMilestone = (i) => setForm(f => ({ ...f, milestones: f.milestones.filter((_,idx)=>idx!==i) }));
  const updateMilestone = (i, patch) => setForm(f => ({ ...f, milestones: f.milestones.map((m,idx)=>idx===i?{...m,...patch}:m) }));

  const submit = async (e) => {
    e.preventDefault();
    if (!selectedPatient) { toast.error('Select a patient first'); return; }
    if (!form.title.trim()) { toast.error('Give the plan a title'); return; }
    if (form.milestones.some(m => !m.title.trim() || !m.targetDate)) { toast.error('Every milestone needs a title and target date'); return; }
    setSaving(true);
    try {
      await dischargePlanAPI.create({ patientId: selectedPatient, title: form.title, milestones: form.milestones });
      toast.success('✅ Recovery plan created — the patient can see it now.');
      setShowNew(false);
      setForm({ title:'', milestones:[{ title:'', description:'', targetDate:'' }] });
      loadPlansFor(selectedPatient);
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to create plan'); }
    setSaving(false);
  };

  const markDone = async (planId, milestoneId) => {
    try { await dischargePlanAPI.updateMilestone(planId, milestoneId, 'done'); toast.success('Marked complete'); loadPlansFor(selectedPatient); }
    catch { toast.error('Failed to update'); }
  };

  if (loading) return <div style={{ textAlign:'center', padding:60, color:'#94a3b8' }}>Loading…</div>;

  return (
    <div>
      <div className="card" style={{ marginBottom:20 }}>
        <div className="card-body" style={{ display:'flex', gap:12, alignItems:'flex-end', flexWrap:'wrap' }}>
          <div style={{ flex:1, minWidth:220 }}>
            <label className="form-label">Select Patient</label>
            <select className="form-input" value={selectedPatient} onChange={e=>setSelectedPatient(e.target.value)}>
              <option value="">— Choose a patient —</option>
              {patients.map(p=><option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
          </div>
          <button className="btn btn-primary" disabled={!selectedPatient} onClick={()=>setShowNew(true)}>+ New Recovery Plan</button>
        </div>
        {patients.length === 0 && <div style={{ padding:'0 20px 16px', fontSize:12.5, color:'#94a3b8' }}>No patients with appointments yet.</div>}
      </div>

      {!selectedPatient ? (
        <div style={{ textAlign:'center', padding:60, color:'#94a3b8' }}>Select a patient above to view or create a recovery plan.</div>
      ) : plans.length === 0 ? (
        <div style={{ textAlign:'center', padding:60, color:'#94a3b8' }}>No recovery plan yet for this patient — click "New Recovery Plan" to set one up.</div>
      ) : plans.map(plan => (
        <div key={plan._id} className="card" style={{ marginBottom:18 }}>
          <div className="card-header">
            <span className="card-title">{plan.title}</span>
            <span className={`badge ${plan.active?'badge-success':'badge-warning'}`}>{plan.active?'Active':'Closed'}</span>
          </div>
          <div className="card-body"><Timeline plan={plan} onMarkDone={markDone} /></div>
        </div>
      ))}

      <AnimatePresence>
        {showNew && (
          <div className="modal-overlay" onClick={e=>{ if(e.target===e.currentTarget) setShowNew(false); }}>
            <motion.div className="modal-box" style={{ maxWidth:560 }} initial={{ opacity:0,y:20,scale:.97 }} animate={{ opacity:1,y:0,scale:1 }}>
              <div className="modal-header"><span className="modal-title">New Recovery Plan</span><button className="btn btn-ghost btn-icon" onClick={()=>setShowNew(false)}>✕</button></div>
              <form onSubmit={submit}>
                <div className="modal-body" style={{ maxHeight:'65vh', overflowY:'auto' }}>
                  <div className="form-group"><label className="form-label">Plan Title *</label><input className="form-input" required value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="e.g. Post-Appendectomy Recovery" /></div>
                  <label className="form-label">Milestones *</label>
                  {form.milestones.map((m,i) => (
                    <div key={i} style={{ background:'#f8fafc', borderRadius:10, padding:12, marginBottom:10 }}>
                      <div style={{ display:'flex', gap:8, marginBottom:8 }}>
                        <input className="form-input" style={{flex:1}} value={m.title} onChange={e=>updateMilestone(i,{title:e.target.value})} placeholder="Milestone title, e.g. Remove stitches" />
                        <input type="date" className="form-input" style={{width:160}} value={m.targetDate} onChange={e=>updateMilestone(i,{targetDate:e.target.value})} />
                        <button type="button" onClick={()=>removeMilestone(i)} disabled={form.milestones.length===1}
                          style={{ background:'none', border:'none', color:'#dc2626', cursor: form.milestones.length===1?'not-allowed':'pointer', opacity:form.milestones.length===1?.3:1 }}>🗑️</button>
                      </div>
                      <input className="form-input" value={m.description} onChange={e=>updateMilestone(i,{description:e.target.value})} placeholder="Optional notes for this milestone" />
                    </div>
                  ))}
                  <button type="button" className="btn btn-outline btn-sm" onClick={addMilestone}>+ Add Milestone</button>
                </div>
                <div className="modal-footer"><button type="button" className="btn btn-outline" onClick={()=>setShowNew(false)}>Cancel</button><button type="submit" className="btn btn-primary" disabled={saving}>{saving?'Creating…':'Create Plan'}</button></div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function DischargeTimelinePage() {
  const { user } = useAuth();
  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">🩹 Recovery Timeline</div>
          <div className="page-subtitle">{user?.role === 'doctor' ? "Set step-by-step recovery milestones for your patients" : "Step-by-step recovery goals and follow-up milestones set by your doctor"}</div>
        </div>
      </div>
      {user?.role === 'doctor' ? <DoctorView /> : <PatientView />}
    </div>
  );
}
