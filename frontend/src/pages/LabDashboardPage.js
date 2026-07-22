import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { recordsAPI, getFileUrl } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { getSocket } from '../utils/socket';
import toast from 'react-hot-toast';

const STATUS_CFG = {
  pending:    { bg:'#fef3c7', c:'#92400e', label:'Pending',    dot:'#f59e0b', next:'processing', nextLabel:'▶ Start Processing' },
  processing: { bg:'#dbeafe', c:'#1d4ed8', label:'Processing', dot:'#3b82f6', next:'completed',  nextLabel:'📤 Upload Report'  },
  completed:  { bg:'#dcfce7', c:'#15803d', label:'Completed',  dot:'#22c55e', next:null,         nextLabel:null       },
  abnormal:   { bg:'#fee2e2', c:'#dc2626', label:'Abnormal',   dot:'#ef4444', next:'completed',  nextLabel:'✅ Mark Reviewed' },
};
const URGENCY_CFG = {
  routine:{ label:'Routine', c:'#64748b', bg:'#f1f5f9' },
  urgent: { label:'Urgent',  c:'#d97706', bg:'#fef3c7' },
  stat:   { label:'STAT',    c:'#dc2626', bg:'#fee2e2' },
};
const STORAGE_KEY = 'hms_lab_reports';
const loadLocal = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]'); } catch { return []; } };
const saveLocal = (r) => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(r)); } catch {} };

// A report that hasn't finished syncing to the server still carries a
// client-side temporary id (a raw timestamp) instead of a real Mongo
// ObjectId. Any update attempt against one of these must be blocked client
// side too — otherwise it hits the backend's CastError guard every time.
const isRealId = (id) => /^[a-f0-9]{24}$/i.test(id || '');

