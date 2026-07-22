import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { radiologyAPI, usersAPI, getFileUrl } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const inp = { width:'100%', padding:'9px 12px', border:'1.5px solid #e2e8f0', borderRadius:9, fontSize:13.5, outline:'none', fontFamily:'inherit', background:'#fff' };
const lbl = { display:'block', fontSize:11.5, fontWeight:700, color:'#374151', marginBottom:5 };
const MODALITIES = ['X-Ray','Ultrasound','CT Scan','MRI','Mammography','ECG','Other'];
const STATUS_CFG = {
  ordered:{bg:'#fef3c7',c:'#92400e',label:'📤 Ordered'}, scheduled:{bg:'#eef2ff',c:'#4338ca',label:'📅 Scheduled'},
  in_progress:{bg:'#fee2e2',c:'#dc2626',label:'🔴 In Progress'}, completed:{bg:'#e0f2fe',c:'#0369a1',label:'✅ Scan Done'},
  reported:{bg:'#dcfce7',c:'#15803d',label:'📋 Reported'}, cancelled:{bg:'#f1f5f9',c:'#64748b',label:'✕ Cancelled'},
};
const PRIORITY_CFG = { routine:{c:'#64748b',label:'Routine'}, urgent:{c:'#d97706',label:'🟠 Urgent'}, stat:{c:'#dc2626',label:'🔴 STAT'} };

