import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { paymentsAPI } from '../utils/api';
import toast from 'react-hot-toast';

/* ── Card brand detection ── */
function detectBrand(num) {
  const n = num.replace(/\s/g, '');
  if (/^4/.test(n)) return { brand: 'Visa', color: '#1a1f71', logo: 'VISA' };
  if (/^5[1-5]/.test(n)) return { brand: 'Mastercard', color: '#eb001b', logo: 'MC' };
  if (/^3[47]/.test(n)) return { brand: 'Amex', color: '#016fd0', logo: 'AMEX' };
  if (/^6/.test(n)) return { brand: 'Discover', color: '#f76f20', logo: 'DISC' };
  return { brand: '', color: '#94a3b8', logo: '💳' };
}

function formatCardNum(val) {
  return val.replace(/\D/g,'').slice(0,16).replace(/(.{4})/g,'$1 ').trim();
}
function formatExpiry(val) {
  const v = val.replace(/\D/g,'').slice(0,4);
  if (v.length >= 3) return v.slice(0,2) + '/' + v.slice(2);
  return v;
}

const TABS = [
  { key:'card',       label:'Credit / Debit Card', icon:'💳' },
  { key:'upi',        label:'UPI',                  icon:'📱' },
  { key:'netbanking', label:'Net Banking',           icon:'🏦' },
  { key:'wallet',     label:'Wallet',               icon:'👝' },
];

const BANKS = ['State Bank of India','HDFC Bank','ICICI Bank','Axis Bank','Kotak Bank','Punjab National Bank','Bank of Baroda','Canara Bank'];
const WALLETS = [
  { name:'PayTM',    color:'#00BAF2' },
  { name:'PhonePe',  color:'#5f259f' },
  { name:'Google Pay',color:'#4285f4' },
  { name:'Amazon Pay',color:'#ff9900' },
];
const UPI_APPS = [
  { name:'Google Pay',  color:'#4285f4', icon:'🟢', suffix:'@okaxis'  },
  { name:'PhonePe',     color:'#5f259f', icon:'🟣', suffix:'@ybl'     },
  { name:'Paytm',       color:'#00BAF2', icon:'🔵', suffix:'@paytm'   },
  { name:'BHIM',        color:'#1b5e20', icon:'🟢', suffix:'@upi'     },
  { name:'Amazon Pay',  color:'#ff9900', icon:'🟠', suffix:'@apl'     },
  { name:'WhatsApp Pay',color:'#25d366', icon:'🟢', suffix:'@waicici' },
];

