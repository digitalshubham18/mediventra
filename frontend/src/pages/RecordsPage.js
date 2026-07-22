import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { recordsAPI, usersAPI, getFileUrl, healthSummaryAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { getSocket } from '../utils/socket';
import toast from 'react-hot-toast';

export default function RecordsPage() {
  const { user } = useAuth();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [viewRecord, setViewRecord] = useState(null);
  const [patients, setPatients] = useState([]);
  const [form, setForm] = useState({ patient: '', type: 'lab_report', title: '', notes: '', file: null });
  const [uploading, setUploading] = useState(false);
  const [downloadingSummary, setDownloadingSummary] = useState(false);

  const downloadHealthSummary = async (patientId) => {
    setDownloadingSummary(true);
    try {
      const res = await healthSummaryAPI.downloadBlob(patientId);
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      window.open(url, '_blank');
    } catch { toast.error('Failed to generate health summary'); }
    setDownloadingSummary(false);
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await recordsAPI.getAll();
      setRecords(res.data.data || []);
      if (['admin','doctor','nurse'].includes(user?.role)) {
        const pRes = await usersAPI.getAll({ role: 'patient', status: 'approved' });
        setPatients(pRes.data.data || []);
        if (pRes.data.data?.length) setForm(f => ({ ...f, patient: pRes.data.data[0]._id }));
      }
    } catch { toast.error('Failed to load records'); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  // Admin-only: permanently remove a lab report (and its attached photos)
  // from the system — e.g. duplicate/erroneous uploads.
  const handleDeleteRecord = async (r) => {
    if (!window.confirm(`Delete this ${r.type?.replace('_',' ')} for ${r.patient?.name}? This cannot be undone.`)) return;
    try {
      await recordsAPI.delete(r._id);
      toast.success('Report deleted');
      setRecords(prev => prev.filter(x => x._id !== r._id));
      if (viewRecord?._id === r._id) setViewRecord(null);
    } catch (e) { toast.error(e.response?.data?.error || 'Delete failed'); }
  };

  // Live-update: once the lab finishes testing and marks a report
  // completed/abnormal, this page refreshes automatically instead of the
  // patient/doctor needing to manually reload to see the result.
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onReady = (data) => {
      toast(data.isAbnormal ? `⚠️ Lab report ready: ${data.title} (abnormal — please review)` : `🧪 Lab report ready: ${data.title}`, { duration: 6000 });
      load();
    };
    socket.on('lab_report_ready', onReady);
    return () => socket.off('lab_report_ready', onReady);
  }, []);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!form.title) { toast.error('Title is required'); return; }
    if (PHOTO_REQUIRED_TYPES.includes(form.type) && !form.file) {
      toast.error('Please attach a photo of the report — this is mandatory for this record type'); return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      Object.keys(form).forEach(k => { if (k !== 'file' && form[k]) fd.append(k, form[k]); });
      if (form.file) fd.append('file', form.file);
      await recordsAPI.create(fd);
      toast.success('Record uploaded successfully!');
      setShowUpload(false);
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Upload failed'); }
    setUploading(false);
  };

  const myRecords = user?.role === 'patient' ? records : records;
  const patientRecords = viewRecord ? records.filter(r => r.patient?._id === viewRecord) : [];

  const RECORD_TYPES = [
    { value:'lab_report',        label:'Lab / Blood Report' },
    { value:'xray',               label:'X-Ray' },
    { value:'ecg',                 label:'ECG' },
    { value:'mri',                 label:'MRI' },
    { value:'ct_scan',            label:'CT Scan' },
    { value:'prescription',      label:'Prescription' },
    { value:'discharge_summary', label:'Discharge Summary' },
    { value:'vaccination',       label:'Vaccination' },
    { value:'other',              label:'Other' },
  ];
  const PHOTO_REQUIRED_TYPES = ['lab_report','xray','mri','ct_scan','ecg'];

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">Health Records</div><div className="page-subtitle">Secure patient medical history & reports</div></div>
        <div style={{ display:'flex', gap:8 }}>
          {user?.role === 'patient' && (
            <button className="btn btn-outline" disabled={downloadingSummary} onClick={() => downloadHealthSummary()}>
              {downloadingSummary ? 'Preparing…' : '📄 Download Health Summary'}
            </button>
          )}
          {['admin','doctor','nurse'].includes(user?.role) && (
            <button className="btn btn-primary" onClick={() => setShowUpload(true)}>+ Upload Record</button>
          )}
        </div>
      </div>

      <div className="grid-2">
        <motion.div className="card" initial={{ opacity:0,y:14 }} animate={{ opacity:1,y:0 }}>
          <div className="card-header"><span className="card-title">📋 All Records</span></div>
          <div className="card-body-0">
            {loading ? <div style={{ padding:32,textAlign:'center' }}><div className="spinner-lg" style={{ margin:'0 auto' }} /></div> : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Patient</th><th>Type</th><th>Date</th><th>Doctor</th><th>Actions</th></tr></thead>
                  <tbody>
                    {myRecords.length === 0 ? <tr><td colSpan={5} style={{ textAlign:'center',padding:24,color:'#94a3b8' }}>No records found</td></tr>
                      : myRecords.map(r => (
                      <tr key={r._id}>
                        <td className="td-main">{r.patient?.name}</td>
                        <td><span className="badge badge-primary">{r.type}</span></td>
                        <td className="text-sm">{new Date(r.createdAt).toLocaleDateString()}</td>
                        <td className="text-sm">{r.doctor?.name}</td>
                        <td>
                          <div className="flex gap-1">
                            <button className="btn btn-primary btn-xs" onClick={() => setViewRecord(r)}>View</button>
                            {r.fileUrl && <a className="btn btn-outline btn-xs" href={`${getFileUrl(r.fileUrl)}`} target="_blank" rel="noreferrer">📥</a>}
                            {user?.role === 'admin' && <button className="btn btn-danger btn-xs" title="Delete this report" onClick={() => handleDeleteRecord(r)}>🗑️</button>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </motion.div>

        <motion.div className="card" initial={{ opacity:0,y:14 }} animate={{ opacity:1,y:0 }} transition={{ delay:0.1 }}>
          <div className="card-header"><span className="card-title">🕐 Timeline</span></div>
          <div className="card-body">
            {myRecords.length === 0 ? <div style={{ textAlign:'center',padding:20,color:'#94a3b8' }}>No records yet</div>
              : <div className="timeline">
                {myRecords.slice(0,6).map((r,i) => (
                  <motion.div key={r._id} className="timeline-item" initial={{ opacity:0,x:-12 }} animate={{ opacity:1,x:0 }} transition={{ delay:i*.08 }}>
                    <div className="timeline-date">{new Date(r.createdAt).toLocaleDateString()}</div>
                    <div className="timeline-title">{r.type} · {r.title}</div>
                    <div className="timeline-desc">{r.doctor?.name} · {r.notes?.slice(0,80)}{r.notes?.length>80?'…':''}</div>
                  </motion.div>
                ))}
              </div>
            }
          </div>
        </motion.div>
      </div>

      {/* View Record Modal */}
      {viewRecord && typeof viewRecord === 'object' && (
        <div className="modal-overlay" onClick={e => { if (e.target===e.currentTarget) setViewRecord(null); }}>
          <motion.div className="modal-box" initial={{ opacity:0,y:20 }} animate={{ opacity:1,y:0 }}>
            <div className="modal-header">
              <span className="modal-title">📋 {viewRecord.type}</span>
              <button className="btn btn-ghost btn-icon" onClick={() => setViewRecord(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ background:'#f8fafc',borderRadius:10,padding:14,marginBottom:14 }}>
                <div className="form-row">
                  <div><div className="text-xs text-muted">Patient</div><div className="fw-7">{viewRecord.patient?.name}</div></div>
                  <div><div className="text-xs text-muted">Date</div><div className="fw-7">{new Date(viewRecord.createdAt).toLocaleDateString()}</div></div>
                </div>
                <div className="form-row mt-1">
                  <div><div className="text-xs text-muted">Doctor</div><div className="fw-7">{viewRecord.doctor?.name}</div></div>
                  <div><div className="text-xs text-muted">Type</div><div className="fw-7">{viewRecord.type}</div></div>
                </div>
              </div>
              {viewRecord.notes && <div className="form-group"><label className="form-label">Clinical Notes</label><textarea className="form-input" rows={3} defaultValue={viewRecord.notes} readOnly /></div>}
              
              {/* Lab Photos — show uploaded images, attributed to whoever uploaded them */}
              {viewRecord.labPhotos?.length > 0 && (
                <div style={{ marginBottom:14 }}>
                  <label className="form-label">📸 Lab / Test Photos ({viewRecord.labPhotos.length})</label>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(120px,1fr))', gap:8, marginTop:6 }}>
                    {viewRecord.labPhotos.map((photo,i) => (
                      <div key={i}>
                        <a href={`${getFileUrl(photo.url)}`} target="_blank" rel="noreferrer"
                          style={{ display:'block', borderRadius:9, overflow:'hidden', border:'1.5px solid #e2e8f0', aspectRatio:'1', background:'#f8fafc' }}>
                          <img src={`${getFileUrl(photo.url)}`} alt={photo.filename||'Lab photo'}
                            style={{ width:'100%', height:'100%', objectFit:'cover' }}
                            onError={e=>{ e.target.style.display='none'; e.target.parentNode.innerHTML='<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:28px;">🖼️</div>'; }} />
                        </a>
                        {photo.uploadedByName && (
                          <div style={{ fontSize:10, color:'#94a3b8', marginTop:3, textAlign:'center' }}>
                            {photo.uploadedByName} · {new Date(photo.uploadedAt).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize:11, color:'#94a3b8', marginTop:5 }}>Click any photo to view full size</div>
                </div>
              )}

              {/* Update history — who updated this report, and when, every time */}
              {viewRecord.updateHistory?.length > 0 && (
                <div style={{ marginBottom:14 }}>
                  <label className="form-label">🕒 Update History ({viewRecord.updateHistory.length})</label>
                  <div style={{ maxHeight:160, overflowY:'auto', display:'flex', flexDirection:'column', gap:6 }}>
                    {[...viewRecord.updateHistory].reverse().map((h,i) => (
                      <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', background:'#f8fafc', borderRadius:8, padding:'7px 11px' }}>
                        <div>
                          <span style={{ fontWeight:700, fontSize:12.5, color:'#0f172a' }}>{h.updatedByName || 'Unknown'}</span>
                          <span style={{ fontSize:11, color:'#94a3b8', marginLeft:6, textTransform:'capitalize' }}>({h.updatedByRole?.replace('_',' ')})</span>
                          {h.status && <span style={{ fontSize:11, color:'#0891b2', marginLeft:6 }}>→ {h.status}</span>}
                        </div>
                        <span style={{ fontSize:10.5, color:'#94a3b8', flexShrink:0 }}>{new Date(h.at).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Primary file */}
              {viewRecord.fileUrl && (
                <div style={{ background:'#e8effe', borderRadius:10, padding:'12px 14px', display:'flex', alignItems:'center', gap:10 }}>
                  <span style={{ fontSize:22 }}>
                    {viewRecord.mimeType?.startsWith('image/') ? '🖼️' : '📄'}
                  </span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:700, color:'#1e40af', fontSize:13 }}>{viewRecord.fileName || 'Attached file'}</div>
                    <div style={{ fontSize:11, color:'#3b82f6' }}>Click Download to open</div>
                  </div>
                  <a className="btn btn-primary btn-xs" href={`${getFileUrl(viewRecord.fileUrl)}`} target="_blank" rel="noreferrer">📥 Open</a>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setViewRecord(null)}>Close</button>
              {user?.role === 'admin' && <button className="btn btn-danger" onClick={() => handleDeleteRecord(viewRecord)}>🗑️ Delete Report</button>}
              {['admin','doctor','nurse'].includes(user?.role) && viewRecord.patient?._id && (
                <button className="btn btn-outline" disabled={downloadingSummary} onClick={() => downloadHealthSummary(viewRecord.patient._id)}>
                  {downloadingSummary ? 'Preparing…' : `📄 ${viewRecord.patient.name}'s Health Summary`}
                </button>
              )}
              {viewRecord.fileUrl && <a className="btn btn-primary" href={`${getFileUrl(viewRecord.fileUrl)}`} target="_blank" rel="noreferrer">📥 Download File</a>}
            </div>
          </motion.div>
        </div>
      )}

      {/* Upload Modal */}
      {showUpload && (
        <div className="modal-overlay" onClick={e => { if (e.target===e.currentTarget) setShowUpload(false); }}>
          <motion.div className="modal-box" initial={{ opacity:0,y:20 }} animate={{ opacity:1,y:0 }}>
            <div className="modal-header">
              <span className="modal-title">📤 Upload Health Record</span>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowUpload(false)}>✕</button>
            </div>
            <form onSubmit={handleUpload}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Patient</label>
                    <select className="form-input" value={form.patient} onChange={e => setForm(f => ({ ...f, patient: e.target.value }))}>
                      {patients.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Record Type</label>
                    <select className="form-input" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                      {RECORD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-group"><label className="form-label">Title *</label><input className="form-input" required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Blood Report March 2025" /></div>
                <div className="form-group">
                  <label className="form-label">
                    {PHOTO_REQUIRED_TYPES.includes(form.type) ? 'Photo of the Report *' : 'Attach File (optional)'}
                  </label>
                  <div style={{ border:`2px dashed ${PHOTO_REQUIRED_TYPES.includes(form.type) && !form.file ? '#fca5a5' : '#cbd5e1'}`,borderRadius:10,padding:24,textAlign:'center',cursor:'pointer',background:'#f8fafc',marginBottom:4 }} onClick={() => document.getElementById('rec-file').click()}>
                    <div style={{ fontSize:32,marginBottom:8 }}>📷</div>
                    <div className="fw-7 text-sm">{PHOTO_REQUIRED_TYPES.includes(form.type) ? 'Click to upload a photo of the physical report' : 'Click to upload file'}</div>
                    <div className="text-xs text-muted mt-1">PDF, JPG, PNG · Max 5MB</div>
                    {form.file && <div style={{ marginTop:8,fontSize:12,color:'#059669',fontWeight:700 }}>✅ {form.file.name}</div>}
                    <input id="rec-file" type="file" style={{ display:'none' }} accept=".pdf,.jpg,.jpeg,.png" onChange={e => setForm(f => ({ ...f, file: e.target.files[0] }))} />
                  </div>
                  {PHOTO_REQUIRED_TYPES.includes(form.type) && (
                    <div style={{ fontSize:11.5, color:'#92400e', background:'#fffbeb', border:'1px solid #fde68a', borderRadius:8, padding:'6px 10px', marginBottom:10 }}>
                      📌 A photo of this report type is mandatory — required every time it's created or updated.
                    </div>
                  )}
                </div>
                <div className="form-group"><label className="form-label">Clinical Notes</label><textarea className="form-input" rows={2} placeholder="Findings and observations…" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowUpload(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={uploading || (PHOTO_REQUIRED_TYPES.includes(form.type) && !form.file)}>
                  {uploading ? <><span className="spinner-sm" /> Uploading…</> : '📤 Upload Record'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}