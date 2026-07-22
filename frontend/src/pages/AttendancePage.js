import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { attendanceAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import FaceCapture from '../components/FaceCapture';

const STATUS_CFG = {
  present:  { bg:'#dcfce7', c:'#15803d', label:'✅ Present' },
  late:     { bg:'#fef3c7', c:'#92400e', label:'⏰ Late' },
  half_day: { bg:'#fef9c3', c:'#a16207', label:'🌓 Half Day' },
  on_leave: { bg:'#e0f2fe', c:'#0369a1', label:'🌴 On Leave' },
  absent:   { bg:'#fee2e2', c:'#dc2626', label:'❌ Absent' },
};

function monthStr(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; }

export default function AttendancePage() {
  const { user } = useAuth();
  const isHR = ['admin','finance'].includes(user?.role);
  const [tab, setTab] = useState('mine');
  const [month, setMonth] = useState(monthStr(new Date()));
  const [mine, setMine] = useState({ records: [], summary: {}, today: null });
  const [loading, setLoading] = useState(true);

  const [allRecords, setAllRecords] = useState([]);
  const [allLoading, setAllLoading] = useState(false);
  const [dateFilter, setDateFilter] = useState('');

  const [faceStatus, setFaceStatus] = useState({ enrolled: false });
  const [faceModal, setFaceModal] = useState(null); // 'enroll' | 'checkin' | 'checkout' | null

  const [lateRequestFor, setLateRequestFor] = useState(null);
  const [lateReason, setLateReason] = useState('');
  const [submittingLateReq, setSubmittingLateReq] = useState(false);
  const [lateRequests, setLateRequests] = useState([]);
  const [lateReqLoading, setLateReqLoading] = useState(false);
  const [reviewingId, setReviewingId] = useState(null);

  useEffect(() => {
    attendanceAPI.getFaceStatus().then(r => setFaceStatus(r.data.data)).catch(()=>{});
  }, []);

  const loadLateRequests = useCallback(() => {
    setLateReqLoading(true);
    attendanceAPI.getLateRequests().then(r => setLateRequests(r.data.data || [])).catch(()=>toast.error('Failed to load late requests')).finally(()=>setLateReqLoading(false));
  }, []);
  useEffect(() => { if (tab === 'late') loadLateRequests(); }, [tab, loadLateRequests]);
  useEffect(() => { loadLateRequests(); /* eslint-disable-next-line */ }, []);

  const submitLateWaiverRequest = async () => {
    if (!lateReason.trim()) { toast.error('Enter a reason'); return; }
    setSubmittingLateReq(true);
    try {
      await attendanceAPI.submitLateRequest(lateRequestFor._id, lateReason.trim());
      toast.success('✅ Waiver request submitted — awaiting admin review');
      setLateRequestFor(null);
      loadMine();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed to submit request'); }
    setSubmittingLateReq(false);
  };

  const decideLateReq = async (req, decision) => {
    const adminNote = decision === 'reject' ? (window.prompt('Reason for rejecting (optional)?', '') || '') : '';
    setReviewingId(req._id);
    try {
      await attendanceAPI.decideLateRequest(req._id, decision, adminNote);
      toast.success(decision === 'approve' ? '✅ Approved — late fine waived' : 'Request rejected');
      loadLateRequests();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed to save decision'); }
    setReviewingId(null);
  };

  const onFaceDone = () => {
    setFaceModal(null);
    attendanceAPI.getFaceStatus().then(r => setFaceStatus(r.data.data)).catch(()=>{});
    loadMine();
  };

  const removeFaceEnrollment = async () => {
    if (!window.confirm('Remove your enrolled face? You can re-enroll any time.')) return;
    try { await attendanceAPI.deleteFaceProfile(); toast.success('Face enrollment removed'); setFaceStatus({ enrolled:false }); }
    catch { toast.error('Failed to remove enrollment'); }
  };

  const loadMine = useCallback(() => {
    setLoading(true);
    attendanceAPI.getMine(month).then(r => setMine(r.data.data)).catch(()=>toast.error('Failed to load attendance')).finally(()=>setLoading(false));
  }, [month]);
  useEffect(() => { loadMine(); }, [loadMine]);

  const loadAll = useCallback(() => {
    setAllLoading(true);
    attendanceAPI.getAll(dateFilter ? { date: dateFilter } : {}).then(r => setAllRecords(r.data.data || [])).catch(()=>toast.error('Failed to load staff attendance')).finally(()=>setAllLoading(false));
  }, [dateFilter]);
  useEffect(() => { if (tab === 'all') loadAll(); }, [tab, loadAll]);

  const overrideStatus = async (id, status) => {
    try { await attendanceAPI.override(id, status); toast.success('Updated'); loadAll(); }
    catch (e) { toast.error(e.response?.data?.error || 'Failed to update'); }
  };

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">🕒 Attendance</div><div className="page-subtitle">Clock in/out and track shift punctuality automatically</div></div>
      </div>

      <div style={{ display:'flex', gap:6, marginBottom:18 }}>
        {[['mine','👤 My Attendance'], ...(isHR?[['all','🏥 All Staff']]:[]), ['late', `⏰ Late Requests${lateRequests.filter(r=>r.status==='pending').length>0?` (${lateRequests.filter(r=>r.status==='pending').length})`:''}`]].map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)} style={{ padding:'9px 16px', borderRadius:11, border:'none', background:tab===k?'#eef2ff':'#f8fafc', color:tab===k?'#4338ca':'#64748b', fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>{l}</button>
        ))}
      </div>

      {tab === 'mine' && (
        <div>
          <div className="card" style={{ marginBottom:16, borderLeft:'4px solid #4338ca' }}>
            <div className="card-body" style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:10 }}>
              <div>
                <div style={{ fontWeight:800, fontSize:13.5 }}>📸 Face Recognition Check-In</div>
                <div style={{ fontSize:11.5, color:'#64748b', marginTop:2 }}>
                  {faceStatus.enrolled ? "Your face is enrolled — you can clock in/out with your camera as a second factor." : "Not enrolled yet — enroll your face to unlock camera-based check-in/out."}
                </div>
              </div>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {!faceStatus.enrolled ? (
                  <button className="btn btn-primary btn-sm" onClick={()=>setFaceModal('enroll')}>📸 Enroll Face</button>
                ) : (
                  <>
                    <button className="btn btn-outline btn-sm" onClick={()=>setFaceModal('checkin')} disabled={!!mine.today?.checkInTime}>📸 Face Check-In</button>
                    <button className="btn btn-outline btn-sm" onClick={()=>setFaceModal('checkout')} disabled={!mine.today?.checkInTime || !!mine.today?.checkOutTime}>📸 Face Check-Out</button>
                    <button className="btn btn-ghost btn-sm" onClick={removeFaceEnrollment}>Remove</button>
                  </>
                )}
              </div>
            </div>
          </div>

          <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:16 }}>
            <input type="month" value={month} onChange={e=>setMonth(e.target.value)} style={{ padding:'8px 12px', border:'1.5px solid #e2e8f0', borderRadius:9, fontSize:13 }} />
          </div>
          <div className="stat-grid" style={{ marginBottom:18 }}>
            <div className="card"><div className="card-body" style={{ textAlign:'center' }}><div style={{ fontSize:22, fontWeight:800, color:'#15803d' }}>{mine.summary?.present||0}</div><div style={{ fontSize:11.5, color:'#64748b' }}>Present</div></div></div>
            <div className="card"><div className="card-body" style={{ textAlign:'center' }}><div style={{ fontSize:22, fontWeight:800, color:'#92400e' }}>{mine.summary?.late||0}</div><div style={{ fontSize:11.5, color:'#64748b' }}>Late</div></div></div>
            <div className="card"><div className="card-body" style={{ textAlign:'center' }}><div style={{ fontSize:22, fontWeight:800, color:'#dc2626' }}>{mine.summary?.absent||0}</div><div style={{ fontSize:11.5, color:'#64748b' }}>Absent</div></div></div>
            <div className="card"><div className="card-body" style={{ textAlign:'center' }}><div style={{ fontSize:22, fontWeight:800, color:'#4338ca' }}>{((mine.summary?.totalWorkedMinutes||0)/60).toFixed(1)}h</div><div style={{ fontSize:11.5, color:'#64748b' }}>Hours worked</div></div></div>
          </div>
          {loading ? (
            <div style={{ textAlign:'center', padding:40, color:'#94a3b8' }}>Loading…</div>
          ) : mine.records.length === 0 ? (
            <div className="card"><div className="card-body" style={{ textAlign:'center', padding:36, color:'#94a3b8' }}>No attendance records for this month yet</div></div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {mine.records.map(r => {
                const cfg = STATUS_CFG[r.status] || STATUS_CFG.present;
                return (
                  <motion.div key={r._id} initial={{ opacity:0 }} animate={{ opacity:1 }} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px', background:'#fff', border:'1px solid #e2e8f0', borderRadius:10, flexWrap:'wrap', gap:8 }}>
                    <div style={{ fontWeight:700, fontSize:13 }}>{new Date(r.date).toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short'})}</div>
                    <div style={{ fontSize:12, color:'#64748b' }}>
                      {r.checkInTime ? `In: ${new Date(r.checkInTime).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}` : '—'}
                      {r.checkOutTime ? ` · Out: ${new Date(r.checkOutTime).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}` : ''}
                      {r.workedMinutes != null && ` · ${(r.workedMinutes/60).toFixed(1)}h`}
                    </div>
                    <span style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700, background:cfg.bg, color:cfg.c }}>{cfg.label}</span>
                    {r.status === 'late' && !r.lateWaived && (
                      <button className="btn btn-outline btn-xs" onClick={()=>{ setLateRequestFor(r); setLateReason(''); }}>Request Waiver</button>
                    )}
                    {r.lateWaived && <span style={{ fontSize:10.5, color:'#15803d', fontWeight:700 }}>✓ Waived</span>}
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'all' && isHR && (
        <div>
          <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:16 }}>
            <input type="date" value={dateFilter} onChange={e=>setDateFilter(e.target.value)} style={{ padding:'8px 12px', border:'1.5px solid #e2e8f0', borderRadius:9, fontSize:13 }} />
            {dateFilter && <button className="btn btn-outline btn-sm" onClick={()=>setDateFilter('')}>Clear (last 30 days)</button>}
          </div>
          {allLoading ? (
            <div style={{ textAlign:'center', padding:40, color:'#94a3b8' }}>Loading…</div>
          ) : allRecords.length === 0 ? (
            <div className="card"><div className="card-body" style={{ textAlign:'center', padding:36, color:'#94a3b8' }}>No attendance records found</div></div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {allRecords.map(r => {
                const cfg = STATUS_CFG[r.status] || STATUS_CFG.present;
                return (
                  <div key={r._id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px', background:'#fff', border:'1px solid #e2e8f0', borderRadius:10, flexWrap:'wrap', gap:8 }}>
                    <div>
                      <div style={{ fontWeight:700, fontSize:13 }}>{r.user?.name} <span style={{ fontWeight:500, color:'#94a3b8', fontSize:11 }}>({r.user?.role})</span></div>
                      <div style={{ fontSize:11.5, color:'#64748b' }}>{new Date(r.date).toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short'})}
                        {r.checkInTime && ` · In: ${new Date(r.checkInTime).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}`}
                        {r.checkOutTime && ` · Out: ${new Date(r.checkOutTime).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}`}
                        {r.computed && ' · (auto-computed, no check-in on record)'}
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                      <span style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700, background:cfg.bg, color:cfg.c }}>{cfg.label}</span>
                      {!r.computed && (
                        <select value={r.status} onChange={e=>overrideStatus(r._id, e.target.value)} style={{ fontSize:11.5, padding:'4px 6px', borderRadius:7, border:'1px solid #e2e8f0' }}>
                          {Object.keys(STATUS_CFG).map(s => <option key={s} value={s}>{STATUS_CFG[s].label}</option>)}
                        </select>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'late' && (
        <div>
          <div style={{ background:'#fffbeb', border:'1px solid #fde68a', borderRadius:12, padding:'12px 16px', marginBottom:18, fontSize:12.5, color:'#92400e' }}>
            ⏰ Arriving more than 5 minutes after your shift start counts as late, and an unwaived late day deducts ₹50 from that month's salary. If you had a genuine reason, request a waiver here — if approved, the late mark and its fine are removed.
          </div>
          {lateReqLoading ? (
            <div style={{ textAlign:'center', padding:40, color:'#94a3b8' }}>Loading…</div>
          ) : lateRequests.length === 0 ? (
            <div className="card"><div className="card-body" style={{ textAlign:'center', padding:36, color:'#94a3b8' }}>No late-reporting requests</div></div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {lateRequests.map(req => {
                const rCfg = { pending:{bg:'#fef3c7',c:'#92400e',label:'⏳ Pending'}, approved:{bg:'#dcfce7',c:'#15803d',label:'✅ Approved'}, rejected:{bg:'#fee2e2',c:'#dc2626',label:'✕ Rejected'} }[req.status];
                return (
                  <div key={req._id} className="card">
                    <div className="card-body">
                      <div style={{ display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:8, marginBottom:6 }}>
                        <div>
                          <div style={{ fontWeight:700, fontSize:13 }}>{isHR ? `${req.user?.name} (${req.user?.role})` : 'You'} — {new Date(req.date).toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short'})}</div>
                          {req.attendance?.lateByMinutes && <div style={{ fontSize:11.5, color:'#94a3b8' }}>{req.attendance.lateByMinutes} min late (shift started {req.attendance.scheduledStart})</div>}
                        </div>
                        <span style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700, background:rCfg.bg, color:rCfg.c, height:'fit-content' }}>{rCfg.label}</span>
                      </div>
                      <div style={{ fontSize:12.5, color:'#374151', marginBottom:6 }}>📝 {req.reason}</div>
                      {req.adminNote && <div style={{ fontSize:11.5, color:'#64748b', marginBottom:6 }}>Admin note: {req.adminNote}</div>}
                      {isHR && req.status === 'pending' && (
                        <div style={{ display:'flex', gap:6 }}>
                          <button className="btn btn-primary btn-sm" disabled={reviewingId===req._id} onClick={()=>decideLateReq(req,'approve')}>✅ Approve</button>
                          <button className="btn btn-outline btn-sm" disabled={reviewingId===req._id} onClick={()=>decideLateReq(req,'reject')}>✕ Reject</button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {lateRequestFor && (
        <div className="modal-overlay" onClick={e=>{ if(e.target===e.currentTarget) setLateRequestFor(null); }}>
          <div className="modal-box" style={{ maxWidth:420 }}>
            <div className="modal-header">
              <span className="modal-title">⏰ Request Late Waiver</span>
              <button className="btn btn-ghost btn-icon" onClick={()=>setLateRequestFor(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ fontSize:12.5, color:'#64748b', marginBottom:12 }}>
                {new Date(lateRequestFor.date).toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'short'})} — {lateRequestFor.lateByMinutes} min late. Explain why, and an admin will review it.
              </div>
              <div className="form-group">
                <label className="form-label">Reason *</label>
                <textarea className="form-input" rows={3} value={lateReason} onChange={e=>setLateReason(e.target.value)} placeholder="e.g. Stuck in traffic due to an accident on the highway" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={()=>setLateRequestFor(null)}>Cancel</button>
              <button className="btn btn-primary" disabled={submittingLateReq} onClick={submitLateWaiverRequest}>{submittingLateReq ? 'Submitting…' : '✓ Submit Request'}</button>
            </div>
          </div>
        </div>
      )}

      {faceModal && (
        <FaceCapture mode={faceModal} onDone={onFaceDone} onClose={()=>setFaceModal(null)} />
      )}
    </div>
  );
}
