import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, LineElement, PointElement, Filler, Tooltip } from 'chart.js';
import {
  appointmentsAPI, recordsAPI, reviewsAPI, peerConsultAPI, doctorCabinsAPI, tasksAPI,
} from '../utils/api';
import { getSocket } from '../utils/socket';
import toast from 'react-hot-toast';

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, Filler, Tooltip);

const isToday = (d) => {
  const a = new Date(d), b = new Date();
  return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
};
const startOfWeek = () => { const d = new Date(); d.setDate(d.getDate() - d.getDay()); d.setHours(0,0,0,0); return d; };

function StatPill({ icon, value, label }) {
  return (
    <div style={{ flex:1, minWidth:130, background:'#fff', borderRadius:14, padding:'14px 16px', boxShadow:'0 1px 3px rgba(15,23,42,.06)', border:'1px solid #ecfdf5' }}>
      <div style={{ fontSize:20 }}>{icon}</div>
      <div style={{ fontSize:22, fontWeight:800, color:'#0f172a', marginTop:4 }}>{value}</div>
      <div style={{ fontSize:11.5, color:'#64748b' }}>{label}</div>
    </div>
  );
}

// ── Department specialty configuration ──────────────────────────────────
// Each clinical department gets its own accent color, banner gradient, and
// a distinct "specialty widget" built from data the doctor already has
// (appointments, records, live vitals alerts) — no two departments render
// the same module. Anything unrecognized falls back to General Medicine.
const DEPT_CONFIG = {
  cardiology:        { color:'#dc2626', grad:'linear-gradient(120deg,#7f1d1d,#dc2626)', icon:'❤️',  tagline:'Cardiology Command Center',       widget:'cardiac' },
  neurology:         { color:'#7c3aed', grad:'linear-gradient(120deg,#4c1d95,#7c3aed)', icon:'🧠',  tagline:'Neurology Care Console',          widget:'neuro',   keywords:['seizure','stroke','migraine','neuro','epilep','tremor'] },
  orthopedics:       { color:'#ea580c', grad:'linear-gradient(120deg,#7c2d12,#ea580c)', icon:'🦴',  tagline:'Orthopedic Recovery Center',       widget:'recovery', keywords:['surgery','fracture','post-op','joint','implant','physiotherapy','recovery','ortho'] },
  pediatrics:        { color:'#0ea5e9', grad:'linear-gradient(120deg,#0c4a6e,#0ea5e9)', icon:'🧸',  tagline:'Pediatric Care Hub',               widget:'vaccination' },
  psychiatry:        { color:'#6366f1', grad:'linear-gradient(120deg,#312e81,#6366f1)', icon:'🧘',  tagline:'Behavioral Health Suite',          widget:'therapy', keywords:['therapy','counsel','session','psych','mental','anxiety','depress'] },
  gynecology:        { color:'#db2777', grad:'linear-gradient(120deg,#831843,#db2777)', icon:'🤰',  tagline:"Women's Health & Antenatal Care",  widget:'antenatal', keywords:['pregnan','antenatal','prenatal','anc','trimester','obstetric'] },
  oncology:          { color:'#a16207', grad:'linear-gradient(120deg,#292524,#a16207)', icon:'🎗️', tagline:'Oncology Treatment Center',        widget:'oncology', keywords:['chemo','cycle','radiation','oncology','tumor','biopsy'] },
  surgery:           { color:'#334155', grad:'linear-gradient(120deg,#0f172a,#334155)', icon:'🔪',  tagline:'Surgical Planning Board',          widget:'surgery', keywords:['surgery','operat','pre-op','post-op'] },
  ent:               { color:'#0891b2', grad:'linear-gradient(120deg,#164e63,#0891b2)', icon:'👂',  tagline:'ENT Diagnostic Desk',              widget:'ent', keywords:['ent','sinus','hearing','throat','ear','nose'] },
  radiology:         { color:'#4f46e5', grad:'linear-gradient(120deg,#1e1b4b,#4f46e5)', icon:'🩻',  tagline:'Radiology Reporting Suite',        widget:'imaging' },
  icu:               { color:'#b91c1c', grad:'linear-gradient(120deg,#450a0a,#b91c1c)', icon:'🚨',  tagline:'ICU Critical Monitoring',          widget:'icu' },
  emergency:         { color:'#f97316', grad:'linear-gradient(120deg,#7c2d12,#f97316)', icon:'🚑',  tagline:'Emergency Triage Board',           widget:'triage' },
  'general medicine':{ color:'#0d9488', grad:'linear-gradient(120deg,#0f172a,#0d9488)', icon:'🩺',  tagline:"General Physician's Desk",         widget:'chronic' },
};
const DEFAULT_DEPT = DEPT_CONFIG['general medicine'];
const normalizeDept = (raw) => {
  const s = (raw || '').toLowerCase().trim();
  if (!s) return 'general medicine';
  const key = Object.keys(DEPT_CONFIG).find(k => s.includes(k) || k.includes(s));
  return key || 'general medicine';
};
const kwMatch = (a, keywords) => {
  if (!keywords || !keywords.length) return false;
  const text = `${a.reason||''} ${a.notes||''} ${a.doctorNotes||''}`.toLowerCase();
  return keywords.some(k => text.includes(k));
};

