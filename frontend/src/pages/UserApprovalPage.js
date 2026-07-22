import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usersAPI, authAPI } from '../utils/api';
import toast from 'react-hot-toast';

const ROLES = ['admin','doctor','patient','nurse','pharmacist','wardboy','sweeper','otboy','finance','electrician','plumber','it_technician','equipment_tech','biomedical','security','receptionist','ambulance_driver','lab_technician','radiology_tech','dialysis_tech'];
const ROLE_LABELS = { admin:'Administrator',doctor:'Doctor',patient:'Patient',nurse:'Nurse',pharmacist:'Pharmacist',wardboy:'Ward Boy',sweeper:'Sweeper',otboy:'OT Boy',finance:'Finance Officer',electrician:'Electrician',plumber:'Plumber',it_technician:'IT Technician',equipment_tech:'Equipment Tech',biomedical:'Biomedical Eng.',security:'Security Officer',receptionist:'Receptionist',ambulance_driver:'Ambulance Driver',lab_technician:'Lab Technician',radiology_tech:'Radiology Tech',dialysis_tech:'Dialysis Tech' };
const ROLE_COLOR = { admin:'#6366f1',doctor:'#0891b2',patient:'#7c3aed',nurse:'#db2777',pharmacist:'#d97706',wardboy:'#059669',sweeper:'#f59e0b',otboy:'#ef4444',finance:'#8b5cf6',electrician:'#f59e0b',plumber:'#0891b2',it_technician:'#6366f1',equipment_tech:'#8b5cf6',biomedical:'#059669',security:'#374151',receptionist:'#db2777',ambulance_driver:'#dc2626',lab_technician:'#0d9488',radiology_tech:'#0e7490',dialysis_tech:'#be123c' };
const DEPTS = ['Cardiology','Neurology','Orthopedics','General Medicine','Pediatrics','Psychiatry','Gynecology','Oncology','Surgery','ENT','Radiology','ICU','Emergency','Pharmacy','Laboratory','Ward A','Ward B','Ward C','Finance & Accounts','Administration','IT Department','Maintenance','Security','Reception','Biomedical Engineering'];
const ini = n => n?.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()||'?';
const rc  = r => ROLE_COLOR[r]||'#64748b';
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}) : '—';

