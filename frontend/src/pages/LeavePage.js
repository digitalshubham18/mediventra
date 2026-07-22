import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { leavesAPI, usersAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const LEAVE_TYPES = [
  { key:'casual',    label:'Casual Leave',       icon:'🌴', color:'#0891b2', days:12, desc:'For personal reasons, planned activities' },
  { key:'sick',      label:'Sick Leave',          icon:'🤒', color:'#ef4444', days:14, desc:'Medical illness or health condition' },
  { key:'earned',    label:'Earned Leave',        icon:'⭐', color:'#d97706', days:18, desc:'Accumulated earned/privilege leave' },
  { key:'maternity', label:'Maternity Leave',     icon:'🤱', color:'#db2777', days:180,desc:'For expecting/new mothers' },
  { key:'paternity', label:'Paternity Leave',     icon:'👨‍👶', color:'#7c3aed', days:15, desc:'For new fathers' },
  { key:'emergency', label:'Emergency Leave',     icon:'🚨', color:'#dc2626', days:5,  desc:'Sudden family or personal emergency' },
  { key:'halfday',   label:'Half Day Leave',      icon:'⏰', color:'#059669', days:0.5,desc:'Half day absence (AM or PM)' },
  { key:'unpaid',    label:'Unpaid Leave',        icon:'💸', color:'#64748b', days:999,desc:'Leave without pay' },
];

const STATUS_CFG = {
  pending:  { bg:'#fef3c7', color:'#92400e', icon:'⏳', label:'Pending' },
  approved: { bg:'#dcfce7', color:'#15803d', icon:'✅', label:'Approved' },
  rejected: { bg:'#fee2e2', color:'#dc2626', icon:'❌', label:'Rejected' },
};

export default function LeavePage() {
  const { user } = useAuth();
  const [leaves, setLeaves] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showApply, setShowApply] = useState(false);
  const [showReview, setShowReview] = useState(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [reviewNote, setReviewNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ type:'casual', from:'', to:'', reason:'' });

  const isAdmin = user?.role === 'admin';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [lRes, uRes] = await Promise.allSettled([
        leavesAPI.getAll(isAdmin ? (filterStatus?{status:filterStatus}:{}) : {}),
        isAdmin ? usersAPI.getAll({ status:'approved' }) : Promise.resolve({ data:{ data:[] } }),
      ]);
      setLeaves(lRes.value?.data?.data || []);
      setAllUsers(uRes.value?.data?.data || []);
    } catch { toast.error('Failed to load'); }
    setLoading(false);
  }, [isAdmin, filterStatus]);

  useEffect(() => { load(); }, [load]);

  const handleApply = async () => {
    if (!form.from || !form.to || !form.reason.trim()) { toast.error('Fill all required fields'); return; }
    if (new Date(form.from) > new Date(form.to)) { toast.error('End date must be after start date'); return; }
    setSaving(true);
    try {
      await leavesAPI.apply(form);
      toast.success('✅ Leave application submitted!');
      setShowApply(false);
      setForm({ type:'casual', from:'', to:'', reason:'' });
      load();
    } catch(e) { toast.error(e.response?.data?.error || 'Submit failed'); }
    setSaving(false);
  };

  const handleReview = async (status) => {
    setSaving(true);
    try {
      await leavesAPI.review(showReview._id, { status, reviewNote });
      toast.success(`Leave ${status}!`);
      setShowReview(null);
      setReviewNote('');
      load();
    } catch(e) { toast.error(e.response?.data?.error || 'Review failed'); }
    setSaving(false);
  };

  const handleCancel = async (id) => {
    if (!window.confirm('Cancel this leave request?')) return;
    try { await leavesAPI.cancel(id); toast.success('Leave cancelled'); load(); }
    catch { toast.error('Cancel failed'); }
  };

  const calcDays = (from, to) => {
    if (!from || !to) return 0;
    return Math.ceil((new Date(to) - new Date(from)) / (1000*60*60*24)) + 1;
  };

  const myLeaves     = leaves.filter(l => l.user?._id === user?._id);
  const pendingCount = leaves.filter(l => l.status === 'pending').length;
  const lt = LEAVE_TYPES.find(t => t.key === form.type);

  const ini = n => n?.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase() || '?';
  const rc = { admin:'#6366f1',doctor:'#0891b2',patient:'#7c3aed',nurse:'#db2777',pharmacist:'#d97706',wardboy:'#059669',sweeper:'#f59e0b',otboy:'#ef4444' };

  return (
    <div style={{ fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap'); @keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:800, color:'#0f172a', margin:0 }}>🌴 Leave Management</h1>
          <p style={{ color:'#94a3b8', fontSize:13, marginTop:3 }}>
            {isAdmin ? `${pendingCount} leave${pendingCount!==1?'s':''} pending approval` : 'Apply and track your leave requests'}
          </p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          {isAdmin && (
            <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}
              style={{ padding:'9px 12px', border:'1.5px solid #e2e8f0', borderRadius:12, fontSize:13, fontFamily:'inherit', outline:'none', background:'#fff' }}>
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          )}
          <button onClick={() => setShowApply(true)}
            style={{ padding:'9px 20px', borderRadius:12, border:'none', background:'linear-gradient(135deg,#2563eb,#0ea5e9)', color:'#fff', fontFamily:'inherit', fontWeight:700, fontSize:13, cursor:'pointer', boxShadow:'0 4px 14px #2563eb40' }}>
            + Apply Leave
          </button>
        </div>
      </div>

      {/* Leave Type Cards */}
      {!isAdmin && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:10, marginBottom:24 }}>
          {LEAVE_TYPES.map(lt => (
            <motion.div key={lt.key} whileHover={{ y:-2 }}
              style={{ background:'#fff', border:'1px solid #e8edf3', borderRadius:14, padding:'14px', cursor:'pointer', transition:'all .2s' }}
              onClick={() => { setForm(f=>({...f,type:lt.key})); setShowApply(true); }}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=lt.color;e.currentTarget.style.boxShadow=`0 4px 16px ${lt.color}20`;}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor='#e8edf3';e.currentTarget.style.boxShadow='none';}}>
              <div style={{ fontSize:24, marginBottom:8 }}>{lt.icon}</div>
              <div style={{ fontWeight:700, fontSize:12.5, color:'#0f172a', marginBottom:3 }}>{lt.label}</div>
              <div style={{ fontSize:11, color:lt.color, fontWeight:600 }}>{lt.days === 999 ? 'Unlimited' : `${lt.days} days/yr`}</div>
              <div style={{ fontSize:10.5, color:'#94a3b8', marginTop:3, lineHeight:1.4 }}>{lt.desc}</div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Admin stats */}
      {isAdmin && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))', gap:10, marginBottom:20 }}>
          {[
            { icon:'⏳', label:'Pending',  val:leaves.filter(l=>l.status==='pending').length,  bg:'#fef3c7',c:'#92400e' },
            { icon:'✅', label:'Approved', val:leaves.filter(l=>l.status==='approved').length, bg:'#dcfce7',c:'#15803d' },
            { icon:'❌', label:'Rejected', val:leaves.filter(l=>l.status==='rejected').length, bg:'#fee2e2',c:'#dc2626' },
            { icon:'📅', label:'On Leave Today', val:leaves.filter(l=>l.status==='approved'&&new Date(l.from)<=new Date()&&new Date(l.to)>=new Date()).length, bg:'#e0f2fe',c:'#0369a1' },
          ].map((s,i) => (
            <div key={i} style={{ background:'#fff', border:'1px solid #e8edf3', borderRadius:12, padding:'14px', display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:40,height:40,borderRadius:11,background:s.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,flexShrink:0 }}>{s.icon}</div>
              <div><div style={{ fontSize:22,fontWeight:900,color:'#0f172a',lineHeight:1 }}>{s.val}</div><div style={{ fontSize:11,color:'#94a3b8',marginTop:2 }}>{s.label}</div></div>
            </div>
          ))}
        </div>
      )}

      {/* Leave table */}
      <div style={{ background:'#fff', border:'1px solid #e8edf3', borderRadius:18, overflow:'hidden' }}>
        <div style={{ padding:'14px 20px', borderBottom:'1px solid #f1f5f9' }}>
          <span style={{ fontWeight:800, fontSize:15, color:'#0f172a' }}>{isAdmin ? 'All Leave Requests' : 'My Leave History'} ({leaves.length})</span>
        </div>
        {loading ? (
          <div style={{ padding:48,textAlign:'center' }}><div style={{ width:28,height:28,border:'3px solid #e2e8f0',borderTopColor:'#2563eb',borderRadius:'50%',animation:'spin .7s linear infinite',margin:'0 auto' }} /></div>
        ) : leaves.length === 0 ? (
          <div style={{ padding:64,textAlign:'center',color:'#94a3b8' }}><div style={{ fontSize:48,marginBottom:12 }}>🌴</div><div style={{ fontWeight:700,fontSize:16 }}>No leave requests yet</div><div style={{ fontSize:13,marginTop:4 }}>Click "Apply Leave" to submit your first request</div></div>
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:'#f8fafc' }}>
                  {[isAdmin?'Employee':'',  'Type','From','To','Days','Reason','Status','Applied On','Actions'].filter(Boolean).map(h=>(
                    <th key={h} style={{ padding:'10px 14px',textAlign:'left',fontSize:11,fontWeight:700,color:'#94a3b8',letterSpacing:.5,textTransform:'uppercase',borderBottom:'1px solid #f1f5f9',whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leaves.map((l,i) => {
                  const sc = STATUS_CFG[l.status];
                  const lt2 = LEAVE_TYPES.find(t=>t.key===l.type);
                  return (
                    <motion.tr key={l._id} initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:i*.02 }}
                      style={{ borderBottom:'1px solid #f8fafc' }}
                      onMouseEnter={e=>e.currentTarget.style.background='#fafbfc'}
                      onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                      {isAdmin && (
                        <td style={{ padding:'11px 14px' }}>
                          <div style={{ display:'flex',alignItems:'center',gap:9 }}>
                            <div style={{ width:32,height:32,borderRadius:'50%',background:`linear-gradient(135deg,${rc[l.user?.role]||'#64748b'},${rc[l.user?.role]||'#64748b'}99)`,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:700,fontSize:12 }}>{ini(l.user?.name)}</div>
                            <div><div style={{ fontWeight:700,color:'#0f172a',fontSize:13 }}>{l.user?.name}</div><div style={{ fontSize:11,color:'#94a3b8' }}>{l.user?.role}</div></div>
                          </div>
                        </td>
                      )}
                      <td style={{ padding:'11px 14px' }}>
                        <div style={{ display:'flex',alignItems:'center',gap:7 }}>
                          <span style={{ fontSize:16 }}>{lt2?.icon}</span>
                          <span style={{ fontSize:12.5,fontWeight:700,color:'#0f172a' }}>{lt2?.label}</span>
                        </div>
                      </td>
                      <td style={{ padding:'11px 14px',fontSize:13,color:'#374151',whiteSpace:'nowrap' }}>{new Date(l.from).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</td>
                      <td style={{ padding:'11px 14px',fontSize:13,color:'#374151',whiteSpace:'nowrap' }}>{new Date(l.to).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</td>
                      <td style={{ padding:'11px 14px' }}>
                        <span style={{ padding:'3px 9px',borderRadius:20,fontSize:12,fontWeight:700,background:'#f1f5f9',color:'#374151' }}>{l.days}d</span>
                      </td>
                      <td style={{ padding:'11px 14px',fontSize:13,color:'#64748b',maxWidth:200 }}>
                        <div style={{ overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{l.reason}</div>
                      </td>
                      <td style={{ padding:'11px 14px' }}>
                        <span style={{ padding:'4px 10px',borderRadius:20,fontSize:12,fontWeight:700,background:sc.bg,color:sc.color,display:'flex',alignItems:'center',gap:5,width:'fit-content' }}>
                          <span>{sc.icon}</span>{sc.label}
                        </span>
                        {l.reviewNote && <div style={{ fontSize:10.5,color:'#94a3b8',marginTop:3 }}>{l.reviewNote}</div>}
                      </td>
                      <td style={{ padding:'11px 14px',fontSize:12,color:'#94a3b8',whiteSpace:'nowrap' }}>{new Date(l.createdAt).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</td>
                      <td style={{ padding:'11px 14px' }}>
                        <div style={{ display:'flex',gap:5 }}>
                          {isAdmin && l.status==='pending' && (
                            <button onClick={()=>{setShowReview(l);setReviewNote('');}}
                              style={{ padding:'5px 12px',borderRadius:8,border:'none',background:'#2563eb',color:'#fff',fontFamily:'inherit',fontSize:11.5,fontWeight:700,cursor:'pointer' }}>
                              Review
                            </button>
                          )}
                          {!isAdmin && l.status==='pending' && (
                            <button onClick={()=>handleCancel(l._id)}
                              style={{ padding:'5px 10px',borderRadius:8,border:'1px solid #fecaca',background:'#fef2f2',color:'#dc2626',fontFamily:'inherit',fontSize:11.5,fontWeight:700,cursor:'pointer' }}>
                              Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Apply Leave Modal */}
      <AnimatePresence>
        {showApply && (
          <div onClick={e=>{if(e.target===e.currentTarget)setShowApply(false)}} style={{ position:'fixed',inset:0,background:'rgba(0,0,0,.55)',backdropFilter:'blur(4px)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16,overflowY:'auto' }}>
            <motion.div initial={{ opacity:0,y:24,scale:.96 }} animate={{ opacity:1,y:0,scale:1 }} exit={{ opacity:0,y:24,scale:.96 }}
              style={{ background:'#fff',borderRadius:24,width:'100%',maxWidth:520,boxShadow:'0 32px 80px rgba(0,0,0,.25)',overflow:'hidden' }}>
              <div style={{ background:'linear-gradient(135deg,#1e3a8a,#2563eb)',padding:'20px 24px' }}>
                <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between' }}>
                  <h2 style={{ color:'#fff',fontWeight:800,fontSize:19,margin:0 }}>🌴 Apply for Leave</h2>
                  <button onClick={()=>setShowApply(false)} style={{ background:'rgba(255,255,255,.2)',border:'none',borderRadius:'50%',width:30,height:30,cursor:'pointer',color:'#fff',fontSize:14,display:'flex',alignItems:'center',justifyContent:'center' }}>✕</button>
                </div>
                <p style={{ color:'rgba(255,255,255,.7)',fontSize:13,marginTop:4 }}>Submit your leave request for admin approval</p>
              </div>

              <div style={{ padding:'24px' }}>
                {/* Leave type selector */}
                <div style={{ marginBottom:18 }}>
                  <label style={{ display:'block',fontSize:11,fontWeight:700,color:'#374151',letterSpacing:.5,textTransform:'uppercase',marginBottom:8 }}>Leave Type *</label>
                  <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:7 }}>
                    {LEAVE_TYPES.map(t => (
                      <div key={t.key} onClick={()=>setForm(f=>({...f,type:t.key}))}
                        style={{ padding:'9px 12px',borderRadius:11,border:`1.5px solid ${form.type===t.key?t.color:'#e2e8f0'}`,background:form.type===t.key?`${t.color}10`:'#fafbfc',cursor:'pointer',display:'flex',alignItems:'center',gap:8,transition:'all .15s' }}>
                        <span style={{ fontSize:18 }}>{t.icon}</span>
                        <div>
                          <div style={{ fontSize:12.5,fontWeight:700,color:form.type===t.key?t.color:'#374151' }}>{t.label}</div>
                          <div style={{ fontSize:10,color:'#94a3b8' }}>{t.days===999?'Unlimited':`${t.days}d/yr`}</div>
                        </div>
                        {form.type===t.key && <div style={{ marginLeft:'auto',width:18,height:18,borderRadius:'50%',background:t.color,display:'flex',alignItems:'center',justifyContent:'center' }}><span style={{ color:'#fff',fontSize:10,fontWeight:900 }}>✓</span></div>}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Selected type info */}
                {lt && (
                  <div style={{ background:`${lt.color}10`,border:`1px solid ${lt.color}25`,borderRadius:10,padding:'10px 13px',marginBottom:16,display:'flex',alignItems:'center',gap:9 }}>
                    <span style={{ fontSize:20 }}>{lt.icon}</span>
                    <div><div style={{ fontSize:13,fontWeight:700,color:lt.color }}>{lt.label}</div><div style={{ fontSize:12,color:'#64748b' }}>{lt.desc}</div></div>
                  </div>
                )}

                <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12 }}>
                  <div>
                    <label style={{ display:'block',fontSize:11,fontWeight:700,color:'#374151',letterSpacing:.5,textTransform:'uppercase',marginBottom:5 }}>From Date *</label>
                    <input type="date" value={form.from} min={new Date().toISOString().split('T')[0]}
                      onChange={e=>setForm(f=>({...f,from:e.target.value}))}
                      style={{ width:'100%',padding:'10px 12px',border:'1.5px solid #e2e8f0',borderRadius:10,fontFamily:'inherit',fontSize:13.5,outline:'none',boxSizing:'border-box' }} />
                  </div>
                  <div>
                    <label style={{ display:'block',fontSize:11,fontWeight:700,color:'#374151',letterSpacing:.5,textTransform:'uppercase',marginBottom:5 }}>To Date *</label>
                    <input type="date" value={form.to} min={form.from||new Date().toISOString().split('T')[0]}
                      onChange={e=>setForm(f=>({...f,to:e.target.value}))}
                      style={{ width:'100%',padding:'10px 12px',border:'1.5px solid #e2e8f0',borderRadius:10,fontFamily:'inherit',fontSize:13.5,outline:'none',boxSizing:'border-box' }} />
                  </div>
                </div>

                {form.from && form.to && (
                  <div style={{ background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:9,padding:'8px 13px',marginBottom:12,fontSize:13,color:'#1e40af',fontWeight:600 }}>
                    📅 Duration: <strong>{calcDays(form.from,form.to)} day{calcDays(form.from,form.to)!==1?'s':''}</strong>
                  </div>
                )}

                <div style={{ marginBottom:16 }}>
                  <label style={{ display:'block',fontSize:11,fontWeight:700,color:'#374151',letterSpacing:.5,textTransform:'uppercase',marginBottom:5 }}>Reason *</label>
                  <textarea value={form.reason} onChange={e=>setForm(f=>({...f,reason:e.target.value}))} rows={3}
                    placeholder="Please provide a reason for your leave request…"
                    style={{ width:'100%',padding:'10px 12px',border:'1.5px solid #e2e8f0',borderRadius:10,fontFamily:'inherit',fontSize:13.5,outline:'none',resize:'none',boxSizing:'border-box' }} />
                </div>

                <div style={{ display:'flex',gap:10 }}>
                  <button onClick={()=>setShowApply(false)} style={{ flex:1,padding:'12px',borderRadius:12,border:'1.5px solid #e2e8f0',background:'#fff',fontFamily:'inherit',fontWeight:700,cursor:'pointer',fontSize:14 }}>Cancel</button>
                  <button onClick={handleApply} disabled={saving}
                    style={{ flex:2,padding:'12px',borderRadius:12,border:'none',background:'linear-gradient(135deg,#2563eb,#0ea5e9)',color:'#fff',fontFamily:'inherit',fontWeight:800,cursor:'pointer',fontSize:14,display:'flex',alignItems:'center',justifyContent:'center',gap:8 }}>
                    {saving?<><div style={{ width:16,height:16,border:'2px solid rgba(255,255,255,.3)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin .7s linear infinite' }} />Submitting…</>:'🌴 Submit Leave Request'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Review Modal (Admin) */}
      <AnimatePresence>
        {showReview && (
          <div onClick={e=>{if(e.target===e.currentTarget)setShowReview(null)}} style={{ position:'fixed',inset:0,background:'rgba(0,0,0,.55)',backdropFilter:'blur(4px)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16 }}>
            <motion.div initial={{ opacity:0,y:20,scale:.96 }} animate={{ opacity:1,y:0,scale:1 }} exit={{ opacity:0,y:20,scale:.96 }}
              style={{ background:'#fff',borderRadius:24,width:'100%',maxWidth:480,boxShadow:'0 32px 80px rgba(0,0,0,.25)',overflow:'hidden' }}>
              <div style={{ background:'linear-gradient(135deg,#1e3a8a,#2563eb)',padding:'18px 22px' }}>
                <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between' }}>
                  <h3 style={{ color:'#fff',fontWeight:800,fontSize:17,margin:0 }}>Review Leave Request</h3>
                  <button onClick={()=>setShowReview(null)} style={{ background:'rgba(255,255,255,.2)',border:'none',borderRadius:'50%',width:28,height:28,cursor:'pointer',color:'#fff',fontSize:13,display:'flex',alignItems:'center',justifyContent:'center' }}>✕</button>
                </div>
              </div>
              <div style={{ padding:'20px 22px' }}>
                <div style={{ background:'#f8fafc',borderRadius:13,padding:'14px',marginBottom:18 }}>
                  <div style={{ display:'flex',alignItems:'center',gap:12,marginBottom:12 }}>
                    <div style={{ width:40,height:40,borderRadius:'50%',background:`linear-gradient(135deg,${rc[showReview.user?.role]||'#64748b'},${rc[showReview.user?.role]||'#64748b'}99)`,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:700,fontSize:16 }}>{ini(showReview.user?.name)}</div>
                    <div><div style={{ fontWeight:800,color:'#0f172a',fontSize:15 }}>{showReview.user?.name}</div><div style={{ fontSize:12,color:'#64748b' }}>{showReview.user?.role} · {showReview.user?.department||'No Dept'}</div></div>
                  </div>
                  {[
                    ['Leave Type',LEAVE_TYPES.find(t=>t.key===showReview.type)?.label||showReview.type],
                    ['From',new Date(showReview.from).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})],
                    ['To',new Date(showReview.to).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})],
                    ['Duration',`${showReview.days} day${showReview.days!==1?'s':''}`],
                    ['Reason',showReview.reason],
                  ].map(([l,v])=>(
                    <div key={l} style={{ display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid #f1f5f9',fontSize:13 }}>
                      <span style={{ color:'#64748b' }}>{l}</span>
                      <span style={{ fontWeight:600,color:'#0f172a',textAlign:'right',maxWidth:'60%' }}>{v}</span>
                    </div>
                  ))}
                </div>
                <div style={{ marginBottom:16 }}>
                  <label style={{ display:'block',fontSize:11,fontWeight:700,color:'#374151',letterSpacing:.5,textTransform:'uppercase',marginBottom:5 }}>Review Note (optional)</label>
                  <textarea value={reviewNote} onChange={e=>setReviewNote(e.target.value)} rows={2}
                    placeholder="Add a comment for the employee…"
                    style={{ width:'100%',padding:'10px 12px',border:'1.5px solid #e2e8f0',borderRadius:10,fontFamily:'inherit',fontSize:13.5,outline:'none',resize:'none',boxSizing:'border-box' }} />
                </div>
                <div style={{ display:'flex',gap:10 }}>
                  <button onClick={()=>handleReview('rejected')} disabled={saving}
                    style={{ flex:1,padding:'12px',borderRadius:12,border:'none',background:'#fee2e2',color:'#dc2626',fontFamily:'inherit',fontWeight:800,cursor:'pointer',fontSize:14 }}>
                    ❌ Reject
                  </button>
                  <button onClick={()=>handleReview('approved')} disabled={saving}
                    style={{ flex:2,padding:'12px',borderRadius:12,border:'none',background:'linear-gradient(135deg,#059669,#34d399)',color:'#fff',fontFamily:'inherit',fontWeight:800,cursor:'pointer',fontSize:14,display:'flex',alignItems:'center',justifyContent:'center',gap:8 }}>
                    {saving?<><div style={{ width:16,height:16,border:'2px solid rgba(255,255,255,.3)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin .7s linear infinite' }} />...</>:'✅ Approve Leave'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
