// // DoctorsPage.js
// import React, { useState, useEffect } from 'react';
// import { motion } from 'framer-motion';
// import { usersAPI } from '../utils/api';
// import toast from 'react-hot-toast';

// export default function DoctorsPage() {
//   const [doctors, setDoctors] = useState([]);
//   const [loading, setLoading] = useState(true);

//   useEffect(() => {
//     usersAPI.getAll({ role:'doctor' }).then(r => { setDoctors(r.data.data||[]); setLoading(false); }).catch(() => { toast.error('Failed to load doctors'); setLoading(false); });
//   }, []);

//   return (
//     <div>
//       <div className="page-header">
//         <div><div className="page-title">🩺 Doctors</div><div className="page-subtitle">{doctors.length} doctors on staff</div></div>
//         <button className="btn btn-primary">+ Add Doctor</button>
//       </div>
//       {loading ? <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:14 }}>{Array(6).fill(0).map((_,i)=><div key={i} className="skeleton" style={{ height:200,borderRadius:12 }}/>)}</div>
//         : <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:14 }}>
//           {doctors.map((d,i) => (
//             <motion.div key={d._id} initial={{ opacity:0,y:14 }} animate={{ opacity:1,y:0 }} transition={{ delay:i*.06 }} style={{ background:'#fff',border:'1.5px solid #e2e8f0',borderRadius:12,padding:18,textAlign:'center',cursor:'pointer',transition:'all .2s' }}
//               onMouseEnter={e=>{e.currentTarget.style.borderColor='#1648c9';e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='0 8px 24px rgba(15,23,42,.1)';}}
//               onMouseLeave={e=>{e.currentTarget.style.borderColor='#e2e8f0';e.currentTarget.style.transform='none';e.currentTarget.style.boxShadow='none';}}
//             >
//               <div style={{ width:52,height:52,borderRadius:'50%',background:'linear-gradient(135deg,#1648c9,#0891b2)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:800,fontSize:18,margin:'0 auto 10px' }}>{d.name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()}</div>
//               <div className="fw-7" style={{ fontSize:14 }}>{d.name}</div>
//               <div className="text-xs text-muted">{d.department}</div>
//               <div style={{ color:'#d97706',fontSize:12,fontWeight:700,marginTop:4 }}>★ {d.rating||4.8} · {d.totalPatients||0} patients</div>
//               <span className={`badge ${d.status==='approved'?'badge-success':'badge-warning'} mt-1`}>{d.status}</span>
//               <div className="text-xs text-muted mt-2">{d.phone||'—'}</div>
//               <button className="btn btn-outline" style={{ width:'100%',marginTop:10,justifyContent:'center',fontSize:12 }}>View Profile</button>
//             </motion.div>
//           ))}
//         </div>
//       }
//     </div>
//   );
// }


// import React, { useState, useEffect } from 'react';
// import { motion, AnimatePresence } from 'framer-motion';
// import { usersAPI } from '../utils/api';
// import { useAuth } from '../context/AuthContext';
// import toast from 'react-hot-toast';

// const SPECIALIZATIONS = ['Cardiology','Neurology','Orthopedics','Pediatrics','Dermatology','General Medicine','Gynecology','Oncology','Psychiatry','Radiology','Surgery','ENT','Ophthalmology','Urology','Nephrology'];

// export default function DoctorsPage() {
//   const { user } = useAuth();
//   const [doctors, setDoctors] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [selectedDoctor, setSelectedDoctor] = useState(null);
//   const [showAddModal, setShowAddModal] = useState(false);
//   const [editMode, setEditMode] = useState(false);
//   const [editForm, setEditForm] = useState({});
//   const [saving, setSaving] = useState(false);
//   const [search, setSearch] = useState('');

//   const load = () => {
//     setLoading(true);
//     usersAPI.getAll({ role: 'doctor' })
//       .then(r => { setDoctors(r.data.data || []); setLoading(false); })
//       .catch(() => { toast.error('Failed to load doctors'); setLoading(false); });
//   };