export default function LabDashboardPage() {
  const { user }  = useAuth();
  const [reports,  setReports]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [tab,      setTab]      = useState('pending');
  const [selected, setSelected] = useState(null);
  const [search,   setSearch]   = useState('');
  const [newCount, setNewCount] = useState(0);
  const [resyncing, setResyncing] = useState(null);

  // Photo-required update modal — every status change or result save must
  // go through here, because a fresh photo of the physical report is
  // mandatory on every single update, with no exceptions.
  const [updateModal, setUpdateModal] = useState(null); // { report, targetStatus }
  const [resultNotes, setResultNotes] = useState('');
  const [photoFile,   setPhotoFile]   = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [submittingUpdate, setSubmittingUpdate] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const deleteReport = async (report) => {
    if (!isRealId(report._id)) {
      // Not synced yet — just drop it from local storage, nothing to delete server-side
      const filtered = reports.filter(r => r._id !== report._id);
      setReports(filtered); saveLocal(filtered);
      if (selected?._id === report._id) setSelected(null);
      toast.success('Removed');
      return;
    }
    if (!window.confirm(`Permanently delete this lab report for ${report.patient?.name || 'this patient'}? This cannot be undone.`)) return;
    setDeletingId(report._id);
    try {
      await recordsAPI.delete(report._id);
      const filtered = reports.filter(r => r._id !== report._id);
      setReports(filtered); saveLocal(filtered);
      if (selected?._id === report._id) setSelected(null);
      toast.success('🗑️ Report deleted');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete report');
    }
    setDeletingId(null);
  };

  const load = useCallback(async () => {
    setLoading(true);
    const local = loadLocal();
    setReports(local);
    try {
      const res     = await recordsAPI.getAll({ type:'lab_report', limit:300 });
      const backend = res?.data?.data || [];
      if (backend.length > 0) {
        const ids      = new Set(backend.map(r => r._id));
        const only     = local.filter(r => !ids.has(r._id));
        const merged   = [...backend, ...only].sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt));
        setReports(merged); saveLocal(merged);
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handler = (data) => {
      toast(`🔬 New lab order: ${data.patientName} — ${(data.tests||[]).slice(0,2).join(', ')}`, {
        duration:7000, icon:'🔬',
        style:{ background:'#eff6ff', border:'1px solid #bfdbfe', color:'#1e40af' },
      });
      setNewCount(n => n+1);
      load();
    };
    socket.on('lab_order_placed', handler);

    // When any lab staff member finishes a report (status -> completed/
    // abnormal), refresh this dashboard too — keeps every open lab
    // dashboard in sync instead of only the one that made the change.
    const onDashboardUpdate = () => load();
    socket.on('lab_dashboard_update', onDashboardUpdate);

    return () => {
      socket.off('lab_order_placed', handler);
      socket.off('lab_dashboard_update', onDashboardUpdate);
    };
  }, [load]);

  // A report still stuck on a temp id never actually reached the server —
  // try creating it again instead of letting every update fail forever.
  const retrySync = async (report) => {
    setResyncing(report._id);
    try {
      const fd = new FormData();
      fd.append('type','lab_report'); fd.append('patient', report.patientId || report.patient?._id || '');
      fd.append('title', `Lab Report — ${report.patient?.name || 'Patient'}`);
      fd.append('tests', JSON.stringify(report.tests || []));
      fd.append('urgency', report.urgency || 'routine');
      fd.append('clinicalNotes', report.clinicalNotes || '');
      fd.append('collectionDate', report.collectionDate || '');
      fd.append('status', 'pending');
      fd.append('doctor', report.doctorId || ''); fd.append('doctorName', report.doctorName || '');
      const r = await recordsAPI.create(fd);
      if (r?.data?.data?._id) {
        const realRecord = { ...report, ...r.data.data };
        const cleaned = [realRecord, ...loadLocal().filter(x => x._id !== report._id)];
        saveLocal(cleaned);
        setReports(prev => prev.map(x => x._id === report._id ? realRecord : x));
        if (selected?._id === report._id) setSelected(realRecord);
        toast.success('✅ Synced to server — you can now update it normally.');
      }
    } catch (e) {
      toast.error(e.response?.data?.error || 'Still failed to sync — please re-create this order from the doctor side.');
    }
    setResyncing(null);
  };

  const openUpdateModal = (report, targetStatus) => {
    if (!isRealId(report._id)) {
      toast.error('This report hasn\u2019t finished syncing to the server yet. Use "Retry Sync" first.');
      return;
    }
    setUpdateModal({ report, targetStatus });
    setResultNotes(report.resultNotes || '');
    setPhotoFile(null);
    setPhotoPreview('');
  };

  const onPickPhoto = (file) => {
    setPhotoFile(file);
    if (file) setPhotoPreview(URL.createObjectURL(file));
  };

  const submitUpdate = async (e) => {
    e.preventDefault();
    const { report, targetStatus } = updateModal;
    const photoRequiredNow = targetStatus !== 'processing';
    if (photoRequiredNow && !photoFile) { toast.error('Please attach a photo of the report — this is required whenever results are recorded.'); return; }
    setSubmittingUpdate(true);
    try {
      const fd = new FormData();
      fd.append('status', targetStatus);
      if (resultNotes.trim()) fd.append('resultNotes', resultNotes.trim());
      if (photoFile) fd.append('labPhotos', photoFile);
      const res = await recordsAPI.update(report._id, fd);
      const updatedRec = res?.data?.data || { ...report, status: targetStatus, resultNotes: resultNotes.trim() };

      const upd = loadLocal().map(r => r._id===report._id ? updatedRec : r);
      saveLocal(upd);
      setReports(rs => rs.map(r => r._id===report._id ? updatedRec : r));
      if (selected?._id===report._id) setSelected(updatedRec);

      toast.success(`✅ Marked ${STATUS_CFG[targetStatus]?.label || targetStatus} — report photo saved!`);
      setUpdateModal(null);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save update');
    }
    setSubmittingUpdate(false);
  };

  const byStatus = {
    pending:    reports.filter(r=>r.status==='pending'),
    processing: reports.filter(r=>r.status==='processing'),
    completed:  reports.filter(r=>r.status==='completed'),
    abnormal:   reports.filter(r=>r.status==='abnormal'),
    all:        reports,
  };

  const displayed = (byStatus[tab]||[]).filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (r.patient?.name||'').toLowerCase().includes(q)||(r.tests||[]).some(t=>t.toLowerCase().includes(q));
  });

  const urgentPending = reports.filter(r=>r.status==='pending'&&(r.urgency==='urgent'||r.urgency==='stat'));

  const TABS = [
    {id:'pending',    label:'⏳ Pending',    count:byStatus.pending.length},
    {id:'processing', label:'🔬 Processing', count:byStatus.processing.length},
    {id:'completed',  label:'✅ Completed',  count:byStatus.completed.length},
    {id:'abnormal',   label:'⚠️ Abnormal',   count:byStatus.abnormal.length},
    {id:'all',        label:'📋 All',        count:byStatus.all.length},
  ];

  return (
    <div style={{ fontFamily:"'Inter',system-ui,sans-serif" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:22, flexWrap:'wrap', gap:12 }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ fontSize:22, fontWeight:900, color:'#0f172a' }}>🔬 Lab Dashboard</div>
            {newCount>0&&<motion.div initial={{scale:0}} animate={{scale:1}} style={{ background:'#dc2626', color:'#fff', borderRadius:20, padding:'2px 10px', fontSize:12, fontWeight:800 }}>{newCount} new</motion.div>}
          </div>
          <div style={{ fontSize:13, color:'#94a3b8', marginTop:3 }}>Welcome {user?.name} — Manage all lab investigations</div>
        </div>
        <button onClick={()=>{load();setNewCount(0);}} style={{ padding:'9px 16px', background:'#f1f5f9', border:'1px solid #e2e8f0', borderRadius:10, fontWeight:600, cursor:'pointer', color:'#475569', fontSize:13, fontFamily:'inherit' }}>🔄 Refresh</button>
      </div>

      {urgentPending.length>0&&(
        <motion.div initial={{opacity:0,y:-8}} animate={{opacity:1,y:0}}
          style={{ background:'linear-gradient(135deg,#fef2f2,#fff7ed)', border:'1px solid #fecaca', borderRadius:12, padding:'12px 18px', marginBottom:18, display:'flex', alignItems:'center', gap:12 }}>
          <motion.span animate={{scale:[1,1.2,1]}} transition={{duration:.8,repeat:Infinity}} style={{fontSize:22}}>🚨</motion.span>
          <div style={{flex:1}}>
            <span style={{fontWeight:800,color:'#dc2626',fontSize:13.5}}>STAT/Urgent pending: </span>
            <span style={{color:'#ef4444',fontSize:13}}>{urgentPending.map(r=>`${r.patient?.name||'Patient'} (${r.urgency?.toUpperCase()})`).join(' · ')}</span>
          </div>
          <button onClick={()=>setTab('pending')} style={{padding:'6px 14px',background:'#dc2626',border:'none',borderRadius:8,color:'#fff',fontWeight:700,fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>View Now</button>
        </motion.div>
      )}

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))', gap:10, marginBottom:20 }}>
        {TABS.filter(t=>t.id!=='all').map(t=>{
          const cfg=STATUS_CFG[t.id]||{};
          return (
            <div key={t.id} onClick={()=>setTab(t.id)} style={{ background:cfg.bg||'#f8fafc', border:`1px solid ${cfg.c||'#64748b'}20`, borderRadius:13, padding:'14px', textAlign:'center', cursor:'pointer' }}
              onMouseEnter={e=>e.currentTarget.style.transform='translateY(-2px)'}
              onMouseLeave={e=>e.currentTarget.style.transform='none'}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:5,marginBottom:4}}>
                <div style={{width:8,height:8,borderRadius:'50%',background:cfg.dot||'#64748b'}}/>
                <span style={{fontSize:10.5,fontWeight:700,color:cfg.c||'#64748b',textTransform:'uppercase',letterSpacing:.5}}>{STATUS_CFG[t.id]?.label}</span>
              </div>
              <div style={{fontSize:28,fontWeight:900,color:cfg.c||'#0f172a'}}>{t.count}</div>
            </div>
          );
        })}
        <div onClick={()=>setTab('all')} style={{background:'#0c4a6e',borderRadius:13,padding:'14px',textAlign:'center',cursor:'pointer'}}>
          <div style={{fontSize:10.5,fontWeight:700,color:'rgba(255,255,255,.7)',textTransform:'uppercase',marginBottom:4}}>TOTAL</div>
          <div style={{fontSize:28,fontWeight:900,color:'#fff'}}>{reports.length}</div>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 380px', gap:16, alignItems:'start' }}>
        {/* LEFT list */}
        <div>
          <div style={{display:'flex',gap:4,marginBottom:12,background:'#f1f5f9',padding:4,borderRadius:12,overflowX:'auto'}}>
            {TABS.map(t=>(
              <button key={t.id} onClick={()=>setTab(t.id)} style={{padding:'7px 14px',borderRadius:9,border:'none',fontWeight:700,fontSize:12.5,cursor:'pointer',whiteSpace:'nowrap',background:tab===t.id?'#fff':'transparent',color:tab===t.id?'#0f172a':'#64748b',boxShadow:tab===t.id?'0 1px 6px rgba(0,0,0,.09)':'none',fontFamily:'inherit'}}>
                {t.label} {t.count>0&&<span style={{marginLeft:4,background:tab===t.id?'#0891b2':'#94a3b8',color:'#fff',borderRadius:10,padding:'1px 6px',fontSize:10,fontWeight:800}}>{t.count}</span>}
              </button>
            ))}
          </div>
          <div style={{position:'relative',marginBottom:12}}>
            <span style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:'#94a3b8'}}>🔍</span>
            <input style={{width:'100%',padding:'9px 12px 9px 34px',border:'1.5px solid #e2e8f0',borderRadius:10,fontSize:13.5,outline:'none',fontFamily:'inherit'}} placeholder="Search patient or test…" value={search} onChange={e=>setSearch(e.target.value)}/>
          </div>
          {loading?(
            <div style={{display:'flex',justifyContent:'center',padding:'40px 0'}}>
              <div style={{width:32,height:32,border:'3px solid #e2e8f0',borderTopColor:'#0891b2',borderRadius:'50%',animation:'spin .9s linear infinite'}}/>
            </div>
          ):displayed.length===0?(
            <div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:14,padding:'40px',textAlign:'center'}}>
              <div style={{fontSize:36,marginBottom:8}}>🔬</div>
              <div style={{fontWeight:700,color:'#0f172a'}}>No {tab!=='all'?tab:''} orders</div>
            </div>
          ):(
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {displayed.map((r,i)=>{
                const sc=STATUS_CFG[r.status]||STATUS_CFG.pending;
                const urg=URGENCY_CFG[r.urgency]||URGENCY_CFG.routine;
                const isSel=selected?._id===r._id;
                const synced = isRealId(r._id);
                return (
                  <motion.div key={r._id} initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} transition={{delay:i*.02}}
                    onClick={()=>setSelected(r)}
                    style={{background:'#fff',border:`2px solid ${isSel?'#0891b2':!synced?'#fca5a5':'#e2e8f0'}`,borderRadius:13,padding:'13px 16px',cursor:'pointer',transition:'all .15s',boxShadow:isSel?'0 0 0 3px #0891b220':'none'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:10}}>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:'flex',gap:7,alignItems:'center',flexWrap:'wrap',marginBottom:4}}>
                          <span style={{fontWeight:800,fontSize:14,color:'#0f172a'}}>{r.patient?.name||'Patient'}</span>
                          <span style={{fontSize:10.5,fontWeight:700,padding:'2px 7px',borderRadius:7,background:sc.bg,color:sc.c}}>{sc.label}</span>
                          {r.urgency&&r.urgency!=='routine'&&<span style={{fontSize:10.5,fontWeight:700,padding:'2px 7px',borderRadius:7,background:urg.bg,color:urg.c}}>{urg.label}</span>}
                          {!synced&&<span style={{fontSize:10.5,fontWeight:700,padding:'2px 7px',borderRadius:7,background:'#fee2e2',color:'#dc2626'}}>⚠️ Not synced</span>}
                        </div>
                        <div style={{fontSize:12,color:'#64748b',marginBottom:3}}>🧪 {(r.tests&&r.tests.length)?r.tests.join(', '):(r.testName||'No tests specified')}</div>
                        <div style={{fontSize:11,color:'#94a3b8'}}>Dr. {r.doctorName||'—'} · {new Date(r.createdAt).toLocaleDateString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</div>
                        {r.assignedLabTechName && <div style={{fontSize:10.5,color:'#0d9488',marginTop:3,fontWeight:700}}>🧑‍🔬 Handling: {r.assignedLabTechName}{r.assignedLabTechName===user?.name?' (you)':''}</div>}
                      </div>
                      {!synced ? (
                        <button onClick={e=>{e.stopPropagation();retrySync(r);}} disabled={resyncing===r._id} style={{padding:'5px 10px',background:'#fee2e2',border:'none',borderRadius:8,color:'#dc2626',fontWeight:700,fontSize:11.5,cursor:'pointer',whiteSpace:'nowrap',fontFamily:'inherit',flexShrink:0}}>{resyncing===r._id?'Syncing…':'🔁 Retry Sync'}</button>
                      ) : sc.next&&<button onClick={e=>{e.stopPropagation();openUpdateModal(r,sc.next);}} style={{padding:'5px 10px',background:sc.next==='completed'?'#d1fae5':'#dbeafe',border:'none',borderRadius:8,color:sc.next==='completed'?'#065f46':'#1d4ed8',fontWeight:700,fontSize:11.5,cursor:'pointer',whiteSpace:'nowrap',fontFamily:'inherit',flexShrink:0}}>{sc.nextLabel}</button>}
                      {user?.role==='admin' && (
                        <button onClick={e=>{e.stopPropagation();deleteReport(r);}} disabled={deletingId===r._id} title="Delete report" style={{padding:'5px 9px',background:'#fef2f2',border:'1px solid #fecaca',borderRadius:8,color:'#dc2626',fontWeight:700,fontSize:11.5,cursor:'pointer',whiteSpace:'nowrap',fontFamily:'inherit',flexShrink:0}}>{deletingId===r._id?'…':'🗑️'}</button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT detail */}
        <div style={{position:'sticky',top:16}}>
          {!selected?(
            <div style={{background:'#fff',border:'2px dashed #e2e8f0',borderRadius:16,padding:'40px 20px',textAlign:'center'}}>
              <div style={{fontSize:36,marginBottom:10}}>👈</div>
              <div style={{fontWeight:700,color:'#0f172a',marginBottom:4}}>Select a lab order</div>
              <div style={{fontSize:13,color:'#94a3b8'}}>Click any order to view details and enter results</div>
            </div>
          ):(
            <motion.div key={selected._id} initial={{opacity:0,x:10}} animate={{opacity:1,x:0}}
              style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:16,overflow:'hidden'}}>
              <div style={{background:`linear-gradient(135deg,${STATUS_CFG[selected.status]?.bg||'#f8fafc'},#fff)`,padding:'18px 20px',borderBottom:'1px solid #e2e8f0'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'start',marginBottom:8}}>
                  <div style={{fontWeight:900,fontSize:17,color:'#0f172a'}}>{selected.patient?.name||'—'}</div>
                  <div style={{display:'flex',alignItems:'center',gap:10}}>
                    {user?.role==='admin' && (
                      <button onClick={()=>deleteReport(selected)} disabled={deletingId===selected._id} title="Delete report" style={{background:'#fef2f2',border:'1px solid #fecaca',borderRadius:8,padding:'4px 9px',fontSize:12,color:'#dc2626',fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>{deletingId===selected._id?'Deleting…':'🗑️ Delete'}</button>
                    )}
                    <button onClick={()=>setSelected(null)} style={{background:'none',border:'none',fontSize:18,cursor:'pointer',color:'#94a3b8'}}>✕</button>
                  </div>
                </div>
                <div style={{fontSize:12,color:'#64748b',marginBottom:8}}>Dr. {selected.doctorName} · {selected.collectionDate?new Date(selected.collectionDate).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'}):''}</div>
                <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                  <span style={{padding:'3px 10px',borderRadius:8,fontSize:11.5,fontWeight:700,background:STATUS_CFG[selected.status]?.bg,color:STATUS_CFG[selected.status]?.c}}>{STATUS_CFG[selected.status]?.label}</span>
                  {selected.urgency&&selected.urgency!=='routine'&&<span style={{padding:'3px 10px',borderRadius:8,fontSize:11.5,fontWeight:700,background:URGENCY_CFG[selected.urgency]?.bg,color:URGENCY_CFG[selected.urgency]?.c}}>{URGENCY_CFG[selected.urgency]?.label}</span>}
                </div>
              </div>
              <div style={{padding:'16px 20px'}}>
                <div style={{marginBottom:14}}>
                  <div style={{fontSize:11.5,fontWeight:700,color:'#94a3b8',textTransform:'uppercase',letterSpacing:.5,marginBottom:8}}>Tests ({(selected.tests||[]).length})</div>
                  <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
                    {(selected.tests||[]).length>0 ? (selected.tests||[]).map(t=><span key={t} style={{padding:'4px 10px',background:'#e0f2fe',color:'#0369a1',borderRadius:8,fontSize:12,fontWeight:600}}>{t}</span>)
                      : <span style={{fontSize:12,color:'#94a3b8'}}>No specific tests listed{selected.testName?` — ${selected.testName}`:''}</span>}
                  </div>
                  {selected.assignedLabTechName && (
                    <div style={{marginTop:8,fontSize:11.5,fontWeight:700,color:'#0d9488'}}>🧑‍🔬 Handling: {selected.assignedLabTechName}{selected.assignedLabTechName===user?.name?' (you)':''}</div>
                  )}
                </div>
                {selected.clinicalNotes&&<div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:10,padding:'10px 13px',fontSize:12.5,color:'#15803d',marginBottom:14}}><strong>Notes:</strong> {selected.clinicalNotes}</div>}

                {!isRealId(selected._id) ? (
                  <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:10, padding:'12px 14px', marginBottom:8 }}>
                    <div style={{ fontWeight:700, color:'#dc2626', fontSize:12.5, marginBottom:6 }}>⚠️ This order hasn't finished syncing to the server</div>
                    <div style={{ fontSize:12, color:'#7f1d1d', marginBottom:10 }}>It can't be updated until it's saved to the database with a real ID.</div>
                    <button onClick={()=>retrySync(selected)} disabled={resyncing===selected._id} style={{ width:'100%', padding:'9px', background:'#dc2626', border:'none', borderRadius:9, color:'#fff', fontWeight:700, fontSize:12.5, cursor:'pointer', fontFamily:'inherit' }}>
                      {resyncing===selected._id?'Syncing…':'🔁 Retry Sync Now'}
                    </button>
                  </div>
                ) : (
                  <div style={{display:'flex',gap:7,marginBottom:14,flexWrap:'wrap'}}>
                    {STATUS_CFG[selected.status]?.next&&<button onClick={()=>openUpdateModal(selected,STATUS_CFG[selected.status].next)} style={{flex:1,padding:'9px',background:'linear-gradient(135deg,#0891b2,#0c4a6e)',border:'none',borderRadius:9,color:'#fff',fontWeight:700,fontSize:12.5,cursor:'pointer',fontFamily:'inherit'}}>{STATUS_CFG[selected.status].nextLabel}</button>}
                    {selected.status!=='abnormal'&&<button onClick={()=>openUpdateModal(selected,'abnormal')} style={{padding:'9px 14px',background:'#fee2e2',border:'none',borderRadius:9,color:'#dc2626',fontWeight:700,fontSize:12.5,cursor:'pointer',fontFamily:'inherit'}}>⚠️ Abnormal</button>}
                  </div>
                )}

                {selected.resultNotes&&<div style={{marginBottom:14,background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:10,padding:'12px'}}>
                  <div style={{fontSize:11,fontWeight:700,color:'#15803d',textTransform:'uppercase',marginBottom:4}}>Saved Result</div>
                  <div style={{fontSize:12.5,color:'#374151',whiteSpace:'pre-wrap'}}>{selected.resultNotes}</div>
                </div>}

                {selected.labPhotos?.length > 0 && (
                  <div>
                    <div style={{fontSize:11.5,fontWeight:700,color:'#94a3b8',textTransform:'uppercase',letterSpacing:.5,marginBottom:8}}>Report Photo History ({selected.labPhotos.length})</div>
                    <div style={{display:'flex',gap:7,overflowX:'auto',paddingBottom:4}}>
                      {selected.labPhotos.map((p,i) => (
                        <div key={i} style={{flexShrink:0,textAlign:'center'}}>
                          <a href={getFileUrl(p.url)} target="_blank" rel="noopener noreferrer">
                            <img src={getFileUrl(p.url)} alt={`Report ${i+1}`} style={{width:64,height:64,objectFit:'cover',borderRadius:9,border:'1.5px solid #e2e8f0'}}
                              onError={e=>{ e.target.style.display='none'; }} />
                          </a>
                          {p.uploadedByName && <div style={{fontSize:9.5,color:'#94a3b8',marginTop:3,maxWidth:64}}>{p.uploadedByName}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selected.updateHistory?.length > 0 && (
                  <div style={{ marginTop:14 }}>
                    <div style={{fontSize:11.5,fontWeight:700,color:'#94a3b8',textTransform:'uppercase',letterSpacing:.5,marginBottom:8}}>Update History — Who & When</div>
                    <div style={{display:'flex',flexDirection:'column',gap:5,maxHeight:140,overflowY:'auto'}}>
                      {[...selected.updateHistory].reverse().map((h,i)=>(
                        <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',background:'#f8fafc',borderRadius:8,padding:'6px 10px'}}>
                          <div>
                            <span style={{fontWeight:700,fontSize:11.5,color:'#0f172a'}}>{h.updatedByName||'—'}</span>
                            <span style={{fontSize:10,color:'#94a3b8',marginLeft:5,textTransform:'capitalize'}}>({h.updatedByRole?.replace('_',' ')})</span>
                            {h.status&&<span style={{fontSize:10,color:'#0891b2',marginLeft:5}}>→ {h.status}</span>}
                          </div>
                          <span style={{fontSize:9.5,color:'#94a3b8',flexShrink:0}}>{new Date(h.at).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* ── Mandatory photo-upload update modal ── */}
      <AnimatePresence>
        {updateModal && (
          <div className="modal-overlay" onClick={e=>{ if(e.target===e.currentTarget) setUpdateModal(null); }}>
            <motion.div className="modal-box" style={{ maxWidth:460 }} initial={{ opacity:0,y:20,scale:.96 }} animate={{ opacity:1,y:0,scale:1 }}>
              <div className="modal-header">
                <span className="modal-title">
                  {updateModal.targetStatus === 'processing' ? '▶️ Start Processing' : updateModal.targetStatus === 'abnormal' ? '⚠️ Mark Abnormal' : '📤 Upload Test Report'} — {updateModal.report.patient?.name}
                </span>
                <button className="btn btn-ghost btn-icon" onClick={()=>setUpdateModal(null)}>✕</button>
              </div>
              <form onSubmit={submitUpdate}>
                <div className="modal-body">
                  {/* Always show exactly which test(s) this report/photo is for */}
                  <div style={{ background:'#f0fdfa', border:'1px solid #99f6e4', borderRadius:10, padding:'10px 13px', marginBottom:14 }}>
                    <div style={{ fontSize:10.5, fontWeight:800, color:'#0f766e', textTransform:'uppercase', letterSpacing:.5, marginBottom:5 }}>🧪 Testing For</div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                      {(updateModal.report.tests||[]).length>0 ? updateModal.report.tests.map(t=>(
                        <span key={t} style={{ padding:'3px 9px', background:'#ccfbf1', color:'#0f766e', borderRadius:7, fontSize:11.5, fontWeight:700 }}>{t}</span>
                      )) : <span style={{ fontSize:12, color:'#0f766e' }}>{updateModal.report.testName || 'No specific tests listed'}</span>}
                    </div>
                  </div>
                  {updateModal.targetStatus === 'processing' ? (
                    <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:10, padding:'9px 13px', marginBottom:16, fontSize:12.5, color:'#1d4ed8' }}>
                      ▶️ Starting processing — no report photo needed yet. You'll attach one when you save the results.
                    </div>
                  ) : (
                    <div style={{ background:'#fef3c7', border:'1px solid #fde68a', borderRadius:10, padding:'9px 13px', marginBottom:16, fontSize:12.5, color:'#92400e' }}>
                      📷 A photo of the physical report is required to save results — no exceptions.
                    </div>
                  )}
                  <div className="form-group">
                    <label className="form-label">Marking as: <strong style={{color:STATUS_CFG[updateModal.targetStatus]?.c}}>{STATUS_CFG[updateModal.targetStatus]?.label}</strong></label>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Result Notes {['completed','abnormal'].includes(updateModal.targetStatus) ? '*' : '(optional)'}</label>
                    <textarea className="form-input" rows={3} required={['completed','abnormal'].includes(updateModal.targetStatus)} value={resultNotes} onChange={e=>setResultNotes(e.target.value)} placeholder="Enter test results, values, observations…" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Test Report Photo {updateModal.targetStatus==='processing' ? '(optional)' : '*'}</label>
                    <input type="file" accept="image/*" required={updateModal.targetStatus!=='processing'} className="form-input" onChange={e=>onPickPhoto(e.target.files?.[0]||null)} />
                    {photoPreview && (
                      <img src={photoPreview} alt="Preview" style={{ marginTop:10, width:'100%', maxHeight:180, objectFit:'contain', borderRadius:9, border:'1.5px solid #e2e8f0', background:'#f8fafc' }} />
                    )}
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-outline" onClick={()=>setUpdateModal(null)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={submittingUpdate || (updateModal.targetStatus!=='processing' && !photoFile)}>{submittingUpdate ? 'Saving…' : updateModal.targetStatus==='processing' ? '▶️ Start Processing' : '📤 Upload Report'}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
