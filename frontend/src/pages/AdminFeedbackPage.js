import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { feedbackAPI } from '../utils/api';
import toast from 'react-hot-toast';

const CATEGORY_LABEL = { facility:'🏥 Facility', staff:'👥 Staff', cleanliness:'🧹 Cleanliness', billing:'💳 Billing', wait_time:'⏱️ Wait Time', other:'💬 Other' };
const STATUS_BADGE = { new:{bg:'#fef3c7',c:'#92400e',l:'New'}, reviewed:{bg:'#dbeafe',c:'#1d4ed8',l:'Reviewed'}, resolved:{bg:'#dcfce7',c:'#15803d',l:'Resolved'} };

export default function AdminFeedbackPage() {
  const [list, setList] = useState([]);
  const [average, setAverage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [respondModal, setRespondModal] = useState(null);
  const [responseText, setResponseText] = useState('');
  const [responding, setResponding] = useState(false);

  const load = () => {
    setLoading(true);
    feedbackAPI.getAll(statusFilter ? { status: statusFilter } : {})
      .then(res => { setList(res.data?.data || []); setAverage(res.data?.average); })
      .catch(() => toast.error('Failed to load feedback'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [statusFilter]);

  const openRespond = (f) => { setRespondModal(f); setResponseText(f.adminResponse || ''); };
  const submitRespond = async (status) => {
    setResponding(true);
    try {
      await feedbackAPI.respond(respondModal._id, { status, adminResponse: responseText.trim() });
      toast.success('✅ Response saved!');
      setRespondModal(null);
      load();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed to save response'); }
    setResponding(false);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">💬 Patient Feedback</div>
          <div className="page-subtitle">Overall hospital experience feedback from patients</div>
        </div>
      </div>

      <div className="stat-grid">
        <motion.div className="stat-card" initial={{ opacity:0,y:14 }} animate={{ opacity:1,y:0 }}>
          <div className="stat-icon" style={{ background:'#fffbeb' }}>⭐</div>
          <div className="stat-value">{average ?? '—'}</div>
          <div className="stat-label">Average Rating</div>
        </motion.div>
        <motion.div className="stat-card" initial={{ opacity:0,y:14 }} animate={{ opacity:1,y:0 }} transition={{ delay:.05 }}>
          <div className="stat-icon" style={{ background:'#fef3c7' }}>📥</div>
          <div className="stat-value">{list.filter(f=>f.status==='new').length}</div>
          <div className="stat-label">New / Unreviewed</div>
        </motion.div>
        <motion.div className="stat-card" initial={{ opacity:0,y:14 }} animate={{ opacity:1,y:0 }} transition={{ delay:.1 }}>
          <div className="stat-icon" style={{ background:'#dcfce7' }}>✅</div>
          <div className="stat-value">{list.filter(f=>f.status==='resolved').length}</div>
          <div className="stat-label">Resolved</div>
        </motion.div>
      </div>

      <div className="card mt-2">
        <div className="card-header">
          <span className="card-title">All Feedback</span>
          <select className="form-input" style={{ width:160 }} value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            <option value="new">New</option>
            <option value="reviewed">Reviewed</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>
        <div className="table-wrap">
          {loading ? (
            <div style={{ textAlign:'center', padding:40, color:'#94a3b8' }}>Loading…</div>
          ) : list.length === 0 ? (
            <div style={{ textAlign:'center', padding:40, color:'#94a3b8' }}>No feedback yet</div>
          ) : (
            <table>
              <thead><tr><th>Patient</th><th>Category</th><th>Rating</th><th>Message</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {list.map(f => {
                  const sb = STATUS_BADGE[f.status] || STATUS_BADGE.new;
                  return (
                    <tr key={f._id}>
                      <td><div className="td-main">{f.patient?.name}</div><div className="td-sub">{new Date(f.createdAt).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</div></td>
                      <td className="text-sm">{CATEGORY_LABEL[f.category] || f.category}</td>
                      <td style={{ color:'#f59e0b' }}>{'★'.repeat(f.rating)}{'☆'.repeat(5-f.rating)}</td>
                      <td className="text-sm" style={{ maxWidth:260 }}>{f.message || <span className="text-muted">—</span>}</td>
                      <td><span style={{ padding:'2px 9px', borderRadius:20, fontSize:10.5, fontWeight:700, background:sb.bg, color:sb.c }}>{sb.l}</span></td>
                      <td><button className="btn btn-outline btn-xs" onClick={() => openRespond(f)}>{f.adminResponse ? 'View/Edit' : 'Respond'}</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <AnimatePresence>
        {respondModal && (
          <div className="modal-overlay" onClick={e=>{ if(e.target===e.currentTarget) setRespondModal(null); }}>
            <motion.div className="modal-box" style={{ maxWidth:460 }} initial={{ opacity:0,y:20 }} animate={{ opacity:1,y:0 }}>
              <div className="modal-header"><span className="modal-title">Respond to {respondModal.patient?.name}</span><button className="btn btn-ghost btn-icon" onClick={()=>setRespondModal(null)}>✕</button></div>
              <div className="modal-body">
                <div style={{ background:'#f8fafc', borderRadius:10, padding:'10px 13px', marginBottom:14 }}>
                  <div style={{ color:'#f59e0b', fontSize:14 }}>{'★'.repeat(respondModal.rating)}{'☆'.repeat(5-respondModal.rating)}</div>
                  {respondModal.message && <div style={{ fontSize:13, color:'#374151', marginTop:6 }}>{respondModal.message}</div>}
                </div>
                <div className="form-group">
                  <label className="form-label">Your Response</label>
                  <textarea className="form-input" rows={4} value={responseText} onChange={e=>setResponseText(e.target.value)} placeholder="Thank the patient and address their feedback…" />
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-outline" disabled={responding} onClick={()=>submitRespond('reviewed')}>Save as Reviewed</button>
                <button className="btn btn-primary" disabled={responding} onClick={()=>submitRespond('resolved')}>{responding?'Saving…':'✓ Mark Resolved'}</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