const TIMELINE_STATUS_COLOR = { pending:'#f59e0b', confirmed:'#0d9488', completed:'#64748b', cancelled:'#dc2626', no_show:'#94a3b8' };

export default function DoctorDashboard({ user, navigate }) {
  const [appointments, setAppointments] = useState([]);
  const [labRecords, setLabRecords] = useState([]);
  const [allRecords, setAllRecords] = useState([]);
  const [reviews, setReviews] = useState({ count:0, average:null, data:[] });
  const [peerConsults, setPeerConsults] = useState([]);
  const [cabin, setCabin] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [vitalsAlerts, setVitalsAlerts] = useState([]); // live, session-only feed

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([
      appointmentsAPI.getAll(),
      recordsAPI.getAll(),
      reviewsAPI.forDoctor(user._id),
      peerConsultAPI.getReceived(),
      doctorCabinsAPI.getForDoctor(user._id),
      tasksAPI.getAll(),
    ]).then(([apptR, recR, revR, pcR, cabR, taskR]) => {
      setAppointments(apptR.value?.data?.data || []);
      const allRecs = recR.value?.data?.data || [];
      setAllRecords(allRecs);
      const mineLab = allRecs.filter(r => ['pending','processing'].includes(r.status) && (r.type === 'lab_report' || r.testName) && r.doctor?._id === user._id);
      setLabRecords(mineLab);
      setReviews({ count: revR.value?.data?.count || 0, average: revR.value?.data?.average, data: revR.value?.data?.data || [] });
      setPeerConsults((pcR.value?.data?.data || []).filter(c => c.status === 'pending'));
      setCabin(cabR.value?.data?.data || null);
      setTasks(taskR.value?.data?.data || []);
    }).finally(() => setLoading(false));

    const socket = getSocket();
    if (!socket) return;
    const onVitalsAlert = (d) => {
      setVitalsAlerts(prev => [{ id: Date.now(), ...d }, ...prev.slice(0,4)]);
      toast.error(`⚠️ ${d.patientName}: ${d.reasons?.[0]}`, { duration: 8000 });
    };
    const onLabReady = () => {
      recordsAPI.getAll().then(res => {
        const all = res.data.data || [];
        setAllRecords(all);
        const mine = all.filter(r => ['pending','processing'].includes(r.status) && (r.type === 'lab_report' || r.testName) && r.doctor?._id === user._id);
        setLabRecords(mine);
      }).catch(()=>{});
    };
    const onTaskAssigned = (d) => {
      toast(`📋 New task assigned: ${d.title || 'Check My Tasks'}`, { icon:'📋', duration: 7000 });
      tasksAPI.getAll().then(r => setTasks(r.data.data || [])).catch(()=>{});
    };
    socket.on('patient_vitals_alert', onVitalsAlert);
    socket.on('lab_report_ready', onLabReady);
    socket.on('task_assigned', onTaskAssigned);
    return () => { socket.off('patient_vitals_alert', onVitalsAlert); socket.off('lab_report_ready', onLabReady); socket.off('task_assigned', onTaskAssigned); };
  }, [user._id]);

  const pendingTasks = useMemo(() => tasks.filter(t => !['completed','cancelled'].includes(t.status)), [tasks]);

  const todaysAppts = useMemo(() =>
    appointments.filter(a => isToday(a.date) && a.status !== 'cancelled')
      .sort((a,b) => (a.timeSlot||'').localeCompare(b.timeSlot||'')),
  [appointments]);

  const weekCount = useMemo(() => appointments.filter(a => new Date(a.date) >= startOfWeek() && a.status !== 'cancelled').length, [appointments]);
  const nextVideoAppt = todaysAppts.find(a => a.consultMode === 'video' && a.status === 'confirmed');

  // Last 7 days patient-load trend, computed client-side from this doctor's own appointments only
  const last7 = useMemo(() => {
    const days = [...Array(7)].map((_,i) => { const d = new Date(); d.setDate(d.getDate()-(6-i)); return d; });
    return days.map(d => ({
      label: d.toLocaleDateString('en-IN', { weekday:'short' }),
      count: appointments.filter(a => { const ad = new Date(a.date); return ad.toDateString()===d.toDateString() && a.status!=='cancelled'; }).length,
    }));
  }, [appointments]);

  const trendData = {
    labels: last7.map(d=>d.label),
    datasets: [{ data: last7.map(d=>d.count), borderColor:'#0d9488', backgroundColor:'rgba(13,148,136,.08)', fill:true, tension:.4, pointRadius:3, pointBackgroundColor:'#0d9488' }],
  };

  const deptKey = useMemo(() => normalizeDept(user?.department || user?.specialization), [user?.department, user?.specialization]);
  const deptCfg = DEPT_CONFIG[deptKey] || DEFAULT_DEPT;

  const allPatientsMap = useMemo(() => {
    const map = new Map();
    appointments.forEach(a => { if (a.patient?._id) map.set(a.patient._id, a.patient); });
    return map;
  }, [appointments]);

  // Specialty widget data — shape depends entirely on deptCfg.widget, so
  // each department computes (and later renders) something genuinely
  // different from the others, all sourced from data already on hand.
  const specialtyData = useMemo(() => {
    const w = deptCfg.widget;
    if (w === 'cardiac') {
      const ecgPending = labRecords.filter(r => r.type==='ecg' || /ecg|cardiac/i.test(r.testName||''));
      return { ecgPending, followUpsToday: todaysAppts.filter(a=>a.type==='Follow-up').length };
    }
    if (w === 'vaccination') {
      const milestones = [1,5,10,16];
      const kids = [...allPatientsMap.values()].filter(p => p.age != null && p.age <= 18);
      const due = kids.filter(p => milestones.includes(p.age));
      const vaccRecords = allRecords.filter(r => r.type==='vaccination');
      return { kids, due, vaccRecords };
    }
    if (w === 'antenatal' || w === 'oncology') {
      const matches = appointments.filter(a => kwMatch(a, deptCfg.keywords));
      const byPatient = {};
      matches.forEach(a => {
        const id = a.patient?._id; if (!id) return;
        byPatient[id] = byPatient[id] || { patient:a.patient, visits:0, last:null };
        byPatient[id].visits++;
        if (!byPatient[id].last || new Date(a.date) > new Date(byPatient[id].last)) byPatient[id].last = a.date;
      });
      return { list: Object.values(byPatient) };
    }
    if (w === 'recovery' || w === 'surgery') {
      const matches = appointments.filter(a => kwMatch(a, deptCfg.keywords));
      const byPatient = {};
      matches.forEach(a => {
        const id = a.patient?._id; if (!id) return;
        if (!byPatient[id]) byPatient[id] = { patient:a.patient, first:a.date };
        else if (new Date(a.date) < new Date(byPatient[id].first)) byPatient[id].first = a.date;
      });
      const list = Object.values(byPatient).map(x => ({ ...x, daysSince: Math.max(0, Math.floor((Date.now()-new Date(x.first))/86400000)) }));
      const upcoming = appointments.filter(a => kwMatch(a, deptCfg.keywords) && new Date(a.date) >= new Date(new Date().toDateString()) && a.status !== 'cancelled')
        .sort((a,b)=>new Date(a.date)-new Date(b.date));
      return { list, upcoming };
    }
    if (w === 'therapy') {
      const monthAgo = new Date(); monthAgo.setDate(monthAgo.getDate()-30);
      const matches = appointments.filter(a => kwMatch(a, deptCfg.keywords) && new Date(a.date) >= monthAgo);
      const byPatient = {};
      matches.forEach(a => {
        const id = a.patient?._id; if (!id) return;
        byPatient[id] = byPatient[id] || { patient:a.patient, sessions:0, last:null };
        byPatient[id].sessions++;
        if (!byPatient[id].last || new Date(a.date) > new Date(byPatient[id].last)) byPatient[id].last = a.date;
      });
      return { list: Object.values(byPatient) };
    }
    if (w === 'neuro' || w === 'ent') {
      const matches = appointments.filter(a => kwMatch(a, deptCfg.keywords) && a.status !== 'cancelled').sort((a,b)=>new Date(b.date)-new Date(a.date));
      return { list: matches.slice(0,8) };
    }
    if (w === 'triage') {
      const emergToday = todaysAppts.filter(a => a.type === 'Emergency');
      const critical = emergToday.filter(a => /critical|severe|trauma|arrest/i.test(a.reason||''));
      const urgent = emergToday.filter(a => !critical.includes(a) && /urgent|acute|bleed/i.test(a.reason||''));
      const routine = emergToday.filter(a => !critical.includes(a) && !urgent.includes(a));
      return { critical, urgent, routine };
    }
    if (w === 'icu') {
      return { alerts: vitalsAlerts, monitored: todaysAppts.length };
    }
    if (w === 'imaging') {
      const pendingScans = allRecords.filter(r => ['xray','mri','ct_scan'].includes(r.type) && ['pending','processing'].includes(r.status) && r.doctor?._id === user._id);
      return { pendingScans };
    }
    // chronic — General Medicine and the fallback for any unmatched department
    const now = new Date();
    const byPatient = {};
    appointments.forEach(a => {
      const id = a.patient?._id; if (!id || a.status === 'cancelled') return;
      if (!byPatient[id] || new Date(a.date) > new Date(byPatient[id].last)) byPatient[id] = { patient:a.patient, last:a.date };
    });
    const overdue = Object.values(byPatient).filter(x => (now - new Date(x.last))/86400000 > 90);
    return { overdue };
  }, [deptCfg, appointments, todaysAppts, labRecords, allRecords, vitalsAlerts, allPatientsMap, user._id]);


  return (
    <div>
      {/* Department-themed banner — gradient, icon, and tagline change per specialty */}
      <div style={{ background:deptCfg.grad, borderRadius:18, padding:'22px 26px', marginBottom:16, color:'#fff', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:14 }}>
        <div>
          <div style={{ fontSize:11.5, fontWeight:800, opacity:.75, letterSpacing:.6, textTransform:'uppercase', marginBottom:2 }}>{deptCfg.icon} {deptCfg.tagline}</div>
          <div style={{ fontSize:20, fontWeight:800 }}>Good {new Date().getHours()<12?'morning':new Date().getHours()<17?'afternoon':'evening'}, Dr. {user?.name?.split(' ')[0]}</div>
          <div style={{ fontSize:12.5, opacity:.85, marginTop:3 }}>{new Date().toLocaleDateString('en-US',{ weekday:'long', year:'numeric', month:'long', day:'numeric' })} · {todaysAppts.length} patient{todaysAppts.length!==1?'s':''} today{cabin?.cabinNo ? ` · Cabin ${cabin.cabinNo}${cabin.floor ? `, Floor ${cabin.floor}` : ''}` : ''}</div>
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <button className="btn btn-sm" style={{ background:'rgba(255,255,255,.15)', color:'#fff', border:'1px solid rgba(255,255,255,.3)' }} onClick={()=>navigate('/patients')}>👥 My Patients</button>
          <button className="btn btn-sm" style={{ background:'rgba(255,255,255,.15)', color:'#fff', border:'1px solid rgba(255,255,255,.3)' }} onClick={()=>navigate('/prescriptions')}>💊 Write Prescription</button>
          {nextVideoAppt && (
            <button className="btn btn-sm" style={{ background:'#fff', color:deptCfg.color, fontWeight:800 }} onClick={()=>navigate(`/video-call/${nextVideoAppt._id}`)}>📹 Join Next Video Call ({nextVideoAppt.timeSlot})</button>
          )}
        </div>
      </div>

      {/* ── Specialty widget — unique layout & data per department ── */}
      <div style={{ marginBottom:22 }}>
        {renderSpecialtyWidget(deptCfg, specialtyData, navigate)}
      </div>


      <div style={{ display:'flex', gap:14, flexWrap:'wrap', marginBottom:22 }}>
        <StatPill icon="🗓️" value={todaysAppts.length} label="Patients Today" />
        <StatPill icon="📆" value={weekCount} label="This Week" />
        <StatPill icon="⭐" value={reviews.average ? reviews.average.toFixed(1) : '—'} label={`Avg Rating (${reviews.count})`} />
        <StatPill icon="🧪" value={labRecords.length} label="Lab Reviews Pending" />
        <StatPill icon="🤝" value={peerConsults.length} label="Peer Consults Waiting" />
        <StatPill icon="📋" value={pendingTasks.length} label="Tasks Assigned to Me" />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1.5fr 1fr', gap:20 }}>
        {/* ── Today's Schedule — vertical timeline, not a table ── */}
        <motion.div className="card" initial={{ opacity:0, y:14 }} animate={{ opacity:1, y:0 }}>
          <div className="card-header"><span className="card-title">🕐 Today's Schedule</span><button className="btn btn-outline btn-xs" onClick={()=>navigate('/appointments')}>Full Calendar</button></div>
          <div className="card-body">
            {loading ? <div style={{ textAlign:'center', color:'#94a3b8', padding:30 }}>Loading…</div>
            : todaysAppts.length === 0 ? (
              <div style={{ textAlign:'center', padding:30, color:'#94a3b8' }}>
                <div style={{ fontSize:32, marginBottom:8 }}>🌤️</div>
                No patients scheduled for today
              </div>
            ) : (
              <div style={{ position:'relative', paddingLeft:22 }}>
                <div style={{ position:'absolute', left:6, top:6, bottom:6, width:2, background:'#e2e8f0' }} />
                {todaysAppts.map((a) => (
                  <div key={a._id} style={{ position:'relative', marginBottom:18 }}>
                    <div style={{ position:'absolute', left:-22, top:3, width:12, height:12, borderRadius:'50%', background:TIMELINE_STATUS_COLOR[a.status]||'#94a3b8', border:'2px solid #fff', boxShadow:'0 0 0 2px '+(TIMELINE_STATUS_COLOR[a.status]||'#94a3b8') }} />
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:10, flexWrap:'wrap' }}>
                      <div>
                        <div style={{ fontWeight:800, fontSize:13.5, color:'#0f172a' }}>{a.timeSlot} · {a.patient?.name}</div>
                        <div style={{ fontSize:11.5, color:'#64748b', marginTop:1 }}>{a.type}{a.consultMode==='video' ? ' · 📹 Video' : ''} {a.reason ? `· ${a.reason}` : ''}</div>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <span style={{ fontSize:10.5, fontWeight:700, color:TIMELINE_STATUS_COLOR[a.status]||'#64748b', textTransform:'capitalize' }}>{a.status.replace('_',' ')}</span>
                        {a.consultMode==='video' && a.status==='confirmed' && (
                          <button className="btn btn-xs" style={{ background:'#0d9488', color:'#fff' }} onClick={()=>navigate(`/video-call/${a._id}`)}>Join</button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>

        {/* ── Needs Your Attention ── */}
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <motion.div className="card" initial={{ opacity:0, y:14 }} animate={{ opacity:1, y:0 }} transition={{ delay:.05 }}>
            <div className="card-header"><span className="card-title">🩺 Needs Your Attention</span></div>
            <div className="card-body" style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {vitalsAlerts.length === 0 && labRecords.length === 0 && peerConsults.length === 0 ? (
                <div style={{ textAlign:'center', color:'#94a3b8', fontSize:12.5, padding:10 }}>✅ Nothing urgent right now</div>
              ) : (<>
                {vitalsAlerts.map(v => (
                  <div key={v.id} style={{ background:'#fef2f2', borderLeft:'3px solid #dc2626', borderRadius:8, padding:'8px 10px' }}>
                    <div style={{ fontSize:12, fontWeight:700, color:'#dc2626' }}>⚠️ {v.patientName}</div>
                    <div style={{ fontSize:11, color:'#7f1d1d' }}>{v.reasons?.[0]}</div>
                  </div>
                ))}
                {labRecords.slice(0,3).map(r => (
                  <div key={r._id} style={{ background:'#fffbeb', borderLeft:'3px solid #f59e0b', borderRadius:8, padding:'8px 10px', cursor:'pointer' }} onClick={()=>navigate('/records')}>
                    <div style={{ fontSize:12, fontWeight:700, color:'#92400e' }}>🧪 {r.patient?.name}</div>
                    <div style={{ fontSize:11, color:'#78350f' }}>{r.testName || r.title} — {r.status}</div>
                  </div>
                ))}
                {peerConsults.slice(0,3).map(c => (
                  <div key={c._id} style={{ background:'#eff6ff', borderLeft:'3px solid #2563eb', borderRadius:8, padding:'8px 10px', cursor:'pointer' }} onClick={()=>navigate('/peer-consults')}>
                    <div style={{ fontSize:12, fontWeight:700, color:'#1d4ed8' }}>🤝 Consult from Dr. {c.fromDoctor?.name || 'Colleague'}</div>
                    <div style={{ fontSize:11, color:'#1e40af' }}>{c.summary?.slice(0,60) || 'Awaiting your input'}</div>
                  </div>
                ))}
              </>)}
            </div>
          </motion.div>

          <motion.div className="card" initial={{ opacity:0, y:14 }} animate={{ opacity:1, y:0 }} transition={{ delay:.08 }}>
            <div className="card-header"><span className="card-title">📋 My Tasks</span>{pendingTasks.length > 0 && <span className="badge badge-warning">{pendingTasks.length}</span>}</div>
            <div className="card-body" style={{ display:'flex', flexDirection:'column', gap:7, maxHeight:180, overflowY:'auto' }}>
              {pendingTasks.length === 0 ? (
                <div style={{ textAlign:'center', color:'#94a3b8', fontSize:12.5, padding:8 }}>✅ No tasks assigned to you right now</div>
              ) : pendingTasks.slice(0,5).map(t => (
                <div key={t._id} style={{ background: t.priority==='urgent' ? '#fef2f2' : '#f8fafc', borderLeft:`3px solid ${t.priority==='urgent'?'#dc2626':'#0d9488'}`, borderRadius:8, padding:'7px 10px' }}>
                  <div style={{ fontSize:12, fontWeight:700, color:'#0f172a' }}>{t.title}</div>
                  <div style={{ fontSize:10.5, color:'#94a3b8' }}>By {t.assignedBy?.name || 'Admin'}{t.dueDate ? ` · Due ${new Date(t.dueDate).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}` : ''}</div>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div className="card" initial={{ opacity:0, y:14 }} animate={{ opacity:1, y:0 }} transition={{ delay:.1 }}>
            <div className="card-header"><span className="card-title">📈 My Patient Load (7 days)</span></div>
            <div className="card-body" style={{ height:120 }}>
              <Line data={trendData} options={{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display:false } }, scales:{ x:{ grid:{ display:false }, ticks:{ font:{ size:10 } } }, y:{ display:false, beginAtZero:true } } }} />
            </div>
          </motion.div>
        </div>
      </div>

      {reviews.data.length > 0 && (
        <motion.div className="card mt-2" initial={{ opacity:0, y:14 }} animate={{ opacity:1, y:0 }} transition={{ delay:.15 }}>
          <div className="card-header"><span className="card-title">⭐ Recent Patient Feedback</span></div>
          <div className="card-body" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            {reviews.data.slice(0,4).map(r => (
              <div key={r._id} style={{ background:'#f8fafc', borderRadius:10, padding:'10px 12px' }}>
                <div style={{ fontSize:12.5, fontWeight:700 }}>{'★'.repeat(r.rating)}{'☆'.repeat(5-r.rating)} <span style={{ color:'#94a3b8', fontWeight:500 }}>· {r.patient?.name || 'Patient'}</span></div>
                {r.comment && <div style={{ fontSize:12, color:'#475569', marginTop:4 }}>{r.comment}</div>}
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}

// ── Small shared pieces used inside specialty widgets ───────────────────
function ProgressBar({ pct, color }) {
  return (
    <div style={{ height:7, background:'#f1f5f9', borderRadius:4, overflow:'hidden' }}>
      <motion.div initial={{ width:0 }} animate={{ width:`${Math.min(pct,100)}%` }} transition={{ duration:.6 }} style={{ height:'100%', background:color, borderRadius:4 }} />
    </div>
  );
}
function EmptySpecialty({ icon, text }) {
  return <div style={{ textAlign:'center', color:'#94a3b8', fontSize:12.5, padding:'22px 10px' }}><div style={{ fontSize:28, marginBottom:6 }}>{icon}</div>{text}</div>;
}

// Renders a completely different card per department — different layout
// shape (stat row / kanban / progress list / card grid), not just a
// recolored copy of the same component.
function renderSpecialtyWidget(cfg, data, navigate) {
  const wrap = (title, children) => (
    <motion.div className="card" initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} style={{ borderTop:`3px solid ${cfg.color}` }}>
      <div className="card-header"><span className="card-title">{cfg.icon} {title}</span></div>
      <div className="card-body">{children}</div>
    </motion.div>
  );

  switch (cfg.widget) {

    case 'cardiac': return wrap('Cardiac Watch', (
      <div style={{ display:'flex', gap:14, flexWrap:'wrap' }}>
        <div style={{ flex:1, minWidth:160, background:'#fef2f2', borderRadius:12, padding:14, textAlign:'center' }}>
          <div style={{ fontSize:26, fontWeight:900, color:'#dc2626' }}>{data.ecgPending.length}</div>
          <div style={{ fontSize:11.5, color:'#7f1d1d', fontWeight:700 }}>ECG Reviews Pending</div>
        </div>
        <div style={{ flex:1, minWidth:160, background:'#fff1f2', borderRadius:12, padding:14, textAlign:'center' }}>
          <div style={{ fontSize:26, fontWeight:900, color:'#be123c' }}>{data.followUpsToday}</div>
          <div style={{ fontSize:11.5, color:'#881337', fontWeight:700 }}>Cardiac Follow-Ups Today</div>
        </div>
        <div style={{ flex:2, minWidth:220 }}>
          {data.ecgPending.length===0 ? <EmptySpecialty icon="❤️" text="No ECGs waiting on your review." /> : data.ecgPending.slice(0,4).map(r=>(
            <div key={r._id} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px dashed #fecaca', fontSize:12.5 }}>
              <span style={{ fontWeight:700 }}>{r.patient?.name}</span><span style={{ color:'#dc2626' }}>{r.testName||'ECG'}</span>
            </div>
          ))}
        </div>
      </div>
    ));

    case 'vaccination': return wrap('Vaccination Tracker', (
      <div>
        <div style={{ fontSize:11.5, color:'#64748b', marginBottom:10 }}>Age-milestone based — cross-check against each child's actual immunization card.</div>
        {data.due.length===0 ? <EmptySpecialty icon="🧸" text="No patients at a vaccine-milestone age right now." /> : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))', gap:10, marginBottom:12 }}>
            {data.due.map(p=>(
              <div key={p._id} style={{ background:'#e0f2fe', borderRadius:12, padding:'10px 12px' }}>
                <div style={{ fontWeight:800, fontSize:12.5, color:'#0c4a6e' }}>{p.name}</div>
                <div style={{ fontSize:11, color:'#0369a1' }}>Age {p.age} · booster due</div>
              </div>
            ))}
          </div>
        )}
        <div style={{ fontSize:11.5, color:'#0ea5e9', fontWeight:700 }}>{data.vaccRecords.length} vaccination record{data.vaccRecords.length!==1?'s':''} on file · {data.kids.length} pediatric patient{data.kids.length!==1?'s':''} total</div>
      </div>
    ));

    case 'antenatal': return wrap('Antenatal Care Tracker', data.list.length===0 ? <EmptySpecialty icon="🤰" text="No antenatal patients matched from recent visits." /> : (
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        {data.list.map(x=>{
          const trimester = x.visits<=3?'1st Trimester':x.visits<=6?'2nd Trimester':'3rd Trimester';
          return (
            <div key={x.patient._id}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:12.5, marginBottom:4 }}>
                <span style={{ fontWeight:700 }}>{x.patient.name}</span>
                <span style={{ color:cfg.color, fontWeight:700 }}>{trimester} · Visit {x.visits}/8</span>
              </div>
              <ProgressBar pct={(x.visits/8)*100} color={cfg.color} />
            </div>
          );
        })}
      </div>
    ));

    case 'recovery': return wrap('Recovery Tracker', data.list.length===0 ? <EmptySpecialty icon="🦴" text="No post-op / recovery patients matched from recent visits." /> : (
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        {data.list.map(x=>(
          <div key={x.patient._id}>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:12.5, marginBottom:4 }}>
              <span style={{ fontWeight:700 }}>{x.patient.name}</span>
              <span style={{ color:cfg.color, fontWeight:700 }}>Day {x.daysSince} of ~90</span>
            </div>
            <ProgressBar pct={(x.daysSince/90)*100} color={cfg.color} />
          </div>
        ))}
      </div>
    ));

    case 'oncology': return wrap('Treatment Cycle Tracker', data.list.length===0 ? <EmptySpecialty icon="🎗️" text="No active treatment cycles matched from recent visits." /> : (
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:10 }}>
        {data.list.map(x=>{
          const next = new Date(x.last); next.setDate(next.getDate()+21);
          return (
            <div key={x.patient._id} style={{ background:'#fef9c3', borderRadius:12, padding:'10px 12px' }}>
              <div style={{ fontWeight:800, fontSize:12.5, color:'#713f12' }}>{x.patient.name}</div>
              <div style={{ fontSize:11, color:'#854d0e', marginTop:2 }}>Cycle {x.visits} completed</div>
              <div style={{ fontSize:10.5, color:'#a16207', marginTop:2 }}>Est. next cycle: {next.toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</div>
            </div>
          );
        })}
      </div>
    ));

    case 'surgery': return (
      <motion.div className="card" initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} style={{ borderTop:`3px solid ${cfg.color}` }}>
        <div className="card-header"><span className="card-title">{cfg.icon} Surgical Planning Board</span></div>
        <div className="card-body" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          <div>
            <div style={{ fontSize:11.5, fontWeight:800, color:'#334155', marginBottom:8, textTransform:'uppercase', letterSpacing:.4 }}>📅 Upcoming Surgeries</div>
            {data.upcoming.length===0 ? <EmptySpecialty icon="🗓️" text="Nothing scheduled." /> : data.upcoming.slice(0,5).map(a=>(
              <div key={a._id} style={{ padding:'6px 0', borderBottom:'1px dashed #e2e8f0', fontSize:12 }}>
                <strong>{a.patient?.name}</strong> — {new Date(a.date).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}, {a.timeSlot}
              </div>
            ))}
          </div>
          <div>
            <div style={{ fontSize:11.5, fontWeight:800, color:'#334155', marginBottom:8, textTransform:'uppercase', letterSpacing:.4 }}>🩹 Post-Op Recovery</div>
            {data.list.length===0 ? <EmptySpecialty icon="🩹" text="No recovering patients tracked." /> : data.list.slice(0,5).map(x=>(
              <div key={x.patient._id} style={{ marginBottom:8 }}>
                <div style={{ fontSize:12, fontWeight:700 }}>{x.patient.name} · Day {x.daysSince}</div>
                <ProgressBar pct={(x.daysSince/90)*100} color={cfg.color} />
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    );

    case 'therapy': return wrap('Session Tracker (Last 30 Days)', data.list.length===0 ? <EmptySpecialty icon="🧘" text="No therapy sessions logged in the last 30 days." /> : (
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {data.list.map(x=>(
          <div key={x.patient._id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', background:'#eef2ff', borderRadius:10, padding:'8px 12px' }}>
            <span style={{ fontWeight:700, fontSize:12.5, color:'#312e81' }}>{x.patient.name}</span>
            <span style={{ fontSize:11.5, color:'#4338ca' }}>{x.sessions} session{x.sessions!==1?'s':''} · last {new Date(x.last).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</span>
          </div>
        ))}
      </div>
    ));

    case 'neuro': case 'ent': return wrap(cfg.widget==='neuro'?'Neuro Follow-Up Queue':'ENT Case Queue', data.list.length===0 ? <EmptySpecialty icon={cfg.icon} text="No matching cases from recent visits." /> : (
      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        {data.list.map(a=>(
          <div key={a._id} style={{ display:'flex', justifyContent:'space-between', borderLeft:`3px solid ${cfg.color}`, background:'#f8fafc', borderRadius:8, padding:'7px 11px' }}>
            <div><div style={{ fontWeight:700, fontSize:12.5 }}>{a.patient?.name}</div><div style={{ fontSize:11, color:'#64748b' }}>{a.reason||a.type}</div></div>
            <div style={{ fontSize:10.5, color:'#94a3b8', whiteSpace:'nowrap' }}>{new Date(a.date).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</div>
          </div>
        ))}
      </div>
    ));

    case 'triage': return (
      <motion.div className="card" initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} style={{ borderTop:`3px solid ${cfg.color}` }}>
        <div className="card-header"><span className="card-title">{cfg.icon} Emergency Triage Board — Today</span></div>
        <div className="card-body" style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
          {[['🔴 Critical',data.critical,'#dc2626','#fef2f2'],['🟠 Urgent',data.urgent,'#f59e0b','#fffbeb'],['⚪ Routine',data.routine,'#64748b','#f8fafc']].map(([label,list,c,bg])=>(
            <div key={label} style={{ background:bg, borderRadius:12, padding:10, minHeight:100 }}>
              <div style={{ fontWeight:800, fontSize:12, color:c, marginBottom:6 }}>{label} ({list.length})</div>
              {list.length===0 ? <div style={{ fontSize:11, color:'#94a3b8' }}>None</div> : list.map(a=>(
                <div key={a._id} style={{ fontSize:11.5, fontWeight:600, padding:'4px 0', borderBottom:'1px dashed rgba(0,0,0,.06)' }}>{a.patient?.name} · {a.timeSlot}</div>
              ))}
            </div>
          ))}
        </div>
      </motion.div>
    );

    case 'icu': return wrap('Critical Monitoring Panel', (
      <div>
        <div style={{ display:'flex', gap:14, marginBottom:12 }}>
          <div style={{ flex:1, background:'#450a0a', borderRadius:12, padding:16, textAlign:'center' }}>
            <div style={{ fontSize:30, fontWeight:900, color:'#fecaca' }}>{data.alerts.length}</div>
            <div style={{ fontSize:11, color:'#fca5a5', fontWeight:700 }}>Active Vitals Alerts</div>
          </div>
          <div style={{ flex:1, background:'#1c1917', borderRadius:12, padding:16, textAlign:'center' }}>
            <div style={{ fontSize:30, fontWeight:900, color:'#fed7aa' }}>{data.monitored}</div>
            <div style={{ fontSize:11, color:'#fdba74', fontWeight:700 }}>Patients Under Care Today</div>
          </div>
        </div>
        {data.alerts.length===0 ? <EmptySpecialty icon="🚨" text="No critical vitals alerts right now." /> : data.alerts.map(v=>(
          <div key={v.id} style={{ background:'#fef2f2', borderLeft:'3px solid #b91c1c', borderRadius:8, padding:'8px 10px', marginBottom:6 }}>
            <div style={{ fontSize:12, fontWeight:700, color:'#b91c1c' }}>{v.patientName}</div>
            <div style={{ fontSize:11, color:'#7f1d1d' }}>{v.reasons?.[0]}</div>
          </div>
        ))}
      </div>
    ));

    case 'imaging': return wrap('Imaging Review Queue', data.pendingScans.length===0 ? <EmptySpecialty icon="🩻" text="No scans waiting on your report." /> : (
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {data.pendingScans.map(r=>(
          <div key={r._id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', background:'#eef2ff', borderRadius:10, padding:'8px 12px', cursor:'pointer' }} onClick={()=>navigate('/records')}>
            <div><span style={{ marginRight:6 }}>{r.type==='xray'?'🩻':r.type==='mri'?'🧲':'🖥️'}</span><strong style={{ fontSize:12.5 }}>{r.patient?.name}</strong></div>
            <span style={{ fontSize:11, color:'#4f46e5', fontWeight:700, textTransform:'uppercase' }}>{r.type.replace('_',' ')}</span>
          </div>
        ))}
      </div>
    ));

    default: return wrap('Chronic Care Follow-Up Tracker', data.overdue.length===0 ? <EmptySpecialty icon="🩺" text="No patients overdue for a check-up (90+ days since last visit)." /> : (
      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        {data.overdue.slice(0,6).map(x=>(
          <div key={x.patient._id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', background:'#f0fdfa', borderRadius:10, padding:'8px 12px' }}>
            <div><div style={{ fontWeight:700, fontSize:12.5 }}>{x.patient.name}</div><div style={{ fontSize:11, color:'#64748b' }}>Last visit {new Date(x.last).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</div></div>
            <button className="btn btn-xs" style={{ background:cfg.color, color:'#fff' }} onClick={()=>navigate('/appointments')}>Schedule Follow-Up</button>
          </div>
        ))}
      </div>
    ));
  }
}
