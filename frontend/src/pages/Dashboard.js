// import React, { useEffect, useState } from 'react';
// import { motion } from 'framer-motion';
// import { Bar, Line, Doughnut } from 'react-chartjs-2';
// import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend, Filler } from 'chart.js';
// import { useAuth } from '../context/AuthContext';
// import { analyticsAPI, appointmentsAPI, remindersAPI, alertsAPI } from '../utils/api';
// import { useNavigate } from 'react-router-dom';
import { getSocket } from '../utils/socket';
import { useLanguage } from '../context/LanguageContext';
import FinanceDashboard from './FinanceDashboard';
import RoleBasedDashboard from './RoleBasedDashboards';
import { NurseDashboard, PharmacistDashboard, ITTechDashboard, AmbulanceDashboard, ElectricianDashboard, PlumberDashboard, EquipmentTechDashboard, BiomedicalDashboard, SweeperDashboard, OTBoyDashboard, RadiologyTechDashboard, DialysisTechDashboard } from './StaffDashboards';
import ReceptionistDashboard from './ReceptionistDashboard';
import WardboyDashboard from './WardboyDashboard';
import DoctorDashboard from './DoctorDashboard';
import SecurityDashboard from './SecurityDashboard';
// import toast from 'react-hot-toast';

// ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend, Filler);

// const CHART_OPTS = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { grid: { color: 'rgba(0,0,0,.04)' } } } };

// function StatCard({ icon, value, label, change, color, delay = 0 }) {
//   const [count, setCount] = useState(0);
//   useEffect(() => {
//     if (!value || isNaN(value)) return;
//     let start = 0;
//     const end = parseInt(value);
//     const step = Math.ceil(end / 28);
//     const timer = setInterval(() => {
//       start = Math.min(start + step, end);
//       setCount(start);
//       if (start >= end) clearInterval(timer);
//     }, 45);
//     return () => clearInterval(timer);
//   }, [value]);

//   return (
//     <motion.div className="stat-card" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.38, ease: [0.22, 1, 0.36, 1] }}>
//       <div className="stat-icon" style={{ background: color }}>{icon}</div>
//       <div className="stat-value">{isNaN(value) ? value : count}</div>
//       <div className="stat-label">{label}</div>
//       {change && <div className={`stat-change ${change.dir}`}>{change.text}</div>}
//     </motion.div>
//   );
// }

// export default function Dashboard() {
//   const { user } = useAuth();
//   const navigate = useNavigate();
//   const [stats, setStats] = useState(null);
//   const [appointments, setAppointments] = useState([]);
//   const [alerts, setAlerts] = useState([]);
//   const [reminders, setReminders] = useState([]);
//   const [loading, setLoading] = useState(true);

//   useEffect(() => {
//     const load = async () => {
//       try {
//         const [apptRes, alertRes, remRes] = await Promise.all([
//           appointmentsAPI.getAll({ limit: 6 }),
//           alertsAPI.getAll({ limit: 5 }),
//           remindersAPI.getAll({ status: 'active' }),
//         ]);
//         setAppointments(apptRes.value?.data?.data || []);
//         setAlerts(alertRes.value?.data?.data || []);
//         setReminders(remRes.value?.data?.data || []);
//         if (['admin', 'doctor'].includes(user?.role)) {
//           const anaRes = await analyticsAPI.getDashboard();
//           setStats(anaRes.data.data);
//         }
//       } catch (err) {
//         console.error(err);
//       } finally {
//         setLoading(false);
//       }
//     };
//     load();
//   }, [user]);

//   if (loading) return (
//     <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
//       <div className="spinner-lg" />
//     </div>
//   );

//   // ── PATIENT DASHBOARD ─────────────────────────────────────────────
//   if (user?.role === 'patient') {
//     const myAppts = appointments.filter(a => a.patient?._id === user.id || a.patient?.email === user.email);
//     const myRems = reminders.filter(r => r.patient?._id === user.id || r.patient?.email === user.email);
//     return (
//       <div>
//         <div className="page-header">
//           <div>
//             <div className="page-title">My Health Dashboard</div>
//             <div className="page-subtitle">Track your health, appointments & medications</div>
//           </div>
//           <button className="sos-button" onClick={async () => { try { await alertsAPI.create({ type: 'SOS', severity: 'critical', message: 'Emergency SOS' }); toast.error('🚨 SOS sent!', { duration: 8000 }); } catch { toast.error('SOS activated!'); } }}>
//             🚨<span>SOS</span>
//           </button>
//         </div>
//         <div className="stat-grid">
//           <StatCard icon="❤️" value="120/80" label="Blood Pressure" color="#fef2f2" delay={0} />
//           <StatCard icon="💓" value={72} label="Pulse (bpm)" color="#e8effe" delay={0.06} />
//           <StatCard icon="🌡️" value="98.6°F" label="Temperature" color="#fffbeb" delay={0.12} />
//           <StatCard icon="🩸" value="98%" label="SpO2" color="#ecfdf5" delay={0.18} />
//         </div>
//         <div className="grid-2">
//           <div className="card">
//             <div className="card-header">
//               <span className="card-title">📅 My Appointments</span>
//               <button className="btn btn-primary btn-xs" onClick={() => navigate('/appointments')}>Book New</button>
//             </div>
//             <div className="card-body-0">
//               <div className="table-wrap">
//                 <table>
//                   <thead><tr><th>Doctor</th><th>Date</th><th>Status</th></tr></thead>
//                   <tbody>
//                     {myAppts.length === 0 ? <tr><td colSpan={3} style={{ textAlign: 'center', padding: 20, color: '#94a3b8' }}>No appointments yet</td></tr>
//                       : myAppts.slice(0, 4).map(a => (
//                       <tr key={a._id}>
//                         <td><div className="td-main">{a.doctor?.name}</div><div className="td-sub">{a.department}</div></td>
//                         <td className="text-sm">{new Date(a.date).toLocaleDateString()}<br /><span className="text-xs text-muted">{a.timeSlot}</span></td>
//                         <td><span className={`badge badge-${a.status === 'confirmed' ? 'success' : a.status === 'pending' ? 'warning' : 'danger'}`}>{a.status}</span></td>
//                       </tr>
//                     ))}
//                   </tbody>
//                 </table>
//               </div>
//             </div>
//           </div>
//           <div className="card">
//             <div className="card-header"><span className="card-title">⏰ Today's Medications</span></div>
//             <div className="card-body">
//               {myRems.length === 0 ? <div style={{ textAlign: 'center', padding: 20, color: '#94a3b8' }}>No reminders set</div>
//                 : myRems.slice(0, 4).map(r => (
//                 <div key={r._id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 11, borderRadius: 8, border: '1.5px solid #e2e8f0', marginBottom: 8, transition: 'border-color .18s' }}
//                   onMouseEnter={e => { e.currentTarget.style.borderColor = '#1648c9'; }}
//                   onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; }}
//                 >
//                   <span style={{ fontSize: 22 }}>💊</span>
//                   <div style={{ flex: 1 }}><div className="fw-7 text-sm">{r.medicineName}</div><div className="text-xs text-muted">{r.dose} · {r.times?.[0]}</div></div>
//                   <button className="btn btn-success btn-xs" onClick={(e) => { e.currentTarget.textContent = '✓ Done'; e.currentTarget.disabled = true; e.currentTarget.className = 'btn btn-outline btn-xs'; toast.success('Medication marked as taken!'); }}>✓ Taken</button>
//                 </div>
//               ))}
//             </div>
//           </div>
//         </div>
//       </div>
//     );
//   }

//   // ── ADMIN / DOCTOR DASHBOARD ──────────────────────────────────────
//   const summary = stats?.summary || {};
//   const charts = stats?.charts || {};

//   const visitsData = {
//     labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
//     datasets: [{
//       label: 'Patients', data: [24, 18, 32, 28, 42, 15, 8],
//       backgroundColor: 'rgba(22,72,201,.72)', borderRadius: 7, borderWidth: 0
//     }, {
//       label: 'Appointments', data: [18, 14, 26, 22, 35, 12, 6],
//       backgroundColor: 'rgba(8,145,178,.65)', borderRadius: 7, borderWidth: 0
//     }]
//   };

//   const deptData = {
//     labels: ['Cardiology', 'Neurology', 'Orthopedics', 'General', 'Pediatrics'],
//     datasets: [{ data: [30, 20, 18, 25, 7], backgroundColor: ['#1648c9','#0891b2','#059669','#d97706','#7c3aed'], borderWidth: 3, borderColor: '#fff' }]
//   };

//   const revenueData = {
//     labels: ['Jan','Feb','Mar','Apr','May','Jun'],
//     datasets: [{ label: 'Revenue', data: [35000,38000,42000,39000,45000,48290], borderColor: '#1648c9', backgroundColor: 'rgba(22,72,201,.06)', fill: true, tension: .4, borderWidth: 2, pointBackgroundColor: '#1648c9', pointRadius: 4 }]
//   };

//   return (
//     <div>
//       <div className="page-header">
//         <div>
//           <div className="page-title">{user?.role === 'doctor' ? 'Doctor Dashboard' : 'Admin Dashboard'}</div>
//           <div className="page-subtitle">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} · Good {new Date().getHours() < 12 ? 'morning' : 'afternoon'}, {user?.name?.split(' ')[0]}!</div>
//         </div>
//         <div className="page-actions">
//           <button className="btn btn-outline btn-sm" onClick={() => navigate('/analytics')}>📄 Reports</button>
//           <button className="btn btn-primary btn-sm" onClick={() => navigate('/appointments')}>+ Appointment</button>
//         </div>
//       </div>

//       <div className="stat-grid">
//         <StatCard icon="👥" value={summary.totalPatients || 0} label="Total Patients" color="#e8effe" change={{ dir: 'up', text: '↑ 12% this month' }} delay={0} />
//         <StatCard icon="🩺" value={summary.totalDoctors || 0} label="Active Doctors" color="#e0f7fa" change={{ dir: 'up', text: '↑ 3 new' }} delay={0.07} />
//         <StatCard icon="📅" value={summary.todayAppointments || 0} label="Today's Appointments" color="#fffbeb" change={{ dir: 'up', text: '5 confirmed' }} delay={0.14} />
//         <StatCard icon="💊" value={summary.totalOrders || 0} label="Medicine Orders" color="#ecfdf5" change={{ dir: 'up', text: '↑ 8 today' }} delay={0.21} />
//         <StatCard icon="🚨" value={summary.activeAlerts || 0} label="Active Alerts" color="#fef2f2" change={{ dir: 'warn', text: 'Action needed' }} delay={0.28} />
//         <StatCard icon="⏳" value={summary.pendingUsers || 0} label="Pending Approvals" color="#f5f3ff" change={{ dir: 'warn', text: 'Requires review' }} delay={0.35} />
//       </div>

//       <div className="grid-2 mt-2">
//         <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.38 }}>
//           <div className="card-header">
//             <span className="card-title">📈 Patient Visits</span>
//             <select className="form-input" style={{ width: 120, padding: '5px 28px 5px 8px', fontSize: 12 }}>
//               <option>This Week</option><option>This Month</option>
//             </select>
//           </div>
//           <div className="card-body">
//             <div style={{ height: 190, position: 'relative' }}>
//               <Bar data={visitsData} options={{ ...CHART_OPTS, plugins: { legend: { display: true, position: 'top', labels: { font: { size: 11 }, boxWidth: 10 } } } }} />
//             </div>
//           </div>
//         </motion.div>
//         <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.27, duration: 0.38 }}>
//           <div className="card-header"><span className="card-title">🏥 Department Load</span></div>
//           <div className="card-body">
//             <div style={{ height: 190, position: 'relative' }}>
//               <Doughnut data={deptData} options={{ responsive: true, maintainAspectRatio: false, cutout: '67%', plugins: { legend: { position: 'right', labels: { font: { size: 11 }, boxWidth: 9, padding: 6 } } } }} />
//             </div>
//           </div>
//         </motion.div>
//       </div>

//       <div className="grid-2 mt-2">
//         <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.34, duration: 0.38 }}>
//           <div className="card-header">
//             <span className="card-title">📅 Recent Appointments</span>
//             <button className="btn btn-outline btn-xs" onClick={() => navigate('/appointments')}>View All</button>
//           </div>
//           <div className="card-body-0">
//             <div className="table-wrap">
//               <table>
//                 <thead><tr><th>Patient</th><th>Doctor</th><th>Time</th><th>Status</th></tr></thead>
//                 <tbody>
//                   {appointments.slice(0, 5).map(a => (
//                     <tr key={a._id}>
//                       <td><div className="td-main">{a.patient?.name}</div><div className="td-sub">{a.department}</div></td>
//                       <td className="text-sm">{a.doctor?.name}</td>
//                       <td className="text-sm">{a.timeSlot}<br /><span className="text-xs text-muted">{new Date(a.date).toLocaleDateString()}</span></td>
//                       <td><span className={`badge badge-${a.status === 'confirmed' ? 'success' : a.status === 'pending' ? 'warning' : 'danger'}`}>{a.status}</span></td>
//                     </tr>
//                   ))}
//                 </tbody>
//               </table>
//             </div>
//           </div>
//         </motion.div>
//         <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.41, duration: 0.38 }}>
//           <div className="card-header">
//             <span className="card-title">🚨 Alert Log</span>
//             <button className="btn btn-outline btn-xs" onClick={() => navigate('/emergency')}>View All</button>
//           </div>
//           <div className="card-body">
//             {alerts.slice(0, 3).map(a => (
//               <div key={a._id} style={{ display: 'flex', gap: 10, padding: 10, borderRadius: 8, background: a.severity === 'critical' ? '#fef2f2' : a.severity === 'high' ? '#fffbeb' : '#f0f4ff', marginBottom: 8 }}>
//                 <span style={{ fontSize: 18 }}>{a.type === 'SOS' ? '🚨' : a.type === 'Medication' ? '⏰' : '❤️'}</span>
//                 <div style={{ flex: 1 }}>
//                   <div className="fw-7 text-sm">{a.patient?.name} · {a.type}</div>
//                   <div className="text-xs text-muted">{a.message}</div>
//                 </div>
//                 <span className={`badge badge-${a.status === 'resolved' ? 'success' : 'danger'}`}>{a.status}</span>
//               </div>
//             ))}
//           </div>
//         </motion.div>
//       </div>

//       <motion.div className="card mt-2" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.48, duration: 0.38 }}>
//         <div className="card-header">
//           <span className="card-title">💰 Monthly Revenue</span>
//           <button className="btn btn-outline btn-xs" onClick={() => navigate('/analytics')}>Full Analytics</button>
//         </div>
//         <div className="card-body">
//           <div style={{ height: 175, position: 'relative' }}>
//             <Line data={revenueData} options={{ ...CHART_OPTS, scales: { x: { grid: { display: false } }, y: { beginAtZero: false, ticks: { callback: v => '$' + Math.round(v / 1000) + 'k' }, grid: { color: 'rgba(0,0,0,.04)' } } } }} />
//           </div>
//         </div>
//       </motion.div>
//     </div>
//   );
// }


