import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usersAPI, medicinesAPI, prescriptionAPI, refillAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export function PrescriptionsPage() {
  const { user } = useAuth();
  const isDoctor = user?.role === 'doctor';
  const isPatient = user?.role === 'patient';

  const [tab, setTab] = useState('list');
  const [prescriptions, setPrescriptions] = useState([]);
  const [refills, setRefills] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [patients, setPatients] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [form, setForm] = useState({ patient:'',diagnosis:'',medicines:[{name:'',dosage:'',duration:'',instructions:''}],followUpDate:'',notes:'' });
  const [issuing, setIssuing] = useState(false);

  const [refillModal, setRefillModal] = useState(null);
  const [refillMeds, setRefillMeds] = useState([]);
  const [refillReason, setRefillReason] = useState('');
  const [submittingRefill, setSubmittingRefill] = useState(false);

  const [reviewModal, setReviewModal] = useState(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewing, setReviewing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (isDoctor) {
        const [rxRes, refillRes] = await Promise.all([prescriptionAPI.getIssued(), refillAPI.getForReview()]);
        setPrescriptions(rxRes.data.data || []);
        setRefills(refillRes.data.data || []);
      } else if (isPatient) {
        const [rxRes, refillRes] = await Promise.all([prescriptionAPI.getMine(), refillAPI.getMine()]);
        setPrescriptions(rxRes.data.data || []);
        setRefills(refillRes.data.data || []);
      }
    } catch { toast.error('Failed to load prescriptions'); }
    setLoading(false);
  }, [isDoctor, isPatient]);
  useEffect(() => { load(); }, [load]);

  const openModal = async () => {
    try {
      const [pRes, mRes] = await Promise.all([
        usersAPI.getAll({ role: 'patient', status: 'approved' }),
        medicinesAPI.getAll(),
      ]);
      setPatients(pRes.data.data || []);
      setMedicines(mRes.data.data || []);
      setForm({ patient: pRes.data.data?.[0]?._id || '', diagnosis:'', medicines:[{name:'',dosage:'',duration:'',instructions:''}], followUpDate:'', notes:'' });
    } catch (err) { console.error(err); }
    setShowModal(true);
  };

  const addMedRow = () => setForm(f=>({...f,medicines:[...f.medicines,{name:'',dosage:'',duration:'',instructions:''}]}));
  const removeMedRow = (i) => setForm(f=>({...f,medicines:f.medicines.filter((_,idx)=>idx!==i)}));
  const updateMedRow = (i,field,val) => setForm(f=>({...f,medicines:f.medicines.map((m,idx)=>idx===i?{...m,[field]:val}:m)}));

  const issue = async (e) => {
    e.preventDefault();
    if (!form.patient) { toast.error('Select a patient'); return; }
    if (!form.diagnosis.trim()) { toast.error('Diagnosis required'); return; }
    if (!form.medicines.some(m=>m.name.trim())) { toast.error('Add at least one medicine'); return; }
    setIssuing(true);
    try {
      await prescriptionAPI.create(form);
      toast.success('Prescription issued and saved to patient record!');
      setShowModal(false);
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to issue prescription'); }
    setIssuing(false);
  };

  const openRefillModal = (rx) => {
    setRefillModal(rx);
    setRefillMeds(rx.medicines.map(m=>m.name));
    setRefillReason('');
  };
  const toggleRefillMed = (name) => setRefillMeds(ms => ms.includes(name) ? ms.filter(m=>m!==name) : [...ms, name]);
  const submitRefill = async (e) => {
    e.preventDefault();
    if (refillMeds.length === 0) { toast.error('Select at least one medicine'); return; }
    setSubmittingRefill(true);
    try {
      await refillAPI.create({ prescriptionId: refillModal._id, medicines: refillMeds, reason: refillReason.trim() });
      toast.success('Refill request sent to your doctor');
      setRefillModal(null);
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to submit refill request'); }
    setSubmittingRefill(false);
  };

  const openReview = (r) => { setReviewModal(r); setReviewNotes(''); };
  const submitReview = async (status) => {
    setReviewing(true);
    try {
      await refillAPI.review(reviewModal._id, status, reviewNotes);
      toast.success(status === 'approved' ? 'Refill approved' : 'Refill declined');
      setReviewModal(null);
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to review request'); }
    setReviewing(false);
  };

  const pendingRefillsCount = refills.filter(r => r.status === 'pending').length;
  const myPendingRefillForRx = (rxId) => refills.find(r => (r.prescription?._id || r.prescription) === rxId && r.status === 'pending');

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">Prescriptions</div><div className="page-subtitle">{isDoctor?'Write and manage digital prescriptions':'Your prescriptions & refill requests'}</div></div>
        {isDoctor && <button className="btn btn-primary" onClick={openModal}>+ New Prescription</button>}
      </div>

      {isDoctor && (
        <div style={{ display:'flex', gap:6, marginBottom:18 }}>
          {[['list',`Issued (${prescriptions.length})`],['refills',`Refill Requests${pendingRefillsCount?` (${pendingRefillsCount})`:''}`]].map(([k,l])=>(
            <button key={k} onClick={()=>setTab(k)} style={{ padding:'9px 16px', borderRadius:11, border:'none', background:tab===k?'#eef2ff':'#f8fafc', color:tab===k?'#4338ca':'#64748b', fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>{l}</button>
          ))}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign:'center', padding:60, color:'#94a3b8' }}>Loading…</div>
      ) : isDoctor && tab === 'refills' ? (
        <motion.div className="card" initial={{opacity:0,y:14}} animate={{opacity:1,y:0}}>
          <div className="card-body">
            {refills.length === 0 ? (
              <div style={{ textAlign:'center', padding:40, color:'#94a3b8' }}><div style={{ fontSize:36, marginBottom:8 }}>💊</div>No refill requests yet.</div>
            ) : refills.map(r => (
              <div key={r._id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 14px', background:'#f8fafc', borderRadius:10, marginBottom:8, flexWrap:'wrap', gap:8 }}>
                <div>
                  <div style={{ fontWeight:700, fontSize:13.5 }}>{r.patient?.name} <span style={{ fontWeight:500, color:'#94a3b8' }}>· {r.prescription?.diagnosis}</span></div>
                  <div style={{ fontSize:12, color:'#64748b', marginTop:2 }}>{r.medicines.join(', ')}</div>
                  {r.reason && <div style={{ fontSize:11.5, color:'#94a3b8', marginTop:2 }}>Reason: {r.reason}</div>}
                </div>
                {r.status === 'pending' ? (
                  <button className="btn btn-primary btn-sm" onClick={()=>openReview(r)}>Review</button>
                ) : (
                  <span style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700, background:r.status==='approved'?'#dcfce7':'#fee2e2', color:r.status==='approved'?'#15803d':'#dc2626' }}>{r.status}</span>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      ) : prescriptions.length === 0 ? (
        <motion.div className="card" initial={{opacity:0,y:14}} animate={{opacity:1,y:0}}>
          <div className="card-body" style={{textAlign:'center',padding:48}}>
            <div style={{fontSize:52,marginBottom:12}}>📝</div>
            <div className="fw-7" style={{fontSize:17}}>{isDoctor ? 'No prescriptions issued yet' : 'No prescriptions on file yet'}</div>
            <div className="text-sm text-muted mt-1">{isDoctor ? 'Prescriptions you issue are saved to the patient record automatically' : 'Your doctor\u2019s prescriptions will appear here after a visit'}</div>
            {isDoctor && <button className="btn btn-primary mt-3" onClick={openModal}>Create New Prescription</button>}
          </div>
        </motion.div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {prescriptions.map(rx => {
            const pendingRefill = myPendingRefillForRx(rx._id);
            return (
              <motion.div key={rx._id} className="card" initial={{opacity:0,y:10}} animate={{opacity:1,y:0}}>
                <div className="card-body">
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:10, marginBottom:10 }}>
                    <div>
                      <div style={{ fontWeight:800, fontSize:15 }}>{rx.diagnosis}</div>
                      <div style={{ fontSize:12, color:'#64748b', marginTop:2 }}>
                        {isDoctor ? `Patient: ${rx.patient?.name}` : `Dr. ${rx.doctor?.name}${rx.doctor?.specialization?` · ${rx.doctor.specialization}`:''}`}
                        {' · '}{new Date(rx.createdAt).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}
                      </div>
                    </div>
                    {isPatient && (pendingRefill ? (
                      <span style={{ padding:'4px 11px', borderRadius:20, fontSize:11, fontWeight:700, background:'#fffbeb', color:'#92400e' }}>Refill pending review</span>
                    ) : (
                      <button className="btn btn-outline btn-sm" onClick={()=>openRefillModal(rx)}>Request Refill</button>
                    ))}
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    {rx.medicines.map((m,i)=>(
                      <div key={i} style={{ display:'flex', gap:10, fontSize:12.5, padding:'7px 10px', background:'#f8fafc', borderRadius:8, flexWrap:'wrap' }}>
                        <strong>{m.name}</strong>
                        {m.dosage && <span style={{ color:'#64748b' }}>· {m.dosage}</span>}
                        {m.duration && <span style={{ color:'#64748b' }}>· {m.duration}</span>}
                        {m.instructions && <span style={{ color:'#94a3b8' }}>· {m.instructions}</span>}
                      </div>
                    ))}
                  </div>
                  {(rx.followUpDate || rx.notes) && (
                    <div style={{ marginTop:10, fontSize:12, color:'#64748b' }}>
                      {rx.followUpDate && <div>Follow-up: {new Date(rx.followUpDate).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</div>}
                      {rx.notes && <div style={{ marginTop:2 }}>{rx.notes}</div>}
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)setShowModal(false);}}>
          <motion.div className="modal-box modal-box-lg" initial={{opacity:0,y:20}} animate={{opacity:1,y:0}}>
            <div className="modal-header"><span className="modal-title">New Prescription</span><button className="btn btn-ghost btn-icon" onClick={()=>setShowModal(false)}>✕</button></div>
            <form onSubmit={issue}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group"><label className="form-label">Patient *</label><select className="form-input" value={form.patient} onChange={e=>setForm(f=>({...f,patient:e.target.value}))}>{patients.map(p=><option key={p._id} value={p._id}>{p.name}</option>)}</select></div>
                  <div className="form-group"><label className="form-label">Diagnosis *</label><input className="form-input" required value={form.diagnosis} onChange={e=>setForm(f=>({...f,diagnosis:e.target.value}))} placeholder="Primary diagnosis"/></div>
                </div>
                <div className="fw-7 text-sm mb-2 mt-1">Medications</div>
                {form.medicines.map((m,i) => (
                  <div key={i} style={{ display:'flex', gap:8, marginBottom:8, alignItems:'center', flexWrap:'wrap' }}>
                    <select className="form-input" style={{ flex:'1 1 160px' }} value={m.name} onChange={e=>updateMedRow(i,'name',e.target.value)}>
                      <option value="">Select medicine</option>
                      {medicines.map(x=><option key={x._id} value={x.name}>{x.name}</option>)}
                    </select>
                    <input className="form-input" style={{ flex:'1 1 160px' }} placeholder="Dosage (e.g. 1 tablet twice daily)" value={m.dosage} onChange={e=>updateMedRow(i,'dosage',e.target.value)}/>
                    <input className="form-input" style={{ flex:'1 1 120px' }} placeholder="Duration (e.g. 7 days)" value={m.duration} onChange={e=>updateMedRow(i,'duration',e.target.value)}/>
                    <input className="form-input" style={{ flex:'1 1 140px' }} placeholder="Instructions (e.g. after food)" value={m.instructions} onChange={e=>updateMedRow(i,'instructions',e.target.value)}/>
                    {form.medicines.length>1 && <button type="button" className="btn btn-ghost btn-icon" onClick={()=>removeMedRow(i)}>✕</button>}
                  </div>
                ))}
                <button type="button" className="btn btn-outline btn-xs mb-3" onClick={addMedRow}>+ Add Medicine</button>
                <div className="form-row">
                  <div className="form-group"><label className="form-label">Follow-up Date</label><input className="form-input" type="date" value={form.followUpDate} onChange={e=>setForm(f=>({...f,followUpDate:e.target.value}))}/></div>
                  <div className="form-group"><label className="form-label">Notes</label><input className="form-input" placeholder="Additional instructions" value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}/></div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={()=>setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={issuing}>{issuing?<><span className="spinner-sm"/> Issuing…</>:'Issue Prescription'}</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      <AnimatePresence>
        {refillModal && (
          <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)setRefillModal(null);}}>
            <motion.div className="modal-box" initial={{opacity:0,y:20}} animate={{opacity:1,y:0}}>
              <div className="modal-header"><span className="modal-title">Request Refill</span><button className="btn btn-ghost btn-icon" onClick={()=>setRefillModal(null)}>✕</button></div>
              <form onSubmit={submitRefill}>
                <div className="modal-body">
                  <div style={{ fontSize:12.5, color:'#64748b', marginBottom:12 }}>For: <strong>{refillModal.diagnosis}</strong> (Dr. {refillModal.doctor?.name})</div>
                  <div className="fw-7 text-sm mb-2">Which medicines need a refill?</div>
                  {refillModal.medicines.map((m,i)=>(
                    <label key={i} style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 10px', background:'#f8fafc', borderRadius:8, marginBottom:6, cursor:'pointer', fontSize:13 }}>
                      <input type="checkbox" checked={refillMeds.includes(m.name)} onChange={()=>toggleRefillMed(m.name)} />
                      <strong>{m.name}</strong> {m.dosage && <span style={{ color:'#94a3b8' }}>· {m.dosage}</span>}
                    </label>
                  ))}
                  <div className="form-group mt-2"><label className="form-label">Reason / notes (optional)</label><textarea className="form-input" rows={2} value={refillReason} onChange={e=>setRefillReason(e.target.value)} placeholder="e.g. Running low, still on the same dosage"/></div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-outline" onClick={()=>setRefillModal(null)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={submittingRefill}>{submittingRefill?'Sending…':'Send Refill Request'}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {reviewModal && (
          <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)setReviewModal(null);}}>
            <motion.div className="modal-box" initial={{opacity:0,y:20}} animate={{opacity:1,y:0}}>
              <div className="modal-header"><span className="modal-title">Review Refill Request</span><button className="btn btn-ghost btn-icon" onClick={()=>setReviewModal(null)}>✕</button></div>
              <div className="modal-body">
                <div style={{ fontSize:13, marginBottom:10 }}><strong>{reviewModal.patient?.name}</strong> · {reviewModal.prescription?.diagnosis}</div>
                <div style={{ fontSize:12.5, color:'#64748b', marginBottom:10 }}>Requesting: {reviewModal.medicines.join(', ')}</div>
                {reviewModal.reason && <div style={{ fontSize:12, color:'#94a3b8', marginBottom:12 }}>Reason: {reviewModal.reason}</div>}
                <div className="form-group"><label className="form-label">Notes to patient (optional)</label><textarea className="form-input" rows={2} value={reviewNotes} onChange={e=>setReviewNotes(e.target.value)}/></div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-outline" disabled={reviewing} onClick={()=>submitReview('rejected')}>Decline</button>
                <button className="btn btn-primary" disabled={reviewing} onClick={()=>submitReview('approved')}>{reviewing?'Saving…':'Approve Refill'}</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default PrescriptionsPage;