//   useEffect(() => { load(); }, []);

//   const handleViewProfile = async (doc) => {
//     try {
//       const res = await usersAPI.getOne(doc._id);
//       setSelectedDoctor(res.data.data || doc);
//       setEditForm(res.data.data || doc);
//     } catch {
//       setSelectedDoctor(doc);
//       setEditForm(doc);
//     }
//     setEditMode(false);
//   };

//   const handleSaveEdit = async () => {
//     setSaving(true);
//     try {
//       const res = await usersAPI.update(selectedDoctor._id, {
//         name: editForm.name, phone: editForm.phone,
//         department: editForm.department, specialization: editForm.specialization,
//         licenseNumber: editForm.licenseNumber, status: editForm.status,
//       });
//       toast.success('Doctor profile updated!');
//       setSelectedDoctor(res.data.data);
//       setEditMode(false);
//       load();
//     } catch (err) {
//       toast.error(err.response?.data?.error || 'Update failed');
//     }
//     setSaving(false);
//   };

//   const handleApprove = async (id) => {
//     try {
//       await usersAPI.approve(id);
//       toast.success('Doctor approved!');
//       load();
//       if (selectedDoctor?._id === id) setSelectedDoctor(d => ({ ...d, status: 'approved' }));
//     } catch { toast.error('Failed to approve'); }
//   };

//   const handleDelete = async (id) => {
//     if (!window.confirm('Remove this doctor from the system?')) return;
//     try {
//       await usersAPI.delete(id);
//       toast.success('Doctor removed');
//       setSelectedDoctor(null);
//       load();
//     } catch (err) { toast.error(err.response?.data?.error || 'Delete failed'); }
//   };

//   const filtered = doctors.filter(d =>
//     d.name?.toLowerCase().includes(search.toLowerCase()) ||
//     d.department?.toLowerCase().includes(search.toLowerCase()) ||
//     d.specialization?.toLowerCase().includes(search.toLowerCase())
//   );
//   const isAdmin = user?.role === 'admin';
//   const statusColor = s => s==='approved'?'#059669':s==='pending'?'#d97706':'#ef4444';
//   const statusBg = s => s==='approved'?'#d1fae5':s==='pending'?'#fef3c7':'#fee2e2';

//   return (
//     <div>
//       <div className="page-header">
//         <div>
//           <div className="page-title">🩺 Doctors</div>
//           <div className="page-subtitle">{doctors.length} doctors on staff</div>
//         </div>
//         <div style={{ display:'flex', gap:10, alignItems:'center' }}>
//           <input className="form-input" style={{ width:220, padding:'8px 12px' }} placeholder="Search doctors..." value={search} onChange={e => setSearch(e.target.value)} />
//           {isAdmin && <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>+ Add Doctor</button>}
//         </div>
//       </div>

