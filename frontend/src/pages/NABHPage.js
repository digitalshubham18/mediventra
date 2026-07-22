import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { nabhAPI } from '../utils/api';
import toast from 'react-hot-toast';

const inp = { width:'100%', padding:'9px 12px', border:'1.5px solid #e2e8f0', borderRadius:9, fontSize:13.5, outline:'none', fontFamily:'inherit', background:'#fff' };
const lbl = { display:'block', fontSize:11.5, fontWeight:700, color:'#374151', marginBottom:5 };
const CATEGORIES = ['Patient Safety','Infection Control','Medication Management','Facility & Equipment','HR & Training','Patient Rights','Documentation & Records','Other'];
const ITEM_STATUS_CFG = {
  pending:{bg:'#f1f5f9',c:'#64748b',label:'Pending'}, compliant:{bg:'#dcfce7',c:'#15803d',label:'✅ Compliant'},
  non_compliant:{bg:'#fee2e2',c:'#dc2626',label:'❌ Non-Compliant'}, not_applicable:{bg:'#f1f5f9',c:'#94a3b8',label:'N/A'},
};

function IndicatorCard({ icon, label, value, sub }) {
  return (
    <div className="card"><div className="card-body" style={{ textAlign:'center' }}>
      <div style={{ fontSize:24, marginBottom:6 }}>{icon}</div>
      <div style={{ fontSize:24, fontWeight:800, color: value==null?'#cbd5e1':'#0f172a' }}>{value==null?'—':value}</div>
      <div style={{ fontSize:11.5, color:'#64748b', fontWeight:600, marginTop:2 }}>{label}</div>
      {sub && <div style={{ fontSize:10.5, color:'#94a3b8', marginTop:2 }}>{sub}</div>}
    </div></div>
  );
}

