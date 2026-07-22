import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usersAPI, certificateAPI, bloodBankAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const TYPE_LABEL = { fitness: '💪 Fitness Certificate', medical_leave: '🛌 Medical Leave Certificate', general: '📄 General Health Certificate', blood_group: '🩸 Blood Group Certificate', blood_donation: '🩸 Blood Donation Certificate' };

export default function CertificatesPage() {
  const { user } = useAuth();
  const isDoctor = user?.role === 'doctor';

  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [patients, setPatients] = useState([]);
  const [form, setForm] = useState({ patientId:'', type:'fitness', purpose:'', diagnosis:'', findings:'', restAdvice:'', leaveFrom:'', leaveTo:'', bloodGroup:'' });
  const [issuing, setIssuing] = useState(false);

  const [viewCert, setViewCert] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = isDoctor ? await certificateAPI.getIssued() : await certificateAPI.getMine();
      setCertificates(res.data.data || []);
    } catch { toast.error('Failed to load certificates'); }
    setLoading(false);
  }, [isDoctor]);
  useEffect(() => { load(); }, [load]);

  const openModal = async () => {
    try {
      const res = await usersAPI.getAll({ role:'patient', status:'approved', limit:300 });
      setPatients(res.data.data || []);
      setForm({ patientId: res.data.data?.[0]?._id || '', type:'fitness', purpose:'', diagnosis:'', findings:'', restAdvice:'', leaveFrom:'', leaveTo:'', bloodGroup:'' });
    } catch { toast.error('Failed to load patient list'); }
    setShowModal(true);
  };

  const issue = async (e) => {
    e.preventDefault();
    if (!form.patientId) { toast.error('Select a patient'); return; }
    if (!form.purpose.trim()) { toast.error('Purpose is required'); return; }
    if (form.type === 'medical_leave' && (!form.leaveFrom || !form.leaveTo)) { toast.error('Leave start and end dates are required'); return; }
    if (form.type === 'blood_group' && !form.bloodGroup) { toast.error('Select a blood group'); return; }
    setIssuing(true);
    try {
      await certificateAPI.create(form);
      toast.success('✅ Certificate issued!');
      setShowModal(false);
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to issue certificate'); }
    setIssuing(false);
  };

  const downloadDonationCertificate = async (donationId) => {
    setDownloadingId(donationId);
    try {
      const res = await bloodBankAPI.getCertificateBlob(donationId);
      const url = window.URL.createObjectURL(new Blob([res.data], { type:'application/pdf' }));
      window.open(url, '_blank');
    } catch { toast.error('Failed to load certificate'); }
    setDownloadingId(null);
  };

  return (
    <div>
      <style>{`@media print { body * { visibility:hidden; } #cert-print-area, #cert-print-area * { visibility:visible; } #cert-print-area { position:absolute; left:0; top:0; width:100%; } .no-print { display:none !important; } }`}</style>

      <div className="page-header">
        <div><div className="page-title">📄 Health Certificates</div><div className="page-subtitle">{isDoctor ? 'Issue fitness, medical leave, and general health certificates' : 'Your issued certificates'}</div></div>
        {isDoctor && <button className="btn btn-primary" onClick={openModal}>+ Issue Certificate</button>}
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:60, color:'#94a3b8' }}>Loading…</div>
      ) : certificates.length === 0 ? (
        <div className="card"><div className="card-body" style={{ textAlign:'center', padding:48 }}>
          <div style={{ fontSize:52, marginBottom:12 }}>📄</div>
          <div className="fw-7" style={{ fontSize:17 }}>{isDoctor ? 'No certificates issued yet' : 'No certificates on file yet'}</div>
          {isDoctor && <button className="btn btn-primary mt-3" onClick={openModal}>Issue Your First Certificate</button>}
        </div></div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:14 }}>
          {certificates.map(c => (
            <motion.div key={c._id} className="card" initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }}>
              <div className="card-body">
                <div style={{ fontWeight:800, fontSize:14.5, marginBottom:6 }}>{TYPE_LABEL[c.type] || c.type}</div>
                <div style={{ fontSize:12.5, color:'#64748b', marginBottom:4 }}>
                  {isDoctor ? c.patient?.name : c.type==='blood_donation' ? '🩸 Mediventra Blood Bank' : c.doctor?.name ? `Dr. ${c.doctor.name}` : ''}
                </div>
                <div style={{ fontSize:12, color:'#374151', marginBottom:8 }}>{c.purpose}{c.bloodGroup ? ` · ${c.bloodGroup}` : ''}</div>
                <div style={{ fontSize:11, color:'#94a3b8', fontFamily:'monospace', marginBottom:10 }}>{c.certificateNumber}</div>
                {c.type === 'blood_donation' ? (
                  <button className="btn btn-outline btn-sm" style={{ width:'100%' }} disabled={downloadingId===c.donationRef} onClick={()=>downloadDonationCertificate(c.donationRef)}>
                    {downloadingId===c.donationRef ? 'Loading…' : '⬇️ Download Certificate'}
                  </button>
                ) : (
                  <button className="btn btn-outline btn-sm" style={{ width:'100%' }} onClick={()=>setViewCert(c)}>🖨️ View / Print</button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* ── ISSUE CERTIFICATE MODAL ── */}
      {showModal && (
        <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)setShowModal(false);}}>
          <motion.div className="modal-box" initial={{opacity:0,y:20}} animate={{opacity:1,y:0}}>
            <div className="modal-header"><span className="modal-title">📄 Issue Certificate</span><button className="btn btn-ghost btn-icon" onClick={()=>setShowModal(false)}>✕</button></div>
            <form onSubmit={issue}>
              <div className="modal-body">
                <div className="form-group"><label className="form-label">Patient *</label>
                  <select className="form-input" value={form.patientId} onChange={e=>setForm(f=>({...f,patientId:e.target.value}))}>
                    {patients.map(p=><option key={p._id} value={p._id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="form-group"><label className="form-label">Certificate Type *</label>
                  <select className="form-input" value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>
                    <option value="fitness">💪 Fitness Certificate</option>
                    <option value="medical_leave">🛌 Medical Leave Certificate</option>
                    <option value="general">📄 General Health Certificate</option>
                    <option value="blood_group">🩸 Blood Group Certificate</option>
                  </select>
                </div>
                <div className="form-group"><label className="form-label">Purpose *</label><input className="form-input" required value={form.purpose} onChange={e=>setForm(f=>({...f,purpose:e.target.value}))} placeholder={form.type==='fitness' ? 'e.g. For gym membership / sports participation' : form.type==='medical_leave' ? 'e.g. For office/school absence' : form.type==='blood_group' ? 'e.g. For blood donation eligibility / records' : 'e.g. For travel / insurance'} /></div>
                {form.type === 'blood_group' && (
                  <div className="form-group"><label className="form-label">Blood Group *</label>
                    <select className="form-input" required value={form.bloodGroup} onChange={e=>setForm(f=>({...f,bloodGroup:e.target.value}))}>
                      <option value="">Select…</option>
                      {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(b=><option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                )}
                {form.type === 'medical_leave' && (
                  <div className="form-row">
                    <div className="form-group"><label className="form-label">Leave From *</label><input className="form-input" type="date" required value={form.leaveFrom} onChange={e=>setForm(f=>({...f,leaveFrom:e.target.value}))} /></div>
                    <div className="form-group"><label className="form-label">Leave To *</label><input className="form-input" type="date" required value={form.leaveTo} onChange={e=>setForm(f=>({...f,leaveTo:e.target.value}))} /></div>
                  </div>
                )}
                <div className="form-group"><label className="form-label">Diagnosis (optional)</label><input className="form-input" value={form.diagnosis} onChange={e=>setForm(f=>({...f,diagnosis:e.target.value}))} /></div>
                {form.type === 'fitness' && (
                  <div className="form-group"><label className="form-label">Clinical Findings (optional)</label><textarea className="form-input" rows={2} value={form.findings} onChange={e=>setForm(f=>({...f,findings:e.target.value}))} placeholder="Examination findings supporting fitness" /></div>
                )}
                <div className="form-group"><label className="form-label">Advice / Notes (optional)</label><textarea className="form-input" rows={2} value={form.restAdvice} onChange={e=>setForm(f=>({...f,restAdvice:e.target.value}))} /></div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={()=>setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={issuing}>{issuing?'Issuing…':'✓ Issue Certificate'}</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* ── VIEW / PRINT CERTIFICATE ── */}
      <AnimatePresence>
        {viewCert && (
          <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)setViewCert(null);}}>
            <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} style={{ background:'#fff', borderRadius:18, width:'100%', maxWidth:560, boxShadow:'0 32px 80px rgba(0,0,0,.25)', overflow:'hidden' }}>
              <div id="cert-print-area" style={{ padding:'40px 36px', border:'6px double #1d4ed8', margin:16, borderRadius:8 }}>
                <div style={{ textAlign:'center', marginBottom:24 }}>
                  <div style={{ fontWeight:900, fontSize:22, color:'#1d4ed8' }}>✚ Mediventra</div>
                  <div style={{ fontSize:12, color:'#64748b', marginTop:2 }}>Official Health Certificate</div>
                </div>
                <div style={{ textAlign:'center', marginBottom:22 }}>
                  <div style={{ fontSize:18, fontWeight:800, textTransform:'uppercase', letterSpacing:1, color:'#0f172a' }}>{TYPE_LABEL[viewCert.type]}</div>
                  <div style={{ fontSize:11, color:'#94a3b8', fontFamily:'monospace', marginTop:4 }}>{viewCert.certificateNumber}</div>
                </div>
                <p style={{ fontSize:14, lineHeight:1.9, color:'#1e293b' }}>
                  This is to certify that <strong>{viewCert.patient?.name}</strong>{viewCert.patient?.age ? `, aged ${viewCert.patient.age} years,` : ''} was examined by the undersigned on {new Date(viewCert.issuedDate).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})}.
                </p>
                {viewCert.diagnosis && <p style={{ fontSize:14, lineHeight:1.8 }}><strong>Diagnosis:</strong> {viewCert.diagnosis}</p>}
                {viewCert.findings && <p style={{ fontSize:14, lineHeight:1.8 }}><strong>Clinical Findings:</strong> {viewCert.findings}</p>}
                {viewCert.type === 'medical_leave' && (
                  <p style={{ fontSize:14, lineHeight:1.8 }}>
                    The patient is advised medical leave/rest from <strong>{new Date(viewCert.leaveFrom).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})}</strong> to <strong>{new Date(viewCert.leaveTo).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})}</strong>.
                  </p>
                )}
                {viewCert.type === 'fitness' && (
                  <p style={{ fontSize:14, lineHeight:1.8 }}>Based on the above examination, the patient is certified <strong>medically fit</strong> for the stated purpose.</p>
                )}
                {viewCert.type === 'blood_group' && (
                  <p style={{ fontSize:14, lineHeight:1.8 }}>Based on laboratory testing, the patient's blood group is certified as <strong>{viewCert.bloodGroup}</strong>.</p>
                )}
                <p style={{ fontSize:14, lineHeight:1.8 }}><strong>Purpose:</strong> {viewCert.purpose}</p>
                {viewCert.restAdvice && <p style={{ fontSize:14, lineHeight:1.8 }}><strong>Advice:</strong> {viewCert.restAdvice}</p>}

                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginTop:40 }}>
                  <div style={{ fontSize:11.5, color:'#94a3b8' }}>Issued on {new Date(viewCert.issuedDate).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})}</div>
                  <div style={{ textAlign:'center' }}>
                    <div style={{ borderTop:'1.5px solid #1e293b', paddingTop:6, fontWeight:700, fontSize:13 }}>Dr. {viewCert.doctor?.name}</div>
                    <div style={{ fontSize:11, color:'#64748b' }}>{viewCert.doctor?.specialization}{viewCert.doctor?.licenseNumber ? ` · Lic. ${viewCert.doctor.licenseNumber}` : ''}</div>
                  </div>
                </div>
              </div>
              <div className="no-print" style={{ display:'flex', gap:9, padding:'0 24px 24px' }}>
                <button className="btn btn-outline" style={{ flex:1 }} onClick={()=>setViewCert(null)}>Close</button>
                <button className="btn btn-primary" style={{ flex:2 }} onClick={()=>window.print()}>🖨️ Print / Save as PDF</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
