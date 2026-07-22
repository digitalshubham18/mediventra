import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { facilityAPI, reviewsAPI } from '../utils/api';

const DEPT_COLORS = {
  Cardiology:'#ef4444', Neurology:'#8b5cf6', Pediatrics:'#f59e0b', Psychiatry:'#ec4899',
  Dermatology:'#10b981', Orthopedics:'#3b82f6', Oncology:'#f97316', Surgery:'#6366f1',
  'General Medicine':'#0891b2', Gynecology:'#db2777', Radiology:'#64748b', ENT:'#84cc16',
  Ophthalmology:'#06b6d4', Urology:'#7c3aed', Nephrology:'#059669',
};

const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const SHIFT_LABEL = { morning:'Morning', afternoon:'Afternoon', night:'Night', full:'Full Day' };

function EmptyTab({ icon, text }) {
  return (
    <div style={{ textAlign:'center', padding:'26px 10px', color:'#94a3b8' }}>
      <div style={{ fontSize:30, marginBottom:8, opacity:.6 }}>{icon}</div>
      <div style={{ fontSize:12.5 }}>{text}</div>
    </div>
  );
}

export default function DoctorProfileCard({ doctor, onClose }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [schedule, setSchedule] = useState([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const deptColor = DEPT_COLORS[doctor.department] || '#2563eb';
  const stats = doctor.realStats || null; // real, server-computed — never fabricated

  const tabs = [
    { key:'overview',     label:'Overview'      },
    { key:'degrees',      label:'Degrees'       },
    { key:'experience',   label:'Experience'    },
    { key:'schedule',     label:'Schedule'      },
    { key:'reviews',      label:'Reviews'       },
    { key:'contact',      label:'Contact'       },
  ];

  const initials = doctor.name?.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase();

  // Real upcoming schedule, fetched on demand — replaces the old static
  // "Mon-Fri 9-5, Sat half day" sample data shown for every doctor.
  useEffect(() => {
    if (activeTab !== 'schedule' || !doctor._id) return;
    setScheduleLoading(true);
    facilityAPI.getSchedules({ userId: doctor._id })
      .then(res => setSchedule((res.data?.data || []).sort((a,b) => new Date(a.date) - new Date(b.date))))
      .catch(() => setSchedule([]))
      .finally(() => setScheduleLoading(false));
  }, [activeTab, doctor._id]);

  // Real patient reviews — replaces any notion of a fabricated rating
  useEffect(() => {
    if (activeTab !== 'reviews' || !doctor._id) return;
    setReviewsLoading(true);
    reviewsAPI.forDoctor(doctor._id)
      .then(res => setReviews(res.data?.data || []))
      .catch(() => setReviews([]))
      .finally(() => setReviewsLoading(false));
  }, [activeTab, doctor._id]);

  return (
    <div style={{ background:'#fff', borderRadius:20, overflow:'hidden', maxWidth:720, width:'100%', boxShadow:'0 24px 60px rgba(0,0,0,.16)', fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        .tab-btn{padding:10px 16px;border:none;background:none;font-family:inherit;font-size:13px;font-weight:600;cursor:pointer;border-bottom:2.5px solid transparent;color:#94a3b8;transition:all .2s;white-space:nowrap;}
        .tab-btn.active{color:${deptColor};border-bottom-color:${deptColor};}
        .tab-btn:hover:not(.active){color:#374151;}
        .info-chip{display:inline-flex;align-items:center;gap:5px;padding:4px 10px;background:#f1f5f9;border-radius:20px;font-size:11.5px;font-weight:600;color:#374151;}
        .degree-item{padding:12px 0;border-bottom:1px solid #f1f5f9;display:flex;gap:12px;align-items:flex-start;}
        .degree-item:last-child{border-bottom:none;}
        .exp-item{padding:12px 0;border-bottom:1px solid #f1f5f9;display:flex;gap:10px;align-items:flex-start;}
        .exp-item:last-child{border-bottom:none;}
        .schedule-slot{padding:8px 14px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;display:flex;align-items:center;justify-content:space-between;font-size:12.5px;gap:10px;}
        .contact-row{display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid #f8fafc;}
        .contact-row:last-child{border-bottom:none;}
      `}</style>

      {/* ── Hero Banner ── */}
      <div style={{ background:`linear-gradient(135deg, ${deptColor}15, ${deptColor}08)`, padding:'28px 28px 0', borderBottom:'1px solid #f1f5f9', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:-40, right:-40, width:200, height:200, borderRadius:'50%', background:`${deptColor}08`, pointerEvents:'none' }} />

        <div style={{ display:'flex', gap:20, alignItems:'flex-start', marginBottom:20 }}>
          {/* Avatar */}
          <div style={{ flexShrink:0 }}>
            {doctor.avatar ? (
              <img src={doctor.avatar} alt={doctor.name} style={{ width:96, height:96, borderRadius:16, objectFit:'cover', border:`3px solid ${deptColor}30` }} />
            ) : (
              <div style={{ width:96, height:96, borderRadius:16, background:`linear-gradient(135deg,${deptColor},${deptColor}99)`, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:800, fontSize:28, border:`3px solid ${deptColor}30` }}>{initials}</div>
            )}
            <div style={{ marginTop:6, display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>
              <div style={{ width:7, height:7, borderRadius:'50%', background: doctor.isOnline?'#22c55e':'#94a3b8' }} />
              <span style={{ fontSize:10.5, color: doctor.isOnline?'#15803d':'#94a3b8', fontWeight:600 }}>{doctor.isOnline?'Online':'Offline'}</span>
            </div>
          </div>

          {/* Info */}
          <div style={{ flex:1 }}>
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
              <div>
                <h2 style={{ fontSize:21, fontWeight:800, color:'#0f172a', margin:0, letterSpacing:-.3 }}>
                  Dr. {doctor.name}
                </h2>
                <div style={{ fontSize:13.5, color:deptColor, fontWeight:700, marginTop:3 }}>
                  {doctor.specialization || doctor.department || 'General Practitioner'}
                </div>
                <div style={{ fontSize:12, color:'#64748b', marginTop:2 }}>{doctor.department} Department</div>
              </div>

              {/* Rating — only ever shown if it's a real number; this app has
                  no review system yet, so it will usually be hidden rather
                  than display a fabricated score. */}
              {typeof doctor.rating === 'number' && (
                <div style={{ display:'flex', alignItems:'center', gap:4, background:'#fffbeb', border:'1px solid #fde68a', borderRadius:20, padding:'4px 10px' }}>
                  <span style={{ color:'#f59e0b', fontSize:13 }}>★</span>
                  <span style={{ fontSize:12, fontWeight:700, color:'#92400e' }}>{doctor.rating}</span>
                  <span style={{ fontSize:11, color:'#b45309' }}>/ 5.0 ({doctor.reviewCount} review{doctor.reviewCount===1?'':'s'})</span>
                </div>
              )}
            </div>

            {/* Quick stats chips — real numbers, computed server-side from
                actual appointments (see realStats), never fabricated */}
            <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:12 }}>
              <span className="info-chip">
                <span style={{ color:deptColor }}>👥</span> {stats ? `${stats.totalPatients} Patient${stats.totalPatients===1?'':'s'} Seen` : '— Patients'}
              </span>
              {stats && (
                <span className="info-chip">
                  <span>📅</span> {stats.completedAppointments}/{stats.totalAppointments} Appointments Completed
                </span>
              )}
              {doctor.licenseNumber && (
                <span className="info-chip"><span>🪪</span> Lic: {doctor.licenseNumber}</span>
              )}
              {typeof doctor.experienceYears === 'number' && doctor.experienceYears > 0 && (
                <span className="info-chip"><span>🎯</span> {doctor.experienceYears} yrs experience</span>
              )}
              <span className="info-chip" style={{ background:doctor.status==='approved'?'#dcfce7':'#fef3c7', color:doctor.status==='approved'?'#15803d':'#92400e' }}>
                {doctor.status==='approved'?'✓ Verified':'⏳ Pending'}
              </span>
              <span className="info-chip" style={{ fontFamily:'monospace', fontSize:10.5 }}>
                ID: {doctor._id?.slice(-8)?.toUpperCase()}
              </span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', gap:0, overflowX:'auto', borderTop:'1px solid #e8edf3', marginTop:4 }}>
          {tabs.map(t => (
            <button key={t.key} className={`tab-btn${activeTab===t.key?' active':''}`} onClick={() => setActiveTab(t.key)}>{t.label}</button>
          ))}
        </div>
      </div>

      {/* ── Tab Content ── */}
      <div style={{ padding:'20px 28px 24px', minHeight:200, maxHeight:380, overflowY:'auto' }}>
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity:0,y:8 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0 }} transition={{ duration:.2 }}>

            {activeTab==='overview' && (
              <div>
                <p style={{ fontSize:13.5, color:'#475569', lineHeight:1.7, marginBottom:16 }}>
                  {doctor.bio || <span style={{ color:'#94a3b8', fontStyle:'italic' }}>No bio added yet. The doctor can add one from Settings → Profile.</span>}
                </p>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  {[
                    { icon:'🏥', label:'Department', val:doctor.department||'—' },
                    { icon:'🔬', label:'Specialization', val:doctor.specialization||'—' },
                    { icon:'📞', label:'Phone', val:doctor.phone||'Not provided' },
                    { icon:'📧', label:'Email', val:doctor.email||'—' },
                    { icon:'👥', label:'Patients Seen', val: stats ? stats.totalPatients : '—' },
                    { icon:'⭐', label:'Rating', val: typeof doctor.rating === 'number' ? `${doctor.rating} / 5.0` : 'No reviews yet' },
                  ].map(({icon,label,val}) => (
                    <div key={label} style={{ background:'#f8fafc', borderRadius:10, padding:'10px 13px', display:'flex', gap:9, alignItems:'center' }}>
                      <span style={{ fontSize:16, flexShrink:0 }}>{icon}</span>
                      <div>
                        <div style={{ fontSize:10.5, color:'#94a3b8', fontWeight:600, textTransform:'uppercase', letterSpacing:.4 }}>{label}</div>
                        <div style={{ fontSize:12.5, fontWeight:700, color:'#0f172a', marginTop:1, wordBreak:'break-all' }}>{val}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab==='degrees' && (
              <div>
                <div style={{ fontSize:10.5, color:'#94a3b8', fontWeight:700, letterSpacing:1, textTransform:'uppercase', marginBottom:12 }}>Academic Qualifications</div>
                {(doctor.degrees && doctor.degrees.length > 0) ? doctor.degrees.map((d,i) => (
                  <div key={i} className="degree-item">
                    <div style={{ width:36, height:36, borderRadius:10, background:`${deptColor}15`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:17, flexShrink:0 }}>🎓</div>
                    <div>
                      <div style={{ fontSize:13, fontWeight:700, color:'#0f172a' }}>{d.institution}</div>
                      <div style={{ fontSize:12, color:'#64748b', marginTop:2 }}>{d.degree}</div>
                      {d.year && <div style={{ fontSize:11, color:deptColor, fontWeight:600, marginTop:3 }}>Completed {d.year}</div>}
                    </div>
                  </div>
                )) : <EmptyTab icon="🎓" text="No degrees added yet — the doctor can add their qualifications from Settings → Profile." />}
              </div>
            )}

            {activeTab==='experience' && (
              <div>
                <div style={{ fontSize:10.5, color:'#94a3b8', fontWeight:700, letterSpacing:1, textTransform:'uppercase', marginBottom:12 }}>Clinical Experience</div>
                {(doctor.experiences && doctor.experiences.length > 0) ? doctor.experiences.map((e,i) => (
                  <div key={i} className="exp-item">
                    <div style={{ width:8, height:8, borderRadius:'50%', background:deptColor, flexShrink:0, marginTop:5 }} />
                    <div style={{ fontSize:13, color:'#475569', lineHeight:1.6 }}>{e.text}</div>
                  </div>
                )) : <EmptyTab icon="🩺" text="No experience added yet — the doctor can add their work history from Settings → Profile." />}
              </div>
            )}

            {activeTab==='schedule' && (
              <div>
                <div style={{ fontSize:10.5, color:'#94a3b8', fontWeight:700, letterSpacing:1, textTransform:'uppercase', marginBottom:12 }}>Upcoming Schedule</div>
                {scheduleLoading ? (
                  <div style={{ textAlign:'center', padding:24, color:'#94a3b8', fontSize:12.5 }}>Loading real schedule…</div>
                ) : schedule.length === 0 ? (
                  <EmptyTab icon="🗓️" text="No schedule entries found for this doctor yet." />
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    {schedule.slice(0, 10).map(s => {
                      const d = new Date(s.date);
                      const isPast = d < new Date().setHours(0,0,0,0);
                      return (
                        <div key={s._id} className="schedule-slot">
                          <span style={{ fontWeight:700, color:'#374151', fontSize:12.5, width:120, flexShrink:0 }}>
                            {DAY_NAMES[d.getDay()]}, {d.toLocaleDateString('en-IN', { day:'numeric', month:'short' })}
                          </span>
                          <span style={{ color:'#059669', fontWeight:600, fontSize:12 }}>{s.startTime} – {s.endTime} ({SHIFT_LABEL[s.shift] || s.shift})</span>
                          <span style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700, flexShrink:0,
                            background: s.status==='absent' ? '#fee2e2' : s.status==='on-leave' ? '#fef3c7' : isPast ? '#f1f5f9' : '#dcfce7',
                            color: s.status==='absent' ? '#dc2626' : s.status==='on-leave' ? '#92400e' : isPast ? '#64748b' : '#15803d' }}>
                            {s.status==='absent' ? 'Absent' : s.status==='on-leave' ? 'On Leave' : isPast ? 'Completed' : 'Scheduled'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {activeTab==='reviews' && (
              <div>
                <div style={{ fontSize:10.5, color:'#94a3b8', fontWeight:700, letterSpacing:1, textTransform:'uppercase', marginBottom:12 }}>Patient Reviews</div>
                {reviewsLoading ? (
                  <div style={{ textAlign:'center', padding:24, color:'#94a3b8', fontSize:12.5 }}>Loading reviews…</div>
                ) : reviews.length === 0 ? (
                  <EmptyTab icon="⭐" text="No reviews yet — patients are asked to rate their visit after the doctor marks an appointment complete." />
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                    {reviews.map(r => (
                      <div key={r._id} style={{ background:'#f8fafc', borderRadius:10, padding:'10px 13px' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                          <span style={{ fontWeight:700, fontSize:12.5, color:'#0f172a' }}>{r.patient?.name || 'Patient'}</span>
                          <span style={{ color:'#f59e0b', fontSize:12.5, fontWeight:700 }}>{'★'.repeat(r.rating)}{'☆'.repeat(5-r.rating)}</span>
                        </div>
                        {r.comment && <div style={{ fontSize:12.5, color:'#475569', marginTop:5, lineHeight:1.5 }}>{r.comment}</div>}
                        <div style={{ fontSize:10.5, color:'#94a3b8', marginTop:5 }}>{new Date(r.createdAt).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab==='contact' && (
              <div>
                <div style={{ fontSize:10.5, color:'#94a3b8', fontWeight:700, letterSpacing:1, textTransform:'uppercase', marginBottom:12 }}>Contact Information</div>
                {[
                  { icon:'📞', label:'Phone', val:doctor.phone||'Not provided' },
                  { icon:'📧', label:'Email', val:doctor.email },
                  { icon:'🏥', label:'Department', val:doctor.department||'—' },
                  { icon:'🆔', label:'Doctor ID', val:doctor._id?.slice(-8)?.toUpperCase()||'—', mono:true },
                  { icon:'📍', label:'Address', val:doctor.address||'Not provided' },
                ].map(({icon,label,val,mono}) => (
                  <div key={label} className="contact-row">
                    <div style={{ width:38, height:38, borderRadius:10, background:`${deptColor}12`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:17, flexShrink:0 }}>{icon}</div>
                    <div>
                      <div style={{ fontSize:11, color:'#94a3b8', fontWeight:600, textTransform:'uppercase', letterSpacing:.4 }}>{label}</div>
                      <div style={{ fontSize:13, fontWeight:700, color:'#0f172a', fontFamily:mono?'monospace':undefined }}>{val}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div style={{ padding:'14px 28px 20px', borderTop:'1px solid #f1f5f9', display:'flex', alignItems:'center', justifyContent:'space-between', background:'#fafbfc' }}>
        <div style={{ fontSize:11.5, color:'#94a3b8' }}>
          Available for consultations · {doctor.department} Dept
        </div>
        <button onClick={onClose} style={{ padding:'10px 22px', borderRadius:12, border:'none', background:`linear-gradient(135deg,${deptColor},${deptColor}cc)`, color:'#fff', fontFamily:'inherit', fontWeight:700, fontSize:13, cursor:'pointer', boxShadow:`0 6px 18px ${deptColor}40` }}>
          Close
        </button>
      </div>
    </div>
  );
}