export default function PaymentModal({ type, refId, amount, description, onSuccess, onClose }) {
  const [paymentId, setPaymentId] = useState(null);
  const [initiating, setInitiating] = useState(true);
  const [tab, setTab] = useState('card');
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(null);
  const [flip, setFlip] = useState(false);

  // Card fields
  const [cardNum, setCardNum] = useState('');
  const [cardName, setCardName] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [upiId, setUpiId] = useState('');
  const [selUpiApp, setSelUpiApp] = useState('');
  const [selBank, setSelBank] = useState('');
  const [selWallet, setSelWallet] = useState('');
  const [saveCard, setSaveCard] = useState(false);
  const cvvRef = useRef();

  const brand = detectBrand(cardNum);

  useEffect(() => {
    paymentsAPI.initiate({ type, refId })
      .then(r => { setPaymentId(r.data.data.paymentId); setInitiating(false); })
      .catch(e => { toast.error(e.response?.data?.error || 'Failed to initiate payment'); onClose(); });
  }, []);

  const handlePay = async () => {
    if (!paymentId) return;
    setProcessing(true);
    try {
      let body = { paymentId, method: tab };
      if (tab === 'card') {
        body.card = { number: cardNum.replace(/\s/g,''), name: cardName, expiry, cvv };
      } else if (tab === 'upi') {
        body.upi = upiId;
        body.upiApp = selUpiApp;
      } else if (tab === 'netbanking') {
        body.bank = selBank;
      } else if (tab === 'wallet') {
        body.wallet = selWallet;
      }
      const res = await paymentsAPI.confirm(body);
      setSuccess(res.data.data);
      setTimeout(() => { onSuccess({ ...res.data.data, appointment: res.data.appointment }); }, 2400);
    } catch (e) {
      const msg = e.response?.data?.error || 'Payment failed. Please retry.';
      toast.error(msg, { duration: e.response?.status === 409 ? 6000 : 4000 });
      if (e.response?.status === 409) {
        // Slot was taken by someone else while paying — no charge was made;
        // close the modal so the patient lands back on the booking form
        // to pick a different time instead of retrying a dead payment.
        onClose();
      }
    }
    setProcessing(false);
  };

  const canPay = () => {
    if (tab === 'card') return cardNum.replace(/\s/g,'').length === 16 && cardName.length >= 3 && expiry.length === 5 && cvv.length >= 3;
    if (tab === 'upi') return !!selUpiApp && /^[\w.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(upiId.trim());
    if (tab === 'netbanking') return !!selBank;
    if (tab === 'wallet') return !!selWallet;
    return false;
  };

  const INR = (v) => `₹${parseFloat(v).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.65)', backdropFilter:'blur(6px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999, padding:16 }}
      onClick={e => { if (e.target === e.currentTarget && !processing) onClose(); }}>
      <style>{`
        @keyframes spin { to { transform:rotate(360deg) } }
        @keyframes pop { 0%{transform:scale(0)}50%{transform:scale(1.12)}100%{transform:scale(1)} }
        @keyframes checkDraw { to { stroke-dashoffset: 0 } }
        .pay-inp { width:100%;padding:11px 13px;border:1.5px solid #e2e8f0;border-radius:11px;font-size:14px;font-family:inherit;outline:none;transition:border-color .2s,box-shadow .2s;box-sizing:border-box;background:#fafbfc; }
        .pay-inp:focus { border-color:#2563eb;box-shadow:0 0 0 3px #2563eb18;background:#fff; }
        .pay-inp.err { border-color:#ef4444;box-shadow:0 0 0 3px #ef444415; }
        .pay-tab { flex:1;padding:10px 6px;border:1.5px solid #e8edf3;background:#fff;border-radius:12px;cursor:pointer;font-family:inherit;font-size:11px;font-weight:600;color:#64748b;transition:all .18s;display:flex;flex-direction:column;align-items:center;gap:4px; }
        .pay-tab.active { border-color:#2563eb;background:#eff6ff;color:#2563eb;box-shadow:0 0 0 3px #2563eb12; }
        .pay-tab:hover:not(.active) { border-color:#cbd5e1;background:#f8fafc; }
      `}</style>

      <motion.div initial={{ opacity:0, scale:.94, y:20 }} animate={{ opacity:1, scale:1, y:0 }} exit={{ opacity:0, scale:.94, y:20 }}
        style={{ background:'#fff', borderRadius:24, width:'100%', maxWidth:460, overflow:'hidden', boxShadow:'0 32px 80px rgba(0,0,0,.28)', maxHeight:'95vh', overflowY:'auto' }}>

        {/* ── Success Screen ── */}
        {success && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} style={{ padding:'48px 32px', textAlign:'center' }}>
            <motion.div initial={{ scale:0 }} animate={{ scale:1 }} transition={{ type:'spring', bounce:.5, delay:.1 }}
              style={{ width:80, height:80, borderRadius:'50%', background:'linear-gradient(135deg,#059669,#34d399)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px', boxShadow:'0 12px 32px #05996940' }}>
              <svg width="38" height="38" viewBox="0 0 38 38" fill="none">
                <motion.path d="M9 19l7 7 13-14" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"
                  initial={{ pathLength:0 }} animate={{ pathLength:1 }} transition={{ delay:.3, duration:.5 }} />
              </svg>
            </motion.div>
            <h2 style={{ fontSize:22, fontWeight:800, color:'#0f172a', marginBottom:6 }}>Payment Successful!</h2>
            <p style={{ color:'#64748b', fontSize:14, marginBottom:24 }}>{description}</p>
            <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:14, padding:'16px 20px', textAlign:'left', marginBottom:20 }}>
              {[
                ['Transaction ID', success.transactionId],
                ['Amount Paid',    INR(success.amount)],
                ['Payment Method', success.method === 'card' ? `${success.cardBrand} ••••${success.cardLast4}` : success.method === 'upi' ? `${selUpiApp || 'UPI'} (${success.notes?.replace('UPI: ','') || upiId})` : success.method?.toUpperCase()],
                ['Date & Time',    new Date(success.paidAt).toLocaleString('en-IN')],
              ].map(([k,v]) => (
                <div key={k} style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', borderBottom:'1px solid #dcfce7', fontSize:13 }}>
                  <span style={{ color:'#64748b' }}>{k}</span>
                  <span style={{ fontWeight:700, color:'#0f172a', fontFamily: k==='Transaction ID'?'monospace':undefined }}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{ fontSize:12, color:'#94a3b8' }}>Redirecting you back…</div>
          </motion.div>
        )}

        {!success && (
          <>
            {/* Header */}
            <div style={{ background:'linear-gradient(135deg,#1e3a8a,#2563eb,#0891b2)', padding:'22px 26px 20px', position:'relative', overflow:'hidden' }}>
              <div style={{ position:'absolute', top:-30, right:-30, width:120, height:120, borderRadius:'50%', background:'rgba(255,255,255,.06)', pointerEvents:'none' }} />
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                    <div style={{ width:32, height:32, borderRadius:10, background:'rgba(255,255,255,.15)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>🔒</div>
                    <span style={{ color:'rgba(255,255,255,.85)', fontSize:12, fontWeight:600, letterSpacing:.5 }}>SECURE PAYMENT</span>
                  </div>
                  <div style={{ color:'#fff', fontWeight:800, fontSize:20 }}>{INR(amount)}</div>
                  <div style={{ color:'rgba(255,255,255,.65)', fontSize:12, marginTop:2 }}>{description}</div>
                </div>
                <button onClick={onClose} disabled={processing}
                  style={{ width:32, height:32, borderRadius:'50%', background:'rgba(255,255,255,.15)', border:'none', cursor:'pointer', color:'#fff', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>✕</button>
              </div>
              {/* SSL badges */}
              <div style={{ display:'flex', gap:8, marginTop:14 }}>
                {['🔐 256-bit SSL','✅ PCI DSS','🛡️ 3D Secure'].map(b => (
                  <div key={b} style={{ background:'rgba(255,255,255,.12)', borderRadius:20, padding:'3px 10px', fontSize:10, color:'rgba(255,255,255,.8)', fontWeight:600 }}>{b}</div>
                ))}
              </div>
            </div>

            {initiating ? (
              <div style={{ padding:48, textAlign:'center' }}>
                <div style={{ width:40, height:40, border:'3px solid #e2e8f0', borderTopColor:'#2563eb', borderRadius:'50%', animation:'spin .7s linear infinite', margin:'0 auto 16px' }} />
                <div style={{ color:'#64748b', fontSize:14 }}>Preparing secure checkout…</div>
              </div>
            ) : (
              <div style={{ padding:'22px 26px 26px' }}>

                {/* Payment method tabs */}
                <div style={{ marginBottom:20 }}>
                  <div style={{ fontSize:11, color:'#94a3b8', fontWeight:700, letterSpacing:.8, textTransform:'uppercase', marginBottom:10 }}>Payment Method</div>
                  <div style={{ display:'flex', gap:6 }}>
                    {TABS.map(t => (
                      <button key={t.key} className={`pay-tab${tab===t.key?' active':''}`} onClick={() => setTab(t.key)}>
                        <span style={{ fontSize:18 }}>{t.icon}</span>
                        <span>{t.key==='card'?'Card':t.key==='upi'?'UPI':t.key==='netbanking'?'Net Bank':'Wallet'}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* ── CARD TAB ── */}
                {tab === 'card' && (
                  <div>
                    {/* Visual card */}
                    <div style={{ perspective:1000, marginBottom:20 }}>
                      <motion.div animate={{ rotateY: flip ? 180 : 0 }} transition={{ duration:.5 }}
                        style={{ width:'100%', height:160, borderRadius:16, position:'relative', transformStyle:'preserve-3d', cursor:'pointer' }}
                        onClick={() => cvvRef.current?.focus()}>
                        {/* Front */}
                        <div style={{ position:'absolute', inset:0, backfaceVisibility:'hidden', background:`linear-gradient(135deg,${brand.color}dd,${brand.color}88,#0f172a)`, borderRadius:16, padding:'18px 20px', display:'flex', flexDirection:'column', justifyContent:'space-between', boxShadow:`0 12px 32px ${brand.color}40` }}>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                            <div style={{ width:42, height:30, background:'linear-gradient(135deg,#ffd700,#ffa500)', borderRadius:6, display:'flex', alignItems:'center', justifyContent:'center' }}>
                              <div style={{ width:28, height:20, background:'rgba(255,255,255,.2)', borderRadius:3 }} />
                            </div>
                            <span style={{ color:'rgba(255,255,255,.9)', fontWeight:900, fontSize:15, letterSpacing:1 }}>{brand.logo}</span>
                          </div>
                          <div>
                            <div style={{ color:'#fff', fontSize:17, letterSpacing:3, fontFamily:'monospace', marginBottom:10 }}>
                              {(cardNum || '•••• •••• •••• ••••').padEnd(19,'•').replace(/(.{4})/g,'$1 ').trim().slice(0,19)}
                            </div>
                            <div style={{ display:'flex', justifyContent:'space-between' }}>
                              <div><div style={{ color:'rgba(255,255,255,.5)', fontSize:9, letterSpacing:1 }}>CARD HOLDER</div><div style={{ color:'#fff', fontSize:12, fontWeight:600 }}>{cardName||'YOUR NAME'}</div></div>
                              <div><div style={{ color:'rgba(255,255,255,.5)', fontSize:9, letterSpacing:1 }}>EXPIRES</div><div style={{ color:'#fff', fontSize:12, fontWeight:600 }}>{expiry||'MM/YY'}</div></div>
                            </div>
                          </div>
                        </div>
                        {/* Back */}
                        <div style={{ position:'absolute', inset:0, backfaceVisibility:'hidden', transform:'rotateY(180deg)', background:'linear-gradient(135deg,#1e293b,#334155)', borderRadius:16, padding:'18px 0' }}>
                          <div style={{ height:40, background:'#0f172a', margin:'0 0 16px' }} />
                          <div style={{ padding:'0 20px', display:'flex', alignItems:'center', gap:10 }}>
                            <div style={{ flex:1, height:32, background:'rgba(255,255,255,.1)', borderRadius:6 }} />
                            <div style={{ width:60, height:32, background:'#fff', borderRadius:6, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:700, color:'#1e293b', fontFamily:'monospace' }}>{cvv||'CVV'}</div>
                          </div>
                        </div>
                      </motion.div>
                    </div>

                    <div style={{ marginBottom:12 }}>
                      <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#374151', letterSpacing:.5, textTransform:'uppercase', marginBottom:5 }}>Card Number</label>
                      <div style={{ position:'relative' }}>
                        <input className="pay-inp" placeholder="0000 0000 0000 0000" value={cardNum}
                          onChange={e => setCardNum(formatCardNum(e.target.value))} maxLength={19} style={{ paddingRight:60, fontFamily:'monospace', fontSize:15, letterSpacing:2 }} />
                        {brand.brand && <span style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', fontSize:11, fontWeight:900, color:brand.color }}>{brand.logo}</span>}
                      </div>
                    </div>
                    <div style={{ marginBottom:12 }}>
                      <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#374151', letterSpacing:.5, textTransform:'uppercase', marginBottom:5 }}>Cardholder Name</label>
                      <input className="pay-inp" placeholder="Name as on card" value={cardName} onChange={e => setCardName(e.target.value.toUpperCase())} style={{ textTransform:'uppercase', letterSpacing:.5 }} />
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
                      <div>
                        <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#374151', letterSpacing:.5, textTransform:'uppercase', marginBottom:5 }}>Expiry</label>
                        <input className="pay-inp" placeholder="MM/YY" value={expiry}
                          onChange={e => setExpiry(formatExpiry(e.target.value))} maxLength={5} style={{ fontFamily:'monospace', letterSpacing:2 }} />
                      </div>
                      <div>
                        <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#374151', letterSpacing:.5, textTransform:'uppercase', marginBottom:5 }}>CVV</label>
                        <input ref={cvvRef} className="pay-inp" placeholder="•••" value={cvv} type="password"
                          onChange={e => setCvv(e.target.value.replace(/\D/g,'').slice(0,4))} maxLength={4}
                          onFocus={() => setFlip(true)} onBlur={() => setFlip(false)} style={{ fontFamily:'monospace', letterSpacing:4 }} />
                      </div>
                    </div>
                    <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:'#64748b', cursor:'pointer', marginBottom:4 }}>
                      <input type="checkbox" checked={saveCard} onChange={e => setSaveCard(e.target.checked)} style={{ accentColor:'#2563eb', width:14, height:14 }} />
                      Save card for future payments
                    </label>
                    <div style={{ fontSize:11, color:'#94a3b8', marginTop:6 }}>
                      💡 Test: use <code style={{ background:'#f1f5f9', padding:'1px 5px', borderRadius:4 }}>4111 1111 1111 1111</code> for success
                    </div>
                  </div>
                )}

                {/* ── UPI TAB ── */}
                {tab === 'upi' && (
                  <div>
                    <div style={{ fontSize:11, color:'#94a3b8', fontWeight:700, letterSpacing:.8, textTransform:'uppercase', marginBottom:12 }}>Select UPI App</div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:9, marginBottom:18 }}>
                      {UPI_APPS.map(app => (
                        <button key={app.name} onClick={() => {
                            setSelUpiApp(app.name);
                            // Pre-fill UPI ID with this app's typical handle suffix; keep
                            // whatever the user already typed before the @ if present.
                            setUpiId(u => { const base = u.includes('@') ? u.split('@')[0] : (u || 'yourname'); return base + app.suffix; });
                          }}
                          style={{ padding:'12px 8px', borderRadius:13, border:`2px solid ${selUpiApp===app.name?app.color:'#e2e8f0'}`, background:selUpiApp===app.name?`${app.color}10`:'#fff', cursor:'pointer', fontFamily:'inherit', transition:'all .18s', display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
                          <div style={{ width:34, height:34, borderRadius:9, background:app.color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>{app.icon}</div>
                          <span style={{ fontSize:11, fontWeight:700, color:selUpiApp===app.name?app.color:'#374151', textAlign:'center', lineHeight:1.2 }}>{app.name}</span>
                        </button>
                      ))}
                    </div>

                    {selUpiApp && (
                      <motion.div initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }}>
                        <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#374151', letterSpacing:.5, textTransform:'uppercase', marginBottom:6 }}>Confirm your {selUpiApp} ID</label>
                        <input className="pay-inp" placeholder="yourname@upi" value={upiId} onChange={e => setUpiId(e.target.value)} style={{ fontSize:15 }} />
                        <div style={{ fontSize:11.5, color:'#94a3b8', marginTop:6 }}>We've pre-filled the typical {selUpiApp} handle — edit if yours is different.</div>
                      </motion.div>
                    )}

                    {!selUpiApp && (
                      <div style={{ background:'#f0f9ff', border:'1px solid #bae6fd', borderRadius:14, padding:'14px 16px', textAlign:'center' }}>
                        <div style={{ fontSize:28, marginBottom:6 }}>📱</div>
                        <div style={{ fontSize:12.5, color:'#0369a1', fontWeight:600 }}>Choose your UPI app above to continue</div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── NETBANKING TAB ── */}
                {tab === 'netbanking' && (
                  <div>
                    <div style={{ fontSize:11, color:'#94a3b8', fontWeight:700, letterSpacing:.8, textTransform:'uppercase', marginBottom:10 }}>Select Your Bank</div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:14 }}>
                      {BANKS.map(b => (
                        <button key={b} onClick={() => setSelBank(b)}
                          style={{ padding:'10px 12px', borderRadius:11, border:`1.5px solid ${selBank===b?'#2563eb':'#e2e8f0'}`, background:selBank===b?'#eff6ff':'#fff', color:selBank===b?'#2563eb':'#374151', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit', textAlign:'left', transition:'all .15s' }}>
                          🏦 {b.replace(' Bank','').replace('State Bank of India','SBI')}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── WALLET TAB ── */}
                {tab === 'wallet' && (
                  <div>
                    <div style={{ fontSize:11, color:'#94a3b8', fontWeight:700, letterSpacing:.8, textTransform:'uppercase', marginBottom:12 }}>Select Wallet</div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                      {WALLETS.map(w => (
                        <button key={w.name} onClick={() => setSelWallet(w.name)}
                          style={{ padding:'14px', borderRadius:13, border:`2px solid ${selWallet===w.name?w.color:'#e2e8f0'}`, background:selWallet===w.name?`${w.color}10`:'#fff', cursor:'pointer', fontFamily:'inherit', transition:'all .18s', display:'flex', alignItems:'center', gap:10 }}>
                          <div style={{ width:32, height:32, borderRadius:8, background:w.color, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:12, fontWeight:900, flexShrink:0 }}>{w.name[0]}</div>
                          <span style={{ fontSize:13, fontWeight:700, color:selWallet===w.name?w.color:'#374151' }}>{w.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Pay Button ── */}
                <motion.button
                  disabled={processing || !canPay()}
                  onClick={handlePay}
                  whileTap={{ scale: .98 }}
                  style={{ width:'100%', marginTop:22, padding:'15px', borderRadius:14, border:'none', background: canPay() ? 'linear-gradient(135deg,#1e3a8a,#2563eb)' : '#e2e8f0', color: canPay() ? '#fff' : '#94a3b8', fontFamily:'inherit', fontWeight:800, fontSize:16, cursor: canPay() ? 'pointer' : 'not-allowed', boxShadow: canPay() ? '0 8px 24px #2563eb40' : 'none', display:'flex', alignItems:'center', justifyContent:'center', gap:10, transition:'all .2s' }}>
                  {processing
                    ? <><div style={{ width:20, height:20, border:'2.5px solid rgba(255,255,255,.3)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin .7s linear infinite' }} /> Processing Payment…</>
                    : <><span style={{ fontSize:18 }}>🔒</span> Pay {INR(amount)} Securely</>
                  }
                </motion.button>

                {/* Trust line */}
                <div style={{ textAlign:'center', marginTop:12, fontSize:11.5, color:'#94a3b8', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                  <span>🔐</span>
                  <span>Secured by 256-bit encryption · No card details stored on our servers</span>
                </div>
              </div>
            )}
          </>
        )}
      </motion.div>
    </div>
  );
}