//       {loading
//         ? <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(210px,1fr))', gap:14 }}>
//             {Array(6).fill(0).map((_,i) => <div key={i} className="skeleton" style={{ height:220, borderRadius:12 }} />)}
//           </div>
//         : filtered.length === 0
//           ? <div style={{ textAlign:'center', padding:60, color:'#94a3b8' }}><div style={{ fontSize:48, marginBottom:12 }}>🔍</div><div>No doctors found</div></div>
//           : <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(210px,1fr))', gap:14 }}>
//               {filtered.map((d,i) => (
//                 <motion.div key={d._id} initial={{ opacity:0,y:14 }} animate={{ opacity:1,y:0 }} transition={{ delay:i*.06 }}
//                   style={{ background:'#fff', border:'1.5px solid #e2e8f0', borderRadius:14, padding:18, textAlign:'center', cursor:'pointer', transition:'all .2s' }}
//                   onMouseEnter={e=>{e.currentTarget.style.borderColor='#1648c9';e.currentTarget.style.transform='translateY(-3px)';e.currentTarget.style.boxShadow='0 10px 28px rgba(15,23,42,.12)';}}
//                   onMouseLeave={e=>{e.currentTarget.style.borderColor='#e2e8f0';e.currentTarget.style.transform='none';e.currentTarget.style.boxShadow='none';}}
//                 >
//                   <div style={{ width:56, height:56, borderRadius:'50%', background:'linear-gradient(135deg,#1648c9,#0891b2)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:800, fontSize:20, margin:'0 auto 12px' }}>
//                     {d.name?.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()}
//                   </div>
//                   <div style={{ fontWeight:700, fontSize:14, color:'#0f172a', marginBottom:2 }}>{d.name}</div>
//                   <div style={{ fontSize:12, color:'#64748b', marginBottom:4 }}>{d.department || d.specialization || '—'}</div>
//                   <div style={{ fontSize:11, color:'#d97706', fontWeight:700, marginBottom:8 }}>★ {d.rating||4.8} · {d.totalPatients||0} pts</div>
//                   <span style={{ display:'inline-block', padding:'2px 10px', borderRadius:20, fontSize:11, fontWeight:700, background:statusBg(d.status), color:statusColor(d.status) }}>{d.status}</span>
//                   <div style={{ fontSize:11, color:'#94a3b8', marginTop:8, marginBottom:10 }}>{d.phone||'—'}</div>
//                   <button className="btn btn-outline" style={{ width:'100%', justifyContent:'center', fontSize:12 }} onClick={() => handleViewProfile(d)}>
//                     View Profile
//                   </button>
//                   {isAdmin && d.status==='pending' && (
//                     <button className="btn btn-primary" style={{ width:'100%', justifyContent:'center', fontSize:12, marginTop:6 }} onClick={() => handleApprove(d._id)}>
//                       ✓ Approve
//                     </button>
//                   )}
//                 </motion.div>
//               ))}
//             </div>
//       }

//       {/* Doctor Profile Modal */}
//       <AnimatePresence>
//         {selectedDoctor && (
//           <div className="modal-overlay" onClick={e => { if(e.target===e.currentTarget){setSelectedDoctor(null);setEditMode(false);} }}>
//             <motion.div className="modal-box" style={{ maxWidth:560 }}
//               initial={{ opacity:0,y:24,scale:0.96 }} animate={{ opacity:1,y:0,scale:1 }} exit={{ opacity:0,y:24,scale:0.96 }}
//             >
//               <div className="modal-header">
//                 <span className="modal-title">🩺 Doctor Profile</span>
//                 <div style={{ display:'flex', gap:8 }}>
//                   {isAdmin && !editMode && <button className="btn btn-outline btn-xs" onClick={() => setEditMode(true)}>✏️ Edit</button>}
//                   <button className="btn btn-ghost btn-icon" onClick={() => {setSelectedDoctor(null);setEditMode(false);}}>✕</button>
//                 </div>
//               </div>

//               <div className="modal-body">
//                 <div style={{ display:'flex', alignItems:'center', gap:16, background:'linear-gradient(135deg,#1648c9,#0891b2)', borderRadius:12, padding:'16px 20px', marginBottom:16 }}>
//                   <div style={{ width:64, height:64, borderRadius:'50%', background:'rgba(255,255,255,.25)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:800, fontSize:24, flexShrink:0 }}>
//                     {selectedDoctor.name?.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()}
//                   </div>
//                   <div>
//                     <div style={{ color:'#fff', fontWeight:800, fontSize:18 }}>{selectedDoctor.name}</div>
//                     <div style={{ color:'rgba(255,255,255,.8)', fontSize:13 }}>{selectedDoctor.department || selectedDoctor.specialization || 'General Medicine'}</div>
//                     <span style={{ display:'inline-block', marginTop:4, padding:'2px 10px', borderRadius:20, fontSize:11, fontWeight:700, background:statusBg(selectedDoctor.status), color:statusColor(selectedDoctor.status) }}>{selectedDoctor.status}</span>
//                   </div>
//                 </div>

