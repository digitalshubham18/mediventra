import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { authAPI } from '../utils/api';
import toast from 'react-hot-toast';

const ROLES = [
  { value:'patient',         label:'Patient',           icon:'🧑‍⚕️', color:'#7c3aed', desc:'Appointments, records & pharmacy' },
  { value:'doctor',          label:'Doctor',            icon:'⚕️',  color:'#0891b2', desc:'Patient care, records & prescriptions' },
  { value:'nurse',           label:'Nurse',             icon:'💉',  color:'#db2777', desc:'Ward management & patient care' },
  { value:'pharmacist',      label:'Pharmacist',        icon:'💊',  color:'#d97706', desc:'Pharmacy & medication management' },
  { value:'lab_technician',  label:'Lab Technician',    icon:'🔬',  color:'#0d9488', desc:'Lab testing & report processing' },
  { value:'radiology_tech',  label:'Radiology Tech',    icon:'🩻',  color:'#0e7490', desc:'Imaging orders & scan operations' },
  { value:'dialysis_tech',   label:'Dialysis Tech',     icon:'💉',  color:'#be123c', desc:'Dialysis sessions & treatment records' },
  { value:'wardboy',         label:'Ward Boy',          icon:'🛏️',  color:'#059669', desc:'Ward assistance & transport' },
  { value:'sweeper',         label:'Sweeper',           icon:'🧹',  color:'#f59e0b', desc:'Cleaning & sanitation duties' },
  { value:'otboy',           label:'OT Boy',            icon:'🔪',  color:'#ef4444', desc:'Operation theater support' },
  { value:'finance',         label:'Finance Officer',   icon:'💼',  color:'#8b5cf6', desc:'Payroll, billing & financial management' },
  { value:'electrician',     label:'Electrician',       icon:'⚡',  color:'#f59e0b', desc:'Electrical maintenance & repairs' },
  { value:'plumber',         label:'Plumber',           icon:'🔧',  color:'#0891b2', desc:'Plumbing & water systems' },
  { value:'it_technician',   label:'IT Technician',     icon:'💻',  color:'#6366f1', desc:'IT systems & network support' },
  { value:'equipment_tech',  label:'Equipment Tech',    icon:'🔩',  color:'#8b5cf6', desc:'Medical equipment maintenance' },
  { value:'biomedical',      label:'Biomedical Eng.',   icon:'🩺',  color:'#059669', desc:'Biomedical device calibration' },
  { value:'security',        label:'Security Officer',  icon:'🔐',  color:'#374151', desc:'Hospital security & access control' },
  { value:'receptionist',    label:'Receptionist',      icon:'🏨',  color:'#db2777', desc:'Patient registration & front desk' },
  { value:'ambulance_driver',label:'Ambulance Driver',  icon:'🚑',  color:'#dc2626', desc:'Emergency transport & ambulance ops' },
];

const DEPTS = ['Cardiology','Neurology','Orthopedics','General Medicine','Pediatrics','Psychiatry','Gynecology','Oncology','Surgery','ENT','Radiology','ICU','Emergency','Pharmacy','Laboratory','Ward A','Ward B','Ward C','Finance & Accounts','Administration','IT Department','Maintenance','Security','Reception','Biomedical Engineering'];

const INK  = '#0A2626';
const TEAL = '#159488';
const TEAL2= '#5EEAD4';
const PAPER= '#FAF7F1';

