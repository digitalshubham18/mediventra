import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { feedbackFormsAPI } from '../utils/api';
import toast from 'react-hot-toast';

const ALL_ROLES = [
  ['patient','🧑 Patient'], ['doctor','🩺 Doctor'], ['nurse','💉 Nurse'], ['pharmacist','💊 Pharmacist'],
  ['wardboy','🛏️ Ward Boy'], ['sweeper','🧹 Sweeper'], ['otboy','🔪 OT Boy'], ['finance','💰 Finance'],
  ['receptionist','🏨 Receptionist'], ['lab_technician','🔬 Lab Technician'], ['radiology_tech','🩻 Radiology Tech'], ['dialysis_tech','💉 Dialysis Tech'], ['security','🔐 Security'],
  ['electrician','⚡ Electrician'], ['plumber','🔧 Plumber'], ['it_technician','💻 IT Technician'],
  ['equipment_tech','🔩 Equipment Tech'], ['biomedical','🩺 Biomedical'], ['ambulance_driver','🚑 Ambulance Driver'],
];

const emptyQuestion = () => ({ type: 'rating', label: '', required: true });

export default function FeedbackGeneratorPage() {
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showBuilder, setShowBuilder] = useState(false);
  const [resultsFor, setResultsFor] = useState(null); // form object
  const [results, setResults] = useState(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({ title: '', description: '', targetRoles: [], questions: [emptyQuestion()] });

  const load = () => {
    setLoading(true);
    feedbackFormsAPI.getAll().then(res => setForms(res.data.data || [])).catch(() => toast.error('Failed to load forms')).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const resetBuilder = () => setForm({ title: '', description: '', targetRoles: [], questions: [emptyQuestion()] });

  const addQuestion = () => setForm(f => {
    const lastType = f.questions[f.questions.length - 1]?.type || 'rating';
    return { ...f, questions: [...f.questions, { ...emptyQuestion(), type: lastType }] };
  });
  const removeQuestion = (i) => setForm(f => ({ ...f, questions: f.questions.filter((_,idx)=>idx!==i) }));
  const updateQuestion = (i, patch) => setForm(f => ({ ...f, questions: f.questions.map((q,idx)=>idx===i?{...q,...patch}:q) }));
  const toggleRole = (role) => setForm(f => ({ ...f, targetRoles: f.targetRoles.includes(role) ? f.targetRoles.filter(r=>r!==role) : [...f.targetRoles, role] }));

  const submitForm = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { toast.error('Give the form a title'); return; }
    if (!form.targetRoles.length) { toast.error('Select at least one dashboard to send this to'); return; }
    if (form.questions.some(q => !q.label.trim())) { toast.error('Every question needs text'); return; }
    setSaving(true);
    try {
      await feedbackFormsAPI.create(form);
      toast.success('✅ Feedback form published!');
      setShowBuilder(false);
      resetBuilder();
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to create form'); }
    setSaving(false);
  };

  const toggleActive = async (f) => {
    try {
      await feedbackFormsAPI.update(f._id, { active: !f.active });
      toast.success(f.active ? 'Form paused' : 'Form reactivated');
      load();
    } catch { toast.error('Failed to update'); }
  };

  const deleteForm = async (f) => {
    if (!window.confirm(`Delete "${f.title}" and all its responses? This can't be undone.`)) return;
    try { await feedbackFormsAPI.delete(f._id); toast.success('Deleted'); load(); } catch { toast.error('Delete failed'); }
  };

  const viewResults = async (f) => {
    setResultsFor(f);
    setResults(null);
    try {
      const res = await feedbackFormsAPI.getResults(f._id);
      setResults(res.data.data);
    } catch { toast.error('Failed to load results'); }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">📝 Feedback Generator</div>
          <div className="page-subtitle">Build custom surveys — questions, star ratings, suggestions — and send them to specific dashboards</div>
        </div>
        <button className="btn btn-primary" onClick={()=>{ resetBuilder(); setShowBuilder(true); }}>+ New Feedback Form</button>
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:60, color:'#94a3b8' }}>Loading…</div>
      ) : forms.length === 0 ? (
        <div style={{ textAlign:'center', padding:60, color:'#94a3b8' }}>
          <div style={{ fontSize:40, marginBottom:10 }}>📋</div>
          No feedback forms yet — create one to start collecting structured input from your staff or patients.
        </div>
      ) : (
        <div style={{ display:'grid', gap:14 }}>
          {forms.map(f => (
            <div key={f._id} className="card" style={{ padding:18 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12, flexWrap:'wrap' }}>
                <div>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ fontSize:15.5, fontWeight:800, color:'#0f172a' }}>{f.title}</span>
                    <span className={`badge ${f.active?'badge-success':'badge-warning'}`}>{f.active?'Active':'Paused'}</span>
                  </div>
                  {f.description && <div style={{ fontSize:12.5, color:'#64748b', marginTop:3 }}>{f.description}</div>}
                  <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginTop:8 }}>
                    {f.targetRoles.map(r => <span key={r} style={{ padding:'2px 9px', background:'#eff6ff', color:'#1d4ed8', borderRadius:7, fontSize:11, fontWeight:700 }}>{ALL_ROLES.find(([k])=>k===r)?.[1] || r}</span>)}
                  </div>
                  <div style={{ fontSize:11.5, color:'#94a3b8', marginTop:8 }}>{f.questions.length} question{f.questions.length!==1?'s':''} · {f.responseCount} response{f.responseCount!==1?'s':''}</div>
                </div>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  <button className="btn btn-outline btn-sm" onClick={()=>viewResults(f)}>📊 Results</button>
                  <button className="btn btn-outline btn-sm" onClick={()=>toggleActive(f)}>{f.active?'⏸ Pause':'▶️ Resume'}</button>
                  <button className="btn btn-danger btn-sm" onClick={()=>deleteForm(f)}>🗑️</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Builder modal ── */}
      <AnimatePresence>
        {showBuilder && (
          <div className="modal-overlay" onClick={e=>{ if(e.target===e.currentTarget) setShowBuilder(false); }}>
            <motion.div className="modal-box" style={{ maxWidth:620 }} initial={{ opacity:0,y:20,scale:.97 }} animate={{ opacity:1,y:0,scale:1 }}>
              <div className="modal-header">
                <span className="modal-title">📝 New Feedback Form</span>
                <button className="btn btn-ghost btn-icon" onClick={()=>setShowBuilder(false)}>✕</button>
              </div>
              <form onSubmit={submitForm}>
                <div className="modal-body" style={{ maxHeight:'65vh', overflowY:'auto' }}>
                  <div className="form-group">
                    <label className="form-label">Title *</label>
                    <input className="form-input" required value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="e.g. Nursing Staff Monthly Check-in" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Description (optional)</label>
                    <input className="form-input" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="Brief context shown above the questions" />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Send to which dashboards? *</label>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                      {ALL_ROLES.map(([key,label]) => (
                        <button key={key} type="button" onClick={()=>toggleRole(key)}
                          style={{ padding:'6px 12px', borderRadius:18, border:'1.5px solid', borderColor: form.targetRoles.includes(key)?'#2563eb':'#e2e8f0', background: form.targetRoles.includes(key)?'#eff6ff':'#fff', color: form.targetRoles.includes(key)?'#1d4ed8':'#64748b', fontSize:12, fontWeight:700, cursor:'pointer' }}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Questions *</label>
                    {form.questions.map((q, i) => (
                      <div key={i} style={{ display:'flex', gap:8, alignItems:'flex-start', marginBottom:10, padding:12, background:'#f8fafc', borderRadius:10 }}>
                        <select value={q.type} onChange={e=>updateQuestion(i,{type:e.target.value})} style={{ padding:'8px 10px', borderRadius:8, border:'1.5px solid #e2e8f0', fontSize:12.5, flexShrink:0, width:120 }}>
                          <option value="rating">⭐ Star Rating</option>
                          <option value="suggestion">💡 Suggestion</option>
                          <option value="text">📝 Remarks</option>
                        </select>
                        <input className="form-input" style={{ flex:1 }} value={q.label} onChange={e=>updateQuestion(i,{label:e.target.value})} placeholder="Question text…" />
                        <span style={{ fontSize:10.5, color:'#94a3b8', flexShrink:0, whiteSpace:'nowrap', padding:'8px 2px' }}>
                          → {q.type==='rating' ? '⭐ stars' : '📝 text box'}
                        </span>
                        <label style={{ display:'flex', alignItems:'center', gap:5, fontSize:11.5, color:'#64748b', flexShrink:0, whiteSpace:'nowrap', padding:'8px 4px', cursor:'pointer' }}>
                          <input type="checkbox" checked={q.required} onChange={e=>updateQuestion(i,{required:e.target.checked})} />
                          Required
                        </label>
                        <button type="button" onClick={()=>removeQuestion(i)} disabled={form.questions.length===1}
                          style={{ background:'none', border:'none', color:'#dc2626', fontSize:16, cursor: form.questions.length===1?'not-allowed':'pointer', opacity: form.questions.length===1?.3:1, padding:'8px 4px' }}>🗑️</button>
                      </div>
                    ))}
                    <button type="button" className="btn btn-outline btn-sm" onClick={addQuestion}>+ Add Question</button>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-outline" onClick={()=>setShowBuilder(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>{saving?'Publishing…':'📤 Publish Form'}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Results modal ── */}
      <AnimatePresence>
        {resultsFor && (
          <div className="modal-overlay" onClick={e=>{ if(e.target===e.currentTarget){ setResultsFor(null); setResults(null); } }}>
            <motion.div className="modal-box" style={{ maxWidth:600 }} initial={{ opacity:0,y:20,scale:.97 }} animate={{ opacity:1,y:0,scale:1 }}>
              <div className="modal-header">
                <span className="modal-title">📊 Results — {resultsFor.title}</span>
                <button className="btn btn-ghost btn-icon" onClick={()=>{ setResultsFor(null); setResults(null); }}>✕</button>
              </div>
              <div className="modal-body" style={{ maxHeight:'65vh', overflowY:'auto' }}>
                {!results ? (
                  <div style={{ textAlign:'center', padding:30, color:'#94a3b8' }}>Loading…</div>
                ) : results.totalResponses === 0 ? (
                  <div style={{ textAlign:'center', padding:30, color:'#94a3b8' }}>No responses yet</div>
                ) : (
                  <>
                    <div style={{ fontSize:12.5, color:'#64748b', marginBottom:16 }}>{results.totalResponses} total response{results.totalResponses!==1?'s':''}</div>
                    {results.questionResults.map(q => (
                      <div key={q.questionId} style={{ marginBottom:20, paddingBottom:16, borderBottom:'1px solid #f1f5f9' }}>
                        <div style={{ fontWeight:700, fontSize:13.5, color:'#0f172a', marginBottom:8 }}>{q.label}</div>
                        {q.type === 'rating' ? (
                          <>
                            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                              <div style={{ fontSize:26, fontWeight:800 }}>{q.average ?? '—'}</div>
                              <div style={{ color:'#f59e0b' }}>{'★'.repeat(Math.round(q.average||0))}{'☆'.repeat(5-Math.round(q.average||0))}</div>
                              <div style={{ fontSize:11.5, color:'#94a3b8' }}>({q.responseCount} responses)</div>
                            </div>
                            {[5,4,3,2,1].map(star => (
                              <div key={star} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
                                <span style={{ fontSize:11, width:14 }}>{star}</span>
                                <div style={{ flex:1, height:7, background:'#f1f5f9', borderRadius:4, overflow:'hidden' }}>
                                  <div style={{ width:`${q.responseCount?(q.distribution[star-1]/q.responseCount*100):0}%`, height:'100%', background:'#f59e0b' }} />
                                </div>
                                <span style={{ fontSize:11, color:'#94a3b8', width:20 }}>{q.distribution[star-1]}</span>
                              </div>
                            ))}
                          </>
                        ) : (
                          <div style={{ display:'grid', gap:6 }}>
                            {q.responses.length === 0 ? <div style={{ fontSize:12, color:'#94a3b8' }}>No responses</div> : q.responses.map((r,i) => (
                              <div key={i} style={{ background:'#f8fafc', padding:'8px 11px', borderRadius:8, fontSize:12.5 }}>
                                <span style={{ color:'#374151' }}>"{r.text}"</span>
                                {r.respondentName && <span style={{ color:'#94a3b8', fontSize:11 }}> — {r.respondentName}</span>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