export default function NABHPage() {
  const [tab, setTab] = useState('indicators');
  const [indicators, setIndicators] = useState(null);

  const [standards, setStandards] = useState([]);
  const [showStdModal, setShowStdModal] = useState(false);
  const [stdForm, setStdForm] = useState({ code:'', category:'Patient Safety', description:'' });
  const [savingStd, setSavingStd] = useState(false);

  const [audits, setAudits] = useState([]);
  const [auditsLoading, setAuditsLoading] = useState(true);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [auditForm, setAuditForm] = useState({ title:'', department:'', auditDate:'' });
  const [creatingAudit, setCreatingAudit] = useState(false);
  const [activeAudit, setActiveAudit] = useState(null);
  const [savingItem, setSavingItem] = useState(null);

  useEffect(() => { nabhAPI.getQualityIndicators().then(r=>setIndicators(r.data.data)).catch(()=>{}); }, []);
  useEffect(() => { if (tab === 'standards') nabhAPI.getStandards(true).then(r=>setStandards(r.data.data||[])).catch(()=>toast.error('Failed to load standards')); }, [tab]);

  const loadAudits = useCallback(() => {
    setAuditsLoading(true);
    nabhAPI.getAudits().then(r=>setAudits(r.data.data||[])).catch(()=>toast.error('Failed to load audits')).finally(()=>setAuditsLoading(false));
  }, []);
  useEffect(() => { if (tab === 'audits') loadAudits(); }, [tab, loadAudits]);

  const submitStandard = async (e) => {
    e.preventDefault();
    if (!stdForm.code.trim() || !stdForm.description.trim()) { toast.error('Code and description are required'); return; }
    setSavingStd(true);
    try {
      await nabhAPI.createStandard(stdForm);
      toast.success('✅ Standard added');
      setShowStdModal(false);
      setStdForm({ code:'', category:'Patient Safety', description:'' });
      nabhAPI.getStandards(true).then(r=>setStandards(r.data.data||[]));
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to add standard'); }
    setSavingStd(false);
  };

  const deactivateStd = async (s) => {
    if (!window.confirm(`Deactivate "${s.code}"? It won't appear in future audits.`)) return;
    try { await nabhAPI.deleteStandard(s._id); toast.success('Deactivated'); nabhAPI.getStandards(true).then(r=>setStandards(r.data.data||[])); }
    catch { toast.error('Failed'); }
  };

  const submitAudit = async (e) => {
    e.preventDefault();
    if (!auditForm.title.trim() || !auditForm.auditDate) { toast.error('Title and date are required'); return; }
    setCreatingAudit(true);
    try {
      const r = await nabhAPI.createAudit(auditForm);
      toast.success('✅ Audit started');
      setShowAuditModal(false);
      setAuditForm({ title:'', department:'', auditDate:'' });
      loadAudits();
      setActiveAudit(r.data.data);
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to start audit — add some standards first if none exist'); }
    setCreatingAudit(false);
  };

  const openAudit = async (a) => {
    const r = await nabhAPI.getAudit(a._id);
    setActiveAudit(r.data.data);
  };

  const setItemStatus = async (standardId, status) => {
    setSavingItem(standardId);
    try { const r = await nabhAPI.updateAuditItem(activeAudit._id, { standardId, status }); setActiveAudit(r.data.data); }
    catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
    setSavingItem(null);
  };
  const setItemNote = async (standardId, evidence) => {
    try { const r = await nabhAPI.updateAuditItem(activeAudit._id, { standardId, evidence }); setActiveAudit(r.data.data); }
    catch { /* silent — saved on blur, not critical */ }
  };

  const finishAudit = async () => {
    try {
      const r = await nabhAPI.completeAudit(activeAudit._id);
      toast.success(`✅ Audit completed — score ${r.data.data.overallScore}%`);
      setActiveAudit(r.data.data);
      loadAudits();
      nabhAPI.getQualityIndicators().then(res=>setIndicators(res.data.data));
    } catch (e) { toast.error(e.response?.data?.error || 'Complete every checklist item first'); }
  };

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">🏅 NABH Compliance</div><div className="page-subtitle">Quality indicators, accreditation checklist, and audit trail</div></div>
      </div>

      <div style={{ display:'flex', gap:6, marginBottom:18 }}>
        {[['indicators','📊 Quality Indicators'],['audits','📋 Audits'],['standards','📖 Standards']].map(([k,l]) => (
          <button key={k} onClick={()=>setTab(k)} style={{ padding:'9px 16px', borderRadius:11, border:'none', background:tab===k?'#eef2ff':'#f8fafc', color:tab===k?'#4338ca':'#64748b', fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>{l}</button>
        ))}
      </div>

      {tab === 'indicators' && (
        <div>
          <div className="stat-grid" style={{ marginBottom:20 }}>
            <IndicatorCard icon="😊" value={indicators?.patientSatisfaction != null ? `${indicators.patientSatisfaction}%` : null} label="Patient Satisfaction" sub={indicators?.reviewCount ? `from ${indicators.reviewCount} reviews` : 'no reviews yet'} />
            <IndicatorCard icon="📋" value={indicators?.staffDocCompliance != null ? `${indicators.staffDocCompliance}%` : null} label="Staff Doc. Compliance" sub={indicators?.staffTotal ? `of ${indicators.staffTotal} staff` : ''} />
            <IndicatorCard icon="🕒" value={indicators?.punctualityRate != null ? `${indicators.punctualityRate}%` : null} label="Attendance Punctuality" sub="last 30 days" />
            <IndicatorCard icon="🏅" value={indicators?.avgAuditScore != null ? `${indicators.avgAuditScore}%` : null} label="Avg. Audit Score" sub="last 6 completed audits" />
          </div>
          {indicators?.recentAudits?.length > 0 && (
            <div className="card">
              <div className="card-header"><span className="card-title">Recent Completed Audits</span></div>
              <div className="card-body">
                {indicators.recentAudits.map(a => (
                  <div key={a._id} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid #f1f5f9' }}>
                    <div style={{ fontSize:13, fontWeight:600 }}>{a.title}</div>
                    <div style={{ fontSize:12, color:'#64748b' }}>{new Date(a.auditDate).toLocaleDateString('en-IN')} — <strong style={{ color: a.overallScore>=80?'#15803d':a.overallScore>=50?'#d97706':'#dc2626' }}>{a.overallScore}%</strong></div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'audits' && (
        <div>
          <div style={{ marginBottom:16 }}><button className="btn btn-primary" onClick={()=>setShowAuditModal(true)}>+ Start New Audit</button></div>
          {auditsLoading ? (
            <div style={{ textAlign:'center', padding:40, color:'#94a3b8' }}>Loading…</div>
          ) : audits.length === 0 ? (
            <div className="card"><div className="card-body" style={{ textAlign:'center', padding:40, color:'#94a3b8' }}>No audits yet</div></div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {audits.map(a => (
                <div key={a._id} className="card" style={{ cursor:'pointer' }} onClick={()=>openAudit(a)}>
                  <div className="card-body" style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8 }}>
                    <div>
                      <div style={{ fontWeight:700, fontSize:14 }}>{a.title}{a.department && ` — ${a.department}`}</div>
                      <div style={{ fontSize:11.5, color:'#64748b' }}>{new Date(a.auditDate).toLocaleDateString('en-IN')} · by {a.auditedBy?.name}</div>
                    </div>
                    <span style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700, background: a.status==='completed' ? (a.overallScore>=80?'#dcfce7':'#fef3c7') : '#eef2ff', color: a.status==='completed' ? (a.overallScore>=80?'#15803d':'#92400e') : '#4338ca' }}>
                      {a.status==='completed' ? `${a.overallScore}% compliant` : '📝 Draft'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'standards' && (
        <div>
          <div style={{ marginBottom:16 }}><button className="btn btn-primary" onClick={()=>setShowStdModal(true)}>+ Add Standard</button></div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {CATEGORIES.map(cat => {
              const catStandards = standards.filter(s => s.category === cat);
              if (catStandards.length === 0) return null;
              return (
                <div key={cat} className="card">
                  <div className="card-header"><span className="card-title">{cat}</span></div>
                  <div className="card-body">
                    {catStandards.map(s => (
                      <div key={s._id} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid #f1f5f9', opacity: s.active?1:0.5 }}>
                        <div>
                          <span style={{ fontWeight:700, fontSize:12 }}>{s.code}</span>
                          <span style={{ fontSize:12.5, color:'#374151', marginLeft:8 }}>{s.description}</span>
                        </div>
                        {s.active && <button onClick={()=>deactivateStd(s)} style={{ background:'none', border:'none', color:'#dc2626', cursor:'pointer', fontSize:11 }}>Deactivate</button>}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            {standards.length === 0 && <div className="card"><div className="card-body" style={{ textAlign:'center', padding:40, color:'#94a3b8' }}>No standards defined yet — add your accreditation checklist items here.</div></div>}
          </div>
        </div>
      )}

      {/* ── NEW STANDARD MODAL ── */}
      <AnimatePresence>
        {showStdModal && (
          <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)setShowStdModal(false);}}>
            <motion.div className="modal-box" style={{ maxWidth:460 }} initial={{opacity:0,y:20}} animate={{opacity:1,y:0}}>
              <div className="modal-header"><span className="modal-title">📖 New Compliance Standard</span><button className="btn btn-ghost btn-icon" onClick={()=>setShowStdModal(false)}>✕</button></div>
              <form onSubmit={submitStandard}>
                <div className="modal-body">
                  <div style={{ marginBottom:11 }}><label style={lbl}>Code *</label><input style={inp} required value={stdForm.code} onChange={e=>setStdForm(f=>({...f,code:e.target.value}))} placeholder="e.g. PSQ-1.1" /></div>
                  <div style={{ marginBottom:11 }}><label style={lbl}>Category</label><select style={inp} value={stdForm.category} onChange={e=>setStdForm(f=>({...f,category:e.target.value}))}>{CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
                  <div><label style={lbl}>Description *</label><textarea style={inp} rows={3} required value={stdForm.description} onChange={e=>setStdForm(f=>({...f,description:e.target.value}))} /></div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-outline" onClick={()=>setShowStdModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={savingStd}>{savingStd?'Saving…':'✓ Add Standard'}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── NEW AUDIT MODAL ── */}
      <AnimatePresence>
        {showAuditModal && (
          <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)setShowAuditModal(false);}}>
            <motion.div className="modal-box" style={{ maxWidth:440 }} initial={{opacity:0,y:20}} animate={{opacity:1,y:0}}>
              <div className="modal-header"><span className="modal-title">📋 Start New Audit</span><button className="btn btn-ghost btn-icon" onClick={()=>setShowAuditModal(false)}>✕</button></div>
              <form onSubmit={submitAudit}>
                <div className="modal-body">
                  <div style={{ fontSize:12, color:'#64748b', marginBottom:14 }}>This creates a checklist from every active standard for you to work through.</div>
                  <div style={{ marginBottom:11 }}><label style={lbl}>Audit Title *</label><input style={inp} required value={auditForm.title} onChange={e=>setAuditForm(f=>({...f,title:e.target.value}))} placeholder="e.g. Q3 Internal Audit" /></div>
                  <div style={{ marginBottom:11 }}><label style={lbl}>Department</label><input style={inp} value={auditForm.department} onChange={e=>setAuditForm(f=>({...f,department:e.target.value}))} placeholder="Optional — leave blank for hospital-wide" /></div>
                  <div><label style={lbl}>Audit Date *</label><input type="date" style={inp} required value={auditForm.auditDate} onChange={e=>setAuditForm(f=>({...f,auditDate:e.target.value}))} /></div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-outline" onClick={()=>setShowAuditModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={creatingAudit}>{creatingAudit?'Starting…':'✓ Start Audit'}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── AUDIT CHECKLIST MODAL ── */}
      <AnimatePresence>
        {activeAudit && (
          <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)setActiveAudit(null);}}>
            <motion.div className="modal-box" style={{ maxWidth:640 }} initial={{opacity:0,y:20}} animate={{opacity:1,y:0}}>
              <div className="modal-header"><span className="modal-title">📋 {activeAudit.title}</span><button className="btn btn-ghost btn-icon" onClick={()=>setActiveAudit(null)}>✕</button></div>
              <div className="modal-body" style={{ maxHeight:'65vh', overflowY:'auto' }}>
                {activeAudit.status === 'completed' && (
                  <div style={{ background:'#dcfce7', borderRadius:10, padding:'10px 14px', marginBottom:14, fontWeight:700, color:'#15803d' }}>✅ Completed — Overall Score: {activeAudit.overallScore}%</div>
                )}
                {activeAudit.items.map((it) => (
                  <div key={it.standard._id} style={{ padding:'12px 0', borderBottom:'1px solid #f1f5f9' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', gap:10, marginBottom:8 }}>
                      <div style={{ fontSize:12.5 }}><strong>{it.standard.code}</strong> — {it.standard.description}</div>
                      <span style={{ padding:'2px 8px', borderRadius:20, fontSize:10.5, fontWeight:700, background:ITEM_STATUS_CFG[it.status].bg, color:ITEM_STATUS_CFG[it.status].c, whiteSpace:'nowrap', height:'fit-content' }}>{ITEM_STATUS_CFG[it.status].label}</span>
                    </div>
                    {activeAudit.status !== 'completed' && (
                      <>
                        <div style={{ display:'flex', gap:6, marginBottom:6 }}>
                          {['compliant','non_compliant','not_applicable'].map(st => (
                            <button key={st} disabled={savingItem===it.standard._id} onClick={()=>setItemStatus(it.standard._id, st)}
                              style={{ padding:'5px 10px', borderRadius:8, border: it.status===st ? '2px solid #4338ca' : '1px solid #e2e8f0', background: it.status===st?'#eef2ff':'#fff', fontSize:11, fontWeight:600, cursor:'pointer' }}>
                              {ITEM_STATUS_CFG[st].label}
                            </button>
                          ))}
                        </div>
                        <input placeholder="Evidence / notes" defaultValue={it.evidence} onBlur={e=>setItemNote(it.standard._id, e.target.value)} style={{ ...inp, fontSize:12, padding:'6px 10px' }} />
                      </>
                    )}
                    {activeAudit.status === 'completed' && it.evidence && <div style={{ fontSize:11.5, color:'#64748b' }}>📝 {it.evidence}</div>}
                  </div>
                ))}
              </div>
              {activeAudit.status !== 'completed' && (
                <div className="modal-footer">
                  <button className="btn btn-primary" style={{ width:'100%' }} onClick={finishAudit}>✓ Complete Audit</button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
