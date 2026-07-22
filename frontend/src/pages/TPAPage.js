import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { tpaAPI, usersAPI, insuranceAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const inp = { width:'100%', padding:'9px 12px', border:'1.5px solid #e2e8f0', borderRadius:9, fontSize:13.5, outline:'none', fontFamily:'inherit', background:'#fff' };
const lbl = { display:'block', fontSize:11.5, fontWeight:700, color:'#374151', marginBottom:5 };
const INR = n => `₹${Number(n||0).toLocaleString('en-IN')}`;
const STATUS_CFG = {
  submitted:{bg:'#eff6ff',c:'#1d4ed8',label:'📤 Submitted'}, query_raised:{bg:'#fef3c7',c:'#92400e',label:'❓ Query Raised'},
  approved:{bg:'#dcfce7',c:'#15803d',label:'✅ Approved'}, partially_approved:{bg:'#e0f2fe',c:'#0369a1',label:'◐ Partially Approved'},
  rejected:{bg:'#fee2e2',c:'#dc2626',label:'✕ Rejected'}, expired:{bg:'#f1f5f9',c:'#94a3b8',label:'⏱️ Expired/Cancelled'},
};

export default function TPAPage() {
  const { user } = useAuth();
  const isStaff = ['admin','finance'].includes(user?.role);
  const canSubmitPreAuth = ['admin','finance','receptionist','doctor'].includes(user?.role);
  const [tab, setTab] = useState('preauth');

  const [preAuths, setPreAuths] = useState([]);
  const [paLoading, setPaLoading] = useState(true);
  const [paStatusFilter, setPaStatusFilter] = useState('');

  const [providers, setProviders] = useState([]);
  const [provLoading, setProvLoading] = useState(true);

  const [patients, setPatients] = useState([]);
  const [patientPolicies, setPatientPolicies] = useState([]);

  const [showPAModal, setShowPAModal] = useState(false);
  const [paForm, setPaForm] = useState({ patientId:'', policyId:'', tpaProviderId:'', diagnosis:'', treatmentPlan:'', estimatedAmount:'' });
  const [creatingPA, setCreatingPA] = useState(false);

  const [respondFor, setRespondFor] = useState(null);
  const [respondForm, setRespondForm] = useState({ decision:'approve', approvedAmount:'', queryNote:'', rejectionReason:'', tpaReferenceNumber:'', validTill:'' });
  const [responding, setResponding] = useState(false);

  const [showProviderModal, setShowProviderModal] = useState(false);
  const [providerForm, setProviderForm] = useState({ name:'', tpaCode:'', contactPerson:'', contactPhone:'', contactEmail:'', address:'' });
  const [savingProvider, setSavingProvider] = useState(false);

  const [rateModalFor, setRateModalFor] = useState(null);
  const [rateForm, setRateForm] = useState({ procedureName:'', negotiatedRate:'', notes:'' });
  const [savingRate, setSavingRate] = useState(false);

  const loadPreAuths = useCallback(() => {
    setPaLoading(true);
    tpaAPI.getPreAuths(paStatusFilter ? { status: paStatusFilter } : {}).then(r => setPreAuths(r.data.data||[])).catch(()=>toast.error('Failed to load pre-authorizations')).finally(()=>setPaLoading(false));
  }, [paStatusFilter]);
  useEffect(() => { loadPreAuths(); }, [loadPreAuths]);

  const loadProviders = useCallback(() => {
    setProvLoading(true);
    tpaAPI.getProviders(true).then(r => setProviders(r.data.data||[])).catch(()=>toast.error('Failed to load TPA providers')).finally(()=>setProvLoading(false));
  }, []);
  useEffect(() => { if (tab === 'providers') loadProviders(); }, [tab, loadProviders]);
  useEffect(() => { tpaAPI.getProviders().then(r=>setProviders(r.data.data||[])).catch(()=>{}); }, []);

  const openPAModal = async () => {
    if (patients.length === 0) {
      try { const r = await usersAPI.getAll({ role:'patient', status:'approved', limit:300 }); setPatients(r.data.data||[]); } catch {}
    }
    setPaForm({ patientId:'', policyId:'', tpaProviderId:'', diagnosis:'', treatmentPlan:'', estimatedAmount:'' });
    setPatientPolicies([]);
    setShowPAModal(true);
  };

  const onPAPatientChange = async (patientId) => {
    setPaForm(f => ({ ...f, patientId, policyId:'' }));
    try {
      const r = await insuranceAPI.getPatientPolicies(patientId);
      setPatientPolicies(r.data.data || []);
    } catch { setPatientPolicies([]); }
  };

  const submitPA = async (e) => {
    e.preventDefault();
    if (!paForm.patientId || !paForm.policyId || !paForm.diagnosis.trim() || !paForm.estimatedAmount) {
      toast.error('Patient, policy, diagnosis, and estimated amount are required'); return;
    }
    setCreatingPA(true);
    try {
      await tpaAPI.createPreAuth({
        patientId: paForm.patientId, policyId: paForm.policyId, tpaProviderId: paForm.tpaProviderId || undefined,
        diagnosis: paForm.diagnosis.trim(), treatmentPlan: paForm.treatmentPlan.trim(), estimatedAmount: Number(paForm.estimatedAmount),
      });
      toast.success('✅ Pre-authorization submitted');
      setShowPAModal(false);
      loadPreAuths();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to submit pre-authorization'); }
    setCreatingPA(false);
  };

  const openRespond = (pa) => { setRespondFor(pa); setRespondForm({ decision:'approve', approvedAmount: pa.estimatedAmount, queryNote:'', rejectionReason:'', tpaReferenceNumber: pa.tpaReferenceNumber||'', validTill:'' }); };
  const submitRespond = async () => {
    setResponding(true);
    try {
      await tpaAPI.respondToPreAuth(respondFor._id, respondForm.decision, {
        approvedAmount: respondForm.approvedAmount || undefined, queryNote: respondForm.queryNote, rejectionReason: respondForm.rejectionReason,
        tpaReferenceNumber: respondForm.tpaReferenceNumber, validTill: respondForm.validTill || undefined,
      });
      toast.success('✅ Pre-authorization updated');
      setRespondFor(null);
      loadPreAuths();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to update'); }
    setResponding(false);
  };

  const cancelPA = async (pa) => {
    if (!window.confirm('Cancel/expire this pre-authorization?')) return;
    try { await tpaAPI.cancelPreAuth(pa._id); toast.success('Cancelled'); loadPreAuths(); }
    catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
  };

  const submitProvider = async (e) => {
    e.preventDefault();
    if (!providerForm.name.trim()) { toast.error('Provider name is required'); return; }
    setSavingProvider(true);
    try {
      await tpaAPI.createProvider(providerForm);
      toast.success('✅ TPA provider added');
      setShowProviderModal(false);
      setProviderForm({ name:'', tpaCode:'', contactPerson:'', contactPhone:'', contactEmail:'', address:'' });
      loadProviders();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to add provider'); }
    setSavingProvider(false);
  };

  const submitRate = async (e) => {
    e.preventDefault();
    if (!rateForm.procedureName.trim() || !rateForm.negotiatedRate) { toast.error('Procedure name and rate are required'); return; }
    setSavingRate(true);
    try {
      await tpaAPI.addRate(rateModalFor._id, rateForm);
      toast.success('✅ Rate added');
      setRateForm({ procedureName:'', negotiatedRate:'', notes:'' });
      const r = await tpaAPI.getProviders(true); setProviders(r.data.data||[]);
      setRateModalFor(r.data.data.find(p=>p._id===rateModalFor._id));
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to add rate'); }
    setSavingRate(false);
  };

  const removeRate = async (provider, rateId) => {
    try { await tpaAPI.deleteRate(provider._id, rateId); toast.success('Rate removed'); const r = await tpaAPI.getProviders(true); setProviders(r.data.data||[]); setRateModalFor(r.data.data.find(p=>p._id===provider._id)); }
    catch { toast.error('Failed to remove rate'); }
  };

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">🛡️ TPA & Insurance</div><div className="page-subtitle">Cashless pre-authorization and negotiated TPA rate management</div></div>
        {tab === 'preauth' && canSubmitPreAuth && <button className="btn btn-primary" onClick={openPAModal}>+ New Pre-Authorization</button>}
        {tab === 'providers' && isStaff && <button className="btn btn-primary" onClick={()=>setShowProviderModal(true)}>+ New TPA/Provider</button>}
      </div>

      <div style={{ display:'flex', gap:6, marginBottom:18 }}>
        {[['preauth','🛡️ Pre-Authorizations'],['providers','🏢 TPA Providers & Rates']].map(([k,l]) => (
          <button key={k} onClick={()=>setTab(k)} style={{ padding:'9px 16px', borderRadius:11, border:'none', background:tab===k?'#eef2ff':'#f8fafc', color:tab===k?'#4338ca':'#64748b', fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>{l}</button>
        ))}
      </div>

      {tab === 'preauth' && (
        <div>
          <div style={{ display:'flex', gap:6, marginBottom:16, flexWrap:'wrap' }}>
            {[['','All'],['submitted','Submitted'],['query_raised','Query Raised'],['approved','Approved'],['partially_approved','Partial'],['rejected','Rejected'],['expired','Expired']].map(([k,l]) => (
              <button key={k} onClick={()=>setPaStatusFilter(k)} style={{ padding:'6px 12px', borderRadius:9, border:'1px solid #e2e8f0', background:paStatusFilter===k?'#eef2ff':'#fff', color:paStatusFilter===k?'#4338ca':'#64748b', fontWeight:600, fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>{l}</button>
            ))}
          </div>
          {paLoading ? (
            <div style={{ textAlign:'center', padding:60, color:'#94a3b8' }}>Loading…</div>
          ) : preAuths.length === 0 ? (
            <div className="card"><div className="card-body" style={{ textAlign:'center', padding:40, color:'#94a3b8' }}>No pre-authorization requests yet</div></div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {preAuths.map(pa => {
                const cfg = STATUS_CFG[pa.status] || STATUS_CFG.submitted;
                return (
                  <div key={pa._id} className="card">
                    <div className="card-body">
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6, flexWrap:'wrap', gap:6 }}>
                        <div>
                          <div style={{ fontWeight:800, fontSize:14 }}>{pa.preAuthNumber} — {pa.patient?.name}</div>
                          <div style={{ fontSize:11.5, color:'#64748b' }}>{pa.policy?.provider} ({pa.policy?.policyNumber}){pa.tpaProvider?.name && ` · via ${pa.tpaProvider.name}`}</div>
                        </div>
                        <span style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700, background:cfg.bg, color:cfg.c, height:'fit-content' }}>{cfg.label}</span>
                      </div>
                      <div style={{ fontSize:12.5, color:'#374151', marginBottom:4 }}>🩺 {pa.diagnosis}</div>
                      {pa.treatmentPlan && <div style={{ fontSize:11.5, color:'#64748b', marginBottom:4 }}>{pa.treatmentPlan}</div>}
                      <div style={{ fontSize:13, marginBottom:6 }}>Estimated: <strong>{INR(pa.estimatedAmount)}</strong>{pa.approvedAmount != null && <> · Approved: <strong style={{ color:'#15803d' }}>{INR(pa.approvedAmount)}</strong></>}</div>
                      {pa.status === 'query_raised' && <div style={{ fontSize:11.5, color:'#92400e', marginBottom:6 }}>❓ {pa.queryNote}</div>}
                      {pa.status === 'rejected' && <div style={{ fontSize:11.5, color:'#dc2626', marginBottom:6 }}>{pa.rejectionReason}</div>}
                      {pa.validTill && ['approved','partially_approved'].includes(pa.status) && <div style={{ fontSize:11, color:'#94a3b8', marginBottom:6 }}>Valid till {new Date(pa.validTill).toLocaleDateString('en-IN')}</div>}
                      <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                        {isStaff && !['approved','partially_approved','rejected'].includes(pa.status) && (
                          <button className="btn btn-primary btn-sm" onClick={()=>openRespond(pa)}>Record TPA Response</button>
                        )}
                        {isStaff && !['approved','partially_approved','rejected','expired'].includes(pa.status) && (
                          <button className="btn btn-outline btn-sm" onClick={()=>cancelPA(pa)}>Cancel</button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'providers' && (
        <div>
          {provLoading ? (
            <div style={{ textAlign:'center', padding:60, color:'#94a3b8' }}>Loading…</div>
          ) : providers.length === 0 ? (
            <div className="card"><div className="card-body" style={{ textAlign:'center', padding:40, color:'#94a3b8' }}>No TPA providers added yet</div></div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:14 }}>
              {providers.map(p => (
                <div key={p._id} className="card" style={{ opacity: p.active?1:0.6 }}>
                  <div className="card-body">
                    <div style={{ fontWeight:800, fontSize:14 }}>{p.name} {p.tpaCode && <span style={{ fontSize:11, color:'#94a3b8', fontWeight:600 }}>({p.tpaCode})</span>}</div>
                    {p.contactPerson && <div style={{ fontSize:11.5, color:'#64748b', marginTop:2 }}>{p.contactPerson} · {p.contactPhone}</div>}
                    <div style={{ fontSize:11.5, color:'#94a3b8', margin:'8px 0' }}>{p.rates.length} negotiated rate{p.rates.length!==1?'s':''}</div>
                    {isStaff && <button className="btn btn-outline btn-sm" onClick={()=>setRateModalFor(p)}>💰 Manage Rates</button>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── NEW PRE-AUTH MODAL ── */}
      <AnimatePresence>
        {showPAModal && (
          <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)setShowPAModal(false);}}>
            <motion.div className="modal-box" style={{ maxWidth:520 }} initial={{opacity:0,y:20}} animate={{opacity:1,y:0}}>
              <div className="modal-header"><span className="modal-title">🛡️ New Pre-Authorization</span><button className="btn btn-ghost btn-icon" onClick={()=>setShowPAModal(false)}>✕</button></div>
              <form onSubmit={submitPA}>
                <div className="modal-body" style={{ maxHeight:'70vh', overflowY:'auto' }}>
                  <div style={{ marginBottom:11 }}><label style={lbl}>Patient *</label>
                    <select style={inp} required value={paForm.patientId} onChange={e=>onPAPatientChange(e.target.value)}>
                      <option value="">— Select patient —</option>
                      {patients.map(p=><option key={p._id} value={p._id}>{p.name} ({p.phone||p.email})</option>)}
                    </select>
                  </div>
                  <div style={{ marginBottom:11 }}>
                    <label style={lbl}>Policy *</label>
                    <select style={inp} required value={paForm.policyId} onChange={e=>setPaForm(f=>({...f,policyId:e.target.value}))} disabled={!paForm.patientId}>
                      <option value="">{paForm.patientId ? (patientPolicies.length ? '— Select policy —' : 'No policies on file for this patient') : '— Select a patient first —'}</option>
                      {patientPolicies.map(p=><option key={p._id} value={p._id} disabled={!p.isValid}>{p.provider} — {p.policyNumber} (Sum Insured {INR(p.sumInsured)}){!p.isValid ? ' — expired' : ''}</option>)}
                    </select>
                  </div>
                  <div style={{ marginBottom:11 }}><label style={lbl}>TPA Provider</label>
                    <select style={inp} value={paForm.tpaProviderId} onChange={e=>setPaForm(f=>({...f,tpaProviderId:e.target.value}))}>
                      <option value="">— Not specified —</option>
                      {providers.map(p=><option key={p._id} value={p._id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div style={{ marginBottom:11 }}><label style={lbl}>Diagnosis *</label><input style={inp} required value={paForm.diagnosis} onChange={e=>setPaForm(f=>({...f,diagnosis:e.target.value}))} /></div>
                  <div style={{ marginBottom:11 }}><label style={lbl}>Treatment Plan</label><textarea style={inp} rows={2} value={paForm.treatmentPlan} onChange={e=>setPaForm(f=>({...f,treatmentPlan:e.target.value}))} /></div>
                  <div><label style={lbl}>Estimated Amount (₹) *</label><input type="number" min="0" style={inp} required value={paForm.estimatedAmount} onChange={e=>setPaForm(f=>({...f,estimatedAmount:e.target.value}))} /></div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-outline" onClick={()=>setShowPAModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={creatingPA}>{creatingPA?'Submitting…':'✓ Submit Pre-Authorization'}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── RESPOND TO PRE-AUTH MODAL ── */}
      <AnimatePresence>
        {respondFor && (
          <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)setRespondFor(null);}}>
            <motion.div className="modal-box" style={{ maxWidth:420 }} initial={{opacity:0,y:20}} animate={{opacity:1,y:0}}>
              <div className="modal-header"><span className="modal-title">Record TPA Response — {respondFor.preAuthNumber}</span><button className="btn btn-ghost btn-icon" onClick={()=>setRespondFor(null)}>✕</button></div>
              <div className="modal-body">
                <div style={{ marginBottom:11 }}><label style={lbl}>Decision</label>
                  <select style={inp} value={respondForm.decision} onChange={e=>setRespondForm(f=>({...f,decision:e.target.value}))}>
                    <option value="approve">✅ Approve (full or partial)</option>
                    <option value="query">❓ Raise Query</option>
                    <option value="reject">✕ Reject</option>
                  </select>
                </div>
                {respondForm.decision === 'approve' && (
                  <>
                    <div style={{ marginBottom:11 }}><label style={lbl}>Approved Amount (₹) *</label><input type="number" min="0" style={inp} value={respondForm.approvedAmount} onChange={e=>setRespondForm(f=>({...f,approvedAmount:e.target.value}))} /></div>
                    <div style={{ marginBottom:11 }}><label style={lbl}>Valid Till</label><input type="date" style={inp} value={respondForm.validTill} onChange={e=>setRespondForm(f=>({...f,validTill:e.target.value}))} /></div>
                  </>
                )}
                {respondForm.decision === 'query' && (
                  <div style={{ marginBottom:11 }}><label style={lbl}>What is the TPA asking for?</label><textarea style={inp} rows={2} value={respondForm.queryNote} onChange={e=>setRespondForm(f=>({...f,queryNote:e.target.value}))} /></div>
                )}
                {respondForm.decision === 'reject' && (
                  <div style={{ marginBottom:11 }}><label style={lbl}>Rejection Reason</label><textarea style={inp} rows={2} value={respondForm.rejectionReason} onChange={e=>setRespondForm(f=>({...f,rejectionReason:e.target.value}))} /></div>
                )}
                <div><label style={lbl}>TPA Reference Number</label><input style={inp} value={respondForm.tpaReferenceNumber} onChange={e=>setRespondForm(f=>({...f,tpaReferenceNumber:e.target.value}))} /></div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-outline" onClick={()=>setRespondFor(null)}>Cancel</button>
                <button className="btn btn-primary" disabled={responding} onClick={submitRespond}>{responding?'Saving…':'✓ Save'}</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── NEW PROVIDER MODAL ── */}
      <AnimatePresence>
        {showProviderModal && (
          <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)setShowProviderModal(false);}}>
            <motion.div className="modal-box" style={{ maxWidth:420 }} initial={{opacity:0,y:20}} animate={{opacity:1,y:0}}>
              <div className="modal-header"><span className="modal-title">🏢 New TPA / Insurance Provider</span><button className="btn btn-ghost btn-icon" onClick={()=>setShowProviderModal(false)}>✕</button></div>
              <form onSubmit={submitProvider}>
                <div className="modal-body">
                  <div style={{ marginBottom:11 }}><label style={lbl}>Name *</label><input style={inp} required value={providerForm.name} onChange={e=>setProviderForm(f=>({...f,name:e.target.value}))} /></div>
                  <div style={{ marginBottom:11 }}><label style={lbl}>TPA Code</label><input style={inp} value={providerForm.tpaCode} onChange={e=>setProviderForm(f=>({...f,tpaCode:e.target.value}))} /></div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:11 }}>
                    <div><label style={lbl}>Contact Person</label><input style={inp} value={providerForm.contactPerson} onChange={e=>setProviderForm(f=>({...f,contactPerson:e.target.value}))} /></div>
                    <div><label style={lbl}>Contact Phone</label><input style={inp} value={providerForm.contactPhone} onChange={e=>setProviderForm(f=>({...f,contactPhone:e.target.value}))} /></div>
                  </div>
                  <div style={{ marginBottom:11 }}><label style={lbl}>Contact Email</label><input style={inp} value={providerForm.contactEmail} onChange={e=>setProviderForm(f=>({...f,contactEmail:e.target.value}))} /></div>
                  <div><label style={lbl}>Address</label><textarea style={inp} rows={2} value={providerForm.address} onChange={e=>setProviderForm(f=>({...f,address:e.target.value}))} /></div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-outline" onClick={()=>setShowProviderModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={savingProvider}>{savingProvider?'Saving…':'✓ Add Provider'}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MANAGE RATES MODAL ── */}
      <AnimatePresence>
        {rateModalFor && (
          <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)setRateModalFor(null);}}>
            <motion.div className="modal-box" style={{ maxWidth:480 }} initial={{opacity:0,y:20}} animate={{opacity:1,y:0}}>
              <div className="modal-header"><span className="modal-title">💰 Rates — {rateModalFor.name}</span><button className="btn btn-ghost btn-icon" onClick={()=>setRateModalFor(null)}>✕</button></div>
              <div className="modal-body" style={{ maxHeight:'60vh', overflowY:'auto' }}>
                {rateModalFor.rates.length === 0 ? (
                  <div style={{ textAlign:'center', color:'#94a3b8', padding:16 }}>No rates added yet</div>
                ) : rateModalFor.rates.map(r => (
                  <div key={r._id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px solid #f1f5f9' }}>
                    <div>
                      <div style={{ fontWeight:700, fontSize:12.5 }}>{r.procedureName}</div>
                      {r.notes && <div style={{ fontSize:11, color:'#94a3b8' }}>{r.notes}</div>}
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ fontWeight:700, color:'#4338ca' }}>{INR(r.negotiatedRate)}</span>
                      <button onClick={()=>removeRate(rateModalFor, r._id)} style={{ background:'none', border:'none', color:'#dc2626', cursor:'pointer' }}>✕</button>
                    </div>
                  </div>
                ))}
                <form onSubmit={submitRate} style={{ marginTop:14, paddingTop:14, borderTop:'1px solid #e2e8f0' }}>
                  <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:8, marginBottom:8 }}>
                    <input placeholder="Procedure name" style={inp} value={rateForm.procedureName} onChange={e=>setRateForm(f=>({...f,procedureName:e.target.value}))} />
                    <input type="number" min="0" placeholder="Rate ₹" style={inp} value={rateForm.negotiatedRate} onChange={e=>setRateForm(f=>({...f,negotiatedRate:e.target.value}))} />
                  </div>
                  <input placeholder="Notes (optional)" style={{...inp, marginBottom:8}} value={rateForm.notes} onChange={e=>setRateForm(f=>({...f,notes:e.target.value}))} />
                  <button type="submit" className="btn btn-primary btn-sm" disabled={savingRate}>{savingRate?'Adding…':'+ Add Rate'}</button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
