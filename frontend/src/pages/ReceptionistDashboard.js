import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { appointmentsAPI, usersAPI, leavesAPI, tasksAPI, facilityAPI, checklistAPI, staffLogsAPI, entryAPI, queueAPI, ambulanceTripsAPI, admissionAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { getSocket } from '../utils/socket';
import { StaffExtraTools, MyActivityWidget } from '../components/DashboardWidgets';
import toast from 'react-hot-toast';

const SLOTS = [
  '09:00 AM','09:30 AM','10:00 AM','10:30 AM',
  '11:00 AM','11:30 AM','02:00 PM','02:30 PM',
  '03:00 PM','03:30 PM','04:00 PM','04:30 PM',
];
const STATUS_CFG = {
  pending:   { bg:'#fef3c7', c:'#92400e', label:'Pending'   },
  confirmed: { bg:'#dcfce7', c:'#15803d', label:'Confirmed' },
  completed: { bg:'#e0f2fe', c:'#0369a1', label:'Completed' },
  cancelled: { bg:'#fee2e2', c:'#dc2626', label:'Cancelled' },
};

const CHECKLIST_ITEMS = [
  'Register new patient walk-ins',
  'Confirm tomorrow\'s appointment list with doctors',
  'Update visitor log at front desk',
  'Answer phone & email queries',
  'Verify insurance documents for new admissions',
  'Process discharge paperwork',
  'Hand over end-of-shift notes',
];

const VISITOR_PURPOSES = ['Patient Visit','Vendor/Delivery','Maintenance','Interview','Official Visit','Other'];

export default function ReceptionistDashboard() {
  const { user } = useAuth();
  const { t } = useLanguage() || { t: (k) => k };

  // Data
  const [appointments, setAppointments] = useState([]);
  const [doctors,      setDoctors]      = useState([]);
  const [patients,     setPatients]     = useState([]);
  const [tasks,        setTasks]        = useState([]);
  const [schedules,    setSchedules]    = useState([]);
  const [leaves,       setLeaves]       = useState([]);
  const [loading,      setLoading]      = useState(true);

  // UI
  const [tab,          setTab]          = useState('overview');
  const [showBook,     setShowBook]     = useState(false);
  const [showReg,      setShowReg]      = useState(false);
  const [selectedAppt, setSelectedAppt] = useState(null);
  const [slots,        setSlots]        = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [submitting,   setSubmitting]   = useState(false);
  const [search,       setSearch]       = useState('');
  const [checklist,    setChecklist]    = useState({});
  const [visitors,     setVisitors]     = useState([]);
  const [closingVisitorId, setClosingVisitorId] = useState(null);
  const closeVisitorLog = async (id) => {
    setClosingVisitorId(id);
    try {
      const res = await staffLogsAPI.close(id, 'Signed out at front desk');
      setVisitors(vs => vs.map(v => v._id === id ? res.data.data : v));
      toast.success('Visitor signed out');
    } catch (e) { toast.error(e.response?.data?.error || 'Failed to update'); }
    setClosingVisitorId(null);
  };
  const [showVisitorModal, setShowVisitorModal] = useState(false);
  const [visitorForm,  setVisitorForm]  = useState({ category:'visitor_log', title:'', details:'', location:'', priority:'low' });
  const [submittingVisitor, setSubmittingVisitor] = useState(false);
  const [pendingEntries, setPendingEntries] = useState([]);
  const [rooms,          setRooms]          = useState([]);
  const [wardboys,       setWardboys]       = useState([]);;
  const [verifying,      setVerifying]      = useState(null);
  const [otpInputs,      setOtpInputs]      = useState({}); // { [entryId]: '123456' }
  const [bedLikelyInputs, setBedLikelyInputs] = useState({}); // { [entryId]: true/false }
  const [deletingEntryId, setDeletingEntryId] = useState(null);
  const [admissionQueue, setAdmissionQueue] = useState([]);
  const [admissionQueueLoading, setAdmissionQueueLoading] = useState(false);
  const [admitTarget, setAdmitTarget] = useState(null); // appointment (with admission.status==='confirmed') being assigned a bed
  const [admitRoomId, setAdmitRoomId] = useState('');
  const [admitWardboyId, setAdmitWardboyId] = useState('');
  const [admitRoomCharge, setAdmitRoomCharge] = useState('');
  const [admitting, setAdmitting] = useState(false);
  const [queue,          setQueue]          = useState([]);
  const [queueLoading,   setQueueLoading]   = useState(false);
  const [tokenForm, setTokenForm] = useState({ department:'General Medicine', patientName:'', phone:'', purpose:'', doctorId:'' });
  const [creatingToken, setCreatingToken] = useState(false);
  const [updatingTokenId, setUpdatingTokenId] = useState(null);
  const [ambTrips, setAmbTrips] = useState([]);
  const [ambLoading, setAmbLoading] = useState(false);

  // Book form
  const [bookForm, setBookForm] = useState({
    doctorId:'', date: new Date().toISOString().split('T')[0],
    timeSlot:'', type:'Consultation', notes:'', patientId:'',
  });

  // Walk-in registration form
  const [regForm, setRegForm] = useState({
    name:'', email:'', phone:'', age:'', bloodGroup:'', address:'',
  });

  const today = new Date().toDateString();
  const userId = user?._id || user?.id;

  const load = useCallback(async () => {
    setLoading(true);
    const [aRes, dRes, pRes, tkRes, scRes, lvRes, clRes, vlRes, peRes, roomRes, wbRes] = await Promise.allSettled([
      appointmentsAPI.getAll({ limit: 200 }),
      usersAPI.getAll({ role: 'doctor', status: 'approved', limit: 100 }),
      usersAPI.getAll({ role: 'patient', status: 'approved', limit: 200 }),
      tasksAPI.getAll(),
      facilityAPI.getSchedules({ userId, week: new Date().toISOString() }),
      leavesAPI.getAll({ status: 'approved' }),
      checklistAPI.getToday(),
      staffLogsAPI.getAll({ category: 'visitor_log' }),
      entryAPI.getPending(),
      facilityAPI.getRooms(),
      usersAPI.getAll({ role: 'wardboy', status: 'approved', limit: 100 }),
    ]);
    if (aRes.status === 'fulfilled') setAppointments(aRes.value?.data?.data || []);
    if (dRes.status === 'fulfilled') setDoctors(dRes.value?.data?.data || []);
    if (pRes.status === 'fulfilled') setPatients(pRes.value?.data?.data || []);
    if (tkRes.status === 'fulfilled') setTasks(tkRes.value?.data?.data || []);
    if (scRes.status === 'fulfilled') setSchedules(scRes.value?.data?.data || []);
    if (lvRes.status === 'fulfilled') setLeaves(lvRes.value?.data?.data || []);
    if (clRes.status === 'fulfilled') setChecklist(clRes.value?.data?.data?.items || {});
    if (vlRes.status === 'fulfilled') setVisitors(vlRes.value?.data?.data || []);
    if (peRes.status === 'fulfilled') setPendingEntries(peRes.value?.data?.data || []);
    if (roomRes.status === 'fulfilled') setRooms(roomRes.value?.data?.data || []);
    if (wbRes.status === 'fulfilled') setWardboys(wbRes.value?.data?.data || []);
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const loadQueue = useCallback(() => {
    setQueueLoading(true);
    queueAPI.getQueue().then(r => setQueue(r.data.data || [])).catch(()=>{}).finally(()=>setQueueLoading(false));
  }, []);
  useEffect(() => { loadQueue(); }, [loadQueue]);

  const loadAmbTrips = useCallback(() => {
    setAmbLoading(true);
    ambulanceTripsAPI.getAll().then(r => setAmbTrips(r.data.data || [])).catch(()=>{}).finally(()=>setAmbLoading(false));
  }, []);
  useEffect(() => { loadAmbTrips(); }, [loadAmbTrips]);
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    socket.on('ambulance_requested', loadAmbTrips);
    socket.on('ambulance_trip_updated', loadAmbTrips);
    return () => { socket.off('ambulance_requested', loadAmbTrips); socket.off('ambulance_trip_updated', loadAmbTrips); };
  }, [loadAmbTrips]);

  const createToken = async () => {
    if (!tokenForm.patientName.trim() || !tokenForm.department) { toast.error('Patient name and department are required'); return; }
    setCreatingToken(true);
    try {
      const res = await queueAPI.createToken(tokenForm);
      toast.success(`🎫 Token #${res.data.data.tokenNumber} issued for ${tokenForm.department}`);
      setTokenForm(f => ({ ...f, patientName:'', phone:'', purpose:'' }));
      loadQueue();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed to create token'); }
    setCreatingToken(false);
  };

  const setTokenStatus = async (id, status) => {
    setUpdatingTokenId(id);
    try { await queueAPI.updateStatus(id, status); loadQueue(); }
    catch { toast.error('Failed to update token'); }
    setUpdatingTokenId(null);
  };

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onQueueChange = () => loadQueue();
    socket.on('queue_token_created', onQueueChange);
    socket.on('queue_token_updated', onQueueChange);
    return () => { socket.off('queue_token_created', onQueueChange); socket.off('queue_token_updated', onQueueChange); };
  }, [loadQueue]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    socket.emit('join_user_room', userId);
    const onAppt = () => load();
    const onTask = (data) => {
      toast(`📋 New task: ${data.title}`, { duration: 5000 });
      load();
    };
    const onNewEntry = () => load();
    socket.on('new_appointment', onAppt);
    socket.on('task_assigned',   onTask);
    socket.on('appointment_updated', onNewEntry);
    return () => { socket.off('new_appointment', onAppt); socket.off('task_assigned', onTask); socket.off('appointment_updated', onNewEntry); };
  }, [load, userId]);

  // Load available slots when doctor/date changes
  useEffect(() => {
    if (!bookForm.doctorId || !bookForm.date) { setSlots([]); return; }
    setSlotsLoading(true);
    appointmentsAPI.getSlots(bookForm.doctorId, bookForm.date)
      .then(res => {
        const d = res?.data?.data || {};
        if (d.doctorOnLeave) {
          toast(d.leaveMessage || 'Doctor is on leave', { icon: '🏥', duration: 6000 });
          setSlots([]);
        } else {
          setSlots(d.available || []);
        }
      })
      .catch(() => setSlots(SLOTS))
      .finally(() => setSlotsLoading(false));
  }, [bookForm.doctorId, bookForm.date]);

  // ── Patient check-in: verify OTP; only flag for a possible bed if reception
  // judges it's needed — most patients just proceed straight to the queue ──
  const verifyEntryOTP = async (entry) => {
    const otp = (otpInputs[entry._id] || '').trim();
    if (otp.length !== 6) { toast.error('Enter the 6-digit code the patient gives you'); return; }
    setVerifying(entry._id);
    try {
      const bedLikely = !!bedLikelyInputs[entry._id];
      const res = await entryAPI.verify(entry.appointment._id, otp, bedLikely);
      toast.success(res.data.message || `✅ ${res.data.data.patient.name} checked in!`);
      setPendingEntries(es => es.filter(e => e._id !== entry._id));
      setOtpInputs(o => { const n = { ...o }; delete n[entry._id]; return n; });
      setBedLikelyInputs(o => { const n = { ...o }; delete n[entry._id]; return n; });
      if (bedLikely) loadAdmissionQueue();
    } catch (e) { toast.error(e.response?.data?.error || 'Verification failed'); }
    setVerifying(null);
  };

  const deleteEntry = async (entry) => {
    if (!window.confirm(`Remove ${entry.patient?.name}'s check-in entry? They'll need a new entry code to check in.`)) return;
    setDeletingEntryId(entry._id);
    try {
      await entryAPI.delete(entry._id);
      toast.success('Entry removed');
      setPendingEntries(es => es.filter(e => e._id !== entry._id));
    } catch (e) { toast.error(e.response?.data?.error || 'Failed to delete entry'); }
    setDeletingEntryId(null);
  };

  const loadAdmissionQueue = useCallback(() => {
    setAdmissionQueueLoading(true);
    appointmentsAPI.getAdmissionQueue()
      .then(r => setAdmissionQueue(r.data.data || []))
      .catch(() => {})
      .finally(() => setAdmissionQueueLoading(false));
  }, []);
  useEffect(() => { loadAdmissionQueue(); }, [loadAdmissionQueue]);
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    socket.on('admission_confirmed', loadAdmissionQueue);
    return () => { socket.off('admission_confirmed', loadAdmissionQueue); };
  }, [loadAdmissionQueue]);

  const openAssignBed = (appt) => {
    setAdmitTarget(appt);
    setAdmitRoomId(''); setAdmitWardboyId(''); setAdmitRoomCharge('');
  };

  const assignBedToPatient = async () => {
    if (!admitRoomId || !admitRoomCharge) { toast.error('Select a room and enter the room charge/day'); return; }
    setAdmitting(true);
    try {
      await admissionAPI.admit({
        patientId: admitTarget.patient._id,
        roomId: admitRoomId,
        admittingDoctorId: admitTarget.doctor._id,
        reasonForAdmission: admitTarget.admission?.reason || 'Admission',
        roomChargePerDay: Number(admitRoomCharge),
        appointmentId: admitTarget._id,
        wardboyId: admitWardboyId || undefined,
      });
      toast.success('✅ Bed assigned — patient admitted');
      setAdmitTarget(null);
      loadAdmissionQueue();
      load();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed to assign bed'); }
    setAdmitting(false);
  };

  // Book appointment
  const bookAppointment = async (e) => {
    e.preventDefault();
    if (!bookForm.doctorId || !bookForm.timeSlot || !bookForm.patientId) {
      toast.error('Select doctor, patient and time slot'); return;
    }
    setSubmitting(true);
    try {
      await appointmentsAPI.create({
        doctorId: bookForm.doctorId,
        date:     bookForm.date,
        timeSlot: bookForm.timeSlot,
        type:     bookForm.type,
        notes:    bookForm.notes,
        patient:  bookForm.patientId,
      });
      toast.success('✅ Appointment booked!');
      setShowBook(false);
      setBookForm({ doctorId:'', date: new Date().toISOString().split('T')[0], timeSlot:'', type:'Consultation', notes:'', patientId:'' });
      load();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Booking failed');
    }
    setSubmitting(false);
  };

  // Update appointment status
  const updateStatus = async (id, status) => {
    try {
      await appointmentsAPI.update(id, { status });
      setAppointments(prev => prev.map(a => a._id === id ? { ...a, status } : a));
      if (selectedAppt?._id === id) setSelectedAppt(a => ({ ...a, status }));
      toast.success(`Appointment ${status}`);
    } catch { toast.error('Update failed'); }
  };

  // Doctors on leave today
  const doctorsOnLeave = leaves.filter(l => {
    const from = new Date(l.from); from.setHours(0,0,0,0);
    const to   = new Date(l.to);   to.setHours(23,59,59,999);
    const now  = new Date(); now.setHours(0,0,0,0);
    return from <= now && to >= now;
  });
  const doctorOnLeaveIds = new Set(doctorsOnLeave.map(l => l.user?._id?.toString() || l.user?.toString()));

  // Today's appointments
  const todayAppts  = appointments.filter(a => new Date(a.date).toDateString() === today);
  const pendingAppts= appointments.filter(a => a.status === 'pending');
  const myTasks     = tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled');
  const urgentTasks = myTasks.filter(t => t.priority === 'urgent');

  const filteredAppts = appointments.filter(a => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (a.patient?.name || '').toLowerCase().includes(q) ||
           (a.doctor?.name  || '').toLowerCase().includes(q) ||
           (a.timeSlot      || '').toLowerCase().includes(q);
  });

  const TABS = [
    { id:'overview',     label:'📊 Overview'    },
    { id:'appointments', label:`📅 Appointments${pendingAppts.length > 0 ? ` (${pendingAppts.length})` : ''}` },
    { id:'checkin',       label:`🎫 ${t('reception.checkin')}${pendingEntries.length > 0 ? ` (${pendingEntries.length})` : ''}` },
    { id:'beds',          label:`🛏️ ${t('reception.bedRequests')}${admissionQueue.length > 0 ? ` (${admissionQueue.length})` : ''}` },
    { id:'queue',        label:`🔢 Walk-in Queue${queue.filter(q=>q.status==='waiting').length > 0 ? ` (${queue.filter(q=>q.status==='waiting').length})` : ''}` },
    { id:'ambulance',    label:`🚑 Ambulance${ambTrips.filter(t=>['requested','dispatched','en_route'].includes(t.status)).length > 0 ? ` (${ambTrips.filter(t=>['requested','dispatched','en_route'].includes(t.status)).length})` : ''}` },
    { id:'doctors',      label:'👨‍⚕️ Doctors'       },
    { id:'tasks',        label:`📋 My Tasks${myTasks.length > 0 ? ` (${myTasks.length})` : ''}` },
    { id:'schedule',     label:'🗓️ My Schedule'  },
    { id:'checklist',    label:'✅ Checklist'    },
    { id:'visitors',     label:`👤 Visitor Log${visitors.length > 0 ? ` (${visitors.length})` : ''}` },
  ];

  const inp = { width:'100%', padding:'10px 12px', border:'1.5px solid #e2e8f0', borderRadius:10, fontSize:13.5, outline:'none', fontFamily:'inherit' };
  const lbl = { display:'block', fontSize:11.5, fontWeight:700, color:'#374151', marginBottom:5, textTransform:'uppercase', letterSpacing:0.4 };

  if (loading) return (
    <div style={{ display:'flex', justifyContent:'center', alignItems:'center', height:300 }}>
      <div style={{ width:36, height:36, border:'3px solid #e2e8f0', borderTopColor:'#db2777', borderRadius:'50%', animation:'spin .9s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ fontFamily:"'Inter',system-ui,sans-serif" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>

      {/* ── HEADER ── */}
      <div style={{ background:'linear-gradient(135deg,#be185d 0%,#db2777 100%)', borderRadius:20, padding:'22px 28px', marginBottom:22, position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:-40, right:-40, width:200, height:200, borderRadius:'50%', background:'rgba(255,255,255,.07)', pointerEvents:'none' }} />
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:16, position:'relative' }}>
          <div style={{ display:'flex', alignItems:'center', gap:16 }}>
            <motion.div animate={{ rotate:[0,5,-5,0] }} transition={{ duration:3, repeat:Infinity }}
              style={{ width:58, height:58, borderRadius:18, background:'rgba(255,255,255,.18)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:28 }}>
              🏨
            </motion.div>
            <div>
              <div style={{ color:'rgba(255,255,255,.7)', fontSize:11.5, letterSpacing:1.2, textTransform:'uppercase', fontWeight:700 }}>Reception Desk</div>
              <h1 style={{ color:'#fff', fontWeight:900, fontSize:20, margin:'2px 0' }}>Receptionist Dashboard</h1>
              <p style={{ color:'rgba(255,255,255,.65)', margin:0, fontSize:13 }}>
                {user?.name} · {new Date().toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}
              </p>
            </div>
          </div>
          <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
            <button onClick={() => setShowBook(true)}
              style={{ padding:'10px 20px', background:'rgba(255,255,255,.2)', border:'2px solid rgba(255,255,255,.4)', borderRadius:11, color:'#fff', fontSize:13.5, fontWeight:800, cursor:'pointer', backdropFilter:'blur(10px)' }}>
              📅 Book Appointment
            </button>
          </div>
        </div>
      </div>

      {/* Urgent alerts */}
      {urgentTasks.length > 0 && (
        <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:12, padding:'11px 18px', marginBottom:16, display:'flex', alignItems:'center', gap:10 }}>
          <motion.span animate={{ scale:[1,1.2,1] }} transition={{ duration:1, repeat:Infinity }} style={{ fontSize:18 }}>🚨</motion.span>
          <span style={{ fontWeight:700, color:'#dc2626', fontSize:13 }}>Urgent tasks: </span>
          <span style={{ color:'#ef4444', fontSize:13 }}>{urgentTasks.map(t => t.title).join(' · ')}</span>
        </div>
      )}

      {/* Doctors on leave today */}
      {doctorsOnLeave.length > 0 && (
        <div style={{ background:'#fffbeb', border:'1px solid #fde68a', borderRadius:12, padding:'11px 18px', marginBottom:16, display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
          <span style={{ fontSize:18 }}>🏥</span>
          <span style={{ fontWeight:700, color:'#92400e', fontSize:13 }}>Doctors on leave today: </span>
          <span style={{ color:'#d97706', fontSize:13 }}>{doctorsOnLeave.map(l => l.user?.name || 'Doctor').join(', ')}</span>
          <span style={{ color:'#92400e', fontSize:12 }}>— Do not book appointments for them.</span>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display:'flex', gap:4, marginBottom:20, background:'#f1f5f9', padding:4, borderRadius:12, width:'fit-content', overflowX:'auto' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ padding:'8px 16px', borderRadius:10, border:'none', fontWeight:700, fontSize:12.5, cursor:'pointer', whiteSpace:'nowrap', background:tab===t.id?'#fff':'transparent', color:tab===t.id?'#db2777':'#64748b', boxShadow:tab===t.id?'0 1px 6px rgba(0,0,0,.09)':'none', fontFamily:'inherit' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      {tab === 'overview' && (
        <div>
          {/* Stats */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:12, marginBottom:22 }}>
            {[
              { icon:'📅', label:"Today's Appts",    val:todayAppts.length,                                        bg:'#eff6ff', c:'#1d4ed8' },
              { icon:'⏳', label:'Pending',           val:pendingAppts.length,                                      bg:'#fef3c7', c:'#92400e' },
              { icon:'✅', label:'Confirmed Today',   val:todayAppts.filter(a=>a.status==='confirmed').length,      bg:'#dcfce7', c:'#15803d' },
              { icon:'👥', label:'Total Patients',    val:patients.length,                                          bg:'#f5f3ff', c:'#6d28d9' },
              { icon:'👨‍⚕️',label:'Doctors Available', val:doctors.length - doctorsOnLeave.length,                  bg:'#e0f2fe', c:'#0369a1' },
              { icon:'📋', label:'My Tasks',          val:myTasks.length,                                           bg:'#fce7f3', c:'#be185d' },
            ].map((s,i) => (
              <div key={i} style={{ background:s.bg, border:`1px solid ${s.c}20`, borderRadius:14, padding:'16px', textAlign:'center', cursor:'pointer', transition:'transform .15s' }}
                onMouseEnter={e => e.currentTarget.style.transform='translateY(-2px)'}
                onMouseLeave={e => e.currentTarget.style.transform='none'}>
                <div style={{ fontSize:24, marginBottom:6 }}>{s.icon}</div>
                <div style={{ fontSize:26, fontWeight:900, color:s.c }}>{s.val}</div>
                <div style={{ fontSize:11.5, fontWeight:700, color:s.c, opacity:.8 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Today's appointment list */}
          <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:16, overflow:'hidden', marginBottom:16 }}>
            <div style={{ padding:'14px 20px', borderBottom:'1px solid #f1f5f9', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontWeight:800, fontSize:15, color:'#0f172a' }}>📅 Today's Appointments</span>
              <span style={{ fontSize:12.5, color:'#94a3b8' }}>{todayAppts.length} scheduled</span>
            </div>
            {todayAppts.length === 0 ? (
              <div style={{ padding:'32px', textAlign:'center', color:'#94a3b8', fontSize:13 }}>No appointments today</div>
            ) : (
              <div style={{ maxHeight:360, overflowY:'auto' }}>
                {todayAppts.map((a, i) => {
                  const sc = STATUS_CFG[a.status] || STATUS_CFG.pending;
                  return (
                    <div key={a._id} style={{ padding:'13px 20px', borderBottom:'1px solid #f1f5f9', display:'flex', alignItems:'center', gap:14, cursor:'pointer' }}
                      onMouseEnter={e => e.currentTarget.style.background='#f8fafc'}
                      onMouseLeave={e => e.currentTarget.style.background='#fff'}
                      onClick={() => { setSelectedAppt(a); setTab('appointments'); }}>
                      <div style={{ width:44, height:44, borderRadius:13, background:sc.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>📅</div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontWeight:700, fontSize:14, color:'#0f172a' }}>{a.patient?.name || '—'}</div>
                        <div style={{ fontSize:12.5, color:'#64748b' }}>Dr. {a.doctor?.name} · {a.timeSlot} · {a.type}</div>
                        <div style={{ fontSize:11, color:'#94a3b8', marginTop:1 }}>Booked {a.createdAt ? new Date(a.createdAt).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}) : '—'}</div>
                      </div>
                      <span style={{ padding:'3px 10px', borderRadius:8, fontSize:11.5, fontWeight:700, background:sc.bg, color:sc.c, flexShrink:0 }}>{sc.label}</span>
                      {a.status === 'pending' && (
                        <button onClick={e => { e.stopPropagation(); updateStatus(a._id, 'confirmed'); }}
                          style={{ padding:'5px 11px', background:'#dcfce7', border:'none', borderRadius:8, color:'#15803d', fontWeight:700, fontSize:12, cursor:'pointer', flexShrink:0, fontFamily:'inherit' }}>
                          Confirm
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick schedule */}
          {schedules.filter(s => new Date(s.date).toDateString() === today).length > 0 && (
            <div style={{ background:'linear-gradient(135deg,#fce7f3,#fff)', border:'1px solid #fbcfe8', borderRadius:14, padding:'16px 20px' }}>
              <div style={{ fontWeight:800, fontSize:14, color:'#be185d', marginBottom:10 }}>🗓️ Your Shift Today</div>
              {schedules.filter(s => new Date(s.date).toDateString() === today).map(s => {
                const sh = { morning:{i:'🌅',l:'Morning',t:'08:00–16:00',c:'#15803d',bg:'#dcfce7'}, afternoon:{i:'🌇',l:'Afternoon',t:'14:00–22:00',c:'#92400e',bg:'#fef3c7'}, night:{i:'🌙',l:'Night',t:'22:00–06:00',c:'#3730a3',bg:'#e0e7ff'} }[s.shift] || {i:'⏰',l:s.shift,t:'',c:'#64748b',bg:'#f1f5f9'};
                return (
                  <div key={s._id} style={{ background:sh.bg, border:`1px solid ${sh.c}30`, borderRadius:10, padding:'12px 14px', display:'flex', alignItems:'center', gap:12 }}>
                    <span style={{ fontSize:22 }}>{sh.i}</span>
                    <div>
                      <div style={{ fontWeight:700, color:sh.c, fontSize:14 }}>{sh.l} Shift — {sh.t}</div>
                      {s.task && <div style={{ fontSize:12.5, color:'#374151', marginTop:2 }}>{s.task}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ marginTop:16, display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
            <StaffExtraTools />
            <MyActivityWidget />
          </div>
        </div>
      )}

      {/* ── APPOINTMENTS ── */}
      {tab === 'appointments' && (
        <div>
          <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
            <div style={{ position:'relative', flex:1, maxWidth:340 }}>
              <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'#94a3b8' }}>🔍</span>
              <input style={{ ...inp, paddingLeft:34 }} placeholder="Search patient, doctor, time…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <button onClick={() => setShowBook(true)}
              style={{ padding:'9px 18px', background:'linear-gradient(135deg,#db2777,#be185d)', border:'none', borderRadius:10, color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
              + Book Appointment
            </button>
          </div>

          <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:16, overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead style={{ background:'#f8fafc' }}>
                <tr>
                  {['Patient','Doctor','Date','Time','Booked At','Type','Status','Actions'].map(h => (
                    <th key={h} style={{ padding:'11px 16px', textAlign:'left', fontSize:11.5, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:.5, whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredAppts.length === 0 ? (
                  <tr><td colSpan={8} style={{ textAlign:'center', padding:'40px', color:'#94a3b8', fontSize:13 }}>No appointments found</td></tr>
                ) : filteredAppts.slice(0, 50).map(a => {
                  const sc = STATUS_CFG[a.status] || STATUS_CFG.pending;
                  return (
                    <tr key={a._id} style={{ borderBottom:'1px solid #f1f5f9', cursor:'pointer' }}
                      onMouseEnter={e => e.currentTarget.style.background='#f8fafc'}
                      onMouseLeave={e => e.currentTarget.style.background='transparent'}
                      onClick={() => setSelectedAppt(a)}>
                      <td style={{ padding:'12px 16px' }}>
                        <div style={{ fontWeight:700, fontSize:13.5, color:'#0f172a' }}>{a.patient?.name || '—'}</div>
                        <div style={{ fontSize:11.5, color:'#94a3b8' }}>{a.patient?.phone || ''}</div>
                      </td>
                      <td style={{ padding:'12px 16px', fontSize:13, color:'#475569' }}>
                        <div>Dr. {a.doctor?.name || '—'}</div>
                        <div style={{ fontSize:11.5, color:'#94a3b8' }}>{a.doctor?.specialization || a.department || ''}</div>
                      </td>
                      <td style={{ padding:'12px 16px', fontSize:13, color:'#475569' }}>{new Date(a.date).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</td>
                      <td style={{ padding:'12px 16px', fontSize:13, color:'#475569', fontWeight:600 }}>{a.timeSlot}</td>
                      <td style={{ padding:'12px 16px', fontSize:12.5, color:'#64748b' }}>
                        {a.createdAt ? <>{new Date(a.createdAt).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}<div style={{fontSize:11,color:'#94a3b8'}}>{new Date(a.createdAt).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</div></> : '—'}
                      </td>
                      <td style={{ padding:'12px 16px', fontSize:13, color:'#475569' }}>{a.type}</td>
                      <td style={{ padding:'12px 16px' }}>
                        <span style={{ padding:'3px 10px', borderRadius:8, fontSize:11.5, fontWeight:700, background:sc.bg, color:sc.c }}>{sc.label}</span>
                      </td>
                      <td style={{ padding:'12px 16px' }}>
                        <div style={{ display:'flex', gap:5 }}>
                          {a.status === 'pending' && (
                            <button onClick={e=>{e.stopPropagation();updateStatus(a._id,'confirmed')}} style={{ padding:'4px 9px', background:'#dcfce7', border:'none', borderRadius:7, color:'#15803d', fontWeight:700, fontSize:11.5, cursor:'pointer', fontFamily:'inherit' }}>✓</button>
                          )}
                          {['pending','confirmed'].includes(a.status) && (
                            <button onClick={e=>{e.stopPropagation();updateStatus(a._id,'cancelled')}} style={{ padding:'4px 9px', background:'#fee2e2', border:'none', borderRadius:7, color:'#dc2626', fontWeight:700, fontSize:11.5, cursor:'pointer', fontFamily:'inherit' }}>✕</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── DOCTORS ── */}
      {tab === 'doctors' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:14 }}>
          {doctors.map(d => {
            const onLeave = doctorOnLeaveIds.has(d._id?.toString());
            const todayCount = todayAppts.filter(a => (a.doctor?._id||a.doctor) === d._id).length;
            return (
              <div key={d._id} style={{ background:'#fff', border:`2px solid ${onLeave?'#fde68a':'#e2e8f0'}`, borderRadius:16, padding:'18px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
                  <div style={{ width:46, height:46, borderRadius:14, background:onLeave?'#fef3c7':'#e0f2fe', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>
                    {onLeave ? '🏥' : '👨‍⚕️'}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:800, fontSize:14, color:'#0f172a' }}>Dr. {d.name}</div>
                    <div style={{ fontSize:12, color:'#64748b' }}>{d.specialization || d.department || 'General'}</div>
                  </div>
                  <div style={{ width:10, height:10, borderRadius:'50%', background:onLeave?'#f59e0b':d.isOnline?'#22c55e':'#e2e8f0', flexShrink:0 }} title={onLeave?'On Leave':d.isOnline?'Online':'Offline'} />
                </div>
                {onLeave && (
                  <div style={{ background:'#fef3c7', border:'1px solid #fde68a', borderRadius:9, padding:'8px 12px', marginBottom:10, fontSize:12, color:'#92400e', fontWeight:600 }}>
                    ⚠️ On Approved Leave Today — Do not book
                  </div>
                )}
                <div style={{ display:'flex', gap:8, marginBottom:10 }}>
                  <div style={{ flex:1, background:'#f8fafc', borderRadius:9, padding:'8px', textAlign:'center' }}>
                    <div style={{ fontWeight:800, color:'#0891b2', fontSize:18 }}>{todayCount}</div>
                    <div style={{ fontSize:10.5, color:'#94a3b8' }}>Today</div>
                  </div>
                  <div style={{ flex:1, background:'#f8fafc', borderRadius:9, padding:'8px', textAlign:'center' }}>
                    <div style={{ fontWeight:800, color:'#0f172a', fontSize:18 }}>{d.rating?.toFixed(1) || '4.5'}</div>
                    <div style={{ fontSize:10.5, color:'#94a3b8' }}>Rating</div>
                  </div>
                </div>
                <button disabled={onLeave} onClick={() => { setBookForm(f=>({...f, doctorId:d._id})); setShowBook(true); }}
                  style={{ width:'100%', padding:'8px', background:onLeave?'#f1f5f9':'linear-gradient(135deg,#db2777,#be185d)', border:'none', borderRadius:9, color:onLeave?'#94a3b8':'#fff', fontWeight:700, fontSize:12.5, cursor:onLeave?'not-allowed':'pointer', fontFamily:'inherit' }}>
                  {onLeave ? 'Unavailable Today' : '📅 Book Appointment'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ── MY TASKS ── */}
      {tab === 'tasks' && (
        <div>
          <h2 style={{ fontSize:17, fontWeight:800, color:'#0f172a', margin:'0 0 16px' }}>📋 Tasks Assigned to Me</h2>
          {tasks.length === 0 ? (
            <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:16, padding:'48px', textAlign:'center' }}>
              <div style={{ fontSize:36, marginBottom:10 }}>📭</div>
              <div style={{ fontWeight:700 }}>No tasks yet. Tasks from admin will appear here.</div>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {tasks.map(t => {
                const pc = {urgent:'#ef4444',high:'#f97316',medium:'#3b82f6',low:'#22c55e'}[t.priority]||'#94a3b8';
                const sc = {pending:'#f59e0b',in_progress:'#3b82f6',completed:'#22c55e',cancelled:'#94a3b8'}[t.status]||'#94a3b8';
                return (
                  <div key={t._id} style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:13, padding:'14px 18px', borderLeft:`4px solid ${pc}` }}>
                    <div style={{ display:'flex', alignItems:'start', gap:12, flexWrap:'wrap' }}>
                      <div style={{ flex:1 }}>
                        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:5 }}>
                          <span style={{ fontWeight:700, fontSize:14, color:'#0f172a' }}>{t.title}</span>
                          <span style={{ fontSize:10.5, fontWeight:700, padding:'2px 8px', borderRadius:7, background:`${pc}20`, color:pc }}>{t.priority}</span>
                          <span style={{ fontSize:10.5, fontWeight:700, padding:'2px 8px', borderRadius:7, background:`${sc}20`, color:sc }}>{t.status?.replace('_',' ')}</span>
                        </div>
                        {t.description && <p style={{ fontSize:12.5, color:'#64748b', margin:'0 0 6px' }}>{t.description}</p>}
                        <div style={{ fontSize:11.5, color:'#94a3b8' }}>
                          {t.assignedBy?.name && <span>👤 From: {t.assignedBy.name}</span>}
                          {t.dueDate && <span style={{ marginLeft:12, color:new Date(t.dueDate)<new Date()&&t.status!=='completed'?'#dc2626':'#94a3b8' }}>📅 Due {new Date(t.dueDate).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</span>}
                        </div>
                      </div>
                      <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                        {t.status==='pending'&&<button onClick={async()=>{try{await tasksAPI.update(t._id,{status:'in_progress'});setTasks(ts=>ts.map(x=>x._id===t._id?{...x,status:'in_progress'}:x));toast.success('Task started!');}catch{toast.error('Failed');}}} style={{ padding:'6px 12px', background:'#dbeafe', border:'none', borderRadius:8, color:'#1d4ed8', fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>▶ Start</button>}
                        {t.status==='in_progress'&&<button onClick={async()=>{try{await tasksAPI.update(t._id,{status:'completed'});setTasks(ts=>ts.map(x=>x._id===t._id?{...x,status:'completed'}:x));toast.success('✅ Task complete!');}catch{toast.error('Failed');}}} style={{ padding:'6px 12px', background:'#d1fae5', border:'none', borderRadius:8, color:'#065f46', fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>✅ Done</button>}
                        {t.status==='completed'&&<span style={{ padding:'6px 12px', background:'#dcfce7', borderRadius:8, color:'#15803d', fontWeight:700, fontSize:12 }}>✓ Done</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── MY SCHEDULE ── */}
      {tab === 'schedule' && (
        <div>
          <h2 style={{ fontSize:17, fontWeight:800, color:'#0f172a', margin:'0 0 16px' }}>🗓️ My Weekly Schedule</h2>
          {schedules.length === 0 ? (
            <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:16, padding:'48px', textAlign:'center' }}>
              <div style={{ fontSize:36, marginBottom:10 }}>📅</div>
              <div style={{ fontWeight:700 }}>No shifts scheduled yet.</div>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {schedules.map(s => {
                const sh = {morning:{i:'🌅',c:'#15803d',bg:'#dcfce7'},afternoon:{i:'🌇',c:'#92400e',bg:'#fef3c7'},night:{i:'🌙',c:'#3730a3',bg:'#e0e7ff'},full:{i:'☀️',c:'#0369a1',bg:'#f0f9ff'}}[s.shift]||{i:'⏰',c:'#64748b',bg:'#f1f5f9'};
                return (
                  <div key={s._id} style={{ background:sh.bg, border:`1px solid ${sh.c}30`, borderRadius:12, padding:'14px 18px', display:'flex', alignItems:'center', gap:14 }}>
                    <span style={{ fontSize:24 }}>{sh.i}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:700, color:sh.c, fontSize:14 }}>{s.shift?.charAt(0).toUpperCase()+s.shift?.slice(1)} Shift</div>
                      <div style={{ fontSize:13, color:'#374151' }}>{new Date(s.date).toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'})}</div>
                      {s.task && <div style={{ fontSize:12.5, color:'#64748b', marginTop:2 }}>{s.task}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── CHECK-IN TAB ── */}
      {tab === 'checkin' && (
        <div>
          <div style={{ background:'#ecfeff', border:'1px solid #a5f3fc', borderRadius:12, padding:'12px 16px', marginBottom:18, fontSize:12.5, color:'#0e7490' }}>
            🎫 Patients with a confirmed, paid appointment receive a 6-digit entry code by email. Ask for it at the desk and enter it below to check them in. Most patients just proceed straight to the doctor's queue — only tick "may need a bed" if it looks like an admission (e.g. Emergency), and the doctor will confirm after examining them.
          </div>

          {pendingEntries.length === 0 ? (
            <div style={{ textAlign:'center', padding:40, color:'#94a3b8' }}>
              <div style={{ fontSize:36, marginBottom:10 }}>🎫</div>
              <div style={{ fontWeight:700 }}>No patients awaiting check-in right now</div>
              <div style={{ fontSize:13, marginTop:4 }}>New entries appear here automatically as patients arrive</div>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {pendingEntries.map(entry => (
                <div key={entry._id} style={{ padding:'14px 16px', background:'#fff', border:'1.5px solid #e2e8f0', borderRadius:12, display:'flex', alignItems:'center', gap:14, flexWrap:'wrap' }}>
                  <div style={{ flex:1, minWidth:180 }}>
                    <div style={{ fontWeight:800, fontSize:14 }}>{entry.patient?.name}</div>
                    <div style={{ fontSize:12, color:'#64748b', marginTop:2 }}>
                      👨‍⚕️ Dr. {entry.appointment?.doctor?.name} · ⏰ {entry.appointment?.timeSlot} · 📅 {new Date(entry.appointment?.date).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}
                      {entry.appointment?.type && <> · <span style={{ fontWeight:700 }}>{entry.appointment.type}</span></>}
                    </div>
                    {entry.patient?.bloodGroup && <span className="badge badge-danger" style={{ fontSize:10, marginTop:4 }}>🩸 {entry.patient.bloodGroup}</span>}
                  </div>
                  <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:11.5, color:'#92400e', background:'#fef3c7', padding:'6px 10px', borderRadius:8, cursor:'pointer', fontWeight:700 }}>
                    <input type="checkbox" checked={!!bedLikelyInputs[entry._id]}
                      onChange={e => setBedLikelyInputs(o => ({ ...o, [entry._id]: e.target.checked }))} />
                    🛏️ {t('reception.mayNeedBed')}
                  </label>
                  <input
                    placeholder="6-digit code"
                    maxLength={6}
                    value={otpInputs[entry._id] || ''}
                    onChange={e => setOtpInputs(o => ({ ...o, [entry._id]: e.target.value.replace(/\D/g,'') }))}
                    style={{ width:130, padding:'9px 12px', border:'1.5px solid #e2e8f0', borderRadius:9, fontSize:16, fontWeight:800, letterSpacing:3, textAlign:'center', fontFamily:'monospace' }}
                  />
                  <button className="btn btn-primary btn-sm" disabled={verifying===entry._id} onClick={()=>verifyEntryOTP(entry)}>
                    {verifying===entry._id ? 'Verifying…' : '✓ Verify & Check In'}
                  </button>
                  <button className="btn btn-danger btn-sm" disabled={deletingEntryId===entry._id} onClick={()=>deleteEntry(entry)} title="Remove this check-in entry">
                    {deletingEntryId===entry._id ? '…' : '🗑️ Delete'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'beds' && (
        <div>
          <div style={{ background:'#fef3c7', border:'1px solid #fde68a', borderRadius:12, padding:'12px 16px', marginBottom:18, fontSize:12.5, color:'#92400e' }}>
            🛏️ Bed assignment is a two-step check: reception flags a patient as a possible admission at check-in (or a doctor raises it directly), then the treating doctor confirms after examining them. Only <b>confirmed</b> requests are ready to assign a room here — <b>flagged</b> ones are still awaiting the doctor's decision.
          </div>
          {admissionQueueLoading ? (
            <div style={{ textAlign:'center', padding:30, color:'#94a3b8' }}>Loading…</div>
          ) : admissionQueue.length === 0 ? (
            <div style={{ textAlign:'center', padding:40, color:'#94a3b8' }}>
              <div style={{ fontSize:36, marginBottom:10 }}>🛏️</div>
              <div style={{ fontWeight:700 }}>No pending bed requests</div>
              <div style={{ fontSize:13, marginTop:4 }}>Flagged or doctor-confirmed admissions will show up here</div>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {admissionQueue.map(appt => (
                <div key={appt._id} style={{ padding:'14px 16px', background:'#fff', border:'1.5px solid #e2e8f0', borderRadius:12, display:'flex', alignItems:'center', gap:14, flexWrap:'wrap' }}>
                  <div style={{ flex:1, minWidth:200 }}>
                    <div style={{ fontWeight:800, fontSize:14 }}>{appt.patient?.name} {appt.patient?.age ? `· ${appt.patient.age}y` : ''}</div>
                    <div style={{ fontSize:12, color:'#64748b', marginTop:2 }}>👨‍⚕️ Dr. {appt.doctor?.name}</div>
                    {appt.admission?.status === 'confirmed' && <div style={{ fontSize:12.5, marginTop:4, color:'#0f172a' }}>📋 {appt.admission.reason}</div>}
                  </div>
                  <span className="badge" style={{
                    fontSize:11, fontWeight:700,
                    background: appt.admission?.status === 'confirmed' ? '#dcfce7' : '#fef3c7',
                    color: appt.admission?.status === 'confirmed' ? '#15803d' : '#92400e',
                  }}>
                    {appt.admission?.status === 'confirmed' ? '✅ Doctor confirmed' : '⏳ Awaiting doctor'}
                  </span>
                  {appt.admission?.status === 'confirmed' && (
                    <button className="btn btn-primary btn-sm" onClick={()=>openAssignBed(appt)}>🛏️ Assign Bed</button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'queue' && (
        <div>
          <div className="card mb-2">
            <div className="card-header"><span className="card-title">🎫 Register a Walk-in Patient</span></div>
            <div className="card-body" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <div className="form-group" style={{marginBottom:0}}><label className="form-label">Patient Name *</label><input className="form-input" value={tokenForm.patientName} onChange={e=>setTokenForm(f=>({...f,patientName:e.target.value}))} /></div>
              <div className="form-group" style={{marginBottom:0}}><label className="form-label">Phone</label><input className="form-input" value={tokenForm.phone} onChange={e=>setTokenForm(f=>({...f,phone:e.target.value}))} /></div>
              <div className="form-group" style={{marginBottom:0}}><label className="form-label">Department *</label>
                <select className="form-input" value={tokenForm.department} onChange={e=>setTokenForm(f=>({...f,department:e.target.value}))}>
                  {['General Medicine','Cardiology','Neurology','Orthopedics','Pediatrics','Dermatology','Gynecology','ENT','Ophthalmology','Psychiatry'].map(d=><option key={d}>{d}</option>)}
                </select>
              </div>
              <div className="form-group" style={{marginBottom:0}}><label className="form-label">Preferred Doctor (optional)</label>
                <select className="form-input" value={tokenForm.doctorId} onChange={e=>setTokenForm(f=>({...f,doctorId:e.target.value}))}>
                  <option value="">— No preference —</option>
                  {doctors.filter(d=>d.department===tokenForm.department).map(d=><option key={d._id} value={d._id}>Dr. {d.name}</option>)}
                </select>
              </div>
              <div className="form-group" style={{marginBottom:0, gridColumn:'1 / -1'}}><label className="form-label">Reason / Notes</label><input className="form-input" value={tokenForm.purpose} onChange={e=>setTokenForm(f=>({...f,purpose:e.target.value}))} /></div>
              <div style={{ gridColumn:'1 / -1' }}><button className="btn btn-primary" disabled={creatingToken} onClick={createToken}>{creatingToken?'Issuing…':'🎫 Issue Token'}</button></div>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><span className="card-title">Today's Queue</span>
              <a href="/queue-display" target="_blank" rel="noreferrer" className="btn btn-outline btn-xs">📺 Open Waiting Room Display</a>
            </div>
            <div className="card-body">
              {queueLoading ? <div style={{ textAlign:'center', color:'#94a3b8', padding:20 }}>Loading…</div>
              : queue.length === 0 ? <div style={{ textAlign:'center', color:'#94a3b8', padding:20 }}>No walk-in tokens issued today</div>
              : Object.entries(queue.reduce((acc,q)=>{ (acc[q.department]=acc[q.department]||[]).push(q); return acc; }, {})).map(([dept, tokens]) => (
                <div key={dept} style={{ marginBottom:16 }}>
                  <div style={{ fontWeight:800, fontSize:12.5, color:'#374151', marginBottom:6 }}>{dept}</div>
                  {tokens.map(q => (
                    <div key={q._id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'9px 13px', background: q.status==='waiting'?'#fffbeb':q.status==='called'?'#eff6ff':q.status==='in_consultation'?'#f0fdf4':'#f8fafc', borderRadius:9, marginBottom:6, flexWrap:'wrap', gap:8 }}>
                      <div>
                        <span style={{ fontWeight:800, fontSize:14, marginRight:8 }}>#{q.tokenNumber}</span>
                        <span style={{ fontSize:12.5 }}>{q.patientName}</span>
                        {q.doctor?.name && <span style={{ fontSize:11, color:'#64748b' }}> · Dr. {q.doctor.name}</span>}
                        {q.purpose && <div style={{ fontSize:11, color:'#94a3b8' }}>{q.purpose}</div>}
                      </div>
                      <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                        <span style={{ fontSize:11, fontWeight:700, textTransform:'capitalize', color:'#64748b' }}>{q.status.replace('_',' ')}</span>
                        {q.status==='waiting' && <button className="btn btn-primary btn-xs" disabled={updatingTokenId===q._id} onClick={()=>setTokenStatus(q._id,'called')}>📢 Call</button>}
                        {q.status==='called' && <button className="btn btn-primary btn-xs" disabled={updatingTokenId===q._id} onClick={()=>setTokenStatus(q._id,'in_consultation')}>▶️ Start</button>}
                        {q.status==='in_consultation' && <button className="btn btn-success btn-xs" disabled={updatingTokenId===q._id} onClick={()=>setTokenStatus(q._id,'completed')}>✅ Done</button>}
                        {['waiting','called'].includes(q.status) && <button className="btn btn-outline btn-xs" disabled={updatingTokenId===q._id} onClick={()=>setTokenStatus(q._id,'no_show')}>No-show</button>}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'ambulance' && (
        <div className="card">
          <div className="card-header"><span className="card-title">🚑 Today's Ambulance Activity</span><button className="btn btn-outline btn-xs" onClick={loadAmbTrips}>↻ Refresh</button></div>
          <div className="card-body">
            <div style={{ fontSize:12, color:'#94a3b8', marginBottom:12 }}>Read-only coordination view — patients request pickups themselves, and drivers accept/update them. Use this to answer "where's my ambulance" questions at the desk.</div>
            {ambLoading ? <div style={{ textAlign:'center', color:'#94a3b8', padding:20 }}>Loading…</div>
            : ambTrips.length === 0 ? <div style={{ textAlign:'center', color:'#94a3b8', padding:20 }}>No ambulance activity today</div>
            : ambTrips.map(t => {
              const STATUS_LABEL = { requested:'Requested', dispatched:'Dispatched', en_route:'En Route', arrived:'Arrived', completed:'Completed', cancelled:'Cancelled', pending:'Logged Trip' };
              const STATUS_COLOR = { requested:'#f59e0b', dispatched:'#2563eb', en_route:'#2563eb', arrived:'#0d9488', completed:'#059669', cancelled:'#64748b', pending:'#94a3b8' };
              return (
                <div key={t._id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'11px 14px', background:'#f8fafc', borderRadius:10, marginBottom:8, flexWrap:'wrap', gap:8 }}>
                  <div>
                    <div style={{ fontWeight:700, fontSize:13 }}>{t.patientName || t.requestedBy?.name || 'Unnamed'} {t.isEmergency && <span style={{ color:'#dc2626' }}>🚨 Emergency</span>}</div>
                    <div style={{ fontSize:12, color:'#64748b', marginTop:2 }}>📍 {t.from} → {t.to}</div>
                    {t.driver?.name && <div style={{ fontSize:11.5, color:'#94a3b8', marginTop:2 }}>Driver: {t.driver.name}{t.driver.phone ? ` · ${t.driver.phone}` : ''}</div>}
                  </div>
                  <span style={{ fontSize:11, fontWeight:800, color: STATUS_COLOR[t.status] || '#64748b' }}>{STATUS_LABEL[t.status] || t.status}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── ROOM ASSIGNMENT MODAL (shown right after a successful check-in) ── */}
      {admitTarget && (
        <div className="modal-overlay" onClick={e=>{ if(e.target===e.currentTarget) setAdmitTarget(null); }}>
          <motion.div className="modal-box" initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }}>
            <div className="modal-header"><span className="modal-title">🛏️ Assign Bed — {admitTarget.patient?.name}</span><button className="btn btn-ghost btn-icon" onClick={()=>setAdmitTarget(null)}>✕</button></div>
            <div className="modal-body">
              <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:10, padding:'10px 14px', marginBottom:16, fontSize:12.5, color:'#15803d' }}>
                ✅ Dr. {admitTarget.doctor?.name} confirmed admission: <b>{admitTarget.admission?.reason}</b>. Pick a room, set the room charge/day, and optionally a wardboy to escort them.
              </div>
              <div className="form-group">
                <label className="form-label">Available Rooms</label>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, maxHeight:260, overflowY:'auto' }}>
                  {rooms.filter(r => r.status !== 'maintenance' && r.occupiedBeds < r.capacity).map(r => (
                    <div key={r._id} onClick={()=>setAdmitRoomId(r._id)}
                      style={{ padding:'10px 12px', borderRadius:10, border:`2px solid ${admitRoomId===r._id?'#2563eb':'#e2e8f0'}`, background:admitRoomId===r._id?'#eff6ff':'#fff', cursor:'pointer' }}>
                      <div style={{ fontWeight:700, fontSize:13 }}>{r.name} · {r.number}</div>
                      <div style={{ fontSize:11, color:'#94a3b8', marginTop:2 }}>Floor {r.floor} · {r.type} · {r.occupiedBeds}/{r.capacity} beds</div>
                    </div>
                  ))}
                  {rooms.filter(r => r.status !== 'maintenance' && r.occupiedBeds < r.capacity).length === 0 && (
                    <div style={{ gridColumn:'1/-1', textAlign:'center', color:'#94a3b8', padding:16, fontSize:12.5 }}>No available rooms right now</div>
                  )}
                </div>
              </div>
              <div className="form-group" style={{ marginTop:14 }}>
                <label className="form-label">Room Charge / Day (₹) *</label>
                <input type="number" min="0" className="form-input" value={admitRoomCharge} onChange={e=>setAdmitRoomCharge(e.target.value)} placeholder="e.g. 2500" />
              </div>
              <div className="form-group" style={{ marginTop:14 }}>
                <label className="form-label">Assign to Wardboy <span style={{ color:'#94a3b8', fontWeight:400 }}>(optional — leave unselected to notify all wardboys)</span></label>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, maxHeight:160, overflowY:'auto' }}>
                  <div onClick={()=>setAdmitWardboyId('')}
                    style={{ padding:'9px 12px', borderRadius:10, border:`2px solid ${admitWardboyId===''?'#2563eb':'#e2e8f0'}`, background:admitWardboyId===''?'#eff6ff':'#fff', cursor:'pointer', fontSize:12.5, fontWeight:600, color:'#64748b' }}>
                    👥 Any available wardboy
                  </div>
                  {wardboys.map(w => (
                    <div key={w._id} onClick={()=>setAdmitWardboyId(w._id)}
                      style={{ padding:'9px 12px', borderRadius:10, border:`2px solid ${admitWardboyId===w._id?'#2563eb':'#e2e8f0'}`, background:admitWardboyId===w._id?'#eff6ff':'#fff', cursor:'pointer' }}>
                      <div style={{ fontWeight:700, fontSize:12.5 }}>👤 {w.name}</div>
                      {w.department && <div style={{ fontSize:10.5, color:'#94a3b8', marginTop:1 }}>{w.department}</div>}
                    </div>
                  ))}
                  {wardboys.length === 0 && (
                    <div style={{ gridColumn:'1/-1', textAlign:'center', color:'#94a3b8', padding:10, fontSize:12 }}>No wardboys on roster right now</div>
                  )}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" style={{ width:'100%' }} disabled={!admitRoomId || !admitRoomCharge || admitting} onClick={assignBedToPatient}>{admitting ? 'Assigning…' : '✓ Confirm Admission & Assign Bed'}</button>
            </div>
          </motion.div>
        </div>

      )}

      {/* ── CHECKLIST TAB ── */}
      {tab === 'checklist' && (
        <div>
          <div style={{ marginBottom:14, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div style={{ fontWeight:700, fontSize:14, color:'#0f172a' }}>Daily Receptionist Duties</div>
            <span style={{ fontSize:12, color:'#94a3b8' }}>{Object.values(checklist).filter(Boolean).length}/{CHECKLIST_ITEMS.length} done · auto-saved</span>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            {CHECKLIST_ITEMS.map((item, i) => (
              <div key={i} onClick={async () => {
                const v = !checklist[i];
                setChecklist(c=>({...c,[i]:v}));
                try { await checklistAPI.toggle(i, v); }
                catch { setChecklist(c=>({...c,[i]:!v})); toast.error('Save failed'); }
              }} style={{ display:'flex', alignItems:'center', gap:10, padding:'11px 13px', borderRadius:10, cursor:'pointer', background:checklist[i]?'#fce7f3':'#f8fafc', border:`1.5px solid ${checklist[i]?'#f9a8d4':'#e2e8f0'}` }}>
                <div style={{ width:20, height:20, borderRadius:6, border:`2px solid ${checklist[i]?'#db2777':'#cbd5e1'}`, background:checklist[i]?'#db2777':'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  {checklist[i] && <span style={{ color:'#fff', fontSize:11, fontWeight:900 }}>✓</span>}
                </div>
                <span style={{ fontSize:12.5, color:checklist[i]?'#64748b':'#374151', textDecoration:checklist[i]?'line-through':'none', fontWeight:checklist[i]?400:600 }}>{item}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop:14, padding:'10px 14px', background:'#f0fdf4', borderRadius:10, fontSize:12, color:'#15803d', fontWeight:600 }}>
            💾 Your checklist is saved automatically to the server — refreshing the page won't reset your progress.
          </div>
        </div>
      )}

      {/* ── VISITOR LOG TAB ── */}
      {tab === 'visitors' && (
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
            <div style={{ fontWeight:700, fontSize:14, color:'#0f172a' }}>Today's Visitor Log</div>
            <button onClick={() => setShowVisitorModal(true)} className="btn btn-primary btn-sm">+ Log Visitor</button>
          </div>
          {visitors.length === 0 ? (
            <div style={{ textAlign:'center', padding:40, color:'#94a3b8' }}>
              <div style={{ fontSize:36, marginBottom:10 }}>👤</div>
              <div style={{ fontWeight:700 }}>No visitors logged yet today</div>
              <div style={{ fontSize:13, marginTop:4 }}>Click "+ Log Visitor" to add an entry</div>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {visitors.map(v => (
                <div key={v._id} style={{ padding:'11px 14px', background:'#f8fafc', borderRadius:10, border:'1px solid #e2e8f0', display:'flex', justifyContent:'space-between', alignItems:'center', gap:12 }}>
                  <div>
                    <div style={{ fontWeight:700, fontSize:13 }}>{v.title}</div>
                    {v.location && <div style={{ fontSize:12, color:'#64748b', marginTop:2 }}>📍 {v.location}</div>}
                    <div style={{ fontSize:11, color:'#94a3b8', marginTop:2 }}>{new Date(v.createdAt).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</div>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0, minWidth:172, justifyContent:'flex-end' }}>
                    <span className={`badge ${v.status==='resolved'?'badge-success':'badge-primary'}`} style={{ fontSize:10 }}>
                      {v.status === 'resolved' ? 'Signed Out' : 'Signed In'}
                    </span>
                    {v.status !== 'resolved' ? (
                      <button onClick={()=>closeVisitorLog(v._id)} disabled={closingVisitorId===v._id} className="btn btn-outline btn-xs" style={{ minWidth:64 }}>
                        {closingVisitorId===v._id ? '…' : '✅ Close'}
                      </button>
                    ) : (
                      <span style={{ minWidth:64, display:'inline-flex', justifyContent:'center', fontSize:11, color:'#94a3b8', fontWeight:600 }}>✔ Closed</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── VISITOR LOG MODAL ── */}
      {showVisitorModal && (
        <div className="modal-overlay" onClick={e=>{ if(e.target===e.currentTarget) setShowVisitorModal(false); }}>
          <motion.div className="modal-box" initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }}>
            <div className="modal-header"><span className="modal-title">👤 Log Visitor</span><button className="btn btn-ghost btn-icon" onClick={()=>setShowVisitorModal(false)}>✕</button></div>
            <form onSubmit={async e => {
              e.preventDefault();
              setSubmittingVisitor(true);
              try {
                const res = await staffLogsAPI.create({ ...visitorForm, category:'visitor_log' });
                setVisitors(v=>[res.data.data,...v]);
                toast.success('✅ Visitor logged!');
                setShowVisitorModal(false);
                setVisitorForm({ category:'visitor_log', title:'', details:'', location:'', priority:'low' });
              } catch (e) { toast.error(e.response?.data?.error||'Failed'); }
              setSubmittingVisitor(false);
            }}>
              <div className="modal-body">
                <div className="form-group"><label className="form-label">Visitor Name & Purpose *</label><input className="form-input" required value={visitorForm.title} onChange={e=>setVisitorForm(f=>({...f,title:e.target.value}))} placeholder="e.g. Ravi Kumar — visiting patient in Ward B" /></div>
                <div className="form-group"><label className="form-label">Visiting Location</label><input className="form-input" value={visitorForm.location} onChange={e=>setVisitorForm(f=>({...f,location:e.target.value}))} placeholder="e.g. Ward B, Room 12" /></div>
                <div className="form-group"><label className="form-label">Additional Notes</label><textarea className="form-input" rows={2} value={visitorForm.details} onChange={e=>setVisitorForm(f=>({...f,details:e.target.value}))} placeholder="ID verified / badge issued / etc." /></div>
              </div>
              <div className="modal-footer"><button type="button" className="btn btn-outline" onClick={()=>setShowVisitorModal(false)}>Cancel</button><button type="submit" className="btn btn-primary" disabled={submittingVisitor}>{submittingVisitor?'Logging…':'Log Visitor'}</button></div>
            </form>
          </motion.div>
        </div>
      )}

      {/* ── BOOK APPOINTMENT MODAL ── */}
      <AnimatePresence>
        {showBook && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:16, overflowY:'auto' }}
            onClick={e => { if (e.target===e.currentTarget) setShowBook(false); }}>
            <motion.div initial={{ scale:.96 }} animate={{ scale:1 }} exit={{ scale:.96 }} onClick={e=>e.stopPropagation()}
              style={{ background:'#fff', borderRadius:20, width:'100%', maxWidth:560, maxHeight:'92vh', overflowY:'auto' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'18px 24px', borderBottom:'1px solid #f1f5f9', position:'sticky', top:0, background:'#fff', zIndex:5, borderRadius:'20px 20px 0 0' }}>
                <div style={{ fontWeight:900, fontSize:17, color:'#0f172a' }}>📅 Book Appointment</div>
                <button onClick={() => setShowBook(false)} style={{ width:32, height:32, borderRadius:'50%', border:'1.5px solid #e2e8f0', background:'#f8fafc', cursor:'pointer', fontSize:15, color:'#64748b', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'inherit' }}>✕</button>
              </div>
              <form onSubmit={bookAppointment}>
                <div style={{ padding:'20px 24px', display:'flex', flexDirection:'column', gap:14 }}>
                  {/* Patient */}
                  <div>
                    <label style={lbl}>Patient *</label>
                    <select value={bookForm.patientId} onChange={e=>setBookForm(f=>({...f,patientId:e.target.value}))} style={inp} required>
                      <option value="">— Select patient —</option>
                      {patients.map(p => <option key={p._id} value={p._id}>{p.name} {p.phone?`· ${p.phone}`:''}</option>)}
                    </select>
                  </div>
                  {/* Doctor */}
                  <div>
                    <label style={lbl}>Doctor *</label>
                    <select value={bookForm.doctorId} onChange={e=>setBookForm(f=>({...f,doctorId:e.target.value,timeSlot:''}))} style={inp} required>
                      <option value="">— Select doctor —</option>
                      {doctors.map(d => {
                        const ol = doctorOnLeaveIds.has(d._id?.toString());
                        return <option key={d._id} value={d._id} disabled={ol}>{ol?'🏥 ':''}{d.name} — {d.specialization||d.department||'General'}{ol?' (On Leave Today)':''}</option>;
                      })}
                    </select>
                  </div>
                  {/* Date */}
                  <div>
                    <label style={lbl}>Date *</label>
                    <input type="date" value={bookForm.date} min={new Date().toISOString().split('T')[0]} onChange={e=>setBookForm(f=>({...f,date:e.target.value,timeSlot:''}))} style={inp} required />
                  </div>
                  {/* Time slot */}
                  <div>
                    <label style={lbl}>Time Slot * {slotsLoading && <span style={{ color:'#94a3b8', fontWeight:400 }}>Loading…</span>}</label>
                    {slots.length === 0 && bookForm.doctorId && !slotsLoading ? (
                      <div style={{ padding:'12px', background:'#fef3c7', border:'1px solid #fde68a', borderRadius:9, fontSize:13, color:'#92400e', fontWeight:600 }}>
                        ⚠️ No slots available — Doctor may be on leave or fully booked.
                      </div>
                    ) : (
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:6 }}>
                        {(slots.length > 0 ? slots : SLOTS).map(s => (
                          <button key={s} type="button" onClick={() => setBookForm(f=>({...f,timeSlot:s}))}
                            style={{ padding:'8px 4px', borderRadius:9, border:`1.5px solid ${bookForm.timeSlot===s?'#db2777':'#e2e8f0'}`, background:bookForm.timeSlot===s?'#fce7f3':'#f8fafc', color:bookForm.timeSlot===s?'#be185d':'#475569', fontWeight:bookForm.timeSlot===s?800:500, fontSize:11.5, cursor:'pointer', fontFamily:'inherit' }}>
                            {s}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Type */}
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                    <div>
                      <label style={lbl}>Appointment Type</label>
                      <select value={bookForm.type} onChange={e=>setBookForm(f=>({...f,type:e.target.value}))} style={inp}>
                        {['Consultation','Follow-up','Emergency','Routine Checkup','Specialist Referral'].map(t=><option key={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={lbl}>Notes</label>
                      <input value={bookForm.notes} onChange={e=>setBookForm(f=>({...f,notes:e.target.value}))} placeholder="Reason / symptoms" style={inp} />
                    </div>
                  </div>
                </div>
                <div style={{ display:'flex', gap:10, justifyContent:'flex-end', padding:'14px 24px', borderTop:'1px solid #f1f5f9', position:'sticky', bottom:0, background:'#fff', borderRadius:'0 0 20px 20px' }}>
                  <button type="button" onClick={()=>setShowBook(false)} style={{ padding:'10px 20px', background:'#f1f5f9', border:'1px solid #e2e8f0', borderRadius:10, fontWeight:600, cursor:'pointer', color:'#475569', fontFamily:'inherit' }}>Cancel</button>
                  <button type="submit" disabled={submitting||!bookForm.timeSlot} style={{ padding:'10px 22px', background:'linear-gradient(135deg,#db2777,#be185d)', border:'none', borderRadius:10, color:'#fff', fontWeight:700, cursor:'pointer', opacity:(submitting||!bookForm.timeSlot)?.7:1, fontFamily:'inherit' }}>
                    {submitting?'Booking…':'📅 Confirm Booking'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
