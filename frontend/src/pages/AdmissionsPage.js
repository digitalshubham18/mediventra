import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { admissionAPI, facilityAPI, usersAPI } from '../utils/api';
import toast from 'react-hot-toast';

const INR = n => `₹${Number(n||0).toLocaleString('en-IN')}`;
const inp = { width:'100%', padding:'9px 12px', border:'1.5px solid #e2e8f0', borderRadius:9, fontSize:13.5, outline:'none', fontFamily:'inherit', background:'#fff' };
const lbl = { display:'block', fontSize:11.5, fontWeight:700, color:'#374151', marginBottom:5 };

const DEFAULT_RATE = { OT:8000, ICU:6000, Ward:1500, General:1000, Emergency:3000, Recovery:2000, Isolation:2500, Lab:0, Radiology:0 };

export default function AdmissionsPage() {
  const [tab, setTab] = useState('active');
  const [admissions, setAdmissions] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showAdmit, setShowAdmit] = useState(false);
  const [admitForm, setAdmitForm] = useState({ patientId:'', roomId:'', admittingDoctorId:'', reasonForAdmission:'', expectedDischargeDate:'', roomChargePerDay:'' });
  const [admitting, setAdmitting] = useState(false);

  const [dischargeModal, setDischargeModal] = useState(null);
  const [billPreview, setBillPreview] = useState(null);
  const [dischargeForm, setDischargeForm] = useState({ dischargeSummary:'', doctorFee:'', otherCharges:'', otherChargesNote:'', paymentMode:'cash' });
  const [discharging, setDischarging] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await admissionAPI.getAll(tab === 'active' ? { status: 'admitted' } : { status: 'discharged' });
      setAdmissions(res.data.data || []);
    } catch { toast.error('Failed to load admissions'); }
    setLoading(false);
  }, [tab]);
  useEffect(() => { load(); }, [load]);

  const openAdmitModal = async () => {
    try {
      const [rRes, pRes, dRes] = await Promise.all([
        facilityAPI.getRooms(), usersAPI.getAll({ role:'patient', status:'approved', limit:300 }), usersAPI.getAll({ role:'doctor', status:'approved', limit:300 }),
      ]);
      setRooms((rRes.data.data||[]).filter(r => r.occupiedBeds < r.capacity));
      setPatients(pRes.data.data||[]);
      setDoctors(dRes.data.data||[]);
      setAdmitForm({ patientId:'', roomId:'', admittingDoctorId:'', reasonForAdmission:'', expectedDischargeDate:'', roomChargePerDay:'' });
    } catch { toast.error('Failed to load admit form data'); }
    setShowAdmit(true);
  };

  const pickRoom = (roomId) => {
    const room = rooms.find(r => r._id === roomId);
    setAdmitForm(f => ({ ...f, roomId, roomChargePerDay: room ? (DEFAULT_RATE[room.type] || 1000) : f.roomChargePerDay }));
  };

  const submitAdmit = async (e) => {
    e.preventDefault();
    if (!admitForm.patientId || !admitForm.roomId || !admitForm.admittingDoctorId || !admitForm.reasonForAdmission.trim() || !admitForm.roomChargePerDay) {
      toast.error('Fill in all required fields'); return;
    }
    setAdmitting(true);
    try {
      await admissionAPI.admit(admitForm);
      toast.success('✅ Patient admitted');
      setShowAdmit(false);
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to admit patient'); }
    setAdmitting(false);
  };

  const openDischarge = async (admission) => {
    setDischargeModal(admission);
    setDischargeForm({ dischargeSummary:'', doctorFee:'', otherCharges:'', otherChargesNote:'', paymentMode:'cash' });
    try { const res = await admissionAPI.getBillPreview(admission._id); setBillPreview(res.data.data); }
    catch { setBillPreview(null); }
  };

  const submitDischarge = async (e) => {
    e.preventDefault();
    setDischarging(true);
    try {
      const res = await admissionAPI.discharge(dischargeModal._id, dischargeForm);
      toast.success(`✅ Patient discharged — final bill ${INR(res.data.data.bill.totalAmount)}`);
      setDischargeModal(null);
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to discharge patient'); }
    setDischarging(false);
  };

  const estimatedTotal = billPreview ? billPreview.roomCharges + billPreview.pharmacyCharges + (Number(dischargeForm.doctorFee)||0) + (Number(dischargeForm.otherCharges)||0) : 0;

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">🏥 IPD Admissions</div><div className="page-subtitle">Admit patients to rooms/beds and manage discharge billing</div></div>
        <button className="btn btn-primary" onClick={openAdmitModal}>+ Admit Patient</button>
      </div>

      <div style={{ display:'flex', gap:6, marginBottom:18 }}>
        {[['active','🛏️ Currently Admitted'],['discharged','✅ Discharged']].map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)} style={{ padding:'9px 16px', borderRadius:11, border:'none', background:tab===k?'#eef2ff':'#f8fafc', color:tab===k?'#4338ca':'#64748b', fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>{l}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:60, color:'#94a3b8' }}>Loading…</div>
      ) : admissions.length === 0 ? (
        <div className="card"><div className="card-body" style={{ textAlign:'center', padding:48 }}>
          <div style={{ fontSize:44, marginBottom:10 }}>🏥</div>
          <div style={{ fontWeight:700, fontSize:16 }}>{tab==='active' ? 'No patients currently admitted' : 'No discharge history yet'}</div>
        </div></div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))', gap:14 }}>
          {admissions.map(a => (
            <motion.div key={a._id} className="card" initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }}>
              <div className="card-body">
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}>
                  <div>
                    <div style={{ fontWeight:800, fontSize:15 }}>{a.patient?.name}</div>
                    <div style={{ fontSize:12, color:'#64748b' }}>{a.room?.type} — Room {a.room?.number}, Floor {a.room?.floor}</div>
                  </div>
                  <span style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700, background: a.status==='admitted'?'#fef3c7':'#dcfce7', color: a.status==='admitted'?'#92400e':'#15803d', height:'fit-content' }}>{a.status}</span>
                </div>
                <div style={{ fontSize:12.5, color:'#374151', marginBottom:6 }}>📋 {a.reasonForAdmission}</div>
                <div style={{ fontSize:12, color:'#64748b', marginBottom:6 }}>👨‍⚕️ Dr. {a.admittingDoctor?.name}</div>
                <div style={{ fontSize:11.5, color:'#94a3b8', marginBottom:10 }}>
                  Admitted {new Date(a.admissionDate).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}
                  {a.dischargeDate && ` → Discharged ${new Date(a.dischargeDate).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}`}
                </div>
                {a.status === 'discharged' ? (
                  <div style={{ background:'#f0fdf4', borderRadius:10, padding:'10px 12px', fontSize:12.5 }}>
                    <div style={{ fontWeight:800, color:'#15803d' }}>Final Bill: {INR(a.bill.totalAmount)}</div>
                    <div style={{ color:'#64748b', marginTop:2 }}>Room {INR(a.bill.roomCharges)} · Pharmacy {INR(a.bill.pharmacyCharges)} · Doctor {INR(a.bill.doctorFee)}{a.bill.otherCharges?` · Other ${INR(a.bill.otherCharges)}`:''}</div>
                  </div>
                ) : (
                  <button className="btn btn-primary btn-sm" style={{ width:'100%' }} onClick={()=>openDischarge(a)}>🏁 Discharge & Generate Bill</button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* ── ADMIT PATIENT MODAL ── */}
      <AnimatePresence>
        {showAdmit && (
          <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)setShowAdmit(false);}}>
            <motion.div className="modal-box" initial={{opacity:0,y:20}} animate={{opacity:1,y:0}}>
              <div className="modal-header"><span className="modal-title">🏥 Admit Patient</span><button className="btn btn-ghost btn-icon" onClick={()=>setShowAdmit(false)}>✕</button></div>
              <form onSubmit={submitAdmit}>
                <div className="modal-body">
                  <div style={{ marginBottom:11 }}><label style={lbl}>Patient *</label>
                    <select style={inp} required value={admitForm.patientId} onChange={e=>setAdmitForm(f=>({...f,patientId:e.target.value}))}>
                      <option value="">— Select patient —</option>
                      {patients.map(p=><option key={p._id} value={p._id}>{p.name} ({p.phone||p.email})</option>)}
                    </select>
                  </div>
                  <div style={{ marginBottom:11 }}><label style={lbl}>Room / Bed *</label>
                    <select style={inp} required value={admitForm.roomId} onChange={e=>pickRoom(e.target.value)}>
                      <option value="">— Select an available room —</option>
                      {rooms.map(r=><option key={r._id} value={r._id}>{r.type} — {r.number} (Floor {r.floor}) — {r.capacity-r.occupiedBeds} bed(s) free</option>)}
                    </select>
                  </div>
                  <div style={{ marginBottom:11 }}><label style={lbl}>Admitting Doctor *</label>
                    <select style={inp} required value={admitForm.admittingDoctorId} onChange={e=>setAdmitForm(f=>({...f,admittingDoctorId:e.target.value}))}>
                      <option value="">— Select doctor —</option>
                      {doctors.map(d=><option key={d._id} value={d._id}>Dr. {d.name}{d.specialization?` (${d.specialization})`:''}</option>)}
                    </select>
                  </div>
                  <div style={{ marginBottom:11 }}><label style={lbl}>Reason for Admission *</label><textarea style={inp} required rows={2} value={admitForm.reasonForAdmission} onChange={e=>setAdmitForm(f=>({...f,reasonForAdmission:e.target.value}))} /></div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:11 }}>
                    <div><label style={lbl}>Room Charge / Day (₹) *</label><input style={inp} type="number" required min="0" value={admitForm.roomChargePerDay} onChange={e=>setAdmitForm(f=>({...f,roomChargePerDay:e.target.value}))} /></div>
                    <div><label style={lbl}>Expected Discharge (optional)</label><input style={inp} type="date" value={admitForm.expectedDischargeDate} onChange={e=>setAdmitForm(f=>({...f,expectedDischargeDate:e.target.value}))} /></div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-outline" onClick={()=>setShowAdmit(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={admitting}>{admitting?'Admitting…':'✓ Admit Patient'}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── DISCHARGE MODAL ── */}
      <AnimatePresence>
        {dischargeModal && (
          <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)setDischargeModal(null);}}>
            <motion.div className="modal-box" initial={{opacity:0,y:20}} animate={{opacity:1,y:0}}>
              <div className="modal-header"><span className="modal-title">🏁 Discharge {dischargeModal.patient?.name}</span><button className="btn btn-ghost btn-icon" onClick={()=>setDischargeModal(null)}>✕</button></div>
              <form onSubmit={submitDischarge}>
                <div className="modal-body">
                  {billPreview && (
                    <div style={{ background:'#f8fafc', borderRadius:10, padding:'12px 14px', marginBottom:14, fontSize:12.5 }}>
                      <div>Length of stay: <strong>{billPreview.days} day{billPreview.days!==1?'s':''}</strong></div>
                      <div>Room charges: <strong>{INR(billPreview.roomCharges)}</strong></div>
                      <div>Pharmacy charges ({billPreview.pharmacyOrderCount} order{billPreview.pharmacyOrderCount!==1?'s':''}): <strong>{INR(billPreview.pharmacyCharges)}</strong></div>
                    </div>
                  )}
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:11 }}>
                    <div><label style={lbl}>Doctor Fee (₹)</label><input style={inp} type="number" min="0" value={dischargeForm.doctorFee} onChange={e=>setDischargeForm(f=>({...f,doctorFee:e.target.value}))} /></div>
                    <div><label style={lbl}>Other Charges (₹)</label><input style={inp} type="number" min="0" value={dischargeForm.otherCharges} onChange={e=>setDischargeForm(f=>({...f,otherCharges:e.target.value}))} /></div>
                  </div>
                  {dischargeForm.otherCharges > 0 && (
                    <div style={{ marginBottom:11 }}><label style={lbl}>Other Charges Note</label><input style={inp} value={dischargeForm.otherChargesNote} onChange={e=>setDischargeForm(f=>({...f,otherChargesNote:e.target.value}))} placeholder="e.g. Ambulance, equipment rental" /></div>
                  )}
                  <div style={{ marginBottom:11 }}><label style={lbl}>Payment Mode</label>
                    <select style={inp} value={dischargeForm.paymentMode} onChange={e=>setDischargeForm(f=>({...f,paymentMode:e.target.value}))}>
                      <option value="cash">Cash</option><option value="card">Card</option><option value="upi">UPI</option><option value="insurance">Insurance</option><option value="netbanking">Net Banking</option>
                    </select>
                  </div>
                  <div style={{ marginBottom:14 }}><label style={lbl}>Discharge Summary</label><textarea style={inp} rows={3} value={dischargeForm.dischargeSummary} onChange={e=>setDischargeForm(f=>({...f,dischargeSummary:e.target.value}))} placeholder="Diagnosis, treatment given, follow-up instructions…" /></div>
                  <div style={{ background:'#eef2ff', borderRadius:10, padding:'12px 14px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={{ fontWeight:700, color:'#4338ca' }}>Final Bill Total</span>
                    <span style={{ fontWeight:900, fontSize:20, color:'#4338ca' }}>{INR(estimatedTotal)}</span>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-outline" onClick={()=>setDischargeModal(null)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={discharging}>{discharging?'Processing…':'✓ Discharge & Finalize Bill'}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
