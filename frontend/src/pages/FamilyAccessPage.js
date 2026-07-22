import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { familyAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

// Family Access — modeled after how real hospital patient portals (e.g.
// Tata Main Hospital's) handle dependent profiles: a family member gets
// their OWN account (not a fake sub-profile), it goes through the same
// admin approval every new patient account requires, and once approved
// the primary account holder can jump straight into managing it without
// re-entering separate credentials each time.
export default function FamilyAccessPage() {
  const { loginWithOAuthToken } = useAuth();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [switchingId, setSwitchingId] = useState(null);
  const [form, setForm] = useState({
    name:'', relation:'Child', age:'', gender:'', bloodGroup:'', phone:'', email:'', address:'', allergies:'',
  });

  const load = () => {
    setLoading(true);
    familyAPI.getMine().then(res => setMembers(res.data.data || [])).catch(()=>toast.error('Failed to load')).finally(()=>setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const resetForm = () => setForm({ name:'', relation:'Child', age:'', gender:'', bloodGroup:'', phone:'', email:'', address:'', allergies:'' });

  const submit = async (e) => {
    e.preventDefault();
    const required = ['name','relation','age','gender','bloodGroup','phone','email','address'];
    const missing = required.filter(k => !form[k] || !String(form[k]).trim());
    if (missing.length) { toast.error(`Please fill in: ${missing.join(', ')}`); return; }
    setSaving(true);
    try {
      await familyAPI.add({ ...form, allergies: form.allergies ? form.allergies.split(',').map(a=>a.trim()).filter(Boolean) : [] });
      toast.success(`✅ ${form.name} added — pending admin approval before you can log in as them.`);
      setShowAdd(false);
      resetForm();
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to add family member'); }
    setSaving(false);
  };

  const remove = async (linkId, name) => {
    if (!window.confirm(`Remove ${name} from your account? (Their own records stay intact.)`)) return;
    try { await familyAPI.remove(linkId); toast.success('Removed'); load(); }
    catch { toast.error('Failed to remove'); }
  };

  // "Login as" — switches the browser session into the dependent's own
  // account, the same way a real hospital lets a parent/guardian manage
  // a child's portal once the hospital has approved the linkage.
  const loginAs = async (link) => {
    if (link.dependent?.status !== 'approved') { toast.error('This family member is still pending admin approval'); return; }
    setSwitchingId(link._id);
    try {
      const res = await familyAPI.loginAs(link._id);
      await loginWithOAuthToken(res.data.token);
      toast.success(`Now viewing as ${link.dependent.name}`);
      window.location.href = '/dashboard';
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to switch accounts'); }
    setSwitchingId(null);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">👨‍👩‍👧 Family Access</div>
          <div className="page-subtitle">Manage health records for a child or elderly relative — each gets their own account, approved by the hospital before you can log in as them.</div>
        </div>
        <button className="btn btn-primary" onClick={()=>setShowAdd(true)}>+ Add Family Member</button>
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:60, color:'#94a3b8' }}>Loading…</div>
      ) : members.length === 0 ? (
        <div style={{ textAlign:'center', padding:60, color:'#94a3b8' }}>
          <div style={{ fontSize:40, marginBottom:10 }}>👨‍👩‍👧</div>
          No family members added yet.
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:14 }}>
          {members.map(link => (
            <div key={link._id} className="card" style={{ padding:18 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <div>
                  <div style={{ fontWeight:800, fontSize:15, color:'#0f172a' }}>{link.dependent?.name}</div>
                  <div style={{ fontSize:12, color:'#64748b', marginTop:2 }}>{link.relation}{link.dependent?.age?` · ${link.dependent.age}y`:''}{link.dependent?.gender?` · ${link.dependent.gender}`:''}</div>
                </div>
                <span className={`badge ${link.dependent?.status==='approved'?'badge-success':'badge-warning'}`}>
                  {link.dependent?.status==='approved' ? '✅ Approved' : '⏳ Pending Approval'}
                </span>
              </div>
              {link.dependent?.bloodGroup && <div style={{ fontSize:12, color:'#64748b', marginTop:8 }}>🩸 {link.dependent.bloodGroup}</div>}
              <div style={{ display:'flex', gap:8, marginTop:14 }}>
                <button className="btn btn-primary btn-sm" style={{flex:1}} disabled={link.dependent?.status!=='approved' || switchingId===link._id} onClick={()=>loginAs(link)}>
                  {switchingId===link._id ? 'Switching…' : '🔓 Login as'}
                </button>
                <button className="btn btn-outline btn-sm" onClick={()=>remove(link._id, link.dependent?.name)}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {showAdd && (
          <div className="modal-overlay" onClick={e=>{ if(e.target===e.currentTarget) setShowAdd(false); }}>
            <motion.div className="modal-box" style={{ maxWidth:480 }} initial={{ opacity:0,y:20,scale:.97 }} animate={{ opacity:1,y:0,scale:1 }}>
              <div className="modal-header"><span className="modal-title">Add Family Member</span><button className="btn btn-ghost btn-icon" onClick={()=>setShowAdd(false)}>✕</button></div>
              <form onSubmit={submit}>
                <div className="modal-body" style={{ maxHeight:'65vh', overflowY:'auto' }}>
                  <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:10, padding:'9px 13px', marginBottom:16, fontSize:12, color:'#1d4ed8' }}>
                    ℹ️ This creates a real account for them with their own email and phone. An admin must approve it before you can log in as them — same as any new patient signup.
                  </div>
                  <div className="form-group"><label className="form-label">Full Name *</label><input className="form-input" required value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} /></div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                    <div className="form-group"><label className="form-label">Relation *</label>
                      <select className="form-input" value={form.relation} onChange={e=>setForm(f=>({...f,relation:e.target.value}))}>
                        {['Child','Parent','Spouse','Grandparent','Sibling','Other'].map(r=><option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    <div className="form-group"><label className="form-label">Age *</label><input type="number" required className="form-input" value={form.age} onChange={e=>setForm(f=>({...f,age:e.target.value}))} /></div>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                    <div className="form-group"><label className="form-label">Gender *</label>
                      <select className="form-input" required value={form.gender} onChange={e=>setForm(f=>({...f,gender:e.target.value}))}>
                        <option value="">— Select —</option><option>Male</option><option>Female</option><option>Other</option>
                      </select>
                    </div>
                    <div className="form-group"><label className="form-label">Blood Group *</label>
                      <select className="form-input" required value={form.bloodGroup} onChange={e=>setForm(f=>({...f,bloodGroup:e.target.value}))}>
                        <option value="">— Select —</option>{['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(b=><option key={b}>{b}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                    <div className="form-group"><label className="form-label">Phone *</label><input className="form-input" required value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} placeholder="+91-XXXXXXXXXX" /></div>
                    <div className="form-group"><label className="form-label">Email *</label><input type="email" className="form-input" required value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} placeholder="their-email@example.com" /></div>
                  </div>
                  <div className="form-group"><label className="form-label">Address *</label><input className="form-input" required value={form.address} onChange={e=>setForm(f=>({...f,address:e.target.value}))} /></div>
                  <div className="form-group"><label className="form-label">Known Allergies</label><input className="form-input" value={form.allergies} onChange={e=>setForm(f=>({...f,allergies:e.target.value}))} placeholder="Comma-separated, e.g. Penicillin, Peanuts" /></div>
                </div>
                <div className="modal-footer"><button type="button" className="btn btn-outline" onClick={()=>setShowAdd(false)}>Cancel</button><button type="submit" className="btn btn-primary" disabled={saving}>{saving?'Adding…':'Add for Approval'}</button></div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