//                 {editMode ? (
//                   <div>
//                     <div className="form-row">
//                       <div className="form-group"><label className="form-label">Full Name</label><input className="form-input" value={editForm.name||''} onChange={e=>setEditForm(f=>({...f,name:e.target.value}))} /></div>
//                       <div className="form-group"><label className="form-label">Phone</label><input className="form-input" value={editForm.phone||''} onChange={e=>setEditForm(f=>({...f,phone:e.target.value}))} /></div>
//                     </div>
//                     <div className="form-row">
//                       <div className="form-group"><label className="form-label">Department</label><input className="form-input" value={editForm.department||''} onChange={e=>setEditForm(f=>({...f,department:e.target.value}))} /></div>
//                       <div className="form-group">
//                         <label className="form-label">Specialization</label>
//                         <select className="form-input" value={editForm.specialization||''} onChange={e=>setEditForm(f=>({...f,specialization:e.target.value}))}>
//                           <option value="">Select...</option>
//                           {SPECIALIZATIONS.map(s=><option key={s}>{s}</option>)}
//                         </select>
//                       </div>
//                     </div>
//                     <div className="form-row">
//                       <div className="form-group"><label className="form-label">License No.</label><input className="form-input" value={editForm.licenseNumber||''} onChange={e=>setEditForm(f=>({...f,licenseNumber:e.target.value}))} /></div>
//                       <div className="form-group">
//                         <label className="form-label">Status</label>
//                         <select className="form-input" value={editForm.status||''} onChange={e=>setEditForm(f=>({...f,status:e.target.value}))}>
//                           <option value="pending">Pending</option>
//                           <option value="approved">Approved</option>
//                           <option value="suspended">Suspended</option>
//                         </select>
//                       </div>
//                     </div>
//                   </div>
//                 ) : (
//                   <div>
//                     <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
//                       {[
//                         { label:'📧 Email', val:selectedDoctor.email },
//                         { label:'📞 Phone', val:selectedDoctor.phone||'—' },
//                         { label:'🏥 Department', val:selectedDoctor.department||'—' },
//                         { label:'🔬 Specialization', val:selectedDoctor.specialization||'—' },
//                         { label:'🪪 License No.', val:selectedDoctor.licenseNumber||'—' },
//                         { label:'👥 Total Patients', val:selectedDoctor.totalPatients||0 },
//                         { label:'⭐ Rating', val:`${selectedDoctor.rating||4.8} / 5.0` },
//                         { label:'📅 Joined', val:new Date(selectedDoctor.createdAt).toLocaleDateString() },
//                       ].map(({label,val}) => (
//                         <div key={label} style={{ background:'#f8fafc', borderRadius:8, padding:'10px 12px' }}>
//                           <div style={{ fontSize:11, color:'#94a3b8', marginBottom:2 }}>{label}</div>
//                           <div style={{ fontSize:13, fontWeight:600, color:'#0f172a', wordBreak:'break-all' }}>{val}</div>
//                         </div>
//                       ))}
//                     </div>
//                   </div>
//                 )}
//               </div>

//               <div className="modal-footer">
//                 {editMode ? (
//                   <>
//                     <button className="btn btn-outline" onClick={() => setEditMode(false)}>Cancel</button>
//                     <button className="btn btn-primary" disabled={saving} onClick={handleSaveEdit}>
//                       {saving ? <><span className="spinner-sm" /> Saving…</> : '💾 Save Changes'}
//                     </button>
//                   </>
//                 ) : (
//                   <>
//                     {isAdmin && selectedDoctor.status==='pending' && (
//                       <button className="btn btn-primary" onClick={() => handleApprove(selectedDoctor._id)}>✓ Approve Doctor</button>
//                     )}
//                     {isAdmin && (
//                       <button className="btn btn-outline" style={{ color:'#ef4444', borderColor:'#ef4444' }} onClick={() => handleDelete(selectedDoctor._id)}>🗑 Remove</button>
//                     )}
//                     <button className="btn btn-outline" onClick={() => {setSelectedDoctor(null);setEditMode(false);}}>Close</button>
//                   </>
//                 )}
//               </div>
//             </motion.div>
//           </div>
//         )}
//       </AnimatePresence>

