import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { feedbackFormsAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

// A small floating prompt that appears when the admin has published a
// feedback form targeted at the logged-in user's role/dashboard. Keeps
// checking every time the app loads; once answered, that form won't
// show again for this user (enforced by the one-response-per-form
// index on the backend).
export default function PendingFeedbackPrompt() {
  const { user } = useAuth();
  const [pending, setPending] = useState([]);
  const [active, setActive] = useState(null); // form currently being answered
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user || user.role === 'admin') return;
    feedbackFormsAPI.getMine().then(res => setPending(res.data.data || [])).catch(() => {});
  }, [user]);

  if (!user || user.role === 'admin' || pending.length === 0) return null;

  const openForm = (form) => { setActive(form); setAnswers({}); };

  const submit = async (e) => {
    e.preventDefault();
    const missing = active.questions.filter(q => q.required && !answers[q._id]);
    if (missing.length) { toast.error('Please answer all required questions'); return; }
    setSubmitting(true);
    try {
      const payload = Object.entries(answers).map(([questionId, value]) => ({ questionId, value }));
      await feedbackFormsAPI.respond(active._id, payload);
      toast.success('🙏 Thanks for your feedback!');
      setPending(p => p.filter(f => f._id !== active._id));
      setActive(null);
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to submit'); }
    setSubmitting(false);
  };

  return (
    <>
      {/* Small banner nudging them to respond */}
      {!active && (
        <div style={{ position:'fixed', bottom:28, left:'50%', transform:'translateX(-50%)', zIndex:99997, background:'#fff', border:'1px solid #e2e8f0', borderRadius:14, boxShadow:'0 12px 32px rgba(0,0,0,.12)', padding:'12px 16px', display:'flex', alignItems:'center', gap:12, fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Roboto,sans-serif" }}>
          <span style={{ fontSize:20 }}>📝</span>
          <div>
            <div style={{ fontSize:12.5, fontWeight:700, color:'#0f172a' }}>{pending[0].title}</div>
            <div style={{ fontSize:11, color:'#94a3b8' }}>The admin would like your feedback</div>
          </div>
          <button onClick={()=>openForm(pending[0])} style={{ padding:'7px 16px', borderRadius:20, border:'none', background:'#1648c9', color:'#fff', fontWeight:700, fontSize:12, cursor:'pointer' }}>Answer</button>
        </div>
      )}

      <AnimatePresence>
        {active && (
          <div className="modal-overlay" onClick={e=>{ if(e.target===e.currentTarget) setActive(null); }}>
            <motion.div className="modal-box" style={{ maxWidth:480 }} initial={{ opacity:0,y:20,scale:.97 }} animate={{ opacity:1,y:0,scale:1 }}>
              <div className="modal-header">
                <span className="modal-title">📝 {active.title}</span>
                <button className="btn btn-ghost btn-icon" onClick={()=>setActive(null)}>✕</button>
              </div>
              <form onSubmit={submit}>
                <div className="modal-body">
                  {active.description && <p style={{ fontSize:12.5, color:'#64748b', marginBottom:16 }}>{active.description}</p>}
                  {active.questions.map(q => (
                    <div key={q._id} className="form-group">
                      <label className="form-label">{q.label}{q.required && ' *'}</label>
                      {q.type === 'rating' ? (
                        <div style={{ display:'flex', gap:6 }}>
                          {[1,2,3,4,5].map(star => (
                            <button key={star} type="button" onClick={()=>setAnswers(a=>({...a,[q._id]:star}))}
                              style={{ fontSize:26, background:'none', border:'none', cursor:'pointer', color: (answers[q._id]||0) >= star ? '#f59e0b' : '#e2e8f0' }}>★</button>
                          ))}
                        </div>
                      ) : (
                        <textarea className="form-input" rows={3} value={answers[q._id]||''} onChange={e=>setAnswers(a=>({...a,[q._id]:e.target.value}))}
                          placeholder={q.type==='suggestion' ? 'Your suggestion…' : 'Your remarks…'} />
                      )}
                    </div>
                  ))}
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-outline" onClick={()=>setActive(null)}>Later</button>
                  <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting?'Submitting…':'Submit Feedback'}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
