import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { feedbackAPI } from '../utils/api';
import toast from 'react-hot-toast';

const CATEGORIES = [
  { value:'facility',    label:'🏥 Hospital Facility' },
  { value:'staff',       label:'👥 Staff Behavior' },
  { value:'cleanliness', label:'🧹 Cleanliness' },
  { value:'billing',     label:'💳 Billing & Payments' },
  { value:'wait_time',   label:'⏱️ Wait Time' },
  { value:'other',       label:'💬 Other' },
];

export default function FeedbackPage() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('facility');
  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    setLoading(true);
    feedbackAPI.mine().then(res => setHistory(res.data?.data || [])).catch(()=>{}).finally(()=>setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!rating) { toast.error('Please select a star rating'); return; }
    setSubmitting(true);
    try {
      await feedbackAPI.create({ category, rating, message: message.trim() });
      toast.success('🙏 Thank you for your feedback!');
      setRating(0); setMessage(''); setCategory('facility');
      load();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed to submit feedback'); }
    setSubmitting(false);
  };

  const STATUS_BADGE = { new:{bg:'#fef3c7',c:'#92400e',l:'Submitted'}, reviewed:{bg:'#dbeafe',c:'#1d4ed8',l:'Reviewed'}, resolved:{bg:'#dcfce7',c:'#15803d',l:'Resolved'} };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">💬 Feedback</div>
          <div className="page-subtitle">Tell us about your overall experience — facilities, staff, billing, anything</div>
        </div>
      </div>

      <div className="grid-2">
        <motion.div className="card" initial={{ opacity:0,y:14 }} animate={{ opacity:1,y:0 }}>
          <div className="card-header"><span className="card-title">📝 Share Your Feedback</span></div>
          <form onSubmit={submit}>
            <div className="card-body">
              <div className="form-group">
                <label className="form-label">What is this about?</label>
                <select className="form-input" value={category} onChange={e=>setCategory(e.target.value)}>
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Overall Rating</label>
                <div style={{ display:'flex', gap:6 }}>
                  {[1,2,3,4,5].map(n => (
                    <button key={n} type="button" onClick={()=>setRating(n)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:30, color: n<=rating ? '#f59e0b' : '#e2e8f0', lineHeight:1 }}>★</button>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Tell us more (optional)</label>
                <textarea className="form-input" rows={4} value={message} onChange={e=>setMessage(e.target.value)} placeholder="What went well, or what could be better?" />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width:'100%' }} disabled={submitting || !rating}>
                {submitting ? 'Submitting…' : '📨 Submit Feedback'}
              </button>
            </div>
          </form>
        </motion.div>

        <motion.div className="card" initial={{ opacity:0,y:14 }} animate={{ opacity:1,y:0 }} transition={{ delay:.1 }}>
          <div className="card-header"><span className="card-title">📜 Your Past Feedback</span></div>
          <div className="card-body" style={{ maxHeight:420, overflowY:'auto' }}>
            {loading ? (
              <div style={{ textAlign:'center', padding:24, color:'#94a3b8' }}>Loading…</div>
            ) : history.length === 0 ? (
              <div style={{ textAlign:'center', padding:24, color:'#94a3b8', fontSize:13 }}>You haven't submitted any feedback yet.</div>
            ) : history.map(f => {
              const sb = STATUS_BADGE[f.status] || STATUS_BADGE.new;
              return (
                <div key={f._id} style={{ background:'#f8fafc', borderRadius:10, padding:'11px 14px', marginBottom:8 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={{ fontWeight:700, fontSize:12.5, textTransform:'capitalize' }}>{CATEGORIES.find(c=>c.value===f.category)?.label || f.category}</span>
                    <span style={{ padding:'2px 9px', borderRadius:20, fontSize:10.5, fontWeight:700, background:sb.bg, color:sb.c }}>{sb.l}</span>
                  </div>
                  <div style={{ color:'#f59e0b', fontSize:13, marginTop:4 }}>{'★'.repeat(f.rating)}{'☆'.repeat(5-f.rating)}</div>
                  {f.message && <div style={{ fontSize:12.5, color:'#475569', marginTop:5 }}>{f.message}</div>}
                  {f.adminResponse && (
                    <div style={{ marginTop:7, background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:8, padding:'7px 10px', fontSize:12, color:'#1e40af' }}>
                      <strong>Hospital response:</strong> {f.adminResponse}
                    </div>
                  )}
                  <div style={{ fontSize:10.5, color:'#94a3b8', marginTop:5 }}>{new Date(f.createdAt).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</div>
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