//       {/* Add Doctor Info Modal */}
//       {showAddModal && (
//         <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)setShowAddModal(false);}}>
//           <motion.div className="modal-box" initial={{ opacity:0,y:20 }} animate={{ opacity:1,y:0 }}>
//             <div className="modal-header">
//               <span className="modal-title">➕ Add Doctor</span>
//               <button className="btn btn-ghost btn-icon" onClick={() => setShowAddModal(false)}>✕</button>
//             </div>
//             <div className="modal-body">
//               <div style={{ background:'#f0f4ff', borderRadius:10, padding:20, textAlign:'center', color:'#1e40af' }}>
//                 <div style={{ fontSize:40, marginBottom:10 }}>👨‍⚕️</div>
//                 <div style={{ fontWeight:700, marginBottom:6, fontSize:15 }}>Doctors self-register via the Registration page</div>
//                 <div style={{ fontSize:13, color:'#64748b' }}>Ask the doctor to register at <strong>/register</strong>. Once registered, you can approve them from this page or the User Approval section.</div>
//               </div>
//             </div>
//             <div className="modal-footer">
//               <button className="btn btn-primary" onClick={() => setShowAddModal(false)}>Got it</button>
//             </div>
//           </motion.div>
//         </div>
//       )}
//     </div>
//   );
// }


import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usersAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import DoctorProfileCard from '../components/DoctorProfileCard';