// import React, { useEffect, useState } from 'react';
// import { motion } from 'framer-motion';
// import { Bar, Line, Doughnut } from 'react-chartjs-2';
// import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend, Filler } from 'chart.js';
// import { useAuth } from '../context/AuthContext';
// import { analyticsAPI, appointmentsAPI, remindersAPI, alertsAPI } from '../utils/api';
// import { useNavigate } from 'react-router-dom';
// import toast from 'react-hot-toast';
// import { TodayScheduleWidget, WeeklyTimetableWidget, MyTasksWidget, LeaveNotificationsWidget } from '../components/DashboardWidgets';

// ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend, Filler);

// const CHART_OPTS = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { grid: { color: 'rgba(0,0,0,.04)' } } } };

// function StatCard({ icon, value, label, change, color, delay = 0 }) {
//   const [count, setCount] = useState(0);
//   useEffect(() => {
//     if (!value || isNaN(value)) return;
//     let start = 0;
//     const end = parseInt(value);
//     const step = Math.ceil(end / 28);
//     const timer = setInterval(() => {
//       start = Math.min(start + step, end);
//       setCount(start);
//       if (start >= end) clearInterval(timer);
//     }, 45);
//     return () => clearInterval(timer);
//   }, [value]);

//   return (
//     <motion.div className="stat-card" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.38, ease: [0.22, 1, 0.36, 1] }}>
//       <div className="stat-icon" style={{ background: color }}>{icon}</div>
//       <div className="stat-value">{isNaN(value) ? value : count}</div>
//       <div className="stat-label">{label}</div>
//       {change && <div className={`stat-change ${change.dir}`}>{change.text}</div>}
//     </motion.div>
//   );
// }

// export default function Dashboard() {
//   const { user } = useAuth();
//   const navigate = useNavigate();
//   const [stats, setStats] = useState(null);
//   const [appointments, setAppointments] = useState([]);
//   const [alerts, setAlerts] = useState([]);
//   const [reminders, setReminders] = useState([]);
//   const [loading, setLoading] = useState(true);

//   useEffect(() => {
//     const load = async () => {
//       try {
//         const [apptRes, alertRes, remRes] = await Promise.all([
//           appointmentsAPI.getAll({ limit: 6 }),
//           alertsAPI.getAll({ limit: 5 }),
//           remindersAPI.getAll({ status: 'active' }),
//         ]);
//         setAppointments(apptRes.value?.data?.data || []);
//         setAlerts(alertRes.value?.data?.data || []);
//         setReminders(remRes.value?.data?.data || []);
//         if (['admin', 'doctor'].includes(user?.role)) {
//           const anaRes = await analyticsAPI.getDashboard();
//           setStats(anaRes.data.data);
//         }
//       } catch (err) {
//         console.error(err);
//       } finally {
//         setLoading(false);
//       }
//     };
//     load();
//   }, [user]);

//   if (loading) return (
//     <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
//       <div className="spinner-lg" />
//     </div>
//   );

//   // ── PATIENT DASHBOARD ─────────────────────────────────────────────
//   if (user?.role === 'patient') {
//     const myAppts = appointments.filter(a => a.patient?._id === user.id || a.patient?.email === user.email);
//     const myRems = reminders.filter(r => r.patient?._id === user.id || r.patient?.email === user.email);
//     return (
//       <div>
//         <div className="page-header">
//           <div>
//             <div className="page-title">My Health Dashboard</div>
//             <div className="page-subtitle">Track your health, appointments & medications</div>
//           </div>
//           <button className="sos-button" onClick={async () => { try { await alertsAPI.create({ type: 'SOS', severity: 'critical', message: 'Emergency SOS' }); toast.error('🚨 SOS sent!', { duration: 8000 }); } catch { toast.error('SOS activated!'); } }}>
//             🚨<span>SOS</span>
//           </button>
//         </div>
//         <div className="stat-grid">
//           <StatCard icon="❤️" value="120/80" label="Blood Pressure" color="#fef2f2" delay={0} />
//           <StatCard icon="💓" value={72} label="Pulse (bpm)" color="#e8effe" delay={0.06} />
//           <StatCard icon="🌡️" value="98.6°F" label="Temperature" color="#fffbeb" delay={0.12} />
//           <StatCard icon="🩸" value="98%" label="SpO2" color="#ecfdf5" delay={0.18} />
//         </div>
//         <div className="grid-2">
//           <div className="card">
//             <div className="card-header">
//               <span className="card-title">📅 My Appointments</span>
//               <button className="btn btn-primary btn-xs" onClick={() => navigate('/appointments')}>Book New</button>
//             </div>
//             <div className="card-body-0">
//               <div className="table-wrap">
//                 <table>
//                   <thead><tr><th>Doctor</th><th>Date</th><th>Status</th></tr></thead>
//                   <tbody>
//                     {myAppts.length === 0 ? <tr><td colSpan={3} style={{ textAlign: 'center', padding: 20, color: '#94a3b8' }}>No appointments yet</td></tr>
//                       : myAppts.slice(0, 4).map(a => (
//                       <tr key={a._id}>
//                         <td><div className="td-main">{a.doctor?.name}</div><div className="td-sub">{a.department}</div></td>
//                         <td className="text-sm">{new Date(a.date).toLocaleDateString()}<br /><span className="text-xs text-muted">{a.timeSlot}</span></td>
//                         <td><span className={`badge badge-${a.status === 'confirmed' ? 'success' : a.status === 'pending' ? 'warning' : 'danger'}`}>{a.status}</span></td>
//                       </tr>
//                     ))}
//                   </tbody>
//                 </table>
//               </div>
//             </div>
//           </div>
//           <div className="card">
//             <div className="card-header"><span className="card-title">⏰ Today's Medications</span></div>
//             <div className="card-body">
//               {myRems.length === 0 ? <div style={{ textAlign: 'center', padding: 20, color: '#94a3b8' }}>No reminders set</div>
//                 : myRems.slice(0, 4).map(r => (
//                 <div key={r._id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 11, borderRadius: 8, border: '1.5px solid #e2e8f0', marginBottom: 8, transition: 'border-color .18s' }}
//                   onMouseEnter={e => { e.currentTarget.style.borderColor = '#1648c9'; }}
//                   onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; }}
//                 >
//                   <span style={{ fontSize: 22 }}>💊</span>
//                   <div style={{ flex: 1 }}><div className="fw-7 text-sm">{r.medicineName}</div><div className="text-xs text-muted">{r.dose} · {r.times?.[0]}</div></div>
//                   <button className="btn btn-success btn-xs" onClick={(e) => { e.currentTarget.textContent = '✓ Done'; e.currentTarget.disabled = true; e.currentTarget.className = 'btn btn-outline btn-xs'; toast.success('Medication marked as taken!'); }}>✓ Taken</button>
//                 </div>
//               ))}
//             </div>
//           </div>
//         </div>
//       </div>
//     );
//   }

//   // ── ADMIN / DOCTOR DASHBOARD ──────────────────────────────────────
//   const summary = stats?.summary || {};
//   const charts = stats?.charts || {};

//   const visitsData = {
//     labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
//     datasets: [{
//       label: 'Patients', data: [24, 18, 32, 28, 42, 15, 8],
//       backgroundColor: 'rgba(22,72,201,.72)', borderRadius: 7, borderWidth: 0
//     }, {
//       label: 'Appointments', data: [18, 14, 26, 22, 35, 12, 6],
//       backgroundColor: 'rgba(8,145,178,.65)', borderRadius: 7, borderWidth: 0
//     }]
//   };

//   const deptData = {
//     labels: ['Cardiology', 'Neurology', 'Orthopedics', 'General', 'Pediatrics'],
//     datasets: [{ data: [30, 20, 18, 25, 7], backgroundColor: ['#1648c9','#0891b2','#059669','#d97706','#7c3aed'], borderWidth: 3, borderColor: '#fff' }]
//   };

//   const revenueData = {
//     labels: ['Jan','Feb','Mar','Apr','May','Jun'],
//     datasets: [{ label: 'Revenue', data: [35000,38000,42000,39000,45000,48290], borderColor: '#1648c9', backgroundColor: 'rgba(22,72,201,.06)', fill: true, tension: .4, borderWidth: 2, pointBackgroundColor: '#1648c9', pointRadius: 4 }]
//   };

//   return (
//     <div>
//       <div className="page-header">
//         <div>
//           <div className="page-title">{user?.role === 'doctor' ? 'Doctor Dashboard' : 'Admin Dashboard'}</div>
//           <div className="page-subtitle">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} · Good {new Date().getHours() < 12 ? 'morning' : 'afternoon'}, {user?.name?.split(' ')[0]}!</div>
//         </div>
//         <div className="page-actions">
//           <button className="btn btn-outline btn-sm" onClick={() => navigate('/analytics')}>📄 Reports</button>
//           <button className="btn btn-primary btn-sm" onClick={() => navigate('/appointments')}>+ Appointment</button>
//         </div>
//       </div>

//       <div className="stat-grid">
//         <StatCard icon="👥" value={summary.totalPatients || 0} label="Total Patients" color="#e8effe" change={{ dir: 'up', text: '↑ 12% this month' }} delay={0} />
//         <StatCard icon="🩺" value={summary.totalDoctors || 0} label="Active Doctors" color="#e0f7fa" change={{ dir: 'up', text: '↑ 3 new' }} delay={0.07} />
//         <StatCard icon="📅" value={summary.todayAppointments || 0} label="Today's Appointments" color="#fffbeb" change={{ dir: 'up', text: '5 confirmed' }} delay={0.14} />
//         <StatCard icon="💊" value={summary.totalOrders || 0} label="Medicine Orders" color="#ecfdf5" change={{ dir: 'up', text: '↑ 8 today' }} delay={0.21} />
//         <StatCard icon="🚨" value={summary.activeAlerts || 0} label="Active Alerts" color="#fef2f2" change={{ dir: 'warn', text: 'Action needed' }} delay={0.28} />
//         <StatCard icon="⏳" value={summary.pendingUsers || 0} label="Pending Approvals" color="#f5f3ff" change={{ dir: 'warn', text: 'Requires review' }} delay={0.35} />
//       </div>

//       <div className="grid-2 mt-2">
//         <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.38 }}>
//           <div className="card-header">
//             <span className="card-title">📈 Patient Visits</span>
//             <select className="form-input" style={{ width: 120, padding: '5px 28px 5px 8px', fontSize: 12 }}>
//               <option>This Week</option><option>This Month</option>
//             </select>
//           </div>
//           <div className="card-body">
//             <div style={{ height: 190, position: 'relative' }}>
//               <Bar data={visitsData} options={{ ...CHART_OPTS, plugins: { legend: { display: true, position: 'top', labels: { font: { size: 11 }, boxWidth: 10 } } } }} />
//             </div>
//           </div>
//         </motion.div>
//         <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.27, duration: 0.38 }}>
//           <div className="card-header"><span className="card-title">🏥 Department Load</span></div>
//           <div className="card-body">
//             <div style={{ height: 190, position: 'relative' }}>
//               <Doughnut data={deptData} options={{ responsive: true, maintainAspectRatio: false, cutout: '67%', plugins: { legend: { position: 'right', labels: { font: { size: 11 }, boxWidth: 9, padding: 6 } } } }} />
//             </div>
//           </div>
//         </motion.div>
//       </div>

//       <div className="grid-2 mt-2">
//         <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.34, duration: 0.38 }}>
//           <div className="card-header">
//             <span className="card-title">📅 Recent Appointments</span>
//             <button className="btn btn-outline btn-xs" onClick={() => navigate('/appointments')}>View All</button>
//           </div>
//           <div className="card-body-0">
//             <div className="table-wrap">
//               <table>
//                 <thead><tr><th>Patient</th><th>Doctor</th><th>Time</th><th>Status</th></tr></thead>
//                 <tbody>
//                   {appointments.slice(0, 5).map(a => (
//                     <tr key={a._id}>
//                       <td><div className="td-main">{a.patient?.name}</div><div className="td-sub">{a.department}</div></td>
//                       <td className="text-sm">{a.doctor?.name}</td>
//                       <td className="text-sm">{a.timeSlot}<br /><span className="text-xs text-muted">{new Date(a.date).toLocaleDateString()}</span></td>
//                       <td><span className={`badge badge-${a.status === 'confirmed' ? 'success' : a.status === 'pending' ? 'warning' : 'danger'}`}>{a.status}</span></td>
//                     </tr>
//                   ))}
//                 </tbody>
//               </table>
//             </div>
//           </div>
//         </motion.div>
//         <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.41, duration: 0.38 }}>
//           <div className="card-header">
//             <span className="card-title">🚨 Alert Log</span>
//             <button className="btn btn-outline btn-xs" onClick={() => navigate('/emergency')}>View All</button>
//           </div>
//           <div className="card-body">
//             {alerts.slice(0, 3).map(a => (
//               <div key={a._id} style={{ display: 'flex', gap: 10, padding: 10, borderRadius: 8, background: a.severity === 'critical' ? '#fef2f2' : a.severity === 'high' ? '#fffbeb' : '#f0f4ff', marginBottom: 8 }}>
//                 <span style={{ fontSize: 18 }}>{a.type === 'SOS' ? '🚨' : a.type === 'Medication' ? '⏰' : '❤️'}</span>
//                 <div style={{ flex: 1 }}>
//                   <div className="fw-7 text-sm">{a.patient?.name} · {a.type}</div>
//                   <div className="text-xs text-muted">{a.message}</div>
//                 </div>
//                 <span className={`badge badge-${a.status === 'resolved' ? 'success' : 'danger'}`}>{a.status}</span>
//               </div>
//             ))}
//           </div>
//         </motion.div>
//       </div>

//       <motion.div className="card mt-2" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.48, duration: 0.38 }}>
//         <div className="card-header">
//           <span className="card-title">💰 Monthly Revenue</span>
//           <button className="btn btn-outline btn-xs" onClick={() => navigate('/analytics')}>Full Analytics</button>
//         </div>
//         <div className="card-body">
//           <div style={{ height: 175, position: 'relative' }}>
//             <Line data={revenueData} options={{ ...CHART_OPTS, scales: { x: { grid: { display: false } }, y: { beginAtZero: false, ticks: { callback: v => '$' + Math.round(v / 1000) + 'k' }, grid: { color: 'rgba(0,0,0,.04)' } } } }} />
//           </div>
//         </div>
//       </motion.div>
//         <div className="grid-2" style={{ marginTop:20 }}>
//           <TodayScheduleWidget />
//           <MyTasksWidget />
//         </div>
//         <div style={{ marginTop:16 }}>
//           <WeeklyTimetableWidget />
//         </div>
//         <div style={{ marginTop:16 }}>
//           <LeaveNotificationsWidget />
//         </div>
//     </div>
//   );
// }

// import React, { useEffect, useState } from 'react';
// import { motion } from 'framer-motion';
// import { Bar, Line, Doughnut } from 'react-chartjs-2';
// import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend, Filler } from 'chart.js';
// import { useAuth } from '../context/AuthContext';
// import { analyticsAPI, appointmentsAPI, remindersAPI, alertsAPI } from '../utils/api';
// import { useNavigate } from 'react-router-dom';
// import toast from 'react-hot-toast';
// import { TodayScheduleWidget, MyTasksWidget, LeaveNotificationsWidget } from '../components/DashboardWidgets';

// ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend, Filler);

// const CHART_OPTS = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { grid: { color: 'rgba(0,0,0,.04)' } } } };

// function StatCard({ icon, value, label, change, color, delay = 0 }) {
//   const [count, setCount] = useState(0);
//   useEffect(() => {
//     if (!value || isNaN(value)) return;
//     let start = 0;
//     const end = parseInt(value);
//     const step = Math.ceil(end / 28);
//     const timer = setInterval(() => {
//       start = Math.min(start + step, end);
//       setCount(start);
//       if (start >= end) clearInterval(timer);
//     }, 45);
//     return () => clearInterval(timer);
//   }, [value]);

//   return (
//     <motion.div className="stat-card" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.38, ease: [0.22, 1, 0.36, 1] }}>
//       <div className="stat-icon" style={{ background: color }}>{icon}</div>
//       <div className="stat-value">{isNaN(value) ? value : count}</div>
//       <div className="stat-label">{label}</div>
//       {change && <div className={`stat-change ${change.dir}`}>{change.text}</div>}
//     </motion.div>
//   );
// }

// export default function Dashboard() {
//   const { user } = useAuth();
//   const navigate = useNavigate();
//   const [stats, setStats] = useState(null);
//   const [appointments, setAppointments] = useState([]);
//   const [alerts, setAlerts] = useState([]);
//   const [reminders, setReminders] = useState([]);
//   const [loading, setLoading] = useState(true);

//   useEffect(() => {
//     const load = async () => {
//       try {
//         const [apptRes, alertRes, remRes] = await Promise.all([
//           appointmentsAPI.getAll({ limit: 6 }),
//           alertsAPI.getAll({ limit: 5 }),
//           remindersAPI.getAll({ status: 'active' }),
//         ]);
//         setAppointments(apptRes.value?.data?.data || []);
//         setAlerts(alertRes.value?.data?.data || []);
//         setReminders(remRes.value?.data?.data || []);
//         if (['admin', 'doctor'].includes(user?.role)) {
//           const anaRes = await analyticsAPI.getDashboard();
//           setStats(anaRes.data.data);
//         }
//       } catch (err) {
//         console.error(err);
//       } finally {
//         setLoading(false);
//       }
//     };
//     load();
//   }, [user]);

//   if (loading) return (
//     <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
//       <div className="spinner-lg" />
//     </div>
//   );

//   // ── PATIENT DASHBOARD ─────────────────────────────────────────────
//   if (user?.role === 'patient') {
//     const myAppts = appointments.filter(a => a.patient?._id === user.id || a.patient?.email === user.email);
//     const myRems = reminders.filter(r => r.patient?._id === user.id || r.patient?.email === user.email);
//     return (
//       <div>
//         <div className="page-header">
//           <div>
//             <div className="page-title">My Health Dashboard</div>
//             <div className="page-subtitle">Track your health, appointments & medications</div>
//           </div>
//           <button className="sos-button" onClick={async () => { try { await alertsAPI.create({ type: 'SOS', severity: 'critical', message: 'Emergency SOS' }); toast.error('🚨 SOS sent!', { duration: 8000 }); } catch { toast.error('SOS activated!'); } }}>
//             🚨<span>SOS</span>
//           </button>
//         </div>
//         <div className="stat-grid">
//           <StatCard icon="❤️" value="120/80" label="Blood Pressure" color="#fef2f2" delay={0} />
//           <StatCard icon="💓" value={72} label="Pulse (bpm)" color="#e8effe" delay={0.06} />
//           <StatCard icon="🌡️" value="98.6°F" label="Temperature" color="#fffbeb" delay={0.12} />
//           <StatCard icon="🩸" value="98%" label="SpO2" color="#ecfdf5" delay={0.18} />
//         </div>
//         <div className="grid-2">
//           <div className="card">
//             <div className="card-header">
//               <span className="card-title">📅 My Appointments</span>
//               <button className="btn btn-primary btn-xs" onClick={() => navigate('/appointments')}>Book New</button>
//             </div>
//             <div className="card-body-0">
//               <div className="table-wrap">
//                 <table>
//                   <thead><tr><th>Doctor</th><th>Date</th><th>Status</th></tr></thead>
//                   <tbody>
//                     {myAppts.length === 0 ? <tr><td colSpan={3} style={{ textAlign: 'center', padding: 20, color: '#94a3b8' }}>No appointments yet</td></tr>
//                       : myAppts.slice(0, 4).map(a => (
//                       <tr key={a._id}>
//                         <td><div className="td-main">{a.doctor?.name}</div><div className="td-sub">{a.department}</div></td>
//                         <td className="text-sm">{new Date(a.date).toLocaleDateString()}<br /><span className="text-xs text-muted">{a.timeSlot}</span></td>
//                         <td><span className={`badge badge-${a.status === 'confirmed' ? 'success' : a.status === 'pending' ? 'warning' : 'danger'}`}>{a.status}</span></td>
//                       </tr>
//                     ))}
//                   </tbody>
//                 </table>
//               </div>
//             </div>
//           </div>
//           <div className="card">
//             <div className="card-header"><span className="card-title">⏰ Today's Medications</span></div>
//             <div className="card-body">
//               {myRems.length === 0 ? <div style={{ textAlign: 'center', padding: 20, color: '#94a3b8' }}>No reminders set</div>
//                 : myRems.slice(0, 4).map(r => (
//                 <div key={r._id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 11, borderRadius: 8, border: '1.5px solid #e2e8f0', marginBottom: 8, transition: 'border-color .18s' }}
//                   onMouseEnter={e => { e.currentTarget.style.borderColor = '#1648c9'; }}
//                   onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; }}
//                 >
//                   <span style={{ fontSize: 22 }}>💊</span>
//                   <div style={{ flex: 1 }}><div className="fw-7 text-sm">{r.medicineName}</div><div className="text-xs text-muted">{r.dose} · {r.times?.[0]}</div></div>
//                   <button className="btn btn-success btn-xs" onClick={(e) => { e.currentTarget.textContent = '✓ Done'; e.currentTarget.disabled = true; e.currentTarget.className = 'btn btn-outline btn-xs'; toast.success('Medication marked as taken!'); }}>✓ Taken</button>
//                 </div>
//               ))}
//             </div>
//           </div>
//         </div>
//       </div>
//     );
//   }

//   // ── ADMIN / DOCTOR DASHBOARD ──────────────────────────────────────
//   const summary = stats?.summary || {};
//   const charts = stats?.charts || {};

//   const visitsData = {
//     labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
//     datasets: [{
//       label: 'Patients', data: [24, 18, 32, 28, 42, 15, 8],
//       backgroundColor: 'rgba(22,72,201,.72)', borderRadius: 7, borderWidth: 0
//     }, {
//       label: 'Appointments', data: [18, 14, 26, 22, 35, 12, 6],
//       backgroundColor: 'rgba(8,145,178,.65)', borderRadius: 7, borderWidth: 0
//     }]
//   };

//   const deptData = {
//     labels: ['Cardiology', 'Neurology', 'Orthopedics', 'General', 'Pediatrics'],
//     datasets: [{ data: [30, 20, 18, 25, 7], backgroundColor: ['#1648c9','#0891b2','#059669','#d97706','#7c3aed'], borderWidth: 3, borderColor: '#fff' }]
//   };

//   const revenueData = {
//     labels: ['Jan','Feb','Mar','Apr','May','Jun'],
//     datasets: [{ label: 'Revenue', data: [35000,38000,42000,39000,45000,48290], borderColor: '#1648c9', backgroundColor: 'rgba(22,72,201,.06)', fill: true, tension: .4, borderWidth: 2, pointBackgroundColor: '#1648c9', pointRadius: 4 }]
//   };

//   return (
//     <div>
//       <div className="page-header">
//         <div>
//           <div className="page-title">{user?.role === 'doctor' ? 'Doctor Dashboard' : 'Admin Dashboard'}</div>
//           <div className="page-subtitle">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} · Good {new Date().getHours() < 12 ? 'morning' : 'afternoon'}, {user?.name?.split(' ')[0]}!</div>
//         </div>
//         <div className="page-actions">
//           <button className="btn btn-outline btn-sm" onClick={() => navigate('/analytics')}>📄 Reports</button>
//           <button className="btn btn-primary btn-sm" onClick={() => navigate('/appointments')}>+ Appointment</button>
//         </div>
//       </div>

//       <div className="stat-grid">
//         <StatCard icon="👥" value={summary.totalPatients || 0} label="Total Patients" color="#e8effe" change={{ dir: 'up', text: '↑ 12% this month' }} delay={0} />
//         <StatCard icon="🩺" value={summary.totalDoctors || 0} label="Active Doctors" color="#e0f7fa" change={{ dir: 'up', text: '↑ 3 new' }} delay={0.07} />
//         <StatCard icon="📅" value={summary.todayAppointments || 0} label="Today's Appointments" color="#fffbeb" change={{ dir: 'up', text: '5 confirmed' }} delay={0.14} />
//         <StatCard icon="💊" value={summary.totalOrders || 0} label="Medicine Orders" color="#ecfdf5" change={{ dir: 'up', text: '↑ 8 today' }} delay={0.21} />
//         <StatCard icon="🚨" value={summary.activeAlerts || 0} label="Active Alerts" color="#fef2f2" change={{ dir: 'warn', text: 'Action needed' }} delay={0.28} />
//         <StatCard icon="⏳" value={summary.pendingUsers || 0} label="Pending Approvals" color="#f5f3ff" change={{ dir: 'warn', text: 'Requires review' }} delay={0.35} />
//       </div>

//       <div className="grid-2 mt-2">
//         <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.38 }}>
//           <div className="card-header">
//             <span className="card-title">📈 Patient Visits</span>
//             <select className="form-input" style={{ width: 120, padding: '5px 28px 5px 8px', fontSize: 12 }}>
//               <option>This Week</option><option>This Month</option>
//             </select>
//           </div>
//           <div className="card-body">
//             <div style={{ height: 190, position: 'relative' }}>
//               <Bar data={visitsData} options={{ ...CHART_OPTS, plugins: { legend: { display: true, position: 'top', labels: { font: { size: 11 }, boxWidth: 10 } } } }} />
//             </div>
//           </div>
//         </motion.div>
//         <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.27, duration: 0.38 }}>
//           <div className="card-header"><span className="card-title">🏥 Department Load</span></div>
//           <div className="card-body">
//             <div style={{ height: 190, position: 'relative' }}>
//               <Doughnut data={deptData} options={{ responsive: true, maintainAspectRatio: false, cutout: '67%', plugins: { legend: { position: 'right', labels: { font: { size: 11 }, boxWidth: 9, padding: 6 } } } }} />
//             </div>
//           </div>
//         </motion.div>
//       </div>

//       <div className="grid-2 mt-2">
//         <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.34, duration: 0.38 }}>
//           <div className="card-header">
//             <span className="card-title">📅 Recent Appointments</span>
//             <button className="btn btn-outline btn-xs" onClick={() => navigate('/appointments')}>View All</button>
//           </div>
//           <div className="card-body-0">
//             <div className="table-wrap">
//               <table>
//                 <thead><tr><th>Patient</th><th>Doctor</th><th>Time</th><th>Status</th></tr></thead>
//                 <tbody>
//                   {appointments.slice(0, 5).map(a => (
//                     <tr key={a._id}>
//                       <td><div className="td-main">{a.patient?.name}</div><div className="td-sub">{a.department}</div></td>
//                       <td className="text-sm">{a.doctor?.name}</td>
//                       <td className="text-sm">{a.timeSlot}<br /><span className="text-xs text-muted">{new Date(a.date).toLocaleDateString()}</span></td>
//                       <td><span className={`badge badge-${a.status === 'confirmed' ? 'success' : a.status === 'pending' ? 'warning' : 'danger'}`}>{a.status}</span></td>
//                     </tr>
//                   ))}
//                 </tbody>
//               </table>
//             </div>
//           </div>
//         </motion.div>
//         <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.41, duration: 0.38 }}>
//           <div className="card-header">
//             <span className="card-title">🚨 Alert Log</span>
//             <button className="btn btn-outline btn-xs" onClick={() => navigate('/emergency')}>View All</button>
//           </div>
//           <div className="card-body">
//             {alerts.slice(0, 3).map(a => (
//               <div key={a._id} style={{ display: 'flex', gap: 10, padding: 10, borderRadius: 8, background: a.severity === 'critical' ? '#fef2f2' : a.severity === 'high' ? '#fffbeb' : '#f0f4ff', marginBottom: 8 }}>
//                 <span style={{ fontSize: 18 }}>{a.type === 'SOS' ? '🚨' : a.type === 'Medication' ? '⏰' : '❤️'}</span>
//                 <div style={{ flex: 1 }}>
//                   <div className="fw-7 text-sm">{a.patient?.name} · {a.type}</div>
//                   <div className="text-xs text-muted">{a.message}</div>
//                 </div>
//                 <span className={`badge badge-${a.status === 'resolved' ? 'success' : 'danger'}`}>{a.status}</span>
//               </div>
//             ))}
//           </div>
//         </motion.div>
//       </div>

//       <motion.div className="card mt-2" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.48, duration: 0.38 }}>
//         <div className="card-header">
//           <span className="card-title">💰 Monthly Revenue</span>
//           <button className="btn btn-outline btn-xs" onClick={() => navigate('/analytics')}>Full Analytics</button>
//         </div>
//         <div className="card-body">
//           <div style={{ height: 175, position: 'relative' }}>
//             <Line data={revenueData} options={{ ...CHART_OPTS, scales: { x: { grid: { display: false } }, y: { beginAtZero: false, ticks: { callback: v => '$' + Math.round(v / 1000) + 'k' }, grid: { color: 'rgba(0,0,0,.04)' } } } }} />
//           </div>
//         </div>
//       </motion.div>
//         <div className="grid-2" style={{ marginTop:20 }}>
//           <TodayScheduleWidget />
//           <MyTasksWidget />
//         </div>

//     </div>
//   );
// }


// import React, { useEffect, useState } from 'react';
// import { motion } from 'framer-motion';
// import { Bar, Line, Doughnut } from 'react-chartjs-2';
// import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend, Filler } from 'chart.js';
// import { useAuth } from '../context/AuthContext';
// import { analyticsAPI, appointmentsAPI, remindersAPI, alertsAPI } from '../utils/api';
// import { useNavigate } from 'react-router-dom';
// import toast from 'react-hot-toast';
// import { TodayScheduleWidget, MyTasksWidget, LeaveNotificationsWidget } from '../components/DashboardWidgets';
// import MySalaryWidget from '../components/MySalaryWidget';

// ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend, Filler);

// const CHART_OPTS = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { grid: { color: 'rgba(0,0,0,.04)' } } } };

// function StatCard({ icon, value, label, change, color, delay = 0 }) {
//   const [count, setCount] = useState(0);
//   useEffect(() => {
//     if (!value || isNaN(value)) return;
//     let start = 0;
//     const end = parseInt(value);
//     const step = Math.ceil(end / 28);
//     const timer = setInterval(() => {
//       start = Math.min(start + step, end);
//       setCount(start);
//       if (start >= end) clearInterval(timer);
//     }, 45);
//     return () => clearInterval(timer);
//   }, [value]);

