import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { queueAPI } from '../utils/api';

// Public waiting-room display — meant to run full-screen on a TV/monitor
// in the lobby. No login wall: anyone with the URL can view it, but
// nothing here is sensitive (just token numbers and department names).
export default function QueueDisplayPage() {
  const [board, setBoard] = useState([]);
  const [now, setNow] = useState(new Date());

  const load = useCallback(() => {
    queueAPI.getPublicBoard().then(res => setBoard(res.data.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const poll = setInterval(load, 8000);
    const clock = setInterval(() => setNow(new Date()), 1000);
    return () => { clearInterval(poll); clearInterval(clock); };
  }, [load]);

  return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(160deg,#0f172a 0%,#1e1b4b 100%)', fontFamily:"'Inter',system-ui,sans-serif", padding:'36px 40px', color:'#fff' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@500;700;800&family=Sora:wght@700;800&display=swap');`}</style>

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:36 }}>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <div style={{ width:48, height:48, borderRadius:14, background:'linear-gradient(135deg,#4f46e5,#a78bfa)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>✚</div>
          <div>
            <div style={{ fontFamily:"'Sora',sans-serif", fontWeight:800, fontSize:24 }}>Mediventra</div>
            <div style={{ fontSize:13, color:'rgba(255,255,255,.5)' }}>Live Waiting Room Display</div>
          </div>
        </div>
        <div style={{ textAlign:'right' }}>
          <div style={{ fontFamily:"'Sora',sans-serif", fontWeight:800, fontSize:30 }}>{now.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', second:'2-digit' })}</div>
          <div style={{ fontSize:13, color:'rgba(255,255,255,.5)' }}>{now.toLocaleDateString('en-IN', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}</div>
        </div>
      </div>

      {board.length === 0 ? (
        <div style={{ textAlign:'center', padding:'100px 20px', color:'rgba(255,255,255,.4)' }}>
          <div style={{ fontSize:60, marginBottom:16 }}>🎫</div>
          <div style={{ fontSize:20, fontWeight:700 }}>No active queues right now</div>
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(320px,1fr))', gap:20 }}>
          <AnimatePresence>
            {board.map(dept => (
              <motion.div key={dept.department} layout initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }}
                style={{ background:'rgba(255,255,255,.06)', border:'1px solid rgba(167,139,250,.25)', borderRadius:20, padding:'26px 28px' }}>
                <div style={{ fontSize:15, fontWeight:700, color:'#a78bfa', marginBottom:14, textTransform:'uppercase', letterSpacing:1 }}>{dept.department}</div>
                <div style={{ display:'flex', alignItems:'baseline', gap:10, marginBottom:8 }}>
                  <span style={{ fontSize:13, color:'rgba(255,255,255,.5)' }}>Now Serving</span>
                </div>
                <AnimatePresence mode="wait">
                  <motion.div key={dept.nowServing?.tokenNumber || 'none'} initial={{ opacity:0, scale:.9 }} animate={{ opacity:1, scale:1 }} exit={{ opacity:0, scale:.9 }}
                    style={{ fontFamily:"'Sora',sans-serif", fontWeight:800, fontSize:64, lineHeight:1, color: dept.nowServing ? '#fff' : 'rgba(255,255,255,.25)' }}>
                    {dept.nowServing ? `#${dept.nowServing.tokenNumber}` : '—'}
                  </motion.div>
                </AnimatePresence>
                <div style={{ display:'flex', justifyContent:'space-between', marginTop:18, paddingTop:14, borderTop:'1px solid rgba(255,255,255,.1)' }}>
                  <div><div style={{ fontSize:11, color:'rgba(255,255,255,.4)' }}>Waiting</div><div style={{ fontSize:20, fontWeight:800 }}>{dept.waitingCount}</div></div>
                  <div><div style={{ fontSize:11, color:'rgba(255,255,255,.4)' }}>Last Completed</div><div style={{ fontSize:20, fontWeight:800 }}>{dept.lastCompleted ? `#${dept.lastCompleted}` : '—'}</div></div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <div style={{ textAlign:'center', marginTop:40, fontSize:12, color:'rgba(255,255,255,.3)' }}>Updates automatically every few seconds</div>
    </div>
  );
}
