import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { peerConsultAPI } from '../utils/api';
import toast from 'react-hot-toast';

export default function PeerConsultPage() {
  const [tab, setTab] = useState('received'); // received | sent
  const [received, setReceived] = useState([]);
  const [sent, setSent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [specialists, setSpecialists] = useState([]);
  const [form, setForm] = useState({ toDoctorId:'', ageBand:'', gender:'', summary:'', diagnosis:'', testResults:'' });
  const [saving, setSaving] = useState(false);
  const [respondingTo, setRespondingTo] = useState(null);
  const [responseText, setResponseText] = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([peerConsultAPI.getReceived(), peerConsultAPI.getSent()])
      .then(([r,s]) => { setReceived(r.data.data||[]); setSent(s.data.data||[]); })
      .catch(()=>{}).finally(()=>setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const openNew = () => {
    peerConsultAPI.getSpecialists().then(res => setSpecialists(res.data.data || [])).catch(()=>{});
    setShowNew(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.toDoctorId || !form.summary.trim()) { toast.error('Pick a specialist and describe the case'); return; }
    setSaving(true);
    try {
      await peerConsultAPI.create(form);
      toast.success('Case shared for a second opinion!');
      setShowNew(false);
      setForm({ toDoctorId:'', ageBand:'', gender:'', summary:'', diagnosis:'', testResults:'' });
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to share case'); }
    setSaving(false);
  };

  const submitResponse = async (id) => {
    if (!responseText.trim()) { toast.error('Enter your response'); return; }
    try { await peerConsultAPI.respond(id, responseText.trim()); setRespondingTo(null); setResponseText(''); toast.success('Response sent!'); load(); }
    catch { toast.error('Failed to respond'); }
  };

  const list = tab === 'received' ? received : sent;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">🔗 Peer Consultation</div>
          <div className="page-subtitle">Share an anonymized case with another doctor on the platform for a second opinion — patient name & contact info are never included</div>
        </div>
        <button className="btn btn-primary" onClick={openNew}>+ Share a Case</button>
      </div>

      <div style={{ display:'flex', gap:8, marginBottom:18 }}>
        <button onClick={()=>setTab('received')} style={{ padding:'7px 16px', borderRadius:20, border:'1.5px solid', borderColor:tab==='received'?'#2563eb':'#e2e8f0', background:tab==='received'?'#eff6ff':'#fff', color:tab==='received'?'#1d4ed8':'#64748b', fontWeight:700, fontSize:13, cursor:'pointer' }}>Received ({received.length})</button>
        <button onClick={()=>setTab('sent')} style={{ padding:'7px 16px', borderRadius:20, border:'1.5px solid', borderColor:tab==='sent'?'#2563eb':'#e2e8f0', background:tab==='sent'?'#eff6ff':'#fff', color:tab==='sent'?'#1d4ed8':'#64748b', fontWeight:700, fontSize:13, cursor:'pointer' }}>Sent ({sent.length})</button>
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:60, color:'#94a3b8' }}>Loading…</div>
      ) : list.length === 0 ? (
        <div style={{ textAlign:'center', padding:60, color:'#94a3b8' }}>No {tab} consultations yet.</div>
      ) : (
        <div style={{ display:'grid', gap:12 }}>
          {list.map(c => (
            <div key={c._id} className="card" style={{ padding:16 }}>
              <div style={{ display:'flex', justifyContent:'space-between' }}>
                <span style={{ fontWeight:700, fontSize:14 }}>{tab==='received' ? `From Dr. ${c.fromDoctor?.name}` : `To Dr. ${c.toDoctor?.name}`}</span>
                <span className={`badge ${c.status==='responded'?'badge-success':'badge-warning'}`}>{c.status}</span>
              </div>
              <div style={{ fontSize:13, color:'#64748b', marginTop:6 }}>{c.ageBand} {c.gender} — {c.summary}</div>
              {c.diagnosis && <div style={{ fontSize:12.5, color:'#475569', marginTop:4 }}><strong>Working diagnosis:</strong> {c.diagnosis}</div>}
              {c.testResults && <div style={{ fontSize:12.5, color:'#475569', marginTop:2 }}><strong>Test results:</strong> {c.testResults}</div>}
              {c.response && <div style={{ fontSize:12.5, color:'#059669', marginTop:8, background:'#f0fdf4', padding:'8px 11px', borderRadius:8 }}><strong>Response:</strong> {c.response}</div>}
              {tab==='received' && c.status === 'pending' && (
                respondingTo === c._id ? (
                  <div style={{marginTop:10}}>
                    <textarea className="form-input" rows={2} value={responseText} onChange={e=>setResponseText(e.target.value)} placeholder="Your opinion…" />
                    <div style={{display:'flex',gap:6,marginTop:6}}>
                      <button className="btn btn-primary btn-sm" onClick={()=>submitResponse(c._id)}>Send</button>
                      <button className="btn btn-outline btn-sm" onClick={()=>setRespondingTo(null)}>Cancel</button>
                    </div>
                  </div>
                ) : <button className="btn btn-outline btn-sm" style={{marginTop:10}} onClick={()=>setRespondingTo(c._id)}>Respond</button>
              )}
            </div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {showNew && (
          <div className="modal-overlay" onClick={e=>{ if(e.target===e.currentTarget) setShowNew(false); }}>
            <motion.div className="modal-box" style={{ maxWidth:480 }} initial={{ opacity:0,y:20,scale:.97 }} animate={{ opacity:1,y:0,scale:1 }}>
              <div className="modal-header"><span className="modal-title">Share Anonymized Case</span><button className="btn btn-ghost btn-icon" onClick={()=>setShowNew(false)}>✕</button></div>
              <form onSubmit={submit}>
                <div className="modal-body">
                  <div className="form-group"><label className="form-label">Specialist *</label>
                    <select className="form-input" required value={form.toDoctorId} onChange={e=>setForm(f=>({...f,toDoctorId:e.target.value}))}>
                      <option value="">— Select doctor —</option>
                      {specialists.map(d=><option key={d._id} value={d._id}>Dr. {d.name}{d.specialization?` (${d.specialization})`:''}</option>)}
                    </select>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                    <div className="form-group"><label className="form-label">Age Band</label><input className="form-input" value={form.ageBand} onChange={e=>setForm(f=>({...f,ageBand:e.target.value}))} placeholder="e.g. 30-40" /></div>
                    <div className="form-group"><label className="form-label">Gender</label>
                      <select className="form-input" value={form.gender} onChange={e=>setForm(f=>({...f,gender:e.target.value}))}><option value="">—</option><option>Male</option><option>Female</option><option>Other</option></select>
                    </div>
                  </div>
                  <div className="form-group"><label className="form-label">Case Summary *</label><textarea className="form-input" rows={3} required value={form.summary} onChange={e=>setForm(f=>({...f,summary:e.target.value}))} placeholder="Symptoms, history, your question…" /></div>
                  <div className="form-group"><label className="form-label">Working Diagnosis</label><input className="form-input" value={form.diagnosis} onChange={e=>setForm(f=>({...f,diagnosis:e.target.value}))} /></div>
                  <div className="form-group"><label className="form-label">Test Results</label><textarea className="form-input" rows={2} value={form.testResults} onChange={e=>setForm(f=>({...f,testResults:e.target.value}))} /></div>
                  <div style={{fontSize:11,color:'#94a3b8'}}>Patient name and contact info are never included — only clinical details.</div>
                </div>
                <div className="modal-footer"><button type="button" className="btn btn-outline" onClick={()=>setShowNew(false)}>Cancel</button><button type="submit" className="btn btn-primary" disabled={saving}>{saving?'Sharing…':'Share Case'}</button></div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