//   return (
//     <motion.div className="stat-card" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.38, ease: [0.22, 1, 0.36, 1] }}>
//       <div className="stat-icon" style={{ background: color }}>{icon}</div>
//       <div className="stat-value">{isNaN(value) ? value : count}</div>
//       <div className="stat-label">{label}</div>
//       {change && <div className={`stat-change ${change.dir}`}>{change.text}</div>}
//     </motion.div>
//   );
// }

// export default function Dashboard() {
//   const { user } = useAuth();
//   const navigate = useNavigate();
//   const [stats, setStats] = useState(null);
//   const [appointments, setAppointments] = useState([]);
//   const [alerts, setAlerts] = useState([]);
//   const [reminders, setReminders] = useState([]);
//   const [loading, setLoading] = useState(true);

//   useEffect(() => {
//     const load = async () => {
//       try {
//         const [apptRes, alertRes, remRes] = await Promise.allSettled([
//           appointmentsAPI.getAll({ limit: 6 }),
//           alertsAPI.getAll({ limit: 5 }),
//           remindersAPI.getAll({ status: 'active' }),
//         ]);
//         setAppointments(apptRes.value?.data?.data || []);
//         setAlerts(alertRes.value?.data?.data || []);
//         setReminders(remRes.value?.data?.data || []);
//         if (['admin', 'doctor'].includes(user?.role)) {
//           const anaRes = await analyticsAPI.getDashboard();
//           setStats(anaRes.data.data);
//         }
//       } catch (err) {
//         console.error(err);
//       } finally {
//         setLoading(false);
//       }
//     };
//     load();
//   }, [user]);

//   if (loading) return (
//     <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
//       <div className="spinner-lg" />
//     </div>
//   );

//   // ── PATIENT DASHBOARD ─────────────────────────────────────────────
//   if (user?.role === 'patient') {
//     const myAppts = appointments.filter(a => a.patient?._id === user.id || a.patient?.email === user.email);
//     const myRems = reminders.filter(r => r.patient?._id === user.id || r.patient?.email === user.email);
//     return (
//       <div>
//         <div className="page-header">
//           <div>
//             <div className="page-title">My Health Dashboard</div>
//             <div className="page-subtitle">Track your health, appointments & medications</div>
//           </div>
//           <button className="sos-button" onClick={async () => { try { await alertsAPI.create({ type: 'SOS', severity: 'critical', message: 'Emergency SOS' }); toast.error('🚨 SOS sent!', { duration: 8000 }); } catch { toast.error('SOS activated!'); } }}>
//             🚨<span>SOS</span>
//           </button>
//         </div>
//         <div className="stat-grid">
//           <StatCard icon="❤️" value="120/80" label="Blood Pressure" color="#fef2f2" delay={0} />
//           <StatCard icon="💓" value={72} label="Pulse (bpm)" color="#e8effe" delay={0.06} />
//           <StatCard icon="🌡️" value="98.6°F" label="Temperature" color="#fffbeb" delay={0.12} />
//           <StatCard icon="🩸" value="98%" label="SpO2" color="#ecfdf5" delay={0.18} />
//         </div>
//         <div className="grid-2">
//           <div className="card">
//             <div className="card-header">
//               <span className="card-title">📅 My Appointments</span>
//               <button className="btn btn-primary btn-xs" onClick={() => navigate('/appointments')}>Book New</button>
//             </div>
//             <div className="card-body-0">
//               <div className="table-wrap">
//                 <table>
//                   <thead><tr><th>Doctor</th><th>Date</th><th>Status</th></tr></thead>
//                   <tbody>
//                     {myAppts.length === 0 ? <tr><td colSpan={3} style={{ textAlign: 'center', padding: 20, color: '#94a3b8' }}>No appointments yet</td></tr>
//                       : myAppts.slice(0, 4).map(a => (
//                       <tr key={a._id}>
//                         <td><div className="td-main">{a.doctor?.name}</div><div className="td-sub">{a.department}</div></td>
//                         <td className="text-sm">{new Date(a.date).toLocaleDateString()}<br /><span className="text-xs text-muted">{a.timeSlot}</span></td>
//                         <td><span className={`badge badge-${a.status === 'confirmed' ? 'success' : a.status === 'pending' ? 'warning' : 'danger'}`}>{a.status}</span></td>
//                       </tr>
//                     ))}
//                   </tbody>
//                 </table>
//               </div>
//             </div>
//           </div>
//           <div className="card">
//             <div className="card-header"><span className="card-title">⏰ Today's Medications</span></div>
//             <div className="card-body">
//               {myRems.length === 0 ? <div style={{ textAlign: 'center', padding: 20, color: '#94a3b8' }}>No reminders set</div>
//                 : myRems.slice(0, 4).map(r => (
//                 <div key={r._id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 11, borderRadius: 8, border: '1.5px solid #e2e8f0', marginBottom: 8, transition: 'border-color .18s' }}
//                   onMouseEnter={e => { e.currentTarget.style.borderColor = '#1648c9'; }}
//                   onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; }}
//                 >
//                   <span style={{ fontSize: 22 }}>💊</span>
//                   <div style={{ flex: 1 }}><div className="fw-7 text-sm">{r.medicineName}</div><div className="text-xs text-muted">{r.dose} · {r.times?.[0]}</div></div>
//                   <button className="btn btn-success btn-xs" onClick={(e) => { e.currentTarget.textContent = '✓ Done'; e.currentTarget.disabled = true; e.currentTarget.className = 'btn btn-outline btn-xs'; toast.success('Medication marked as taken!'); }}>✓ Taken</button>
//                 </div>
//               ))}
//             </div>
//           </div>
//         </div>
//       </div>
//     );
//   }

//   // ── ADMIN / DOCTOR DASHBOARD ──────────────────────────────────────
//   const summary = stats?.summary || {};
//   const charts = stats?.charts || {};

//   const visitsData = {
//     labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
//     datasets: [{
//       label: 'Patients', data: [24, 18, 32, 28, 42, 15, 8],
//       backgroundColor: 'rgba(22,72,201,.72)', borderRadius: 7, borderWidth: 0
//     }, {
//       label: 'Appointments', data: [18, 14, 26, 22, 35, 12, 6],
//       backgroundColor: 'rgba(8,145,178,.65)', borderRadius: 7, borderWidth: 0
//     }]
//   };

//   const deptData = {
//     labels: ['Cardiology', 'Neurology', 'Orthopedics', 'General', 'Pediatrics'],
//     datasets: [{ data: [30, 20, 18, 25, 7], backgroundColor: ['#1648c9','#0891b2','#059669','#d97706','#7c3aed'], borderWidth: 3, borderColor: '#fff' }]
//   };

//   const revenueData = {
//     labels: ['Jan','Feb','Mar','Apr','May','Jun'],
//     datasets: [{ label: 'Revenue', data: [35000,38000,42000,39000,45000,48290], borderColor: '#1648c9', backgroundColor: 'rgba(22,72,201,.06)', fill: true, tension: .4, borderWidth: 2, pointBackgroundColor: '#1648c9', pointRadius: 4 }]
//   };

//   return (
//     <div>
//       <div className="page-header">
//         <div>
//           <div className="page-title">{user?.role === 'doctor' ? 'Doctor Dashboard' : 'Admin Dashboard'}</div>
//           <div className="page-subtitle">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} · Good {new Date().getHours() < 12 ? 'morning' : 'afternoon'}, {user?.name?.split(' ')[0]}!</div>
//         </div>
//         <div className="page-actions">
//           <button className="btn btn-outline btn-sm" onClick={() => navigate('/analytics')}>📄 Reports</button>
//           <button className="btn btn-primary btn-sm" onClick={() => navigate('/appointments')}>+ Appointment</button>
//         </div>
//       </div>

//       <div className="stat-grid">
//         <StatCard icon="👥" value={summary.totalPatients || 0} label="Total Patients" color="#e8effe" change={{ dir: 'up', text: '↑ 12% this month' }} delay={0} />
//         <StatCard icon="🩺" value={summary.totalDoctors || 0} label="Active Doctors" color="#e0f7fa" change={{ dir: 'up', text: '↑ 3 new' }} delay={0.07} />
//         <StatCard icon="📅" value={summary.todayAppointments || 0} label="Today's Appointments" color="#fffbeb" change={{ dir: 'up', text: '5 confirmed' }} delay={0.14} />
//         <StatCard icon="💊" value={summary.totalOrders || 0} label="Medicine Orders" color="#ecfdf5" change={{ dir: 'up', text: '↑ 8 today' }} delay={0.21} />
//         <StatCard icon="🚨" value={summary.activeAlerts || 0} label="Active Alerts" color="#fef2f2" change={{ dir: 'warn', text: 'Action needed' }} delay={0.28} />
//         <StatCard icon="⏳" value={summary.pendingUsers || 0} label="Pending Approvals" color="#f5f3ff" change={{ dir: 'warn', text: 'Requires review' }} delay={0.35} />
//       </div>

//       <div className="grid-2 mt-2">
//         <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.38 }}>
//           <div className="card-header">
//             <span className="card-title">📈 Patient Visits</span>
//             <select className="form-input" style={{ width: 120, padding: '5px 28px 5px 8px', fontSize: 12 }}>
//               <option>This Week</option><option>This Month</option>
//             </select>
//           </div>
//           <div className="card-body">
//             <div style={{ height: 190, position: 'relative' }}>
//               <Bar data={visitsData} options={{ ...CHART_OPTS, plugins: { legend: { display: true, position: 'top', labels: { font: { size: 11 }, boxWidth: 10 } } } }} />
//             </div>
//           </div>
//         </motion.div>
//         <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.27, duration: 0.38 }}>
//           <div className="card-header"><span className="card-title">🏥 Department Load</span></div>
//           <div className="card-body">
//             <div style={{ height: 190, position: 'relative' }}>
//               <Doughnut data={deptData} options={{ responsive: true, maintainAspectRatio: false, cutout: '67%', plugins: { legend: { position: 'right', labels: { font: { size: 11 }, boxWidth: 9, padding: 6 } } } }} />
//             </div>
//           </div>
//         </motion.div>
//       </div>

//       <div className="grid-2 mt-2">
//         <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.34, duration: 0.38 }}>
//           <div className="card-header">
//             <span className="card-title">📅 Recent Appointments</span>
//             <button className="btn btn-outline btn-xs" onClick={() => navigate('/appointments')}>View All</button>
//           </div>
//           <div className="card-body-0">
//             <div className="table-wrap">
//               <table>
//                 <thead><tr><th>Patient</th><th>Doctor</th><th>Time</th><th>Status</th></tr></thead>
//                 <tbody>
//                   {appointments.slice(0, 5).map(a => (
//                     <tr key={a._id}>
//                       <td><div className="td-main">{a.patient?.name}</div><div className="td-sub">{a.department}</div></td>
//                       <td className="text-sm">{a.doctor?.name}</td>
//                       <td className="text-sm">{a.timeSlot}<br /><span className="text-xs text-muted">{new Date(a.date).toLocaleDateString()}</span></td>
//                       <td><span className={`badge badge-${a.status === 'confirmed' ? 'success' : a.status === 'pending' ? 'warning' : 'danger'}`}>{a.status}</span></td>
//                     </tr>
//                   ))}
//                 </tbody>
//               </table>
//             </div>
//           </div>
//         </motion.div>
//         <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.41, duration: 0.38 }}>
//           <div className="card-header">
//             <span className="card-title">🚨 Alert Log</span>
//             <button className="btn btn-outline btn-xs" onClick={() => navigate('/emergency')}>View All</button>
//           </div>
//           <div className="card-body">
//             {alerts.slice(0, 3).map(a => (
//               <div key={a._id} style={{ display: 'flex', gap: 10, padding: 10, borderRadius: 8, background: a.severity === 'critical' ? '#fef2f2' : a.severity === 'high' ? '#fffbeb' : '#f0f4ff', marginBottom: 8 }}>
//                 <span style={{ fontSize: 18 }}>{a.type === 'SOS' ? '🚨' : a.type === 'Medication' ? '⏰' : '❤️'}</span>
//                 <div style={{ flex: 1 }}>
//                   <div className="fw-7 text-sm">{a.patient?.name} · {a.type}</div>
//                   <div className="text-xs text-muted">{a.message}</div>
//                 </div>
//                 <span className={`badge badge-${a.status === 'resolved' ? 'success' : 'danger'}`}>{a.status}</span>
//               </div>
//             ))}
//           </div>
//         </motion.div>
//       </div>

//       <motion.div className="card mt-2" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.48, duration: 0.38 }}>
//         <div className="card-header">
//           <span className="card-title">💰 Monthly Revenue</span>
//           <button className="btn btn-outline btn-xs" onClick={() => navigate('/analytics')}>Full Analytics</button>
//         </div>
//         <div className="card-body">
//           <div style={{ height: 175, position: 'relative' }}>
//             <Line data={revenueData} options={{ ...CHART_OPTS, scales: { x: { grid: { display: false } }, y: { beginAtZero: false, ticks: { callback: v => '$' + Math.round(v / 1000) + 'k' }, grid: { color: 'rgba(0,0,0,.04)' } } } }} />
//           </div>
//         </div>
//       </motion.div>
//         <div className="grid-2" style={{ marginTop:20 }}>
//           <TodayScheduleWidget />
//           <MyTasksWidget />
//         </div>
//         <div className="grid-2" style={{ marginTop:16 }}>
//           <LeaveNotificationsWidget />
//           <MySalaryWidget />
//         </div>

//     </div>
//   );
// }


// import React, { useState, useEffect, useCallback } from 'react';
// import { motion } from 'framer-motion';
// import { useAuth } from '../context/AuthContext';
// import { facilityAPI, tasksAPI, leavesAPI, salaryAPI } from '../utils/api';
// import { getSocket } from '../utils/socket';
// import toast from 'react-hot-toast';

// // Role → dashboard component mapping
// import RoleBasedDashboard from './RoleBasedDashboards';
// import FinanceDashboard    from './FinanceDashboard';

// // ── Maintenance roles that use RoleBasedDashboard ─────────────────────
// const MAINTENANCE_ROLES = [
//   'wardboy','sweeper','otboy','nurse','pharmacist',
//   'electrician','plumber','it_technician','equipment_tech',
//   'biomedical','security','receptionist','ambulance_driver',
// ];

// const ROLE_COLOR = {
//   admin:'#6366f1', doctor:'#0891b2', patient:'#7c3aed',
//   nurse:'#db2777', pharmacist:'#d97706', wardboy:'#059669',
//   sweeper:'#f59e0b', otboy:'#ef4444', finance:'#8b5cf6',
//   electrician:'#f59e0b', plumber:'#0891b2', it_technician:'#6366f1',
//   equipment_tech:'#8b5cf6', biomedical:'#059669', security:'#374151',
//   receptionist:'#db2777', ambulance_driver:'#dc2626',
// };

// const INR = v => `₹${Number(v||0).toLocaleString('en-IN')}`;

