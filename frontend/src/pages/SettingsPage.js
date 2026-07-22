import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { authAPI, getFileUrl, hospitalConfigAPI } from '../utils/api';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';

const DEFAULT_PREFS = { appointments:true, reminders:true, emergency:true, salary:true, emailNotifs:true, smsNotifs:false, pushNotifs:true, twoFA:false, autoLogout:true };

export default function SettingsPage() {
  const { user, updateUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') === 'profile' && user?.role !== 'patient') ? 'docs' : 'profile';
  const [tab, setTab] = useState(initialTab);

  const [profile, setProfile] = useState({ name: user?.name||'', phone: user?.phone||'', address: user?.address||'', age: user?.age||'', bloodGroup: user?.bloodGroup||'', weight: user?.weight||'', height: user?.height||'', department: user?.department||'', specialization: user?.specialization||'', bio: user?.bio||'', experienceYears: user?.experienceYears||'' });
  const [degrees, setDegrees] = useState(user?.degrees?.length ? user.degrees : []);
  const [experiences, setExperiences] = useState(user?.experiences?.length ? user.experiences : []);
  const [savingDocsExp, setSavingDocsExp] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const handleAvatarPick = async (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Please choose an image file'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5MB'); return; }
    setUploadingAvatar(true);
    try {
      const res = await authAPI.uploadAvatar(file);
      updateUser(res.data.data);
      toast.success('✅ Profile photo updated!');
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to upload photo'); }
    setUploadingAvatar(false);
  };
  const [pwdForm, setPwdForm] = useState({ currentPassword:'', newPassword:'', confirmPassword:'' });
  const [saving, setSaving] = useState(false);
  const [changingPwd, setChangingPwd] = useState(false);
  const [emailForm, setEmailForm] = useState({ newEmail:'', otp:'' });
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [sendingEmailOtp, setSendingEmailOtp] = useState(false);
  const [confirmingEmail, setConfirmingEmail] = useState(false);
  const [phoneForm, setPhoneForm] = useState({ newPhone:'', reason:'' });
  const [submittingPhoneRequest, setSubmittingPhoneRequest] = useState(false);
  const [myPhoneRequests, setMyPhoneRequests] = useState([]);
  const [prefs, setPrefs] = useState({ ...DEFAULT_PREFS, ...(user?.notificationPrefs || {}) });
  const [savingPrefs, setSavingPrefs] = useState(null);

  const [docs, setDocs] = useState({
    bankDetails: { accountNumber:'', ifsc:'', bankName:'', accountHolder:'', ...(user?.bankDetails||{}) },
    emergencyContact: { name:'', phone:'', relationship:'', ...(user?.emergencyContact||{}) },
    govtId: { type:'', number:'', ...(user?.govtId||{}) },
    address: user?.address || '',
  });
  const [savingDocs, setSavingDocs] = useState(false);

  useEffect(() => {
    if (user?.notificationPrefs) setPrefs({ ...DEFAULT_PREFS, ...user.notificationPrefs });
    if (user) {
      setDocs({
        bankDetails: { accountNumber:'', ifsc:'', bankName:'', accountHolder:'', ...(user.bankDetails||{}) },
        emergencyContact: { name:'', phone:'', relationship:'', ...(user.emergencyContact||{}) },
        govtId: { type:'', number:'', ...(user.govtId||{}) },
        address: user.address || '',
      });
    }
  }, [user?._id]);

  useEffect(() => {
    authAPI.getMyPhoneChangeRequests().then(res => setMyPhoneRequests(res.data.data || [])).catch(() => {});
  }, [user?._id]);

  const ROLE_LABELS = { admin:'Administrator', doctor:'Doctor', patient:'Patient', nurse:'Nurse', pharmacist:'Pharmacist', finance:'Finance Officer', wardboy:'Ward Boy', sweeper:'Sweeper', otboy:'OT Boy', electrician:'Electrician', plumber:'Plumber', it_technician:'IT Technician', equipment_tech:'Equipment Technician', biomedical:'Biomedical Engineer', security:'Security Officer', receptionist:'Receptionist', ambulance_driver:'Ambulance Driver', lab_technician:'Lab Technician', radiology_tech:'Radiology Technician', dialysis_tech:'Dialysis Technician' };

  const saveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await authAPI.updateProfile(profile);
      updateUser(res.data.data);
      toast.success('Profile updated successfully!');
    } catch (err) { toast.error(err.response?.data?.error || 'Update failed'); }
    setSaving(false);
  };

  const changePassword = async (e) => {
    e.preventDefault();
    if (pwdForm.newPassword !== pwdForm.confirmPassword) { toast.error('Passwords do not match'); return; }
    if (pwdForm.newPassword.length < 8) { toast.error('Min 8 characters'); return; }
    if (!/[a-zA-Z]/.test(pwdForm.newPassword) || !/[0-9]/.test(pwdForm.newPassword)) { toast.error('Password must include a letter and a number'); return; }
    setChangingPwd(true);
    try {
      await authAPI.changePassword({ currentPassword: pwdForm.currentPassword, newPassword: pwdForm.newPassword });
      toast.success('Password changed!');
      setPwdForm({ currentPassword:'', newPassword:'', confirmPassword:'' });
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to change password'); }
    setChangingPwd(false);
  };

  // ── Change Email (OTP-verified) ─────────────────────────────────────
  // Step 1: send a code to the NEW address. Step 2: enter that code here
  // to actually switch the account over. Keeps someone from silently
  // taking over an account just by editing a text field.
  const requestEmailOtp = async (e) => {
    e.preventDefault();
    if (!emailForm.newEmail.trim()) { toast.error('Enter your new email address'); return; }
    setSendingEmailOtp(true);
    try {
      const res = await authAPI.requestEmailOTP(emailForm.newEmail.trim());
      setEmailOtpSent(true);
      toast.success(res.data.message || 'OTP sent to your new email');
      if (res.data._dev_otp) toast(`Dev mode OTP: ${res.data._dev_otp}`, { icon: '🔑', duration: 8000 });
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to send OTP'); }
    setSendingEmailOtp(false);
  };

  const confirmEmailOtp = async (e) => {
    e.preventDefault();
    if (!emailForm.otp.trim()) { toast.error('Enter the OTP sent to your new email'); return; }
    setConfirmingEmail(true);
    try {
      const res = await authAPI.confirmEmailChange(emailForm.newEmail.trim(), emailForm.otp.trim());
      updateUser(res.data.data);
      toast.success('✅ Email updated!');
      setEmailForm({ newEmail:'', otp:'' });
      setEmailOtpSent(false);
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to verify OTP'); }
    setConfirmingEmail(false);
  };

  // ── Change Phone Number (admin-approved) ────────────────────────────
  // Users can no longer self-verify a new phone number via OTP — they
  // submit a request here, and an admin reviews and approves it before
  // the number on file actually changes.
  const submitPhoneChangeRequest = async (e) => {
    e.preventDefault();
    if (!phoneForm.newPhone.trim()) { toast.error('Enter your new phone number'); return; }
    setSubmittingPhoneRequest(true);
    try {
      const res = await authAPI.requestPhoneChange(phoneForm.newPhone.trim(), phoneForm.reason.trim());
      toast.success(res.data.message || 'Request sent to admin for approval');
      setPhoneForm({ newPhone:'', reason:'' });
      const listRes = await authAPI.getMyPhoneChangeRequests();
      setMyPhoneRequests(listRes.data.data || []);
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to submit request'); }
    setSubmittingPhoneRequest(false);
  };
  const pendingPhoneRequest = myPhoneRequests.find(r => r.status === 'pending');


  const togglePref = async (key) => {
    const newVal = !prefs[key];
    setPrefs(p => ({ ...p, [key]: newVal }));
    setSavingPrefs(key);
    try {
      const res = await authAPI.updateProfile({ notificationPrefs: { ...prefs, [key]: newVal } });
      updateUser(res.data.data);
      toast.success(newVal ? 'Enabled' : 'Disabled', { duration: 1200 });
    } catch (err) {
      setPrefs(p => ({ ...p, [key]: !newVal }));
      toast.error('Failed to save setting');
    }
    setSavingPrefs(null);
  };

  const saveDocs = async (e) => {
    e.preventDefault();
    setSavingDocs(true);
    try {
      const res = await authAPI.updateProfile({ bankDetails: docs.bankDetails, emergencyContact: docs.emergencyContact, govtId: docs.govtId, address: docs.address });
      updateUser(res.data.data);
      if (res.data.data.documentationStatus === 'complete') {
        toast.success('🎉 Documentation complete! Your profile is fully verified.');
      } else {
        toast.success('Documentation saved! Please fill remaining fields to complete verification.');
      }
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to save'); }
    setSavingDocs(false);
  };

  const initials = user?.name?.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2)||'U';
  const docComplete = user?.documentationStatus === 'complete';
  const switchTab = (t) => { setTab(t); setSearchParams(t === 'docs' ? { tab:'profile' } : {}); };

  const isSalariedStaff = user?.role !== 'patient';
  const isAdmin = user?.role === 'admin';
  const TABS = [
    ['profile','👤 Profile'],
    ...(isSalariedStaff ? [['docs','📋 Documentation']] : []),
    ['security','🔒 Security'],
    ['prefs','🔔 Preferences'],
    ...(isAdmin ? [['site','🌐 Public Site']] : []),
  ];

  const [siteForm, setSiteForm] = useState({ hospitalName:'', tagline:'', contactPhone:'', contactEmail:'', address:'' });
  const [siteLoading, setSiteLoading] = useState(false);
  const [savingSite, setSavingSite] = useState(false);

  useEffect(() => {
    if (tab === 'site' && isAdmin) {
      setSiteLoading(true);
      hospitalConfigAPI.get().then(r => {
        const c = r.data.data || {};
        setSiteForm({ hospitalName: c.hospitalName||'', tagline: c.tagline||'', contactPhone: c.contactPhone||'', contactEmail: c.contactEmail||'', address: c.address||'' });
      }).catch(()=>toast.error('Failed to load site settings')).finally(()=>setSiteLoading(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const saveSiteSettings = async (e) => {
    e.preventDefault();
    setSavingSite(true);
    try {
      await hospitalConfigAPI.update(siteForm);
      toast.success('✅ Public site settings saved');
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to save'); }
    setSavingSite(false);
  };

  // Inline toggle switch — defined here so it can close over savingPrefs state
  const ToggleSwitch = ({ checked, onChange, disabled }) => (
    <label style={{ position:'relative', display:'inline-block', width:38, height:20, cursor: disabled ? 'not-allowed' : 'pointer', flexShrink:0, opacity: disabled ? 0.5 : 1 }}>
      <input type="checkbox" checked={!!checked} style={{ opacity:0, width:0, height:0 }} onChange={onChange} disabled={disabled} />
      <span onClick={()=>!disabled && onChange()}
        style={{ position:'absolute', inset:0, background: checked ? '#1648c9' : '#e2e8f0', borderRadius:10, transition:'.2s', cursor: disabled ? 'not-allowed' : 'pointer' }}/>
      <span style={{ position:'absolute', top:2, left: checked ? 18 : 2, width:16, height:16, background:'#fff', borderRadius:'50%', transition:'.2s', boxShadow:'0 1px 3px rgba(0,0,0,.2)', pointerEvents:'none' }}/>
    </label>
  );

  return (
    <div>
      <div className="page-header"><div className="page-title">⚙️ Settings</div></div>

      <div style={{ display:'flex', gap:6, marginBottom:18, borderBottom:'1px solid #e2e8f0' }}>
        {TABS.map(([k,l]) => (
          <button key={k} onClick={()=>switchTab(k)}
            style={{ padding:'10px 18px', background:'none', border:'none', borderBottom: tab===k ? '2.5px solid #1648c9' : '2.5px solid transparent', color: tab===k ? '#1648c9' : '#64748b', fontWeight: tab===k ? 800:600, fontSize:13.5, cursor:'pointer', fontFamily:'inherit', position:'relative' }}>
            {l}
            {k==='docs' && !docComplete && <span style={{ position:'absolute', top:4, right:4, width:8, height:8, borderRadius:'50%', background:'#ef4444' }}/>}
          </button>
        ))}
      </div>

      {tab === 'profile' && (
        <div className="grid-2">
          <motion.div className="card" initial={{ opacity:0,y:14 }} animate={{ opacity:1,y:0 }}>
            <div className="card-header"><span className="card-title">👤 Profile Settings</span></div>
            <form onSubmit={saveProfile}>
              <div className="card-body">
                <div style={{ textAlign:'center',marginBottom:18 }}>
                  <div style={{ position:'relative', width:76, height:76, margin:'0 auto 8px' }}>
                    {user?.avatar ? (
                      <img src={getFileUrl(user.avatar)} alt={user.name}
                        style={{ width:76, height:76, borderRadius:'50%', objectFit:'cover', border:'2px solid #e2e8f0' }} />
                    ) : (
                      <div style={{ width:76,height:76,borderRadius:'50%',background:'linear-gradient(135deg,#1648c9,#0891b2)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:800,fontSize:26 }}>{initials}</div>
                    )}
                    <button type="button" onClick={() => document.getElementById('avatar-file-input').click()} disabled={uploadingAvatar}
                      title="Change photo"
                      style={{ position:'absolute', bottom:-2, right:-2, width:26, height:26, borderRadius:'50%', background:'#1648c9', border:'2px solid #fff', color:'#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12 }}>
                      {uploadingAvatar ? '⏳' : '📷'}
                    </button>
                    <input id="avatar-file-input" type="file" accept="image/*" style={{ display:'none' }} onChange={e => handleAvatarPick(e.target.files?.[0])} />
                  </div>
                  <div className="fw-7">{user?.name}</div>
                  <span className="badge badge-primary">{ROLE_LABELS[user?.role]}</span>
                  {isSalariedStaff && (
                    <div style={{ marginTop:8 }}>
                      <span className={`badge ${docComplete?'badge-success':'badge-warning'}`}>{docComplete?'✅ Documentation Complete':'⚠️ Documentation Pending'}</span>
                    </div>
                  )}
                </div>
                <div className="form-group"><label className="form-label">Full Name</label><input className="form-input" value={profile.name} onChange={e=>setProfile(p=>({...p,name:e.target.value}))}/></div>
                <div className="form-group"><label className="form-label">Email (cannot change)</label><input className="form-input" value={user?.email||''} disabled style={{ background:'#f8fafc',opacity:.7 }}/></div>
                <div className="form-group"><label className="form-label">Phone</label><input className="form-input" disabled value={profile.phone || 'Not on file'} style={{ background:'#f8fafc' }} /><div style={{ fontSize:11, color:'#94a3b8', marginTop:4 }}>To change your phone number, use "Change Phone Number" below (requires admin approval).</div></div>
                {user?.role === 'patient' && <>
                  <div className="form-row">
                    <div className="form-group"><label className="form-label">Age</label><input className="form-input" type="number" value={profile.age} onChange={e=>setProfile(p=>({...p,age:e.target.value}))}/></div>
                    <div className="form-group"><label className="form-label">Blood Group</label><select className="form-input" value={profile.bloodGroup} onChange={e=>setProfile(p=>({...p,bloodGroup:e.target.value}))}>{['','A+','A-','B+','B-','AB+','AB-','O+','O-'].map(b=><option key={b}>{b}</option>)}</select></div>
                  </div>
                  <div className="form-row">
                    <div className="form-group"><label className="form-label">Weight (kg)</label><input className="form-input" type="number" value={profile.weight} onChange={e=>setProfile(p=>({...p,weight:e.target.value}))}/></div>
                    <div className="form-group"><label className="form-label">Height (cm)</label><input className="form-input" type="number" value={profile.height} onChange={e=>setProfile(p=>({...p,height:e.target.value}))}/></div>
                  </div>
                </>}
                {user?.role === 'doctor' && (
                  <>
                    <div className="form-group"><label className="form-label">Specialization</label><input className="form-input" value={profile.specialization} onChange={e=>setProfile(p=>({...p,specialization:e.target.value}))}/></div>
                    <div className="form-group"><label className="form-label">Years of Experience</label><input className="form-input" type="number" min="0" value={profile.experienceYears} onChange={e=>setProfile(p=>({...p,experienceYears:e.target.value}))} placeholder="e.g. 8"/></div>
                    <div className="form-group"><label className="form-label">Bio <span className="text-muted" style={{fontWeight:400}}>(shown on your profile — visible to admin and patients)</span></label><textarea className="form-input" rows={3} value={profile.bio} onChange={e=>setProfile(p=>({...p,bio:e.target.value}))} placeholder="A short introduction about yourself, your approach to care, etc."/></div>
                  </>
                )}
                {!['patient'].includes(user?.role) && (
                  <div className="form-group"><label className="form-label">Department</label><input className="form-input" value={profile.department} onChange={e=>setProfile(p=>({...p,department:e.target.value}))}/></div>
                )}
                <div className="form-group"><label className="form-label">Address</label><textarea className="form-input" rows={2} value={profile.address} onChange={e=>setProfile(p=>({...p,address:e.target.value}))} placeholder="Your address"/></div>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving?<><span className="spinner-sm"/> Saving…</>:'💾 Save Changes'}</button>
              </div>
            </form>
          </motion.div>

          <motion.div className="card" initial={{ opacity:0,y:14 }} animate={{ opacity:1,y:0 }} transition={{ delay:0.1 }}>
            <div className="card-header"><span className="card-title">ℹ️ Account Info</span></div>
            <div className="card-body">
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {[['Role', ROLE_LABELS[user?.role]],['Status', user?.status],['Joined', user?.joiningDate ? new Date(user.joiningDate).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}) : (user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}) : '—')], ...(isSalariedStaff ? [['Documentation', docComplete ? '✅ Complete' : '⚠️ Incomplete']] : [])].map(([l,v]) => (
                  <div key={l} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid #f1f5f9' }}>
                    <span className="text-sm text-muted">{l}</span>
                    <span className="text-sm fw-7" style={{ textTransform: l==='Status'?'capitalize':'none' }}>{v}</span>
                  </div>
                ))}
              </div>
              {isSalariedStaff && !docComplete && (
                <button className="btn btn-outline btn-sm mt-3" onClick={()=>switchTab('docs')}>📋 Complete Documentation →</button>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {user?.role === 'doctor' && tab === 'profile' && (
        <motion.div className="card mt-2" initial={{ opacity:0,y:14 }} animate={{ opacity:1,y:0 }} transition={{ delay:0.15 }}>
          <div className="card-header">
            <span className="card-title">🎓 Degrees & Experience</span>
            <span className="text-xs text-muted">Shown on your profile to admin and patients</span>
          </div>
          <div className="card-body">
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
              {/* Degrees */}
              <div>
                <div style={{ fontSize:11, fontWeight:700, color:'#64748b', letterSpacing:.5, textTransform:'uppercase', marginBottom:10 }}>Academic Qualifications</div>
                {degrees.map((d, i) => (
                  <div key={i} style={{ background:'#f8fafc', borderRadius:10, padding:10, marginBottom:8, position:'relative' }}>
                    <button type="button" onClick={() => setDegrees(ds => ds.filter((_,j)=>j!==i))} style={{ position:'absolute', top:6, right:6, background:'none', border:'none', color:'#ef4444', cursor:'pointer', fontSize:13 }}>✕</button>
                    <input className="form-input" style={{ marginBottom:6, fontSize:12.5 }} placeholder="Institution (e.g. AIIMS New Delhi)" value={d.institution||''} onChange={e=>setDegrees(ds=>ds.map((x,j)=>j===i?{...x,institution:e.target.value}:x))}/>
                    <input className="form-input" style={{ marginBottom:6, fontSize:12.5 }} placeholder="Degree (e.g. MBBS, MD Cardiology)" value={d.degree||''} onChange={e=>setDegrees(ds=>ds.map((x,j)=>j===i?{...x,degree:e.target.value}:x))}/>
                    <input className="form-input" style={{ fontSize:12.5 }} placeholder="Year completed (e.g. 2015)" value={d.year||''} onChange={e=>setDegrees(ds=>ds.map((x,j)=>j===i?{...x,year:e.target.value}:x))}/>
                  </div>
                ))}
                <button type="button" className="btn btn-outline btn-xs" onClick={() => setDegrees(ds => [...ds, { institution:'', degree:'', year:'' }])}>+ Add Degree</button>
              </div>

              {/* Experience */}
              <div>
                <div style={{ fontSize:11, fontWeight:700, color:'#64748b', letterSpacing:.5, textTransform:'uppercase', marginBottom:10 }}>Work Experience</div>
                {experiences.map((ex, i) => (
                  <div key={i} style={{ background:'#f8fafc', borderRadius:10, padding:10, marginBottom:8, position:'relative' }}>
                    <button type="button" onClick={() => setExperiences(es => es.filter((_,j)=>j!==i))} style={{ position:'absolute', top:6, right:6, background:'none', border:'none', color:'#ef4444', cursor:'pointer', fontSize:13 }}>✕</button>
                    <textarea className="form-input" rows={2} style={{ fontSize:12.5 }} placeholder="e.g. Senior Cardiologist at Fortis Hospital (2018-2022)" value={ex.text||''} onChange={e=>setExperiences(es=>es.map((x,j)=>j===i?{...x,text:e.target.value}:x))}/>
                  </div>
                ))}
                <button type="button" className="btn btn-outline btn-xs" onClick={() => setExperiences(es => [...es, { text:'' }])}>+ Add Experience</button>
              </div>
            </div>

            <button className="btn btn-primary mt-3" disabled={savingDocsExp} onClick={async () => {
              setSavingDocsExp(true);
              try {
                const cleanDegrees = degrees.filter(d => d.institution || d.degree || d.year);
                const cleanExp = experiences.filter(e => e.text?.trim());
                const res = await authAPI.updateProfile({ degrees: cleanDegrees, experiences: cleanExp });
                updateUser(res.data.data);
                setDegrees(cleanDegrees); setExperiences(cleanExp);
                toast.success('✅ Degrees & experience updated!');
              } catch (err) { toast.error(err.response?.data?.error || 'Failed to save'); }
              setSavingDocsExp(false);
            }}>{savingDocsExp ? <><span className="spinner-sm"/> Saving…</> : '💾 Save Degrees & Experience'}</button>
          </div>
        </motion.div>
      )}

      {tab === 'docs' && isSalariedStaff && (
        <motion.div className="card" initial={{ opacity:0,y:14 }} animate={{ opacity:1,y:0 }}>
          <div className="card-header">
            <span className="card-title">📋 Complete Your Documentation</span>
            <span className={`badge ${docComplete?'badge-success':'badge-warning'}`}>{docComplete?'✅ Complete':'⚠️ Pending'}</span>
          </div>
          <form onSubmit={saveDocs}>
            <div className="card-body">
              {!docComplete && (
                <div style={{ background:'#fef3c7', border:'1px solid #fde68a', borderRadius:10, padding:'12px 14px', marginBottom:18, fontSize:13, color:'#92400e' }}>
                  ⚠️ Please complete all sections below. Required for salary processing, emergency contact, and identity verification.
                </div>
              )}
              <h4 style={{ fontSize:13, fontWeight:800, color:'#0f172a', margin:'0 0 12px' }}>🏦 Bank Account Details <span className="text-xs text-muted" style={{fontWeight:500}}>(Required for salary credit)</span></h4>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Account Holder Name</label><input className="form-input" value={docs.bankDetails.accountHolder} onChange={e=>setDocs(d=>({...d,bankDetails:{...d.bankDetails,accountHolder:e.target.value}}))} placeholder="As per bank records"/></div>
                <div className="form-group"><label className="form-label">Account Number</label><input className="form-input" value={docs.bankDetails.accountNumber} onChange={e=>setDocs(d=>({...d,bankDetails:{...d.bankDetails,accountNumber:e.target.value}}))} placeholder="XXXXXXXXXXXX"/></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">IFSC Code</label><input className="form-input" value={docs.bankDetails.ifsc} onChange={e=>setDocs(d=>({...d,bankDetails:{...d.bankDetails,ifsc:e.target.value.toUpperCase()}}))} placeholder="ABCD0123456"/></div>
                <div className="form-group"><label className="form-label">Bank Name</label><input className="form-input" value={docs.bankDetails.bankName} onChange={e=>setDocs(d=>({...d,bankDetails:{...d.bankDetails,bankName:e.target.value}}))} placeholder="e.g. State Bank of India"/></div>
              </div>

              <h4 style={{ fontSize:13, fontWeight:800, color:'#0f172a', margin:'20px 0 12px' }}>🆘 Emergency Contact</h4>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Contact Name</label><input className="form-input" value={docs.emergencyContact.name} onChange={e=>setDocs(d=>({...d,emergencyContact:{...d.emergencyContact,name:e.target.value}}))} placeholder="Full name"/></div>
                <div className="form-group"><label className="form-label">Phone Number</label><input className="form-input" value={docs.emergencyContact.phone} onChange={e=>setDocs(d=>({...d,emergencyContact:{...d.emergencyContact,phone:e.target.value}}))} placeholder="+91-XXXXXXXXXX"/></div>
              </div>
              <div className="form-group"><label className="form-label">Relationship</label><input className="form-input" value={docs.emergencyContact.relationship} onChange={e=>setDocs(d=>({...d,emergencyContact:{...d.emergencyContact,relationship:e.target.value}}))} placeholder="e.g. Spouse, Parent, Sibling"/></div>

              <h4 style={{ fontSize:13, fontWeight:800, color:'#0f172a', margin:'20px 0 12px' }}>🪪 Government ID</h4>
              <div className="form-row">
                <div className="form-group"><label className="form-label">ID Type</label><select className="form-input" value={docs.govtId.type} onChange={e=>setDocs(d=>({...d,govtId:{...d.govtId,type:e.target.value}}))}>
                  <option value="">Select ID type</option>
                  <option value="aadhaar">Aadhaar Card</option>
                  <option value="pan">PAN Card</option>
                  <option value="passport">Passport</option>
                </select></div>
                <div className="form-group"><label className="form-label">ID Number</label><input className="form-input" value={docs.govtId.number} onChange={e=>setDocs(d=>({...d,govtId:{...d.govtId,number:e.target.value}}))} placeholder="ID Number"/></div>
              </div>

              <h4 style={{ fontSize:13, fontWeight:800, color:'#0f172a', margin:'20px 0 12px' }}>🏠 Permanent Address</h4>
              <div className="form-group"><textarea className="form-input" rows={3} value={docs.address} onChange={e=>setDocs(d=>({...d,address:e.target.value}))} placeholder="Full residential address"/></div>

              <button type="submit" className="btn btn-primary" disabled={savingDocs}>{savingDocs?<><span className="spinner-sm"/> Saving…</>:'💾 Save Documentation'}</button>
            </div>
          </form>
        </motion.div>
      )}

      {tab === 'security' && (
        <div className="grid-2">
          <motion.div className="card" initial={{ opacity:0,y:14 }} animate={{ opacity:1,y:0 }}>
            <div className="card-header"><span className="card-title">🔒 Change Password</span></div>
            <form onSubmit={changePassword}>
              <div className="card-body">
                <div className="form-group"><label className="form-label">Current Password</label><input className="form-input" type="password" required value={pwdForm.currentPassword} onChange={e=>setPwdForm(p=>({...p,currentPassword:e.target.value}))} placeholder="Current password"/></div>
                <div className="form-group"><label className="form-label">New Password</label><input className="form-input" type="password" required value={pwdForm.newPassword} onChange={e=>setPwdForm(p=>({...p,newPassword:e.target.value}))} placeholder="8+ chars, incl. a letter & number"/></div>
                <div className="form-group"><label className="form-label">Confirm New Password</label><input className="form-input" type="password" required value={pwdForm.confirmPassword} onChange={e=>setPwdForm(p=>({...p,confirmPassword:e.target.value}))} placeholder="Repeat new password"/></div>
                <button type="submit" className="btn btn-primary" disabled={changingPwd}>{changingPwd?<><span className="spinner-sm"/> Changing…</>:'🔒 Change Password'}</button>
              </div>
            </form>
          </motion.div>

          <motion.div className="card" initial={{ opacity:0,y:14 }} animate={{ opacity:1,y:0 }} transition={{ delay:0.05 }}>
            <div className="card-header"><span className="card-title">✉️ Change Email</span></div>
            <div className="card-body">
              <div style={{ fontSize:12.5, color:'#64748b', marginBottom:14 }}>Current email: <strong style={{color:'#0f172a'}}>{user?.email}</strong></div>
              {!emailOtpSent ? (
                <form onSubmit={requestEmailOtp}>
                  <div className="form-group"><label className="form-label">New Email Address</label>
                    <input className="form-input" type="email" required value={emailForm.newEmail} onChange={e=>setEmailForm(f=>({...f,newEmail:e.target.value}))} placeholder="your-new-email@example.com"/>
                  </div>
                  <button type="submit" className="btn btn-primary" disabled={sendingEmailOtp}>{sendingEmailOtp?<><span className="spinner-sm"/> Sending…</>:'📧 Send Verification Code'}</button>
                </form>
              ) : (
                <form onSubmit={confirmEmailOtp}>
                  <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:10, padding:'9px 13px', marginBottom:14, fontSize:12.5, color:'#1d4ed8' }}>
                    📩 Code sent to <strong>{emailForm.newEmail}</strong>. Enter it below to confirm.
                  </div>
                  <div className="form-group"><label className="form-label">Verification Code (OTP)</label>
                    <input className="form-input" required value={emailForm.otp} onChange={e=>setEmailForm(f=>({...f,otp:e.target.value}))} placeholder="6-digit code" maxLength={6}/>
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" className="btn btn-primary" disabled={confirmingEmail}>{confirmingEmail?<><span className="spinner-sm"/> Verifying…</>:'✅ Verify & Update Email'}</button>
                    <button type="button" className="btn btn-outline" onClick={()=>{setEmailOtpSent(false);setEmailForm(f=>({...f,otp:''}));}}>Change Address</button>
                  </div>
                </form>
              )}
            </div>
          </motion.div>

          <motion.div className="card" initial={{ opacity:0,y:14 }} animate={{ opacity:1,y:0 }} transition={{ delay:0.07 }}>
            <div className="card-header"><span className="card-title">📱 Change Phone Number</span></div>
            <div className="card-body">
              <div style={{ fontSize:12.5, color:'#64748b', marginBottom:14 }}>Current phone: <strong style={{color:'#0f172a'}}>{user?.phone || 'Not on file'}</strong></div>
              {pendingPhoneRequest ? (
                <div style={{ background:'#fffbeb', border:'1px solid #fde68a', borderRadius:10, padding:'12px 14px', fontSize:12.5, color:'#92400e' }}>
                  ⏳ Your request to change your phone number to <strong>{pendingPhoneRequest.requestedPhone}</strong> is awaiting admin approval. You'll be notified once it's reviewed.
                </div>
              ) : (
                <form onSubmit={submitPhoneChangeRequest}>
                  <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:10, padding:'9px 13px', marginBottom:14, fontSize:12.5, color:'#1d4ed8' }}>
                    📋 Phone number changes now require admin approval — no OTP needed. Submit your request below and an admin will review it.
                  </div>
                  <div className="form-group"><label className="form-label">New Phone Number</label>
                    <input className="form-input" type="tel" required value={phoneForm.newPhone} onChange={e=>setPhoneForm(f=>({...f,newPhone:e.target.value}))} placeholder="+91-XXXXXXXXXX"/>
                  </div>
                  <div className="form-group"><label className="form-label">Reason (optional)</label>
                    <input className="form-input" value={phoneForm.reason} onChange={e=>setPhoneForm(f=>({...f,reason:e.target.value}))} placeholder="e.g. Lost old SIM / new number"/>
                  </div>
                  <button type="submit" className="btn btn-primary" disabled={submittingPhoneRequest}>{submittingPhoneRequest?<><span className="spinner-sm"/> Submitting…</>:'📨 Request Phone Number Change'}</button>
                </form>
              )}
              {myPhoneRequests.filter(r => r.status !== 'pending').slice(0,3).length > 0 && (
                <div style={{ marginTop:16, borderTop:'1px solid #f1f5f9', paddingTop:12 }}>
                  <div style={{ fontSize:11.5, fontWeight:700, color:'#94a3b8', marginBottom:8, textTransform:'uppercase', letterSpacing:.5 }}>Recent Requests</div>
                  {myPhoneRequests.filter(r => r.status !== 'pending').slice(0,3).map(r => (
                    <div key={r._id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 0', fontSize:12.5 }}>
                      <span style={{ color:'#374151' }}>{r.requestedPhone}</span>
                      <span style={{ padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:700, background: r.status==='approved'?'#dcfce7':'#fee2e2', color: r.status==='approved'?'#15803d':'#dc2626' }}>
                        {r.status==='approved' ? '✅ Approved' : '❌ Rejected'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>

          <motion.div className="card" initial={{ opacity:0,y:14 }} animate={{ opacity:1,y:0 }} transition={{ delay:0.1 }}>
            <div className="card-header"><span className="card-title">🛡️ Security Options</span></div>
            <div className="card-body">
              {[['Two-Factor Authentication (2FA)','Extra OTP verification on login','twoFA'],['Auto-logout','Log out automatically after 30 min idle','autoLogout']].map(([l,d,key]) => (
                <div key={key} style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'11px 0',borderBottom:'1px solid #e2e8f0' }}>
                  <div><div className="text-sm fw-7">{l}</div><div className="text-xs text-muted">{d}</div></div>
                  <ToggleSwitch checked={prefs[key]} onChange={()=>togglePref(key)} disabled={savingPrefs===key} />
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      )}

      {tab === 'prefs' && (
        <motion.div className="card" initial={{ opacity:0,y:14 }} animate={{ opacity:1,y:0 }}>
          <div className="card-header"><span className="card-title">🔔 Notification Preferences</span></div>
          <div className="card-body">
            <p className="text-xs text-muted" style={{ marginBottom:12 }}>Changes are saved automatically and apply across all your devices.</p>
            {[
              ['Email Notifications','Appointment & alert emails','emailNotifs'],
              ['SMS Notifications','Text message reminders','smsNotifs'],
              ['Push Notifications','Browser push notifications','pushNotifs'],
              ['Appointment Updates','Booking confirmations & reminders','appointments'],
              ['Medication Reminders','Daily medication alerts','reminders'],
              ['Emergency Alerts','SOS & critical notifications','emergency'],
              ['Salary Notifications','Payslip & salary credit emails','salary'],
            ].map(([l,d,key]) => (
              <div key={key} style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'11px 0',borderBottom:'1px solid #e2e8f0' }}>
                <div><div className="text-sm fw-7">{l}</div><div className="text-xs text-muted">{d}</div></div>
                <ToggleSwitch checked={prefs[key]} onChange={()=>togglePref(key)} disabled={savingPrefs===key} />
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {tab === 'site' && isAdmin && (
        <motion.div className="card" initial={{ opacity:0,y:14 }} animate={{ opacity:1,y:0 }} style={{ maxWidth:560 }}>
          <div className="card-header"><span className="card-title">🌐 Public Site Settings</span></div>
          <div className="card-body">
            <div style={{ fontSize:12.5, color:'#64748b', marginBottom:18 }}>
              These details appear on your public homepage (before anyone logs in) — the hospital name, tagline, and contact info shown in the "Need Medical Assistance?" section.
            </div>
            {siteLoading ? (
              <div style={{ textAlign:'center', padding:30, color:'#94a3b8' }}>Loading…</div>
            ) : (
              <form onSubmit={saveSiteSettings}>
                <div className="form-group">
                  <label className="form-label">Hospital Name</label>
                  <input className="form-input" value={siteForm.hospitalName} onChange={e=>setSiteForm(f=>({...f,hospitalName:e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Tagline</label>
                  <input className="form-input" value={siteForm.tagline} onChange={e=>setSiteForm(f=>({...f,tagline:e.target.value}))} placeholder="e.g. Compassionate Care, Modern Medicine" />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Contact Phone</label>
                    <input className="form-input" value={siteForm.contactPhone} onChange={e=>setSiteForm(f=>({...f,contactPhone:e.target.value}))} placeholder="e.g. +91 22 1234 5678" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Contact Email</label>
                    <input className="form-input" type="email" value={siteForm.contactEmail} onChange={e=>setSiteForm(f=>({...f,contactEmail:e.target.value}))} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Address</label>
                  <textarea className="form-input" rows={2} value={siteForm.address} onChange={e=>setSiteForm(f=>({...f,address:e.target.value}))} />
                </div>
                <button type="submit" className="btn btn-primary" disabled={savingSite}>{savingSite ? 'Saving…' : '✓ Save Site Settings'}</button>
              </form>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}
