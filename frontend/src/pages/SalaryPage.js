import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { salaryAPI, usersAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const ROLE_COLOR = { admin:'#6366f1',doctor:'#0891b2',nurse:'#db2777',pharmacist:'#d97706',wardboy:'#059669',sweeper:'#f59e0b',otboy:'#ef4444' };
const BASE_PAY = { admin:80000, doctor:120000, nurse:45000, pharmacist:50000, wardboy:25000, sweeper:20000, otboy:28000 };
const STATUS_CFG = {
  pending:  { bg:'#fef3c7', c:'#92400e', dot:'#f59e0b', label:'Pending' },
  credited: { bg:'#dcfce7', c:'#15803d', dot:'#22c55e', label:'Credited ✓' },
  held:     { bg:'#fee2e2', c:'#dc2626', dot:'#ef4444', label:'Held' },
};

const INR = v => `₹${Number(v||0).toLocaleString('en-IN')}`;
const ini = n => n?.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()||'?';

export default function SalaryPage() {
  const { user } = useAuth();
  const [salaries, setSalaries] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth()+1);
  const [filterYear, setFilterYear]   = useState(new Date().getFullYear());
  const [filterRole, setFilterRole]   = useState('');
  const [selSalary, setSelSalary]     = useState(null);
  const [showGenerate, setShowGenerate] = useState(false);
  const [bulkLoading, setBulkLoading]   = useState(false);
  const [creditingId, setCreditingId]   = useState(null);
  const [saving, setSaving] = useState(false);
  const [genForm, setGenForm] = useState({
    employeeId:'', month: new Date().getMonth()+1, year: new Date().getFullYear(),
    daysWorked:'', daysAbsent:'', overrideDays:false, overtimeHours:0, bonus:0, loan:0, otherDed:0,
    paymentMode:'bank_transfer', bankAccount:'', remarks:''
  });
  const [attendancePreview, setAttendancePreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [showExtraPay, setShowExtraPay] = useState(false);
  const [extraPayForm, setExtraPayForm] = useState({ employeeId:'', amount:'', reason:'' });
  const [savingExtraPay, setSavingExtraPay] = useState(false);

  const isAdmin = user?.role === 'admin';
  const isFinance = user?.role === 'finance';
  // Salary generation/crediting is exclusively a Finance Officer task —
  // admin can still view the full register across all roles (useful for
  // oversight) but no longer generates or credits salaries from here.
  const canManage = isFinance;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Regular staff viewing "My Salary" get their FULL history, not just
      // one month at a time — admin/finance still filter by month/year
      // since they're working through a register of everyone.
      const q = (isAdmin || isFinance)
        ? { month:filterMonth, year:filterYear, ...(filterRole?{role:filterRole}:{}) }
        : {};
      const [sRes, uRes] = await Promise.allSettled([
        salaryAPI.getAll(q),
        (isAdmin || isFinance) ? usersAPI.getAll({ status:'approved' }) : Promise.resolve({ data:{ data:[] } }),
      ]);
      setSalaries(sRes.value?.data?.data||[]);
      setStaff((uRes.value?.data?.data||[]).filter(u=>u.role!=='patient'));
    } catch { toast.error('Failed to load'); }
    setLoading(false);
  }, [filterMonth, filterYear, filterRole, isAdmin, isFinance]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!showGenerate || !genForm.employeeId || genForm.overrideDays) { setAttendancePreview(null); return; }
    setPreviewLoading(true);
    salaryAPI.attendancePreview(genForm.employeeId, genForm.month, genForm.year)
      .then(r => setAttendancePreview(r.data.data))
      .catch(() => setAttendancePreview(null))
      .finally(() => setPreviewLoading(false));
  }, [showGenerate, genForm.employeeId, genForm.month, genForm.year, genForm.overrideDays]);

  const handleGenerate = async () => {
    if (!genForm.employeeId) { toast.error('Select employee'); return; }
    setSaving(true);
    try {
      const payload = { ...genForm };
      if (!genForm.overrideDays) { delete payload.daysWorked; delete payload.daysAbsent; } // let backend auto-compute from attendance
      delete payload.overrideDays;
      const res = await salaryAPI.generate(payload);
      toast.success(res.data.attendanceNote ? `Salary generated! ${res.data.attendanceNote}` : 'Salary generated!');
      setShowGenerate(false);
      load();
    } catch(e) { toast.error(e.response?.data?.error || 'Failed'); }
    setSaving(false);
  };

  const handleExtraPayment = async () => {
    if (!extraPayForm.employeeId || !extraPayForm.amount || Number(extraPayForm.amount) <= 0) { toast.error('Select employee and enter a valid amount'); return; }
    setSavingExtraPay(true);
    try {
      await salaryAPI.addExtraPayment(extraPayForm);
      toast.success('✅ Extra payment added');
      setShowExtraPay(false);
      setExtraPayForm({ employeeId:'', amount:'', reason:'' });
      load();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed to add extra payment'); }
    setSavingExtraPay(false);
  };

  const handleBulkGenerate = async () => {
    if (!window.confirm(`Generate salary for ALL staff for ${MONTHS[filterMonth-1]} ${filterYear}?`)) return;
    setBulkLoading(true);
    try {
      const res = await salaryAPI.bulkGenerate({ month:filterMonth, year:filterYear });
      toast.success(`✅ Generated ${res.data.count} salary records!`);
      load();
    } catch(e) { toast.error(e.response?.data?.error || 'Failed'); }
    setBulkLoading(false);
  };

  const handleCredit = async (id, name) => {
    if (!window.confirm(`Credit salary to ${name}?`)) return;
    setCreditingId(id);
    try {
      await salaryAPI.credit(id);
      toast.success(`✅ Salary credited to ${name}!`);
      load();
      if (selSalary?._id === id) setSelSalary(p => ({ ...p, status:'credited', creditedAt:new Date() }));
    } catch(e) { toast.error(e.response?.data?.error || 'Failed'); }
    setCreditingId(null);
  };

  const credited = salaries.filter(s=>s.status==='credited').length;
  const pending  = salaries.filter(s=>s.status==='pending').length;
  const totalNet = salaries.reduce((sum,s) => sum + (s.netPay||0), 0);

  const years = Array.from({length:5},(_,i) => new Date().getFullYear()-i);

  // When a staff is selected in gen form, auto-fill base pay info
  const selStaff = staff.find(s=>s._id===genForm.employeeId);

  return (
    <div style={{ fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap'); @keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20,flexWrap:'wrap',gap:12 }}>
        <div>
          <h1 style={{ fontSize:22,fontWeight:800,color:'#0f172a',margin:0 }}>💰 {canManage ? 'Salary Management' : isAdmin ? 'Salary Register' : 'My Salary'}</h1>
          <p style={{ color:'#94a3b8',fontSize:13,marginTop:3 }}>{canManage ? 'Generate, review and credit staff salaries' : isAdmin ? 'View-only — salary crediting is managed by the Finance team' : 'Your salary history and pay slips'}</p>
        </div>
        {canManage && (
          <div style={{ display:'flex',gap:8,flexWrap:'wrap' }}>
            <button onClick={handleBulkGenerate} disabled={bulkLoading}
              style={{ padding:'9px 18px',borderRadius:12,border:'1.5px solid #059669',background:'#f0fdf4',color:'#15803d',fontFamily:'inherit',fontWeight:700,fontSize:13,cursor:'pointer',display:'flex',alignItems:'center',gap:7 }}>
              {bulkLoading?<div style={{ width:14,height:14,border:'2px solid #15803d30',borderTopColor:'#15803d',borderRadius:'50%',animation:'spin .7s linear infinite' }} />:'⚡'}
              Bulk Generate All
            </button>
            <button onClick={()=>setShowGenerate(true)}
              style={{ padding:'9px 18px',borderRadius:12,border:'none',background:'linear-gradient(135deg,#2563eb,#0ea5e9)',color:'#fff',fontFamily:'inherit',fontWeight:700,fontSize:13,cursor:'pointer',boxShadow:'0 4px 14px #2563eb40' }}>
              + Generate Salary
            </button>
            <button onClick={()=>setShowExtraPay(true)}
              style={{ padding:'9px 18px',borderRadius:12,border:'1.5px solid #d97706',background:'#fffbeb',color:'#92400e',fontFamily:'inherit',fontWeight:700,fontSize:13,cursor:'pointer' }}>
              💰 Pay Extra Amount
            </button>
          </div>
        )}
      </div>

      {/* Filters */}
      {(isAdmin || isFinance) && (
        <div style={{ display:'flex',gap:10,marginBottom:20,flexWrap:'wrap',alignItems:'center' }}>
          <select value={filterMonth} onChange={e=>setFilterMonth(Number(e.target.value))}
            style={{ padding:'9px 12px',border:'1.5px solid #e2e8f0',borderRadius:12,fontSize:13,fontFamily:'inherit',outline:'none',background:'#fff' }}>
            {MONTHS.map((m,i)=><option key={i} value={i+1}>{m}</option>)}
          </select>
          <select value={filterYear} onChange={e=>setFilterYear(Number(e.target.value))}
            style={{ padding:'9px 12px',border:'1.5px solid #e2e8f0',borderRadius:12,fontSize:13,fontFamily:'inherit',outline:'none',background:'#fff' }}>
            {years.map(y=><option key={y}>{y}</option>)}
          </select>
          <select value={filterRole} onChange={e=>setFilterRole(e.target.value)}
            style={{ padding:'9px 12px',border:'1.5px solid #e2e8f0',borderRadius:12,fontSize:13,fontFamily:'inherit',outline:'none',background:'#fff' }}>
            <option value="">All Roles</option>
            {Object.keys(ROLE_COLOR).map(r=><option key={r} value={r}>{r.charAt(0).toUpperCase()+r.slice(1)}</option>)}
          </select>
        </div>
      )}

      {/* Stats */}
      <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:12,marginBottom:20 }}>
        {[
          { icon:'👥', label:'Staff Processed',  val:salaries.length,  bg:'#eff6ff', c:'#1d4ed8' },
          { icon:'✅', label:'Credited',          val:credited,         bg:'#dcfce7', c:'#15803d' },
          { icon:'⏳', label:'Pending',           val:pending,          bg:'#fef3c7', c:'#92400e' },
          { icon:'💰', label:'Total Net Payable', val:INR(totalNet),    bg:'#f5f3ff', c:'#6d28d9', wide:true },
          { icon:'📊', label:'Avg Net Pay',       val:INR(salaries.length?Math.round(totalNet/salaries.length):0), bg:'#ecfeff', c:'#0e7490' },
        ].map((s,i)=>(
          <motion.div key={i} initial={{ opacity:0,y:10 }} animate={{ opacity:1,y:0 }} transition={{ delay:i*.06 }}
            style={{ background:'#fff',border:'1px solid #e8edf3',borderRadius:14,padding:'14px',display:'flex',alignItems:'center',gap:12,gridColumn:s.wide?'span 2':undefined }}>
            <div style={{ width:42,height:42,borderRadius:12,background:s.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,flexShrink:0 }}>{s.icon}</div>
            <div><div style={{ fontSize:s.val?.toString().startsWith('₹')?16:22,fontWeight:900,color:'#0f172a',lineHeight:1 }}>{s.val}</div><div style={{ fontSize:11,color:'#94a3b8',marginTop:2 }}>{s.label}</div></div>
          </motion.div>
        ))}
      </div>

      {/* Table */}
      <div style={{ background:'#fff',border:'1px solid #e8edf3',borderRadius:18,overflow:'hidden' }}>
        <div style={{ padding:'14px 20px',borderBottom:'1px solid #f1f5f9',fontWeight:800,fontSize:15,color:'#0f172a' }}>
          {(isAdmin || isFinance) ? `${MONTHS[filterMonth-1]} ${filterYear} — Salary Register (${salaries.length})` : `Your Full Salary History (${salaries.length})`}
        </div>
        {loading ? (
          <div style={{ padding:48,textAlign:'center' }}><div style={{ width:28,height:28,border:'3px solid #e2e8f0',borderTopColor:'#2563eb',borderRadius:'50%',animation:'spin .7s linear infinite',margin:'0 auto' }} /></div>
        ) : salaries.length===0 ? (
          <div style={{ padding:64,textAlign:'center',color:'#94a3b8' }}>
            <div style={{ fontSize:48,marginBottom:12 }}>💰</div>
            <div style={{ fontWeight:700,fontSize:16 }}>{(isAdmin || isFinance) ? `No salary records for ${MONTHS[filterMonth-1]} ${filterYear}` : 'No salary records yet'}</div>
            {canManage && <div style={{ fontSize:13,marginTop:6 }}>Click "Bulk Generate All" to create records for all staff</div>}
          </div>
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%',borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:'#f8fafc' }}>
                  {['Employee','Period','Role','Basic Pay','Gross Pay','Deductions','Net Pay','Days','Status','Actions'].map(h=>(
                    <th key={h} style={{ padding:'10px 14px',textAlign:'left',fontSize:11,fontWeight:700,color:'#94a3b8',letterSpacing:.5,textTransform:'uppercase',borderBottom:'1px solid #f1f5f9',whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {salaries.map((s,i)=>{
                  const sc = STATUS_CFG[s.status]||STATUS_CFG.pending;
                  const rc = ROLE_COLOR[s.employee?.role]||'#64748b';
                  return (
                    <motion.tr key={s._id} initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:i*.02 }}
                      style={{ borderBottom:'1px solid #f8fafc',cursor:'pointer' }}
                      onMouseEnter={e=>e.currentTarget.style.background='#fafbfc'}
                      onMouseLeave={e=>e.currentTarget.style.background='transparent'}
                      onClick={()=>setSelSalary(s)}>
                      <td style={{ padding:'12px 14px' }}>
                        <div style={{ display:'flex',alignItems:'center',gap:10 }}>
                          <div style={{ width:36,height:36,borderRadius:10,background:`linear-gradient(135deg,${rc},${rc}99)`,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:700,fontSize:13 }}>{ini(s.employee?.name)}</div>
                          <div><div style={{ fontWeight:700,color:'#0f172a',fontSize:13 }}>{s.employee?.name}</div><div style={{ fontSize:11,color:'#94a3b8' }}>{s.employee?.department||'—'}</div></div>
                        </div>
                      </td>
                      <td style={{ padding:'12px 14px' }}><span style={{ padding:'3px 9px',borderRadius:20,fontSize:11.5,fontWeight:700,background:'#eef2ff',color:'#4338ca' }}>{MONTHS[(s.month||1)-1]} {s.year}</span></td>
                      <td style={{ padding:'12px 14px' }}><span style={{ padding:'3px 9px',borderRadius:20,fontSize:11.5,fontWeight:700,background:`${rc}15`,color:rc }}>{s.employee?.role}</span></td>
                      <td style={{ padding:'12px 14px',fontSize:13,fontWeight:600,color:'#374151' }}>{INR(s.basicPay)}</td>
                      <td style={{ padding:'12px 14px',fontSize:13,fontWeight:700,color:'#0891b2' }}>{INR(s.grossPay)}</td>
                      <td style={{ padding:'12px 14px',fontSize:13,fontWeight:600,color:'#ef4444' }}>-{INR(Object.values(s.deductions||{}).reduce((a,b)=>a+b,0))}</td>
                      <td style={{ padding:'12px 14px' }}><span style={{ fontSize:14,fontWeight:900,color:'#059669' }}>{INR(s.netPay)}</span></td>
                      <td style={{ padding:'12px 14px',fontSize:12,color:'#64748b' }}>
                        <div>{s.daysWorked}d worked</div>
                        {(s.daysAbsent||0) > 0 && <div style={{color:'#dc2626',fontWeight:600}}>{s.daysAbsent}d absent{s.leaveDaysDeducted>0?` (${s.leaveDaysDeducted}d leave)`:''}</div>}
                      </td>
                      <td style={{ padding:'12px 14px' }}>
                        <span style={{ padding:'4px 10px',borderRadius:20,fontSize:11.5,fontWeight:700,background:sc.bg,color:sc.c,display:'flex',alignItems:'center',gap:5,width:'fit-content' }}>
                          <div style={{ width:6,height:6,borderRadius:'50%',background:sc.dot }} />{sc.label}
                        </span>
                      </td>
                      <td style={{ padding:'12px 14px' }} onClick={e=>e.stopPropagation()}>
                        {canManage && s.status==='pending' && (
                          <button onClick={()=>handleCredit(s._id, s.employee?.name)} disabled={creditingId===s._id}
                            style={{ padding:'6px 14px',borderRadius:9,border:'none',background:'#059669',color:'#fff',fontFamily:'inherit',fontWeight:700,fontSize:12,cursor:'pointer',display:'flex',alignItems:'center',gap:6 }}>
                            {creditingId===s._id?<div style={{ width:12,height:12,border:'2px solid rgba(255,255,255,.3)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin .7s linear infinite' }} />:null}
                            💳 Credit
                          </button>
                        )}
                        {s.status==='credited'&&<span style={{ fontSize:12,color:'#22c55e',fontWeight:700 }}>✓ Paid</span>}
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background:'#f8fafc',borderTop:'2px solid #e8edf3' }}>
                  <td colSpan={3} style={{ padding:'12px 14px',fontWeight:700,color:'#374151' }}>Totals</td>
                  <td style={{ padding:'12px 14px',fontWeight:800,color:'#0891b2',fontSize:14 }}>{INR(salaries.reduce((s,r)=>s+(r.grossPay||0),0))}</td>
                  <td style={{ padding:'12px 14px',fontWeight:800,color:'#ef4444' }}>-{INR(salaries.reduce((s,r)=>s+Object.values(r.deductions||{}).reduce((a,b)=>a+b,0),0))}</td>
                  <td style={{ padding:'12px 14px',fontWeight:900,color:'#059669',fontSize:15 }}>{INR(totalNet)}</td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Salary Detail Modal */}
      <AnimatePresence>
        {selSalary && (
          <div onClick={e=>{if(e.target===e.currentTarget)setSelSalary(null)}} style={{ position:'fixed',inset:0,background:'rgba(0,0,0,.6)',backdropFilter:'blur(5px)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16,overflowY:'auto' }}>
            <motion.div initial={{ opacity:0,y:24,scale:.96 }} animate={{ opacity:1,y:0,scale:1 }} exit={{ opacity:0,y:24,scale:.96 }}
              style={{ background:'#fff',borderRadius:24,width:'100%',maxWidth:620,boxShadow:'0 40px 100px rgba(0,0,0,.3)',overflow:'hidden' }}>
              {/* Slip header */}
              <div style={{ background:'linear-gradient(135deg,#1e3a8a,#2563eb,#0891b2)',padding:'24px 28px',position:'relative',overflow:'hidden' }}>
                <div style={{ position:'absolute',top:-30,right:-30,width:150,height:150,borderRadius:'50%',background:'rgba(255,255,255,.06)',pointerEvents:'none' }} />
                <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:4 }}>
                  <div style={{ color:'rgba(255,255,255,.7)',fontSize:12,letterSpacing:1,textTransform:'uppercase' }}>Pay Slip — {MONTHS[selSalary.month-1]} {selSalary.year}</div>
                  <button onClick={()=>setSelSalary(null)} style={{ background:'rgba(255,255,255,.2)',border:'none',borderRadius:'50%',width:28,height:28,cursor:'pointer',color:'#fff',fontSize:13,display:'flex',alignItems:'center',justifyContent:'center' }}>✕</button>
                </div>
                <div style={{ display:'flex',alignItems:'center',gap:16,marginBottom:12 }}>
                  <div style={{ width:56,height:56,borderRadius:16,background:'rgba(255,255,255,.2)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:800,fontSize:20 }}>{ini(selSalary.employee?.name)}</div>
                  <div>
                    <div style={{ color:'#fff',fontWeight:800,fontSize:19 }}>{selSalary.employee?.name}</div>
                    <div style={{ color:'rgba(255,255,255,.7)',fontSize:13 }}>{selSalary.employee?.role} · {selSalary.employee?.department||'Hospital'}</div>
                    <div style={{ color:'rgba(255,255,255,.6)',fontSize:11,marginTop:2 }}>{selSalary.employee?.email}</div>
                  </div>
                  <div style={{ marginLeft:'auto',textAlign:'right' }}>
                    <div style={{ color:'rgba(255,255,255,.6)',fontSize:11 }}>Net Pay</div>
                    <div style={{ color:'#fff',fontWeight:900,fontSize:28,fontFamily:'monospace' }}>{INR(selSalary.netPay)}</div>
                    <span style={{ padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:700,background:STATUS_CFG[selSalary.status]?.bg,color:STATUS_CFG[selSalary.status]?.c }}>{STATUS_CFG[selSalary.status]?.label}</span>
                  </div>
                </div>
                <div style={{ display:'flex',gap:10,flexWrap:'wrap' }}>
                  {[['Days Worked',selSalary.daysWorked],['Days Absent',selSalary.daysAbsent],['OT Hours',selSalary.overtimeHours],['Mode',selSalary.paymentMode?.replace('_',' ')]].map(([l,v])=>(
                    <div key={l} style={{ background:'rgba(255,255,255,.12)',borderRadius:9,padding:'6px 12px' }}>
                      <div style={{ color:'rgba(255,255,255,.5)',fontSize:9,letterSpacing:.5 }}>{l}</div>
                      <div style={{ color:'#fff',fontWeight:700,fontSize:12,textTransform:'capitalize' }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ padding:'20px 28px' }}>
                <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16 }}>
                  {/* Earnings */}
                  <div style={{ background:'#f0fdf4',borderRadius:14,padding:'14px 16px' }}>
                    <div style={{ fontWeight:800,color:'#15803d',fontSize:13,marginBottom:10,display:'flex',alignItems:'center',gap:6 }}>💚 Earnings</div>
                    {[['Basic Pay',selSalary.basicPay],['HRA',selSalary.allowances?.hra],['DA',selSalary.allowances?.da],['Travel Allowance',selSalary.allowances?.ta],['Medical Allowance',selSalary.allowances?.medical],['Special Allowance',selSalary.allowances?.special],['Overtime Pay',selSalary.overtimePay],].filter(([,v])=>v>0).map(([l,v])=>(
                      <div key={l} style={{ display:'flex',justifyContent:'space-between',padding:'4px 0',borderBottom:'1px solid #dcfce7',fontSize:13 }}>
                        <span style={{ color:'#374151' }}>{l}</span><span style={{ fontWeight:600,color:'#15803d' }}>{INR(v)}</span>
                      </div>
                    ))}
                    <div style={{ display:'flex',justifyContent:'space-between',padding:'8px 0 0',fontSize:14,fontWeight:800,color:'#059669' }}>
                      <span>Gross Pay</span><span>{INR(selSalary.grossPay)}</span>
                    </div>
                  </div>
                  {/* Deductions */}
                  <div style={{ background:'#fef2f2',borderRadius:14,padding:'14px 16px' }}>
                    <div style={{ fontWeight:800,color:'#dc2626',fontSize:13,marginBottom:10,display:'flex',alignItems:'center',gap:6 }}>❤️ Deductions</div>
                    {[['Provident Fund',selSalary.deductions?.pf],['ESI',selSalary.deductions?.esi],['TDS (Tax)',selSalary.deductions?.tax],['Absent Deduction',selSalary.deductions?.absent],['Loan Recovery',selSalary.deductions?.loan],['Other',selSalary.deductions?.other]].filter(([,v])=>v>0).map(([l,v])=>(
                      <div key={l} style={{ display:'flex',justifyContent:'space-between',padding:'4px 0',borderBottom:'1px solid #fecaca',fontSize:13 }}>
                        <span style={{ color:'#374151' }}>{l}</span><span style={{ fontWeight:600,color:'#dc2626' }}>-{INR(v)}</span>
                      </div>
                    ))}
                    <div style={{ display:'flex',justifyContent:'space-between',padding:'8px 0 0',fontSize:14,fontWeight:800,color:'#dc2626' }}>
                      <span>Total Deductions</span><span>-{INR(Object.values(selSalary.deductions||{}).reduce((a,b)=>a+b,0))}</span>
                    </div>
                  </div>
                </div>

                {/* Net Pay */}
                <div style={{ background:'linear-gradient(135deg,#eff6ff,#e0f2fe)',border:'1.5px solid #bfdbfe',borderRadius:14,padding:'16px 20px',display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16 }}>
                  <div><div style={{ fontWeight:800,color:'#1e40af',fontSize:16 }}>💰 Net Pay (Take Home)</div><div style={{ fontSize:12,color:'#3b82f6',marginTop:2 }}>{selSalary.paymentMode?.replace('_',' ')} · {MONTHS[selSalary.month-1]} {selSalary.year}</div></div>
                  <div style={{ fontSize:28,fontWeight:900,color:'#1e40af',fontFamily:'monospace' }}>{INR(selSalary.netPay)}</div>
                </div>

                {selSalary.remarks && <div style={{ background:'#f8fafc',borderRadius:10,padding:'10px 14px',fontSize:13,color:'#64748b',marginBottom:12 }}>📝 {selSalary.remarks}</div>}

                {selSalary.extraPayments?.length > 0 && (
                  <div style={{ background:'#fffbeb',border:'1px solid #fde68a',borderRadius:12,padding:'12px 16px',marginBottom:16 }}>
                    <div style={{ fontWeight:800,color:'#92400e',fontSize:13,marginBottom:8 }}>💰 Extra Payments This Month</div>
                    {selSalary.extraPayments.map((ep,i)=>(
                      <div key={i} style={{ display:'flex',justifyContent:'space-between',padding:'4px 0',fontSize:12.5 }}>
                        <span style={{ color:'#78350f' }}>{ep.reason} · {new Date(ep.addedAt).toLocaleDateString('en-IN')}</span>
                        <span style={{ fontWeight:700,color:'#92400e' }}>+{INR(ep.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {selSalary.creditedAt && <div style={{ fontSize:12,color:'#94a3b8',textAlign:'center',marginBottom:12 }}>Credited on {new Date(selSalary.creditedAt).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'})}</div>}

                <div style={{ display:'flex',gap:10 }}>
                  {canManage && selSalary.status==='pending' && (
                    <button onClick={()=>handleCredit(selSalary._id, selSalary.employee?.name)} disabled={!!creditingId}
                      style={{ flex:2,padding:'12px',borderRadius:12,border:'none',background:'linear-gradient(135deg,#059669,#34d399)',color:'#fff',fontFamily:'inherit',fontWeight:800,cursor:'pointer',fontSize:14,display:'flex',alignItems:'center',justifyContent:'center',gap:8 }}>
                      💳 Credit Salary to {selSalary.employee?.name?.split(' ')[0]}
                    </button>
                  )}
                  <button onClick={()=>setSelSalary(null)} style={{ flex:1,padding:'12px',borderRadius:12,border:'1.5px solid #e2e8f0',background:'#fff',fontFamily:'inherit',fontWeight:700,cursor:'pointer' }}>Close</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Generate Modal */}
      <AnimatePresence>
        {showGenerate && (
          <div onClick={e=>{if(e.target===e.currentTarget)setShowGenerate(false)}} style={{ position:'fixed',inset:0,background:'rgba(0,0,0,.6)',backdropFilter:'blur(4px)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16,overflowY:'auto' }}>
            <motion.div initial={{ opacity:0,y:22,scale:.96 }} animate={{ opacity:1,y:0,scale:1 }} exit={{ opacity:0,y:22,scale:.96 }}
              style={{ background:'#fff',borderRadius:24,width:'100%',maxWidth:540,boxShadow:'0 32px 80px rgba(0,0,0,.25)',overflow:'hidden' }}>
              <div style={{ background:'linear-gradient(135deg,#1e3a8a,#2563eb)',padding:'18px 24px' }}>
                <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between' }}>
                  <h2 style={{ color:'#fff',fontWeight:800,fontSize:18,margin:0 }}>💰 Generate Salary</h2>
                  <button onClick={()=>setShowGenerate(false)} style={{ background:'rgba(255,255,255,.2)',border:'none',borderRadius:'50%',width:28,height:28,cursor:'pointer',color:'#fff',fontSize:13,display:'flex',alignItems:'center',justifyContent:'center' }}>✕</button>
                </div>
              </div>
              <div style={{ padding:'22px 24px' }}>
                <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12 }}>
                  <div style={{ gridColumn:'1/-1' }}>
                    <label style={{ display:'block',fontSize:11,fontWeight:700,color:'#374151',letterSpacing:.5,textTransform:'uppercase',marginBottom:5 }}>Employee *</label>
                    <select value={genForm.employeeId} onChange={e=>setGenForm(f=>({...f,employeeId:e.target.value}))}
                      style={{ width:'100%',padding:'10px 12px',border:'1.5px solid #e2e8f0',borderRadius:10,fontFamily:'inherit',fontSize:13.5,outline:'none',background:'#fff',boxSizing:'border-box' }}>
                      <option value="">Select employee…</option>
                      {staff.map(s=><option key={s._id} value={s._id}>{s.name} ({s.role}) — Base: {INR(BASE_PAY[s.role]||30000)}</option>)}
                    </select>
                  </div>
                  {[['Month','month','select_month'],['Year','year','select_year'],['Overtime Hours','overtimeHours','number'],['Bonus (₹)','bonus','number'],['Loan Recovery (₹)','loan','number'],['Other Deduction (₹)','otherDed','number']].map(([l,k,t])=>(
                    <div key={k}>
                      <label style={{ display:'block',fontSize:11,fontWeight:700,color:'#374151',letterSpacing:.5,textTransform:'uppercase',marginBottom:5 }}>{l}</label>
                      {t==='select_month'?<select value={genForm.month} onChange={e=>setGenForm(f=>({...f,month:Number(e.target.value)}))} style={{ width:'100%',padding:'10px 12px',border:'1.5px solid #e2e8f0',borderRadius:10,fontFamily:'inherit',fontSize:13.5,outline:'none',background:'#fff',boxSizing:'border-box' }}>
                        {MONTHS.map((m,i)=><option key={i} value={i+1}>{m}</option>)}
                      </select>:t==='select_year'?<select value={genForm.year} onChange={e=>setGenForm(f=>({...f,year:Number(e.target.value)}))} style={{ width:'100%',padding:'10px 12px',border:'1.5px solid #e2e8f0',borderRadius:10,fontFamily:'inherit',fontSize:13.5,outline:'none',background:'#fff',boxSizing:'border-box' }}>
                        {years.map(y=><option key={y}>{y}</option>)}
                      </select>:<input type="number" min={0} value={genForm[k]} onChange={e=>setGenForm(f=>({...f,[k]:Number(e.target.value)}))} style={{ width:'100%',padding:'10px 12px',border:'1.5px solid #e2e8f0',borderRadius:10,fontFamily:'inherit',fontSize:13.5,outline:'none',boxSizing:'border-box' }} />}
                    </div>
                  ))}
                  <div style={{ gridColumn:'1/-1', background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:10, padding:'12px 14px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                      <span style={{ fontSize:12, fontWeight:700, color:'#1d4ed8' }}>📅 Working Days (from Attendance)</span>
                      <label style={{ display:'flex', alignItems:'center', gap:5, fontSize:11.5, fontWeight:600, color:'#374151', cursor:'pointer' }}>
                        <input type="checkbox" checked={genForm.overrideDays} onChange={e=>setGenForm(f=>({...f,overrideDays:e.target.checked}))} /> Override manually
                      </label>
                    </div>
                    {!genForm.overrideDays ? (
                      !genForm.employeeId ? (
                        <div style={{ fontSize:12, color:'#94a3b8' }}>Select an employee to see their attendance for this month</div>
                      ) : previewLoading ? (
                        <div style={{ fontSize:12, color:'#94a3b8' }}>Loading attendance…</div>
                      ) : attendancePreview ? (
                        <div style={{ fontSize:12.5, color:'#1e3a8a' }}>
                          ✅ <strong>{attendancePreview.daysWorked}</strong> days worked, <strong style={{ color: attendancePreview.daysAbsent>0?'#dc2626':'#1e3a8a' }}>{attendancePreview.daysAbsent}</strong> absent, {attendancePreview.daysOnLeave} on approved leave (of {attendancePreview.workingDaysCounted} working days this month). Pay will only reflect actual days worked.
                        </div>
                      ) : <div style={{ fontSize:12, color:'#94a3b8' }}>No attendance data found — will default to 0 worked days unless you override.</div>
                    ) : (
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                        <div>
                          <label style={{ display:'block',fontSize:10.5,fontWeight:700,color:'#64748b',marginBottom:4 }}>Days Worked</label>
                          <input type="number" min={0} value={genForm.daysWorked} onChange={e=>setGenForm(f=>({...f,daysWorked:Number(e.target.value)}))} style={{ width:'100%',padding:'8px 10px',border:'1.5px solid #e2e8f0',borderRadius:8,fontFamily:'inherit',fontSize:13,outline:'none',boxSizing:'border-box' }} />
                        </div>
                        <div>
                          <label style={{ display:'block',fontSize:10.5,fontWeight:700,color:'#64748b',marginBottom:4 }}>Days Absent</label>
                          <input type="number" min={0} value={genForm.daysAbsent} onChange={e=>setGenForm(f=>({...f,daysAbsent:Number(e.target.value)}))} style={{ width:'100%',padding:'8px 10px',border:'1.5px solid #e2e8f0',borderRadius:8,fontFamily:'inherit',fontSize:13,outline:'none',boxSizing:'border-box' }} />
                        </div>
                      </div>
                    )}
                  </div>
                  <div>
                    <label style={{ display:'block',fontSize:11,fontWeight:700,color:'#374151',letterSpacing:.5,textTransform:'uppercase',marginBottom:5 }}>Payment Mode</label>
                    <select value={genForm.paymentMode} onChange={e=>setGenForm(f=>({...f,paymentMode:e.target.value}))} style={{ width:'100%',padding:'10px 12px',border:'1.5px solid #e2e8f0',borderRadius:10,fontFamily:'inherit',fontSize:13.5,outline:'none',background:'#fff',boxSizing:'border-box' }}>
                      <option value="bank_transfer">Bank Transfer</option>
                      <option value="cheque">Cheque</option>
                      <option value="cash">Cash</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display:'block',fontSize:11,fontWeight:700,color:'#374151',letterSpacing:.5,textTransform:'uppercase',marginBottom:5 }}>Bank Account</label>
                    <input value={genForm.bankAccount} onChange={e=>setGenForm(f=>({...f,bankAccount:e.target.value}))} placeholder="XXXX XXXX XXXX" style={{ width:'100%',padding:'10px 12px',border:'1.5px solid #e2e8f0',borderRadius:10,fontFamily:'inherit',fontSize:13.5,outline:'none',boxSizing:'border-box' }} />
                  </div>
                  <div style={{ gridColumn:'1/-1' }}>
                    <label style={{ display:'block',fontSize:11,fontWeight:700,color:'#374151',letterSpacing:.5,textTransform:'uppercase',marginBottom:5 }}>Remarks</label>
                    <input value={genForm.remarks} onChange={e=>setGenForm(f=>({...f,remarks:e.target.value}))} placeholder="Optional notes…" style={{ width:'100%',padding:'10px 12px',border:'1.5px solid #e2e8f0',borderRadius:10,fontFamily:'inherit',fontSize:13.5,outline:'none',boxSizing:'border-box' }} />
                  </div>
                </div>

                {/* Preview if employee selected */}
                {selStaff && (
                  <div style={{ background:'#f0f9ff',border:'1px solid #bae6fd',borderRadius:12,padding:'12px 14px',marginTop:14,fontSize:13 }}>
                    <div style={{ fontWeight:700,color:'#0369a1',marginBottom:4 }}>💡 Salary Preview for {selStaff.name}</div>
                    <div style={{ color:'#64748b' }}>Base: {INR(BASE_PAY[selStaff.role]||30000)} · Estimated Net ≈ {INR(Math.round((BASE_PAY[selStaff.role]||30000)*0.72))}</div>
                  </div>
                )}

                <div style={{ display:'flex',gap:10,marginTop:18 }}>
                  <button onClick={()=>setShowGenerate(false)} style={{ flex:1,padding:'12px',borderRadius:12,border:'1.5px solid #e2e8f0',background:'#fff',fontFamily:'inherit',fontWeight:700,cursor:'pointer' }}>Cancel</button>
                  <button onClick={handleGenerate} disabled={saving} style={{ flex:2,padding:'12px',borderRadius:12,border:'none',background:'linear-gradient(135deg,#2563eb,#0ea5e9)',color:'#fff',fontFamily:'inherit',fontWeight:800,cursor:'pointer',fontSize:14,display:'flex',alignItems:'center',justifyContent:'center',gap:8 }}>
                    {saving?<><div style={{ width:15,height:15,border:'2px solid rgba(255,255,255,.3)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin .7s linear infinite' }} />Generating…</>:'💰 Generate Salary'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showExtraPay && (
          <div style={{ position:'fixed',inset:0,background:'rgba(15,23,42,.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:100,padding:20 }} onClick={e=>{if(e.target===e.currentTarget)setShowExtraPay(false);}}>
            <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} style={{ background:'#fff',borderRadius:18,maxWidth:440,width:'100%',maxHeight:'85vh',overflowY:'auto' }}>
              <div style={{ padding:'20px 24px',borderBottom:'1px solid #f1f5f9',display:'flex',justifyContent:'space-between',alignItems:'center' }}>
                <span style={{ fontWeight:800,fontSize:16 }}>💰 Pay Extra Amount</span>
                <button onClick={()=>setShowExtraPay(false)} style={{ background:'none',border:'none',fontSize:18,cursor:'pointer',color:'#94a3b8' }}>✕</button>
              </div>
              <div style={{ padding:'22px 24px' }}>
                <div style={{ background:'#fffbeb',border:'1px solid #fde68a',borderRadius:10,padding:'10px 14px',marginBottom:16,fontSize:12.5,color:'#92400e' }}>
                  Use this for a bonus, arrears, reimbursement, or festival advance — added on top of this month's salary immediately, independent of the regular generate/credit cycle.
                </div>
                <div style={{ marginBottom:12 }}>
                  <label style={{ display:'block',fontSize:11,fontWeight:700,color:'#374151',letterSpacing:.5,textTransform:'uppercase',marginBottom:5 }}>Employee *</label>
                  <select value={extraPayForm.employeeId} onChange={e=>setExtraPayForm(f=>({...f,employeeId:e.target.value}))}
                    style={{ width:'100%',padding:'10px 12px',border:'1.5px solid #e2e8f0',borderRadius:10,fontFamily:'inherit',fontSize:13.5,outline:'none',background:'#fff',boxSizing:'border-box' }}>
                    <option value="">Select employee…</option>
                    {staff.map(s=><option key={s._id} value={s._id}>{s.name} ({s.role})</option>)}
                  </select>
                </div>
                <div style={{ marginBottom:12 }}>
                  <label style={{ display:'block',fontSize:11,fontWeight:700,color:'#374151',letterSpacing:.5,textTransform:'uppercase',marginBottom:5 }}>Amount (₹) *</label>
                  <input type="number" min={0} value={extraPayForm.amount} onChange={e=>setExtraPayForm(f=>({...f,amount:e.target.value}))} style={{ width:'100%',padding:'10px 12px',border:'1.5px solid #e2e8f0',borderRadius:10,fontFamily:'inherit',fontSize:13.5,outline:'none',boxSizing:'border-box' }} />
                </div>
                <div>
                  <label style={{ display:'block',fontSize:11,fontWeight:700,color:'#374151',letterSpacing:.5,textTransform:'uppercase',marginBottom:5 }}>Reason</label>
                  <input value={extraPayForm.reason} onChange={e=>setExtraPayForm(f=>({...f,reason:e.target.value}))} placeholder="e.g. Diwali bonus, on-call arrears…" style={{ width:'100%',padding:'10px 12px',border:'1.5px solid #e2e8f0',borderRadius:10,fontFamily:'inherit',fontSize:13.5,outline:'none',boxSizing:'border-box' }} />
                </div>
                <div style={{ display:'flex',gap:10,marginTop:18 }}>
                  <button onClick={()=>setShowExtraPay(false)} style={{ flex:1,padding:'12px',borderRadius:12,border:'1.5px solid #e2e8f0',background:'#fff',fontFamily:'inherit',fontWeight:700,cursor:'pointer' }}>Cancel</button>
                  <button onClick={handleExtraPayment} disabled={savingExtraPay} style={{ flex:2,padding:'12px',borderRadius:12,border:'none',background:'linear-gradient(135deg,#d97706,#f59e0b)',color:'#fff',fontFamily:'inherit',fontWeight:800,cursor:'pointer',fontSize:14 }}>
                    {savingExtraPay?'Paying…':'💰 Pay Now'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
