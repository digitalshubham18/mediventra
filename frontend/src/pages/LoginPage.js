import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { LANGUAGES } from '../i18n/translations';
import { authAPI } from '../utils/api';
import toast from 'react-hot-toast';

const ROLE_COLOR = { admin:'#2563eb',doctor:'#0891b2',patient:'#0ea5e9',nurse:'#db2777',pharmacist:'#d97706',wardboy:'#059669',sweeper:'#f59e0b',otboy:'#ef4444',finance:'#8b5cf6',electrician:'#f59e0b',plumber:'#0891b2',it_technician:'#2563eb',equipment_tech:'#8b5cf6',biomedical:'#059669',security:'#374151',receptionist:'#db2777',ambulance_driver:'#dc2626',lab_technician:'#0d9488',radiology_tech:'#0e7490',dialysis_tech:'#be123c' };

// ── Signature palette: "vitals monitor" — a deep clinical teal-ink panel with
// warm chart-paper on the form side, instead of the generic dark-indigo-glow
// look. Mono type is reserved for anything that reads like instrument data
// (the OTP code, the live readout) so it carries real meaning, not decoration.
const INK   = '#0A2626';
const TEAL  = '#159488';
const TEAL2 = '#5EEAD4';
const PAPER = '#FAF7F1';

// Health facts + thoughts shown on the login screen — a mix of genuine
// medical/wellness facts and short reflective quotes, kept distinct with an
// icon + category tag so it reads as "did you know" rather than filler text.
const FACTS = [
  { icon:'❤️', tag:'Did you know', text:'The human heart beats about 100,000 times a day, pumping roughly 7,500 litres of blood.' },
  { icon:'💧', tag:'Wellness', text:'Drinking water first thing in the morning helps kickstart metabolism and rehydrate the body after sleep.' },
  { icon:'🧠', tag:'Did you know', text:'Your brain uses about 20% of your body\u2019s total energy, despite being only 2% of your body weight.' },
  { icon:'😴', tag:'Wellness', text:'Adults who consistently sleep 7-9 hours a night have measurably stronger immune responses.' },
  { icon:'🩺', tag:'Thought', text:'"Wherever the art of medicine is loved, there is also a love of humanity." — Hippocrates' },
  { icon:'🫁', tag:'Did you know', text:'Your lungs contain nearly 300 million tiny air sacs called alveoli — roughly the surface area of a tennis court.' },
  { icon:'🥗', tag:'Wellness', text:'Eating a rainbow of vegetables daily gives your body a wider range of antioxidants than any single "superfood".' },
  { icon:'🚶', tag:'Wellness', text:'Just 20 minutes of brisk walking a day is linked to a longer life expectancy, regardless of body weight.' },
  { icon:'🩹', tag:'Did you know', text:'Skin is the body\u2019s largest organ — an adult\u2019s skin covers about 2 square metres and weighs around 4kg.' },
  { icon:'🌿', tag:'Thought', text:'"Health is not valued until sickness comes." — Thomas Fuller' },
  { icon:'🦴', tag:'Did you know', text:'Newborn babies have about 300 bones, but adults have only 206 — many fuse together while growing up.' },
  { icon:'🩸', tag:'Did you know', text:'A single drop of blood contains around 5 million red blood cells, carrying oxygen to every part of your body.' },
  { icon:'😊', tag:'Thought', text:'A patient\u2019s sense of being heard is often as important to recovery as the treatment itself.' },
  { icon:'🧬', tag:'Did you know', text:'Every person\u2019s body replaces millions of cells every second — most of your skin is renewed within a month.' },
  { icon:'🫀', tag:'Wellness', text:'Laughing genuinely increases blood flow by up to 20%, giving your cardiovascular system a gentle workout.' },
];

// Fisher-Yates shuffle — used to build a fresh, non-repeating viewing order
// each time we cycle through the full list.
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Small stroke-based icon set — replaces emoji glyphs in form controls so
// the page reads as designed UI rather than borrowed platform glyphs.
const Icon = {
  Mail: (p) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3.5 6.5l8.5 6 8.5-6"/></svg>,
  Lock: (p) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="4.5" y="10.5" width="15" height="10" rx="2.2"/><path d="M8 10.5V7.5a4 4 0 018 0v3"/></svg>,
  Eye: (p) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M2 12s3.8-7 10-7 10 7 10 7-3.8 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>,
  EyeOff: (p) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 3l18 18"/><path d="M10.6 5.2A10.4 10.4 0 0112 5c6.2 0 10 7 10 7a17.9 17.9 0 01-3.5 4.4M6.6 6.6C4 8.3 2 12 2 12s3.8 7 10 7c1.3 0 2.5-.3 3.6-.8"/><path d="M9.9 9.9a3 3 0 004.2 4.2"/></svg>,
  Key: (p) => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="8" cy="15" r="4.2"/><path d="M11 12.2L19.5 3.7M16.5 6.7l2.3 2.3M14 9.2l1.8 1.8"/></svg>,
  Shield: (p) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 3l7 3v6c0 4.6-3 8.4-7 9.5-4-1.1-7-4.9-7-9.5V6l7-3z"/><path d="M9 12l2 2 4-4.2"/></svg>,
  Cross: (p) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...p}><path d="M12 4v16M4 12h16"/></svg>,
};

