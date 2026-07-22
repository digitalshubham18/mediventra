import { useNavigate } from 'react-router-dom';
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { appointmentsAPI, usersAPI, reviewsAPI, doctorCabinsAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import PaymentModal from '../components/PaymentModal';

const STATUS_BADGE = { confirmed:'badge-success', pending:'badge-warning', cancelled:'badge-danger', completed:'badge-primary', 'no-show':'badge-gray' };
const DEPTS = ['Cardiology','Neurology','Orthopedics','General Medicine','Pediatrics','Dermatology','Psychiatry','Gynecology','Oncology','Surgery','ENT'];
const TYPES = ['Consultation','Follow-up','Emergency','Surgery Consult','Checkup','X-Ray Review'];
const FEES  = { Cardiology:800, Neurology:900, Orthopedics:700, Psychiatry:1000, Surgery:1500, General:500, default:600 };

export default function AppointmentsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [slots, setSlots] = useState([]);
  const [doctorOnLeave, setDoctorOnLeave] = useState(false);
  const [leaveMessage, setLeaveMessage] = useState('');
  const [form, setForm] = useState({ doctorId:'', date:'', timeSlot:'', department:'Cardiology', type:'Consultation', notes:'', symptoms:'', consultMode:'in-person' });
  const [submitting, setSubmitting] = useState(false);
  const [pendingPayment, setPendingPayment] = useState(null); // { appointmentId, amount, description }
  const [completingAppt, setCompletingAppt] = useState(null); // appointment object being marked complete
  const [consultForm, setConsultForm] = useState({ medicines:'', instructions:'', followUpRequired:false, followUpDate:'', followUpNotes:'' });
  const [completing, setCompleting] = useState(false);
  const [ratingAppt, setRatingAppt] = useState(null); // completed appointment awaiting the patient's rating
  const [ratingValue, setRatingValue] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);
  const [myWaitlist, setMyWaitlist] = useState([]);
  const [joiningWaitlist, setJoiningWaitlist] = useState(false);
  const [pendingRatings, setPendingRatings] = useState([]);
  const [seatingInfo, setSeatingInfo] = useState(null); // { appointment, cabin } shown right after booking
  const [bookDept, setBookDept] = useState(''); // department chosen first, before doctor selection
  const [admissionModalFor, setAdmissionModalFor] = useState(null); // appointment doctor is deciding admission for
  const [admissionReason, setAdmissionReason] = useState('');
  const [decidingAdmission, setDecidingAdmission] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [apptRes, docRes] = await Promise.allSettled([
        appointmentsAPI.getAll(filterStatus ? { status: filterStatus } : {}),
        usersAPI.getAll({ role:'doctor', status:'approved' }),
      ]);
      setAppointments(apptRes.value?.data?.data || []);
      setDoctors(docRes.value?.data?.data || []);
      if (docRes.value?.data?.data?.length) setForm(f => ({ ...f, doctorId: docRes.value?.data?.data[0]._id }));
    } catch { toast.error('Failed to load appointments'); }
    setLoading(false);
  }, [filterStatus]);

  useEffect(() => { load(); }, [load]);

  // Patients: check for completed visits still awaiting a rating, and
  // surface a "Rate your visit" prompt automatically.
  useEffect(() => {
    if (user?.role !== 'patient') return;
    reviewsAPI.myPending().then(res => setPendingRatings(res.data?.data || [])).catch(() => {});
  }, [user, appointments]);

  const loadWaitlist = () => appointmentsAPI.getMyWaitlist().then(res => setMyWaitlist(res.data.data || [])).catch(()=>{});
  useEffect(() => {
    if (user?.role !== 'patient') return;
    loadWaitlist();
  }, [user]);

  const onWaitlistForCurrentSelection = myWaitlist.find(w => w.doctor?._id === form.doctorId && form.date && new Date(w.date).toISOString().slice(0,10) === form.date);

  const joinWaitlistForSlot = async () => {
    if (!form.doctorId || !form.date) { toast.error('Select a doctor and date first'); return; }
    setJoiningWaitlist(true);
    try {
      const res = await appointmentsAPI.joinWaitlist(form.doctorId, form.date);
      toast.success(res.data.message || '✅ Added to the waitlist');
      loadWaitlist();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to join waitlist'); }
    setJoiningWaitlist(false);
  };
  const leaveWaitlistEntry = async (id) => {
    try { await appointmentsAPI.leaveWaitlist(id); toast.success('Removed from waitlist'); loadWaitlist(); }
    catch (err) { toast.error(err.response?.data?.error || 'Failed to leave waitlist'); }
  };

  const openCompleteModal = (appt) => {
    setCompletingAppt(appt);
    setConsultForm({ medicines:'', instructions:'', followUpRequired:false, followUpDate:'', followUpNotes:'' });
  };

  const submitCompletion = async (e) => {
    e.preventDefault();
    if (!consultForm.medicines.trim() || !consultForm.instructions.trim()) {
      toast.error('Please fill in the medicine and instructions fields'); return;
    }
    if (consultForm.followUpRequired && !consultForm.followUpDate) {
      toast.error('Pick a follow-up date, or turn off "Schedule follow-up"'); return;
    }
    setCompleting(true);
    try {
      await appointmentsAPI.update(completingAppt._id, {
        status: 'completed',
        consultation: { medicines: consultForm.medicines.trim(), instructions: consultForm.instructions.trim() },
        followUp: { required: consultForm.followUpRequired, date: consultForm.followUpRequired ? consultForm.followUpDate : null, notes: consultForm.followUpNotes.trim() },
      });
      toast.success(consultForm.followUpRequired ? '✅ Appointment completed — follow-up scheduled!' : '✅ Appointment marked complete!');
      setCompletingAppt(null);
      load();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed to complete appointment'); }
    setCompleting(false);
  };

  const submitAdmissionDecision = async (confirm) => {
    if (confirm && !admissionReason.trim()) { toast.error('Please give a reason for admission'); return; }
    setDecidingAdmission(true);
    try {
      await appointmentsAPI.decideAdmission(admissionModalFor._id, confirm, admissionReason.trim());
      toast.success(confirm ? '🛏️ Admission confirmed — reception notified to assign a bed' : 'Marked as not needing admission');
      setAdmissionModalFor(null);
      setAdmissionReason('');
      load();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed to record decision'); }
    setDecidingAdmission(false);
  };

  const submitRating = async (e) => {
    e.preventDefault();
    if (!ratingValue) { toast.error('Please select a star rating'); return; }
    setSubmittingRating(true);
    try {
      await reviewsAPI.create({ appointmentId: ratingAppt._id, rating: ratingValue, comment: ratingComment.trim() });
      toast.success('🙏 Thank you for your feedback!');
      setPendingRatings(rs => rs.filter(r => r._id !== ratingAppt._id));
      setRatingAppt(null); setRatingValue(0); setRatingComment('');
    } catch (e) { toast.error(e.response?.data?.error || 'Failed to submit rating'); }
    setSubmittingRating(false);
  };

  // const fetchSlots = async (doctorId, date) => {
  //   if (!doctorId || !date) return;
  //   try {
  //     const res = await appointmentsAPI.getSlots(doctorId, date);
  //     const data = res.data.data || {};
  //     if (data.doctorOnLeave) {
  //       setDoctorOnLeave(true);
  //       setLeaveMessage(data.leaveMessage || 'Doctor is on approved leave on this date.');
  //       setSlots([]);
  //       setForm(f => ({ ...f, timeSlot: '' }));
  //     } else {
  //       setDoctorOnLeave(false);
  //       setLeaveMessage('');
  //       setSlots(data.available || []);
  //       if (data.available?.length) setForm(f => ({ ...f, timeSlot: data.available[0] }));
  //     }
  //   } catch { setSlots([]); setDoctorOnLeave(false); }
  // };
  const fetchSlots = async (doctorId, date) => {
  if (!doctorId || !date) return;

  try {
    const res = await appointmentsAPI.getSlots(doctorId, date);

    console.log("SLOTS RESPONSE:", res.data);

    const data = res.data.data || {};

    if (data.doctorOnLeave) {
      setDoctorOnLeave(true);
      setLeaveMessage(
        data.leaveMessage || "Doctor is on approved leave on this date."
      );
      setSlots([]);
      setForm((f) => ({ ...f, timeSlot: "" }));
    } else {
      setDoctorOnLeave(false);
      setLeaveMessage("");

      setSlots(data.available || []);

      if (data.available?.length) {
        setForm((f) => ({
          ...f,
          timeSlot: data.available[0],
        }));
      }
    }
  } catch (err) {
    console.log("SLOT ERROR:", err);
    setSlots([]);
    setDoctorOnLeave(false);
  }
};

  // Step 1: create appointment (pending), then open payment
  const handleBook = async (e) => {
    e.preventDefault();
    const missing = [];
    if (!form.doctorId) missing.push('doctor');
    if (!form.date) missing.push('date');
    if (!form.timeSlot) missing.push('time slot');
    if (!form.department) missing.push('department');
    if (!form.notes || !form.notes.trim()) missing.push('reason for visit');
    if (!form.symptoms || !form.symptoms.trim()) missing.push('symptoms');
    if (missing.length) { toast.error(`Please fill in: ${missing.join(', ')}`); return; }
    setSubmitting(true);
    try {
      const selDoc = doctors.find(d => d._id === form.doctorId);
      const fee = FEES[form.department] || FEES.default;
      const res = await appointmentsAPI.create({ ...form, fee, symptoms: form.symptoms ? form.symptoms.split(',').map(s=>s.trim()) : [] });
      const appt = res.data.data;
      setShowModal(false);
      setPendingPayment({
        appointmentId: appt._id,
        amount: fee,
        description: `Consultation with Dr. ${selDoc?.name || 'Doctor'} — ${new Date(form.date).toLocaleDateString('en-IN')} ${form.timeSlot}`,
      });
    } catch (err) {
      const msg = err.response?.data?.error || 'Booking failed';
      toast.error(msg, { duration: err.response?.data?.previousAppointmentPending ? 8000 : 6000 });
      if (err.response?.data?.doctorOnLeave) setDoctorOnLeave(true);
      if (err.response?.data?.slotTaken) { fetchSlots(form.doctorId, form.date); }
    }
    setSubmitting(false);
  };

  const handlePaymentSuccess = (txn) => {
    setPendingPayment(null);
    toast.success(`✅ Payment of ₹${txn.amount} confirmed! Confirmation email sent.`);
    load();

    // Tell the patient exactly where to go — fetch the doctor's seating
    // area (if assigned) and show it alongside the appointment number.
    const doctorId = txn.appointment?.doctor?._id || txn.appointment?.doctor || form.doctorId;
    if (doctorId) {
      doctorCabinsAPI.getForDoctor(doctorId).then(res => {
        setSeatingInfo({ appointment: txn.appointment || null, cabin: res.data?.data || null, doctorName: txn.appointment?.doctor?.name });
      }).catch(() => {});
    }

    // Navigate to receipt page after a short delay so user sees the success animation first
    setTimeout(() => navigate(`/payments/${txn._id}`), 2600);
  };

  const handleStatusChange = async (id, status) => {
    try { await appointmentsAPI.update(id, { status }); toast.success(`Appointment ${status}`); load(); }
    catch { toast.error('Update failed'); }
  };

  // Confirming a video consultation lets the doctor lock in (or adjust)
  // the exact date/time — the patient is notified immediately with
  // whatever is confirmed here, so it needs its own small step rather
  // than a single-click status flip.
  const [videoConfirmTarget, setVideoConfirmTarget] = useState(null);
  const [videoConfirmDate, setVideoConfirmDate] = useState('');
  const [videoConfirmTime, setVideoConfirmTime] = useState('');
  const [confirmingVideo, setConfirmingVideo] = useState(false);

  const openConfirm = (a) => {
    if (a.consultMode === 'video') {
      setVideoConfirmTarget(a);
      setVideoConfirmDate(new Date(a.date).toISOString().slice(0,10));
      setVideoConfirmTime(a.timeSlot || '');
    } else {
      handleStatusChange(a._id, 'confirmed');
    }
  };

  const submitVideoConfirm = async () => {
    if (!videoConfirmDate || !videoConfirmTime.trim()) { toast.error('Pick both a date and a time'); return; }
    setConfirmingVideo(true);
    try {
      await appointmentsAPI.update(videoConfirmTarget._id, { status:'confirmed', date: videoConfirmDate, timeSlot: videoConfirmTime.trim() });
      toast.success('📹 Video consultation confirmed — patient notified');
      setVideoConfirmTarget(null);
      load();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed to confirm'); }
    setConfirmingVideo(false);
  };

  const handleCancel = async (id) => {
    if (!window.confirm('Cancel this appointment? If it was paid for, your payment will be automatically refunded to the same payment method within 24 hours.')) return;
    try {
      const res = await appointmentsAPI.cancel(id);
      if (res.data.refund) {
        toast.success(`Appointment cancelled. ₹${res.data.refund.amount} refund initiated — back to your original payment method within 24 hours.`, { duration: 6000 });
      } else {
        toast.success('Appointment cancelled.');
      }
      load();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed to cancel'); }
  };

  const selDoc = doctors.find(d => d._id === form.doctorId);
  const estFee = FEES[form.department] || FEES.default;

  // Reset to a clean slate when the modal opens — department-first flow:
  // patient picks a specialty, sees only doctors in that department, then
  // picks one of them before choosing a date/slot.
  const openBookModal = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];
    setForm({ doctorId:'', date: dateStr, timeSlot:'', department:'', type:'Consultation', notes:'', symptoms:'', consultMode:'in-person' });
    setBookDept('');
    setSlots([]); setDoctorOnLeave(false); setLeaveMessage('');
    setShowModal(true);
  };

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">📅 Appointment Management</div><div className="page-subtitle">Schedule and manage all appointments</div></div>
        <div className="page-actions">
          <select className="form-input" style={{ width:140, padding:'8px 28px 8px 10px', fontSize:13 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">All Status</option>
            {['confirmed','pending','cancelled','completed'].map(s => <option key={s}>{s}</option>)}
          </select>
          <button className="btn btn-primary" onClick={openBookModal}>+ Book Appointment</button>
        </div>
      </div>

      {user?.role === 'patient' && myWaitlist.length > 0 && (
        <motion.div initial={{ opacity:0,y:-8 }} animate={{ opacity:1,y:0 }} style={{ background:'linear-gradient(135deg,#eff6ff,#dbeafe)', border:'1.5px solid #bfdbfe', borderRadius:14, padding:'14px 18px', marginBottom:18 }}>
          <div style={{ fontWeight:800, color:'#1d4ed8', fontSize:13.5, marginBottom:8 }}>🔔 Your Waitlist</div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {myWaitlist.map(w => (
              <div key={w._id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', background:'#fff', borderRadius:10, padding:'8px 12px', flexWrap:'wrap', gap:8 }}>
                <div style={{ fontSize:12.5 }}>
                  <strong>Dr. {w.doctor?.name}</strong> — {new Date(w.date).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}
                  {w.status==='notified' && <span style={{ color:'#059669', fontWeight:700, marginLeft:8 }}>🎉 A slot opened — book now!</span>}
                </div>
                <button className="btn btn-outline btn-xs" onClick={()=>leaveWaitlistEntry(w._id)}>Leave Waitlist</button>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {user?.role === 'patient' && pendingRatings.length > 0 && (
        <motion.div initial={{ opacity:0,y:-8 }} animate={{ opacity:1,y:0 }} style={{ background:'linear-gradient(135deg,#fffbeb,#fef3c7)', border:'1.5px solid #fde68a', borderRadius:14, padding:'14px 18px', marginBottom:18, display:'flex', alignItems:'center', justifyContent:'space-between', gap:14, flexWrap:'wrap' }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <span style={{ fontSize:26 }}>⭐</span>
            <div>
              <div style={{ fontWeight:800, color:'#92400e', fontSize:14 }}>How was your visit with Dr. {pendingRatings[0].doctor?.name}?</div>
              <div style={{ fontSize:12, color:'#b45309' }}>{pendingRatings.length > 1 ? `You have ${pendingRatings.length} visits awaiting your feedback.` : 'Your feedback helps other patients and helps us improve care.'}</div>
            </div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => { setRatingAppt(pendingRatings[0]); setRatingValue(0); setRatingComment(''); }}>Rate Now →</button>
        </motion.div>
      )}

      {/* Stats */}
      <div className="grid-2 mb-3" style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14 }}>
        {[
          { label:'Total',     val:appointments.length, icon:'📅', color:'#e8effe' },
          { label:'Confirmed', val:appointments.filter(a=>a.status==='confirmed').length, icon:'✅', color:'#ecfdf5' },
          { label:'Pending',   val:appointments.filter(a=>a.status==='pending').length,   icon:'⏳', color:'#fffbeb' },
          { label:'Cancelled', val:appointments.filter(a=>a.status==='cancelled').length, icon:'❌', color:'#fef2f2' },
        ].map((s,i) => (
          <motion.div key={s.label} className="stat-card" initial={{ opacity:0,y:14 }} animate={{ opacity:1,y:0 }} transition={{ delay:i*.07 }}>
            <div className="stat-icon" style={{ background:s.color }}>{s.icon}</div>
            <div className="stat-value">{s.val}</div>
            <div className="stat-label">{s.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Table */}
      <motion.div className="card" initial={{ opacity:0,y:14 }} animate={{ opacity:1,y:0 }} transition={{ delay:.2 }}>
        <div className="card-body-0">
          {loading ? <div style={{ padding:40, textAlign:'center' }}><div className="spinner-lg" style={{ margin:'0 auto' }} /></div> : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Patient</th><th>Doctor</th><th>Dept</th><th>Date & Time</th><th>Booked At</th><th>Type</th><th>Status</th><th>Payment</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {appointments.length === 0 ? (
                    <tr><td colSpan={9} style={{ textAlign:'center', padding:32, color:'#94a3b8' }}>No appointments found</td></tr>
                  ) : appointments.map(a => (
                    <motion.tr key={a._id} initial={{ opacity:0 }} animate={{ opacity:1 }}>
                      <td><div className="td-main">{a.patient?.name}</div><div className="td-sub">{a.patient?.phone}</div></td>
                      <td className="text-sm">{a.doctor?.name}<div className="td-sub">{a.doctor?.specialization}</div></td>
                      <td><span className="badge badge-teal">{a.department}</span></td>
                      <td className="text-sm">{new Date(a.date).toLocaleDateString('en-IN')}<div className="td-sub">{a.timeSlot}</div></td>
                      <td className="text-sm">{a.createdAt ? new Date(a.createdAt).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}) : '—'}<div className="td-sub">{a.createdAt ? new Date(a.createdAt).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',second:'2-digit'}) : ''}</div></td>
                      <td className="text-sm">{a.type}</td>
                      <td><span className={`badge ${STATUS_BADGE[a.status]||'badge-gray'}`}>{a.status}</span></td>
                      <td>
                        <span style={{ padding:'3px 8px', borderRadius:20, fontSize:11, fontWeight:700,
                          background: a.paymentStatus==='paid'?'#dcfce7':'#fef3c7',
                          color:       a.paymentStatus==='paid'?'#15803d':'#92400e' }}>
                          {a.fee===0 && a.paymentStatus==='paid' ? '🎁 Free' : a.paymentStatus==='paid' ? `✅ ₹${a.fee||0}` : `⏳ ₹${a.fee||estFee}`}
                        </span>
                      </td>
                      <td>
                        <div className="flex gap-1">
                          {a.paymentStatus !== 'paid' && user?.role === 'patient' && (
                            <button className="btn btn-primary btn-xs"
                              onClick={() => setPendingPayment({ appointmentId:a._id, amount:a.fee||estFee, description:`Appointment on ${new Date(a.date).toLocaleDateString('en-IN')}` })}>
                              Pay Now
                            </button>
                          )}
                          {['doctor','admin'].includes(user?.role) && a.status === 'pending' && (
                            <button className="btn btn-success btn-xs" onClick={() => openConfirm(a)}>{a.consultMode==='video' ? '📹 Confirm & Schedule' : 'Confirm'}</button>
                          )}
                          {['doctor','admin'].includes(user?.role) && a.status === 'confirmed' && (
                            <button className="btn btn-primary btn-xs" onClick={() => openCompleteModal(a)}>✓ Complete</button>
                          )}
                          {['doctor','admin'].includes(user?.role) && ['confirmed','pending'].includes(a.status) && (!a.admission || ['none','declined','flagged'].includes(a.admission.status)) && (
                            <button className="btn btn-outline btn-xs" onClick={() => { setAdmissionModalFor(a); setAdmissionReason(a.admission?.flagNote || ''); }}>🛏️ {a.admission?.status === 'flagged' ? 'Review Flag' : 'Admission?'}</button>
                          )}
                          {a.admission?.status === 'flagged' && (
                            <span className="badge" style={{ fontSize:10.5, background:'#fef3c7', color:'#92400e', fontWeight:700 }}>🛏️ Flagged by reception</span>
                          )}
                          {a.admission?.status === 'confirmed' && (
                            <span className="badge" style={{ fontSize:10.5, background:'#dcfce7', color:'#15803d', fontWeight:700 }}>🛏️ Admission confirmed</span>
                          )}
                          {a.admission?.status === 'assigned' && (
                            <span className="badge" style={{ fontSize:10.5, background:'#e0f2fe', color:'#0369a1', fontWeight:700 }}>🛏️ Bed assigned</span>
                          )}
                          {a.consultMode === 'video' && a.status === 'confirmed' && ['patient','doctor'].includes(user?.role) && (
                            <button className="btn btn-xs" style={{ background:'#7c3aed', color:'#fff' }} onClick={() => navigate(`/video-call/${a._id}`)}>📹 Join Video Call</button>
                          )}
                          {a.status !== 'cancelled' && a.status !== 'completed' && (
                            <button className="btn btn-outline btn-xs" onClick={() => handleCancel(a._id)}>Cancel</button>
                          )}
                          {user?.role === 'patient' && a.status === 'completed' && !a.ratingSubmitted && (
                            <button className="btn btn-warning btn-xs" onClick={() => { setRatingAppt(a); setRatingValue(0); setRatingComment(''); }}>⭐ Rate Visit</button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </motion.div>

      {/* Book Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="modal-overlay" onClick={e => { if(e.target===e.currentTarget) setShowModal(false); }}>
            <motion.div className="modal-box" style={{ maxWidth:540 }} initial={{ opacity:0,y:24,scale:.96 }} animate={{ opacity:1,y:0,scale:1 }} exit={{ opacity:0,y:24,scale:.96 }}>
              <div className="modal-header">
                <span className="modal-title">📅 Book Appointment</span>
                <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}>✕</button>
              </div>
              <div className="modal-body">
                <form onSubmit={handleBook}>
                  <div className="form-group">
                    <label className="form-label">1. Choose a Specialty / Department *</label>
                    <select className="form-input" required value={bookDept} onChange={e => { setBookDept(e.target.value); setForm(f => ({ ...f, department: e.target.value, doctorId: '', timeSlot: '' })); setSlots([]); }}>
                      <option value="">— Select department —</option>
                      {DEPTS.map(d => <option key={d}>{d}</option>)}
                    </select>
                  </div>

                  {bookDept && (
                    <div className="form-group">
                      <label className="form-label">2. Choose Your Doctor *</label>
                      {(() => {
                        const available = doctors.filter(d => (d.department === bookDept) || (d.specialization && d.specialization.toLowerCase().includes(bookDept.toLowerCase())));
                        if (available.length === 0) {
                          return <div style={{ padding:'14px', background:'#fef2f2', border:'1px solid #fecaca', borderRadius:10, fontSize:13, color:'#dc2626' }}>
                            😔 No doctors currently available in {bookDept}. Please choose a different department, or check back later.
                          </div>;
                        }
                        const anyOpenAppt = appointments.find(a => ['pending','confirmed'].includes(a.status));
                        return (
                          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, maxHeight:260, overflowY:'auto', paddingRight:2 }}>
                            {anyOpenAppt && (
                              <div style={{ gridColumn:'1/-1', background:'#fef2f2', border:'1px solid #fecaca', borderRadius:10, padding:'10px 12px', fontSize:12, color:'#dc2626', fontWeight:600 }}>
                                ⏳ You already have an open appointment with Dr. {anyOpenAppt.doctor?.name} on {new Date(anyOpenAppt.date).toLocaleDateString('en-IN')} at {anyOpenAppt.timeSlot}. Complete or cancel it before booking a new one.
                              </div>
                            )}
                            {available.map(d => {
                              const sel = form.doctorId === d._id;
                              const openAppt = anyOpenAppt;
                              return (
                                <button key={d._id} type="button"
                                  onClick={() => {
                                    if (openAppt) { toast.error(`You already have an open appointment with Dr. ${openAppt.doctor?.name}. Complete or cancel it before booking a new one.`, { duration: 7000 }); return; }
                                    setForm(f => ({ ...f, doctorId: d._id, timeSlot: '' })); setDoctorOnLeave(false); fetchSlots(d._id, form.date);
                                  }}
                                  style={{ textAlign:'left', padding:'10px 12px', borderRadius:11, border:`2px solid ${sel ? '#1648c9' : openAppt ? '#fecaca' : '#e2e8f0'}`, background: sel ? '#eff6ff' : openAppt ? '#fef2f2' : '#fff', cursor:'pointer', display:'flex', gap:9, alignItems:'flex-start', opacity: openAppt ? 0.75 : 1 }}>
                                  <div style={{ width:38, height:38, borderRadius:'50%', background:'linear-gradient(135deg,#1648c9,#0891b2)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:800, fontSize:13, flexShrink:0 }}>
                                    {d.name?.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()}
                                  </div>
                                  <div style={{ minWidth:0 }}>
                                    <div style={{ fontWeight:700, fontSize:12.5, color:'#0f172a' }}>Dr. {d.name}</div>
                                    <div style={{ fontSize:11, color:'#64748b', marginTop:1 }}>{d.specialization || d.department}</div>
                                    <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:3, flexWrap:'wrap' }}>
                                      {typeof d.rating === 'number' ? (
                                        <span style={{ fontSize:10.5, color:'#92400e', background:'#fffbeb', padding:'1px 6px', borderRadius:8, fontWeight:700 }}>★ {d.rating} ({d.reviewCount})</span>
                                      ) : (
                                        <span style={{ fontSize:10.5, color:'#94a3b8' }}>No reviews yet</span>
                                      )}
                                      {d.isOnline && <span style={{ fontSize:10, color:'#15803d', fontWeight:700 }}>● Online</span>}
                                      {openAppt && <span style={{ fontSize:10, color:'#dc2626', fontWeight:700 }}>⏳ Previous appointment not complete</span>}
                                    </div>
                                  </div>
                                  {sel && <span style={{ marginLeft:'auto', color:'#1648c9', fontSize:15, flexShrink:0 }}>✓</span>}
                                </button>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Date *</label>
                      <input type="date" className="form-input" required value={form.date} min={new Date().toISOString().split('T')[0]}
                        onChange={e => { setForm(f=>({...f,date:e.target.value,timeSlot:''})); fetchSlots(form.doctorId, e.target.value); }} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Time Slot *</label>
                      {doctorOnLeave ? (
                        <div style={{padding:'10px 14px',background:'#fef3c7',border:'1px solid #fde68a',borderRadius:9,fontSize:13,color:'#92400e',fontWeight:600}}>
                          ⚠️ {leaveMessage}
                        </div>
                      ) : slots.length === 0 && form.date ? (
                        <div style={{padding:'10px 14px',background:'#fee2e2',border:'1px solid #fecaca',borderRadius:9,fontSize:13,color:'#dc2626',fontWeight:600}}>
                          ❌ No slots available — all slots are booked for this date.
                          <div style={{ marginTop:8 }}>
                            {onWaitlistForCurrentSelection ? (
                              <span style={{ fontSize:12.5, color:'#92400e', fontWeight:700 }}>⏳ You're on the waitlist — we'll notify you if a slot opens up.</span>
                            ) : (
                              <button type="button" className="btn btn-outline btn-sm" disabled={joiningWaitlist} onClick={joinWaitlistForSlot} style={{ borderColor:'#dc2626', color:'#dc2626' }}>
                                {joiningWaitlist ? 'Joining…' : '🔔 Join Waitlist for This Date'}
                              </button>
                            )}
                          </div>
                        </div>
                      ) : (
                        <select className="form-input" required value={form.timeSlot} onChange={e => setForm(f=>({...f,timeSlot:e.target.value}))}>
                          <option value="">Select time</option>
                          {slots.map(s => <option key={s}>{s}</option>)}
                        </select>
                      )}
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Consultation Mode</label>
                    <div style={{ display:'flex', gap:8 }}>
                      <button type="button" onClick={()=>setForm(f=>({...f,consultMode:'in-person'}))}
                        style={{ flex:1, padding:'9px 10px', borderRadius:9, border:`1.5px solid ${form.consultMode==='in-person'?'#1648c9':'#e2e8f0'}`, background:form.consultMode==='in-person'?'#eff6ff':'#fff', color:form.consultMode==='in-person'?'#1648c9':'#64748b', fontWeight:700, fontSize:12.5, cursor:'pointer' }}>
                        🏥 In-Person
                      </button>
                      <button type="button" onClick={()=>setForm(f=>({...f,consultMode:'video'}))}
                        style={{ flex:1, padding:'9px 10px', borderRadius:9, border:`1.5px solid ${form.consultMode==='video'?'#1648c9':'#e2e8f0'}`, background:form.consultMode==='video'?'#eff6ff':'#fff', color:form.consultMode==='video'?'#1648c9':'#64748b', fontWeight:700, fontSize:12.5, cursor:'pointer' }}>
                        📹 Video Call
                      </button>
                    </div>
                    {form.consultMode==='video' && <div style={{ fontSize:11, color:'#94a3b8', marginTop:5 }}>Once the doctor confirms, a "Join Video Call" button will appear on this appointment at your scheduled time.</div>}
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Visit Type</label>
                      <select className="form-input" value={form.type} onChange={e => setForm(f=>({...f,type:e.target.value}))}>
                        {TYPES.map(t => <option key={t}>{t}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Symptoms (comma-sep.) *</label>
                      <input className="form-input" required value={form.symptoms} placeholder="fever, headache…" onChange={e => setForm(f=>({...f,symptoms:e.target.value}))} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Reason for Visit *</label>
                    <textarea className="form-input" rows={2} required value={form.notes} onChange={e => setForm(f=>({...f,notes:e.target.value}))} placeholder="Describe why you need this appointment…" />
                  </div>

                  {/* Fee preview */}
                  <div style={{ background:'linear-gradient(135deg,#eff6ff,#e0f2fe)', border:'1px solid #bfdbfe', borderRadius:12, padding:'14px 16px', marginBottom:4, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <div>
                      <div style={{ fontWeight:700, color:'#1e40af', fontSize:14 }}>Consultation Fee</div>
                      <div style={{ fontSize:12, color:'#3b82f6' }}>Payment required to confirm booking</div>
                    </div>
                    <div style={{ fontSize:22, fontWeight:900, color:'#1e40af' }}>₹{estFee}</div>
                  </div>

                  <div className="modal-footer" style={{ marginTop:16 }}>
                    <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                    <button type="submit" className="btn btn-primary" disabled={submitting}>
                      {submitting ? 'Creating…' : `Proceed to Pay ₹${estFee} →`}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Payment Modal */}
      {pendingPayment && (
        <PaymentModal
          type="appointment"
          refId={pendingPayment.appointmentId}
          amount={pendingPayment.amount}
          description={pendingPayment.description}
          onSuccess={handlePaymentSuccess}
          onClose={() => { setPendingPayment(null); load(); }}
        />
      )}

      {/* ── Doctor: Complete Consultation Modal ── */}
      <AnimatePresence>
        {completingAppt && (
          <div className="modal-overlay" onClick={e => { if(e.target===e.currentTarget) setCompletingAppt(null); }}>
            <motion.div className="modal-box" style={{ maxWidth:520 }} initial={{ opacity:0,y:24,scale:.96 }} animate={{ opacity:1,y:0,scale:1 }} exit={{ opacity:0,y:24,scale:.96 }}>
              <div className="modal-header">
                <span className="modal-title">✓ Complete Consultation — {completingAppt.patient?.name}</span>
                <button className="btn btn-ghost btn-icon" onClick={() => setCompletingAppt(null)}>✕</button>
              </div>
              <form onSubmit={submitCompletion}>
                <div className="modal-body">
                  <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:10, padding:'9px 13px', marginBottom:16, fontSize:12.5, color:'#1e40af' }}>
                    Record what was prescribed and advised — this becomes part of the patient's health record and lets them know exactly what to do next.
                  </div>
                  <div className="form-group">
                    <label className="form-label">Medicine Required *</label>
                    <textarea className="form-input" rows={2} required value={consultForm.medicines} onChange={e=>setConsultForm(f=>({...f,medicines:e.target.value}))} placeholder="e.g. Paracetamol 500mg twice daily for 5 days, Amoxicillin 250mg...  (write 'None' if no medication needed)" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">What To Do / Not Do *</label>
                    <textarea className="form-input" rows={3} required value={consultForm.instructions} onChange={e=>setConsultForm(f=>({...f,instructions:e.target.value}))} placeholder="e.g. Rest for 3 days, drink plenty of fluids, avoid heavy exercise, avoid spicy food, return if fever persists beyond 3 days..." />
                  </div>
                  <div style={{ background:'#f8fafc', borderRadius:10, padding:'12px 14px', marginTop:6 }}>
                    <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:13, fontWeight:700, color:'#0f172a' }}>
                      <input type="checkbox" checked={consultForm.followUpRequired} onChange={e=>setConsultForm(f=>({...f,followUpRequired:e.target.checked}))} style={{ width:16, height:16 }} />
                      📅 Schedule a follow-up meeting
                    </label>
                    {consultForm.followUpRequired ? (
                      <div style={{ marginTop:10 }}>
                        <label className="form-label">Follow-up Date *</label>
                        <input type="date" className="form-input" required min={new Date().toISOString().split('T')[0]} value={consultForm.followUpDate} onChange={e=>setConsultForm(f=>({...f,followUpDate:e.target.value}))} />
                        <label className="form-label" style={{ marginTop:8 }}>Notes for follow-up (optional)</label>
                        <input className="form-input" value={consultForm.followUpNotes} onChange={e=>setConsultForm(f=>({...f,followUpNotes:e.target.value}))} placeholder="e.g. Bring latest blood test report" />
                        <div style={{ fontSize:11.5, color:'#64748b', marginTop:6 }}>A pending follow-up appointment will be created automatically for the patient.</div>
                      </div>
                    ) : (
                      <div style={{ fontSize:11.5, color:'#94a3b8', marginTop:6 }}>Leave unchecked to mark this visit fully complete with no follow-up needed.</div>
                    )}
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-outline" onClick={() => setCompletingAppt(null)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={completing}>{completing ? 'Saving…' : consultForm.followUpRequired ? '✓ Complete & Schedule Follow-up' : '✓ Mark Complete'}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Patient: Rate Visit Modal ── */}
      <AnimatePresence>
        {ratingAppt && (
          <div className="modal-overlay" onClick={e => { if(e.target===e.currentTarget) setRatingAppt(null); }}>
            <motion.div className="modal-box" style={{ maxWidth:440 }} initial={{ opacity:0,y:24,scale:.96 }} animate={{ opacity:1,y:0,scale:1 }} exit={{ opacity:0,y:24,scale:.96 }}>
              <div className="modal-header">
                <span className="modal-title">⭐ Rate Your Visit</span>
                <button className="btn btn-ghost btn-icon" onClick={() => setRatingAppt(null)}>✕</button>
              </div>
              <form onSubmit={submitRating}>
                <div className="modal-body" style={{ textAlign:'center' }}>
                  <p style={{ fontSize:13.5, color:'#475569', marginBottom:16 }}>
                    How was your visit with <strong>Dr. {ratingAppt.doctor?.name}</strong>?
                  </p>
                  <div style={{ display:'flex', justifyContent:'center', gap:6, marginBottom:18 }}>
                    {[1,2,3,4,5].map(n => (
                      <button key={n} type="button" onClick={() => setRatingValue(n)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:34, color: n<=ratingValue ? '#f59e0b' : '#e2e8f0', transition:'color .15s', lineHeight:1 }}>★</button>
                    ))}
                  </div>
                  <textarea className="form-input" rows={3} value={ratingComment} onChange={e=>setRatingComment(e.target.value)} placeholder="Optional — tell us more about your experience…" style={{ textAlign:'left' }} />
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-outline" onClick={() => setRatingAppt(null)}>Maybe Later</button>
                  <button type="submit" className="btn btn-primary" disabled={submittingRating || !ratingValue}>{submittingRating ? 'Submitting…' : 'Submit Feedback'}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* ── Where to Meet — shown right after a booking is confirmed ── */}
      <AnimatePresence>
        {seatingInfo && (
          <div className="modal-overlay" onClick={e => { if(e.target===e.currentTarget) setSeatingInfo(null); }}>
            <motion.div className="modal-box" style={{ maxWidth:420 }} initial={{ opacity:0,y:24,scale:.96 }} animate={{ opacity:1,y:0,scale:1 }}>
              <div className="modal-header">
                <span className="modal-title">✅ Appointment Confirmed!</span>
                <button className="btn btn-ghost btn-icon" onClick={() => setSeatingInfo(null)}>✕</button>
              </div>
              <div className="modal-body" style={{ textAlign:'center', padding:'20px 24px' }}>
                {seatingInfo.appointment?.appointmentNumber && (
                  <div style={{ marginBottom:18 }}>
                    <div style={{ fontSize:11, color:'#94a3b8', fontWeight:700, textTransform:'uppercase', letterSpacing:.5 }}>Appointment Number</div>
                    <div style={{ fontSize:22, fontWeight:900, color:'#0f172a', fontFamily:'monospace' }}>{seatingInfo.appointment.appointmentNumber}</div>
                  </div>
                )}
                <div style={{ fontSize:13.5, color:'#64748b', marginBottom:14 }}>Where to meet {seatingInfo.doctorName ? `Dr. ${seatingInfo.doctorName}` : 'your doctor'}:</div>
                {seatingInfo.cabin ? (
                  <div style={{ background:'#eff6ff', border:'1.5px solid #bfdbfe', borderRadius:14, padding:'18px' }}>
                    <div style={{ fontSize:30, marginBottom:6 }}>🪑</div>
                    <div style={{ fontSize:22, fontWeight:900, color:'#1e40af' }}>{seatingInfo.cabin.cabinNo}</div>
                    <div style={{ fontSize:13, color:'#475569', marginTop:4 }}>{seatingInfo.cabin.building} · Floor {seatingInfo.cabin.floor}{seatingInfo.cabin.wing ? ` · ${seatingInfo.cabin.wing}` : ''}</div>
                    {seatingInfo.cabin.notes && <div style={{ fontSize:12, color:'#94a3b8', marginTop:6 }}>{seatingInfo.cabin.notes}</div>}
                  </div>
                ) : (
                  <div style={{ background:'#fffbeb', border:'1px solid #fde68a', borderRadius:12, padding:'14px', fontSize:12.5, color:'#92400e' }}>
                    Seating area not assigned yet — please check at the reception desk on arrival.
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button className="btn btn-primary" style={{ width:'100%' }} onClick={() => setSeatingInfo(null)}>Got it!</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {videoConfirmTarget && (
        <div className="modal-overlay" onClick={e=>{ if(e.target===e.currentTarget) setVideoConfirmTarget(null); }}>
          <div className="modal-box" style={{ maxWidth:380 }}>
            <div className="modal-header">
              <span className="modal-title">📹 Confirm & Schedule Video Call</span>
              <button className="btn btn-ghost btn-icon" onClick={()=>setVideoConfirmTarget(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ fontSize:12.5, color:'#64748b', marginBottom:12 }}>
                Patient: <strong>{videoConfirmTarget.patient?.name}</strong>
              </div>
              <div className="form-group"><label className="form-label">Date *</label><input type="date" className="form-input" value={videoConfirmDate} onChange={e=>setVideoConfirmDate(e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Time *</label><input className="form-input" placeholder="e.g. 4:30 PM" value={videoConfirmTime} onChange={e=>setVideoConfirmTime(e.target.value)} /></div>
              <div style={{ fontSize:11, color:'#94a3b8' }}>The patient will be notified immediately with this exact date and time, and a "Join Video Call" button will appear on their appointment.</div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={()=>setVideoConfirmTarget(null)}>Cancel</button>
              <button className="btn btn-primary" disabled={confirmingVideo} onClick={submitVideoConfirm}>{confirmingVideo?'Confirming…':'✅ Confirm & Notify Patient'}</button>
            </div>
          </div>
        </div>
      )}

      {admissionModalFor && (
        <div className="modal-overlay" onClick={e=>{ if(e.target===e.currentTarget) setAdmissionModalFor(null); }}>
          <div className="modal-box" style={{ maxWidth:420 }}>
            <div className="modal-header">
              <span className="modal-title">🛏️ Admission Decision — {admissionModalFor.patient?.name}</span>
              <button className="btn btn-ghost btn-icon" onClick={()=>setAdmissionModalFor(null)}>✕</button>
            </div>
            <div className="modal-body">
              {admissionModalFor.admission?.status === 'flagged' && (
                <div style={{ background:'#fef3c7', border:'1px solid #fde68a', borderRadius:10, padding:'10px 14px', marginBottom:14, fontSize:12.5, color:'#92400e' }}>
                  🛏️ Reception flagged this patient as a possible admission at check-in{admissionModalFor.admission.flagNote ? `: "${admissionModalFor.admission.flagNote}"` : ''}. Please confirm or decline based on your examination.
                </div>
              )}
              <div style={{ fontSize:12.5, color:'#64748b', marginBottom:12 }}>
                Only confirm if this patient genuinely needs an inpatient bed — this notifies reception to prepare a room.
              </div>
              <div className="form-group">
                <label className="form-label">Reason for admission (required to confirm)</label>
                <textarea className="form-input" rows={3} value={admissionReason} onChange={e=>setAdmissionReason(e.target.value)} placeholder="e.g. Requires observation for 48 hours post-procedure" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" disabled={decidingAdmission} onClick={() => submitAdmissionDecision(false)}>Not Needed</button>
              <button className="btn btn-primary" disabled={decidingAdmission} onClick={() => submitAdmissionDecision(true)}>{decidingAdmission ? 'Saving…' : '✓ Confirm Admission'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