// // ── Loading skeleton ──────────────────────────────────────────────────
// function LoadingSkeleton() {
//   return (
//     <div style={{ fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif" }}>
//       <style>{`@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}.sk{background:linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%);background-size:200% 100%;animation:shimmer 1.5s infinite;border-radius:12px;}`}</style>
//       <div className="sk" style={{ height:120, marginBottom:20 }} />
//       <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
//         {Array(4).fill(0).map((_,i) => <div key={i} className="sk" style={{ height:80 }} />)}
//       </div>
//       <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
//         {Array(4).fill(0).map((_,i) => <div key={i} className="sk" style={{ height:200 }} />)}
//       </div>
//     </div>
//   );
// }

// // ── PATIENT DASHBOARD ─────────────────────────────────────────────────
// function PatientDashboard({ user }) {
//   const [appts, setAppts]   = useState([]);
//   const [payments, setPay]  = useState([]);
//   const [loading, setLoad]  = useState(true);
//   const ac = '#7c3aed';

//   useEffect(() => {
//     Promise.all([
//       import('../utils/api').then(m => m.default.get('/appointments')),
//       import('../utils/api').then(m => m.default.get('/payments')),
//     ]).then(([aRes, pRes]) => {
//       setAppts(aRes.data.data||[]);
//       setPay(pRes.data.data||[]);
//       setLoad(false);
//     }).catch(() => setLoad(false));
//   }, [user?._id]);

//   const upcoming = appts.filter(a => new Date(a.date) >= new Date() && a.status !== 'cancelled');
//   const paid     = payments.filter(p => p.status === 'success');

//   return (
//     <div style={{ fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif" }}>
//       <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap'); @keyframes spin{to{transform:rotate(360deg)}}`}</style>

//       {/* Welcome header */}
//       <div style={{ background:`linear-gradient(135deg,#4c1d95,#7c3aed)`, borderRadius:18, padding:'22px 26px', marginBottom:20, position:'relative', overflow:'hidden' }}>
//         <div style={{ position:'absolute',top:-40,right:-40,width:180,height:180,borderRadius:'50%',background:'rgba(255,255,255,.07)',pointerEvents:'none' }}/>
//         <div style={{ position:'relative' }}>
//           <h1 style={{ color:'#fff',fontWeight:900,fontSize:20,margin:0 }}>Good {new Date().getHours()<12?'Morning':'Afternoon'}, {user?.name?.split(' ')[0]}! 👋</h1>
//           <p style={{ color:'rgba(255,255,255,.7)',fontSize:13,margin:'4px 0 12px' }}>Welcome to your health dashboard</p>
//           <div style={{ display:'flex',gap:8,flexWrap:'wrap' }}>
//             {user?.bloodGroup&&<div style={{ background:'rgba(255,255,255,.18)',borderRadius:11,padding:'4px 12px',fontSize:12,fontWeight:700,color:'#fff' }}>🩸 {user.bloodGroup}</div>}
//             <div style={{ background:'rgba(255,255,255,.18)',borderRadius:11,padding:'4px 12px',fontSize:12,fontWeight:700,color:'#fff' }}>🆔 {user?._id?.slice(-8)?.toUpperCase()}</div>
//           </div>
//         </div>
//       </div>

//       {/* Stats */}
//       <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))',gap:12,marginBottom:20 }}>
//         {[
//           { i:'📅', l:'Upcoming Appts',  v:upcoming.length,  bg:'#eff6ff', c:'#1d4ed8' },
//           { i:'✅', l:'Total Appts',     v:appts.length,     bg:'#f0fdf4', c:'#15803d' },
//           { i:'💳', l:'Payments Made',   v:paid.length,      bg:'#f5f3ff', c:'#6d28d9' },
//           { i:'💰', l:'Total Spent',     v:INR(paid.reduce((t,p)=>t+p.amount,0)), bg:'#ecfeff', c:'#0e7490' },
//         ].map((s,i) => (
//           <motion.div key={i} initial={{ opacity:0,y:10 }} animate={{ opacity:1,y:0 }} transition={{ delay:i*.08 }}
//             style={{ background:'#fff',border:'1px solid #e8edf3',borderRadius:14,padding:'14px',display:'flex',alignItems:'center',gap:12 }}>
//             <div style={{ width:40,height:40,borderRadius:11,background:s.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20 }}>{s.i}</div>
//             <div><div style={{ fontSize:typeof s.v==='string'?14:22,fontWeight:900,color:'#0f172a',lineHeight:1 }}>{s.v}</div><div style={{ fontSize:11,color:'#94a3b8',marginTop:2 }}>{s.l}</div></div>
//           </motion.div>
//         ))}
//       </div>

//       {/* Upcoming appointments */}
//       <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:16 }}>
//         <div style={{ background:'#fff',border:'1px solid #e8edf3',borderRadius:16,overflow:'hidden' }}>
//           <div style={{ padding:'13px 18px',borderBottom:'1px solid #f1f5f9',fontWeight:800,fontSize:14.5,color:'#0f172a' }}>📅 Upcoming Appointments</div>
//           <div style={{ padding:'12px 14px',maxHeight:300,overflowY:'auto' }}>
//             {loading?<div style={{ padding:20,textAlign:'center',color:'#94a3b8' }}>Loading…</div>
//             :upcoming.length===0?<div style={{ padding:'20px 0',textAlign:'center',color:'#94a3b8' }}><div style={{ fontSize:32,marginBottom:6 }}>📅</div><div>No upcoming appointments</div></div>
//             :upcoming.map(a=>(
//               <div key={a._id} style={{ padding:'11px 12px',background:'#f0f9ff',border:'1px solid #bae6fd',borderRadius:11,marginBottom:8 }}>
//                 <div style={{ fontWeight:700,color:'#0f172a',fontSize:13 }}>Dr. {a.doctor?.name}</div>
//                 <div style={{ fontSize:12,color:'#0369a1',marginTop:2 }}>{a.doctor?.specialization}</div>
//                 <div style={{ display:'flex',gap:10,marginTop:6,fontSize:11.5,color:'#64748b',flexWrap:'wrap' }}>
//                   <span>📅 {new Date(a.date).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</span>
//                   <span>⏰ {a.time}</span>
//                   <span style={{ padding:'1px 6px',borderRadius:20,background:'#dcfce7',color:'#15803d',fontWeight:700 }}>{a.status}</span>
//                 </div>
//               </div>
//             ))}
//           </div>
//         </div>

//         <div style={{ background:'#fff',border:'1px solid #e8edf3',borderRadius:16,overflow:'hidden' }}>
//           <div style={{ padding:'13px 18px',borderBottom:'1px solid #f1f5f9',fontWeight:800,fontSize:14.5,color:'#0f172a' }}>💳 Recent Payments</div>
//           <div style={{ padding:'12px 14px',maxHeight:300,overflowY:'auto' }}>
//             {loading?<div style={{ padding:20,textAlign:'center',color:'#94a3b8' }}>Loading…</div>
//             :paid.length===0?<div style={{ padding:'20px 0',textAlign:'center',color:'#94a3b8' }}><div style={{ fontSize:32,marginBottom:6 }}>💳</div><div>No payments yet</div></div>
//             :paid.slice(0,6).map(p=>(
//               <div key={p._id} style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'9px 11px',background:'#f8fafc',borderRadius:9,marginBottom:5 }}>
//                 <div><div style={{ fontWeight:700,fontSize:12.5,color:'#0f172a',textTransform:'capitalize' }}>{p.type?.replace('_',' ')}</div><div style={{ fontSize:11,color:'#94a3b8' }}>{p.receiptNo||'—'} · {p.paidAt?new Date(p.paidAt).toLocaleDateString('en-IN',{day:'numeric',month:'short'}):''}</div></div>
//                 <span style={{ fontWeight:900,color:'#059669',fontSize:14,fontFamily:'monospace' }}>{INR(p.amount)}</span>
//               </div>
//             ))}
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }

// // ── ADMIN DASHBOARD ───────────────────────────────────────────────────
// function AdminDashboard({ user }) {
//   const [stats, setStats] = useState(null);
//   const [loading, setLoad] = useState(true);
//   const ac = '#6366f1';

//   useEffect(() => {
//     import('../utils/api').then(m => m.usersAPI.getStats()).then(r => { setStats(r.data.data); setLoad(false); }).catch(() => setLoad(false));
//   }, []);

//   return (
//     <div style={{ fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif" }}>
//       <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');`}</style>
//       <div style={{ background:`linear-gradient(135deg,#1e1b4b,#6366f1)`,borderRadius:18,padding:'22px 26px',marginBottom:20,position:'relative',overflow:'hidden' }}>
//         <div style={{ position:'absolute',top:-30,right:-30,width:160,height:160,borderRadius:'50%',background:'rgba(255,255,255,.07)',pointerEvents:'none' }}/>
//         <h1 style={{ color:'#fff',fontWeight:900,fontSize:21,margin:0,position:'relative' }}>👋 Admin Dashboard</h1>
//         <p style={{ color:'rgba(255,255,255,.7)',fontSize:13,margin:'5px 0 0',position:'relative' }}>{user?.name} · Administrator · {new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'})}</p>
//       </div>
//       {loading?<LoadingSkeleton/>:(
//         <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:12 }}>
//           {[
//             { i:'👥', l:'Total Users',   v:stats?.total||0,   bg:'#eff6ff',c:'#1d4ed8' },
//             { i:'✅', l:'Approved',      v:stats?.approved||0, bg:'#f0fdf4',c:'#15803d' },
//             { i:'⏳', l:'Pending',       v:stats?.pending||0,  bg:'#fef3c7',c:'#92400e' },
//             { i:'⚕️', l:'Doctors',       v:stats?.byRole?.find(r=>r._id==='doctor')?.count||0, bg:'#ecfeff',c:'#0e7490' },
//             { i:'🧑', l:'Patients',      v:stats?.byRole?.find(r=>r._id==='patient')?.count||0, bg:'#f5f3ff',c:'#6d28d9' },
//             { i:'💉', l:'Nurses',        v:stats?.byRole?.find(r=>r._id==='nurse')?.count||0, bg:'#fdf2f8',c:'#be185d' },
//           ].map((s,i)=>(
//             <motion.div key={i} initial={{ opacity:0,y:10 }} animate={{ opacity:1,y:0 }} transition={{ delay:i*.07 }}
//               style={{ background:'#fff',border:'1px solid #e8edf3',borderRadius:14,padding:'14px',display:'flex',alignItems:'center',gap:12 }}>
//               <div style={{ width:40,height:40,borderRadius:11,background:s.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20 }}>{s.i}</div>
//               <div><div style={{ fontSize:22,fontWeight:900,color:'#0f172a',lineHeight:1 }}>{s.v}</div><div style={{ fontSize:11,color:'#94a3b8',marginTop:2 }}>{s.l}</div></div>
//             </motion.div>
//           ))}
//         </div>
//       )}
//     </div>
//   );
// }

// // ── DOCTOR DASHBOARD ──────────────────────────────────────────────────
// function DoctorDashboard({ user }) {
//   const [appts, setAppts] = useState([]);
//   const [loading, setLoad] = useState(true);
//   const ac = '#0891b2';

//   useEffect(() => {
//     import('../utils/api').then(m => m.default.get('/appointments')).then(r => { setAppts(r.data.data||[]); setLoad(false); }).catch(() => setLoad(false));
//   }, [user?._id]);

//   const today     = appts.filter(a => new Date(a.date).toDateString() === new Date().toDateString());
//   const pending   = appts.filter(a => a.status === 'pending');
//   const confirmed = appts.filter(a => a.status === 'confirmed');

//   return (
//     <div style={{ fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif" }}>
//       <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');`}</style>
//       <div style={{ background:`linear-gradient(135deg,#0c4a6e,#0891b2)`,borderRadius:18,padding:'22px 26px',marginBottom:20,position:'relative',overflow:'hidden' }}>
//         <div style={{ position:'absolute',top:-30,right:-30,width:160,height:160,borderRadius:'50%',background:'rgba(255,255,255,.07)',pointerEvents:'none' }}/>
//         <h1 style={{ color:'#fff',fontWeight:900,fontSize:21,margin:0,position:'relative' }}>⚕️ Doctor Dashboard</h1>
//         <p style={{ color:'rgba(255,255,255,.7)',fontSize:13,margin:'5px 0 0',position:'relative' }}>Dr. {user?.name} · {user?.specialization||user?.department||'General'}</p>
//       </div>
//       {loading?<LoadingSkeleton/>:(
//         <div>
//           <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))',gap:12,marginBottom:20 }}>
//             {[{i:'📅',l:"Today's Appts",v:today.length,bg:'#ecfeff',c:'#0e7490'},{i:'⏳',l:'Pending',v:pending.length,bg:'#fef3c7',c:'#92400e'},{i:'✅',l:'Confirmed',v:confirmed.length,bg:'#f0fdf4',c:'#15803d'},{i:'📋',l:'Total Appts',v:appts.length,bg:'#eff6ff',c:'#1d4ed8'}].map((s,i)=>(
//               <motion.div key={i} initial={{ opacity:0,y:10 }} animate={{ opacity:1,y:0 }} transition={{ delay:i*.07 }}
//                 style={{ background:'#fff',border:'1px solid #e8edf3',borderRadius:14,padding:'14px',display:'flex',alignItems:'center',gap:12 }}>
//                 <div style={{ width:40,height:40,borderRadius:11,background:s.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20 }}>{s.i}</div>
//                 <div><div style={{ fontSize:22,fontWeight:900,color:'#0f172a',lineHeight:1 }}>{s.v}</div><div style={{ fontSize:11,color:'#94a3b8',marginTop:2 }}>{s.l}</div></div>
//               </motion.div>
//             ))}
//           </div>
//           <div style={{ background:'#fff',border:'1px solid #e8edf3',borderRadius:16,overflow:'hidden' }}>
//             <div style={{ padding:'13px 18px',borderBottom:'1px solid #f1f5f9',fontWeight:800,fontSize:14.5,color:'#0f172a' }}>📅 Today's Appointments ({today.length})</div>
//             <div style={{ padding:'12px 14px' }}>
//               {today.length===0?<div style={{ padding:'20px 0',textAlign:'center',color:'#94a3b8' }}><div style={{ fontSize:32,marginBottom:6 }}>😌</div><div>No appointments today</div></div>
//               :today.map(a=>(
//                 <div key={a._id} style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'11px 12px',background:'#f0f9ff',border:'1px solid #bae6fd',borderRadius:11,marginBottom:7 }}>
//                   <div>
//                     <div style={{ fontWeight:700,color:'#0f172a',fontSize:13 }}>{a.patient?.name}</div>
//                     <div style={{ fontSize:11.5,color:'#64748b',marginTop:2 }}>⏰ {a.time} · {a.type?.replace('_',' ')} · {a.reason||'Consultation'}</div>
//                     {a.patient?.bloodGroup&&<div style={{ fontSize:11,color:'#0891b2',fontWeight:600,marginTop:2 }}>🩸 {a.patient.bloodGroup}</div>}
//                   </div>
//                   <span style={{ padding:'4px 10px',borderRadius:20,fontSize:11.5,fontWeight:700,background:a.status==='confirmed'?'#dcfce7':'#fef3c7',color:a.status==='confirmed'?'#15803d':'#92400e' }}>{a.status}</span>
//                 </div>
//               ))}
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }

