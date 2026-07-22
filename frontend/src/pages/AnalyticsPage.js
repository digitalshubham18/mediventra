import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import { analyticsAPI } from '../utils/api';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend, Filler);

const OPTS = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { grid: { color: 'rgba(0,0,0,.04)' } } } };
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DEPT_COLORS = ['#1648c9','#0891b2','#059669','#d97706','#7c3aed','#dc2626','#0ea5e9'];
const CAT_COLORS  = ['#dc2626','#0891b2','#1648c9','#d97706','#059669','#7c3aed','#db2777','#64748b'];

export default function AnalyticsPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    analyticsAPI.getDashboard()
      .then(res => setStats(res.data?.data || null))
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  const summary = stats?.summary || {};
  const charts  = stats?.charts  || {};

  // Real monthly revenue — built from actual Order totals per month (no
  // hardcoded sample numbers)
  const revenueByMonth = new Array(12).fill(0);
  (charts.monthlyRevenue || []).forEach(r => { revenueByMonth[(r._id?.month || 1) - 1] = r.revenue || 0; });
  const lastIdx = Math.max(new Date().getMonth(), 0);
  const revenueData = {
    labels: MONTHS.slice(0, lastIdx + 1),
    datasets: [{ label: 'Revenue', data: revenueByMonth.slice(0, lastIdx + 1), borderColor: '#059669', backgroundColor: 'rgba(5,150,105,.07)', fill: true, tension: .4, borderWidth: 2, pointBackgroundColor: '#059669', pointRadius: 4 }]
  };

  // Real new patient registrations per month
  const patientsByMonth = new Array(12).fill(0);
  (charts.recentPatients || []).forEach(r => { patientsByMonth[(r._id?.month || 1) - 1] = r.count || 0; });
  const patientsData = {
    labels: MONTHS.slice(0, lastIdx + 1),
    datasets: [{ label: 'New Patients', data: patientsByMonth.slice(0, lastIdx + 1), backgroundColor: 'rgba(22,72,201,.75)', borderRadius: 7 }]
  };

  // Real department performance — count of appointments per department
  const deptStats = (charts.departmentStats || []).filter(d => d._id);
  const deptData = {
    labels: deptStats.length ? deptStats.map(d => d._id) : ['No data yet'],
    datasets: [{ data: deptStats.length ? deptStats.map(d => d.count) : [1], backgroundColor: DEPT_COLORS, borderRadius: 7 }]
  };

  // Real medicine sales by category — units sold, from actual Order items
  const salesStats = charts.medicineSalesByCategory || [];
  const salesData = {
    labels: salesStats.length ? salesStats.map(s => s._id) : ['No sales yet'],
    datasets: [{ data: salesStats.length ? salesStats.map(s => s.unitsSold) : [1], backgroundColor: CAT_COLORS, borderWidth: 2, borderColor: '#fff' }]
  };

  const totalRevenue = revenueByMonth.reduce((a, b) => a + b, 0);

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>Loading analytics…</div>;
  }

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">📈 Analytics & Reports</div><div className="page-subtitle">Real hospital performance data — live from your records</div></div>
        <button className="btn btn-primary btn-sm" onClick={() => window.print()}>📥 Export PDF</button>
      </div>
      <div className="stat-grid">
        {[
          ['💰','Total Revenue (YTD)',`₹${totalRevenue.toLocaleString('en-IN')}`,'#ecfdf5'],
          ['👥','Total Patients',summary.totalPatients ?? 0,'#e8effe'],
          ['📅',"Today's Appointments",summary.todayAppointments ?? 0,'#fffbeb'],
          ['🩺','Active Doctors',summary.totalDoctors ?? 0,'#fef2f2'],
          ['⭐','Avg. Doctor Rating',summary.overallAvgRating != null ? `${summary.overallAvgRating} / 5` : '—','#fffbeb'],
        ].map(([ic,l,v,bg],i) => (
          <motion.div key={l} className="stat-card" initial={{ opacity:0,y:14 }} animate={{ opacity:1,y:0 }} transition={{ delay:i*.07 }}>
            <div className="stat-icon" style={{ background:bg }}>{ic}</div>
            <div className="stat-value" style={{ fontSize:20 }}>{v}</div>
            <div className="stat-label">{l}</div>
          </motion.div>
        ))}
      </div>
      <div className="grid-2 mt-2">
        {[
          ['💰 Monthly Revenue', revenueData, 'line', { ...OPTS, scales: { x:{ grid:{display:false} }, y:{ beginAtZero:true, ticks:{ callback:v=>'₹'+Math.round(v/1000)+'k' }, grid:{color:'rgba(0,0,0,.04)'} } } }],
          ['👥 New Patient Registrations', patientsData, 'bar', OPTS],
        ].map(([title, data, type, opts], i) => (
          <motion.div key={title} className="card" initial={{ opacity:0,y:14 }} animate={{ opacity:1,y:0 }} transition={{ delay:0.2+i*.1 }}>
            <div className="card-header"><span className="card-title">{title}</span></div>
            <div className="card-body">
              <div style={{ height:195,position:'relative' }}>
                {type === 'line' ? <Line data={data} options={opts} /> : <Bar data={data} options={opts} />}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
      <div className="grid-2 mt-2">
        <motion.div className="card" initial={{ opacity:0,y:14 }} animate={{ opacity:1,y:0 }} transition={{ delay:0.4 }}>
          <div className="card-header"><span className="card-title">🏥 Department Performance</span><span className="text-xs text-muted">by appointment volume</span></div>
          <div className="card-body">
            <div style={{ height:195,position:'relative' }}>
              <Bar data={deptData} options={OPTS} />
            </div>
          </div>
        </motion.div>
        <motion.div className="card" initial={{ opacity:0,y:14 }} animate={{ opacity:1,y:0 }} transition={{ delay:0.5 }}>
          <div className="card-header"><span className="card-title">💊 Medicine Sales by Category</span><span className="text-xs text-muted">units sold</span></div>
          <div className="card-body">
            <div style={{ height:195,position:'relative' }}>
              <Doughnut data={salesData} options={{ responsive:true,maintainAspectRatio:false,cutout:'60%',plugins:{ legend:{ position:'right',labels:{ font:{size:11},boxWidth:10,padding:6 } } } }} />
            </div>
          </div>
        </motion.div>
      </div>

      {/* Doctor ratings — real per-doctor average computed from patient reviews */}
      <motion.div className="card mt-2" initial={{ opacity:0,y:14 }} animate={{ opacity:1,y:0 }} transition={{ delay:0.6 }}>
        <div className="card-header"><span className="card-title">⭐ Doctor Ratings</span><span className="text-xs text-muted">from patient reviews</span></div>
        <div className="card-body-0">
          {(charts.doctorRatings || []).length === 0 ? (
            <div style={{ padding:24, textAlign:'center', color:'#94a3b8', fontSize:13 }}>No patient reviews submitted yet.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Doctor</th><th>Specialization</th><th>Rating</th><th>Reviews</th></tr></thead>
                <tbody>
                  {charts.doctorRatings.map(d => (
                    <tr key={d.doctorId}>
                      <td className="td-main">Dr. {d.name}</td>
                      <td className="text-sm">{d.specialization || d.department || '—'}</td>
                      <td>
                        <span style={{ color: d.avgRating >= 4 ? '#059669' : d.avgRating >= 3 ? '#d97706' : '#dc2626', fontWeight:700 }}>
                          {'★'.repeat(Math.round(d.avgRating))}{'☆'.repeat(5 - Math.round(d.avgRating))} {d.avgRating}
                        </span>
                      </td>
                      <td className="text-sm">{d.reviewCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