export default function RegisterPage() {
  const nav = useNavigate();
  const [step, setStep]     = useState(1); // 1=role, 2=details, 3=otp, 4=success
  const [form, setForm]     = useState({ name:'', email:'', password:'', confirmPass:'', role:'patient', phone:'', department:'', bloodGroup:'', specialization:'', weight:'', height:'' });
  const [otp, setOtp]       = useState(['','','','','','']);
  const [sending, setSending]     = useState(false);
  const [registering, setReg]     = useState(false);
  const [resendTimer, setTimer]   = useState(0);
  const [showPass, setShowPass]   = useState(false);
  const [errors, setErrors]       = useState({});
  const [devOtp, setDevOtp]       = useState('');
  const otpRefs = useRef([]);
  const timerRef = useRef(null);

  const sel = ROLES.find(r => r.value === form.role) || ROLES[0];
  const ac  = sel.color;

  useEffect(() => {
    if (resendTimer > 0) {
      timerRef.current = setTimeout(() => setTimer(t => t-1), 1000);
      return () => clearTimeout(timerRef.current);
    }
  }, [resendTimer]);

  const set = f => e => { setForm(p=>({...p,[f]:e.target.value})); setErrors(er=>({...er,[f]:''})); };

  const validate = () => {
    const e = {};
    if (!form.name.trim() || form.name.trim().length < 2) e.name = 'Full name required';
    if (!form.email) e.email = 'Email required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Enter a valid email';
    if (!form.password || form.password.length < 8) e.password = 'Min 8 characters';
    else if (!/[a-zA-Z]/.test(form.password) || !/[0-9]/.test(form.password)) e.password = 'Must include a letter and a number';
    if (form.password !== form.confirmPass) e.confirmPass = 'Passwords do not match';
    return e;
  };

  const handleSendOTP = async () => {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSending(true);
    try {
      const res = await authAPI.sendRegisterOTP(form.email, form.name, form.phone);
      setStep(3);
      setTimer(60);
      setDevOtp(res.data._dev_otp || '');
      toast.success(res.data.emailSent ? `✅ OTP sent to ${form.email}! Check your inbox.` : '⚠️ Email not configured — check server console for OTP');
      setTimeout(() => otpRefs.current[0]?.focus(), 300);
    } catch(e) {
      toast.error(e.response?.data?.error || 'Failed to send OTP');
    }
    setSending(false);
  };

  const handleOtpInput = (i, val) => {
    if (!/^\d*$/.test(val)) return;
    const next = [...otp]; next[i] = val.slice(-1); setOtp(next);
    if (val && i < 5) otpRefs.current[i+1]?.focus();
  };
  const handleOtpKey = (i, e) => {
    if (e.key==='Backspace' && !otp[i] && i>0) otpRefs.current[i-1]?.focus();
  };
  const handlePaste = e => {
    const p = e.clipboardData.getData('text').replace(/\D/g,'').slice(0,6);
    if (p.length===6) { setOtp(p.split('')); otpRefs.current[5]?.focus(); }
    e.preventDefault();
  };

  const handleRegister = async () => {
    const otpStr = otp.join('');
    if (otpStr.length < 6) { toast.error('Enter the complete 6-digit OTP'); return; }
    setReg(true);
    try {
      await authAPI.register({ ...form, otp: otpStr });
      setStep(4);
    } catch(e) {
      toast.error(e.response?.data?.error || 'Registration failed. Please try again.');
    }
    setReg(false);
  };

  const resendOTP = async () => {
    if (resendTimer > 0) return;
    setSending(true);
    try {
      const res = await authAPI.sendRegisterOTP(form.email, form.name, form.phone);
      setOtp(['','','','','','']);
      setTimer(60);
      setDevOtp(res.data._dev_otp || '');
      toast.success('New OTP sent to your email!');
      otpRefs.current[0]?.focus();
    } catch(e) { toast.error('Failed to resend OTP'); }
    setSending(false);
  };

  // ── Vitals-chart input style — shared identity with Login ──
  const CS = (err) => ({
    width:'100%', padding:'12px 14px',
    border:`1.5px solid ${err?'#dc6a5a':'#E5DFD2'}`,
    borderRadius:12, fontFamily:'inherit', fontSize:14, outline:'none',
    background:'#fff', color:'#16241F', boxSizing:'border-box',
    transition:'all .2s',
  });

  return (
    <div style={{ minHeight:'100vh', display:'flex', fontFamily:"'IBM Plex Sans',sans-serif", background:PAPER }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@600;700;800&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600;700&display=swap');
        * { box-sizing:border-box; }
        @keyframes spin { to { transform:rotate(360deg) } }
        @keyframes chartDrift { 0%,100%{ transform:translate(0,0) } 50%{ transform:translate(16px,-18px) } }
        @keyframes badgeSwing { 0%,100%{ transform:rotate(-1.4deg) } 50%{ transform:rotate(1.4deg) } }
        input::placeholder, select::placeholder { color:#9CA79F; }
        .reg-inp:focus { border-color:var(--ac,${TEAL}) !important; box-shadow:0 0 0 3px var(--ac-fade,rgba(21,148,136,.15)) !important; }
        .reg-inp.err { border-color:#dc6a5a !important; }
        .role-card:hover { transform:translateY(-1px); }
        .otp-f:focus { border-color:var(--ac,${TEAL}); box-shadow:0 0 0 3px var(--ac-fade,rgba(21,148,136,.18)); }
        @media (max-width: 860px) { .aurora-panel { display:none !important; } .mobile-logo { display:block !important; } }
      `}</style>

      {/* ── LEFT: Vitals-monitor panel — same family as Login, ID-badge follows the chosen role ── */}
      <div className="aurora-panel" style={{ flex:'0 0 42%', position:'relative', background:`linear-gradient(160deg, ${INK} 0%, #123B3D 50%, ${INK} 100%)`, overflow:'hidden', display:'flex', flexDirection:'column', justifyContent:'space-between', padding:'52px 44px' }}>
        <div style={{ position:'absolute', inset:0, backgroundImage:'linear-gradient(rgba(94,234,212,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(94,234,212,.05) 1px, transparent 1px)', backgroundSize:'28px 28px', pointerEvents:'none' }} />
        <div style={{ position:'absolute', top:'6%', left:'-8%', width:300, height:300, borderRadius:'50%', background:'radial-gradient(circle,rgba(94,234,212,.14),transparent 70%)', animation:'chartDrift 10s ease-in-out infinite', pointerEvents:'none' }} />

        <div style={{ position:'relative' }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:10 }}>
            <div style={{ width:42, height:42, borderRadius:11, background:'rgba(94,234,212,.14)', border:'1.5px solid rgba(94,234,212,.4)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:19 }}>✚</div>
            <span style={{ color:'#EAF6F2', fontFamily:"'Manrope',sans-serif", fontWeight:800, fontSize:20, letterSpacing:-.3 }}>Mediventra</span>
          </div>
          <p style={{ color:'rgba(234,246,242,.5)', fontSize:13, margin:0, maxWidth:300, lineHeight:1.6 }}>Join the platform that runs every department — appointments, records, pharmacy, payroll, and the people behind them.</p>
        </div>

        {/* Signature visual: a staff/patient ID badge that updates live with
            the role picked in Step 1 — a real, concrete artifact rather than
            a decorative orbit, and it doubles as a preview of "who you are
            about to become" in the system. */}
        <div style={{ position:'relative', width:172, margin:'6px auto' }}>
          <div style={{ width:26, height:10, borderRadius:'0 0 6px 6px', background:'rgba(94,234,212,.35)', margin:'0 auto -1px', position:'relative', zIndex:2 }} />
          <motion.div key={ac+'-badge'} initial={{ opacity:0, y:-6, rotate:-2 }} animate={{ opacity:1, y:0, rotate:0 }} transition={{ duration:.35 }}
            style={{ animation:'badgeSwing 4.5s ease-in-out infinite', background:'#0F3230', border:`1.5px solid ${ac}88`, borderRadius:16, padding:'20px 16px 14px', boxShadow:`0 18px 40px rgba(0,0,0,.35), 0 0 0 6px rgba(255,255,255,.02)`, position:'relative' }}>
            <div style={{ width:10, height:10, borderRadius:'50%', background:'#04140F', margin:'0 auto 12px', border:'1px solid rgba(255,255,255,.15)' }} />
            <div style={{ width:52, height:52, borderRadius:14, background:`${ac}26`, border:`1.5px solid ${ac}77`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, margin:'0 auto 10px' }}>{sel.icon}</div>
            <div style={{ textAlign:'center', color:'#EAF6F2', fontWeight:700, fontSize:13.5, lineHeight:1.25 }}>{sel.label}</div>
            <div style={{ textAlign:'center', color:'rgba(234,246,242,.45)', fontSize:9.5, fontFamily:"'IBM Plex Mono',monospace", letterSpacing:1, marginTop:3, textTransform:'uppercase' }}>Mediventra ID · Pending</div>
            <div style={{ display:'flex', gap:2, justifyContent:'center', marginTop:12 }}>
              {Array.from({length:16}).map((_,i)=><div key={i} style={{ width:i%3===0?3:1.5, height:14, background:`${ac}90` }} />)}
            </div>
          </motion.div>
        </div>

        {/* Selected role description */}
        <div style={{ position:'relative', marginBottom:30 }}>
          <div style={{ color:'rgba(234,246,242,.4)', fontSize:10.5, fontWeight:700, letterSpacing:1.2, textTransform:'uppercase', marginBottom:10 }}>You're registering as</div>
          <motion.div key={sel.value} initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }}
            style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', borderRadius:14, background:`${ac}1f`, border:`1px solid ${ac}55` }}>
            <span style={{ fontSize:24 }}>{sel.icon}</span>
            <div>
              <div style={{ color:'#fff', fontWeight:700, fontSize:14.5 }}>{sel.label}</div>
              <div style={{ color:'rgba(234,246,242,.55)', fontSize:11.5, marginTop:1 }}>{sel.desc}</div>
            </div>
          </motion.div>
        </div>

        <div style={{ position:'relative' }}>
          <div style={{ color:'rgba(234,246,242,.4)', fontSize:10.5, fontWeight:700, letterSpacing:1.2, textTransform:'uppercase', marginBottom:10 }}>Why people choose Mediventra</div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {['Email-verified accounts, every time','Role-based dashboards built for your job','Staff accounts reviewed by admin before activation'].map(t => (
              <div key={t} style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ color:TEAL2, fontSize:13 }}>✓</span>
                <span style={{ color:'rgba(234,246,242,.7)', fontSize:12.5 }}>{t}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── RIGHT: Registration card ── */}
      <div style={{ flex:'1 1 58%', display:'flex', alignItems:'center', justifyContent:'center', padding:'32px 20px', position:'relative' }}>
        <motion.div initial={{ opacity:0, y:18 }} animate={{ opacity:1, y:0 }} transition={{ duration:.5, ease:[.22,1,.36,1] }}
          style={{ width:'100%', maxWidth: step===1 ? 560 : 420, '--ac':ac, '--ac-fade':`${ac}24` }}>

          {/* Mobile-only compact logo */}
          <div className="mobile-logo" style={{ display:'none', textAlign:'center', marginBottom:22 }}>
            <div style={{ width:46, height:46, background:`linear-gradient(135deg,${TEAL},#0d6e65)`, borderRadius:12, margin:'0 auto 9px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:21 }}>✚</div>
            <h1 style={{ color:'#16241F', fontFamily:"'Manrope',sans-serif", fontWeight:800, fontSize:19, margin:0 }}>Mediventra</h1>
          </div>

          {/* Step progress */}
          <div style={{ display:'flex', alignItems:'center', marginBottom:22, gap:6 }}>
            {[{n:1,l:'Role'},{n:2,l:'Details'},{n:3,l:'Verify'},{n:4,l:'Done'}].map((s,i) => (
              <React.Fragment key={s.n}>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <div style={{ width:25, height:25, borderRadius:'50%', background:step>=s.n?ac:'#EFEAE0', display:'flex', alignItems:'center', justifyContent:'center', color:step>=s.n?'#fff':'#9CA79F', fontSize:11.5, fontWeight:800, transition:'background .3s' }}>
                    {step>s.n?'✓':s.n}
                  </div>
                  <span style={{ fontSize:11.5, fontWeight:600, color:step>=s.n?'#16241F':'#9CA79F', transition:'color .3s', whiteSpace:'nowrap' }}>{s.l}</span>
                </div>
                {i<3 && <div style={{ flex:1, height:1.5, background:step>s.n?ac:'#E5DFD2', transition:'background .3s', borderRadius:2, minWidth:8 }} />}
              </React.Fragment>
            ))}
          </div>

          {/* Card */}
          <div style={{ background:'#fff', border:'1px solid #E5DFD2', borderRadius:20, overflow:'hidden', boxShadow:'0 18px 50px rgba(10,38,38,.1)' }}>
            <motion.div key={ac+'-top'} initial={{ scaleX:0 }} animate={{ scaleX:1 }} transition={{ duration:.5 }}
              style={{ height:3, background:`linear-gradient(90deg,${ac},${TEAL})`, originX:0 }} />

            <div style={{ padding:'26px 28px 28px' }}>
              <AnimatePresence mode="wait">

                {/* ── STEP 1: ROLE ── */}
                {step===1 && (
                  <motion.div key="s1" initial={{ opacity:0,x:-16 }} animate={{ opacity:1,x:0 }} exit={{ opacity:0,x:16 }}>
                    <h2 style={{ color:'#16241F', fontFamily:"'Manrope',sans-serif", fontWeight:800, fontSize:22, margin:'0 0 4px', letterSpacing:-.4 }}>Select your role</h2>
                    <p style={{ color:'#6B7A75', fontSize:13, margin:'0 0 16px' }}>What is your position at the hospital?</p>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:7, marginBottom:18, maxHeight:300, overflowY:'auto', paddingRight:2 }}>
                      {ROLES.map(role=>(
                        <button key={role.value} type="button" className="role-card"
                          onClick={()=>setForm(f=>({...f,role:role.value}))}
                          style={{ padding:'10px 11px', border:`1.5px solid ${form.role===role.value?role.color:'#EFEAE0'}`, borderRadius:12, background:form.role===role.value?`${role.color}14`:'#FAF7F1', cursor:'pointer', display:'flex', alignItems:'center', gap:9, textAlign:'left', transition:'all .15s' }}>
                          <span style={{ fontSize:18, flexShrink:0 }}>{role.icon}</span>
                          <div style={{ minWidth:0 }}>
                            <div style={{ fontSize:12.5, fontWeight:700, color:form.role===role.value?role.color:'#374b44' }}>{role.label}</div>
                            <div style={{ fontSize:10.5, color:'#9CA79F', lineHeight:1.3, marginTop:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{role.desc}</div>
                          </div>
                          {form.role===role.value && <div style={{ marginLeft:'auto', width:16, height:16, borderRadius:'50%', background:role.color, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><span style={{ color:'#fff', fontSize:9, fontWeight:900 }}>✓</span></div>}
                        </button>
                      ))}
                    </div>
                    <div style={{ background:`${ac}10`, border:`1px solid ${ac}35`, borderRadius:12, padding:'10px 14px', marginBottom:18, display:'flex', alignItems:'center', gap:9 }}>
                      <span style={{ fontSize:20 }}>{sel.icon}</span>
                      <div><div style={{ fontWeight:700, color:ac, fontSize:13 }}>{sel.label}</div><div style={{ fontSize:11.5, color:'#6B7A75' }}>{sel.desc}</div></div>
                    </div>
                    <motion.button whileTap={{ scale:.98 }} onClick={()=>setStep(2)} style={{ width:'100%', padding:'13px', borderRadius:13, border:'none', background:`linear-gradient(135deg,${ac},${TEAL})`, color:'#fff', fontFamily:'inherit', fontWeight:800, fontSize:15, cursor:'pointer', boxShadow:`0 10px 26px ${ac}40` }}>
                      Continue as {sel.label} →
                    </motion.button>
                  </motion.div>
                )}

                {/* ── STEP 2: DETAILS ── */}
                {step===2 && (
                  <motion.div key="s2" initial={{ opacity:0,x:16 }} animate={{ opacity:1,x:0 }} exit={{ opacity:0,x:-16 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:18 }}>
                      <button onClick={()=>setStep(1)} style={{ width:28, height:28, borderRadius:'50%', border:'1px solid #E5DFD2', background:'#FAF7F1', cursor:'pointer', color:'#57675F', fontSize:13, display:'flex', alignItems:'center', justifyContent:'center' }}>←</button>
                      <div>
                        <h2 style={{ color:'#16241F', fontFamily:"'Manrope',sans-serif", fontWeight:800, fontSize:20, margin:0, letterSpacing:-.4 }}>Your Details</h2>
                        <p style={{ color:'#6B7A75', fontSize:12, margin:0 }}>Registering as <span style={{ color:ac, fontWeight:700 }}>{sel.icon} {sel.label}</span></p>
                      </div>
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', gap:13 }}>
                      {[
                        {label:'Full Name *',    field:'name',        type:'text',     placeholder:'Your full legal name'},
                        {label:'Email Address *',field:'email',       type:'email',    placeholder:'your@email.com — OTP will be sent here'},
                        {label:'Password *',     field:'password',    type:showPass?'text':'password', placeholder:'8+ chars, incl. a letter & number'},
                        {label:'Confirm Password *',field:'confirmPass',type:'password',placeholder:'Repeat your password'},
                        {label:'Phone Number',   field:'phone',       type:'tel',      placeholder:'+91-XXXXX-XXXXX'},
                      ].map(({label,field,type,placeholder})=>(
                        <div key={field}>
                          <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#57675F', letterSpacing:.5, marginBottom:6 }}>{label}</label>
                          <div style={{ position:'relative' }}>
                            <input className={`reg-inp${errors[field]?' err':''}`} style={CS(errors[field])} type={type} value={form[field]} onChange={set(field)} placeholder={placeholder} autoComplete="new-password" />
                            {field==='password'&&<button type="button" onClick={()=>setShowPass(p=>!p)} style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'#9CA79F', fontSize:14 }}>{showPass?'🙈':'👁️'}</button>}
                          </div>
                          {errors[field]&&<span style={{ fontSize:11, color:'#c0392b', display:'block', marginTop:4 }}>{errors[field]}</span>}
                        </div>
                      ))}
                      {form.role!=='patient'&&(
                        <div>
                          <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#57675F', letterSpacing:.5, marginBottom:6 }}>Department</label>
                          <select className="reg-inp" style={CS(false)} value={form.department} onChange={set('department')}>
                            <option value="">Select department…</option>
                            {DEPTS.map(d=><option key={d} value={d}>{d}</option>)}
                          </select>
                        </div>
                      )}
                      {form.role==='doctor'&&(
                        <div>
                          <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#57675F', letterSpacing:.5, marginBottom:6 }}>Specialization</label>
                          <input className="reg-inp" style={CS(false)} value={form.specialization} onChange={set('specialization')} placeholder="e.g. Cardiology, Neurology…" />
                        </div>
                      )}
                      {form.role==='patient'&&(
                        <div>
                          <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#57675F', letterSpacing:.5, marginBottom:6 }}>Blood Group</label>
                          <select className="reg-inp" style={CS(false)} value={form.bloodGroup} onChange={set('bloodGroup')}>
                            <option value="">Select…</option>
                            {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(b=><option key={b} value={b}>{b}</option>)}
                          </select>
                        </div>
                      )}
                      {form.role==='patient'&&(
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                          <div>
                            <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#57675F', letterSpacing:.5, marginBottom:6 }}>Weight (kg)</label>
                            <input className="reg-inp" style={CS(false)} type="number" min="0" step="0.1" value={form.weight} onChange={set('weight')} placeholder="e.g. 68" />
                          </div>
                          <div>
                            <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#57675F', letterSpacing:.5, marginBottom:6 }}>Height (cm)</label>
                            <input className="reg-inp" style={CS(false)} type="number" min="0" step="0.1" value={form.height} onChange={set('height')} placeholder="e.g. 172" />
                          </div>
                        </div>
                      )}
                      <div style={{ background:'#EFF7F5', border:'1px solid #CDE7E1', borderRadius:10, padding:'10px 13px', fontSize:12, color:'#0F6D63', display:'flex', gap:7 }}>
                        <span>📧</span>
                        <span>A 6-digit OTP will be sent to your email to verify your identity.</span>
                      </div>
                      <motion.button whileTap={{ scale:.98 }} onClick={handleSendOTP} disabled={sending}
                        style={{ width:'100%', padding:'13px', borderRadius:13, border:'none', background:sending?'#dfe6e2':`linear-gradient(135deg,${ac},${TEAL})`, color:sending?'#9CA79F':'#fff', fontFamily:'inherit', fontWeight:800, fontSize:15, cursor:sending?'not-allowed':'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:9, boxShadow:sending?'none':`0 10px 24px ${ac}40`, transition:'all .2s' }}>
                        {sending?<><div style={{ width:16,height:16,border:'2px solid rgba(255,255,255,.35)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin .7s linear infinite' }} />Sending OTP…</>:<><span>📧</span> Send Verification OTP</>}
                      </motion.button>
                    </div>
                  </motion.div>
                )}

                {/* ── STEP 3: OTP ── */}
                {step===3 && (
                  <motion.div key="s3" initial={{ opacity:0,y:16 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0,y:-16 }}>
                    <div style={{ textAlign:'center', marginBottom:20 }}>
                      <motion.div animate={{ rotate:[0,10,-10,0] }} transition={{ duration:2, repeat:Infinity, repeatDelay:3 }}
                        style={{ fontSize:46, marginBottom:12 }}>📧</motion.div>
                      <h2 style={{ color:'#16241F', fontFamily:"'Manrope',sans-serif", fontWeight:800, fontSize:20, margin:'0 0 8px' }}>Verify Your Email</h2>
                      <p style={{ color:'#6B7A75', fontSize:13.5, lineHeight:1.7, margin:0 }}>
                        We sent a 6-digit code to<br/>
                        <strong style={{ color:'#16241F' }}>{form.email}</strong>
                      </p>
                      <p style={{ color:'#9CA79F', fontSize:12, marginTop:6 }}>Check your inbox and spam folder</p>
                    </div>

                    {devOtp&&(
                      <div style={{ background:'#EFF7F5', border:'1px solid #CDE7E1', borderRadius:12, padding:'11px 14px', marginBottom:18, display:'flex', alignItems:'center', gap:10 }}>
                        <span style={{ fontSize:18 }}>🔧</span>
                        <div>
                          <div style={{ color:'#0F6D63', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:.5 }}>Dev Mode — Server OTP</div>
                          <div style={{ color:'#16241F', fontSize:24, fontWeight:900, fontFamily:"'IBM Plex Mono',monospace", letterSpacing:6, marginTop:2 }}>{devOtp}</div>
                          <div style={{ color:'#9CA79F', fontSize:11, marginTop:2 }}>Remove _dev_otp from response in production</div>
                        </div>
                      </div>
                    )}

                    <div style={{ display:'flex', gap:8, justifyContent:'center', marginBottom:20 }} onPaste={handlePaste}>
                      {otp.map((d,i)=>(
                        <input key={i} ref={el=>otpRefs.current[i]=el}
                          className={`otp-f${d?' has':''}`}
                          style={{ width:44, height:54, border:`2px solid ${d?ac:'#E5DFD2'}`, borderRadius:12, background:d?`${ac}10`:'#FAF7F1', color:d?ac:'#16241F', fontSize:21, fontWeight:800, textAlign:'center', outline:'none', fontFamily:"'IBM Plex Mono',monospace", transition:'all .2s' }}
                          type="text" inputMode="numeric" maxLength={1}
                          value={d} onChange={e=>handleOtpInput(i,e.target.value)} onKeyDown={e=>handleOtpKey(i,e)} />
                      ))}
                    </div>

                    <motion.button whileTap={{ scale:.98 }} onClick={handleRegister} disabled={registering||otp.join('').length<6}
                      style={{ width:'100%', padding:'13px', borderRadius:13, border:'none', background:otp.join('').length===6&&!registering?`linear-gradient(135deg,${ac},${TEAL})`:'#dfe6e2', color:otp.join('').length===6&&!registering?'#fff':'#9CA79F', fontFamily:'inherit', fontWeight:800, fontSize:15, cursor:otp.join('').length===6&&!registering?'pointer':'not-allowed', display:'flex', alignItems:'center', justifyContent:'center', gap:9, marginBottom:14, boxShadow:otp.join('').length===6?`0 10px 24px ${ac}40`:'none', transition:'all .2s' }}>
                      {registering?<><div style={{ width:16,height:16,border:'2px solid rgba(255,255,255,.35)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin .7s linear infinite' }} />Creating account…</>:<>✓ Verify &amp; Create Account</>}
                    </motion.button>

                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                      <button onClick={()=>setStep(2)} style={{ background:'none', border:'none', color:'#9CA79F', cursor:'pointer', fontSize:13, fontFamily:'inherit' }}>← Change email</button>
                      <button onClick={resendOTP} disabled={resendTimer>0||sending}
                        style={{ background:'none', border:'none', color:resendTimer>0?'#c7cec9':ac, cursor:resendTimer>0?'not-allowed':'pointer', fontSize:13, fontFamily:'inherit', fontWeight:600 }}>
                        {resendTimer>0?`Resend in ${resendTimer}s`:'Resend OTP'}
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* ── STEP 4: SUCCESS ── */}
                {step===4 && (
                  <motion.div key="s4" initial={{ opacity:0,scale:.95 }} animate={{ opacity:1,scale:1 }} style={{ textAlign:'center', padding:'8px 0' }}>
                    <motion.div initial={{ scale:0 }} animate={{ scale:1 }} transition={{ type:'spring', bounce:.5, delay:.1 }}
                      style={{ width:76, height:76, borderRadius:'50%', background:`linear-gradient(135deg,${TEAL},#0d6e65)`, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 18px', boxShadow:`0 14px 32px ${TEAL}55` }}>
                      <motion.svg width="32" height="32" viewBox="0 0 34 34">
                        <motion.path d="M7 17l7 7 13-14" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none"
                          initial={{ pathLength:0 }} animate={{ pathLength:1 }} transition={{ delay:.3, duration:.5 }} />
                      </motion.svg>
                    </motion.div>
                    <h2 style={{ color:'#16241F', fontFamily:"'Manrope',sans-serif", fontWeight:800, fontSize:21, margin:'0 0 10px' }}>
                      {form.role==='patient'?'Account Created! 🎉':'Registration Submitted! 🎉'}
                    </h2>
                    <p style={{ color:'#6B7A75', fontSize:14, lineHeight:1.7, margin:'0 0 26px' }}>
                      {form.role==='patient'
                        ? 'Email verified. Your patient account is now active. You can login immediately.'
                        : `Email verified! Your ${sel.label} account is pending admin approval. You will receive an email at ${form.email} once approved.`
                      }
                    </p>
                    <motion.button whileTap={{ scale:.98 }} onClick={()=>nav('/login')}
                      style={{ width:'100%', padding:'13px', borderRadius:13, border:'none', background:`linear-gradient(135deg,${ac},${TEAL})`, color:'#fff', fontFamily:'inherit', fontWeight:800, fontSize:15, cursor:'pointer', boxShadow:`0 10px 24px ${ac}40` }}>
                      Go to Login →
                    </motion.button>
                  </motion.div>
                )}

              </AnimatePresence>
            </div>
            <motion.div key={ac+'-bot'} style={{ height:3, background:`linear-gradient(90deg,transparent,${ac},transparent)`, originX:.5 }} initial={{ scaleX:0 }} animate={{ scaleX:1 }} transition={{ delay:.4, duration:.5 }} />
          </div>

          <div style={{ textAlign:'center', marginTop:16, fontSize:13, color:'#6B7A75' }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color:ac, fontWeight:700, textDecoration:'none' }}>Sign in →</Link>
          </div>

          <div style={{ marginTop:22, textAlign:'center' }}>
            <span style={{ fontSize:12, fontStyle:'italic', color:'#9CA79F' }}>
              Designed &amp; developed by <span style={{ color:'#6B7A75', fontWeight:700, fontStyle:'normal' }}>Shubham Kumar</span>
            </span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