// // ── MAIN DASHBOARD ROUTER — THE KEY FIX ──────────────────────────────
// // Critical: wait for auth to fully load before rendering any dashboard.
// // This prevents flash of wrong dashboard on page load/refresh.
// export default function Dashboard() {
//   const { user, loading: authLoading } = useAuth();

//   // ── Fix: Wait for auth to settle before rendering role-based content ──
//   // authLoading = true means AuthContext is still fetching /api/auth/me
//   // We MUST wait for this before checking user.role
//   if (authLoading) {
//     return (
//       <div style={{ fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif", padding:4 }}>
//         <LoadingSkeleton />
//       </div>
//     );
//   }

//   // Also handle case where user is not yet set but loading finished
//   if (!user) {
//     return (
//       <div style={{ textAlign:'center', padding:64, color:'#94a3b8', fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif" }}>
//         <div style={{ fontSize:40, marginBottom:12 }}>🔐</div>
//         <div style={{ fontWeight:700 }}>Please login to continue</div>
//       </div>
//     );
//   }

//   // ── Route to correct dashboard by role ────────────────────────────
//   // This only runs AFTER auth is confirmed — no more flash of wrong dashboard
//   const role = user.role;

//   if (role === 'finance') return <FinanceDashboard />;
//   if (role === 'admin')   return <AdminDashboard   user={user} />;
//   if (role === 'doctor')  return <DoctorDashboard  user={user} />;
//   if (role === 'patient') return <PatientDashboard user={user} />;

//   // All other roles (nurse, pharmacist, wardboy, sweeper, otboy,
//   // receptionist, security, electrician, plumber, it_technician,
//   // equipment_tech, biomedical, ambulance_driver) → RoleBasedDashboard
//   if (MAINTENANCE_ROLES.includes(role)) return <RoleBasedDashboard />;

//   // Fallback
//   return <RoleBasedDashboard />;
// }


import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import { useAuth } from '../context/AuthContext';
import { analyticsAPI, appointmentsAPI, remindersAPI, alertsAPI, usersAPI, entryAPI, recordsAPI, reviewsAPI, ordersAPI, facilityAPI, queueAPI, admissionAPI, nurseCallAPI } from '../utils/api';
import { useNavigate, Navigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { TodayScheduleWidget, MyTasksWidget, LeaveNotificationsWidget } from '../components/DashboardWidgets';
import MySalaryWidget from '../components/MySalaryWidget';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend, Filler);

const CHART_OPTS = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { grid: { color: 'rgba(0,0,0,.04)' } } } };

