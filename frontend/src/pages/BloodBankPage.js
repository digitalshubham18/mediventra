import React, { useState, useEffect } from 'react';
import { bloodBankAPI, hospitalConfigAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const STATUS_CFG = {
  requested: { label:'Requested', c:'#d97706', bg:'#fef3c7' },
  scheduled: { label:'Scheduled', c:'#2563eb', bg:'#eff6ff' },
  completed: { label:'Completed', c:'#059669', bg:'#f0fdf4' },
  cancelled: { label:'Cancelled', c:'#64748b', bg:'#f8fafc' },
  rejected:  { label:'Rejected',  c:'#dc2626', bg:'#fef2f2' },
};

function InventoryPanel({ inventory, onChange, canEdit }) {
  const [editing, setEditing] = useState(null);
  const [value, setValue] = useState('');

  const save = async (bloodGroup) => {
    try {
      await bloodBankAPI.updateInventory(bloodGroup, Number(value));
      toast.success('Stock updated');
      setEditing(null);
      onChange();
    } catch { toast.error('Failed to update'); }
  };

  return (
    <div className="card" style={{ marginBottom:22 }}>
      <div className="card-header"><span className="card-title">🩸 Blood Stock Inventory</span></div>
      <div className="card-body">
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(120px,1fr))', gap:12 }}>
          {inventory.map(inv => (
            <div key={inv.bloodGroup} style={{ textAlign:'center', padding:'14px 8px', borderRadius:12, background: inv.units < 5 ? '#fef2f2' : '#f8fafc', border:`1px solid ${inv.units<5?'#fecaca':'#eef2f7'}` }}>
              <div style={{ fontSize:20, fontWeight:800, color:'#7a1f2b' }}>{inv.bloodGroup}</div>
              {editing === inv.bloodGroup ? (
                <div style={{ marginTop:6, display:'flex', gap:4, justifyContent:'center' }}>
                  <input type="number" min="0" autoFocus value={value} onChange={e=>setValue(e.target.value)}
                    style={{ width:50, padding:'4px', borderRadius:6, border:'1px solid #cbd5e1', textAlign:'center', fontSize:13 }} />
                  <button onClick={()=>save(inv.bloodGroup)} style={{ background:'#059669', color:'#fff', border:'none', borderRadius:6, padding:'0 8px', cursor:'pointer' }}>✓</button>
                </div>
              ) : (
                <>
                  <div style={{ fontSize:16, fontWeight:700, color: inv.units<5?'#dc2626':'#0f172a', marginTop:4 }}>{inv.units} units</div>
                  {canEdit && <button onClick={()=>{ setEditing(inv.bloodGroup); setValue(String(inv.units)); }} style={{ fontSize:10.5, color:'#2563eb', background:'none', border:'none', cursor:'pointer', marginTop:4 }}>Edit</button>}
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CertificateSettingsPanel() {
  const [config, setConfig] = useState(null);
  const [form, setForm] = useState({ hospitalName:'', signatoryName:'', signatoryTitle:'' });
  const [signatureFile, setSignatureFile] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    hospitalConfigAPI.get().then(res => {
      const c = res.data.data;
      setConfig(c);
      setForm({ hospitalName: c.hospitalName || '', signatoryName: c.signatoryName || '', signatoryTitle: c.signatoryTitle || '' });
    }).catch(()=>{});
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const data = { ...form };
      if (signatureFile) data.signature = signatureFile;
      const fd = new FormData();
      Object.entries(data).forEach(([k,v]) => fd.append(k, v));
      const res = await hospitalConfigAPI.update(fd);
      setConfig(res.data.data);
      toast.success('Certificate settings saved');
    } catch { toast.error('Failed to save'); }
    setSaving(false);
  };

  if (!config) return null;

  return (
    <div className="card" style={{ marginBottom:22 }}>
      <div className="card-header"><span className="card-title">📜 Certificate Settings</span></div>
      <div className="card-body">
        <div style={{ fontSize:12, color:'#94a3b8', marginBottom:16 }}>These details appear on every donor's blood donation certificate.</div>
        <form onSubmit={submit}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
            <div className="form-group"><label className="form-label">Hospital Name</label><input className="form-input" value={form.hospitalName} onChange={e=>setForm(f=>({...f,hospitalName:e.target.value}))} /></div>
            <div className="form-group"><label className="form-label">Signatory Name</label><input className="form-input" value={form.signatoryName} onChange={e=>setForm(f=>({...f,signatoryName:e.target.value}))} placeholder="e.g. Dr. Shubham Kumar" /></div>
            <div className="form-group"><label className="form-label">Signatory Title</label><input className="form-input" value={form.signatoryTitle} onChange={e=>setForm(f=>({...f,signatoryTitle:e.target.value}))} placeholder="e.g. Chief Medical Officer" /></div>
            <div className="form-group">
              <label className="form-label">Signature Image (PNG, transparent background recommended)</label>
              <input type="file" accept="image/*" className="form-input" onChange={e=>setSignatureFile(e.target.files?.[0]||null)} />
              {config.signatureUrl && <div style={{ fontSize:11, color:'#059669', marginTop:4 }}>✓ Signature already uploaded</div>}
            </div>
          </div>
          <button type="submit" className="btn btn-primary" disabled={saving} style={{marginTop:10}}>{saving?'Saving…':'Save Certificate Settings'}</button>
        </form>
      </div>
    </div>
  );
}

export default function BloodBankPage() {
  const { user } = useAuth();
  const [inventory, setInventory] = useState([]);
  const [donations, setDonations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('requested');

  // Schedule modal — staff must pick an exact date AND time; this is what
  // gets shown to, and notified to, the patient.
  const [scheduleTarget, setScheduleTarget] = useState(null); // donation object
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [scheduling, setScheduling] = useState(false);
  // Shown when the picked date doesn't match what the patient requested.
  const [mismatchConfirm, setMismatchConfirm] = useState(null); // { message } | null

  const load = () => {
    setLoading(true);
    Promise.all([bloodBankAPI.getInventory(), bloodBankAPI.getAllDonations()])
      .then(([inv, don]) => { setInventory(inv.data.data || []); setDonations(don.data.data || []); })
      .catch(()=>{}).finally(()=>setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const openSchedule = (d) => {
    setScheduleTarget(d);
    setScheduleDate(new Date(d.preferredDate).toISOString().slice(0,10));
    setScheduleTime('10:00');
    setMismatchConfirm(null);
  };

  const submitSchedule = async (confirmDateMismatch=false) => {
    if (!scheduleDate || !scheduleTime) { toast.error('Please pick both a date and a time'); return; }
    setScheduling(true);
    try {
      const iso = new Date(`${scheduleDate}T${scheduleTime}:00`).toISOString();
      await bloodBankAPI.updateStatus(scheduleTarget._id, 'scheduled', null, { scheduledDate: iso, confirmDateMismatch });
      toast.success('🩸 Scheduled — the patient has been notified');
      setScheduleTarget(null); setMismatchConfirm(null);
      load();
    } catch (err) {
      const data = err.response?.data;
      if (data?.requiresConfirmation) setMismatchConfirm({ message: data.error });
      else toast.error(data?.error || 'Failed to schedule');
    }
    setScheduling(false);
  };

  const reject = async (id) => {
    const reason = window.prompt('Reason for rejecting this donation request:');
    if (reason === null) return;
    try { await bloodBankAPI.updateStatus(id, 'rejected', reason); toast.success('Rejected'); load(); } catch { toast.error('Failed'); }
  };
  const complete = async (id) => {
    const units = window.prompt('How many units were collected?', '1');
    if (!units) return;
    try { await bloodBankAPI.complete(id, Number(units)); toast.success('🎉 Donation recorded — certificate generated!'); load(); } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
  };

  const filtered = donations.filter(d => filter==='all' || d.status===filter);

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">🩸 Blood Bank Management</div>
          <div className="page-subtitle">Stock levels and the donor request pipeline — request → schedule → complete → certificate</div>
        </div>
        <button className="btn btn-outline" onClick={load}>🔄 Refresh</button>
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:60, color:'#94a3b8' }}>Loading…</div>
      ) : (
        <>
          <InventoryPanel inventory={inventory} onChange={load} canEdit={['admin','nurse','lab_technician'].includes(user?.role)} />
          {user?.role === 'admin' && <CertificateSettingsPanel />}

          <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap' }}>
            {['all','requested','scheduled','completed','cancelled','rejected'].map(s => (
              <button key={s} onClick={()=>setFilter(s)}
                style={{ padding:'6px 14px', borderRadius:18, border:'1.5px solid', borderColor:filter===s?'#2563eb':'#e2e8f0', background:filter===s?'#eff6ff':'#fff', color:filter===s?'#1d4ed8':'#64748b', fontWeight:700, fontSize:12.5, cursor:'pointer', textTransform:'capitalize' }}>
                {s}
              </button>
            ))}
          </div>

          <div className="card">
            <div className="card-body">
              {filtered.length === 0 ? (
                <div style={{ textAlign:'center', padding:20, color:'#94a3b8', fontSize:13 }}>No donation requests {filter!=='all'?`with status "${filter}"`:''}.</div>
              ) : filtered.map(d => {
                const cfg = STATUS_CFG[d.status];
                const isRelative = d.donorType === 'other' && d.relative;
                const donorLabel = isRelative ? `${d.relative.name} (${d.relative.relation})` : d.donor?.name;
                return (
                  <div key={d._id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'13px 16px', background:cfg.bg, borderRadius:10, marginBottom:8, flexWrap:'wrap', gap:10 }}>
                    <div>
                      <div style={{ fontWeight:700, fontSize:13.5 }}>{donorLabel} — {d.bloodGroup}</div>
                      {isRelative && (
                        <div style={{ fontSize:11, color:'#7a1f2b', marginTop:2 }}>
                          Registered by {d.donor?.name} · Donor phone: {d.relative.phone}
                          {d.relative.idProofType && ` · ${d.relative.idProofType.toUpperCase()}: ${d.relative.idProofNumber || '—'}`}
                        </div>
                      )}
                      <div style={{ fontSize:11.5, color:'#64748b', marginTop:2 }}>
                        Preferred: {new Date(d.preferredDate).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}
                        {d.contactPhone && ` · ${d.contactPhone}`}
                      </div>
                      {d.notes && <div style={{ fontSize:11, color:'#94a3b8', marginTop:2 }}>{d.notes}</div>}
                      {d.status==='scheduled' && d.scheduledDate && (
                        <div style={{ fontSize:11.5, color:'#2563eb', marginTop:2, fontWeight:700 }}>
                          📅 Scheduled: {new Date(d.scheduledDate).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})} at {new Date(d.scheduledDate).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}
                        </div>
                      )}
                      {d.eligibility?.warnings?.length > 0 && (
                        <div style={{ fontSize:10.5, color:'#b45309', marginTop:3 }}>⚠️ {d.eligibility.warnings.join(' · ')}</div>
                      )}
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ fontSize:11, fontWeight:800, color:cfg.c }}>{cfg.label}</span>
                      {d.status==='requested' && (<>
                        <button className="btn btn-primary btn-xs" onClick={()=>openSchedule(d)}>Schedule</button>
                        <button className="btn btn-danger btn-xs" onClick={()=>reject(d._id)}>Reject</button>
                      </>)}
                      {d.status==='scheduled' && (
                        <button className="btn btn-primary btn-xs" onClick={()=>complete(d._id)}>✓ Mark Completed</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {scheduleTarget && (
        <div className="modal-overlay" onClick={e=>{ if(e.target===e.currentTarget){ setScheduleTarget(null); setMismatchConfirm(null); } }}>
          <div className="modal-box" style={{ maxWidth:380 }}>
            <div className="modal-header">
              <span className="modal-title">📅 Schedule Donation</span>
              <button className="btn btn-ghost btn-icon" onClick={()=>{ setScheduleTarget(null); setMismatchConfirm(null); }}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ fontSize:12.5, color:'#64748b', marginBottom:12 }}>
                Donor: <strong>{scheduleTarget.donorType==='other' ? scheduleTarget.relative?.name : scheduleTarget.donor?.name}</strong> · {scheduleTarget.bloodGroup}<br/>
                Patient requested: {new Date(scheduleTarget.preferredDate).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}
              </div>
              <div className="form-group"><label className="form-label">Date *</label><input type="date" className="form-input" value={scheduleDate} onChange={e=>setScheduleDate(e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Time *</label><input type="time" className="form-input" value={scheduleTime} onChange={e=>setScheduleTime(e.target.value)} /></div>
              <div style={{ fontSize:11, color:'#94a3b8' }}>The patient will be notified immediately with this exact date and time.</div>

              {mismatchConfirm && (
                <div style={{ marginTop:12, padding:'10px 12px', background:'#fffbeb', border:'1px solid #fde68a', borderRadius:8 }}>
                  <div style={{ fontSize:12.5, color:'#92400e', fontWeight:600, marginBottom:8 }}>{mismatchConfirm.message}</div>
                  <button className="btn btn-primary btn-xs" disabled={scheduling} onClick={()=>submitSchedule(true)}>Yes, schedule anyway</button>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={()=>{ setScheduleTarget(null); setMismatchConfirm(null); }}>Cancel</button>
              {!mismatchConfirm && <button className="btn btn-primary" disabled={scheduling} onClick={()=>submitSchedule(false)}>{scheduling?'Scheduling…':'Confirm Schedule'}</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
