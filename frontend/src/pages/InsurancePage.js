import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { insuranceAPI, appointmentsAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const INR = n => `₹${Number(n||0).toLocaleString('en-IN')}`;
const inp = { width:'100%', padding:'9px 12px', border:'1.5px solid #e2e8f0', borderRadius:9, fontSize:13.5, outline:'none', fontFamily:'inherit', background:'#fff' };
const lbl = { display:'block', fontSize:11.5, fontWeight:700, color:'#374151', marginBottom:5, textTransform:'uppercase', letterSpacing:.4 };

const CLAIM_STATUS = {
  submitted:    { label:'Submitted',    bg:'#eff6ff', c:'#1d4ed8' },
  under_review: { label:'Under Review', bg:'#fffbeb', c:'#92400e' },
  approved:     { label:'Approved',     bg:'#dcfce7', c:'#15803d' },
  rejected:     { label:'Rejected',     bg:'#fef2f2', c:'#dc2626' },
  paid:         { label:'Paid Out',     bg:'#f0fdf4', c:'#059669' },
};

export default function InsurancePage() {
  const { user } = useAuth();
  const [tab, setTab] = useState('policies');
  const [policies, setPolicies] = useState([]);
  const [claims, setClaims] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [policyForm, setPolicyForm] = useState({ provider:'', policyNumber:'', policyType:'individual', sumInsured:'', validFrom:'', validTill:'', notes:'', cardImage:null });
  const [savingPolicy, setSavingPolicy] = useState(false);

  const [showClaimModal, setShowClaimModal] = useState(false);
  const [claimForm, setClaimForm] = useState({ policyId:'', appointmentId:'', claimAmount:'', reason:'', documents:[] });
  const [savingClaim, setSavingClaim] = useState(false);

  const [viewClaim, setViewClaim] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, cRes] = await Promise.all([insuranceAPI.getMyPolicies(), insuranceAPI.getMyClaims()]);
      setPolicies(pRes.data.data || []);
      setClaims(cRes.data.data || []);
    } catch { toast.error('Failed to load insurance data'); }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    appointmentsAPI.getAll({ limit: 100 }).then(res => setAppointments(res.data.data || [])).catch(() => {});
  }, []);

  if (user?.role !== 'patient') {
    return <div style={{ padding:60, textAlign:'center', color:'#94a3b8' }}>This page is only available to patients.</div>;
  }

  const validPolicies = policies.filter(p => p.isValid);

  const openAddPolicy = () => {
    setPolicyForm({ provider:'', policyNumber:'', policyType:'individual', sumInsured:'', validFrom:'', validTill:'', notes:'', cardImage:null });
    setShowPolicyModal(true);
  };
  const submitPolicy = async (e) => {
    e.preventDefault();
    if (!policyForm.provider.trim() || !policyForm.policyNumber.trim() || !policyForm.sumInsured || !policyForm.validFrom || !policyForm.validTill) {
      toast.error('Please fill in all required fields'); return;
    }
    if (new Date(policyForm.validTill) <= new Date(policyForm.validFrom)) { toast.error('Valid-till date must be after valid-from date'); return; }
    setSavingPolicy(true);
    try {
      await insuranceAPI.addPolicy(policyForm);
      toast.success('✅ Policy added!');
      setShowPolicyModal(false);
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to add policy'); }
    setSavingPolicy(false);
  };
  const removePolicy = async (id) => {
    if (!window.confirm('Remove this policy?')) return;
    try { await insuranceAPI.deletePolicy(id); toast.success('Policy removed'); load(); }
    catch (err) { toast.error(err.response?.data?.error || 'Failed to remove policy'); }
  };

  const openSubmitClaim = () => {
    if (validPolicies.length === 0) { toast.error('You need a currently valid policy on file before submitting a claim'); return; }
    setClaimForm({ policyId: validPolicies[0]._id, appointmentId:'', claimAmount:'', reason:'', documents:[] });
    setShowClaimModal(true);
  };
  const submitClaim = async (e) => {
    e.preventDefault();
    if (!claimForm.policyId || !claimForm.claimAmount || !claimForm.reason.trim()) { toast.error('Policy, claim amount, and reason are required'); return; }
    if (!claimForm.documents || claimForm.documents.length === 0) { toast.error('📎 At least one supporting document (bill, prescription, or report) is required'); return; }
    setSavingClaim(true);
    try {
      await insuranceAPI.submitClaim(claimForm);
      toast.success('✅ Claim submitted — our billing team will review it shortly.');
      setShowClaimModal(false);
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to submit claim'); }
    setSavingClaim(false);
  };

  return (
    <div style={{ fontFamily:"'Inter',system-ui,sans-serif" }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:900, color:'#0f172a' }}>🛡️ Insurance</div>
          <div style={{ fontSize:13, color:'#94a3b8', marginTop:3 }}>Manage your policies and track claims</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={openAddPolicy} style={{ padding:'10px 18px', background:'#fff', border:'1.5px solid #e2e8f0', borderRadius:11, color:'#374151', fontSize:13.5, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>+ Add Policy</button>
          <button onClick={openSubmitClaim} style={{ padding:'10px 18px', background:'linear-gradient(135deg,#7c3aed,#6366f1)', border:'none', borderRadius:11, color:'#fff', fontSize:13.5, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>+ Submit Claim</button>
        </div>
      </div>

      <div style={{ display:'flex', gap:6, marginBottom:18, borderBottom:'1.5px solid #f1f5f9' }}>
        {[['policies',`📄 My Policies (${policies.length})`],['claims',`🧾 My Claims (${claims.length})`]].map(([k,l]) => (
          <button key={k} onClick={()=>setTab(k)} style={{ padding:'10px 16px', border:'none', background:'none', borderBottom: tab===k ? '2.5px solid #7c3aed' : '2.5px solid transparent', color: tab===k ? '#7c3aed' : '#94a3b8', fontWeight:700, fontSize:13.5, cursor:'pointer', fontFamily:'inherit' }}>{l}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:60, color:'#94a3b8' }}>Loading…</div>
      ) : tab === 'policies' ? (
        policies.length === 0 ? (
          <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:16, padding:52, textAlign:'center' }}>
            <div style={{ fontSize:44, marginBottom:12 }}>🛡️</div>
            <div style={{ fontWeight:700, fontSize:16, color:'#0f172a', marginBottom:6 }}>No insurance policies on file</div>
            <div style={{ fontSize:13, color:'#94a3b8', marginBottom:16 }}>Add your policy details so you can submit claims for covered treatment.</div>
            <button onClick={openAddPolicy} style={{ padding:'10px 22px', background:'linear-gradient(135deg,#7c3aed,#6366f1)', border:'none', borderRadius:10, color:'#fff', fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>+ Add Policy</button>
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:14 }}>
            {policies.map(p => (
              <motion.div key={p._id} whileHover={{ y:-2 }} style={{ background:'#fff', border:`2px solid ${p.isValid?'#a78bfa30':'#fecaca'}`, borderRadius:16, padding:18, borderTop:`4px solid ${p.isValid?'#7c3aed':'#dc2626'}` }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                  <div style={{ width:42, height:42, borderRadius:12, background:'#7c3aed15', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>🛡️</div>
                  <span style={{ padding:'4px 10px', background: p.isValid?'#dcfce7':'#fef2f2', color: p.isValid?'#15803d':'#dc2626', borderRadius:9, fontSize:11.5, fontWeight:700 }}>{p.isValid ? 'Active' : 'Expired / Not Active'}</span>
                </div>
                <div style={{ fontWeight:800, fontSize:15, color:'#0f172a', marginBottom:3 }}>{p.provider}</div>
                <div style={{ fontSize:12.5, color:'#64748b', marginBottom:4 }}>Policy # {p.policyNumber} · <span style={{ textTransform:'capitalize' }}>{p.policyType}</span></div>
                <div style={{ fontSize:13, fontWeight:700, color:'#7c3aed', marginBottom:4 }}>Sum Insured: {INR(p.sumInsured)}</div>
                <div style={{ fontSize:12, color:'#94a3b8', marginBottom:10 }}>
                  Valid {new Date(p.validFrom).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})} – {new Date(p.validTill).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}
                </div>
                {p.notes && <div style={{ fontSize:12, color:'#64748b', marginBottom:10, fontStyle:'italic' }}>“{p.notes}”</div>}
                {p.cardImageUrl && <a href={p.cardImageUrl} target="_blank" rel="noreferrer" style={{ fontSize:12, color:'#1d4ed8', fontWeight:700, textDecoration:'none', display:'block', marginBottom:10 }}>📷 View Card Image</a>}
                <button onClick={()=>removePolicy(p._id)} style={{ width:'100%', padding:7, background:'#fef2f2', border:'1px solid #fecaca', borderRadius:8, color:'#dc2626', fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>🗑 Remove Policy</button>
              </motion.div>
            ))}
          </div>
        )
      ) : (
        claims.length === 0 ? (
          <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:16, padding:52, textAlign:'center' }}>
            <div style={{ fontSize:44, marginBottom:12 }}>🧾</div>
            <div style={{ fontWeight:700, fontSize:16, color:'#0f172a', marginBottom:6 }}>No claims submitted yet</div>
            <button onClick={openSubmitClaim} style={{ marginTop:8, padding:'9px 20px', background:'linear-gradient(135deg,#7c3aed,#6366f1)', border:'none', borderRadius:10, color:'#fff', fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>+ Submit Claim</button>
          </div>
        ) : (
          <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:16, overflow:'hidden' }}>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead><tr style={{ background:'#f8fafc' }}>
                  {['Policy','Amount Claimed','Approved','Status','Submitted','Details'].map(h => (
                    <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:10.5, fontWeight:700, color:'#94a3b8', letterSpacing:.5, textTransform:'uppercase', borderBottom:'1px solid #f1f5f9', whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {claims.map(c => {
                    const st = CLAIM_STATUS[c.status] || CLAIM_STATUS.submitted;
                    return (
                      <tr key={c._id} style={{ borderBottom:'1px solid #f8fafc' }}>
                        <td style={{ padding:'11px 14px', fontSize:12.5, fontWeight:700, color:'#0f172a' }}>{c.policy?.provider}<div style={{ fontSize:11, color:'#94a3b8', fontWeight:500 }}>{c.policy?.policyNumber}</div></td>
                        <td style={{ padding:'11px 14px', fontSize:13, fontWeight:700 }}>{INR(c.claimAmount)}</td>
                        <td style={{ padding:'11px 14px', fontSize:13, fontWeight:700, color:'#059669' }}>{c.approvedAmount != null ? INR(c.approvedAmount) : '—'}</td>
                        <td style={{ padding:'11px 14px' }}><span style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700, background:st.bg, color:st.c }}>{st.label}</span></td>
                        <td style={{ padding:'11px 14px', fontSize:12, color:'#64748b' }}>{new Date(c.createdAt).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</td>
                        <td style={{ padding:'11px 14px' }}><button onClick={()=>setViewClaim(c)} style={{ padding:'5px 12px', background:'#f5f3ff', border:'1px solid #ddd6fe', borderRadius:8, color:'#7c3aed', fontWeight:700, fontSize:11.5, cursor:'pointer', fontFamily:'inherit' }}>View</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* ── ADD POLICY MODAL ── */}
      <AnimatePresence>
        {showPolicyModal && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:16, overflowY:'auto' }}
            onClick={e=>{if(e.target===e.currentTarget)setShowPolicyModal(false);}}>
            <motion.div initial={{ scale:.96 }} animate={{ scale:1 }} exit={{ scale:.96 }} onClick={e=>e.stopPropagation()}
              style={{ background:'#fff', borderRadius:18, width:'100%', maxWidth:460, padding:24, maxHeight:'88vh', overflowY:'auto' }}>
              <h3 style={{ fontSize:17, fontWeight:800, margin:'0 0 16px' }}>🛡️ Add Insurance Policy</h3>
              <form onSubmit={submitPolicy}>
                <div style={{ marginBottom:11 }}><label style={lbl}>Insurance Provider *</label><input style={inp} required value={policyForm.provider} onChange={e=>setPolicyForm(f=>({...f,provider:e.target.value}))} placeholder="e.g. Star Health, HDFC ERGO" /></div>
                <div style={{ marginBottom:11 }}><label style={lbl}>Policy Number *</label><input style={inp} required value={policyForm.policyNumber} onChange={e=>setPolicyForm(f=>({...f,policyNumber:e.target.value}))} /></div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:11 }}>
                  <div><label style={lbl}>Policy Type</label>
                    <select style={inp} value={policyForm.policyType} onChange={e=>setPolicyForm(f=>({...f,policyType:e.target.value}))}>
                      <option value="individual">Individual</option><option value="family">Family</option><option value="corporate">Corporate</option><option value="government">Government</option>
                    </select>
                  </div>
                  <div><label style={lbl}>Sum Insured (₹) *</label><input style={inp} type="number" required min="1" value={policyForm.sumInsured} onChange={e=>setPolicyForm(f=>({...f,sumInsured:e.target.value}))} /></div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:11 }}>
                  <div><label style={lbl}>Valid From *</label><input style={inp} type="date" required value={policyForm.validFrom} onChange={e=>setPolicyForm(f=>({...f,validFrom:e.target.value}))} /></div>
                  <div><label style={lbl}>Valid Till *</label><input style={inp} type="date" required value={policyForm.validTill} onChange={e=>setPolicyForm(f=>({...f,validTill:e.target.value}))} /></div>
                </div>
                <div style={{ marginBottom:11 }}><label style={lbl}>Notes (optional)</label><textarea style={inp} rows={2} value={policyForm.notes} onChange={e=>setPolicyForm(f=>({...f,notes:e.target.value}))} /></div>
                <div style={{ marginBottom:16 }}><label style={lbl}>Card Image (optional)</label><input style={inp} type="file" accept="image/*" onChange={e=>setPolicyForm(f=>({...f,cardImage:e.target.files[0]}))} /></div>
                <div style={{ display:'flex', gap:9 }}>
                  <button type="button" onClick={()=>setShowPolicyModal(false)} style={{ flex:1, padding:11, borderRadius:12, border:'1.5px solid #e2e8f0', background:'#fff', fontFamily:'inherit', fontWeight:700, cursor:'pointer' }}>Cancel</button>
                  <button type="submit" disabled={savingPolicy} style={{ flex:2, padding:11, borderRadius:12, border:'none', background:'linear-gradient(135deg,#7c3aed,#6366f1)', color:'#fff', fontFamily:'inherit', fontWeight:800, cursor:'pointer', fontSize:14 }}>{savingPolicy?'Saving…':'✓ Save Policy'}</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── SUBMIT CLAIM MODAL ── */}
      <AnimatePresence>
        {showClaimModal && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:16, overflowY:'auto' }}
            onClick={e=>{if(e.target===e.currentTarget)setShowClaimModal(false);}}>
            <motion.div initial={{ scale:.96 }} animate={{ scale:1 }} exit={{ scale:.96 }} onClick={e=>e.stopPropagation()}
              style={{ background:'#fff', borderRadius:18, width:'100%', maxWidth:460, padding:24, maxHeight:'88vh', overflowY:'auto' }}>
              <h3 style={{ fontSize:17, fontWeight:800, margin:'0 0 16px' }}>🧾 Submit Insurance Claim</h3>
              <form onSubmit={submitClaim}>
                <div style={{ marginBottom:11 }}><label style={lbl}>Policy *</label>
                  <select style={inp} required value={claimForm.policyId} onChange={e=>setClaimForm(f=>({...f,policyId:e.target.value}))}>
                    {validPolicies.map(p => <option key={p._id} value={p._id}>{p.provider} — {p.policyNumber} (Sum Insured {INR(p.sumInsured)})</option>)}
                  </select>
                </div>
                <div style={{ marginBottom:11 }}><label style={lbl}>Related Appointment (optional)</label>
                  <select style={inp} value={claimForm.appointmentId} onChange={e=>setClaimForm(f=>({...f,appointmentId:e.target.value}))}>
                    <option value="">— None —</option>
                    {appointments.map(a => <option key={a._id} value={a._id}>{a.appointmentNumber || a._id.slice(-6)} — {new Date(a.date).toLocaleDateString('en-IN')}</option>)}
                  </select>
                </div>
                <div style={{ marginBottom:11 }}><label style={lbl}>Claim Amount (₹) *</label><input style={inp} type="number" required min="1" value={claimForm.claimAmount} onChange={e=>setClaimForm(f=>({...f,claimAmount:e.target.value}))} /></div>
                <div style={{ marginBottom:11 }}><label style={lbl}>Reason / Diagnosis *</label><textarea style={inp} rows={3} required value={claimForm.reason} onChange={e=>setClaimForm(f=>({...f,reason:e.target.value}))} placeholder="Describe the treatment/diagnosis this claim is for" /></div>
                <div style={{ marginBottom:16 }}>
                  <label style={lbl}>Supporting Documents (bills, prescriptions, reports) *</label>
                  <input style={inp} type="file" multiple required accept="image/*,application/pdf" onChange={e=>setClaimForm(f=>({...f,documents:Array.from(e.target.files)}))} />
                  <div style={{ fontSize:11, color:'#94a3b8', marginTop:4 }}>At least one document is required for the claim to be reviewed.</div>
                </div>
                <div style={{ display:'flex', gap:9 }}>
                  <button type="button" onClick={()=>setShowClaimModal(false)} style={{ flex:1, padding:11, borderRadius:12, border:'1.5px solid #e2e8f0', background:'#fff', fontFamily:'inherit', fontWeight:700, cursor:'pointer' }}>Cancel</button>
                  <button type="submit" disabled={savingClaim} style={{ flex:2, padding:11, borderRadius:12, border:'none', background:'linear-gradient(135deg,#7c3aed,#6366f1)', color:'#fff', fontFamily:'inherit', fontWeight:800, cursor:'pointer', fontSize:14 }}>{savingClaim?'Submitting…':'✓ Submit Claim'}</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── VIEW CLAIM MODAL ── */}
      <AnimatePresence>
        {viewClaim && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:16, overflowY:'auto' }}
            onClick={e=>{if(e.target===e.currentTarget)setViewClaim(null);}}>
            <motion.div initial={{ scale:.96 }} animate={{ scale:1 }} exit={{ scale:.96 }} onClick={e=>e.stopPropagation()}
              style={{ background:'#fff', borderRadius:18, width:'100%', maxWidth:440, padding:24, maxHeight:'88vh', overflowY:'auto' }}>
              <h3 style={{ fontSize:17, fontWeight:800, margin:'0 0 4px' }}>🧾 Claim Details</h3>
              <div style={{ fontSize:12.5, color:'#94a3b8', marginBottom:16 }}>{viewClaim.policy?.provider} — {viewClaim.policy?.policyNumber}</div>
              <div style={{ display:'flex', flexDirection:'column', gap:10, fontSize:13.5 }}>
                <Row label="Status"><span style={{ padding:'3px 10px', borderRadius:20, fontSize:11.5, fontWeight:700, background:(CLAIM_STATUS[viewClaim.status]||CLAIM_STATUS.submitted).bg, color:(CLAIM_STATUS[viewClaim.status]||CLAIM_STATUS.submitted).c }}>{(CLAIM_STATUS[viewClaim.status]||CLAIM_STATUS.submitted).label}</span></Row>
                <Row label="Claim Amount">{INR(viewClaim.claimAmount)}</Row>
                <Row label="Approved Amount">{viewClaim.approvedAmount != null ? INR(viewClaim.approvedAmount) : '— (pending review)'}</Row>
                <Row label="Reason">{viewClaim.reason}</Row>
                {viewClaim.reviewNotes && <Row label="Reviewer Notes">{viewClaim.reviewNotes}</Row>}
                <Row label="Submitted On">{new Date(viewClaim.createdAt).toLocaleString('en-IN')}</Row>
                {viewClaim.reviewedAt && <Row label="Reviewed On">{new Date(viewClaim.reviewedAt).toLocaleString('en-IN')}</Row>}
                {viewClaim.paidAt && <Row label="Paid On">{new Date(viewClaim.paidAt).toLocaleString('en-IN')}</Row>}
                {viewClaim.documents?.length > 0 && (
                  <Row label="Documents">
                    <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                      {viewClaim.documents.map((d,i) => <a key={i} href={d} target="_blank" rel="noreferrer" style={{ color:'#1d4ed8', fontWeight:700, fontSize:12.5, textDecoration:'none' }}>📎 Document {i+1}</a>)}
                    </div>
                  </Row>
                )}
              </div>
              <button onClick={()=>setViewClaim(null)} style={{ width:'100%', marginTop:18, padding:11, borderRadius:12, border:'1.5px solid #e2e8f0', background:'#fff', fontFamily:'inherit', fontWeight:700, cursor:'pointer' }}>Close</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div>
      <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:.4, marginBottom:2 }}>{label}</div>
      <div style={{ color:'#0f172a' }}>{children}</div>
    </div>
  );
}
