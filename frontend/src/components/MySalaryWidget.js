import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { salaryAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { getSocket } from '../utils/socket';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const INR = v => `₹${Number(v||0).toLocaleString('en-IN')}`;
const ROLE_COLOR = { admin:'#6366f1',doctor:'#0891b2',nurse:'#db2777',pharmacist:'#d97706',wardboy:'#059669',sweeper:'#f59e0b',otboy:'#ef4444' };

export default function MySalaryWidget() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [newAlert, setNewAlert] = useState(null);
  const ac = ROLE_COLOR[user?.role] || '#2563eb';

  useEffect(() => {
    salaryAPI.getMySummary()
      .then(r => { setSummary(r.data.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    socket.emit('join_user_room', user?._id);
    const handler = (data) => {
      setNewAlert(data);
      setSummary(s => ({ ...s, latest: { ...s?.latest, status:'credited', creditedAt:new Date(), netPay:data.netPay, grossPay:data.grossPay } }));
      setTimeout(() => setNewAlert(null), 8000);
    };
    socket.on('salary_credited', handler);
    return () => socket.off('salary_credited', handler);
  }, [user?._id]);

  if (loading) return null;

  const latest = summary?.latest;
  const history = summary?.history || [];

  return (
    <div style={{ background:'#fff', border:'1px solid #e8edf3', borderRadius:16, overflow:'hidden', fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif" }}>
      {/* Salary credited alert */}
      <AnimatePresence>
        {newAlert && (
          <motion.div initial={{ height:0,opacity:0 }} animate={{ height:'auto',opacity:1 }} exit={{ height:0,opacity:0 }}
            style={{ background:'linear-gradient(135deg,#059669,#34d399)',padding:'12px 18px',display:'flex',alignItems:'center',gap:10 }}>
            <motion.span animate={{ scale:[1,1.3,1] }} transition={{ repeat:3,duration:.4 }} style={{ fontSize:20 }}>🎉</motion.span>
            <div>
              <div style={{ color:'#fff',fontWeight:800,fontSize:14 }}>Salary Credited!</div>
              <div style={{ color:'rgba(255,255,255,.85)',fontSize:12 }}>{INR(newAlert.netPay)} credited for {MONTHS[newAlert.month-1]} {newAlert.year}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ padding:'14px 18px',borderBottom:'1px solid #f1f5f9',display:'flex',alignItems:'center',justifyContent:'space-between' }}>
        <div style={{ display:'flex',alignItems:'center',gap:8 }}>
          <span style={{ fontSize:18 }}>💰</span>
          <span style={{ fontWeight:800,fontSize:15,color:'#0f172a' }}>My Salary</span>
        </div>
        <button onClick={()=>setExpanded(e=>!e)}
          style={{ padding:'4px 10px',borderRadius:8,border:`1px solid ${ac}25`,background:`${ac}08`,color:ac,fontSize:11.5,fontWeight:700,cursor:'pointer',fontFamily:'inherit' }}>
          {expanded?'Less ▲':'Details ▼'}
        </button>
      </div>

      <div style={{ padding:'14px 18px' }}>
        {!latest ? (
          <div style={{ textAlign:'center',padding:'20px 0',color:'#94a3b8' }}>
            <div style={{ fontSize:32,marginBottom:8 }}>📋</div>
            <div style={{ fontSize:13 }}>No salary records yet</div>
          </div>
        ) : (
          <>
            {/* Latest salary card */}
            <div style={{ background:`linear-gradient(135deg,${ac}15,${ac}08)`,border:`1px solid ${ac}25`,borderRadius:14,padding:'14px 16px',marginBottom:expanded?14:0 }}>
              <div style={{ display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:8 }}>
                <div>
                  <div style={{ fontSize:12,color:'#64748b',fontWeight:600 }}>Latest — {MONTHS[(latest.month||1)-1]} {latest.year}</div>
                  <div style={{ fontSize:26,fontWeight:900,color:ac,lineHeight:1.1,marginTop:4,fontFamily:'monospace' }}>{INR(latest.netPay)}</div>
                  <div style={{ fontSize:12,color:'#64748b',marginTop:2 }}>Net Take Home</div>
                </div>
                <span style={{ padding:'4px 10px',borderRadius:20,fontSize:11.5,fontWeight:700,
                  background:latest.status==='credited'?'#dcfce7':'#fef3c7',
                  color:latest.status==='credited'?'#15803d':'#92400e' }}>
                  {latest.status==='credited'?'✅ Credited':'⏳ Pending'}
                </span>
              </div>
              <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8 }}>
                {[['Gross',latest.grossPay,'#0891b2'],['Deductions',Object.values(latest.deductions||{}).reduce((a,b)=>a+b,0),'#ef4444'],['Basic',latest.basicPay,'#374151']].map(([l,v,c])=>(
                  <div key={l} style={{ background:'rgba(255,255,255,.6)',borderRadius:9,padding:'8px 10px' }}>
                    <div style={{ fontSize:10.5,color:'#94a3b8',marginBottom:2 }}>{l}</div>
                    <div style={{ fontSize:13,fontWeight:700,color:c }}>{INR(v)}</div>
                  </div>
                ))}
              </div>
              {latest.creditedAt && <div style={{ fontSize:11,color:'#94a3b8',marginTop:8 }}>Credited: {new Date(latest.creditedAt).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})}</div>}
            </div>

            {/* History */}
            {expanded && history.length > 1 && (
              <div>
                <div style={{ fontSize:11,color:'#94a3b8',fontWeight:700,letterSpacing:.8,textTransform:'uppercase',marginBottom:10 }}>Salary History</div>
                {history.slice(0,6).map((s,i)=>(
                  <div key={i} style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 12px',background:'#f8fafc',borderRadius:10,marginBottom:6,border:'1px solid #f1f5f9' }}>
                    <div>
                      <div style={{ fontWeight:700,color:'#0f172a',fontSize:13 }}>{MONTHS[(s.month||1)-1]} {s.year}</div>
                      <div style={{ fontSize:11.5,color:'#64748b' }}>{s.daysWorked}d worked</div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontWeight:800,color:ac,fontSize:14,fontFamily:'monospace' }}>{INR(s.netPay)}</div>
                      <span style={{ fontSize:10.5,fontWeight:700,color:s.status==='credited'?'#15803d':'#92400e' }}>
                        {s.status==='credited'?'✓ Paid':'⏳ Pending'}
                      </span>
                    </div>
                  </div>
                ))}

                {/* YTD summary */}
                {history.filter(s=>s.year===new Date().getFullYear()).length>0 && (
                  <div style={{ background:`${ac}08`,border:`1px solid ${ac}20`,borderRadius:12,padding:'12px 14px',marginTop:10 }}>
                    <div style={{ fontWeight:700,color:ac,fontSize:13,marginBottom:4 }}>📊 This Year Total</div>
                    <div style={{ fontSize:20,fontWeight:900,color:'#0f172a' }}>
                      {INR(history.filter(s=>s.year===new Date().getFullYear()&&s.status==='credited').reduce((t,s)=>t+(s.netPay||0),0))}
                    </div>
                    <div style={{ fontSize:12,color:'#64748b',marginTop:2 }}>Total credited in {new Date().getFullYear()}</div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