export default function DoctorsPage() {
  const { user } = useAuth();
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('All');

  const DEPT_COLORS = {
    Cardiology:'#ef4444', Neurology:'#8b5cf6', Pediatrics:'#f59e0b', Psychiatry:'#ec4899',
    Dermatology:'#10b981', Orthopedics:'#3b82f6', Oncology:'#f97316', Surgery:'#6366f1',
    'General Medicine':'#0891b2', Gynecology:'#db2777', Radiology:'#64748b', ENT:'#84cc16',
  };

  const SPECIALIZATIONS = Object.keys(DEPT_COLORS);

  const load = () => {
    setLoading(true);
    usersAPI.getAll({ role:'doctor' })
      .then(r => { setDoctors(r.data.data||[]); setLoading(false); })
      .catch(() => { toast.error('Failed to load doctors'); setLoading(false); });
  };

  useEffect(() => { load(); }, []);

  const depts = ['All', ...new Set(doctors.map(d => d.department).filter(Boolean))];

  const handleViewProfile = async (doc) => {
    try {
      const res = await usersAPI.getOne(doc._id);
      setSelectedDoctor(res.data.data || doc);
      setEditForm(res.data.data || doc);
    } catch {
      setSelectedDoctor(doc);
      setEditForm(doc);
    }
    setEditMode(false);
  };

  const handleApprove = async (id) => {
    try { await usersAPI.approve(id); toast.success('Doctor approved!'); load(); if(selectedDoctor?._id===id) setSelectedDoctor(d=>({...d,status:'approved'})); }
    catch { toast.error('Failed to approve'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this doctor?')) return;
    try { await usersAPI.delete(id); toast.success('Doctor removed'); setSelectedDoctor(null); load(); }
    catch(err) { toast.error(err.response?.data?.error||'Delete failed'); }
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      const res = await usersAPI.update(selectedDoctor._id, { name:editForm.name, phone:editForm.phone, department:editForm.department, specialization:editForm.specialization, licenseNumber:editForm.licenseNumber, status:editForm.status });
      toast.success('Profile updated!');
      setSelectedDoctor(res.data.data);
      setEditMode(false);
      load();
    } catch(err) { toast.error(err.response?.data?.error||'Update failed'); }
    setSaving(false);
  };

  const isAdmin = user?.role === 'admin';

  const filtered = doctors.filter(d => {
    const matchSearch = d.name?.toLowerCase().includes(search.toLowerCase()) || d.department?.toLowerCase().includes(search.toLowerCase()) || d.specialization?.toLowerCase().includes(search.toLowerCase());
    const matchDept = filterDept==='All' || d.department===filterDept;
    return matchSearch && matchDept;
  });

  const statusStyle = (s) => ({
    bg: s==='approved'?'#dcfce7':s==='pending'?'#fef3c7':'#fee2e2',
    color: s==='approved'?'#15803d':s==='pending'?'#92400e':'#dc2626',
  });

  return (
    <div style={{ fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');`}</style>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:10 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:800, color:'#0f172a', margin:0 }}>⚕️ Doctors Directory</h1>
          <p style={{ color:'#94a3b8', fontSize:13, marginTop:3 }}>{doctors.length} doctors · Click any card to view full profile</p>
        </div>
        <input style={{ padding:'9px 14px', border:'1.5px solid #e2e8f0', borderRadius:12, fontSize:13, outline:'none', background:'#fff', width:220, fontFamily:'inherit' }}
          placeholder="🔍  Search doctors…" value={search} onChange={e=>setSearch(e.target.value)} />
      </div>

      {/* Department filter pills */}
      <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:20 }}>
        {depts.map(d => (
          <button key={d} onClick={() => setFilterDept(d)}
            style={{ padding:'5px 14px', borderRadius:20, border:`1.5px solid ${filterDept===d?(DEPT_COLORS[d]||'#2563eb'):'#e2e8f0'}`, background: filterDept===d?(DEPT_COLORS[d]||'#2563eb'):'#fff', color:filterDept===d?'#fff':'#64748b', fontFamily:'inherit', fontSize:12, fontWeight:600, cursor:'pointer', transition:'all .18s' }}>
            {d}
          </button>
        ))}
      </div>

      {/* Grid */}
      {loading
        ? <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:14 }}>
            {Array(8).fill(0).map((_,i)=><div key={i} style={{ height:240, background:'#f1f5f9', borderRadius:16, animation:'pulse 1.5s ease-in-out infinite alternate' }} />)}
          </div>
        : filtered.length===0
          ? <div style={{ textAlign:'center', padding:64, color:'#94a3b8' }}>
              <div style={{ fontSize:48,marginBottom:12 }}>🔍</div>
              <div style={{ fontWeight:700 }}>No doctors found</div>
            </div>
          : <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:14 }}>
              {filtered.map((d,i) => {
                const dc = DEPT_COLORS[d.department]||'#2563eb';
                const ss = statusStyle(d.status);
                const initials = d.name?.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase();
                return (
                  <motion.div key={d._id} initial={{ opacity:0,y:14 }} animate={{ opacity:1,y:0 }} transition={{ delay:i*.05 }}
                    onClick={() => handleViewProfile(d)}
                    style={{ background:'#fff', border:'1.5px solid #e8edf3', borderRadius:16, overflow:'hidden', cursor:'pointer', transition:'all .2s', position:'relative' }}
                    onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-4px)';e.currentTarget.style.boxShadow=`0 12px 32px ${dc}20`;e.currentTarget.style.borderColor=dc+'50';}}
                    onMouseLeave={e=>{e.currentTarget.style.transform='none';e.currentTarget.style.boxShadow='none';e.currentTarget.style.borderColor='#e8edf3';}}
                  >
                    {/* Top color bar */}
                    <div style={{ height:4, background:`linear-gradient(90deg,${dc},${dc}80)` }} />

                    <div style={{ padding:'18px 16px' }}>
                      {/* Avatar + Status */}
                      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:12 }}>
                        <div style={{ width:56, height:56, borderRadius:14, background:`linear-gradient(135deg,${dc},${dc}99)`, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:800, fontSize:18 }}>{initials}</div>
                        <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4 }}>
                          <span style={{ padding:'3px 8px', borderRadius:20, fontSize:10, fontWeight:700, background:ss.bg, color:ss.color }}>{d.status}</span>
                          {d.isOnline && <div style={{ width:8, height:8, borderRadius:'50%', background:'#22c55e' }} />}
                        </div>
                      </div>

                      <div style={{ fontWeight:800, fontSize:14, color:'#0f172a', marginBottom:2 }}>Dr. {d.name}</div>
                      <div style={{ fontSize:12, color:dc, fontWeight:700, marginBottom:3 }}>{d.specialization||d.department||'—'}</div>
                      <div style={{ fontSize:11.5, color:'#94a3b8', marginBottom:10 }}>{d.department} Dept</div>

                      {/* Stats row — real numbers only (see realStats, computed
                          server-side from actual appointments). No rating shown
                          here since this app doesn't have a review system yet. */}
                      <div style={{ display:'flex', gap:8, marginBottom:10 }}>
                        <div style={{ flex:1, background:'#f8fafc', borderRadius:9, padding:'6px 8px', textAlign:'center' }}>
                          <div style={{ fontSize:13, fontWeight:800, color:'#0f172a' }}>{d.realStats?.totalPatients ?? '—'}</div>
                          <div style={{ fontSize:9.5, color:'#94a3b8' }}>Patients Seen</div>
                        </div>
                        <div style={{ flex:1, background:'#f8fafc', borderRadius:9, padding:'6px 8px', textAlign:'center' }}>
                          <div style={{ fontSize:13, fontWeight:800, color:dc }}>{typeof d.rating==='number' ? `★${d.rating}` : '—'}</div>
                          <div style={{ fontSize:9.5, color:'#94a3b8' }}>{typeof d.rating==='number' ? 'Rating' : 'No reviews'}</div>
                        </div>
                      </div>

                      {/* ID badge */}
                      <div style={{ background:'#f1f5f9', borderRadius:8, padding:'4px 8px', marginBottom:10, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                        <span style={{ fontSize:9.5, color:'#94a3b8', fontWeight:600 }}>DOCTOR ID</span>
                        <span style={{ fontSize:10.5, fontFamily:'monospace', fontWeight:700, color:'#334155' }}>{d._id?.slice(-8)?.toUpperCase()}</span>
                      </div>

                      <button style={{ width:'100%', padding:'9px', borderRadius:10, border:`1.5px solid ${dc}30`, background:`${dc}08`, color:dc, fontFamily:'inherit', fontWeight:700, fontSize:12, cursor:'pointer', transition:'all .18s' }}
                        onMouseEnter={e=>{e.currentTarget.style.background=dc;e.currentTarget.style.color='#fff';}}
                        onMouseLeave={e=>{e.currentTarget.style.background=`${dc}08`;e.currentTarget.style.color=dc;}}>
                        View Full Profile →
                      </button>

                      {isAdmin && d.status==='pending' && (
                        <button onClick={e=>{e.stopPropagation();handleApprove(d._id);}}
                          style={{ width:'100%', marginTop:6, padding:'8px', borderRadius:10, border:'none', background:'#059669', color:'#fff', fontFamily:'inherit', fontWeight:700, fontSize:12, cursor:'pointer' }}>
                          ✓ Approve
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
      }

      {/* ── Full Doctor Profile Modal ── */}
      <AnimatePresence>
        {selectedDoctor && (
          <div onClick={e=>{if(e.target===e.currentTarget){setSelectedDoctor(null);setEditMode(false);}}}
            style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.55)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', padding:'20px', zIndex:1000, overflowY:'auto' }}>
            <motion.div initial={{ opacity:0,y:24,scale:.96 }} animate={{ opacity:1,y:0,scale:1 }} exit={{ opacity:0,y:24,scale:.96 }} transition={{ duration:.3 }}>
              <div style={{ position:'relative' }}>
                {/* Close button */}
                <button onClick={()=>{setSelectedDoctor(null);setEditMode(false);}}
                  style={{ position:'absolute', top:-14, right:-14, width:32, height:32, borderRadius:'50%', background:'#fff', border:'none', cursor:'pointer', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 14px rgba(0,0,0,.2)', zIndex:10 }}>✕</button>

                {/* Admin edit controls */}
                {isAdmin && !editMode && (
                  <div style={{ position:'absolute', top:-14, right:26, display:'flex', gap:6, zIndex:10 }}>
                    <button onClick={()=>setEditMode(true)}
                      style={{ padding:'5px 14px', borderRadius:20, background:'#2563eb', color:'#fff', border:'none', fontFamily:'inherit', fontWeight:700, fontSize:11, cursor:'pointer', boxShadow:'0 4px 12px #2563eb40' }}>✏️ Edit</button>
                    <button onClick={()=>handleDelete(selectedDoctor._id)}
                      style={{ padding:'5px 14px', borderRadius:20, background:'#ef4444', color:'#fff', border:'none', fontFamily:'inherit', fontWeight:700, fontSize:11, cursor:'pointer', boxShadow:'0 4px 12px #ef444440' }}>🗑 Remove</button>
                  </div>
                )}

                {editMode ? (
                  /* Edit form */
                  <div style={{ background:'#fff', borderRadius:20, padding:'28px', maxWidth:480, width:'100%', boxShadow:'0 24px 60px rgba(0,0,0,.2)' }}>
                    <div style={{ fontWeight:800, fontSize:18, color:'#0f172a', marginBottom:20 }}>✏️ Edit Doctor Profile</div>
                    {[
                      { label:'Full Name', key:'name', type:'text' },
                      { label:'Phone', key:'phone', type:'text' },
                      { label:'Department', key:'department', type:'text' },
                      { label:'License No.', key:'licenseNumber', type:'text' },
                    ].map(f => (
                      <div key={f.key} style={{ marginBottom:14 }}>
                        <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#374151', letterSpacing:.5, textTransform:'uppercase', marginBottom:5 }}>{f.label}</label>
                        <input type={f.type} value={editForm[f.key]||''} onChange={e=>setEditForm(ef=>({...ef,[f.key]:e.target.value}))}
                          style={{ width:'100%', padding:'10px 14px', border:'1.5px solid #e2e8f0', borderRadius:10, fontFamily:'inherit', fontSize:13.5, outline:'none', boxSizing:'border-box' }} />
                      </div>
                    ))}
                    <div style={{ marginBottom:16 }}>
                      <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#374151', letterSpacing:.5, textTransform:'uppercase', marginBottom:5 }}>Specialization</label>
                      <select value={editForm.specialization||''} onChange={e=>setEditForm(ef=>({...ef,specialization:e.target.value}))}
                        style={{ width:'100%', padding:'10px 14px', border:'1.5px solid #e2e8f0', borderRadius:10, fontFamily:'inherit', fontSize:13.5, outline:'none', background:'#fff', boxSizing:'border-box' }}>
                        <option value="">Select…</option>
                        {SPECIALIZATIONS.map(s=><option key={s}>{s}</option>)}
                      </select>
                    </div>
                    <div style={{ marginBottom:20 }}>
                      <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#374151', letterSpacing:.5, textTransform:'uppercase', marginBottom:5 }}>Status</label>
                      <select value={editForm.status||''} onChange={e=>setEditForm(ef=>({...ef,status:e.target.value}))}
                        style={{ width:'100%', padding:'10px 14px', border:'1.5px solid #e2e8f0', borderRadius:10, fontFamily:'inherit', fontSize:13.5, outline:'none', background:'#fff', boxSizing:'border-box' }}>
                        {['pending','approved','suspended'].map(s=><option key={s}>{s}</option>)}
                      </select>
                    </div>
                    <div style={{ display:'flex', gap:10 }}>
                      <button onClick={()=>setEditMode(false)} style={{ flex:1, padding:'11px', borderRadius:12, border:'1.5px solid #e2e8f0', background:'#fff', fontFamily:'inherit', fontWeight:700, fontSize:13.5, cursor:'pointer' }}>Cancel</button>
                      <button onClick={handleSaveEdit} disabled={saving} style={{ flex:2, padding:'11px', borderRadius:12, border:'none', background:'#2563eb', color:'#fff', fontFamily:'inherit', fontWeight:700, fontSize:13.5, cursor:'pointer' }}>
                        {saving?'Saving…':'💾 Save Changes'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <DoctorProfileCard doctor={selectedDoctor} onClose={()=>setSelectedDoctor(null)} />
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