// ── Family Access — manage dependent profiles (children/elderly relatives)
function StatCard({ icon, value, label, change, color, delay = 0 }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!value || isNaN(value)) return;
    let start = 0;
    const end = parseInt(value);
    const step = Math.ceil(end / 28);
    const timer = setInterval(() => {
      start = Math.min(start + step, end);
      setCount(start);
      if (start >= end) clearInterval(timer);
    }, 45);
    return () => clearInterval(timer);
  }, [value]);

  return (
    <motion.div className="stat-card" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.38, ease: [0.22, 1, 0.36, 1] }}>
      <div className="stat-icon" style={{ background: color }}>{icon}</div>
      <div className="stat-value">{isNaN(value) ? value : count}</div>
      <div className="stat-label">{label}</div>
      {change && <div className={`stat-change ${change.dir}`}>{change.text}</div>}
    </motion.div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { t } = useLanguage() || { t: (k) => k };
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [entryCodes, setEntryCodes] = useState([]);
  const [labRecords, setLabRecords] = useState([]);
  const [myReviews, setMyReviews] = useState({ count: 0, average: null, data: [] });
  const [myOrders, setMyOrders] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [pendingRatings, setPendingRatings] = useState([]);
  const [ratingAppt, setRatingAppt] = useState(null);
  const [ratingValue, setRatingValue] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);
  const [myQueueTokens, setMyQueueTokens] = useState([]);
  const [queueDept, setQueueDept] = useState('');
  const [gettingToken, setGettingToken] = useState(false);
  const [myAdmissions, setMyAdmissions] = useState([]);
  const [myNurseCall, setMyNurseCall] = useState(null);
  const [callingNurse, setCallingNurse] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [apptRes, alertRes, remRes] = await Promise.allSettled([
          appointmentsAPI.getAll({ limit: 6 }),
          alertsAPI.getAll({ limit: 5 }),
          remindersAPI.getAll({ status: 'active' }),
        ]);
        setAppointments(apptRes.value?.data?.data || []);
        setAlerts(alertRes.value?.data?.data || []);
        setReminders(remRes.value?.data?.data || []);

        if (user?.role === 'patient') {
          entryAPI.getMine().then(res => setEntryCodes(res.data.data || [])).catch(()=>{});
          reviewsAPI.myPending().then(res => setPendingRatings(res.data?.data || [])).catch(()=>{});
          // Medications + billing weren't visible anywhere on the patient's
          // own dashboard before — only reachable by clicking into Orders.
          ordersAPI.getAll().then(res => setMyOrders(res.data.data || [])).catch(()=>{});
          queueAPI.getMine().then(res => setMyQueueTokens(res.data.data || [])).catch(()=>{});
          admissionAPI.getMine().then(res => setMyAdmissions(res.data.data || [])).catch(()=>{});
          nurseCallAPI.getMine().then(res => setMyNurseCall(res.data.data || null)).catch(()=>{});
        }
        if (user?.role === 'doctor') {
          // Lab results awaiting review for this doctor's patients — surfaced
          // as a quick panel so they don't have to dig through Health Records.
          recordsAPI.getAll().then(res => {
            const mine = (res.data.data || []).filter(r => ['pending','processing'].includes(r.status) && (r.type === 'lab_report' || r.testName) && r.doctor?._id === user._id);
            setLabRecords(mine);
          }).catch(() => {});
          // Patient ratings — the one thing genuinely specific to being a
          // doctor rather than admin (admin has no "my patients rated me").
          reviewsAPI.forDoctor(user._id || user.id).then(res => {
            setMyReviews({ count: res.data.count || 0, average: res.data.average, data: res.data.data || [] });
          }).catch(() => {});
        }
        if (user?.role === 'admin') {
          facilityAPI.getRooms().then(res => setRooms(res.data.data || [])).catch(() => {});
        }
        if (['admin', 'doctor'].includes(user?.role)) {
          try {
            const [anaRes, usersRes] = await Promise.allSettled([
              analyticsAPI.getDashboard(),
              usersAPI.getAll ? usersAPI.getAll({ status:'approved' }) : Promise.resolve(null),
            ]);
            const anaData = anaRes.value?.data?.data;
            if (anaData) {
              setStats(anaData);
            } else {
              // Build stats from users if analytics fails
              const users = usersRes.value?.data?.data || [];
              setStats({
                summary: {
                  totalPatients: users.filter(u=>u.role==='patient').length,
                  totalDoctors: users.filter(u=>u.role==='doctor').length,
                  todayAppointments: appointments.length,
                  totalOrders: 0,
                  activeAlerts: alertRes.value?.data?.data?.length || 0,
                  pendingUsers: users.filter(u=>u.status==='pending').length,
                  totalUsers: users.length,
                  approvedUsers: users.filter(u=>u.status==='approved').length,
                  revenue: 0,
                },
                charts: {}
              });
            }
          } catch (anaErr) {
            console.warn('Analytics load failed, using fallback:', anaErr.message);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();

    // Live-update alerts on SOS / new alert via socket
    const socket = getSocket();
    if (socket) {
      const handleNewAlert = () => {
        alertsAPI.getAll({ limit: 5 }).then(res => setAlerts(res.data.data || [])).catch(()=>{});
      };
      socket.on('emergency_alert', handleNewAlert);

      let offCheckin = () => {};
      if (user?.role === 'patient') {
        const refreshEntries = () => entryAPI.getMine().then(res => setEntryCodes(res.data.data || [])).catch(()=>{});
        socket.on('patient_checked_in', refreshEntries);
        socket.on('patient_room_assigned', refreshEntries);
        const onApptCompleted = (data) => {
          toast(`✅ Your visit with Dr. ${data.doctorName} is complete${data.followUpScheduled ? ' — a follow-up has been scheduled' : ''}.`, { duration: 7000 });
          reviewsAPI.myPending().then(res => setPendingRatings(res.data?.data || [])).catch(()=>{});
        };
        socket.on('appointment_completed', onApptCompleted);
        const onNurseCallUpdate = (d) => {
          setMyNurseCall(prev => {
            if (!prev || prev._id !== d.callId) return prev;
            if (d.status === 'resolved') return null;
            return { ...prev, status: d.status, acknowledgedBy: d.nurseName ? { name: d.nurseName } : prev.acknowledgedBy };
          });
        };
        socket.on('nurse_call_updated', onNurseCallUpdate);
        offCheckin = () => { socket.off('patient_checked_in', refreshEntries); socket.off('patient_room_assigned', refreshEntries); socket.off('appointment_completed', onApptCompleted); socket.off('nurse_call_updated', onNurseCallUpdate); };
      }

      // Doctors get a live toast the moment the lab finishes testing one of
      // their patients' samples, instead of finding out only when they
      // happen to reopen Health Records.
      let offLabReady = () => {};
      if (user?.role === 'doctor') {
        const onLabReady = (data) => {
          toast(data.isAbnormal ? `⚠️ ${data.patientName}'s lab report is ready — abnormal result` : `🧪 ${data.patientName}'s lab report is ready`, { duration: 7000 });
          recordsAPI.getAll().then(res => {
            const mine = (res.data.data || []).filter(r => ['pending','processing'].includes(r.status) && (r.type === 'lab_report' || r.testName) && r.doctor?._id === user._id);
            setLabRecords(mine);
          }).catch(() => {});
        };
        socket.on('lab_report_ready', onLabReady);
        offLabReady = () => socket.off('lab_report_ready', onLabReady);
      }

      return () => { socket.off('emergency_alert', handleNewAlert); offCheckin(); offLabReady(); };
    }
  }, [user]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
      <div className="spinner-lg" />
    </div>
  );

  // ── FINANCE DASHBOARD ────────────────────────────────────────────────
  if (user?.role === 'finance')          return <FinanceDashboard />;

  // ── DEDICATED STAFF DASHBOARDS — every non-admin/doctor/patient role ─
  if (user?.role === 'wardboy')          return <WardboyDashboard />;
  if (user?.role === 'security')         return <SecurityDashboard />;
  if (user?.role === 'lab_technician')   return <Navigate to="/lab-dashboard" replace />;
  if (user?.role === 'nurse')            return <NurseDashboard />;
  if (user?.role === 'pharmacist')       return <PharmacistDashboard />;
  if (user?.role === 'receptionist')     return <ReceptionistDashboard />;
  if (user?.role === 'it_technician')    return <ITTechDashboard />;
  if (user?.role === 'ambulance_driver') return <AmbulanceDashboard />;
  if (user?.role === 'electrician')      return <ElectricianDashboard />;
  if (user?.role === 'plumber')          return <PlumberDashboard />;
  if (user?.role === 'equipment_tech')   return <EquipmentTechDashboard />;
  if (user?.role === 'biomedical')       return <BiomedicalDashboard />;
  if (user?.role === 'sweeper')          return <SweeperDashboard />;
  if (user?.role === 'otboy')            return <OTBoyDashboard />;
  if (user?.role === 'radiology_tech')   return <RadiologyTechDashboard />;
  if (user?.role === 'dialysis_tech')    return <DialysisTechDashboard />;

  // ── DOCTOR DASHBOARD — dedicated, clinically-focused, not a reskinned admin view ─
  if (user?.role === 'doctor')           return <DoctorDashboard user={user} navigate={navigate} />;

  // ── PATIENT DASHBOARD ─────────────────────────────────────────────
  if (user?.role === 'patient') {
    const myAppts = appointments.filter(a => a.patient?._id === user._id || a.patient?.email === user.email);
    const myRems = reminders.filter(r => r.patient?._id === user._id || r.patient?.email === user.email);
    const activeEntries = entryCodes.filter(e => e.status === 'awaiting_arrival' || (e.status === 'verified' && !e.room));
    const checkedInEntries = entryCodes.filter(e => e.status === 'verified' && e.room);

    const submitRating = async (e) => {
      e.preventDefault();
      if (!ratingValue) { toast.error('Please select a star rating'); return; }
      setSubmittingRating(true);
      try {
        await reviewsAPI.create({ appointmentId: ratingAppt._id, rating: ratingValue, comment: ratingComment.trim() });
        toast.success('🙏 Thank you for your feedback!');
        setPendingRatings(rs => rs.filter(r => r._id !== ratingAppt._id));
        setRatingAppt(null); setRatingValue(0); setRatingComment('');
      } catch (err) { toast.error(err.response?.data?.error || 'Failed to submit rating'); }
      setSubmittingRating(false);
    };

    return (
      <div>
        <div className="page-header">
          <div>
            <div className="page-title">My Health Dashboard</div>
            <div className="page-subtitle">Track your health, appointments & medications</div>
          </div>
          <button className="sos-button" onClick={async () => { try { await alertsAPI.create({ type: 'SOS', severity: 'critical', message: 'Emergency SOS' }); toast.error('🚨 SOS sent!', { duration: 8000 }); } catch { toast.error('SOS activated!'); } }}>
            🚨<span>SOS</span>
          </button>
        </div>

        {/* ── Hospital Entry Code(s) ── */}
        {activeEntries.length > 0 && activeEntries.map(entry => (
          <motion.div key={entry._id} initial={{ opacity:0, y:-10 }} animate={{ opacity:1, y:0 }}
            style={{ background:'linear-gradient(135deg,#0891b2,#0e7490)', borderRadius:16, padding:'20px 26px', marginBottom:18, color:'#fff' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:16 }}>
              <div>
                <div style={{ fontSize:13, opacity:.85, fontWeight:600, marginBottom:4 }}>🎫 Your Hospital Entry Code</div>
                <div style={{ fontSize:13, opacity:.85 }}>For your appointment with Dr. {entry.appointment?.doctor?.name} · {entry.appointment?.timeSlot}</div>
                <div style={{ fontSize:11.5, opacity:.7, marginTop:6 }}>📍 Show this code at the reception desk — entry check-in is mandatory</div>
              </div>
              <div style={{ background:'rgba(255,255,255,.15)', border:'2px dashed rgba(255,255,255,.4)', borderRadius:14, padding:'14px 24px', textAlign:'center' }}>
                <div style={{ fontSize:32, fontWeight:900, letterSpacing:6, fontFamily:'monospace' }}>{entry.otp}</div>
              </div>
            </div>
          </motion.div>
        ))}

        {checkedInEntries.length > 0 && checkedInEntries.map(entry => (
          <motion.div key={entry._id} initial={{ opacity:0, y:-10 }} animate={{ opacity:1, y:0 }}
            style={{ background:'linear-gradient(135deg,#059669,#34d399)', borderRadius:16, padding:'20px 26px', marginBottom:18, color:'#fff' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:16 }}>
              <div>
                <div style={{ fontSize:15, fontWeight:800, marginBottom:4 }}>✅ Checked In!</div>
                <div style={{ fontSize:13, opacity:.9 }}>{entry.assignedWardboy ? `${entry.assignedWardboy.name} will escort you to your room shortly` : 'A staff member will escort you to your room shortly'}</div>
                {entry.assignedWardboy?.phone && <div style={{ fontSize:12, opacity:.8, marginTop:2 }}>📞 {entry.assignedWardboy.phone}</div>}
              </div>
              <div style={{ background:'rgba(255,255,255,.15)', borderRadius:14, padding:'12px 22px', textAlign:'center' }}>
                <div style={{ fontSize:10, opacity:.8, fontWeight:700, textTransform:'uppercase' }}>Your Room</div>
                <div style={{ fontSize:20, fontWeight:900 }}>{entry.room?.name} {entry.room?.number}</div>
                <div style={{ fontSize:11, opacity:.85 }}>Floor {entry.room?.floor}</div>
              </div>
            </div>
          </motion.div>
        ))}

        {/* ── Currently Admitted — IPD status banner ── */}
        {myAdmissions.some(a => a.status === 'admitted') && myAdmissions.filter(a=>a.status==='admitted').map(a => (
          <motion.div key={a._id} initial={{ opacity:0, y:-10 }} animate={{ opacity:1, y:0 }}
            style={{ background:'linear-gradient(135deg,#4338ca,#7c3aed)', borderRadius:16, padding:'20px 26px', marginBottom:18, color:'#fff' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:16 }}>
              <div>
                <div style={{ fontSize:13, opacity:.85, fontWeight:700, marginBottom:4 }}>🏥 You are currently admitted</div>
                <div style={{ fontSize:15, fontWeight:800 }}>{a.room?.type} — Room {a.room?.number}, Floor {a.room?.floor}</div>
                <div style={{ fontSize:12, opacity:.8, marginTop:3 }}>Admitted {new Date(a.admissionDate).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})} · Dr. {a.admittingDoctor?.name}</div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                <div style={{ background:'rgba(255,255,255,.15)', borderRadius:12, padding:'10px 18px', textAlign:'center' }}>
                  <div style={{ fontSize:10, opacity:.8, fontWeight:700, textTransform:'uppercase' }}>Reason</div>
                  <div style={{ fontSize:13, fontWeight:700, maxWidth:180 }}>{a.reasonForAdmission}</div>
                </div>
                {myNurseCall ? (
                  <div style={{ background:'rgba(255,255,255,.2)', borderRadius:12, padding:'10px 18px', textAlign:'center' }}>
                    <div style={{ fontSize:12, fontWeight:800 }}>{myNurseCall.status==='acknowledged' ? '🩺 Nurse on the way' : '🔔 Call sent'}</div>
                    <div style={{ fontSize:10.5, opacity:.85, marginTop:2 }}>{myNurseCall.status==='acknowledged' ? myNurseCall.acknowledgedBy?.name : 'Waiting for a nurse'}</div>
                  </div>
                ) : (
                  <button onClick={async()=>{
                    setCallingNurse(true);
                    try { const res = await nurseCallAPI.create(); setMyNurseCall(res.data.data); toast.success('🔔 A nurse has been notified'); }
                    catch (err) { toast.error(err.response?.data?.error || 'Failed to call a nurse'); }
                    setCallingNurse(false);
                  }} disabled={callingNurse} style={{ padding:'11px 20px', borderRadius:12, border:'none', background:'#fff', color:'#4338ca', fontWeight:800, fontSize:13.5, cursor:'pointer', fontFamily:'inherit' }}>
                    {callingNurse ? '…' : '🔔 Call Nurse'}
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        ))}

        {/* ── My Queue Status — self-service OPD token ── */}
        <motion.div initial={{ opacity:0, y:-6 }} animate={{ opacity:1, y:0 }}
          style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:16, padding:'18px 22px', marginBottom:18 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:myQueueTokens.length?14:0, flexWrap:'wrap', gap:10 }}>
            <span style={{ fontWeight:800, fontSize:14.5, color:'#0f172a' }}>🎫 Queue Status</span>
            {!myQueueTokens.some(t => ['waiting','called','in_consultation'].includes(t.status)) && (
              <div style={{ display:'flex', gap:8 }}>
                <select value={queueDept} onChange={e=>setQueueDept(e.target.value)} style={{ padding:'8px 12px', borderRadius:9, border:'1.5px solid #e2e8f0', fontSize:12.5, fontFamily:'inherit' }}>
                  <option value="">Select department…</option>
                  {['Cardiology','Neurology','Orthopedics','General Medicine','Pediatrics','Psychiatry','Gynecology','Oncology','Surgery','ENT','Radiology','Emergency'].map(d=><option key={d} value={d}>{d}</option>)}
                </select>
                <button className="btn btn-primary btn-sm" disabled={gettingToken || !queueDept} onClick={async()=>{
                  setGettingToken(true);
                  try {
                    const res = await queueAPI.createToken({ department: queueDept });
                    toast.success(`🎫 Your token: #${res.data.data.tokenNumber}`);
                    const r2 = await queueAPI.getMine(); setMyQueueTokens(r2.data.data || []);
                  } catch (err) { toast.error(err.response?.data?.error || 'Failed to get a token'); }
                  setGettingToken(false);
                }}>{gettingToken?'…':'Get a Token'}</button>
              </div>
            )}
          </div>
          {myQueueTokens.filter(t => ['waiting','called','in_consultation'].includes(t.status)).map(t => (
            <div key={t._id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background: t.status==='waiting' ? '#f8fafc' : '#f0fdf4', borderRadius:12, padding:'12px 16px', flexWrap:'wrap', gap:10 }}>
              <div>
                <div style={{ fontSize:12, color:'#64748b' }}>{t.department}</div>
                <div style={{ fontSize:26, fontWeight:900, color:'#0f172a' }}>#{t.tokenNumber}</div>
              </div>
              <div style={{ textAlign:'right' }}>
                <div style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700, background: t.status==='waiting'?'#eff6ff':t.status==='called'?'#fffbeb':'#dcfce7', color: t.status==='waiting'?'#1d4ed8':t.status==='called'?'#92400e':'#15803d', display:'inline-block', marginBottom:4, textTransform:'capitalize' }}>
                  {t.status==='in_consultation'?'With Doctor':t.status}
                </div>
                <div style={{ fontSize:12, color:'#64748b' }}>{t.status==='waiting' ? `${t.waitingAhead} ahead of you` : t.status==='called' ? 'Please head to the counter' : 'In progress'}</div>
              </div>
            </div>
          ))}
          {myQueueTokens.filter(t => ['waiting','called','in_consultation'].includes(t.status)).length === 0 && !queueDept && (
            <div style={{ fontSize:12.5, color:'#94a3b8' }}>No active token — select a department above to get one for a walk-in visit.</div>
          )}
        </motion.div>

        {/* ── Rate your visit — surfaced right on the dashboard the moment
            a doctor marks an appointment complete ── */}
        {pendingRatings.length > 0 && (
          <motion.div initial={{ opacity:0,y:-8 }} animate={{ opacity:1,y:0 }} style={{ background:'linear-gradient(135deg,#fffbeb,#fef3c7)', border:'1.5px solid #fde68a', borderRadius:16, padding:'16px 22px', marginBottom:18, display:'flex', alignItems:'center', justifyContent:'space-between', gap:16, flexWrap:'wrap' }}>
            <div style={{ display:'flex', alignItems:'center', gap:14 }}>
              <span style={{ fontSize:30 }}>⭐</span>
              <div>
                <div style={{ fontWeight:800, color:'#92400e', fontSize:15 }}>How was your visit with Dr. {pendingRatings[0].doctor?.name}?</div>
                <div style={{ fontSize:12.5, color:'#b45309', marginTop:2 }}>{pendingRatings.length > 1 ? `You have ${pendingRatings.length} completed visits awaiting your feedback.` : 'Your feedback helps other patients and helps us improve care.'}</div>
              </div>
            </div>
            <button className="btn btn-primary" onClick={() => { setRatingAppt(pendingRatings[0]); setRatingValue(0); setRatingComment(''); }}>Rate Now →</button>
          </motion.div>
        )}

        <div className="stat-grid">
          <StatCard icon="❤️" value={user?.currentVitals?.bloodPressure || 'Not recorded'} label="Blood Pressure" color="#fef2f2" delay={0} />
          <StatCard icon="💓" value={user?.currentVitals?.pulse ?? 'Not recorded'} label="Pulse (bpm)" color="#e8effe" delay={0.06} />
          <StatCard icon="🌡️" value={user?.currentVitals?.temperature ? `${user.currentVitals.temperature}°F` : 'Not recorded'} label="Temperature" color="#fffbeb" delay={0.12} />
          <StatCard icon="🩸" value={user?.currentVitals?.spo2 ? `${user.currentVitals.spo2}%` : 'Not recorded'} label="SpO2" color="#ecfdf5" delay={0.18} />
        </div>
        {user?.currentVitals?.recordedAt ? (
          <div style={{ fontSize:11, color:'#94a3b8', marginTop:-8, marginBottom:18 }}>
            Recorded by {user.currentVitals.recordedByName || 'hospital staff'} on {new Date(user.currentVitals.recordedAt).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})} during your hospital visit.
          </div>
        ) : (
          <div style={{ fontSize:11, color:'#94a3b8', marginTop:-8, marginBottom:18 }}>
            These are recorded by a doctor/nurse during your hospital visit — nothing to show yet. Meanwhile, you can track your own health day-to-day in the <a href="/wearable-sync" style={{ color:'#1648c9', fontWeight:600 }}>Health &amp; Vitals Tracker</a> (manual log, CSV import, or Fitbit).
          </div>
        )}
        <div className="grid-2">
          <div className="card">
            <div className="card-header">
              <span className="card-title">📅 My Appointments</span>
              <button className="btn btn-primary btn-xs" onClick={() => navigate('/appointments')}>Book New</button>
            </div>
            <div className="card-body-0">
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Doctor</th><th>Date</th><th>Booked At</th><th>Status</th></tr></thead>
                  <tbody>
                    {myAppts.length === 0 ? <tr><td colSpan={4} style={{ textAlign: 'center', padding: 20, color: '#94a3b8' }}>No appointments yet</td></tr>
                      : myAppts.slice(0, 4).map(a => (
                      <tr key={a._id}>
                        <td><div className="td-main">{a.doctor?.name}</div><div className="td-sub">{a.department}</div></td>
                        <td className="text-sm">{new Date(a.date).toLocaleDateString()}<br /><span className="text-xs text-muted">{a.timeSlot}</span></td>
                        <td className="text-sm">{a.createdAt ? new Date(a.createdAt).toLocaleDateString('en-IN',{day:'numeric',month:'short'}) : '—'}<br /><span className="text-xs text-muted">{a.createdAt ? new Date(a.createdAt).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}) : ''}</span></td>
                        <td><span className={`badge badge-${a.status === 'confirmed' ? 'success' : a.status === 'pending' ? 'warning' : 'danger'}`}>{a.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-header"><span className="card-title">⏰ Today's Medications</span></div>
            <div className="card-body">
              {myRems.length === 0 ? <div style={{ textAlign: 'center', padding: 20, color: '#94a3b8' }}>No reminders set</div>
                : myRems.slice(0, 4).map(r => (
                <div key={r._id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 11, borderRadius: 8, border: '1.5px solid #e2e8f0', marginBottom: 8, transition: 'border-color .18s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#1648c9'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; }}
                >
                  <span style={{ fontSize: 22 }}>💊</span>
                  <div style={{ flex: 1 }}><div className="fw-7 text-sm">{r.medicineName}</div><div className="text-xs text-muted">{r.dose} · {r.times?.[0]}</div></div>
                  <button className="btn btn-success btn-xs" onClick={(e) => { e.currentTarget.textContent = '✓ Done'; e.currentTarget.disabled = true; e.currentTarget.className = 'btn btn-outline btn-xs'; toast.success('Medication marked as taken!'); }}>✓ Taken</button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── My Bills — pharmacy orders + appointment fees weren't
            visible together anywhere before. ── */}
        <div className="card mt-2">
          <div className="card-header">
            <span className="card-title">💳 My Bills</span>
            <button className="btn btn-outline btn-xs" onClick={() => navigate('/orders')}>View All Orders</button>
          </div>
          <div className="card-body">
            {(() => {
              const recentOrders = myOrders.slice(0, 5);
              const totalSpent = myOrders.reduce((s,o) => s + (o.totalAmount||0), 0);
              const pendingPayments = myOrders.filter(o => o.paymentStatus === 'pending').length;
              return (
                <>
                  <div style={{ display:'flex', gap:24, marginBottom:16, flexWrap:'wrap' }}>
                    <div><div style={{ fontSize:20, fontWeight:800, color:'#0f172a' }}>₹{totalSpent.toLocaleString('en-IN')}</div><div style={{ fontSize:11.5, color:'#94a3b8' }}>Total spent on medicines</div></div>
                    <div><div style={{ fontSize:20, fontWeight:800, color: pendingPayments>0 ? '#d97706' : '#059669' }}>{pendingPayments}</div><div style={{ fontSize:11.5, color:'#94a3b8' }}>Payments pending</div></div>
                    <div><div style={{ fontSize:20, fontWeight:800, color:'#0f172a' }}>{myOrders.length}</div><div style={{ fontSize:11.5, color:'#94a3b8' }}>Total orders placed</div></div>
                  </div>
                  {recentOrders.length === 0 ? (
                    <div style={{ textAlign:'center', padding:18, color:'#94a3b8', fontSize:13 }}>No orders yet</div>
                  ) : recentOrders.map(o => (
                    <div key={o._id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'9px 12px', background:'#f8fafc', borderRadius:9, marginBottom:6 }}>
                      <div>
                        <div className="fw-7 text-sm">{(o.items||[]).map(i=>i.medicineName).filter(Boolean).slice(0,2).join(', ') || 'Order'}{(o.items||[]).length>2?` +${o.items.length-2} more`:''}</div>
                        <div className="text-xs text-muted">{new Date(o.createdAt).toLocaleDateString('en-IN',{day:'numeric',month:'short'})} · ₹{o.totalAmount?.toLocaleString('en-IN')}</div>
                      </div>
                      <span className={`badge ${o.paymentStatus==='paid'?'badge-success':o.paymentStatus==='refunded'?'badge-primary':'badge-warning'}`}>{o.paymentStatus}</span>
                    </div>
                  ))}
                </>
              );
            })()}
          </div>
        </div>

        {/* ── Rate Visit Modal ── */}
        {ratingAppt && (
          <div className="modal-overlay" onClick={e => { if(e.target===e.currentTarget) setRatingAppt(null); }}>
            <motion.div className="modal-box" style={{ maxWidth:440 }} initial={{ opacity:0,y:24,scale:.96 }} animate={{ opacity:1,y:0,scale:1 }}>
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
                      <button key={n} type="button" onClick={() => setRatingValue(n)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:34, color: n<=ratingValue ? '#f59e0b' : '#e2e8f0', lineHeight:1 }}>★</button>
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
      </div>
    );
  }

  // ── ADMIN / DOCTOR DASHBOARD ──────────────────────────────────────
  const summary = stats?.summary || {};
  const charts  = stats?.charts  || {};

  // Real-time fallback counts from local data (used when analytics API fails)
  const today         = new Date();
  const todayStr      = today.toDateString();
  const todayApptCount= appointments.filter(a => new Date(a.date).toDateString() === todayStr).length;
  const patientCount  = [...new Set(appointments.map(a => a.patient?._id).filter(Boolean))].length;
  const doctorCount   = [...new Set(appointments.map(a => a.doctor?._id).filter(Boolean))].length;
  const pendingApprovals = 0; // loaded via usersAPI in useEffect

  // ── Real chart data (no hardcoded sample numbers) ──────────────────
  const dailyVisits = charts.dailyVisits || [];
  const visitsData = {
    labels: dailyVisits.length ? dailyVisits.map(d => d.label) : ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
    datasets: [{
      label: 'Appointments', data: dailyVisits.length ? dailyVisits.map(d => d.total) : [0,0,0,0,0,0,0],
      backgroundColor: 'rgba(22,72,201,.72)', borderRadius: 7, borderWidth: 0
    }, {
      label: 'Completed', data: dailyVisits.length ? dailyVisits.map(d => d.confirmed) : [0,0,0,0,0,0,0],
      backgroundColor: 'rgba(8,145,178,.65)', borderRadius: 7, borderWidth: 0
    }]
  };

  const deptStatsReal = (charts.departmentStats || []).filter(d => d._id);
  const deptData = {
    labels: deptStatsReal.length ? deptStatsReal.map(d => d._id) : ['No data yet'],
    datasets: [{ data: deptStatsReal.length ? deptStatsReal.map(d => d.count) : [1], backgroundColor: ['#1648c9','#0891b2','#059669','#d97706','#7c3aed','#dc2626','#0ea5e9'], borderWidth: 3, borderColor: '#fff' }]
  };

  const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const revenueByMonth = new Array(12).fill(0);
  (charts.monthlyRevenue || []).forEach(r => { revenueByMonth[(r._id?.month || 1) - 1] = r.revenue || 0; });
  const lastMonthIdx = new Date().getMonth();
  const revenueData = {
    labels: MONTHS_SHORT.slice(0, lastMonthIdx + 1),
    datasets: [{ label: 'Revenue', data: revenueByMonth.slice(0, lastMonthIdx + 1), borderColor: '#1648c9', backgroundColor: 'rgba(22,72,201,.06)', fill: true, tension: .4, borderWidth: 2, pointBackgroundColor: '#1648c9', pointRadius: 4 }]
  };

  // ── Bed & Ward Occupancy — the rooms/beds feature already existed for
  // room assignment at reception, but had no bird's-eye summary anywhere.
  const totalBeds    = rooms.reduce((t, r) => t + (r.capacity || 0), 0);
  const occupiedBeds = rooms.reduce((t, r) => t + (r.occupiedBeds || 0), 0);
  const occupancyPct = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;
  const roomsByType = {};
  rooms.forEach(r => {
    const key = r.type || 'General';
    roomsByType[key] = roomsByType[key] || { capacity: 0, occupied: 0, count: 0 };
    roomsByType[key].capacity += (r.capacity || 0);
    roomsByType[key].occupied += (r.occupiedBeds || 0);
    roomsByType[key].count += 1;
  });
  const maintenanceRooms = rooms.filter(r => r.status === 'maintenance' || r.status === 'cleaning').length;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">{user?.role === 'doctor' ? 'Doctor Dashboard' : 'Admin Dashboard'}</div>
          <div className="page-subtitle">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} · Good {new Date().getHours() < 12 ? 'morning' : 'afternoon'}, {user?.name?.split(' ')[0]}!</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-outline btn-sm" onClick={() => navigate('/analytics')}>📄 Reports</button>
          {user?.role === 'doctor' && <button className="btn btn-outline btn-sm" onClick={() => navigate('/prescriptions')}>💊 Write Prescription</button>}
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/appointments')}>+ Appointment</button>
        </div>
      </div>

      <div className="stat-grid">
        <StatCard icon="👥" value={summary.totalPatients ?? patientCount} label="Total Patients" color="#e8effe" change={{ dir: 'up', text: `${appointments.filter(a=>a.status==='confirmed').length} confirmed appts` }} delay={0} />
        <StatCard icon="🩺" value={summary.totalDoctors ?? doctorCount} label="Active Doctors" color="#e0f7fa" change={{ dir: 'up', text: 'Available today' }} delay={0.07} />
        <StatCard icon="📅" value={summary.todayAppointments ?? todayApptCount} label="Today's Appointments" color="#fffbeb" change={{ dir: 'up', text: `${appointments.filter(a=>a.status==='pending').length} pending` }} delay={0.14} />
        <StatCard icon="💊" value={summary.totalOrders ?? 0} label="Medicine Orders" color="#ecfdf5" change={{ dir: 'up', text: 'View pharmacy' }} delay={0.21} />
        <StatCard icon="🚨" value={summary.activeAlerts ?? alerts.filter(a=>a.status!=='resolved').length} label="Active Alerts" color="#fef2f2" change={{ dir: alerts.filter(a=>a.status!=='resolved').length > 0 ? 'warn' : 'up', text: alerts.filter(a=>a.status!=='resolved').length > 0 ? 'Needs attention' : 'All clear' }} delay={0.28} />
        <StatCard icon="⏳" value={summary.pendingUsers ?? pendingApprovals} label="Pending Approvals" color="#f5f3ff" change={{ dir: pendingApprovals > 0 ? 'warn' : 'up', text: pendingApprovals > 0 ? 'Awaiting review' : 'All approved' }} delay={0.35} />
      </div>

      {/* Bed & Ward Occupancy — rooms/beds already existed for reception's
          room assignment flow, but admin had no summary view of it. */}
      {user?.role === 'admin' && rooms.length > 0 && (
        <motion.div className="card mt-2" initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.4, duration:0.38 }}>
          <div className="card-header">
            <span className="card-title">🛏️ Bed &amp; Ward Occupancy</span>
            <span className={`badge ${occupancyPct >= 90 ? 'badge-danger' : occupancyPct >= 70 ? 'badge-warning' : 'badge-success'}`}>{occupancyPct}% occupied</span>
          </div>
          <div className="card-body">
            <div style={{ display:'flex', gap:18, alignItems:'center', marginBottom:16, flexWrap:'wrap' }}>
              <div style={{ fontSize:13, color:'#64748b' }}><strong style={{ fontSize:20, color:'#0f172a' }}>{occupiedBeds}</strong> / {totalBeds} beds occupied</div>
              {maintenanceRooms > 0 && <div style={{ fontSize:12, color:'#d97706', fontWeight:700 }}>🧹 {maintenanceRooms} room{maintenanceRooms!==1?'s':''} under maintenance/cleaning</div>}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(190px,1fr))', gap:14 }}>
              {Object.entries(roomsByType).map(([type, s]) => {
                const pct = s.capacity > 0 ? Math.round((s.occupied / s.capacity) * 100) : 0;
                return (
                  <div key={type}>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:5 }}>
                      <span style={{ fontWeight:700, color:'#374151' }}>{type} <span style={{ color:'#94a3b8', fontWeight:500 }}>({s.count} room{s.count!==1?'s':''})</span></span>
                      <span style={{ fontWeight:700, color: pct>=90?'#dc2626':pct>=70?'#d97706':'#059669' }}>{s.occupied}/{s.capacity}</span>
                    </div>
                    <div style={{ height:7, background:'#f1f5f9', borderRadius:4, overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${pct}%`, background: pct>=90?'#dc2626':pct>=70?'#d97706':'#059669', borderRadius:4, transition:'width .5s' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}

      <div className="grid-2 mt-2">
        <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.38 }}>
          <div className="card-header">
            <span className="card-title">📈 Patient Visits</span>
            <select className="form-input" style={{ width: 120, padding: '5px 28px 5px 8px', fontSize: 12 }}>
              <option>This Week</option><option>This Month</option>
            </select>
          </div>
          <div className="card-body">
            <div style={{ height: 190, position: 'relative' }}>
              <Bar data={visitsData} options={{ ...CHART_OPTS, plugins: { legend: { display: true, position: 'top', labels: { font: { size: 11 }, boxWidth: 10 } } } }} />
            </div>
          </div>
        </motion.div>
        <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.27, duration: 0.38 }}>
          <div className="card-header"><span className="card-title">🏥 Department Load</span></div>
          <div className="card-body">
            <div style={{ height: 190, position: 'relative' }}>
              <Doughnut data={deptData} options={{ responsive: true, maintainAspectRatio: false, cutout: '67%', plugins: { legend: { position: 'right', labels: { font: { size: 11 }, boxWidth: 9, padding: 6 } } } }} />
            </div>
          </div>
        </motion.div>
      </div>

      <div className="grid-2 mt-2">
        <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.34, duration: 0.38 }}>
          <div className="card-header">
            <span className="card-title">📅 Recent Appointments</span>
            <button className="btn btn-outline btn-xs" onClick={() => navigate('/appointments')}>View All</button>
          </div>
          <div className="card-body-0">
            <div className="table-wrap">
              <table>
                <thead><tr><th>Patient</th><th>Doctor</th><th>Time</th><th>Booked At</th><th>Status</th></tr></thead>
                <tbody>
                  {appointments.slice(0, 5).map(a => (
                    <tr key={a._id}>
                      <td><div className="td-main">{a.patient?.name}</div><div className="td-sub">{a.department}</div></td>
                      <td className="text-sm">{a.doctor?.name}</td>
                      <td className="text-sm">{a.timeSlot}<br /><span className="text-xs text-muted">{new Date(a.date).toLocaleDateString()}</span></td>
                      <td className="text-sm">{a.createdAt ? new Date(a.createdAt).toLocaleDateString('en-IN',{day:'numeric',month:'short'}) : '—'}<br /><span className="text-xs text-muted">{a.createdAt ? new Date(a.createdAt).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}) : ''}</span></td>
                      <td><span className={`badge badge-${a.status === 'confirmed' ? 'success' : a.status === 'pending' ? 'warning' : 'danger'}`}>{a.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
        <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.41, duration: 0.38 }}>
          <div className="card-header">
            <span className="card-title">🚨 Alert Log</span>
            <button className="btn btn-outline btn-xs" onClick={() => navigate('/emergency')}>View All</button>
          </div>
          <div className="card-body">
            {alerts.slice(0, 3).map(a => (
              <div key={a._id} style={{ display: 'flex', gap: 10, padding: 10, borderRadius: 8, background: a.severity === 'critical' ? '#fef2f2' : a.severity === 'high' ? '#fffbeb' : '#f0f4ff', marginBottom: 8 }}>
                <span style={{ fontSize: 18 }}>{a.type === 'SOS' ? '🚨' : a.type === 'Medication' ? '⏰' : '❤️'}</span>
                <div style={{ flex: 1 }}>
                  <div className="fw-7 text-sm">{a.patient?.name} · {a.type}</div>
                  <div className="text-xs text-muted">{a.message}</div>
                </div>
                <span className={`badge badge-${a.status === 'resolved' ? 'success' : 'danger'}`}>{a.status}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      <motion.div className="card mt-2" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.48, duration: 0.38 }}>
        <div className="card-header">
          <span className="card-title">💰 Monthly Revenue</span>
          <button className="btn btn-outline btn-xs" onClick={() => navigate('/analytics')}>Full Analytics</button>
        </div>
        <div className="card-body">
          <div style={{ height: 175, position: 'relative' }}>
            <Line data={revenueData} options={{ ...CHART_OPTS, scales: { x: { grid: { display: false } }, y: { beginAtZero: false, ticks: { callback: v => '$' + Math.round(v / 1000) + 'k' }, grid: { color: 'rgba(0,0,0,.04)' } } } }} />
          </div>
        </div>
      </motion.div>
        <div className="grid-2" style={{ marginTop:20 }}>
          <TodayScheduleWidget />
          <MyTasksWidget />
        </div>
        <div className="grid-2" style={{ marginTop:16 }}>
          <LeaveNotificationsWidget />
          <MySalaryWidget />
        </div>

        {user?.role === 'doctor' && (
          <motion.div className="grid-2 mt-2" initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.3 }}>
            <motion.div className="card">
              <div className="card-header">
                <span className="card-title">🧪 Lab Results Pending for My Patients</span>
                <button className="btn btn-outline btn-xs" onClick={() => navigate('/records')}>View All Records</button>
              </div>
              <div className="card-body">
                {labRecords.length === 0 ? (
                  <div style={{ textAlign:'center', padding:18, color:'#94a3b8', fontSize:13 }}>No pending lab tests for your patients right now</div>
                ) : (
                  labRecords.slice(0, 5).map(r => (
                    <div key={r._id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'9px 12px', background:'#f8fafc', borderRadius:9, marginBottom:6 }}>
                      <div>
                        <div className="fw-7 text-sm">{r.patient?.name} — {r.testName || r.title}</div>
                        <div className="text-xs text-muted">Ordered {new Date(r.createdAt).toLocaleDateString('en-IN', { day:'numeric', month:'short' })}</div>
                      </div>
                      <span className={`badge ${r.status === 'processing' ? 'badge-primary' : 'badge-warning'}`}>{r.status === 'processing' ? 'In Progress' : 'Pending'}</span>
                    </div>
                  ))
                )}
              </div>
            </motion.div>

            {/* Something genuinely doctor-specific — admin sees hospital-wide
                numbers above, but "how are my own patients rating me" only
                makes sense for the doctor themselves. */}
            <motion.div className="card">
              <div className="card-header">
                <span className="card-title">⭐ My Ratings & Reviews</span>
                {myReviews.count > 0 && <span className="badge badge-primary">{myReviews.average} / 5 · {myReviews.count} review{myReviews.count!==1?'s':''}</span>}
              </div>
              <div className="card-body">
                {myReviews.count === 0 ? (
                  <div style={{ textAlign:'center', padding:18, color:'#94a3b8', fontSize:13 }}>No patient reviews yet — they'll show up here once patients rate a completed visit.</div>
                ) : (
                  <>
                    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
                      <div style={{ fontSize:30, fontWeight:800, color:'#0f172a' }}>{myReviews.average}</div>
                      <div>
                        <div style={{ color:'#f59e0b', fontSize:15, letterSpacing:1 }}>{'★'.repeat(Math.round(myReviews.average||0))}{'☆'.repeat(5-Math.round(myReviews.average||0))}</div>
                        <div style={{ fontSize:11.5, color:'#94a3b8' }}>Based on {myReviews.count} patient review{myReviews.count!==1?'s':''}</div>
                      </div>
                    </div>
                    {myReviews.data.slice(0,3).map(r => (
                      <div key={r._id} style={{ padding:'9px 12px', background:'#f8fafc', borderRadius:9, marginBottom:6 }}>
                        <div style={{ display:'flex', justifyContent:'space-between' }}>
                          <span className="fw-7 text-sm">{r.patient?.name}</span>
                          <span style={{ color:'#f59e0b', fontSize:12 }}>{'★'.repeat(r.rating)}{'☆'.repeat(5-r.rating)}</span>
                        </div>
                        {r.comment && <div className="text-xs text-muted" style={{ marginTop:3 }}>"{r.comment}"</div>}
                      </div>
                    ))}
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}

    </div>
  );
}


