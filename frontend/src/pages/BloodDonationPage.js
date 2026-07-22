import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { bloodBankAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { getSocket } from '../utils/socket';
import toast from 'react-hot-toast';

const STATUS_CFG = {
  requested: { label:'Requested', c:'#d97706', bg:'#fef3c7' },
  scheduled: { label:'Scheduled', c:'#2563eb', bg:'#eff6ff' },
  completed: { label:'Completed', c:'#059669', bg:'#f0fdf4' },
  cancelled: { label:'Cancelled', c:'#64748b', bg:'#f8fafc' },
  rejected:  { label:'Rejected',  c:'#dc2626', bg:'#fef2f2' },
};

const BLOOD_GROUPS = ['A+','A-','B+','B-','AB+','AB-','O+','O-'];

const RELATIVE_TEMPLATE = { name:'', age:'', gender:'', relation:'', phone:'', bloodGroup:'', address:'', idProofType:'', idProofNumber:'' };
const DECLARATION_TEMPLATE = { ageConfirmed:false, weightAbove45:false, noRecentIllness:false, noChronicDisease:false, noRecentDonation:false };

const DECLARATION_LABELS = {
  ageConfirmed:     "The donor is between 18 and 65 years old",
  weightAbove45:    "The donor weighs at least 45kg",
  noRecentIllness:  "The donor has had no fever/infection in the last 14 days",
  noChronicDisease: "The donor has no known HIV, Hepatitis, cancer, heart or kidney disease",
  noRecentDonation: "The donor has not donated blood in the last 90 days",
};

function EligibilityBanner({ eligibility, loading }) {
  if (loading) return null;
  if (!eligibility) return null;
  const { eligible, reasons, warnings, disclaimer } = eligibility;
  return (
    <div className="card" style={{ marginBottom:22, border: eligible ? '1px solid #bbf7d0' : '1px solid #fecaca' }}>
      <div className="card-body">
        <div style={{ display:'flex', alignItems:'center', gap:8, fontWeight:800, fontSize:14, color: eligible ? '#059669' : '#dc2626' }}>
          {eligible ? '✅ Based on your hospital records, you look eligible to donate' : '⚠️ Based on your hospital records, you may not be eligible to donate right now'}
        </div>
        {reasons?.length > 0 && (
          <ul style={{ margin:'10px 0 0', paddingLeft:20, fontSize:12.5, color:'#b91c1c' }}>
            {reasons.map((r,i) => <li key={i} style={{ marginBottom:4 }}>{r}</li>)}
          </ul>
        )}
        {warnings?.length > 0 && (
          <ul style={{ margin:'10px 0 0', paddingLeft:20, fontSize:12.5, color:'#92400e' }}>
            {warnings.map((w,i) => <li key={i} style={{ marginBottom:4 }}>{w}</li>)}
          </ul>
        )}
        {disclaimer && <div style={{ fontSize:10.5, color:'#94a3b8', marginTop:10 }}>{disclaimer}</div>}
      </div>
    </div>
  );
}

export default function BloodDonationPage() {
  const { user, verifyUser } = useAuth();
  const [donations, setDonations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [eligibility, setEligibility] = useState(null);
  const [eligLoading, setEligLoading] = useState(true);
  const [showDonate, setShowDonate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);

  const [donorType, setDonorType] = useState('self');
  const [form, setForm] = useState({ bloodGroup:'', preferredDate:'', contactPhone:'', notes:'' });
  const [relative, setRelative] = useState(RELATIVE_TEMPLATE);
  const [declaration, setDeclaration] = useState(DECLARATION_TEMPLATE);

  // Confirmation prompt shown when the patient tries to submit a blood
  // group different from the one already on file for their account.
  const [confirmChange, setConfirmChange] = useState(null); // { current, requested } | null

  const load = () => {
    setLoading(true);
    bloodBankAPI.getMyDonations()
      .then(res => setDonations(res.data.data || []))
      .catch(()=>{}).finally(()=>setLoading(false));
  };
  const loadEligibility = () => {
    setEligLoading(true);
    bloodBankAPI.getEligibility()
      .then(res => setEligibility(res.data.data))
      .catch(()=>{}).finally(()=>setEligLoading(false));
  };
  useEffect(() => { load(); loadEligibility(); }, []);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onScheduled = () => load();
    socket.on('blood_donation_scheduled', onScheduled);
    return () => socket.off('blood_donation_scheduled', onScheduled);
  }, []);

  const openDonateModal = () => {
    // Blood group is auto-filled from the hospital account whenever it's
    // already on file — the patient only ever has to type it once, the
    // very first time (if it wasn't captured at registration).
    setForm(f => ({ ...f, bloodGroup: user?.bloodGroup || '' }));
    setDonorType('self');
    setRelative(RELATIVE_TEMPLATE);
    setDeclaration(DECLARATION_TEMPLATE);
    setConfirmChange(null);
    setShowDonate(true);
  };

  const buildPayload = (confirmBloodGroupChange = false) => {
    const payload = { preferredDate: form.preferredDate, contactPhone: form.contactPhone, notes: form.notes, donorType };
    if (donorType === 'self') {
      payload.bloodGroup = form.bloodGroup;
      if (confirmBloodGroupChange) payload.confirmBloodGroupChange = true;
    } else {
      payload.relative = relative;
      payload.selfDeclaration = declaration;
    }
    return payload;
  };

  const doSubmit = async (payload) => {
    setSaving(true);
    try {
      await bloodBankAPI.donate(payload);
      toast.success('🩸 Thank you! Your donation request has been submitted.');
      setShowDonate(false);
      setConfirmChange(null);
      await verifyUser(); // pick up a newly-saved blood group, if this was the first time it was set
      load();
      loadEligibility();
    } catch (err) {
      const data = err.response?.data;
      if (data?.requiresConfirmation) {
        setConfirmChange({ current: data.currentBloodGroup, requested: data.requestedBloodGroup });
      } else if (data?.eligibility) {
        toast.error(data.error || 'Not eligible to donate right now', { duration: 6000 });
        setEligibility(data.eligibility);
      } else {
        toast.error(data?.error || 'Failed to submit request');
      }
    }
    setSaving(false);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.preferredDate) { toast.error('Preferred date is required'); return; }
    if (donorType === 'self' && !form.bloodGroup) { toast.error('Blood group is required'); return; }
    if (donorType === 'other') {
      const req = ['name','age','relation','phone','bloodGroup','idProofType','idProofNumber'];
      if (req.some(k => !relative[k])) { toast.error("Please fill in all of the donor's required details"); return; }
      if (Object.values(declaration).some(v => v !== true)) { toast.error("Please confirm all of the donor's eligibility declarations"); return; }
    }
    await doSubmit(buildPayload(false));
  };

  const confirmBloodGroupSwitch = async () => {
    await doSubmit(buildPayload(true));
  };

  const downloadCertificate = async (id) => {
    setDownloadingId(id);
    try {
      const res = await bloodBankAPI.getCertificateBlob(id);
      const url = window.URL.createObjectURL(new Blob([res.data], { type:'application/pdf' }));
      window.open(url, '_blank');
    } catch { toast.error('Failed to load certificate'); }
    setDownloadingId(null);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">🩸 Blood Donation</div>
          <div className="page-subtitle">Your own donation history — donate yourself or register a relative/colleague</div>
        </div>
        <button className="btn btn-primary" onClick={openDonateModal}>+ Donate Blood</button>
      </div>

      <EligibilityBanner eligibility={eligibility} loading={eligLoading} />

      {loading ? (
        <div style={{ textAlign:'center', padding:60, color:'#94a3b8' }}>Loading…</div>
      ) : (
        <div className="card">
          <div className="card-header"><span className="card-title">My Donation History</span></div>
          <div className="card-body">
            {donations.length === 0 ? (
              <div style={{ textAlign:'center', padding:20, color:'#94a3b8', fontSize:13 }}>You haven't requested to donate yet.</div>
            ) : donations.map(d => {
              const cfg = STATUS_CFG[d.status];
              const displayName = d.donorType === 'other' && d.relative?.name ? `${d.relative.name} (${d.relative.relation})` : 'Yourself';
              return (
                <div key={d._id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 14px', background:cfg.bg, borderRadius:10, marginBottom:8 }}>
                  <div>
                    <div style={{ fontWeight:700, fontSize:13.5 }}>{d.bloodGroup} · {new Date(d.preferredDate).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</div>
                    <div style={{ fontSize:11, color:'#64748b', marginTop:1 }}>Donor: {displayName}</div>
                    {d.status==='scheduled' && d.scheduledDate && (
                      <div style={{ fontSize:11.5, color:'#2563eb', marginTop:2, fontWeight:700 }}>
                        📅 Scheduled: {new Date(d.scheduledDate).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})} at {new Date(d.scheduledDate).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}
                      </div>
                    )}
                    {d.status==='completed' && <div style={{ fontSize:11.5, color:'#059669', marginTop:2 }}>✅ {d.unitsCollected} unit{d.unitsCollected>1?'s':''} collected on {new Date(d.completedAt).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</div>}
                    {d.status==='rejected' && d.rejectionReason && <div style={{ fontSize:11.5, color:'#dc2626', marginTop:2 }}>{d.rejectionReason}</div>}
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <span style={{ fontSize:11, fontWeight:800, color:cfg.c }}>{cfg.label}</span>
                    {d.status==='completed' && (
                      <button className="btn btn-primary btn-sm" disabled={downloadingId===d._id} onClick={()=>downloadCertificate(d._id)}>
                        {downloadingId===d._id ? 'Loading…' : '📜 Certificate'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <AnimatePresence>
        {showDonate && (
          <div className="modal-overlay" onClick={e=>{ if(e.target===e.currentTarget) setShowDonate(false); }}>
            <motion.div className="modal-box" style={{ maxWidth:480 }} initial={{ opacity:0,y:20,scale:.97 }} animate={{ opacity:1,y:0,scale:1 }}>
              <div className="modal-header"><span className="modal-title">🩸 Donate Blood</span><button className="btn btn-ghost btn-icon" onClick={()=>setShowDonate(false)}>✕</button></div>
              <form onSubmit={submit}>
                <div className="modal-body">

                  <div style={{ display:'flex', gap:8, marginBottom:16 }}>
                    <button type="button" onClick={()=>setDonorType('self')}
                      style={{ flex:1, padding:'8px 10px', borderRadius:8, border:'1.5px solid', borderColor:donorType==='self'?'#7a1f2b':'#e2e8f0', background:donorType==='self'?'#fbf0f1':'#fff', color:donorType==='self'?'#7a1f2b':'#64748b', fontWeight:700, fontSize:12.5, cursor:'pointer' }}>
                      I'll donate myself
                    </button>
                    <button type="button" onClick={()=>setDonorType('other')}
                      style={{ flex:1, padding:'8px 10px', borderRadius:8, border:'1.5px solid', borderColor:donorType==='other'?'#7a1f2b':'#e2e8f0', background:donorType==='other'?'#fbf0f1':'#fff', color:donorType==='other'?'#7a1f2b':'#64748b', fontWeight:700, fontSize:12.5, cursor:'pointer' }}>
                      Register a relative/colleague
                    </button>
                  </div>

                  {donorType === 'self' ? (
                    <div className="form-group">
                      <label className="form-label">Blood Group *</label>
                      {user?.bloodGroup ? (
                        <>
                          <input className="form-input" disabled value={form.bloodGroup} style={{ background:'#f8fafc' }} />
                          <div style={{ fontSize:11, color:'#64748b', marginTop:4 }}>Your blood group on file is <strong>{user.bloodGroup}</strong>.</div>
                        </>
                      ) : (
                        <>
                          <select className="form-input" required value={form.bloodGroup} onChange={e=>setForm(f=>({...f,bloodGroup:e.target.value}))}>
                            <option value="">— Select —</option>
                            {BLOOD_GROUPS.map(g=><option key={g}>{g}</option>)}
                          </select>
                          <div style={{ fontSize:11, color:'#94a3b8', marginTop:4 }}>No blood group on file yet — whatever you select here will be saved as your official hospital blood group.</div>
                        </>
                      )}
                    </div>
                  ) : (
                    <>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                        <div className="form-group"><label className="form-label">Donor's Name *</label><input className="form-input" required value={relative.name} onChange={e=>setRelative(r=>({...r,name:e.target.value}))} /></div>
                        <div className="form-group"><label className="form-label">Relation *</label><input className="form-input" required placeholder="e.g. Brother, Colleague" value={relative.relation} onChange={e=>setRelative(r=>({...r,relation:e.target.value}))} /></div>
                        <div className="form-group"><label className="form-label">Age *</label><input type="number" min="18" max="65" className="form-input" required value={relative.age} onChange={e=>setRelative(r=>({...r,age:e.target.value}))} /></div>
                        <div className="form-group"><label className="form-label">Gender</label>
                          <select className="form-input" value={relative.gender} onChange={e=>setRelative(r=>({...r,gender:e.target.value}))}>
                            <option value="">—</option><option>Male</option><option>Female</option><option>Other</option>
                          </select>
                        </div>
                        <div className="form-group"><label className="form-label">Phone *</label><input className="form-input" required value={relative.phone} onChange={e=>setRelative(r=>({...r,phone:e.target.value}))} /></div>
                        <div className="form-group"><label className="form-label">Blood Group *</label>
                          <select className="form-input" required value={relative.bloodGroup} onChange={e=>setRelative(r=>({...r,bloodGroup:e.target.value}))}>
                            <option value="">— Select —</option>
                            {BLOOD_GROUPS.map(g=><option key={g}>{g}</option>)}
                          </select>
                        </div>
                        <div className="form-group" style={{ gridColumn:'1 / -1' }}><label className="form-label">Address</label><input className="form-input" value={relative.address} onChange={e=>setRelative(r=>({...r,address:e.target.value}))} /></div>
                        <div className="form-group"><label className="form-label">ID Proof Type *</label>
                          <select className="form-input" required value={relative.idProofType} onChange={e=>setRelative(r=>({...r,idProofType:e.target.value}))}>
                            <option value="">— Select —</option>
                            <option value="aadhaar">Aadhaar</option><option value="pan">PAN</option>
                            <option value="passport">Passport</option><option value="voter_id">Voter ID</option>
                            <option value="driving_license">Driving License</option>
                          </select>
                        </div>
                        <div className="form-group"><label className="form-label">ID Proof Number *</label><input className="form-input" required value={relative.idProofNumber} onChange={e=>setRelative(r=>({...r,idProofNumber:e.target.value}))} /></div>
                      </div>

                      <div style={{ marginTop:6, marginBottom:6, fontSize:12.5, fontWeight:700, color:'#374151' }}>Please confirm, to the best of your knowledge:</div>
                      <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:6 }}>
                        {Object.keys(DECLARATION_TEMPLATE).map(key => (
                          <label key={key} style={{ display:'flex', alignItems:'flex-start', gap:8, fontSize:12, color:'#475569', cursor:'pointer' }}>
                            <input type="checkbox" checked={declaration[key]} onChange={e=>setDeclaration(d=>({...d,[key]:e.target.checked}))} style={{ marginTop:2 }} />
                            <span>{DECLARATION_LABELS[key]}</span>
                          </label>
                        ))}
                      </div>
                      <div style={{ fontSize:10.5, color:'#94a3b8', marginBottom:10 }}>Hospital staff will still perform an in-person medical check before the donation is accepted.</div>
                    </>
                  )}

                  <div className="form-group"><label className="form-label">Preferred Date *</label><input type="date" className="form-input" required min={new Date().toISOString().slice(0,10)} value={form.preferredDate} onChange={e=>setForm(f=>({...f,preferredDate:e.target.value}))} /></div>
                  <div className="form-group"><label className="form-label">Contact Phone</label><input className="form-input" value={form.contactPhone} onChange={e=>setForm(f=>({...f,contactPhone:e.target.value}))} /></div>
                  <div className="form-group"><label className="form-label">Notes</label><textarea className="form-input" rows={2} value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Anything else staff should know" /></div>
                  <div style={{ fontSize:11, color:'#94a3b8' }}>Our staff will review your request and confirm a schedule with you.</div>
                </div>
                <div className="modal-footer"><button type="button" className="btn btn-outline" onClick={()=>setShowDonate(false)}>Cancel</button><button type="submit" className="btn btn-primary" disabled={saving}>{saving?'Submitting…':'Submit Request'}</button></div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {confirmChange && (
          <div className="modal-overlay" onClick={e=>{ if(e.target===e.currentTarget) setConfirmChange(null); }}>
            <motion.div className="modal-box" style={{ maxWidth:380 }} initial={{ opacity:0,y:20,scale:.97 }} animate={{ opacity:1,y:0,scale:1 }}>
              <div className="modal-header"><span className="modal-title">Confirm Blood Group Change</span></div>
              <div className="modal-body">
                <p style={{ fontSize:13.5 }}>Your blood group on file is <strong>{confirmChange.current}</strong>. Do you want to change it to <strong>{confirmChange.requested}</strong>?</p>
                <div style={{ fontSize:11, color:'#94a3b8' }}>This will update your official hospital record.</div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={()=>setConfirmChange(null)}>Cancel</button>
                <button type="button" className="btn btn-primary" disabled={saving} onClick={confirmBloodGroupSwitch}>{saving?'Saving…':'Yes, change it'}</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