export default function LoginPage() {
  const nav  = useNavigate();
  const location = useLocation();
  const { login, verifyTwoFactor, isAuthenticated, logout } = useAuth();
  const { t, language, setLanguage } = useLanguage() || {};
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [errors,   setErrors]   = useState({});
  const [twoFAStep, setTwoFAStep] = useState(false);
  const [twoFAEmail, setTwoFAEmail] = useState('');
  const [twoFACode, setTwoFACode] = useState('');
  const [verifying2FA, setVerifying2FA] = useState(false);

  // ── Auto-sliding facts/thoughts — cycles through every fact in a
  // shuffled order before any repeat is possible, then reshuffles for the
  // next lap (taking care the new lap doesn't start with what just played).
  const [factOrder, setFactOrder] = useState(() => shuffle(FACTS.map((_, i) => i)));
  const [factPos, setFactPos] = useState(0);
  const factTimer = useRef(null);

  useEffect(() => {
    factTimer.current = setInterval(() => {
      setFactPos(pos => {
        const next = pos + 1;
        if (next >= factOrder.length) {
          setFactOrder(prevOrder => {
            const lastShown = prevOrder[prevOrder.length - 1];
            let reshuffled = shuffle(FACTS.map((_, i) => i));
            // avoid the same fact appearing twice in a row across the seam
            if (reshuffled[0] === lastShown && reshuffled.length > 1) {
              [reshuffled[0], reshuffled[1]] = [reshuffled[1], reshuffled[0]];
            }
            return reshuffled;
          });
          return 0;
        }
        return next;
      });
    }, 6000);
    return () => clearInterval(factTimer.current);
  }, [factOrder.length]);

  const currentFact = FACTS[factOrder[factPos]] || FACTS[0];

  // Forgot password state
  const [forgotMode,  setForgotMode]  = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOtp,   setForgotOtp]   = useState('');
  const [forgotPass,  setForgotPass]  = useState('');
  const [forgotStep,  setForgotStep]  = useState('email'); // email | otp | done
  const [forgotLoad,  setForgotLoad]  = useState(false);
  const [devOtp,      setDevOtp]      = useState('');

  const validate = () => {
    const e = {};
    if (!email) e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'Enter a valid email';
    if (!password) e.password = 'Password is required';
    return e;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setLoading(true);
    try {
      // Switching accounts: fully clear the previous session first so no
      // stale cached data, token, or socket connection leaks into the new
      // login (this is what previously forced people to log out manually,
      // then log back in, before they could see the right dashboard).
      if (isAuthenticated) await logout();
      const result = await login(email, password);

      // Real 2FA — the backend hasn't issued a token yet; it emailed a
      // one-time code and is waiting for it before this login completes.
      if (result?.requiresTwoFactor) {
        setTwoFAEmail(result.email);
        setTwoFAStep(true);
        toast.success('📧 A verification code has been sent to your email');
        setLoading(false);
        return;
      }

      toast.success(`Welcome back, ${result.name?.split(' ')[0]}! 👋`);
      // Return to whatever page sent the user here (e.g. a "Complete
      // Documentation" link from an email) instead of always landing on
      // the generic dashboard.
      nav(location.state?.from || '/dashboard');
    } catch(err) {
      const msg = err.response?.data?.error || 'Login failed. Please try again.';
      toast.error(msg);
      if (msg.includes('password')) setErrors({ password: msg });
      else if (msg.includes('email') || msg.includes('Invalid')) setErrors({ email: msg });
    }
    setLoading(false);
  };

  const submitTwoFA = async (e) => {
    e.preventDefault();
    if (!twoFACode.trim() || twoFACode.trim().length < 6) { toast.error('Enter the 6-digit code'); return; }
    setVerifying2FA(true);
    try {
      const userData = await verifyTwoFactor(twoFAEmail, twoFACode.trim());
      toast.success(`Welcome back, ${userData.name?.split(' ')[0]}! 👋`);
      nav(location.state?.from || '/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Invalid or expired code');
    }
    setVerifying2FA(false);
  };

  const resend2FA = async () => {
    try {
      await login(email, password);
      toast.success('📧 New code sent!');
    } catch (err) { toast.error('Failed to resend code'); }
  };

  const handleForgotSend = async () => {
    if (!forgotEmail.trim()) { toast.error('Enter your email'); return; }
    setForgotLoad(true);
    try {
      const res = await authAPI.forgotPassword(forgotEmail);
      setForgotStep('otp');
      setDevOtp(res.data._dev_otp || '');
      toast.success(res.data.emailSent ? 'OTP sent to your email!' : 'OTP generated — check server console');
    } catch(e) { toast.error(e.response?.data?.error || 'Email not found'); }
    setForgotLoad(false);
  };

  const handleForgotReset = async () => {
    if (!forgotOtp || !forgotPass) { toast.error('Fill all fields'); return; }
    if (forgotPass.length < 8) { toast.error('Password min 8 characters'); return; }
    if (!/[a-zA-Z]/.test(forgotPass) || !/[0-9]/.test(forgotPass)) { toast.error('Password must include a letter and a number'); return; }
    setForgotLoad(true);
    try {
      await authAPI.resetPassword({ email:forgotEmail, otp:forgotOtp, newPassword:forgotPass });
      setForgotStep('done');
      toast.success('Password reset successfully!');
    } catch(e) { toast.error(e.response?.data?.error || 'Invalid OTP'); }
    setForgotLoad(false);
  };

  const resetForgot = () => { setForgotMode(false); setForgotStep('email'); setForgotEmail(''); setForgotOtp(''); setForgotPass(''); setDevOtp(''); };

  // ── "Vitals Chart" input style — rounded rectangle, room for a left icon ──
  const CS = (err) => ({
    width:'100%', padding:'13px 16px 13px 42px',
    border:`1.5px solid ${err?'#dc6a5a':'#E5DFD2'}`,
    borderRadius:12, fontFamily:"'IBM Plex Sans',sans-serif", fontSize:14, outline:'none',
    background:'#fff', color:'#16241F', boxSizing:'border-box',
    transition:'all .2s',
  });

  return (
    <div style={{ minHeight:'100vh', display:'flex', fontFamily:"'IBM Plex Sans',sans-serif", background:PAPER }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@600;700;800&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600;700&display=swap');
        * { box-sizing:border-box; }
        @keyframes spin { to { transform:rotate(360deg) } }
        @keyframes ecgDraw { 0% { stroke-dashoffset:600 } 60% { stroke-dashoffset:0 } 100% { stroke-dashoffset:-600 } }
        @keyframes ecgDot { 0%,100% { opacity:.3 } 50% { opacity:1 } }
        @keyframes chartDrift { 0%,100%{ transform:translate(0,0) } 50%{ transform:translate(14px,-16px) } }
        input::placeholder { color:#9CA79F; }
        .aur-inp:focus { border-color:${TEAL} !important; box-shadow:0 0 0 3px rgba(21,148,136,.15) !important; }
        @media (max-width: 860px) { .aurora-panel { display:none !important; } .mobile-logo { display:block !important; } }
      `}</style>

      {/* ── LEFT: Vitals-monitor panel (hidden on narrow viewports) ── */}
      <div className="aurora-panel" style={{ flex:'0 0 44%', position:'relative', background:`linear-gradient(165deg, ${INK} 0%, #123B3D 55%, ${INK} 100%)`, overflow:'hidden', display:'flex', flexDirection:'column', justifyContent:'space-between', padding:'52px 48px' }}>
        {/* faint chart-grid texture */}
        <div style={{ position:'absolute', inset:0, backgroundImage:'linear-gradient(rgba(94,234,212,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(94,234,212,.05) 1px, transparent 1px)', backgroundSize:'28px 28px', pointerEvents:'none' }} />
        <div style={{ position:'absolute', top:'4%', left:'-10%', width:280, height:280, borderRadius:'50%', background:'radial-gradient(circle,rgba(94,234,212,.14),transparent 70%)', animation:'chartDrift 11s ease-in-out infinite', pointerEvents:'none' }} />

        {/* Identity */}
        <div style={{ position:'relative' }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:10 }}>
            <div style={{ width:42, height:42, borderRadius:11, background:'rgba(94,234,212,.14)', border:'1.5px solid rgba(94,234,212,.4)', display:'flex', alignItems:'center', justifyContent:'center', color:TEAL2 }}><Icon.Cross /></div>
            <span style={{ color:'#EAF6F2', fontFamily:"'Manrope',sans-serif", fontWeight:800, fontSize:20, letterSpacing:-.3 }}>Mediventra</span>
          </div>
          <p style={{ color:'rgba(234,246,242,.5)', fontSize:13, margin:0, maxWidth:300, lineHeight:1.6 }}>One system of record for every department — appointments, charts, pharmacy, payroll, and the people who keep a hospital running.</p>
        </div>

        {/* Signature visual: an animated ECG / vitals trace, in place of a
            generic glow-orbit — literal to what this platform actually
            monitors, and pairs with the mono readout beside it. */}
        <div style={{ position:'relative' }}>
          <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:10 }}>
            <span style={{ width:7, height:7, borderRadius:'50%', background:'#4ADE80', animation:'ecgDot 1.6s ease-in-out infinite' }} />
            <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, fontWeight:600, color:'rgba(234,246,242,.55)', letterSpacing:1 }}>LIVE SYSTEM · 100% UPTIME</span>
          </div>
          <div style={{ border:'1px solid rgba(94,234,212,.22)', borderRadius:14, background:'rgba(255,255,255,.03)', padding:'14px 6px' }}>
            <svg width="100%" height="64" viewBox="0 0 320 64" preserveAspectRatio="none">
              <path d="M0 32 L50 32 L62 32 L70 12 L78 52 L86 20 L94 32 L110 32 L320 32"
                fill="none" stroke={TEAL2} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
                strokeDasharray="600" style={{ animation:'ecgDraw 3.4s linear infinite' }} />
            </svg>
          </div>
        </div>

        {/* Auto-sliding facts & thoughts — full cycle before any repeat */}
        <div style={{ position:'relative', minHeight:92, marginTop:26 }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={factOrder[factPos]}
              initial={{ opacity:0, y:10 }}
              animate={{ opacity:1, y:0 }}
              exit={{ opacity:0, y:-10 }}
              transition={{ duration:.45, ease:[.22,1,.36,1] }}
              style={{ background:'rgba(255,255,255,.04)', border:'1px solid rgba(94,234,212,.18)', borderRadius:14, padding:'14px 16px' }}
            >
              <div style={{ display:'flex', alignItems:'flex-start', gap:11 }}>
                <span style={{ fontSize:21, flexShrink:0, marginTop:1 }}>{currentFact.icon}</span>
                <div>
                  <div style={{ color:TEAL2, fontSize:10, fontWeight:700, letterSpacing:1, textTransform:'uppercase', marginBottom:4 }}>{currentFact.tag}</div>
                  <div style={{ color:'rgba(234,246,242,.85)', fontSize:12.5, lineHeight:1.55 }}>{currentFact.text}</div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
          {/* Progress dots — one per fact in the current shuffled lap */}
          <div style={{ display:'flex', gap:4, marginTop:9, paddingLeft:2 }}>
            {factOrder.map((_, i) => (
              <div key={i} style={{ height:3, flex:1, maxWidth:18, borderRadius:2, background: i===factPos ? TEAL2 : 'rgba(255,255,255,.15)', transition:'background .3s' }} />
            ))}
          </div>
        </div>

        {/* Live stats strip */}
        <div style={{ position:'relative', display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:14, marginTop:26, marginBottom:26 }}>
          {[['17','Staff Roles'],['24/7','Emergency Desk'],['100%','Digital Records']].map(([v,l]) => (
            <div key={l}>
              <div style={{ color:TEAL2, fontFamily:"'IBM Plex Mono',monospace", fontWeight:700, fontSize:20 }}>{v}</div>
              <div style={{ color:'rgba(234,246,242,.45)', fontSize:11, marginTop:2 }}>{l}</div>
            </div>
          ))}
        </div>

        {/* Role badges */}
        <div style={{ position:'relative' }}>
          <div style={{ color:'rgba(234,246,242,.4)', fontSize:10.5, fontWeight:700, letterSpacing:1.2, textTransform:'uppercase', marginBottom:10 }}>Built for every role</div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {['doctor','nurse','patient','pharmacist','receptionist','wardboy','security','finance'].map(r => (
              <div key={r} style={{ padding:'4px 11px', borderRadius:8, background:`${ROLE_COLOR[r]}26`, border:`1px solid ${ROLE_COLOR[r]}55`, fontSize:11, color:'#EAF6F2', fontWeight:600, textTransform:'capitalize' }}>{r}</div>
            ))}
            <div style={{ padding:'4px 11px', borderRadius:8, background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.12)', fontSize:11, color:'rgba(234,246,242,.5)', fontWeight:600 }}>+9 more</div>
          </div>
        </div>
      </div>

      {/* ── RIGHT: Login card ── */}
      <div style={{ flex:'1 1 56%', display:'flex', alignItems:'center', justifyContent:'center', padding:'32px 20px', position:'relative' }}>
        <motion.div initial={{ opacity:0, y:18 }} animate={{ opacity:1, y:0 }} transition={{ duration:.5, ease:[.22,1,.36,1] }}
          style={{ width:'100%', maxWidth:400 }}>

          {/* Mobile-only compact logo (vitals panel hidden below 860px) */}
          <div className="mobile-logo" style={{ textAlign:'center', marginBottom:22, display:'none' }}>
            <div style={{ width:46,height:46,background:`linear-gradient(135deg,${TEAL},#0d6e65)`,borderRadius:12,margin:'0 auto 10px',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff' }}><Icon.Cross /></div>
            <h1 style={{ color:'#16241F', fontFamily:"'Manrope',sans-serif", fontWeight:800, fontSize:19, margin:0 }}>Mediventra</h1>
          </div>

          <div style={{ marginBottom:28 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, flexWrap:'wrap', gap:8 }}>
              <div style={{ display:'inline-flex', alignItems:'center', gap:6, background:'#EFF7F5', border:'1px solid #CDE7E1', borderRadius:8, padding:'4px 12px' }}>
                <span style={{ width:6, height:6, borderRadius:'50%', background:TEAL, display:'inline-block' }} />
                <span style={{ fontSize:11, fontWeight:700, color:'#0F6D63', letterSpacing:.3 }}>Patient Portal & Staff Console</span>
              </div>
              {setLanguage && LANGUAGES.length > 1 && (
                <div style={{ display:'flex', gap:4, background:'#fff', border:'1px solid #E5DFD2', borderRadius:8, padding:3 }}>
                  {LANGUAGES.map(l=>(
                    <button key={l.code} type="button" onClick={()=>setLanguage(l.code)}
                      style={{ padding:'4px 10px', borderRadius:6, border:'none', background:language===l.code?TEAL:'transparent', color:language===l.code?'#fff':'#57675F', fontSize:11.5, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                      {l.flag} {l.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <h2 style={{ color:'#16241F', fontFamily:"'Manrope',sans-serif", fontWeight:800, fontSize:29, margin:'0 0 8px', letterSpacing:-.5 }}>{t ? t('auth.welcomeBack') : 'Welcome back'}</h2>
            <p style={{ color:'#6B7A75', fontSize:14, margin:0 }}>{t ? t('auth.signInSubtitle') : 'Sign in to continue to your dashboard'}</p>
          </div>

          {!twoFAStep ? (
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom:16 }}>
              <label style={{ display:'block',fontSize:11,fontWeight:700,color:'#57675F',letterSpacing:.5,marginBottom:6 }}>{t ? t('auth.email') : 'Email Address'}</label>
              <div style={{ position:'relative' }}>
                <span style={{ position:'absolute', left:15, top:'50%', transform:'translateY(-50%)', color:'#9CA79F', display:'flex' }}><Icon.Mail /></span>
                <input className="aur-inp" type="email" value={email} onChange={e=>{setEmail(e.target.value);setErrors(er=>({...er,email:''}));}}
                  placeholder="your@email.com" autoComplete="email"
                  style={CS(errors.email)} />
              </div>
              {errors.email && <span style={{ fontSize:11.5,color:'#c0392b',display:'block',marginTop:4 }}>{errors.email}</span>}
            </div>

            <div style={{ marginBottom:8 }}>
              <label style={{ display:'block',fontSize:11,fontWeight:700,color:'#57675F',letterSpacing:.5,marginBottom:6 }}>{t ? t('auth.password') : 'Password'}</label>
              <div style={{ position:'relative' }}>
                <span style={{ position:'absolute', left:15, top:'50%', transform:'translateY(-50%)', color:'#9CA79F', display:'flex' }}><Icon.Lock /></span>
                <input className="aur-inp" type={showPass?'text':'password'} value={password} onChange={e=>{setPassword(e.target.value);setErrors(er=>({...er,password:''}));}}
                  placeholder="Your password" autoComplete="current-password"
                  style={{ ...CS(errors.password), paddingRight:44 }} />
                <button type="button" onClick={()=>setShowPass(p=>!p)}
                  style={{ position:'absolute',right:13,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:'#9CA79F',padding:3,display:'flex' }}>
                  {showPass?<Icon.EyeOff/>:<Icon.Eye/>}
                </button>
              </div>
              {errors.password && <span style={{ fontSize:11.5,color:'#c0392b',display:'block',marginTop:4 }}>{errors.password}</span>}
            </div>

            <div style={{ textAlign:'right', marginBottom:22 }}>
              <button type="button" onClick={()=>setForgotMode(true)}
                style={{ background:'none',border:'none',color:TEAL,cursor:'pointer',fontSize:12.5,fontFamily:'inherit',fontWeight:700 }}>
                {t ? t('auth.forgotPassword') : 'Forgot password?'}
              </button>
            </div>

            <motion.button type="submit" disabled={loading} whileTap={{ scale:.98 }}
              style={{ width:'100%',padding:'14px',borderRadius:12,border:'none',background:loading?'#cbd0cb':`linear-gradient(135deg,${TEAL},#0d6e65)`,color:'#fff',fontFamily:"'Manrope',sans-serif",fontWeight:800,fontSize:15,cursor:loading?'not-allowed':'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:9,boxShadow:loading?'none':`0 10px 26px ${TEAL}40`,transition:'all .2s' }}>
              {loading ? <><div style={{ width:17,height:17,border:'2px solid rgba(255,255,255,.35)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin .7s linear infinite' }} />{t ? t('action.loading') : 'Signing in…'}</> : (t ? `${t('auth.signIn')} →` : 'Sign In →')}
            </motion.button>

            <div style={{ display:'flex', alignItems:'center', gap:12, margin:'18px 0' }}>
              <div style={{ flex:1, height:1, background:'#E5DFD2' }} />
              <span style={{ fontSize:11.5, color:'#9CA79F' }}>or continue with</span>
              <div style={{ flex:1, height:1, background:'#E5DFD2' }} />
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button type="button" onClick={()=>{ window.location.href = `${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/auth/google`; }}
                style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'12px', borderRadius:12, border:'1.5px solid #E5DFD2', background:'#fff', cursor:'pointer', fontFamily:'inherit', fontWeight:700, fontSize:13.5, color:'#16241F' }}>
                <svg width="17" height="17" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.5-5.2l-6.2-5.3C29.3 35.1 26.8 36 24 36c-5.2 0-9.6-3.1-11.3-7.6l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.5l6.2 5.3C40.5 36.4 44 30.7 44 24c0-1.3-.1-2.7-.4-3.5z"/></svg>
                Google
              </button>
              <button type="button" onClick={()=>{ window.location.href = `${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/auth/github`; }}
                style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'12px', borderRadius:12, border:'1.5px solid #E5DFD2', background:'#fff', cursor:'pointer', fontFamily:'inherit', fontWeight:700, fontSize:13.5, color:'#16241F' }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="#181717"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.11.82-.26.82-.577 0-.286-.01-1.04-.015-2.04-3.338.725-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.84 1.237 1.84 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.42-1.305.763-1.605-2.665-.303-5.466-1.332-5.466-5.93 0-1.31.469-2.38 1.236-3.22-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.5 11.5 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.29-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.91 1.235 3.22 0 4.61-2.807 5.624-5.48 5.92.43.372.823 1.102.823 2.222 0 1.606-.015 2.896-.015 3.286 0 .32.216.694.825.576C20.565 21.795 24 17.298 24 12c0-6.63-5.37-12-12-12z"/></svg>
                GitHub
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={submitTwoFA}>
            <div style={{ textAlign:'center', marginBottom:20 }}>
              <div style={{ display:'flex', justifyContent:'center', marginBottom:10, color:TEAL }}><Icon.Shield style={{ width:40, height:40 }}/></div>
              <p style={{ fontSize:13.5, color:'#57675F', lineHeight:1.6, margin:0 }}>
                Two-factor authentication is on for this account.<br/>
                Enter the 6-digit code sent to<br/><strong style={{ color:'#16241F' }}>{twoFAEmail}</strong>
              </p>
            </div>
            <input className="aur-inp" type="text" inputMode="numeric" maxLength={6} autoFocus
              value={twoFACode} onChange={e=>setTwoFACode(e.target.value.replace(/\D/g,''))}
              placeholder="123456"
              style={{ ...CS(false), paddingLeft:16, textAlign:'center', fontSize:24, fontWeight:700, letterSpacing:8, marginBottom:16, fontFamily:"'IBM Plex Mono',monospace" }} />
            <motion.button type="submit" disabled={verifying2FA} whileTap={{ scale:.98 }}
              style={{ width:'100%',padding:'14px',borderRadius:12,border:'none',background:verifying2FA?'#cbd0cb':`linear-gradient(135deg,${TEAL},#0d6e65)`,color:'#fff',fontFamily:"'Manrope',sans-serif",fontWeight:800,fontSize:15,cursor:verifying2FA?'not-allowed':'pointer',marginBottom:14 }}>
              {verifying2FA ? 'Verifying…' : '✓ Verify & Sign In'}
            </motion.button>
            <div style={{ display:'flex', justifyContent:'space-between' }}>
              <button type="button" onClick={()=>{setTwoFAStep(false);setTwoFACode('');}} style={{ background:'none',border:'none',color:'#9CA79F',cursor:'pointer',fontSize:13,fontFamily:'inherit' }}>← Back</button>
              <button type="button" onClick={resend2FA} style={{ background:'none',border:'none',color:TEAL,cursor:'pointer',fontSize:13,fontFamily:'inherit',fontWeight:700 }}>Resend code</button>
            </div>
          </form>
        )}

          <p style={{ textAlign:'center', marginTop:22, fontSize:13.5, color:'#6B7A75' }}>
            {t ? t('auth.noAccount') : "Don't have an account?"}{' '}
            <Link to="/register" style={{ color:TEAL,fontWeight:700,textDecoration:'none' }}>{t ? t('auth.createOne') : 'Create one'} →</Link>
          </p>

          <div style={{ marginTop:28, paddingTop:20, borderTop:'1px solid #E5DFD2', textAlign:'center' }}>
            <span style={{ fontSize:11.5, color:'#9CA79F', display:'inline-flex', alignItems:'center', gap:6 }}><Icon.Lock style={{ width:12, height:12 }}/> Your health data is encrypted and access-controlled</span>
            <div style={{ marginTop:10, fontSize:12, fontStyle:'italic', color:'#9CA79F' }}>Designed &amp; developed by <span style={{ color:'#6B7A75', fontWeight:700, fontStyle:'normal' }}>Shubham Kumar</span></div>
          </div>
        </motion.div>
      </div>

      {/* ── FORGOT PASSWORD MODAL ── */}
      <AnimatePresence>
        {forgotMode && (
          <div onClick={e=>{if(e.target===e.currentTarget)resetForgot();}}
            style={{ position:'fixed',inset:0,background:'rgba(10,38,38,.55)',backdropFilter:'blur(6px)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:10000,padding:20 }}>
            <motion.div initial={{ opacity:0,y:22,scale:.95 }} animate={{ opacity:1,y:0,scale:1 }} exit={{ opacity:0,y:22,scale:.95 }}
              style={{ background:'#fff',border:'1px solid #E5DFD2',borderRadius:18,width:'100%',maxWidth:400,overflow:'hidden',boxShadow:'0 40px 80px rgba(10,38,38,.3)' }}>
              <div style={{ background:`linear-gradient(135deg,${TEAL},#0d6e65)`,padding:'20px 24px' }}>
                <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between' }}>
                  <h3 style={{ color:'#fff',fontWeight:800,fontSize:17,margin:0,fontFamily:"'Manrope',sans-serif",display:'flex',alignItems:'center',gap:8 }}>
                    {forgotStep==='email'?<><Icon.Key/> Reset Password</>:forgotStep==='otp'?<><Icon.Mail/> Enter OTP</>:<><Icon.Shield/> Password Reset!</>}
                  </h3>
                  <button onClick={resetForgot} style={{ background:'rgba(255,255,255,.2)',border:'none',borderRadius:8,width:28,height:28,cursor:'pointer',color:'#fff',fontSize:13,display:'flex',alignItems:'center',justifyContent:'center' }}>✕</button>
                </div>
                <p style={{ color:'rgba(255,255,255,.85)',fontSize:12.5,margin:'5px 0 0' }}>
                  {forgotStep==='email'?'Enter your registered email to receive an OTP':forgotStep==='otp'?'Enter the OTP sent to your email and your new password':'Your password has been reset successfully'}
                </p>
              </div>

              <div style={{ padding:'24px' }}>
                {forgotStep==='done' ? (
                  <div style={{ textAlign:'center',padding:'10px 0' }}>
                    <div style={{ fontSize:52,marginBottom:12 }}>🎉</div>
                    <div style={{ color:'#16241F',fontWeight:700,fontSize:16,marginBottom:6 }}>Password reset successfully!</div>
                    <div style={{ color:'#6B7A75',fontSize:13,marginBottom:20 }}>You can now login with your new password</div>
                    <button onClick={resetForgot} style={{ width:'100%',padding:'12px',borderRadius:12,border:'none',background:`linear-gradient(135deg,${TEAL},#0d6e65)`,color:'#fff',fontFamily:"'Manrope',sans-serif",fontWeight:800,cursor:'pointer',fontSize:14 }}>Go to Login →</button>
                  </div>
                ) : forgotStep==='email' ? (
                  <div>
                    <label style={{ display:'block',fontSize:11,fontWeight:700,color:'#57675F',letterSpacing:.5,marginBottom:6 }}>Registered Email</label>
                    <input className="aur-inp" type="email" value={forgotEmail} onChange={e=>setForgotEmail(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleForgotSend()}
                      placeholder="your@email.com"
                      style={{ ...CS(false),paddingLeft:16,marginBottom:14 }} />
                    <button onClick={handleForgotSend} disabled={forgotLoad}
                      style={{ width:'100%',padding:'12px',borderRadius:12,border:'none',background:forgotLoad?'#cbd0cb':`linear-gradient(135deg,${TEAL},#0d6e65)`,color:'#fff',fontFamily:"'Manrope',sans-serif",fontWeight:800,cursor:forgotLoad?'not-allowed':'pointer',fontSize:14,display:'flex',alignItems:'center',justifyContent:'center',gap:8 }}>
                      {forgotLoad?<><div style={{ width:15,height:15,border:'2px solid rgba(255,255,255,.4)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin .7s linear infinite' }} />Sending…</>:'Send OTP →'}
                    </button>
                  </div>
                ) : (
                  <div>
                    {devOtp && (
                      <div style={{ background:'#EFF7F5',border:'1px solid #CDE7E1',borderRadius:11,padding:'10px 13px',marginBottom:14,display:'flex',gap:9 }}>
                        <span>🔧</span>
                        <div>
                          <div style={{ color:'#0F6D63',fontSize:10.5,fontWeight:700,textTransform:'uppercase',letterSpacing:.5 }}>Dev OTP</div>
                          <div style={{ color:'#16241F',fontSize:22,fontWeight:700,fontFamily:"'IBM Plex Mono',monospace",letterSpacing:5,marginTop:2 }}>{devOtp}</div>
                        </div>
                      </div>
                    )}
                    <div style={{ marginBottom:12 }}>
                      <label style={{ display:'block',fontSize:11,fontWeight:700,color:'#57675F',letterSpacing:.5,marginBottom:6 }}>6-Digit OTP</label>
                      <input className="aur-inp" type="text" inputMode="numeric" maxLength={6} value={forgotOtp} onChange={e=>setForgotOtp(e.target.value.replace(/\D/g,'').slice(0,6))}
                        placeholder="● ● ● ● ● ●"
                        style={{ ...CS(false),paddingLeft:16,fontFamily:"'IBM Plex Mono',monospace",fontSize:20,letterSpacing:6,textAlign:'center' }} />
                    </div>
                    <div style={{ marginBottom:16 }}>
                      <label style={{ display:'block',fontSize:11,fontWeight:700,color:'#57675F',letterSpacing:.5,marginBottom:6 }}>New Password</label>
                      <input className="aur-inp" type="password" value={forgotPass} onChange={e=>setForgotPass(e.target.value)} placeholder="8+ chars, incl. a letter & number"
                        style={{ ...CS(false),paddingLeft:16 }} />
                    </div>
                    <div style={{ display:'flex',gap:8 }}>
                      <button onClick={()=>setForgotStep('email')} style={{ flex:1,padding:'11px',borderRadius:11,border:'1px solid #E5DFD2',background:'#FAF7F1',color:'#57675F',fontFamily:'inherit',fontWeight:700,cursor:'pointer',fontSize:13 }}>← Back</button>
                      <button onClick={handleForgotReset} disabled={forgotLoad}
                        style={{ flex:2,padding:'11px',borderRadius:11,border:'none',background:forgotLoad?'#cbd0cb':`linear-gradient(135deg,${TEAL},#0d6e65)`,color:'#fff',fontFamily:"'Manrope',sans-serif",fontWeight:800,cursor:forgotLoad?'not-allowed':'pointer',fontSize:14,display:'flex',alignItems:'center',justifyContent:'center',gap:7 }}>
                        {forgotLoad?<><div style={{ width:14,height:14,border:'2px solid rgba(255,255,255,.4)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin .7s linear infinite' }} />Resetting…</>:'✓ Reset Password'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