export default function RadiologyPage() {
  const { user } = useAuth();
  const canOrder = ['doctor','admin'].includes(user?.role);
  const canOperate = ['radiology_tech','admin'].includes(user?.role);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  const [showOrder, setShowOrder] = useState(false);
  const [patients, setPatients] = useState([]);
  const [orderForm, setOrderForm] = useState({ patientId:'', modality:'X-Ray', bodyPart:'', reason:'', priority:'routine' });
  const [creating, setCreating] = useState(false);

  const [detailFor, setDetailFor] = useState(null);
  const [scheduleAt, setScheduleAt] = useState('');
  const [imageFiles, setImageFiles] = useState([]);
  const [reportForm, setReportForm] = useState({ findings:'', impression:'' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    radiologyAPI.getOrders(statusFilter ? { status: statusFilter } : {}).then(r => setOrders(r.data.data || [])).catch(()=>toast.error('Failed to load orders')).finally(()=>setLoading(false));
  }, [statusFilter]);
  useEffect(() => { load(); }, [load]);

  const openOrderModal = async () => {
    if (patients.length === 0) {
      try { const r = await usersAPI.getAll({ role:'patient', status:'approved', limit:300 }); setPatients(r.data.data||[]); } catch {}
    }
    setOrderForm({ patientId:'', modality:'X-Ray', bodyPart:'', reason:'', priority:'routine' });
    setShowOrder(true);
  };

  const submitOrder = async (e) => {
    e.preventDefault();
    if (!orderForm.patientId || !orderForm.reason.trim()) { toast.error('Select a patient and enter the reason'); return; }
    setCreating(true);
    try {
      await radiologyAPI.createOrder({ patient: orderForm.patientId, modality: orderForm.modality, bodyPart: orderForm.bodyPart.trim(), reason: orderForm.reason.trim(), priority: orderForm.priority });
      toast.success('✅ Imaging order placed');
      setShowOrder(false);
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to place order'); }
    setCreating(false);
  };

  const openDetail = async (order) => {
    const r = await radiologyAPI.getOrder(order._id);
    setDetailFor(r.data.data);
    setScheduleAt('');
    setImageFiles([]);
    setReportForm({ findings: r.data.data.report?.findings || '', impression: r.data.data.report?.impression || '' });
  };

  const doSchedule = async () => {
    if (!scheduleAt) { toast.error('Pick a date/time'); return; }
    setBusy(true);
    try { const r = await radiologyAPI.scheduleOrder(detailFor._id, scheduleAt); toast.success('Scheduled'); setDetailFor(r.data.data); load(); }
    catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
    setBusy(false);
  };
  const doStart = async () => {
    setBusy(true);
    try { const r = await radiologyAPI.startOrder(detailFor._id); toast.success('Scan started'); setDetailFor(r.data.data); load(); }
    catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
    setBusy(false);
  };
  const doComplete = async () => {
    if (imageFiles.length === 0 && !(detailFor.images?.length > 0)) {
      toast.error('📷 At least one scan image/report file must be uploaded before completing this scan');
      return;
    }
    setBusy(true);
    try { const r = await radiologyAPI.completeOrder(detailFor._id, imageFiles); toast.success('✅ Scan completed'); setDetailFor(r.data.data); setImageFiles([]); load(); }
    catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
    setBusy(false);
  };
  const doReport = async () => {
    if (!reportForm.impression.trim()) { toast.error('An impression is required to sign off'); return; }
    setBusy(true);
    try { const r = await radiologyAPI.submitReport(detailFor._id, reportForm.findings, reportForm.impression); toast.success('✅ Report signed off'); setDetailFor(r.data.data); load(); }
    catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
    setBusy(false);
  };
  const doCancel = async () => {
    const reason = window.prompt('Reason for cancelling this order?', '') || '';
    setBusy(true);
    try { const r = await radiologyAPI.cancelOrder(detailFor._id, reason); toast.success('Order cancelled'); setDetailFor(r.data.data); load(); }
    catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
    setBusy(false);
  };
  const doDelete = async (order) => {
    if (!window.confirm(`Delete this ${order.modality} report for ${order.patient?.name || 'this patient'}? This cannot be undone.`)) return;
    setBusy(true);
    try { await radiologyAPI.deleteOrder(order._id); toast.success('🗑️ Report deleted'); setDetailFor(null); load(); }
    catch (e) { toast.error(e.response?.data?.error || 'Failed to delete'); }
    setBusy(false);
  };

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">🩻 Radiology</div><div className="page-subtitle">Imaging orders, scheduling, and reporting</div></div>
        {canOrder && <button className="btn btn-primary" onClick={openOrderModal}>+ New Imaging Order</button>}
      </div>

      <div style={{ display:'flex', gap:6, marginBottom:18, flexWrap:'wrap' }}>
        {[['','All'],['ordered','📤 Ordered'],['scheduled','📅 Scheduled'],['in_progress','🔴 In Progress'],['completed','✅ Scan Done'],['reported','📋 Reported'],['cancelled','✕ Cancelled']].map(([k,l]) => (
          <button key={k} onClick={()=>setStatusFilter(k)} style={{ padding:'8px 14px', borderRadius:11, border:'none', background:statusFilter===k?'#eef2ff':'#f8fafc', color:statusFilter===k?'#4338ca':'#64748b', fontWeight:700, fontSize:12.5, cursor:'pointer', fontFamily:'inherit' }}>{l}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:60, color:'#94a3b8' }}>Loading…</div>
      ) : orders.length === 0 ? (
        <div className="card"><div className="card-body" style={{ textAlign:'center', padding:48 }}>
          <div style={{ fontSize:44, marginBottom:10 }}>🩻</div>
          <div style={{ fontWeight:700, fontSize:16 }}>No imaging orders {statusFilter ? `with status "${statusFilter}"` : 'yet'}</div>
        </div></div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:14 }}>
          {orders.map(o => {
            const cfg = STATUS_CFG[o.status] || STATUS_CFG.ordered;
            const pCfg = PRIORITY_CFG[o.priority];
            return (
              <motion.div key={o._id} className="card" initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} style={{ cursor:'pointer' }} onClick={()=>openDetail(o)}>
                <div className="card-body">
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                    <div>
                      <div style={{ fontWeight:800, fontSize:14 }}>{o.modality}{o.bodyPart && ` — ${o.bodyPart}`}</div>
                      <div style={{ fontSize:12, color:'#64748b' }}>{o.patient?.name} · {o.orderNumber}</div>
                    </div>
                    <span style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700, background:cfg.bg, color:cfg.c, height:'fit-content' }}>{cfg.label}</span>
                  </div>
                  <div style={{ fontSize:12.5, color:'#374151', marginBottom:4 }}>📝 {o.reason}</div>
                  <div style={{ fontSize:11.5, color:pCfg.c, fontWeight:700, marginBottom:4 }}>{pCfg.label}</div>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div style={{ fontSize:11, color:'#94a3b8' }}>Ordered by Dr. {o.orderedBy?.name} · {new Date(o.createdAt).toLocaleDateString('en-IN')}</div>
                    {user?.role === 'admin' && <button className="btn btn-danger btn-xs" title="Delete this report" onClick={e=>{e.stopPropagation();doDelete(o);}}>🗑️</button>}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ── NEW ORDER MODAL ── */}
      <AnimatePresence>
        {showOrder && (
          <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)setShowOrder(false);}}>
            <motion.div className="modal-box" style={{ maxWidth:460 }} initial={{opacity:0,y:20}} animate={{opacity:1,y:0}}>
              <div className="modal-header"><span className="modal-title">🩻 New Imaging Order</span><button className="btn btn-ghost btn-icon" onClick={()=>setShowOrder(false)}>✕</button></div>
              <form onSubmit={submitOrder}>
                <div className="modal-body">
                  <div style={{ marginBottom:11 }}><label style={lbl}>Patient *</label>
                    <select style={inp} required value={orderForm.patientId} onChange={e=>setOrderForm(f=>({...f,patientId:e.target.value}))}>
                      <option value="">— Select patient —</option>
                      {patients.map(p=><option key={p._id} value={p._id}>{p.name} ({p.phone||p.email})</option>)}
                    </select>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:11 }}>
                    <div><label style={lbl}>Modality *</label><select style={inp} value={orderForm.modality} onChange={e=>setOrderForm(f=>({...f,modality:e.target.value}))}>{MODALITIES.map(m=><option key={m} value={m}>{m}</option>)}</select></div>
                    <div><label style={lbl}>Body Part</label><input style={inp} value={orderForm.bodyPart} onChange={e=>setOrderForm(f=>({...f,bodyPart:e.target.value}))} placeholder="e.g. Chest" /></div>
                  </div>
                  <div style={{ marginBottom:11 }}><label style={lbl}>Reason / Clinical Notes *</label><textarea style={inp} rows={2} required value={orderForm.reason} onChange={e=>setOrderForm(f=>({...f,reason:e.target.value}))} /></div>
                  <div><label style={lbl}>Priority</label><select style={inp} value={orderForm.priority} onChange={e=>setOrderForm(f=>({...f,priority:e.target.value}))}><option value="routine">Routine</option><option value="urgent">Urgent</option><option value="stat">STAT</option></select></div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-outline" onClick={()=>setShowOrder(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={creating}>{creating?'Placing…':'✓ Place Order'}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── DETAIL / WORKFLOW MODAL ── */}
      <AnimatePresence>
        {detailFor && (
          <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)setDetailFor(null);}}>
            <motion.div className="modal-box" style={{ maxWidth:560 }} initial={{opacity:0,y:20}} animate={{opacity:1,y:0}}>
              <div className="modal-header"><span className="modal-title">{detailFor.modality} — {detailFor.patient?.name}</span><button className="btn btn-ghost btn-icon" onClick={()=>setDetailFor(null)}>✕</button></div>
              <div className="modal-body" style={{ maxHeight:'65vh', overflowY:'auto' }}>
                <div style={{ marginBottom:14, display:'flex', gap:8, flexWrap:'wrap' }}>
                  <span style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700, background:STATUS_CFG[detailFor.status].bg, color:STATUS_CFG[detailFor.status].c }}>{STATUS_CFG[detailFor.status].label}</span>
                  <span style={{ fontSize:12, color:'#64748b' }}>{detailFor.orderNumber}</span>
                </div>
                <div style={{ fontSize:13, marginBottom:6 }}><strong>Reason:</strong> {detailFor.reason}</div>
                {detailFor.bodyPart && <div style={{ fontSize:13, marginBottom:6 }}><strong>Body Part:</strong> {detailFor.bodyPart}</div>}
                <div style={{ fontSize:13, marginBottom:14 }}><strong>Ordered by:</strong> Dr. {detailFor.orderedBy?.name}</div>

                {detailFor.status === 'ordered' && canOperate && (
                  <div style={{ marginBottom:14 }}>
                    <label style={lbl}>Schedule Date/Time</label>
                    <input type="datetime-local" style={inp} value={scheduleAt} onChange={e=>setScheduleAt(e.target.value)} />
                  </div>
                )}

                {detailFor.status === 'completed' || detailFor.status === 'reported' ? (
                  detailFor.images?.length > 0 && (
                    <div style={{ marginBottom:14 }}>
                      <label style={lbl}>Images</label>
                      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                        {detailFor.images.map((img,i) => (
                          <a key={i} href={getFileUrl(img)} target="_blank" rel="noreferrer"><img src={getFileUrl(img)} alt={`scan ${i+1}`} style={{ width:80, height:80, objectFit:'cover', borderRadius:8, border:'1px solid #e2e8f0' }} /></a>
                        ))}
                      </div>
                    </div>
                  )
                ) : detailFor.status === 'in_progress' && canOperate && (
                  <div style={{ marginBottom:14 }}>
                    <label style={lbl}>Upload Scan Images *</label>
                    <input type="file" multiple required accept="image/*,application/pdf" onChange={e=>setImageFiles(Array.from(e.target.files))} />
                    <div style={{ fontSize:11, color:'#94a3b8', marginTop:4 }}>At least one image/report file is mandatory to complete this scan — it's logged in the audit trail.</div>
                  </div>
                )}

                {['completed','reported'].includes(detailFor.status) && canOrder && (
                  <div style={{ marginTop:10, borderTop:'1px solid #e2e8f0', paddingTop:14 }}>
                    <label style={lbl}>Findings</label>
                    <textarea style={{...inp, marginBottom:10}} rows={3} value={reportForm.findings} onChange={e=>setReportForm(f=>({...f,findings:e.target.value}))} disabled={detailFor.status==='reported'} />
                    <label style={lbl}>Impression / Conclusion *</label>
                    <textarea style={inp} rows={2} value={reportForm.impression} onChange={e=>setReportForm(f=>({...f,impression:e.target.value}))} disabled={detailFor.status==='reported'} />
                    {detailFor.status === 'reported' && <div style={{ fontSize:11.5, color:'#15803d', marginTop:6 }}>✓ Signed off by Dr. {detailFor.report?.reportedBy?.name} on {new Date(detailFor.report?.reportedAt).toLocaleDateString('en-IN')}</div>}
                  </div>
                )}
              </div>
              <div className="modal-footer" style={{ flexWrap:'wrap' }}>
                {detailFor.status === 'ordered' && canOperate && <button className="btn btn-primary" disabled={busy} onClick={doSchedule}>📅 Schedule</button>}
                {['ordered','scheduled'].includes(detailFor.status) && canOperate && <button className="btn btn-primary" disabled={busy} onClick={doStart}>🔴 Start Scan</button>}
                {detailFor.status === 'in_progress' && canOperate && <button className="btn btn-primary" disabled={busy || (imageFiles.length===0 && !(detailFor.images?.length>0))} onClick={doComplete}>✅ Complete Scan</button>}
                {detailFor.status === 'completed' && canOrder && <button className="btn btn-primary" disabled={busy} onClick={doReport}>📋 Sign Off Report</button>}
                {!['completed','reported','cancelled'].includes(detailFor.status) && canOrder && <button className="btn btn-outline" disabled={busy} onClick={doCancel}>Cancel Order</button>}
                {user?.role === 'admin' && <button className="btn btn-danger" disabled={busy} onClick={()=>doDelete(detailFor)}>🗑️ Delete Report</button>}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