export default function UserApprovalPage() {
  const [users, setUsers]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [roleFilter, setRoleF]= useState('');
  const [statFilter, setStatF]= useState('');
  const [editUser, setEdit]   = useState(null);
  const [editForm, setEF]     = useState({});
  const [viewUser, setView]   = useState(null);
  const [saving, setSaving]   = useState(false);
  const [phoneRequests, setPhoneRequests] = useState([]);
  const [reviewingPhoneId, setReviewingPhoneId] = useState(null);

  const loadPhoneRequests = async () => {
    try { const r = await authAPI.getPhoneChangeRequests({ status: 'pending' }); setPhoneRequests(r.data.data||[]); }
    catch { /* silent — non-critical widget */ }
  };
  useEffect(() => { loadPhoneRequests(); }, []);

  const approvePhoneRequest = async (id) => {
    setReviewingPhoneId(id);
    try { await authAPI.approvePhoneChangeRequest(id); toast.success('✅ Phone number change approved'); loadPhoneRequests(); load(); }
    catch (e) { toast.error(e.response?.data?.error || 'Failed to approve'); }
    setReviewingPhoneId(null);
  };
  const rejectPhoneRequest = async (id) => {
    const note = window.prompt('Reason for rejecting (optional):', '') || '';
    setReviewingPhoneId(id);
    try { await authAPI.rejectPhoneChangeRequest(id, note); toast.success('Request rejected'); loadPhoneRequests(); }
    catch (e) { toast.error(e.response?.data?.error || 'Failed to reject'); }
    setReviewingPhoneId(null);
  };

  const load = async () => {
    setLoading(true);
    try { const r = await usersAPI.getAll(); setUsers(r.data.data||[]); }
    catch { toast.error('Failed to load users'); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const approve = async id => {
    try { await usersAPI.approve(id); toast.success('✅ User approved! Welcome email sent.'); load(); }
    catch { toast.error('Failed to approve'); }
  };
  const reject = async id => {
    if (!window.confirm('Remove this user?')) return;
    try { await usersAPI.delete(id); toast.success('User removed'); load(); }
    catch { toast.error('Failed'); }
  };
  const openEdit = u => {
    setEdit(u);
    setEF({ name:u.name, email:u.email, phone:u.phone||'', role:u.role, department:u.department||'', specialization:u.specialization||'', licenseNumber:u.licenseNumber||'', status:u.status, bloodGroup:u.bloodGroup||'', address:u.address||'', joiningDate: u.joiningDate ? u.joiningDate.split('T')[0] : '' });
  };
  const saveEdit = async () => {
    setSaving(true);
    try { await usersAPI.update(editUser._id, editForm); toast.success('User updated!'); setEdit(null); load(); }
    catch(e) { toast.error(e.response?.data?.error||'Update failed'); }
    setSaving(false);
  };

  const filtered = users.filter(u =>
    (!search || u.name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase())) &&
    (!roleFilter || u.role===roleFilter) &&
    (!statFilter || u.status===statFilter)
  );
  const pending = users.filter(u=>u.status==='pending');

  const FIELD = (label, key, type='text', opts=null) => (
    <div key={key}>
      <label style={LS}>{label}</label>
      {opts
        ? <select style={IS} value={editForm[key]||''} onChange={e=>setEF(f=>({...f,[key]:e.target.value}))}>
            <option value="">Select…</option>
            {opts.map(o=><option key={o.v||o} value={o.v||o}>{o.l||o}</option>)}
          </select>
        : <input type={type} style={IS} value={editForm[key]||''} onChange={e=>setEF(f=>({...f,[key]:e.target.value}))} />
      }
    </div>
  );
  const LS = { display:'block',fontSize:10.5,fontWeight:700,color:'#64748b',letterSpacing:.5,textTransform:'uppercase',marginBottom:5 };
  const IS = { width:'100%',padding:'10px 12px',border:'1.5px solid #e2e8f0',borderRadius:10,fontFamily:'inherit',fontSize:13.5,outline:'none',background:'#fff',boxSizing:'border-box',transition:'border-color .2s' };

  return (
    <div style={{ fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap'); @keyframes spin{to{transform:rotate(360deg)}} input:focus,select:focus{border-color:#2563eb!important;}`}</style>

      <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20,flexWrap:'wrap',gap:12 }}>
        <div>
          <h1 style={{ fontSize:22,fontWeight:800,color:'#0f172a',margin:0 }}>👤 User Management</h1>
          <p style={{ color:'#94a3b8',fontSize:13,marginTop:3 }}>{users.length} total · {pending.length} pending approval</p>
        </div>
        <div style={{ display:'flex',gap:8,flexWrap:'wrap' }}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Search name or email…"
            style={{ padding:'8px 13px',border:'1.5px solid #e2e8f0',borderRadius:11,fontSize:13,fontFamily:'inherit',outline:'none',width:220 }} />
          <select value={roleFilter} onChange={e=>setRoleF(e.target.value)}
            style={{ padding:'8px 12px',border:'1.5px solid #e2e8f0',borderRadius:11,fontSize:13,fontFamily:'inherit',outline:'none',background:'#fff' }}>
            <option value="">All Roles</option>
            {ROLES.map(r=><option key={r} value={r}>{ROLE_LABELS[r]||r}</option>)}
          </select>
          <select value={statFilter} onChange={e=>setStatF(e.target.value)}
            style={{ padding:'8px 12px',border:'1.5px solid #e2e8f0',borderRadius:11,fontSize:13,fontFamily:'inherit',outline:'none',background:'#fff' }}>
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
      </div>

      {/* Pending banner */}
      {pending.length > 0 && (
        <motion.div initial={{ opacity:0,y:-8 }} animate={{ opacity:1,y:0 }}
          style={{ background:'linear-gradient(135deg,#fffbeb,#fef9c3)',border:'1.5px solid #fde68a',borderRadius:16,padding:'14px 20px',marginBottom:20,display:'flex',alignItems:'center',gap:14 }}>
          <div style={{ width:44,height:44,borderRadius:12,background:'#fef3c7',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,flexShrink:0 }}>⏳</div>
          <div>
            <div style={{ fontWeight:800,color:'#92400e',fontSize:14 }}>{pending.length} user{pending.length!==1?'s':''} waiting for approval</div>
            <div style={{ fontSize:12.5,color:'#b45309',marginTop:2 }}>Review and approve or reject registrations below</div>
          </div>
          <div style={{ marginLeft:'auto',display:'flex',gap:6 }}>
            {pending.slice(0,4).map(u=>(
              <div key={u._id} title={u.name} style={{ width:30,height:30,borderRadius:'50%',background:`linear-gradient(135deg,${rc(u.role)},${rc(u.role)}99)`,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:700,fontSize:11,border:'2px solid #fff' }}>{ini(u.name)}</div>
            ))}
            {pending.length>4&&<div style={{ width:30,height:30,borderRadius:'50%',background:'#e2e8f0',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:'#64748b' }}>+{pending.length-4}</div>}
          </div>
        </motion.div>
      )}

      {/* Phone number change requests — admin approval required */}
      {phoneRequests.length > 0 && (
        <motion.div initial={{ opacity:0,y:-8 }} animate={{ opacity:1,y:0 }}
          style={{ background:'#fff',border:'1.5px solid #bfdbfe',borderRadius:16,padding:'16px 20px',marginBottom:20 }}>
          <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:12 }}>
            <div style={{ width:38,height:38,borderRadius:11,background:'#eff6ff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0 }}>📱</div>
            <div>
              <div style={{ fontWeight:800,color:'#1d4ed8',fontSize:14 }}>{phoneRequests.length} phone number change request{phoneRequests.length!==1?'s':''} awaiting review</div>
              <div style={{ fontSize:12,color:'#64748b',marginTop:1 }}>Users can no longer self-verify via OTP — approve or reject each request below</div>
            </div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {phoneRequests.map(r => (
              <div key={r._id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, padding:'10px 12px', background:'#f8fafc', borderRadius:10, border:'1px solid #e2e8f0', flexWrap:'wrap' }}>
                <div>
                  <div style={{ fontWeight:700, fontSize:13, color:'#0f172a' }}>{r.user?.name} <span style={{ fontWeight:500, color:'#94a3b8' }}>({r.user?.role})</span></div>
                  <div style={{ fontSize:12, color:'#64748b', marginTop:2 }}>
                    {r.currentPhone || 'No phone on file'} → <strong style={{ color:'#1d4ed8' }}>{r.requestedPhone}</strong>
                  </div>
                  {r.reason && <div style={{ fontSize:11.5, color:'#94a3b8', marginTop:2 }}>Reason: {r.reason}</div>}
                </div>
                <div style={{ display:'flex', gap:6 }}>
                  <button className="btn btn-primary btn-xs" disabled={reviewingPhoneId===r._id} onClick={()=>approvePhoneRequest(r._id)}>✅ Approve</button>
                  <button className="btn btn-outline btn-xs" disabled={reviewingPhoneId===r._id} onClick={()=>rejectPhoneRequest(r._id)}>✕ Reject</button>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Stats */}
      <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))',gap:10,marginBottom:20 }}>
        {[
          { l:'Total Users',  v:users.length,                                        i:'👥', bg:'#eff6ff',c:'#1d4ed8' },
          { l:'Approved',     v:users.filter(u=>u.status==='approved').length,       i:'✅', bg:'#dcfce7',c:'#15803d' },
          { l:'Pending',      v:pending.length,                                      i:'⏳', bg:'#fef3c7',c:'#92400e' },
          { l:'Doctors',      v:users.filter(u=>u.role==='doctor').length,           i:'⚕️', bg:'#ecfeff',c:'#0e7490' },
          { l:'Patients',     v:users.filter(u=>u.role==='patient').length,          i:'🧑', bg:'#f5f3ff',c:'#6d28d9' },
          { l:'Support Staff',v:users.filter(u=>['wardboy','sweeper','otboy','electrician','plumber','it_technician','equipment_tech','biomedical','security','receptionist','ambulance_driver','lab_technician','radiology_tech','dialysis_tech'].includes(u.role)).length, i:'🔧',bg:'#f0fdf4',c:'#15803d' },
        ].map((s,i)=>(
          <motion.div key={i} initial={{ opacity:0,y:10 }} animate={{ opacity:1,y:0 }} transition={{ delay:i*.05 }}
            style={{ background:'#fff',border:'1px solid #e8edf3',borderRadius:13,padding:'13px',display:'flex',alignItems:'center',gap:10 }}>
            <div style={{ width:38,height:38,borderRadius:10,background:s.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0 }}>{s.i}</div>
            <div><div style={{ fontSize:22,fontWeight:900,color:'#0f172a',lineHeight:1 }}>{s.v}</div><div style={{ fontSize:11,color:'#94a3b8',marginTop:1 }}>{s.l}</div></div>
          </motion.div>
        ))}
      </div>

      {/* Table */}
      <div style={{ background:'#fff',border:'1px solid #e8edf3',borderRadius:18,overflow:'hidden' }}>
        <div style={{ padding:'14px 20px',borderBottom:'1px solid #f1f5f9',display:'flex',alignItems:'center',justifyContent:'space-between' }}>
          <span style={{ fontWeight:800,fontSize:15,color:'#0f172a' }}>All Users ({filtered.length})</span>
        </div>
        {loading ? (
          <div style={{ padding:48,textAlign:'center' }}><div style={{ width:28,height:28,border:'3px solid #e2e8f0',borderTopColor:'#2563eb',borderRadius:'50%',animation:'spin .7s linear infinite',margin:'0 auto' }} /></div>
        ) : filtered.length===0 ? (
          <div style={{ padding:48,textAlign:'center',color:'#94a3b8' }}><div style={{ fontSize:40,marginBottom:10 }}>🔍</div><div style={{ fontWeight:700 }}>No users found</div></div>
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%',borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:'#f8fafc' }}>
                  {['User','Role','Department','Status','Joining Date','User ID','Actions'].map(h=>(
                    <th key={h} style={{ padding:'10px 14px',textAlign:'left',fontSize:11,fontWeight:700,color:'#94a3b8',letterSpacing:.5,textTransform:'uppercase',borderBottom:'1px solid #f1f5f9',whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((u,i)=>(
                  <motion.tr key={u._id} initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:i*.02 }}
                    style={{ borderBottom:'1px solid #f8fafc' }}
                    onMouseEnter={e=>e.currentTarget.style.background='#fafbfc'}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <td style={{ padding:'11px 14px' }}>
                      <div style={{ display:'flex',alignItems:'center',gap:10 }}>
                        <div style={{ width:36,height:36,borderRadius:10,background:`linear-gradient(135deg,${rc(u.role)},${rc(u.role)}99)`,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:700,fontSize:13,flexShrink:0 }}>{ini(u.name)}</div>
                        <div>
                          <div style={{ fontWeight:700,color:'#0f172a',fontSize:13 }}>{u.name}</div>
                          <div style={{ fontSize:11.5,color:'#94a3b8' }}>{u.email}</div>
                          {u.phone&&<div style={{ fontSize:11,color:'#64748b' }}>{u.phone}</div>}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding:'11px 14px' }}>
                      <span style={{ padding:'3px 9px',borderRadius:20,fontSize:11.5,fontWeight:700,background:`${rc(u.role)}18`,color:rc(u.role) }}>{ROLE_LABELS[u.role]||u.role}</span>
                    </td>
                    <td style={{ padding:'11px 14px',fontSize:13,color:'#64748b' }}>{u.department||'—'}</td>
                    <td style={{ padding:'11px 14px' }}>
                      <span style={{ padding:'4px 10px',borderRadius:20,fontSize:11.5,fontWeight:700,
                        background:u.status==='approved'?'#dcfce7':u.status==='pending'?'#fef3c7':'#fee2e2',
                        color:u.status==='approved'?'#15803d':u.status==='pending'?'#92400e':'#dc2626',
                        display:'flex',alignItems:'center',gap:5,width:'fit-content' }}>
                        {u.status==='approved'?'✅':u.status==='pending'?'⏳':'🚫'} {u.status}
                      </span>
                    </td>
                    {/* JOINING DATE */}
                    <td style={{ padding:'11px 14px',fontSize:12.5,color:'#64748b',whiteSpace:'nowrap' }}>
                      <div style={{ display:'flex',alignItems:'center',gap:5 }}>
                        <span>📅</span>
                        <span>{fmtDate(u.joiningDate||u.createdAt)}</span>
                      </div>
                    </td>
                    <td style={{ padding:'11px 14px',fontFamily:'monospace',fontSize:11.5,color:'#94a3b8' }}>
                      {u._id.slice(-8).toUpperCase()}
                    </td>
                    <td style={{ padding:'11px 14px' }}>
                      <div style={{ display:'flex',gap:5,flexWrap:'wrap' }}>
                        {u.status==='pending'&&(
                          <button onClick={()=>approve(u._id)} style={{ padding:'5px 11px',borderRadius:8,border:'none',background:'#059669',color:'#fff',fontFamily:'inherit',fontSize:11.5,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap' }}>✓ Approve</button>
                        )}
                        <button onClick={()=>openEdit(u)} style={{ padding:'5px 11px',borderRadius:8,border:'1.5px solid #2563eb',background:'#eff6ff',color:'#2563eb',fontFamily:'inherit',fontSize:11.5,fontWeight:700,cursor:'pointer' }}>✏️ Edit</button>
                        <button onClick={()=>setView(u)} style={{ padding:'5px 11px',borderRadius:8,border:'1px solid #e2e8f0',background:'#f8fafc',color:'#374151',fontFamily:'inherit',fontSize:11.5,fontWeight:700,cursor:'pointer' }}>👁 View</button>
                        {u.status==='pending'&&<button onClick={()=>reject(u._id)} style={{ padding:'5px 9px',borderRadius:8,border:'1px solid #fecaca',background:'#fef2f2',color:'#dc2626',fontFamily:'inherit',fontSize:11.5,fontWeight:700,cursor:'pointer' }}>✗</button>}
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── EDIT MODAL ── */}
      <AnimatePresence>
        {editUser&&(
          <div onClick={e=>{if(e.target===e.currentTarget)setEdit(null)}} style={{ position:'fixed',inset:0,background:'rgba(0,0,0,.55)',backdropFilter:'blur(4px)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16,overflowY:'auto' }}>
            <motion.div initial={{ opacity:0,y:24,scale:.96 }} animate={{ opacity:1,y:0,scale:1 }} exit={{ opacity:0,y:24,scale:.96 }}
              style={{ background:'#fff',borderRadius:24,width:'100%',maxWidth:560,boxShadow:'0 32px 80px rgba(0,0,0,.25)',overflow:'hidden',maxHeight:'90vh',overflowY:'auto' }}>
              <div style={{ background:`linear-gradient(135deg,${rc(editUser.role)},${rc(editUser.role)}cc)`,padding:'18px 24px',position:'sticky',top:0,zIndex:1 }}>
                <div style={{ display:'flex',alignItems:'center',gap:12 }}>
                  <div style={{ width:44,height:44,borderRadius:12,background:'rgba(255,255,255,.25)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:800,fontSize:17 }}>{ini(editUser.name)}</div>
                  <div>
                    <div style={{ color:'#fff',fontWeight:800,fontSize:16 }}>Edit — {editUser.name}</div>
                    <div style={{ color:'rgba(255,255,255,.7)',fontSize:12 }}>{editUser.email} · ID: {editUser._id.slice(-8).toUpperCase()}</div>
                  </div>
                  <button onClick={()=>setEdit(null)} style={{ marginLeft:'auto',background:'rgba(255,255,255,.2)',border:'none',borderRadius:'50%',width:28,height:28,cursor:'pointer',color:'#fff',fontSize:14,display:'flex',alignItems:'center',justifyContent:'center' }}>✕</button>
                </div>
              </div>
              <div style={{ padding:'22px 24px' }}>
                <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:13,marginBottom:13 }}>
                  {FIELD('Full Name','name')}
                  {FIELD('Phone','phone','tel')}
                  {FIELD('Role','role','text',ROLES.map(r=>({v:r,l:ROLE_LABELS[r]||r})))}
                  {FIELD('Status','status','text',[{v:'pending',l:'⏳ Pending'},{v:'approved',l:'✅ Approved'},{v:'suspended',l:'🚫 Suspended'}])}
                  {FIELD('Department','department','text',DEPTS.map(d=>({v:d,l:d})))}
                  {FIELD('Specialization','specialization')}
                  {FIELD('License Number','licenseNumber')}
                  {FIELD('Blood Group','bloodGroup','text',['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(b=>({v:b,l:b})))}
                  {/* JOINING DATE — editable */}
                  <div>
                    <label style={LS}>📅 Joining Date</label>
                    <input type="date" style={IS} value={editForm.joiningDate||''} onChange={e=>setEF(f=>({...f,joiningDate:e.target.value}))} />
                  </div>
                  <div>
                    <label style={LS}>Address</label>
                    <input type="text" style={IS} value={editForm.address||''} onChange={e=>setEF(f=>({...f,address:e.target.value}))} placeholder="Full address…" />
                  </div>
                </div>
                <div style={{ display:'flex',gap:10,marginTop:6 }}>
                  <button onClick={()=>setEdit(null)} style={{ flex:1,padding:'12px',borderRadius:12,border:'1.5px solid #e2e8f0',background:'#fff',fontFamily:'inherit',fontWeight:700,cursor:'pointer',fontSize:14 }}>Cancel</button>
                  <button onClick={saveEdit} disabled={saving} style={{ flex:2,padding:'12px',borderRadius:12,border:'none',background:`linear-gradient(135deg,${rc(editUser.role)},${rc(editUser.role)}cc)`,color:'#fff',fontFamily:'inherit',fontWeight:800,cursor:'pointer',fontSize:14,display:'flex',alignItems:'center',justifyContent:'center',gap:8 }}>
                    {saving?<><div style={{ width:15,height:15,border:'2px solid rgba(255,255,255,.3)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin .7s linear infinite' }} />Saving…</>:'💾 Save Changes'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── VIEW MODAL ── */}
      <AnimatePresence>
        {viewUser&&(
          <div onClick={e=>{if(e.target===e.currentTarget)setView(null)}} style={{ position:'fixed',inset:0,background:'rgba(0,0,0,.55)',backdropFilter:'blur(4px)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16 }}>
            <motion.div initial={{ opacity:0,y:20,scale:.96 }} animate={{ opacity:1,y:0,scale:1 }} exit={{ opacity:0,y:20,scale:.96 }}
              style={{ background:'#fff',borderRadius:24,width:'100%',maxWidth:480,boxShadow:'0 32px 80px rgba(0,0,0,.25)',overflow:'hidden' }}>
              <div style={{ background:`linear-gradient(135deg,${rc(viewUser.role)},${rc(viewUser.role)}cc)`,padding:'20px 24px' }}>
                <div style={{ display:'flex',alignItems:'center',gap:12 }}>
                  <div style={{ width:50,height:50,borderRadius:14,background:'rgba(255,255,255,.25)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:800,fontSize:19 }}>{ini(viewUser.name)}</div>
                  <div>
                    <div style={{ color:'#fff',fontWeight:800,fontSize:17 }}>{viewUser.name}</div>
                    <div style={{ color:'rgba(255,255,255,.75)',fontSize:12,marginTop:2 }}>{ROLE_LABELS[viewUser.role]||viewUser.role} · {viewUser.department||'No Dept'}</div>
                  </div>
                  <button onClick={()=>setView(null)} style={{ marginLeft:'auto',background:'rgba(255,255,255,.2)',border:'none',borderRadius:'50%',width:28,height:28,cursor:'pointer',color:'#fff',fontSize:14,display:'flex',alignItems:'center',justifyContent:'center' }}>✕</button>
                </div>
              </div>
              <div style={{ padding:'18px 22px' }}>
                <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:9,marginBottom:16 }}>
                  {[
                    ['📧 Email',       viewUser.email],
                    ['📞 Phone',       viewUser.phone||'—'],
                    ['🏥 Department',  viewUser.department||'—'],
                    ['🔬 Specialization',viewUser.specialization||'—'],
                    ['🩸 Blood Group', viewUser.bloodGroup||'—'],
                    ['🆔 User ID',     viewUser._id.slice(-8).toUpperCase()],
                    // JOINING DATE
                    ['📅 Joining Date', fmtDate(viewUser.joiningDate||viewUser.createdAt)],
                    ['📅 Account Created', fmtDate(viewUser.createdAt)],
                    ['✅ Status',       viewUser.status],
                    ['📧 Email Verified', viewUser.emailVerified ? '✅ Yes' : '❌ No'],
                  ].map(([l,v])=>(
                    <div key={l} style={{ background:'#f8fafc',borderRadius:10,padding:'9px 12px' }}>
                      <div style={{ fontSize:10.5,color:'#94a3b8',fontWeight:700,marginBottom:2 }}>{l}</div>
                      <div style={{ fontSize:13,fontWeight:600,color:'#0f172a',wordBreak:'break-all' }}>{v}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display:'flex',gap:8 }}>
                  {viewUser.status==='pending'&&<button onClick={()=>{approve(viewUser._id);setView(null);}} style={{ flex:1,padding:'10px',borderRadius:11,border:'none',background:'#059669',color:'#fff',fontFamily:'inherit',fontWeight:700,cursor:'pointer',fontSize:13 }}>✓ Approve</button>}
                  <button onClick={()=>{openEdit(viewUser);setView(null);}} style={{ flex:2,padding:'10px',borderRadius:11,border:'none',background:'#2563eb',color:'#fff',fontFamily:'inherit',fontWeight:700,cursor:'pointer',fontSize:13 }}>✏️ Edit User</button>
                  <button onClick={()=>setView(null)} style={{ flex:1,padding:'10px',borderRadius:11,border:'1.5px solid #e2e8f0',background:'#fff',fontFamily:'inherit',fontWeight:700,cursor:'pointer',fontSize:13 }}>Close</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
