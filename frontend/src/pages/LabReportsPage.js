import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { recordsAPI, usersAPI, appointmentsAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { getSocket } from '../utils/socket';
import toast from 'react-hot-toast';

const LAB_TESTS = [
  'Complete Blood Count (CBC)','Blood Glucose (Fasting)','Blood Glucose (PP)',
  'HbA1c','Lipid Profile','Liver Function Test (LFT)','Kidney Function Test (KFT)',
  'Thyroid Function Test (TFT)','Urine Routine','Urine Culture','Blood Culture',
  'ECG','Chest X-Ray','USG Abdomen','Echo Cardiography','MRI Brain','CT Scan',
  'Dengue NS1 Antigen','COVID-19 RT-PCR','Pregnancy Test (uHCG)',
  'Blood Group & Rh','Haemoglobin','Platelet Count','PT / INR',
  'Serum Electrolytes','Vitamin D','Vitamin B12','Iron Studies',
  'CRP (C-Reactive Protein)','D-Dimer','PSA','HIV Screening',
];

const STATUS_COLOR = {
  pending:    { bg:'#fef3c7', c:'#92400e', label:'Pending'       },
  processing: { bg:'#dbeafe', c:'#1d4ed8', label:'Processing'    },
  completed:  { bg:'#dcfce7', c:'#15803d', label:'Completed'     },
  abnormal:   { bg:'#fee2e2', c:'#dc2626', label:'Abnormal ⚠️'   },
};
const URGENCY = {
  routine:{ label:'Routine', c:'#64748b', bg:'#f1f5f9' },
  urgent: { label:'Urgent',  c:'#d97706', bg:'#fef3c7' },
  stat:   { label:'STAT',    c:'#dc2626', bg:'#fee2e2' },
};

const STORAGE_KEY = 'hms_lab_reports';
function saveLocal(reports){ try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(reports)); }catch{} }
function loadLocal(){ try{ return JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]'); }catch{ return []; } }

export default function LabReportsPage() {
  const { user }   = useAuth();
  const isAdmin    = user?.role === 'admin';
  const isDoctor   = user?.role === 'doctor' || isAdmin;
  const isPatient  = user?.role === 'patient';

  const [reports,      setReports]      = useState([]);
  const [patients,     setPatients]     = useState([]);
  const [patientSearch,setPatientSearch]= useState('');
  const [loading,      setLoading]      = useState(true);
  const [showModal,    setShowModal]    = useState(false);
  const [showView,     setShowView]     = useState(null);
  const [search,       setSearch]       = useState('');
  const [filterStatus, setFS]           = useState('all');
  const [loadingModal, setLM]           = useState(false);
  const [submitting,   setSub]          = useState(false);
  const [form, setForm] = useState({
    patient:'', tests:[], urgency:'routine',
    clinicalNotes:'', collectionDate: new Date().toISOString().split('T')[0],
  });

  // Load: localStorage first (persistent), then try backend
  const load = useCallback(async () => {
    setLoading(true);
    const local = loadLocal();
    const myLocal = isPatient
      ? local.filter(r => r.patientId === (user?._id||user?.id))
      : local;
    setReports(myLocal);
    try {
      const params = { type:'lab_report', limit:200 };
      if (isPatient) params.patient = user?._id||user?.id;
      const res     = await recordsAPI.getAll(params);
      const backend = res?.data?.data || [];
      if (backend.length > 0) {
        const ids      = new Set(backend.map(r => r._id));
        const localOnly= myLocal.filter(r => !ids.has(r._id));
        const merged   = [...backend, ...localOnly].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
        setReports(merged);
      }
    } catch {}
    setLoading(false);
  }, [user, isPatient]);

  useEffect(() => { load(); }, [load]);

  // Real-time: new order from other sessions
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handler = () => load();
    socket.on('lab_order_placed', handler);
    return () => socket.off('lab_order_placed', handler);
  }, [load]);

  const openModal = async () => {
    setShowModal(true);
    setLM(true);
    setPatientSearch('');
    try {
      let list = [];
      if (isAdmin) {
        // Admin manages the whole hospital — full patient list, searchable.
        const res = await usersAPI.getAll({ role:'patient', status:'approved', limit:500 });
        list = res?.data?.data || [];
      } else {
        // A doctor should only be ordering tests for their OWN patients —
        // derived from who actually has an appointment with them, same
        // source of truth the Patients page uses. Prevents one doctor
        // from ordering labs against another doctor's entire patient roster.
        const apptRes = await appointmentsAPI.getAll({ doctorId: user?._id || user?.id });
        const appts = apptRes?.data?.data || [];
        const seen = new Set();
        appts.forEach(a => {
          if (a.patient && !seen.has(a.patient._id)) { seen.add(a.patient._id); list.push(a.patient); }
        });
        list.sort((a,b) => (a.name||'').localeCompare(b.name||''));
      }
      setPatients(list);
      setForm(f => ({ ...f, patient: list[0]?._id||'', tests:[] }));
    } catch { toast.error('Could not load patients'); }
    setLM(false);
  };

  const toggleTest = (test) => setForm(f => ({
    ...f, tests: f.tests.includes(test) ? f.tests.filter(t=>t!==test) : [...f.tests, test],
  }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.patient)           { toast.error('Select a patient');           return; }
    if (form.tests.length === 0) { toast.error('Select at least one test');   return; }
    setSub(true);
    try {
      const patObj = patients.find(p => p._id === form.patient);
      const tempId = String(Date.now());
      const newRec = {
        _id:           tempId,
        type:          'lab_report',
        patientId:     form.patient,
        patient:       patObj,
        tests:         form.tests,
        urgency:       form.urgency,
        clinicalNotes: form.clinicalNotes,
        collectionDate:form.collectionDate,
        status:        'pending',
        doctorId:      user?._id,
        doctorName:    user?.name,
        createdAt:     new Date().toISOString(),
      };
      // Save to localStorage immediately — will never disappear
      const updated = [newRec, ...loadLocal()];
      saveLocal(updated);
      setReports(prev => [newRec, ...prev]);

      // Try backend
      try {
        const fd = new FormData();
        fd.append('type','lab_report'); fd.append('patient',form.patient);
        fd.append('title',`Lab Report — ${patObj?.name||'Patient'}`);
        fd.append('tests',JSON.stringify(form.tests));
        fd.append('urgency',form.urgency); fd.append('clinicalNotes',form.clinicalNotes);
        fd.append('collectionDate',form.collectionDate); fd.append('status','pending');
        fd.append('doctor',user?._id||''); fd.append('doctorName',user?.name||'');
        const r = await recordsAPI.create(fd);
        if (r?.data?.data?._id) {
          newRec._id = r.data.data._id;
          // Replace the temp-id placeholder with the real backend record —
          // using the captured tempId, not a freshly computed timestamp
          // (which would never match and left a permanently-broken
          // duplicate behind with a non-ObjectId id).
          saveLocal([newRec, ...loadLocal().filter(x => x._id !== tempId)]);
          setReports(prev => prev.map(r2 => r2._id === tempId ? newRec : r2));
        }
      } catch (createErr) {
        toast.error(createErr?.response?.data?.error || 'Lab order saved locally but failed to sync to the server — it may not be visible on the Lab Dashboard until this is retried.');
      }

      // Notify lab dashboard via socket
      const socket = getSocket();
      if (socket) socket.emit('lab_order_placed', {
        patientName:patObj?.name, tests:form.tests,
        urgency:form.urgency, doctorName:user?.name,
      });

      toast.success('✅ Lab order placed!');
      setShowModal(false);
      setForm({ patient:'', tests:[], urgency:'routine', clinicalNotes:'', collectionDate: new Date().toISOString().split('T')[0] });
    } catch (err) { toast.error(err?.response?.data?.error||'Failed'); }
    setSub(false);
  };

  const updateStatus = async (id, status) => {
    const all     = loadLocal().map(r => r._id===id?{...r,status}:r);
    saveLocal(all);
    setReports(rs => rs.map(r => r._id===id?{...r,status}:r));
    if (showView?._id===id) setShowView(v=>({...v,status}));
    try { await recordsAPI.update(id,{status}); } catch {}
    toast.success(`Marked ${STATUS_COLOR[status]?.label}`);
  };

  const handleDelete = async (r) => {
    if (!window.confirm(`Delete this lab report for ${r.patient?.name||'this patient'}? This cannot be undone.`)) return;
    saveLocal(loadLocal().filter(x => x._id !== r._id));
    setReports(rs => rs.filter(x => x._id !== r._id));
    if (showView?._id === r._id) setShowView(null);
    try { await recordsAPI.delete(r._id); toast.success('🗑️ Lab report deleted'); }
    catch (e) { toast.error(e?.response?.data?.error || 'Removed locally, but failed to delete on the server'); }
  };

  const filtered = reports.filter(r => {
    if (filterStatus!=='all'&&r.status!==filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      return (r.patient?.name||'').toLowerCase().includes(q)||(r.tests||[]).some(t=>t.toLowerCase().includes(q));
    }
    return true;
  });

  const inp = { width:'100%', padding:'10px 12px', border:'1.5px solid #e2e8f0', borderRadius:9, fontSize:13.5, outline:'none', fontFamily:'inherit' };

  return (
    <div style={{ fontFamily:"'Inter',system-ui,sans-serif" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:22, flexWrap:'wrap', gap:12 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:900, color:'#0f172a' }}>🔬 Lab Reports</div>
          <div style={{ fontSize:13, color:'#94a3b8', marginTop:3 }}>
            {isPatient?'Your lab investigation results':'Order and track patient lab investigations'}
          </div>
        </div>
        {isDoctor&&<button onClick={openModal} style={{ padding:'10px 22px', background:'linear-gradient(135deg,#0891b2,#0c4a6e)', border:'none', borderRadius:11, color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>+ Order Lab Test</button>}
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))', gap:10, marginBottom:20 }}>
        {[
          {l:'Total',v:reports.length,bg:'#eff6ff',c:'#1d4ed8'},
          {l:'Pending',v:reports.filter(r=>r.status==='pending').length,bg:'#fef3c7',c:'#92400e'},
          {l:'Processing',v:reports.filter(r=>r.status==='processing').length,bg:'#dbeafe',c:'#1d4ed8'},
          {l:'Completed',v:reports.filter(r=>r.status==='completed').length,bg:'#dcfce7',c:'#15803d'},
          {l:'Abnormal',v:reports.filter(r=>r.status==='abnormal').length,bg:'#fee2e2',c:'#dc2626'},
        ].map((s,i)=>(
          <div key={i} style={{ background:s.bg, border:`1px solid ${s.c}20`, borderRadius:13, padding:'14px', textAlign:'center', cursor:'pointer' }}
            onClick={()=>setFS(i===0?'all':['pending','processing','completed','abnormal'][i-1])}>
            <div style={{ fontSize:24, fontWeight:900, color:s.c }}>{s.v}</div>
            <div style={{ fontSize:11.5, fontWeight:700, color:s.c, opacity:.8 }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Search + filter */}
      <div style={{ display:'flex', gap:10, marginBottom:18, flexWrap:'wrap' }}>
        <div style={{ position:'relative', flex:1, maxWidth:320 }}>
          <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'#94a3b8' }}>🔍</span>
          <input style={{ ...inp, paddingLeft:34 }} placeholder="Search patient or test…" value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        {['all','pending','processing','completed','abnormal'].map(s=>(
          <button key={s} onClick={()=>setFS(s)} style={{ padding:'8px 14px', borderRadius:9, border:`1.5px solid ${filterStatus===s?'#0891b2':'#e2e8f0'}`, background:filterStatus===s?'#e0f2fe':'#fff', color:filterStatus===s?'#0369a1':'#64748b', fontWeight:700, fontSize:12.5, cursor:'pointer', textTransform:'capitalize', fontFamily:'inherit' }}>
            {s==='all'?'All':STATUS_COLOR[s]?.label||s}
          </button>
        ))}
        <button onClick={load} style={{ padding:'8px 14px', borderRadius:9, border:'1.5px solid #e2e8f0', background:'#fff', color:'#475569', fontWeight:600, fontSize:12.5, cursor:'pointer', fontFamily:'inherit' }}>🔄</button>
      </div>

      {/* List */}
      {loading?(
        <div style={{ display:'flex', justifyContent:'center', padding:'60px 0' }}>
          <div style={{ width:36, height:36, border:'3px solid #e2e8f0', borderTopColor:'#0891b2', borderRadius:'50%', animation:'spin .9s linear infinite' }}/>
        </div>
      ):filtered.length===0?(
        <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:16, padding:'52px', textAlign:'center' }}>
          <div style={{ fontSize:44, marginBottom:12 }}>🔬</div>
          <div style={{ fontWeight:700, fontSize:16, color:'#0f172a', marginBottom:6 }}>No lab reports found</div>
          {isDoctor&&<button onClick={openModal} style={{ marginTop:8, padding:'9px 20px', background:'linear-gradient(135deg,#0891b2,#0c4a6e)', border:'none', borderRadius:10, color:'#fff', fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Order First Test</button>}
        </div>
      ):(
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {filtered.map((r,i)=>{
            const sc=STATUS_COLOR[r.status]||STATUS_COLOR.pending;
            const urg=URGENCY[r.urgency]||URGENCY.routine;
            return (
              <motion.div key={r._id} initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ delay:i*.03 }}
                style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:14, padding:'16px 20px', display:'flex', alignItems:'flex-start', gap:14, cursor:'pointer' }}
                onMouseEnter={e=>e.currentTarget.style.boxShadow='0 4px 20px rgba(0,0,0,.07)'}
                onMouseLeave={e=>e.currentTarget.style.boxShadow='none'}
                onClick={()=>setShowView(r)}>
                <div style={{ width:44, height:44, borderRadius:13, background:'#e0f2fe', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0 }}>🔬</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap', marginBottom:5 }}>
                    <span style={{ fontWeight:800, fontSize:14.5, color:'#0f172a' }}>{r.patient?.name||'—'}</span>
                    <span style={{ fontSize:10.5, fontWeight:700, padding:'2px 8px', borderRadius:7, background:sc.bg, color:sc.c }}>{sc.label}</span>
                    {r.urgency&&r.urgency!=='routine'&&<span style={{ fontSize:10.5, fontWeight:700, padding:'2px 8px', borderRadius:7, background:urg.bg, color:urg.c }}>{urg.label}</span>}
                  </div>
                  <div style={{ fontSize:12.5, color:'#64748b', marginBottom:4 }}>🧪 {(r.tests||[]).slice(0,3).join(', ')}{(r.tests||[]).length>3?` +${r.tests.length-3} more`:''}</div>
                  <div style={{ fontSize:11.5, color:'#94a3b8' }}>Dr. {r.doctorName||'—'} · {r.collectionDate?new Date(r.collectionDate).toLocaleDateString('en-IN',{day:'numeric',month:'short'}):''} · {new Date(r.createdAt).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</div>
                </div>
                {isAdmin&&(
                  <div style={{ display:'flex', gap:5, flexShrink:0 }}>
                    {r.status!=='completed'&&r.status==='pending'&&<button onClick={e=>{e.stopPropagation();updateStatus(r._id,'processing');}} style={{ padding:'5px 10px', background:'#dbeafe', border:'none', borderRadius:7, color:'#1d4ed8', fontWeight:700, fontSize:11.5, cursor:'pointer', fontFamily:'inherit' }}>▶ Process</button>}
                    {r.status!=='completed'&&r.status==='processing'&&<button onClick={e=>{e.stopPropagation();updateStatus(r._id,'completed');}} style={{ padding:'5px 10px', background:'#d1fae5', border:'none', borderRadius:7, color:'#065f46', fontWeight:700, fontSize:11.5, cursor:'pointer', fontFamily:'inherit' }}>✅ Done</button>}
                    {r.status!=='completed'&&<button onClick={e=>{e.stopPropagation();updateStatus(r._id,'abnormal');}} style={{ padding:'5px 10px', background:'#fee2e2', border:'none', borderRadius:7, color:'#dc2626', fontWeight:700, fontSize:11.5, cursor:'pointer', fontFamily:'inherit' }}>⚠️</button>}
                    <button title="Delete this report" onClick={e=>{e.stopPropagation();handleDelete(r);}} style={{ padding:'5px 10px', background:'#fee2e2', border:'none', borderRadius:7, color:'#dc2626', fontWeight:700, fontSize:11.5, cursor:'pointer', fontFamily:'inherit' }}>🗑️</button>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ORDER MODAL */}
      <AnimatePresence>
        {showModal&&(
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:16, overflowY:'auto' }}
            onClick={e=>{if(e.target===e.currentTarget)setShowModal(false);}}>
            <motion.div initial={{ scale:.96 }} animate={{ scale:1 }} exit={{ scale:.96 }} onClick={e=>e.stopPropagation()}
              style={{ background:'#fff', borderRadius:20, width:'100%', maxWidth:720, maxHeight:'92vh', overflowY:'auto' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'20px 24px', borderBottom:'1px solid #f1f5f9', position:'sticky', top:0, background:'#fff', zIndex:5, borderRadius:'20px 20px 0 0' }}>
                <div style={{ fontWeight:900, fontSize:18, color:'#0f172a' }}>🔬 Order Lab Investigation</div>
                <button onClick={()=>setShowModal(false)} style={{ width:32, height:32, borderRadius:'50%', border:'1.5px solid #e2e8f0', background:'#f8fafc', cursor:'pointer', fontSize:15, color:'#64748b', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'inherit' }}>✕</button>
              </div>
              {loadingModal?(
                <div style={{ display:'flex', justifyContent:'center', padding:'60px' }}>
                  <div style={{ width:36, height:36, border:'3px solid #e2e8f0', borderTopColor:'#0891b2', borderRadius:'50%', animation:'spin .9s linear infinite' }}/>
                </div>
              ):(
                <form onSubmit={submit}>
                  <div style={{ padding:'20px 24px', display:'flex', flexDirection:'column', gap:18 }}>
                    <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr', gap:14 }}>
                      <div>
                        <label style={{ display:'block', fontSize:11.5, fontWeight:700, color:'#374151', marginBottom:5, textTransform:'uppercase' }}>
                          Patient * {isAdmin && <span style={{ fontWeight:400, textTransform:'none', color:'#94a3b8' }}>({patients.length} total)</span>}
                          {!isAdmin && isDoctor && <span style={{ fontWeight:400, textTransform:'none', color:'#94a3b8' }}> — your patients only</span>}
                        </label>
                        {isAdmin && (
                          <input value={patientSearch} onChange={e=>setPatientSearch(e.target.value)} placeholder="🔍 Search patient by name…"
                            style={{ ...inp, marginBottom:6 }} />
                        )}
                        <select value={form.patient} onChange={e=>setForm(f=>({...f,patient:e.target.value}))} style={inp} required>
                          <option value="">— Select patient —</option>
                          {patients
                            .filter(p => !patientSearch.trim() || p.name?.toLowerCase().includes(patientSearch.trim().toLowerCase()))
                            .map(p=><option key={p._id} value={p._id}>{p.name}</option>)}
                        </select>
                        {!isAdmin && patients.length === 0 && (
                          <div style={{ fontSize:11, color:'#dc2626', marginTop:5 }}>You have no patients with appointments yet — book an appointment first.</div>
                        )}
                      </div>
                      <div>
                        <label style={{ display:'block', fontSize:11.5, fontWeight:700, color:'#374151', marginBottom:5, textTransform:'uppercase' }}>Urgency</label>
                        <select value={form.urgency} onChange={e=>setForm(f=>({...f,urgency:e.target.value}))} style={inp}>
                          {Object.entries(URGENCY).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{ display:'block', fontSize:11.5, fontWeight:700, color:'#374151', marginBottom:5, textTransform:'uppercase' }}>Collection Date</label>
                        <input type="date" value={form.collectionDate} onChange={e=>setForm(f=>({...f,collectionDate:e.target.value}))} style={inp}/>
                      </div>
                    </div>
                    <div>
                      <label style={{ display:'block', fontSize:11.5, fontWeight:700, color:'#374151', marginBottom:10, textTransform:'uppercase' }}>
                        Select Tests * <span style={{ color:'#0891b2', fontWeight:600 }}>({form.tests.length} selected)</span>
                      </label>
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:6 }}>
                        {LAB_TESTS.map(test=>{
                          const sel=form.tests.includes(test);
                          return (
                            <button key={test} type="button" onClick={()=>toggleTest(test)}
                              style={{ padding:'8px 12px', borderRadius:9, border:`1.5px solid ${sel?'#0891b2':'#e2e8f0'}`, background:sel?'#e0f2fe':'#f8fafc', cursor:'pointer', fontSize:12.5, fontWeight:sel?700:500, color:sel?'#0369a1':'#475569', textAlign:'left', display:'flex', alignItems:'center', gap:7, fontFamily:'inherit' }}>
                              <span style={{ width:16, height:16, borderRadius:4, border:`2px solid ${sel?'#0891b2':'#cbd5e1'}`, background:sel?'#0891b2':'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:10, color:'#fff' }}>{sel?'✓':''}</span>
                              {test}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <label style={{ display:'block', fontSize:11.5, fontWeight:700, color:'#374151', marginBottom:5, textTransform:'uppercase' }}>Clinical Notes</label>
                      <textarea value={form.clinicalNotes} onChange={e=>setForm(f=>({...f,clinicalNotes:e.target.value}))} rows={2}
                        placeholder="Relevant history, symptoms, or instructions for the lab…"
                        style={{ ...inp, resize:'vertical' }}/>
                    </div>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'16px 24px', borderTop:'1px solid #f1f5f9', position:'sticky', bottom:0, background:'#fff', borderRadius:'0 0 20px 20px' }}>
                    <span style={{ fontSize:12.5, color:'#94a3b8' }}>{form.tests.length} test(s) selected</span>
                    <div style={{ display:'flex', gap:10 }}>
                      <button type="button" onClick={()=>setShowModal(false)} style={{ padding:'10px 20px', background:'#f1f5f9', border:'1px solid #e2e8f0', borderRadius:10, fontWeight:600, cursor:'pointer', color:'#475569', fontFamily:'inherit' }}>Cancel</button>
                      <button type="submit" disabled={submitting} style={{ padding:'10px 22px', background:'linear-gradient(135deg,#0891b2,#0c4a6e)', border:'none', borderRadius:10, color:'#fff', fontWeight:700, cursor:'pointer', opacity:submitting?.7:1, fontFamily:'inherit' }}>
                        {submitting?'Placing…':'🔬 Place Lab Order'}
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* VIEW MODAL */}
      <AnimatePresence>
        {showView&&(
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
            onClick={()=>setShowView(null)}>
            <motion.div initial={{ scale:.96 }} animate={{ scale:1 }} exit={{ scale:.96 }} onClick={e=>e.stopPropagation()}
              style={{ background:'#fff', borderRadius:20, width:'100%', maxWidth:540, maxHeight:'90vh', overflowY:'auto', padding:'24px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'start', marginBottom:18 }}>
                <h3 style={{ fontWeight:900, fontSize:18, color:'#0f172a', margin:0 }}>🔬 Lab Order Detail</h3>
                <button onClick={()=>setShowView(null)} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#94a3b8' }}>✕</button>
              </div>
              <div style={{ background:'#f8fafc', borderRadius:12, padding:'16px', marginBottom:16 }}>
                <div style={{ fontWeight:800, fontSize:16, color:'#0f172a', marginBottom:4 }}>{showView.patient?.name||'—'}</div>
                <div style={{ fontSize:12.5, color:'#64748b' }}>Dr. {showView.doctorName} · {showView.collectionDate?new Date(showView.collectionDate).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'}):''}</div>
                <div style={{ marginTop:8, display:'flex', gap:8, flexWrap:'wrap' }}>
                  <span style={{ padding:'3px 10px', borderRadius:8, fontSize:11.5, fontWeight:700, background:STATUS_COLOR[showView.status]?.bg, color:STATUS_COLOR[showView.status]?.c }}>{STATUS_COLOR[showView.status]?.label}</span>
                  {showView.urgency&&showView.urgency!=='routine'&&<span style={{ padding:'3px 10px', borderRadius:8, fontSize:11.5, fontWeight:700, background:URGENCY[showView.urgency]?.bg, color:URGENCY[showView.urgency]?.c }}>{URGENCY[showView.urgency]?.label}</span>}
                </div>
              </div>
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:11.5, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', marginBottom:8 }}>Tests Ordered ({(showView.tests||[]).length})</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                  {(showView.tests||[]).map(t=><span key={t} style={{ padding:'5px 11px', background:'#e0f2fe', color:'#0369a1', borderRadius:8, fontSize:12.5, fontWeight:600 }}>{t}</span>)}
                </div>
              </div>
              {showView.clinicalNotes&&<div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:10, padding:'12px 14px', fontSize:13, color:'#15803d', marginBottom:14 }}><strong>Clinical Notes:</strong> {showView.clinicalNotes}</div>}
              {isAdmin&&(
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  {showView.status==='pending'&&<button onClick={()=>updateStatus(showView._id,'processing')} style={{ flex:1, padding:'10px', background:'#dbeafe', border:'none', borderRadius:9, color:'#1d4ed8', fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>▶ Mark Processing</button>}
                  {['pending','processing'].includes(showView.status)&&<button onClick={()=>updateStatus(showView._id,'completed')} style={{ flex:1, padding:'10px', background:'#d1fae5', border:'none', borderRadius:9, color:'#065f46', fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>✅ Mark Completed</button>}
                  <button onClick={()=>updateStatus(showView._id,'abnormal')} style={{ flex:1, padding:'10px', background:'#fee2e2', border:'none', borderRadius:9, color:'#dc2626', fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>⚠️ Flag Abnormal</button>
                  <button onClick={()=>handleDelete(showView)} style={{ flex:1, padding:'10px', background:'#fee2e2', border:'none', borderRadius:9, color:'#dc2626', fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>🗑️ Delete Report</button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
