import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { salaryAPI, usersAPI, insuranceAPI, expenseAPI, budgetAPI, paymentsAPI } from '../utils/api';
import { Line, Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import api from '../utils/api';
import { StaffExtraTools, MyActivityWidget } from '../components/DashboardWidgets';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend, Filler);


const MO=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const INR=v=>`₹${Number(v||0).toLocaleString('en-IN')}`;
const RC={admin:'#6366f1',doctor:'#0891b2',nurse:'#db2777',pharmacist:'#d97706',wardboy:'#059669',sweeper:'#f59e0b',otboy:'#ef4444',finance:'#8b5cf6',electrician:'#f59e0b',plumber:'#0891b2',it_technician:'#6366f1',equipment_tech:'#8b5cf6',biomedical:'#059669',security:'#374151',receptionist:'#db2777',ambulance_driver:'#dc2626',lab_technician:'#0d9488',radiology_tech:'#0e7490',dialysis_tech:'#be123c'};
const BASE_PAY={admin:80000,doctor:120000,nurse:45000,pharmacist:50000,wardboy:25000,sweeper:20000,otboy:28000,finance:65000,electrician:30000,plumber:28000,it_technician:40000,equipment_tech:35000,biomedical:55000,security:22000,receptionist:28000,ambulance_driver:25000,lab_technician:42000,radiology_tech:38000,dialysis_tech:38000};
const STATUS={pending:{bg:'#fef3c7',c:'#92400e',dot:'#f59e0b'},credited:{bg:'#dcfce7',c:'#15803d',dot:'#22c55e'},held:{bg:'#fee2e2',c:'#dc2626',dot:'#ef4444'},failed:{bg:'#fee2e2',c:'#b91c1c',dot:'#dc2626'}};
const ini=n=>n?.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()||'?';
const years=Array.from({length:5},(_,i)=>new Date().getFullYear()-i);
const CATS={payroll:{l:'Payroll',c:'#6366f1',i:'💰'},utilities:{l:'Utilities',c:'#0891b2',i:'💡'},maintenance:{l:'Maintenance',c:'#f59e0b',i:'🔧'},supplies:{l:'Supplies',c:'#059669',i:'📦'},equipment:{l:'Equipment',c:'#8b5cf6',i:'🩺'},rent:{l:'Rent',c:'#db2777',i:'🏢'},marketing:{l:'Marketing',c:'#ef4444',i:'📣'},administrative:{l:'Administrative',c:'#64748b',i:'🗂️'},pharmacy_stock:{l:'Pharmacy Stock',c:'#0d9488',i:'💊'},other:{l:'Other',c:'#94a3b8',i:'📎'}};
const EXP_CATS=Object.keys(CATS).filter(k=>k!=='payroll');

export default function FinanceDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab,setTab]=useState('overview');
  const [salaries,setSalaries]=useState([]);
  const [payments,setPayments]=useState([]);
  const [staff,setStaff]=useState([]);
  const [loading,setLoading]=useState(true);
  const [selMonth,setSelMonth]=useState(new Date().getMonth()+1);
  const [selYear,setSelYear]=useState(new Date().getFullYear());
  const [selSalary,setSelSalary]=useState(null);
  const [showGen,setShowGen]=useState(false);
  const [genAll,setGenAll]=useState(false);
  const [creditingId,setCreditingId]=useState(null);
  const [bulkLoad,setBulkLoad]=useState(false);
  const [saving,setSaving]=useState(false);
  const [editId,setEditId]=useState(null);
  const [editForm,setEditForm]=useState({});
  const [payModal,setPayModal]=useState(null); // salary record being paid manually
  const [payMode,setPayMode]=useState('cash');
  const [payRef,setPayRef]=useState('');
  const [payeeName,setPayeeName]=useState('');
  const [chequeBankName,setChequeBankName]=useState('');
  const [chequeBranch,setChequeBranch]=useState('');
  const [chequeDate,setChequeDate]=useState('');
  const [payNotes,setPayNotes]=useState('');
  const [paying,setPaying]=useState(false);
  const [claims,setClaims]=useState([]);
  const [claimsLoading,setClaimsLoading]=useState(false);
  const [claimsFilter,setClaimsFilter]=useState('');
  const [reviewClaim,setReviewClaim]=useState(null); // claim being reviewed
  const [reviewDecision,setReviewDecision]=useState('approved');
  const [reviewAmount,setReviewAmount]=useState('');
  const [reviewNotes,setReviewNotes]=useState('');
  const [reviewing,setReviewing]=useState(false);
  const [payingClaimId,setPayingClaimId]=useState(null);

  // Expenses
  const [expenses,setExpenses]=useState([]);
  const [expensesLoading,setExpensesLoading]=useState(false);
  const [expModal,setExpModal]=useState(null); // null=closed, {}=new, {...expense}=edit
  const [expForm,setExpForm]=useState({});
  const [savingExp,setSavingExp]=useState(false);

  // Budgets
  const [budgets,setBudgets]=useState([]);
  const [budgetSummary,setBudgetSummary]=useState([]);
  const [budgetsLoading,setBudgetsLoading]=useState(false);
  const [budgetModal,setBudgetModal]=useState(null); // category being edited
  const [budgetAmount,setBudgetAmount]=useState('');
  const [budgetNotes,setBudgetNotes]=useState('');
  const [savingBudget,setSavingBudget]=useState(false);

  // Manual invoices
  const [invoiceModal,setInvoiceModal]=useState(false);
  const [invForm,setInvForm]=useState({patientId:'',amount:'',method:'cash',description:'',notes:''});
  const [savingInvoice,setSavingInvoice]=useState(false);
  const [patients,setPatients]=useState([]);
  const [viewInvoice,setViewInvoice]=useState(null);
  const [genForm,setGenForm]=useState({employeeId:'',month:new Date().getMonth()+1,year:new Date().getFullYear(),daysWorked:26,daysAbsent:0,overtimeHours:0,bonus:0,loan:0,otherDed:0,paymentMode:'bank_transfer',bankAccount:'',remarks:''});

  const load=useCallback(async()=>{
    setLoading(true);
    try{
      const [sRes,uRes,pRes]=await Promise.all([
        salaryAPI.getAll({month:selMonth,year:selYear}),
        usersAPI.getAll({status:'approved'}),
        api.get('/payments',{params:{}}),
      ]);
      setSalaries(sRes.data.data||[]);
      setStaff((uRes.data.data||[]).filter(u=>u.role!=='patient'));
      setPayments(pRes.data.data||[]);
    }catch{toast.error('Failed to load');}
    setLoading(false);
  },[selMonth,selYear]);

  useEffect(()=>{load();},[load]);

  const loadClaims=useCallback(async()=>{
    setClaimsLoading(true);
    try{
      const res=await insuranceAPI.getAllClaims(claimsFilter?{status:claimsFilter}:{});
      setClaims(res.data.data||[]);
    }catch{toast.error('Failed to load insurance claims');}
    setClaimsLoading(false);
  },[claimsFilter]);
  useEffect(()=>{loadClaims();},[loadClaims]);

  const openReview=(claim)=>{setReviewClaim(claim);setReviewDecision('approved');setReviewAmount(claim.claimAmount);setReviewNotes('');};
  const submitReview=async(e)=>{
    e.preventDefault();
    if(reviewDecision==='approved'&&(!reviewAmount||Number(reviewAmount)<=0)){toast.error('Enter a valid approved amount');return;}
    setReviewing(true);
    try{
      await insuranceAPI.reviewClaim(reviewClaim._id,reviewDecision,reviewDecision==='approved'?reviewAmount:undefined,reviewNotes);
      toast.success(`Claim ${reviewDecision==='approved'?'approved':reviewDecision==='rejected'?'rejected':'moved to review'}`);
      setReviewClaim(null);
      loadClaims();
    }catch(e){toast.error(e.response?.data?.error||'Failed to review claim');}
    setReviewing(false);
  };
  const markClaimPaid=async(id)=>{
    setPayingClaimId(id);
    try{await insuranceAPI.markClaimPaid(id);toast.success('✅ Claim marked as paid out');loadClaims();}
    catch(e){toast.error(e.response?.data?.error||'Failed to mark as paid');}
    setPayingClaimId(null);
  };
  const CLAIM_STATUS={submitted:{bg:'#eff6ff',c:'#1d4ed8',l:'Submitted'},under_review:{bg:'#fffbeb',c:'#92400e',l:'Under Review'},approved:{bg:'#dcfce7',c:'#15803d',l:'Approved'},rejected:{bg:'#fef2f2',c:'#dc2626',l:'Rejected'},paid:{bg:'#f0fdf4',c:'#059669',l:'Paid Out'}};
  const pendingClaimsCount=claims.filter(c=>['submitted','under_review'].includes(c.status)).length;

  // ── Expenses ─────────────────────────────────────────────────────────
  const loadExpenses=useCallback(async()=>{
    setExpensesLoading(true);
    try{const res=await expenseAPI.getAll({month:selMonth,year:selYear});setExpenses(res.data.data||[]);}
    catch{toast.error('Failed to load expenses');}
    setExpensesLoading(false);
  },[selMonth,selYear]);
  useEffect(()=>{loadExpenses();},[loadExpenses]);

  const openAddExpense=()=>{setExpForm({category:'supplies',description:'',amount:'',vendor:'',department:'',expenseDate:new Date().toISOString().slice(0,10),paymentMode:'cash',receiptNumber:'',chequeNumber:'',chequeBankName:'',chequeBranch:'',chequeDate:'',notes:''});setExpModal({});};
  const openEditExpense=(e)=>{setExpForm({...e,expenseDate:e.expenseDate?.slice(0,10),chequeDate:e.chequeDate?.slice(0,10)||''});setExpModal(e);};
  const submitExpense=async(ev)=>{
    ev.preventDefault();
    if(!expForm.description?.trim()||!expForm.amount){toast.error('Description and amount are required');return;}
    if(expForm.paymentMode==='cash'&&!expForm.receiptNumber?.trim()){toast.error('Receipt number is required for a cash expense');return;}
    if(expForm.paymentMode==='cheque'&&(!expForm.chequeNumber?.trim()||!expForm.chequeBankName?.trim()||!expForm.chequeDate)){toast.error('Cheque number, bank name, and cheque date are required');return;}
    setSavingExp(true);
    try{
      if(expModal._id) await expenseAPI.update(expModal._id,expForm);
      else await expenseAPI.create(expForm);
      toast.success(expModal._id?'✅ Expense updated':'✅ Expense recorded');
      setExpModal(null);loadExpenses();
    }catch(e){toast.error(e.response?.data?.error||'Failed to save expense');}
    setSavingExp(false);
  };
  const deleteExpense=async(id)=>{
    if(!window.confirm('Delete this expense record?'))return;
    try{await expenseAPI.remove(id);toast.success('Expense deleted');loadExpenses();}
    catch(e){toast.error(e.response?.data?.error||'Failed to delete');}
  };
  const totalExpenses=expenses.reduce((t,e)=>t+(e.amount||0),0);
  const expensesByCat=EXP_CATS.map(cat=>({cat,total:expenses.filter(e=>e.category===cat).reduce((t,e)=>t+e.amount,0)})).filter(x=>x.total>0);

  // ── Budgets ──────────────────────────────────────────────────────────
  const loadBudgets=useCallback(async()=>{
    setBudgetsLoading(true);
    try{
      const res=await budgetAPI.getSummary(selMonth,selYear);
      setBudgetSummary(res.data.data||[]);
    }catch{toast.error('Failed to load budgets');}
    setBudgetsLoading(false);
  },[selMonth,selYear]);
  useEffect(()=>{loadBudgets();},[loadBudgets]);

  const openBudget=(cat,existingAmount)=>{setBudgetModal(cat);setBudgetAmount(existingAmount||'');setBudgetNotes('');};
  const submitBudget=async(e)=>{
    e.preventDefault();
    if(budgetAmount===''||Number(budgetAmount)<0){toast.error('Enter a valid allocation amount');return;}
    setSavingBudget(true);
    try{
      await budgetAPI.upsert({category:budgetModal,month:selMonth,year:selYear,allocatedAmount:Number(budgetAmount),notes:budgetNotes});
      toast.success('✅ Budget saved');
      setBudgetModal(null);loadBudgets();
    }catch(e){toast.error(e.response?.data?.error||'Failed to save budget');}
    setSavingBudget(false);
  };

  // ── Manual Invoices ──────────────────────────────────────────────────
  const openInvoiceModal=async()=>{
    setInvForm({patientId:'',amount:'',method:'cash',description:'',notes:''});
    setInvoiceModal(true);
    if(patients.length===0){
      try{const res=await usersAPI.getAll({role:'patient',status:'approved',limit:300});setPatients(res.data.data||[]);}
      catch{ /* non-critical */ }
    }
  };
  const submitInvoice=async(e)=>{
    e.preventDefault();
    if(!invForm.patientId||!invForm.amount||!invForm.description.trim()){toast.error('Patient, amount, and description are required');return;}
    setSavingInvoice(true);
    try{
      const res=await paymentsAPI.createManualInvoice(invForm);
      toast.success(res.data.message||'✅ Invoice created');
      setInvoiceModal(false);load();
    }catch(e){toast.error(e.response?.data?.error||'Failed to create invoice');}
    setSavingInvoice(false);
  };

  const handleCredit=async(id,name)=>{
    if(!window.confirm(`Credit salary to ${name}?`))return;
    setCreditingId(id);
    try{await salaryAPI.credit(id);toast.success(`✅ Salary credited to ${name}!`);load();}
    catch(e){toast.error(e.response?.data?.error||'Failed');}
    setCreditingId(null);
  };

  const handleCreditAll=async()=>{
    const pend=salaries.filter(s=>s.status==='pending');
    if(!pend.length){toast('No pending salaries');return;}
    if(!window.confirm(`Credit ALL ${pend.length} pending salaries?`))return;
    setBulkLoad(true);
    let ok=0,failed=0;
    for(const s of pend){try{await salaryAPI.credit(s._id);ok++;}catch{failed++;}}
    if(failed>0) toast.error(`⚠️ ${failed} payment(s) on hold — invalid/missing bank details. Employee(s) notified by email.`);
    if(ok>0) toast.success(`✅ ${ok} salaries credited!`);
    load();setBulkLoad(false);
  };

  const handleGen=async()=>{
    setSaving(true);
    try{
      if(genAll){const r=await salaryAPI.bulkGenerate({month:genForm.month,year:genForm.year});toast.success(`✅ Generated ${r.data.count} records!`);}
      else{if(!genForm.employeeId){toast.error('Select employee');setSaving(false);return;}await salaryAPI.generate(genForm);toast.success('Salary generated!');}
      setShowGen(false);setGenAll(false);
      setGenForm(f=>({...f,employeeId:'',daysWorked:26,daysAbsent:0,overtimeHours:0,bonus:0,loan:0,otherDed:0,remarks:''}));
      load();
    }catch(e){toast.error(e.response?.data?.error||'Failed');}
    setSaving(false);
  };

  const handleSaveEdit=async()=>{
    setSaving(true);
    try{
      const b=editForm.basicPay||0;
      const hra=Math.round(b*.4),da=Math.round(b*.12),ta=Math.round(b*.05),med=Math.round(b*.03),spl=Math.round(b*.05);
      const otP=Math.round((b/26/8)*1.5*(editForm.overtimeHours||0));
      const gross=b+hra+da+ta+med+spl+otP+(editForm.bonus||0);
      const pf=Math.round(b*.12),esi=Math.round(gross*.0175),tax=Math.round(gross*.1);
      const absent=Math.round((b/26)*(editForm.daysAbsent||0));
      const net=gross-pf-esi-tax-absent-(editForm.loan||0)-(editForm.otherDed||0);
      await salaryAPI.update(editId,{...editForm,allowances:{hra,da,ta,medical:med,special:spl},deductions:{pf,esi,tax,absent,loan:editForm.loan||0,other:editForm.otherDed||0},grossPay:gross,netPay:net,overtimePay:otP});
      toast.success('Updated!');setEditId(null);load();
    }catch(e){toast.error(e.response?.data?.error||'Failed');}
    setSaving(false);
  };

  const openPayModal=(s)=>{setPayModal(s);setPayMode('cash');setPayRef('');setPayeeName('');setChequeBankName('');setChequeBranch('');setChequeDate('');setPayNotes('');};
  const submitManualPay=async(e)=>{
    e.preventDefault();
    if(payMode==='cash'&&!payRef.trim()){toast.error('Receipt number is required for a cash payment');return;}
    if(payMode==='cheque'){
      if(!payRef.trim()){toast.error('Cheque number is required');return;}
      if(!chequeBankName.trim()){toast.error('Bank name is required for a cheque payment');return;}
      if(!chequeDate){toast.error('Cheque date is required');return;}
    }
    setPaying(true);
    try{
      await salaryAPI.credit(payModal._id,{
        paymentMode:payMode, manualReference:payRef, manualNotes:payNotes,
        receiptNumber: payMode==='cash'?payRef:undefined,
        chequeNumber: payMode==='cheque'?payRef:undefined,
        chequeBankName: payMode==='cheque'?chequeBankName:undefined,
        chequeBranch: payMode==='cheque'?chequeBranch:undefined,
        chequeDate: payMode==='cheque'?chequeDate:undefined,
        payeeName,
      });
      toast.success(`✅ Marked as paid via ${payMode}!`);
      setPayModal(null);setSelSalary(null);
      load();
    }catch(e){toast.error(e.response?.data?.error||'Failed to record manual payment');}
    setPaying(false);
  };

  const downloadCSV=(rows,headers,filename)=>{
    const esc=v=>`"${String(v??'').replace(/"/g,'""')}"`;
    const csv=[headers.map(h=>esc(h[0])).join(','),...rows.map(r=>headers.map(h=>esc(h[1](r))).join(','))].join('\r\n');
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download=filename;a.click();URL.revokeObjectURL(url);
  };
  const exportPayroll=()=>downloadCSV(salaries,[
    ['Employee',s=>s.employee?.name],['Role',s=>s.employee?.role],['Month',s=>MO[(s.month||1)-1]],['Year',s=>s.year],
    ['Basic',s=>s.basicPay],['Gross',s=>s.grossPay],['Net Pay',s=>s.netPay],['Status',s=>s.status],
    ['Payment Mode',s=>s.paymentMode],['Transaction Ref',s=>s.transactionRef],
  ],`payroll_${MO[selMonth-1]}_${selYear}.csv`);
  const exportTransactions=()=>downloadCSV(payments,[
    ['Receipt',p=>p.receiptNo],['Patient',p=>p.user?.name],['Type',p=>p.type],['Amount',p=>p.amount],
    ['Method',p=>p.method],['Status',p=>p.status],['Date',p=>p.paidAt||p.createdAt],
  ],`transactions_${new Date().toISOString().slice(0,10)}.csv`);

  const manualPayments = salaries.filter(s=>s.status==='credited'&&(s.paymentMode==='cash'||s.paymentMode==='cheque'));
  const failedSalaries = salaries.filter(s=>s.status==='failed');
  const credited=salaries.filter(s=>s.status==='credited');
  const pending=salaries.filter(s=>s.status==='pending');
  const totalNet=salaries.reduce((t,s)=>t+(s.netPay||0),0);
  const totalGross=salaries.reduce((t,s)=>t+(s.grossPay||0),0);
  const totalDed=salaries.reduce((t,s)=>t+Object.values(s.deductions||{}).reduce((a,b)=>a+b,0),0);
  const payRevenue=payments.filter(p=>p.status==='success').reduce((t,p)=>t+(p.amount||0),0);

  // ── Analytics chart data ─────────────────────────────────────────────
  const trendMonths=Array.from({length:6},(_,i)=>{const d=new Date();d.setDate(1);d.setMonth(d.getMonth()-(5-i));return{m:d.getMonth()+1,y:d.getFullYear(),label:`${MO[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`};});
  const trendData={
    labels:trendMonths.map(t=>t.label),
    datasets:[{
      label:'Revenue',
      data:trendMonths.map(t=>payments.filter(p=>p.status==='success'&&(()=>{const d=new Date(p.paidAt||p.createdAt);return d.getMonth()+1===t.m&&d.getFullYear()===t.y;})()).reduce((s,p)=>s+p.amount,0)),
      borderColor:'#059669',backgroundColor:'rgba(5,150,105,.12)',fill:true,tension:.35,
    }],
  };
  const revTypes=[{k:'appointment',l:'Appointments',c:'#0891b2'},{k:'pharmacy',l:'Pharmacy',c:'#059669'},{k:'lab',l:'Lab',c:'#8b5cf6'},{k:'order',l:'Orders',c:'#f59e0b'},{k:'other',l:'Other / Manual',c:'#db2777'}];
  const revByTypeData={
    labels:revTypes.map(t=>t.l),
    datasets:[{data:revTypes.map(t=>payments.filter(p=>p.status==='success'&&p.type===t.k).reduce((s,p)=>s+p.amount,0)),backgroundColor:revTypes.map(t=>t.c),borderWidth:0}],
  };
  const selStaff=staff.find(s=>s._id===genForm.employeeId);

  const todayStr = new Date().toDateString();
  const isToday = (d) => d && new Date(d).toDateString() === todayStr;
  // "Today's transactions" = every patient payment AND every salary credit
  // that happened today — the full picture of money moving in/out today.
  const todayPayments = payments.filter(p => isToday(p.paidAt) || isToday(p.createdAt));
  const todaySuccessPayments = todayPayments.filter(p => p.status === 'success');
  const todayRevenue = todaySuccessPayments.reduce((t,p) => t + (p.amount||0), 0);
  const todayRefunds = todayPayments.filter(p => p.status === 'refunded');
  const todayRefundTotal = todayRefunds.reduce((t,p) => t + (p.refundAmount||p.amount||0), 0);
  const todaySalaryCredits = salaries.filter(s => s.status === 'credited' && isToday(s.creditedAt || s.updatedAt));
  const todaySalaryTotal = todaySalaryCredits.reduce((t,s) => t + (s.netPay||0), 0);
  const todayNetCashflow = todayRevenue - todayRefundTotal - todaySalaryTotal;

  const INPSTYLE={width:'100%',padding:'9px 12px',border:'1.5px solid #e2e8f0',borderRadius:10,fontFamily:'inherit',fontSize:13,outline:'none',boxSizing:'border-box'};
  const LBL={display:'block',fontSize:10.5,fontWeight:700,color:'#374151',letterSpacing:.5,textTransform:'uppercase',marginBottom:4};

  // Sidebar nav, grouped by function — replaces the old single-row tab bar
  const FINANCE_NAV_GROUPS=[
    { label:'Overview', items:[['overview','📊 Overview']] },
    { label:'Payroll', items:[
      ['payroll','💰 Payroll'],
      ['failed','⚠️ Failed Payments'+(failedSalaries.length?` (${failedSalaries.length})`:'')],
      ['manual','🧾 Manual Payments'],
    ]},
    { label:'Claims & Billing', items:[
      ['claims','🛡️ Claims Review'+(pendingClaimsCount?` (${pendingClaimsCount})`:'')],
      ['invoices','🧾 Invoices'],
    ]},
    { label:'Money Management', items:[
      ['expenses','🧮 Expenses'],
      ['budgets','📐 Budgets'],
      ['analytics','📈 Analytics'],
    ]},
    { label:'Transactions', items:[
      ['today','🕐 Today\'s Transactions'],
      ['transactions','💳 All Transactions'],
    ]},
    { label:'Staff & Reports', items:[
      ['accounts','🏦 Staff Accounts'],
      ['reports','📋 Reports'],
    ]},
  ];

  return(
    <div style={{fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif",minHeight:'100vh',background:'#f0f4f8'}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap'); @keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{background:'linear-gradient(135deg,#1e1b4b,#312e81,#4c1d95)',padding:'24px 28px',marginBottom:22,position:'relative',overflow:'hidden'}}>
        <div style={{position:'absolute',top:-40,right:-40,width:200,height:200,borderRadius:'50%',background:'rgba(139,92,246,.15)',pointerEvents:'none'}}/>
        <div style={{position:'absolute',bottom:-30,left:200,width:150,height:150,borderRadius:'50%',background:'rgba(99,102,241,.1)',pointerEvents:'none'}}/>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:16,position:'relative'}}>
          <div style={{display:'flex',alignItems:'center',gap:16}}>
            <div style={{width:56,height:56,borderRadius:16,background:'rgba(255,255,255,.15)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:26}}>💼</div>
            <div>
              <h1 style={{color:'#fff',fontWeight:900,fontSize:22,margin:0}}>Finance Control Center</h1>
              <p style={{color:'rgba(255,255,255,.6)',fontSize:13,margin:'3px 0 0'}}>{user?.name} · Finance Officer · {user?._id?.slice(-8).toUpperCase()}</p>
            </div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
            {[{l:"Today's Revenue",v:INR(todayRevenue),bg:'rgba(74,222,128,.15)',c:'#4ade80'},{l:'Net Payroll',v:INR(totalNet),bg:'rgba(255,255,255,.12)',c:'#fff'},{l:'Patient Revenue (Month)',v:INR(payRevenue),bg:'rgba(255,255,255,.12)',c:'#fff'},{l:'Pending',v:pending.length,bg:'rgba(251,146,60,.15)',c:'#fb923c'},{l:'Credited',v:credited.length,bg:'rgba(74,222,128,.15)',c:'#4ade80'},{l:'Today\'s Transactions',v:todayPayments.length,bg:'rgba(255,255,255,.12)',c:'#fff'}].map((s,i)=>(
              <div key={i} style={{background:s.bg,borderRadius:11,padding:'9px 14px',minWidth:120}}>
                <div style={{fontSize:11,color:'rgba(255,255,255,.5)',marginBottom:2}}>{s.l}</div>
                <div style={{fontSize:16,fontWeight:900,color:s.c}}>{s.v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{padding:'0 22px 22px',display:'flex',gap:18,alignItems:'flex-start'}}>
        {/* Sidebar navigation — grouped, replaces the old horizontal tab bar */}
        <div style={{width:224,flexShrink:0,background:'#fff',border:'1px solid #e8edf3',borderRadius:16,padding:'16px 12px',position:'sticky',top:16,maxHeight:'calc(100vh - 32px)',overflowY:'auto',boxShadow:'0 1px 3px rgba(15,23,42,.04)'}}>
          {FINANCE_NAV_GROUPS.map(group=>(
            <div key={group.label} style={{marginBottom:18}}>
              <div style={{fontSize:10,fontWeight:800,color:'#94a3b8',textTransform:'uppercase',letterSpacing:.7,padding:'2px 10px',marginBottom:6}}>{group.label}</div>
              {group.items.map(([k,l])=>{
                const active = tab===k;
                const [emoji, ...rest] = l.split(' ');
                return (
                  <button key={k} onClick={()=>setTab(k)}
                    style={{
                      display:'flex',alignItems:'center',gap:9,width:'100%',textAlign:'left',
                      padding:'9px 12px',borderRadius:10,border:'none',
                      background:active?'linear-gradient(135deg,#ede9fe,#f5f3ff)':'transparent',
                      color:active?'#6d28d9':'#475569',fontFamily:'inherit',
                      fontWeight:active?800:600,fontSize:12.5,cursor:'pointer',marginBottom:2,
                      position:'relative',transition:'background .15s, color .15s',
                    }}
                    onMouseEnter={e=>{ if(!active) e.currentTarget.style.background='#f8fafc'; }}
                    onMouseLeave={e=>{ if(!active) e.currentTarget.style.background='transparent'; }}>
                    {active && <span style={{position:'absolute',left:-6,top:'50%',transform:'translateY(-50%)',width:3,height:16,background:'#7c3aed',borderRadius:'0 3px 3px 0'}}/>}
                    <span style={{fontSize:14,width:16,textAlign:'center',flexShrink:0}}>{emoji}</span>
                    <span style={{flex:1,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{rest.join(' ')}</span>
                  </button>
                );
              })}
            </div>
          ))}

          <div style={{marginTop:4,paddingTop:14,borderTop:'1px solid #f1f5f9'}}>
            <div style={{fontSize:10,fontWeight:800,color:'#94a3b8',textTransform:'uppercase',letterSpacing:.7,padding:'2px 10px',marginBottom:6}}>More Tools</div>
            {[['🧾','Full Billing & Invoicing','/billing'],['🛡️','TPA & Insurance','/tpa'],['📦','Inventory','/inventory'],['🕒','Attendance','/attendance']].map(([icon,label,path])=>(
              <button key={path} onClick={()=>navigate(path)}
                style={{ display:'flex',alignItems:'center',gap:9,width:'100%',textAlign:'left',padding:'9px 12px',borderRadius:10,border:'none',background:'transparent',color:'#475569',fontFamily:'inherit',fontWeight:600,fontSize:12.5,cursor:'pointer',marginBottom:2,transition:'background .15s' }}
                onMouseEnter={e=>e.currentTarget.style.background='#f8fafc'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                <span style={{fontSize:14,width:16,textAlign:'center',flexShrink:0}}>{icon}</span>
                <span style={{flex:1}}>{label}</span>
                <span style={{fontSize:11,color:'#cbd5e1'}}>↗</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content column */}
        <div style={{flex:1,minWidth:0}}>

        {/* OVERVIEW */}
        {tab==='overview'&&(
          <div>
            {failedSalaries.length>0&&(
              <div style={{background:'linear-gradient(135deg,#fef2f2,#fee2e2)',border:'1.5px solid #fecaca',borderRadius:14,padding:'14px 18px',marginBottom:16,display:'flex',alignItems:'center',gap:14,flexWrap:'wrap'}}>
                <div style={{width:40,height:40,borderRadius:11,background:'#fee2e2',display:'flex',alignItems:'center',justifyContent:'center',fontSize:19,flexShrink:0}}>⚠️</div>
                <div style={{flex:1,minWidth:200}}>
                  <div style={{fontWeight:800,color:'#b91c1c',fontSize:14}}>{failedSalaries.length} salary payment{failedSalaries.length!==1?'s':''} failed to credit</div>
                  <div style={{fontSize:12,color:'#991b1b',marginTop:2}}>Bad/missing bank details — retry, fix the account, or pay via cash/cheque</div>
                </div>
                <button onClick={()=>setTab('failed')} style={{padding:'8px 16px',borderRadius:10,border:'none',background:'#dc2626',color:'#fff',fontFamily:'inherit',fontWeight:700,fontSize:12.5,cursor:'pointer'}}>View & Resolve →</button>
              </div>
            )}
            {pendingClaimsCount>0&&(
              <div style={{background:'linear-gradient(135deg,#f5f3ff,#ede9fe)',border:'1.5px solid #ddd6fe',borderRadius:14,padding:'14px 18px',marginBottom:16,display:'flex',alignItems:'center',gap:14,flexWrap:'wrap'}}>
                <div style={{width:40,height:40,borderRadius:11,background:'#ede9fe',display:'flex',alignItems:'center',justifyContent:'center',fontSize:19,flexShrink:0}}>🛡️</div>
                <div style={{flex:1,minWidth:200}}>
                  <div style={{fontWeight:800,color:'#6d28d9',fontSize:14}}>{pendingClaimsCount} insurance claim{pendingClaimsCount!==1?'s':''} awaiting review</div>
                  <div style={{fontSize:12,color:'#7c3aed',marginTop:2}}>Patients are waiting on a decision — approve, reject, or request more info</div>
                </div>
                <button onClick={()=>setTab('claims')} style={{padding:'8px 16px',borderRadius:10,border:'none',background:'#7c3aed',color:'#fff',fontFamily:'inherit',fontWeight:700,fontSize:12.5,cursor:'pointer'}}>Review Claims →</button>
              </div>
            )}
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(190px,1fr))',gap:12,marginBottom:20}}>
              {[{i:'👥',l:'Total Staff',v:staff.length,bg:'#eff6ff',c:'#1d4ed8'},{i:'💰',l:'Gross Payroll',v:INR(totalGross),bg:'#eff6ff',c:'#1d4ed8'},{i:'💚',l:'Net Payout',v:INR(totalNet),bg:'#f0fdf4',c:'#15803d'},{i:'❤️',l:'Deductions',v:INR(totalDed),bg:'#fef2f2',c:'#dc2626'},{i:'💳',l:'Patient Revenue',v:INR(payRevenue),bg:'#ecfeff',c:'#0e7490'},{i:'⏳',l:'Pending Credits',v:pending.length,bg:'#fef3c7',c:'#92400e'}].map((s,i)=>(
                <motion.div key={i} initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:i*.06}} style={{background:'#fff',border:'1px solid #e8edf3',borderRadius:14,padding:'14px',display:'flex',alignItems:'center',gap:12}}>
                  <div style={{width:42,height:42,borderRadius:12,background:s.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,flexShrink:0}}>{s.i}</div>
                  <div><div style={{fontSize:typeof s.v==='string'?14:24,fontWeight:900,color:'#0f172a',lineHeight:1}}>{s.v}</div><div style={{fontSize:11,color:'#94a3b8',marginTop:2}}>{s.l}</div></div>
                </motion.div>
              ))}
            </div>
            {/* Role payroll bars */}
            <div style={{background:'#fff',border:'1px solid #e8edf3',borderRadius:16,padding:'18px 22px'}}>
              <div style={{fontWeight:800,fontSize:15,color:'#0f172a',marginBottom:14}}>💰 Payroll by Role — {MO[selMonth-1]} {selYear}</div>
              {Object.keys(RC).filter(r=>r!=='patient').map(role=>{
                const roleNet=salaries.filter(s=>s.employee?.role===role).reduce((t,s)=>t+(s.netPay||0),0);
                const max=Math.max(...Object.keys(RC).map(r=>salaries.filter(s=>s.employee?.role===r).reduce((t,s)=>t+(s.netPay||0),0)),1);
                if(roleNet===0)return null;
                return(
                  <div key={role} style={{display:'flex',alignItems:'center',gap:12,marginBottom:9}}>
                    <div style={{width:90,fontSize:12,fontWeight:700,color:'#374151',textTransform:'capitalize',flexShrink:0}}>{role.replace('_',' ')}</div>
                    <div style={{flex:1,height:8,background:'#f1f5f9',borderRadius:4,overflow:'hidden'}}>
                      <motion.div initial={{width:0}} animate={{width:`${(roleNet/max)*100}%`}} transition={{duration:.8,ease:'easeOut'}} style={{height:'100%',background:`linear-gradient(90deg,${RC[role]},${RC[role]}99)`,borderRadius:4}}/>
                    </div>
                    <div style={{width:90,textAlign:'right',fontSize:12,fontWeight:700,color:RC[role]}}>{INR(roleNet)}</div>
                  </div>
                );
              })}
            </div>
            <div style={{marginTop:18,display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
              <StaffExtraTools />
              <MyActivityWidget />
            </div>
          </div>
        )}

        {/* PAYROLL */}
        {tab==='payroll'&&(
          <div>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14,flexWrap:'wrap',gap:10}}>
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                <select value={selMonth} onChange={e=>setSelMonth(Number(e.target.value))} style={INPSTYLE}>
                  {MO.map((m,i)=><option key={i} value={i+1}>{m}</option>)}
                </select>
                <select value={selYear} onChange={e=>setSelYear(Number(e.target.value))} style={INPSTYLE}>
                  {years.map(y=><option key={y}>{y}</option>)}
                </select>
              </div>
              <div style={{display:'flex',gap:8}}>
                {pending.length>0&&<button onClick={handleCreditAll} disabled={bulkLoad} style={{padding:'9px 16px',borderRadius:11,border:'none',background:'linear-gradient(135deg,#059669,#34d399)',color:'#fff',fontFamily:'inherit',fontWeight:700,fontSize:13,cursor:'pointer',display:'flex',alignItems:'center',gap:6}}>
                  {bulkLoad?<div style={{width:13,height:13,border:'2px solid rgba(255,255,255,.3)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin .7s linear infinite'}}/>:'✅'}Credit All ({pending.length})
                </button>}
                <button onClick={exportPayroll} style={{padding:'9px 16px',borderRadius:11,border:'1.5px solid #e2e8f0',background:'#fff',color:'#374151',fontFamily:'inherit',fontWeight:700,fontSize:13,cursor:'pointer'}}>⬇️ Export CSV</button>
                <button onClick={()=>{setShowGen(true);setGenAll(false);}} style={{padding:'9px 16px',borderRadius:11,border:'none',background:'linear-gradient(135deg,#8b5cf6,#6366f1)',color:'#fff',fontFamily:'inherit',fontWeight:700,fontSize:13,cursor:'pointer'}}>+ Generate</button>
                <button onClick={()=>{setShowGen(true);setGenAll(true);}} style={{padding:'9px 16px',borderRadius:11,border:'1.5px solid #8b5cf6',background:'#f5f3ff',color:'#8b5cf6',fontFamily:'inherit',fontWeight:700,fontSize:13,cursor:'pointer'}}>⚡ Bulk All</button>
              </div>
            </div>

            {loading?<div style={{background:'#fff',border:'1px solid #e8edf3',borderRadius:16,padding:48,textAlign:'center'}}><div style={{width:28,height:28,border:'3px solid #e2e8f0',borderTopColor:'#8b5cf6',borderRadius:'50%',animation:'spin .7s linear infinite',margin:'0 auto'}}/></div>
            :salaries.length===0?<div style={{background:'#fff',border:'1px solid #e8edf3',borderRadius:16,padding:'56px 24px',textAlign:'center',color:'#94a3b8'}}>
              <div style={{fontSize:52,marginBottom:14}}>💰</div>
              <div style={{fontWeight:800,fontSize:17,color:'#0f172a',marginBottom:8}}>No salary records for {MO[selMonth-1]} {selYear}</div>
              <button onClick={()=>{setShowGen(true);setGenAll(true);}} style={{padding:'11px 26px',borderRadius:12,border:'none',background:'linear-gradient(135deg,#8b5cf6,#6366f1)',color:'#fff',fontFamily:'inherit',fontWeight:800,fontSize:14,cursor:'pointer'}}>⚡ Generate All Salaries</button>
            </div>
            :(
              <div style={{background:'#fff',border:'1px solid #e8edf3',borderRadius:16,overflow:'hidden'}}>
                <div style={{padding:'13px 18px',borderBottom:'1px solid #f1f5f9',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:8}}>
                  <span style={{fontWeight:800,fontSize:14,color:'#0f172a'}}>Salary Register — {MO[selMonth-1]} {selYear} ({salaries.length})</span>
                  <div style={{display:'flex',gap:10,fontSize:12}}>
                    <span style={{color:'#15803d',fontWeight:700}}>✅ {credited.length} credited</span>
                    <span style={{color:'#92400e',fontWeight:700}}>⏳ {pending.length} pending</span>
                  </div>
                </div>
                <div style={{overflowX:'auto'}}>
                  <table style={{width:'100%',borderCollapse:'collapse'}}>
                    <thead><tr style={{background:'#f8fafc'}}>
                      {['Employee','Role','Basic','Gross','Deductions','Net Pay','Days','Status','Actions'].map(h=>(
                        <th key={h} style={{padding:'9px 13px',textAlign:'left',fontSize:10.5,fontWeight:700,color:'#94a3b8',letterSpacing:.5,textTransform:'uppercase',borderBottom:'1px solid #f1f5f9',whiteSpace:'nowrap'}}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {salaries.map((s,i)=>{
                        const sc=STATUS[s.status]||STATUS.pending;
                        const rc=RC[s.employee?.role]||'#64748b';
                        const td=Object.values(s.deductions||{}).reduce((a,b)=>a+b,0);
                        return(
                          <tr key={s._id} style={{borderBottom:'1px solid #f8fafc',cursor:'pointer'}} onClick={()=>setSelSalary(s)}
                            onMouseEnter={e=>e.currentTarget.style.background='#fafbfc'}
                            onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                            <td style={{padding:'10px 13px'}}>
                              <div style={{display:'flex',alignItems:'center',gap:9}}>
                                <div style={{width:33,height:33,borderRadius:10,background:`linear-gradient(135deg,${rc},${rc}99)`,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:700,fontSize:12}}>{ini(s.employee?.name)}</div>
                                <div><div style={{fontWeight:700,color:'#0f172a',fontSize:12.5}}>{s.employee?.name}</div><div style={{fontSize:10.5,color:'#94a3b8'}}>{s.employee?.email}</div></div>
                              </div>
                            </td>
                            <td style={{padding:'10px 13px'}}><span style={{padding:'2px 8px',borderRadius:20,fontSize:10.5,fontWeight:700,background:`${rc}18`,color:rc,textTransform:'capitalize'}}>{s.employee?.role?.replace('_',' ')}</span></td>
                            <td style={{padding:'10px 13px',fontSize:12.5,color:'#374151',fontWeight:600}}>{INR(s.basicPay)}</td>
                            <td style={{padding:'10px 13px',fontSize:12.5,color:'#0891b2',fontWeight:700}}>{INR(s.grossPay)}</td>
                            <td style={{padding:'10px 13px',fontSize:12.5,color:'#ef4444',fontWeight:600}}>-{INR(td)}</td>
                            <td style={{padding:'10px 13px'}}><span style={{fontSize:14,fontWeight:900,color:'#059669'}}>{INR(s.netPay)}</span></td>
                            <td style={{padding:'10px 13px',fontSize:11.5,color:'#64748b'}}>{s.daysWorked}d/{s.daysAbsent}a</td>
                            <td style={{padding:'10px 13px'}}>
                              <span title={s.status==='failed'?s.failureReason:''} style={{padding:'3px 9px',borderRadius:20,fontSize:11,fontWeight:700,background:sc.bg,color:sc.c,display:'flex',alignItems:'center',gap:4,width:'fit-content',cursor:s.status==='failed'?'help':'default'}}><div style={{width:5,height:5,borderRadius:'50%',background:sc.dot}}/>{s.status}</span>
                            </td>
                            <td style={{padding:'10px 13px'}} onClick={e=>e.stopPropagation()}>
                              <div style={{display:'flex',gap:5}}>
                                {(s.status==='pending'||s.status==='failed')&&<button onClick={()=>handleCredit(s._id,s.employee?.name)} disabled={creditingId===s._id} style={{padding:'5px 11px',borderRadius:8,border:'none',background:s.status==='failed'?'#dc2626':'#059669',color:'#fff',fontFamily:'inherit',fontSize:11,fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',gap:5}}>
                                  {creditingId===s._id?<div style={{width:10,height:10,border:'1.5px solid rgba(255,255,255,.3)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin .7s linear infinite'}}/>:null}{s.status==='failed'?'🔁 Retry':'💳 Credit'}
                                </button>}
                                {(s.status==='pending'||s.status==='failed')&&<button onClick={()=>openPayModal(s)} style={{padding:'5px 9px',borderRadius:8,border:'1px solid #e2e8f0',background:'#fffbeb',color:'#92400e',fontFamily:'inherit',fontSize:11,fontWeight:700,cursor:'pointer'}}>💵 Cash/Cheque</button>}
                                <button onClick={()=>{setEditId(s._id);setEditForm({basicPay:s.basicPay,daysWorked:s.daysWorked,daysAbsent:s.daysAbsent,overtimeHours:s.overtimeHours||0,bonus:0,loan:s.deductions?.loan||0,otherDed:s.deductions?.other||0,remarks:s.remarks,paymentMode:s.paymentMode,bankAccount:s.bankAccount});}} style={{padding:'5px 9px',borderRadius:8,border:'1px solid #e2e8f0',background:'#f8fafc',color:'#374151',fontFamily:'inherit',fontSize:11,fontWeight:700,cursor:'pointer'}}>✏️</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot><tr style={{background:'#f8fafc',borderTop:'2px solid #e2e8f0'}}>
                      <td colSpan={3} style={{padding:'11px 13px',fontWeight:700,color:'#374151'}}>Totals ({salaries.length})</td>
                      <td style={{padding:'11px 13px',fontWeight:900,color:'#0891b2',fontSize:13}}>{INR(totalGross)}</td>
                      <td style={{padding:'11px 13px',fontWeight:900,color:'#ef4444'}}>-{INR(totalDed)}</td>
                      <td style={{padding:'11px 13px',fontWeight:900,color:'#059669',fontSize:15}}>{INR(totalNet)}</td>
                      <td colSpan={3}/>
                    </tr></tfoot>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* FAILED PAYMENTS */}
        {tab==='failed'&&(
          <div>
            <div style={{background:'#fff',border:'1px solid #e8edf3',borderRadius:16,overflow:'hidden',marginBottom:14}}>
              <div style={{padding:'13px 18px',borderBottom:'1px solid #f1f5f9',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:8}}>
                <span style={{fontWeight:800,fontSize:15,color:'#0f172a'}}>⚠️ Failed Salary Credits ({failedSalaries.length})</span>
                <Link to="/failed-payments" style={{fontSize:12.5,color:'#8b5cf6',fontWeight:700,textDecoration:'none'}}>Open full Failed Payments page →</Link>
              </div>
              {failedSalaries.length===0?(
                <div style={{padding:'48px 24px',textAlign:'center',color:'#94a3b8'}}><div style={{fontSize:36,marginBottom:10}}>✅</div><div style={{fontWeight:700}}>No failed payments — everything's clean.</div></div>
              ):(
                <div style={{overflowX:'auto'}}>
                  <table style={{width:'100%',borderCollapse:'collapse'}}>
                    <thead><tr style={{background:'#f8fafc'}}>
                      {['Employee','Role','Period','Net Pay','Reason','Actions'].map(h=>(
                        <th key={h} style={{padding:'9px 13px',textAlign:'left',fontSize:10.5,fontWeight:700,color:'#94a3b8',letterSpacing:.5,textTransform:'uppercase',borderBottom:'1px solid #f1f5f9',whiteSpace:'nowrap'}}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {failedSalaries.map(s=>(
                        <tr key={s._id} style={{borderBottom:'1px solid #f8fafc'}}>
                          <td style={{padding:'10px 13px',fontSize:12.5,fontWeight:700,color:'#0f172a'}}>{s.employee?.name}</td>
                          <td style={{padding:'10px 13px',fontSize:12,color:'#64748b',textTransform:'capitalize'}}>{s.employee?.role?.replace('_',' ')}</td>
                          <td style={{padding:'10px 13px',fontSize:12}}>{MO[(s.month||1)-1]} {s.year}</td>
                          <td style={{padding:'10px 13px',fontSize:13,fontWeight:800,color:'#059669'}}>{INR(s.netPay)}</td>
                          <td style={{padding:'10px 13px',fontSize:11.5,color:'#b91c1c',maxWidth:220}}>{s.failureReason}</td>
                          <td style={{padding:'10px 13px'}}>
                            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                              <button onClick={()=>handleCredit(s._id,s.employee?.name)} disabled={creditingId===s._id} style={{padding:'5px 11px',borderRadius:8,border:'none',background:'#dc2626',color:'#fff',fontFamily:'inherit',fontSize:11,fontWeight:700,cursor:'pointer'}}>{creditingId===s._id?'…':'🔁 Retry'}</button>
                              <button onClick={()=>openPayModal(s)} style={{padding:'5px 9px',borderRadius:8,border:'1px solid #e2e8f0',background:'#fffbeb',color:'#92400e',fontFamily:'inherit',fontSize:11,fontWeight:700,cursor:'pointer'}}>💵 Cash/Cheque</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* MANUAL (CASH/CHEQUE) PAYMENTS */}
        {tab==='manual'&&(
          <div style={{background:'#fff',border:'1px solid #e8edf3',borderRadius:16,overflow:'hidden'}}>
            <div style={{padding:'13px 18px',borderBottom:'1px solid #f1f5f9',fontWeight:800,fontSize:15,color:'#0f172a'}}>🧾 Manual (Cash/Cheque) Salary Payments ({manualPayments.length})</div>
            {manualPayments.length===0?(
              <div style={{padding:'48px 24px',textAlign:'center',color:'#94a3b8'}}><div style={{fontSize:36,marginBottom:10}}>🧾</div><div style={{fontWeight:700}}>No manual cash/cheque payments recorded for this period.</div></div>
            ):(
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse'}}>
                  <thead><tr style={{background:'#f8fafc'}}>
                    {['Employee','Mode','Net Pay','Reference','Bank / Branch','Cheque Date','Paid On'].map(h=>(
                      <th key={h} style={{padding:'9px 13px',textAlign:'left',fontSize:10.5,fontWeight:700,color:'#94a3b8',letterSpacing:.5,textTransform:'uppercase',borderBottom:'1px solid #f1f5f9',whiteSpace:'nowrap'}}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {manualPayments.map(s=>{
                      const mp=s.manualPaymentDetails||{};
                      return(
                        <tr key={s._id} style={{borderBottom:'1px solid #f8fafc'}}>
                          <td style={{padding:'10px 13px',fontSize:12.5,fontWeight:700,color:'#0f172a'}}>{s.employee?.name}</td>
                          <td style={{padding:'10px 13px'}}><span style={{padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:700,background:s.paymentMode==='cash'?'#dcfce7':'#eff6ff',color:s.paymentMode==='cash'?'#15803d':'#1d4ed8',textTransform:'capitalize'}}>{s.paymentMode}</span></td>
                          <td style={{padding:'10px 13px',fontSize:13,fontWeight:800,color:'#059669'}}>{INR(s.netPay)}</td>
                          <td style={{padding:'10px 13px',fontSize:11.5,fontFamily:'monospace',color:'#374151'}}>{s.paymentMode==='cash'?(mp.receiptNumber||s.transactionRef):(mp.chequeNumber||s.transactionRef)}</td>
                          <td style={{padding:'10px 13px',fontSize:11.5,color:'#64748b'}}>{s.paymentMode==='cheque'?[mp.chequeBankName,mp.chequeBranch].filter(Boolean).join(' / ')||'—':'—'}</td>
                          <td style={{padding:'10px 13px',fontSize:11.5,color:'#64748b'}}>{s.paymentMode==='cheque'&&mp.chequeDate?new Date(mp.chequeDate).toLocaleDateString('en-IN'):'—'}</td>
                          <td style={{padding:'10px 13px',fontSize:11.5,color:'#64748b'}}>{s.creditedAt?new Date(s.creditedAt).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}):'—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}


        {/* CLAIMS REVIEW */}
        {tab==='claims'&&(
          <div>
            <div style={{background:'#fff',border:'1px solid #e8edf3',borderRadius:16,overflow:'hidden'}}>
              <div style={{padding:'13px 18px',borderBottom:'1px solid #f1f5f9',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:8}}>
                <span style={{fontWeight:800,fontSize:15,color:'#0f172a'}}>🛡️ Insurance Claims ({claims.length})</span>
                <select value={claimsFilter} onChange={e=>setClaimsFilter(e.target.value)} style={{padding:'7px 12px',borderRadius:9,border:'1.5px solid #e2e8f0',fontFamily:'inherit',fontSize:12.5}}>
                  <option value="">All Statuses</option>
                  <option value="submitted">Submitted</option>
                  <option value="under_review">Under Review</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="paid">Paid Out</option>
                </select>
              </div>
              {claimsLoading?(
                <div style={{padding:'48px 24px',textAlign:'center',color:'#94a3b8'}}>Loading…</div>
              ):claims.length===0?(
                <div style={{padding:'48px 24px',textAlign:'center',color:'#94a3b8'}}><div style={{fontSize:36,marginBottom:10}}>🛡️</div><div style={{fontWeight:700}}>No insurance claims{claimsFilter?` with status "${claimsFilter}"`:''}.</div></div>
              ):(
                <div style={{overflowX:'auto'}}>
                  <table style={{width:'100%',borderCollapse:'collapse'}}>
                    <thead><tr style={{background:'#f8fafc'}}>
                      {['Patient','Policy','Claimed','Approved','Status','Submitted','Actions'].map(h=>(
                        <th key={h} style={{padding:'9px 13px',textAlign:'left',fontSize:10.5,fontWeight:700,color:'#94a3b8',letterSpacing:.5,textTransform:'uppercase',borderBottom:'1px solid #f1f5f9',whiteSpace:'nowrap'}}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {claims.map(c=>{
                        const st=CLAIM_STATUS[c.status]||CLAIM_STATUS.submitted;
                        return(
                          <tr key={c._id} style={{borderBottom:'1px solid #f8fafc'}}>
                            <td style={{padding:'10px 13px',fontSize:12.5,fontWeight:700,color:'#0f172a'}}>{c.patient?.name}<div style={{fontSize:11,color:'#94a3b8',fontWeight:500}}>{c.patient?.phone||c.patient?.email}</div></td>
                            <td style={{padding:'10px 13px',fontSize:12}}>{c.policy?.provider}<div style={{fontSize:11,color:'#94a3b8'}}>{c.policy?.policyNumber}</div></td>
                            <td style={{padding:'10px 13px',fontSize:13,fontWeight:800,color:'#0f172a'}}>{INR(c.claimAmount)}</td>
                            <td style={{padding:'10px 13px',fontSize:13,fontWeight:800,color:'#059669'}}>{c.approvedAmount!=null?INR(c.approvedAmount):'—'}</td>
                            <td style={{padding:'10px 13px'}}><span style={{padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:700,background:st.bg,color:st.c}}>{st.l}</span></td>
                            <td style={{padding:'10px 13px',fontSize:11.5,color:'#64748b'}}>{new Date(c.createdAt).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</td>
                            <td style={{padding:'10px 13px'}}>
                              <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                                {['submitted','under_review'].includes(c.status)&&<button onClick={()=>openReview(c)} style={{padding:'5px 11px',borderRadius:8,border:'none',background:'#7c3aed',color:'#fff',fontFamily:'inherit',fontSize:11,fontWeight:700,cursor:'pointer'}}>Review</button>}
                                {c.status==='approved'&&<button onClick={()=>markClaimPaid(c._id)} disabled={payingClaimId===c._id} style={{padding:'5px 11px',borderRadius:8,border:'none',background:'#059669',color:'#fff',fontFamily:'inherit',fontSize:11,fontWeight:700,cursor:'pointer'}}>{payingClaimId===c._id?'…':'💸 Mark Paid'}</button>}
                                {c.documents?.length>0&&<a href={c.documents[0]} target="_blank" rel="noreferrer" style={{padding:'5px 9px',borderRadius:8,border:'1px solid #e2e8f0',background:'#f8fafc',color:'#374151',fontFamily:'inherit',fontSize:11,fontWeight:700,cursor:'pointer',textDecoration:'none'}}>📎 Docs ({c.documents.length})</a>}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* EXPENSES */}
        {tab==='expenses'&&(
          <div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(190px,1fr))',gap:12,marginBottom:16}}>
              <div style={{background:'#fff',border:'1px solid #e8edf3',borderRadius:14,padding:14}}>
                <div style={{fontSize:11,color:'#94a3b8',marginBottom:4}}>Total Expenses ({MO[selMonth-1]} {selYear})</div>
                <div style={{fontSize:19,fontWeight:900,color:'#dc2626'}}>{INR(totalExpenses)}</div>
              </div>
              <div style={{background:'#fff',border:'1px solid #e8edf3',borderRadius:14,padding:14}}>
                <div style={{fontSize:11,color:'#94a3b8',marginBottom:4}}>Records</div>
                <div style={{fontSize:19,fontWeight:900,color:'#0f172a'}}>{expenses.length}</div>
              </div>
            </div>
            <div style={{background:'#fff',border:'1px solid #e8edf3',borderRadius:16,overflow:'hidden'}}>
              <div style={{padding:'13px 18px',borderBottom:'1px solid #f1f5f9',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:8}}>
                <span style={{fontWeight:800,fontSize:15,color:'#0f172a'}}>🧮 Expenses — {MO[selMonth-1]} {selYear}</span>
                <button onClick={openAddExpense} style={{padding:'8px 16px',borderRadius:10,border:'none',background:'linear-gradient(135deg,#dc2626,#f87171)',color:'#fff',fontFamily:'inherit',fontWeight:700,fontSize:12.5,cursor:'pointer'}}>+ Add Expense</button>
              </div>
              {expensesLoading?(
                <div style={{padding:'48px 24px',textAlign:'center',color:'#94a3b8'}}>Loading…</div>
              ):expenses.length===0?(
                <div style={{padding:'48px 24px',textAlign:'center',color:'#94a3b8'}}><div style={{fontSize:36,marginBottom:10}}>🧮</div><div style={{fontWeight:700}}>No expenses recorded for this period.</div></div>
              ):(
                <div style={{overflowX:'auto'}}>
                  <table style={{width:'100%',borderCollapse:'collapse'}}>
                    <thead><tr style={{background:'#f8fafc'}}>
                      {['Date','Category','Description','Vendor','Amount','Mode','Actions'].map(h=>(
                        <th key={h} style={{padding:'9px 13px',textAlign:'left',fontSize:10.5,fontWeight:700,color:'#94a3b8',letterSpacing:.5,textTransform:'uppercase',borderBottom:'1px solid #f1f5f9',whiteSpace:'nowrap'}}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {expenses.map(e=>{
                        const cat=CATS[e.category]||CATS.other;
                        return(
                          <tr key={e._id} style={{borderBottom:'1px solid #f8fafc'}}>
                            <td style={{padding:'10px 13px',fontSize:11.5,color:'#64748b',whiteSpace:'nowrap'}}>{new Date(e.expenseDate).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</td>
                            <td style={{padding:'10px 13px'}}><span style={{padding:'3px 9px',borderRadius:20,fontSize:11,fontWeight:700,background:`${cat.c}15`,color:cat.c}}>{cat.i} {cat.l}</span></td>
                            <td style={{padding:'10px 13px',fontSize:12.5,color:'#0f172a',fontWeight:600,maxWidth:220}}>{e.description}</td>
                            <td style={{padding:'10px 13px',fontSize:12,color:'#64748b'}}>{e.vendor||'—'}</td>
                            <td style={{padding:'10px 13px',fontSize:13,fontWeight:800,color:'#dc2626'}}>{INR(e.amount)}</td>
                            <td style={{padding:'10px 13px',fontSize:11.5,textTransform:'capitalize',color:'#64748b'}}>{e.paymentMode?.replace('_',' ')}</td>
                            <td style={{padding:'10px 13px'}}>
                              <div style={{display:'flex',gap:6}}>
                                <button onClick={()=>openEditExpense(e)} style={{padding:'5px 9px',borderRadius:8,border:'1px solid #e2e8f0',background:'#eff6ff',color:'#1d4ed8',fontFamily:'inherit',fontSize:11,fontWeight:700,cursor:'pointer'}}>✏️</button>
                                <button onClick={()=>deleteExpense(e._id)} style={{padding:'5px 9px',borderRadius:8,border:'1px solid #fecaca',background:'#fef2f2',color:'#dc2626',fontFamily:'inherit',fontSize:11,fontWeight:700,cursor:'pointer'}}>🗑</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* BUDGETS */}
        {tab==='budgets'&&(
          <div style={{background:'#fff',border:'1px solid #e8edf3',borderRadius:16,overflow:'hidden'}}>
            <div style={{padding:'13px 18px',borderBottom:'1px solid #f1f5f9',fontWeight:800,fontSize:15,color:'#0f172a'}}>📐 Budget vs Actual — {MO[selMonth-1]} {selYear}</div>
            {budgetsLoading?(
              <div style={{padding:'48px 24px',textAlign:'center',color:'#94a3b8'}}>Loading…</div>
            ):(
              <div style={{padding:'18px 22px',display:'flex',flexDirection:'column',gap:14}}>
                {Object.keys(CATS).map(cat=>{
                  const info=CATS[cat];
                  const s=budgetSummary.find(x=>x.category===cat)||{allocatedAmount:0,actualSpent:0,percentUsed:0,overBudget:false};
                  const pct=Math.min(s.percentUsed,100);
                  return(
                    <div key={cat} style={{border:'1px solid #f1f5f9',borderRadius:12,padding:'12px 16px'}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8,flexWrap:'wrap',gap:8}}>
                        <div style={{fontWeight:700,fontSize:13,color:'#0f172a'}}>{info.i} {info.l}{cat==='payroll'&&<span style={{fontSize:10.5,color:'#94a3b8',fontWeight:500}}> (auto from credited salaries)</span>}</div>
                        <div style={{display:'flex',alignItems:'center',gap:10}}>
                          <span style={{fontSize:12.5,color:'#64748b'}}>{INR(s.actualSpent)} / <strong style={{color:'#0f172a'}}>{s.allocatedAmount>0?INR(s.allocatedAmount):'no budget set'}</strong></span>
                          <button onClick={()=>openBudget(cat,s.allocatedAmount||'')} style={{padding:'4px 10px',borderRadius:7,border:'1px solid #e2e8f0',background:'#f8fafc',color:'#374151',fontFamily:'inherit',fontSize:11,fontWeight:700,cursor:'pointer'}}>{s.allocatedAmount>0?'Edit':'Set Budget'}</button>
                        </div>
                      </div>
                      <div style={{height:8,background:'#f1f5f9',borderRadius:5,overflow:'hidden'}}>
                        <motion.div initial={{width:0}} animate={{width:`${pct}%`}} transition={{duration:.7}} style={{height:'100%',background:s.overBudget?'#dc2626':info.c,borderRadius:5}}/>
                      </div>
                      {s.overBudget&&<div style={{fontSize:11.5,color:'#dc2626',fontWeight:700,marginTop:6}}>⚠️ Over budget by {INR(Math.abs(s.remaining))}</div>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ANALYTICS */}
        {tab==='analytics'&&(
          <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:16}}>
            <div style={{background:'#fff',border:'1px solid #e8edf3',borderRadius:16,padding:'18px 22px'}}>
              <div style={{fontWeight:800,fontSize:15,color:'#0f172a',marginBottom:14}}>📈 Revenue Trend — Last 6 Months</div>
              <div style={{height:280}}>
                <Line data={trendData} options={{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{font:{size:11},boxWidth:10}}},scales:{y:{ticks:{callback:v=>'₹'+(v/1000)+'k'}}}}}/>
              </div>
            </div>
            <div style={{background:'#fff',border:'1px solid #e8edf3',borderRadius:16,padding:'18px 22px'}}>
              <div style={{fontWeight:800,fontSize:15,color:'#0f172a',marginBottom:14}}>💳 Revenue by Type</div>
              <div style={{height:220}}>
                <Doughnut data={revByTypeData} options={{responsive:true,maintainAspectRatio:false,cutout:'62%',plugins:{legend:{position:'bottom',labels:{font:{size:11},boxWidth:10,padding:6}}}}}/>
              </div>
            </div>
            <div style={{background:'#fff',border:'1px solid #e8edf3',borderRadius:16,padding:'18px 22px',gridColumn:'1/-1'}}>
              <div style={{fontWeight:800,fontSize:15,color:'#0f172a',marginBottom:14}}>🧮 Expenses by Category — {MO[selMonth-1]} {selYear}</div>
              {expensesByCat.length===0?(
                <div style={{color:'#94a3b8',fontSize:13,textAlign:'center',padding:20}}>No expenses recorded this period.</div>
              ):expensesByCat.map(({cat,total})=>{
                const info=CATS[cat];const max=Math.max(...expensesByCat.map(x=>x.total),1);
                return(
                  <div key={cat} style={{marginBottom:10}}>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:4,fontSize:12}}>
                      <span style={{fontWeight:600,color:'#374151'}}>{info.i} {info.l}</span>
                      <span style={{fontWeight:800,color:info.c}}>{INR(total)}</span>
                    </div>
                    <div style={{height:7,background:'#f1f5f9',borderRadius:4,overflow:'hidden'}}>
                      <motion.div initial={{width:0}} animate={{width:`${(total/max)*100}%`}} transition={{duration:.7}} style={{height:'100%',background:info.c,borderRadius:4}}/>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* INVOICES */}
        {tab==='invoices'&&(
          <div style={{background:'#fff',border:'1px solid #e8edf3',borderRadius:16,overflow:'hidden'}}>
            <div style={{padding:'13px 18px',borderBottom:'1px solid #f1f5f9',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:8}}>
              <span style={{fontWeight:800,fontSize:15,color:'#0f172a'}}>🧾 Invoices &amp; Receipts ({payments.length})</span>
              <button onClick={openInvoiceModal} style={{padding:'8px 16px',borderRadius:10,border:'none',background:'linear-gradient(135deg,#8b5cf6,#6366f1)',color:'#fff',fontFamily:'inherit',fontWeight:700,fontSize:12.5,cursor:'pointer'}}>+ Create Manual Invoice</button>
            </div>
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead><tr style={{background:'#f8fafc'}}>
                  {['Receipt','Patient','Description','Amount','Status','Date','Action'].map(h=>(
                    <th key={h} style={{padding:'9px 13px',textAlign:'left',fontSize:10.5,fontWeight:700,color:'#94a3b8',letterSpacing:.5,textTransform:'uppercase',borderBottom:'1px solid #f1f5f9',whiteSpace:'nowrap'}}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {payments.slice(0,100).map(p=>(
                    <tr key={p._id} style={{borderBottom:'1px solid #f8fafc'}}>
                      <td style={{padding:'10px 13px',fontSize:11.5,fontFamily:'monospace',color:'#374151'}}>{p.receiptNo||'—'}</td>
                      <td style={{padding:'10px 13px',fontSize:12.5,fontWeight:700,color:'#0f172a'}}>{p.user?.name}</td>
                      <td style={{padding:'10px 13px',fontSize:12,color:'#64748b',textTransform:'capitalize'}}>{p.description||p.type}</td>
                      <td style={{padding:'10px 13px',fontSize:13,fontWeight:800,color:'#059669'}}>{INR(p.amount)}</td>
                      <td style={{padding:'10px 13px'}}><span style={{padding:'3px 9px',borderRadius:20,fontSize:11,fontWeight:700,background:p.status==='success'?'#dcfce7':p.status==='refunded'?'#fee2e2':'#fef3c7',color:p.status==='success'?'#15803d':p.status==='refunded'?'#dc2626':'#92400e'}}>{p.status}</span></td>
                      <td style={{padding:'10px 13px',fontSize:11.5,color:'#64748b'}}>{new Date(p.paidAt||p.createdAt).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</td>
                      <td style={{padding:'10px 13px'}}><button onClick={()=>setViewInvoice(p)} style={{padding:'5px 11px',borderRadius:8,border:'1px solid #ddd6fe',background:'#f5f3ff',color:'#7c3aed',fontFamily:'inherit',fontSize:11,fontWeight:700,cursor:'pointer'}}>🖨️ Invoice</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab==='today'&&(
          <div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(190px,1fr))',gap:12,marginBottom:20}}>
              {[
                {i:'💵',l:'Revenue Today',v:INR(todayRevenue),bg:'#f0fdf4',c:'#15803d'},
                {i:'↩️',l:'Refunds Today',v:INR(todayRefundTotal),bg:'#fef2f2',c:'#dc2626'},
                {i:'💸',l:'Salaries Credited Today',v:INR(todaySalaryTotal),bg:'#f5f3ff',c:'#7c3aed'},
                {i:'📊',l:'Net Cashflow Today',v:INR(todayNetCashflow),bg:todayNetCashflow>=0?'#f0fdf4':'#fef2f2',c:todayNetCashflow>=0?'#15803d':'#dc2626'},
              ].map((s,i)=>(
                <motion.div key={i} initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:i*.06}} style={{background:'#fff',border:'1px solid #e8edf3',borderRadius:14,padding:'14px',display:'flex',alignItems:'center',gap:12}}>
                  <div style={{width:42,height:42,borderRadius:12,background:s.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,flexShrink:0}}>{s.i}</div>
                  <div><div style={{fontSize:16,fontWeight:900,color:s.c,lineHeight:1}}>{s.v}</div><div style={{fontSize:11,color:'#94a3b8',marginTop:2}}>{s.l}</div></div>
                </motion.div>
              ))}
            </div>

            <div style={{background:'#fff',border:'1px solid #e8edf3',borderRadius:16,overflow:'hidden',marginBottom:18}}>
              <div style={{padding:'13px 18px',borderBottom:'1px solid #f1f5f9',fontWeight:800,fontSize:15,color:'#0f172a'}}>
                💳 Patient Payments Today ({todayPayments.length})
              </div>
              {todayPayments.length===0 ? (
                <div style={{padding:'40px 24px',textAlign:'center',color:'#94a3b8'}}>
                  <div style={{fontSize:36,marginBottom:10}}>🕐</div>
                  <div style={{fontWeight:700}}>No transactions yet today</div>
                </div>
              ) : (
                <div style={{overflowX:'auto'}}>
                  <table style={{width:'100%',borderCollapse:'collapse'}}>
                    <thead><tr style={{background:'#f8fafc'}}>
                      {['Time','Receipt','Patient','Type','Amount','Method','Status'].map(h=>(
                        <th key={h} style={{padding:'9px 13px',textAlign:'left',fontSize:10.5,fontWeight:700,color:'#94a3b8',letterSpacing:.5,textTransform:'uppercase',borderBottom:'1px solid #f1f5f9',whiteSpace:'nowrap'}}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {todayPayments.sort((a,b)=>new Date(b.paidAt||b.createdAt)-new Date(a.paidAt||a.createdAt)).map(p=>(
                        <tr key={p._id} style={{borderBottom:'1px solid #f8fafc'}}
                          onMouseEnter={e=>e.currentTarget.style.background='#fafbfc'}
                          onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                          <td style={{padding:'9px 13px',fontSize:11.5,color:'#64748b',whiteSpace:'nowrap'}}>{new Date(p.paidAt||p.createdAt).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</td>
                          <td style={{padding:'9px 13px',fontFamily:'monospace',fontSize:11,color:'#64748b'}}>{p.receiptNo||'—'}</td>
                          <td style={{padding:'9px 13px',fontSize:12.5,fontWeight:600,color:'#0f172a'}}>{p.user?.name||'—'}</td>
                          <td style={{padding:'9px 13px'}}><span style={{padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:700,background:'#ecfeff',color:'#0e7490'}}>{p.type}</span></td>
                          <td style={{padding:'9px 13px',fontWeight:800,color:p.status==='refunded'?'#dc2626':'#059669',fontSize:13}}>{p.status==='refunded'?'-':''}{INR(p.amount)}</td>
                          <td style={{padding:'9px 13px',fontSize:12,color:'#64748b',textTransform:'capitalize'}}>{p.method?.replace('_',' ')||'—'}</td>
                          <td style={{padding:'9px 13px'}}><span style={{padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:700,background:p.status==='success'?'#dcfce7':p.status==='refunded'?'#fee2e2':p.status==='failed'?'#fee2e2':'#fef3c7',color:p.status==='success'?'#15803d':p.status==='refunded'?'#dc2626':p.status==='failed'?'#dc2626':'#92400e'}}>{p.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {todaySalaryCredits.length>0 && (
              <div style={{background:'#fff',border:'1px solid #e8edf3',borderRadius:16,overflow:'hidden'}}>
                <div style={{padding:'13px 18px',borderBottom:'1px solid #f1f5f9',fontWeight:800,fontSize:15,color:'#0f172a'}}>
                  💸 Salaries Credited Today ({todaySalaryCredits.length})
                </div>
                <div style={{overflowX:'auto'}}>
                  <table style={{width:'100%',borderCollapse:'collapse'}}>
                    <thead><tr style={{background:'#f8fafc'}}>
                      {['Employee','Role','Net Pay','Account'].map(h=>(
                        <th key={h} style={{padding:'9px 13px',textAlign:'left',fontSize:10.5,fontWeight:700,color:'#94a3b8',letterSpacing:.5,textTransform:'uppercase',borderBottom:'1px solid #f1f5f9'}}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {todaySalaryCredits.map(s=>{
                        const rc=RC[s.employee?.role]||'#64748b';
                        return (
                          <tr key={s._id} style={{borderBottom:'1px solid #f8fafc'}}>
                            <td style={{padding:'9px 13px',fontSize:12.5,fontWeight:600,color:'#0f172a'}}>{s.employee?.name}</td>
                            <td style={{padding:'9px 13px'}}><span style={{padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:700,background:`${rc}18`,color:rc,textTransform:'capitalize'}}>{s.employee?.role?.replace('_',' ')}</span></td>
                            <td style={{padding:'9px 13px',fontWeight:800,color:'#059669',fontSize:13}}>{INR(s.netPay)}</td>
                            <td style={{padding:'9px 13px',fontSize:11.5,color:'#64748b',fontFamily:'monospace'}}>{s.bankAccount||'—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TRANSACTIONS */}
        {tab==='transactions'&&(
          <div style={{background:'#fff',border:'1px solid #e8edf3',borderRadius:16,overflow:'hidden'}}>
            <div style={{padding:'13px 18px',borderBottom:'1px solid #f1f5f9',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:8}}>
              <span style={{fontWeight:800,fontSize:15,color:'#0f172a'}}>💳 All Patient Payments ({payments.filter(p=>p.status==='success').length} successful)</span>
              <button onClick={exportTransactions} style={{padding:'7px 14px',borderRadius:9,border:'1.5px solid #e2e8f0',background:'#fff',color:'#374151',fontFamily:'inherit',fontWeight:700,fontSize:12,cursor:'pointer'}}>⬇️ Export CSV</button>
            </div>
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead><tr style={{background:'#f8fafc'}}>
                  {['Receipt','Patient','Type','Amount','Method','Date','Status'].map(h=>(
                    <th key={h} style={{padding:'9px 13px',textAlign:'left',fontSize:10.5,fontWeight:700,color:'#94a3b8',letterSpacing:.5,textTransform:'uppercase',borderBottom:'1px solid #f1f5f9',whiteSpace:'nowrap'}}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {payments.slice(0,50).map((p,i)=>(
                    <tr key={p._id} style={{borderBottom:'1px solid #f8fafc'}}
                      onMouseEnter={e=>e.currentTarget.style.background='#fafbfc'}
                      onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                      <td style={{padding:'9px 13px',fontFamily:'monospace',fontSize:11,color:'#64748b'}}>{p.receiptNo||'—'}</td>
                      <td style={{padding:'9px 13px',fontSize:12.5,fontWeight:600,color:'#0f172a'}}>{p.user?.name||'—'}</td>
                      <td style={{padding:'9px 13px'}}><span style={{padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:700,background:'#ecfeff',color:'#0e7490'}}>{p.type}</span></td>
                      <td style={{padding:'9px 13px',fontWeight:800,color:'#059669',fontSize:13}}>{INR(p.amount)}</td>
                      <td style={{padding:'9px 13px',fontSize:12,color:'#64748b',textTransform:'capitalize'}}>{p.method?.replace('_',' ')}{p.cardLast4?` ••••${p.cardLast4}`:''}</td>
                      <td style={{padding:'9px 13px',fontSize:11.5,color:'#64748b',whiteSpace:'nowrap'}}>{p.paidAt?new Date(p.paidAt).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}):'—'}</td>
                      <td style={{padding:'9px 13px'}}><span style={{padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:700,background:p.status==='success'?'#dcfce7':p.status==='failed'?'#fee2e2':'#fef3c7',color:p.status==='success'?'#15803d':p.status==='failed'?'#dc2626':'#92400e'}}>{p.status}</span></td>
                    </tr>
                  ))}
                  {payments.length===0&&<tr><td colSpan={7} style={{padding:48,textAlign:'center',color:'#94a3b8'}}>No transactions found</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* STAFF ACCOUNTS */}
        {tab==='accounts'&&(
          <div style={{background:'#fff',border:'1px solid #e8edf3',borderRadius:16,overflow:'hidden'}}>
            <div style={{padding:'13px 18px',borderBottom:'1px solid #f1f5f9',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:8}}>
              <span style={{fontWeight:800,fontSize:15,color:'#0f172a'}}>🏦 Staff Bank Account Details ({staff.length})</span>
              <span style={{fontSize:11.5,color:'#94a3b8'}}>For salary credit verification — pulled from each staff member's profile</span>
            </div>
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead><tr style={{background:'#f8fafc'}}>
                  {['Employee','Role','Account Number','IFSC','Bank Name','Status'].map(h=>(
                    <th key={h} style={{padding:'9px 13px',textAlign:'left',fontSize:10.5,fontWeight:700,color:'#94a3b8',letterSpacing:.5,textTransform:'uppercase',borderBottom:'1px solid #f1f5f9',whiteSpace:'nowrap'}}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {staff.map(s=>{
                    const rc=RC[s.role]||'#64748b';
                    const hasBank = !!(s.bankDetails?.accountNumber && s.bankDetails?.ifsc);
                    return (
                      <tr key={s._id} style={{borderBottom:'1px solid #f8fafc'}}
                        onMouseEnter={e=>e.currentTarget.style.background='#fafbfc'}
                        onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                        <td style={{padding:'10px 13px'}}>
                          <div style={{display:'flex',alignItems:'center',gap:9}}>
                            <div style={{width:30,height:30,borderRadius:9,background:`linear-gradient(135deg,${rc},${rc}99)`,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:700,fontSize:11}}>{ini(s.name)}</div>
                            <div><div style={{fontWeight:700,color:'#0f172a',fontSize:12.5}}>{s.name}</div><div style={{fontSize:10.5,color:'#94a3b8'}}>{s.email}</div></div>
                          </div>
                        </td>
                        <td style={{padding:'10px 13px'}}><span style={{padding:'2px 8px',borderRadius:20,fontSize:10.5,fontWeight:700,background:`${rc}18`,color:rc,textTransform:'capitalize'}}>{s.role?.replace('_',' ')}</span></td>
                        <td style={{padding:'10px 13px',fontSize:12.5,color:'#374151',fontFamily:'monospace'}}>{s.bankDetails?.accountNumber ? `••••${s.bankDetails.accountNumber.slice(-4)}` : '—'}</td>
                        <td style={{padding:'10px 13px',fontSize:12,color:'#374151',fontFamily:'monospace'}}>{s.bankDetails?.ifsc || '—'}</td>
                        <td style={{padding:'10px 13px',fontSize:12.5,color:'#374151'}}>{s.bankDetails?.bankName || '—'}</td>
                        <td style={{padding:'10px 13px'}}>
                          <span style={{padding:'3px 9px',borderRadius:20,fontSize:11,fontWeight:700,background:hasBank?'#dcfce7':'#fef3c7',color:hasBank?'#15803d':'#92400e'}}>
                            {hasBank?'✅ On File':'⚠️ Incomplete'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {staff.length===0&&<tr><td colSpan={6} style={{padding:48,textAlign:'center',color:'#94a3b8'}}>No staff found</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* REPORTS */}
        {tab==='reports'&&(
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:18}}>
            {[{title:'Salary by Role',icon:'💰',data:Object.keys(RC).filter(r=>r!=='patient').map(r=>({label:r.replace('_',' '),val:salaries.filter(s=>s.employee?.role===r).reduce((t,s)=>t+(s.netPay||0),0),color:RC[r]}))},
              {title:'Revenue by Type',icon:'💳',data:[{label:'Appointments',val:payments.filter(p=>p.type==='appointment'&&p.status==='success').reduce((t,p)=>t+p.amount,0),color:'#0891b2'},{label:'Pharmacy',val:payments.filter(p=>p.type==='pharmacy'&&p.status==='success').reduce((t,p)=>t+p.amount,0),color:'#059669'},{label:'Lab',val:payments.filter(p=>p.type==='lab'&&p.status==='success').reduce((t,p)=>t+p.amount,0),color:'#8b5cf6'}]}
            ].map((r,ri)=>(
              <div key={ri} style={{background:'#fff',border:'1px solid #e8edf3',borderRadius:16,padding:'18px 22px'}}>
                <div style={{fontWeight:800,fontSize:15,color:'#0f172a',marginBottom:14}}>{r.icon} {r.title}</div>
                {r.data.filter(d=>d.val>0).map((d,i)=>{
                  const max=Math.max(...r.data.map(x=>x.val),1);
                  return(
                    <div key={i} style={{marginBottom:10}}>
                      <div style={{display:'flex',justifyContent:'space-between',marginBottom:4,fontSize:12}}>
                        <span style={{fontWeight:600,color:'#374151',textTransform:'capitalize'}}>{d.label}</span>
                        <span style={{fontWeight:800,color:d.color}}>{INR(d.val)}</span>
                      </div>
                      <div style={{height:7,background:'#f1f5f9',borderRadius:4,overflow:'hidden'}}>
                        <motion.div initial={{width:0}} animate={{width:`${(d.val/max)*100}%`}} transition={{duration:.8,ease:'easeOut'}} style={{height:'100%',background:d.color,borderRadius:4}}/>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
            <div style={{background:'#fff',border:'1px solid #e8edf3',borderRadius:16,padding:'18px 22px',gridColumn:'1/-1'}}>
              <div style={{fontWeight:800,fontSize:15,color:'#0f172a',marginBottom:14}}>📋 Financial Summary</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:10}}>
                {[['Staff Enrolled',staff.length+' staff','#6366f1'],['Gross Payroll',INR(totalGross),'#0891b2'],['Net Payout',INR(totalNet),'#059669'],['Deductions',INR(totalDed),'#ef4444'],['Patient Revenue',INR(payRevenue),'#8b5cf6'],['Pending Credits',pending.length+' records','#f59e0b']].map(([l,v,c])=>(
                  <div key={l} style={{background:'#f8fafc',borderRadius:11,padding:'13px',borderLeft:`3px solid ${c}`}}>
                    <div style={{fontSize:11,color:'#94a3b8',marginBottom:4}}>{l}</div>
                    <div style={{fontSize:15,fontWeight:900,color:c}}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        </div>
      </div>

      {/* PAY SLIP MODAL */}
      <AnimatePresence>
        {selSalary&&(
          <div onClick={e=>{if(e.target===e.currentTarget)setSelSalary(null)}} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.6)',backdropFilter:'blur(5px)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16,overflowY:'auto'}}>
            <motion.div initial={{opacity:0,y:24,scale:.96}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:24,scale:.96}} style={{background:'#fff',borderRadius:24,width:'100%',maxWidth:580,boxShadow:'0 40px 100px rgba(0,0,0,.3)',overflow:'hidden'}}>
              <div style={{background:'linear-gradient(135deg,#1e1b4b,#4c1d95)',padding:'22px 28px'}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
                  <div style={{color:'rgba(255,255,255,.6)',fontSize:11,letterSpacing:1,textTransform:'uppercase'}}>💼 Pay Slip · {MO[(selSalary.month||1)-1]} {selSalary.year}</div>
                  <button onClick={()=>setSelSalary(null)} style={{background:'rgba(255,255,255,.2)',border:'none',borderRadius:'50%',width:28,height:28,cursor:'pointer',color:'#fff',fontSize:13,display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
                </div>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:12}}>
                  <div style={{display:'flex',alignItems:'center',gap:14}}>
                    <div style={{width:50,height:50,borderRadius:14,background:'rgba(255,255,255,.2)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:800,fontSize:18}}>{ini(selSalary.employee?.name)}</div>
                    <div><div style={{color:'#fff',fontWeight:800,fontSize:17}}>{selSalary.employee?.name}</div><div style={{color:'rgba(255,255,255,.65)',fontSize:12}}>{selSalary.employee?.role?.replace('_',' ')} · {selSalary.employee?.department||'Hospital'}</div></div>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <div style={{color:'rgba(255,255,255,.6)',fontSize:11}}>Net Pay</div>
                    <div style={{color:'#fff',fontWeight:900,fontSize:28,fontFamily:'monospace'}}>{INR(selSalary.netPay)}</div>
                    <span style={{padding:'2px 9px',borderRadius:20,fontSize:11,fontWeight:700,background:STATUS[selSalary.status]?.bg,color:STATUS[selSalary.status]?.c}}>{selSalary.status}</span>
                  </div>
                </div>
              </div>
              <div style={{padding:'20px 28px'}}>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:14}}>
                  <div style={{background:'#f0fdf4',borderRadius:12,padding:'14px'}}>
                    <div style={{fontWeight:800,color:'#15803d',marginBottom:8,fontSize:13}}>💚 Earnings</div>
                    {[['Basic',selSalary.basicPay],['HRA',selSalary.allowances?.hra],['DA',selSalary.allowances?.da],['Travel',selSalary.allowances?.ta],['Medical',selSalary.allowances?.medical],['Special',selSalary.allowances?.special],['Overtime',selSalary.overtimePay]].filter(([,v])=>v>0).map(([l,v])=>(
                      <div key={l} style={{display:'flex',justifyContent:'space-between',padding:'3px 0',borderBottom:'1px solid #dcfce7',fontSize:12.5}}><span style={{color:'#374151'}}>{l}</span><span style={{fontWeight:700,color:'#15803d'}}>{INR(v)}</span></div>
                    ))}
                    <div style={{display:'flex',justifyContent:'space-between',padding:'7px 0 0',fontWeight:900,color:'#059669',fontSize:13}}><span>Gross</span><span>{INR(selSalary.grossPay)}</span></div>
                  </div>
                  <div style={{background:'#fef2f2',borderRadius:12,padding:'14px'}}>
                    <div style={{fontWeight:800,color:'#dc2626',marginBottom:8,fontSize:13}}>❤️ Deductions</div>
                    {[['PF',selSalary.deductions?.pf],['ESI',selSalary.deductions?.esi],['TDS',selSalary.deductions?.tax],['Absent',selSalary.deductions?.absent],['Loan',selSalary.deductions?.loan],['Other',selSalary.deductions?.other]].filter(([,v])=>v>0).map(([l,v])=>(
                      <div key={l} style={{display:'flex',justifyContent:'space-between',padding:'3px 0',borderBottom:'1px solid #fecaca',fontSize:12.5}}><span style={{color:'#374151'}}>{l}</span><span style={{fontWeight:700,color:'#dc2626'}}>-{INR(v)}</span></div>
                    ))}
                    <div style={{display:'flex',justifyContent:'space-between',padding:'7px 0 0',fontWeight:900,color:'#dc2626',fontSize:13}}><span>Total</span><span>-{INR(Object.values(selSalary.deductions||{}).reduce((a,b)=>a+b,0))}</span></div>
                  </div>
                </div>
                <div style={{background:'linear-gradient(135deg,#f5f3ff,#eff6ff)',border:'1.5px solid #c4b5fd',borderRadius:12,padding:'13px 16px',display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
                  <div><div style={{fontWeight:800,color:'#4c1d95',fontSize:14}}>💰 Net Take Home</div><div style={{fontSize:12,color:'#7c3aed',marginTop:1}}>{selSalary.paymentMode?.replace('_',' ')} · {MO[(selSalary.month||1)-1]} {selSalary.year}</div></div>
                  <div style={{fontSize:24,fontWeight:900,color:'#4c1d95',fontFamily:'monospace'}}>{INR(selSalary.netPay)}</div>
                </div>
                <div style={{display:'flex',gap:9}}>
                  {(selSalary.status==='pending'||selSalary.status==='failed')&&<button onClick={()=>handleCredit(selSalary._id,selSalary.employee?.name)} disabled={!!creditingId} style={{flex:2,padding:'11px',borderRadius:12,border:'none',background:selSalary.status==='failed'?'linear-gradient(135deg,#dc2626,#f87171)':'linear-gradient(135deg,#059669,#34d399)',color:'#fff',fontFamily:'inherit',fontWeight:800,cursor:'pointer',fontSize:14}}>{selSalary.status==='failed'?'🔁 Retry Credit':'💳 Credit Salary'}</button>}
                  {(selSalary.status==='pending'||selSalary.status==='failed')&&<button onClick={()=>openPayModal(selSalary)} style={{flex:1,padding:'11px',borderRadius:12,border:'1.5px solid #fde68a',background:'#fffbeb',color:'#92400e',fontFamily:'inherit',fontWeight:700,cursor:'pointer',fontSize:13}}>💵 Cash/Cheque</button>}
                  {selSalary.status==='failed'&&selSalary.failureReason&&<div style={{width:'100%',marginTop:8,background:'#fef2f2',border:'1px solid #fecaca',borderRadius:10,padding:'8px 12px',fontSize:12,color:'#b91c1c'}}>⚠️ {selSalary.failureReason} — employee has been emailed to update bank details.</div>}
                  <button onClick={()=>setSelSalary(null)} style={{flex:1,padding:'11px',borderRadius:12,border:'1.5px solid #e2e8f0',background:'#fff',fontFamily:'inherit',fontWeight:700,cursor:'pointer'}}>Close</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* GENERATE MODAL */}
      <AnimatePresence>
        {showGen&&(
          <div onClick={e=>{if(e.target===e.currentTarget)setShowGen(false)}} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.6)',backdropFilter:'blur(4px)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16,overflowY:'auto'}}>
            <motion.div initial={{opacity:0,y:22,scale:.96}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:22,scale:.96}} style={{background:'#fff',borderRadius:24,width:'100%',maxWidth:500,boxShadow:'0 32px 80px rgba(0,0,0,.25)',overflow:'hidden'}}>
              <div style={{background:'linear-gradient(135deg,#1e1b4b,#4c1d95)',padding:'18px 24px'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <h2 style={{color:'#fff',fontWeight:800,fontSize:17,margin:0}}>{genAll?'⚡ Bulk Generate':'💰 Generate Salary'}</h2>
                  <button onClick={()=>setShowGen(false)} style={{background:'rgba(255,255,255,.2)',border:'none',borderRadius:'50%',width:28,height:28,cursor:'pointer',color:'#fff',fontSize:13,display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
                </div>
              </div>
              <div style={{padding:'22px 24px'}}>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:11}}>
                  <div><label style={LBL}>Month</label><select value={genForm.month} onChange={e=>setGenForm(f=>({...f,month:Number(e.target.value)}))} style={INPSTYLE}>{MO.map((m,i)=><option key={i} value={i+1}>{m}</option>)}</select></div>
                  <div><label style={LBL}>Year</label><select value={genForm.year} onChange={e=>setGenForm(f=>({...f,year:Number(e.target.value)}))} style={INPSTYLE}>{years.map(y=><option key={y}>{y}</option>)}</select></div>
                  {!genAll&&<>
                    <div style={{gridColumn:'1/-1'}}><label style={LBL}>Employee *</label><select value={genForm.employeeId} onChange={e=>setGenForm(f=>({...f,employeeId:e.target.value}))} style={INPSTYLE}><option value=''>Select…</option>{staff.map(s=><option key={s._id} value={s._id}>{s.name} ({s.role?.replace('_',' ')}) · Base: {INR(BASE_PAY[s.role]||30000)}</option>)}</select></div>
                    {[['Days Worked','daysWorked'],['Days Absent','daysAbsent'],['OT Hours','overtimeHours'],['Bonus (₹)','bonus'],['Loan (₹)','loan'],['Other Ded.','otherDed']].map(([l,k])=>(
                      <div key={k}><label style={LBL}>{l}</label><input type='number' min={0} value={genForm[k]||0} onChange={e=>setGenForm(f=>({...f,[k]:Number(e.target.value)}))} style={INPSTYLE}/></div>
                    ))}
                    <div><label style={LBL}>Payment Mode</label><select value={genForm.paymentMode} onChange={e=>setGenForm(f=>({...f,paymentMode:e.target.value}))} style={INPSTYLE}><option value='bank_transfer'>Bank Transfer</option><option value='cheque'>Cheque</option><option value='cash'>Cash</option></select></div>
                    <div><label style={LBL}>Bank Account</label><input value={genForm.bankAccount} onChange={e=>setGenForm(f=>({...f,bankAccount:e.target.value}))} placeholder='XXXX XXXX' style={INPSTYLE}/></div>
                    {selStaff&&<div style={{gridColumn:'1/-1',background:'#f5f3ff',border:'1px solid #ddd6fe',borderRadius:10,padding:'9px 13px',fontSize:12.5}}><span style={{fontWeight:700,color:'#7c3aed'}}>Est. Net: </span><span style={{fontWeight:900,color:'#4c1d95'}}>{INR(Math.round((BASE_PAY[selStaff.role]||30000)*.72))}</span></div>}
                  </>}
                </div>
                {genAll&&<div style={{background:'#fef3c7',border:'1px solid #fde68a',borderRadius:10,padding:'11px',marginTop:12,fontSize:12.5,color:'#92400e'}}>⚡ Generates for all {staff.length} staff using default calculations.</div>}
                <div style={{display:'flex',gap:9,marginTop:16}}>
                  <button onClick={()=>setShowGen(false)} style={{flex:1,padding:'11px',borderRadius:12,border:'1.5px solid #e2e8f0',background:'#fff',fontFamily:'inherit',fontWeight:700,cursor:'pointer'}}>Cancel</button>
                  <button onClick={handleGen} disabled={saving} style={{flex:2,padding:'11px',borderRadius:12,border:'none',background:'linear-gradient(135deg,#8b5cf6,#6366f1)',color:'#fff',fontFamily:'inherit',fontWeight:800,cursor:'pointer',fontSize:14,display:'flex',alignItems:'center',justifyContent:'center',gap:7}}>
                    {saving?<><div style={{width:14,height:14,border:'2px solid rgba(255,255,255,.3)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin .7s linear infinite'}}/>Saving…</>:genAll?'⚡ Generate All':'💰 Generate'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* EDIT SALARY MODAL */}
      <AnimatePresence>
        {editId&&(
          <div onClick={e=>{if(e.target===e.currentTarget)setEditId(null)}} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.6)',backdropFilter:'blur(4px)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1001,padding:16}}>
            <motion.div initial={{opacity:0,y:20,scale:.96}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:20,scale:.96}} style={{background:'#fff',borderRadius:22,width:'100%',maxWidth:460,boxShadow:'0 32px 80px rgba(0,0,0,.25)',padding:'24px'}}>
              <h3 style={{fontSize:17,fontWeight:800,margin:'0 0 16px'}}>✏️ Edit Salary</h3>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:11}}>
                {[['Basic Pay (₹)','basicPay'],['Days Worked','daysWorked'],['Days Absent','daysAbsent'],['OT Hours','overtimeHours'],['Bonus (₹)','bonus'],['Loan (₹)','loan'],['Other Ded.','otherDed']].map(([l,k])=>(
                  <div key={k}><label style={LBL}>{l}</label><input type='number' min={0} value={editForm[k]||0} onChange={e=>setEditForm(f=>({...f,[k]:Number(e.target.value)}))} style={INPSTYLE}/></div>
                ))}
              </div>
              <div style={{display:'flex',gap:9,marginTop:16}}>
                <button onClick={()=>setEditId(null)} style={{flex:1,padding:'11px',borderRadius:12,border:'1.5px solid #e2e8f0',background:'#fff',fontFamily:'inherit',fontWeight:700,cursor:'pointer'}}>Cancel</button>
                <button onClick={handleSaveEdit} disabled={saving} style={{flex:2,padding:'11px',borderRadius:12,border:'none',background:'linear-gradient(135deg,#8b5cf6,#6366f1)',color:'#fff',fontFamily:'inherit',fontWeight:800,cursor:'pointer',fontSize:14,display:'flex',alignItems:'center',justifyContent:'center',gap:7}}>
                  {saving?<><div style={{width:14,height:14,border:'2px solid rgba(255,255,255,.3)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin .7s linear infinite'}}/>Saving…</>:'💾 Save & Recalculate'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CASH/CHEQUE MANUAL PAY MODAL */}
      <AnimatePresence>
        {payModal&&(
          <div onClick={e=>{if(e.target===e.currentTarget)setPayModal(null)}} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.6)',backdropFilter:'blur(4px)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1002,padding:16,overflowY:'auto'}}>
            <motion.div initial={{opacity:0,y:20,scale:.96}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:20,scale:.96}} style={{background:'#fff',borderRadius:22,width:'100%',maxWidth:440,boxShadow:'0 32px 80px rgba(0,0,0,.25)',padding:'24px'}}>
              <h3 style={{fontSize:17,fontWeight:800,margin:'0 0 4px'}}>💵 Pay {payModal.employee?.name} Manually</h3>
              <div style={{fontSize:12.5,color:'#64748b',marginBottom:16}}>Hand over {INR(payModal.netPay)} directly instead of a bank transfer.</div>
              <form onSubmit={submitManualPay}>
                <div style={{marginBottom:11}}><label style={LBL}>Payment Mode</label>
                  <select value={payMode} onChange={e=>setPayMode(e.target.value)} style={INPSTYLE}>
                    <option value="cash">Cash</option>
                    <option value="cheque">Cheque</option>
                  </select>
                </div>
                {payMode==='cash'?(
                  <>
                    <div style={{marginBottom:11}}><label style={LBL}>Receipt Number *</label><input required value={payRef} onChange={e=>setPayRef(e.target.value)} placeholder="e.g. RCPT-2026-00123" style={INPSTYLE}/></div>
                    <div style={{marginBottom:11}}><label style={LBL}>Paid To (optional)</label><input value={payeeName} onChange={e=>setPayeeName(e.target.value)} placeholder="Name of person who collected the cash" style={INPSTYLE}/></div>
                  </>
                ):(
                  <>
                    <div style={{marginBottom:11}}><label style={LBL}>Cheque Number *</label><input required value={payRef} onChange={e=>setPayRef(e.target.value)} placeholder="e.g. 000123" style={INPSTYLE}/></div>
                    <div style={{marginBottom:11}}><label style={LBL}>Bank Name *</label><input required value={chequeBankName} onChange={e=>setChequeBankName(e.target.value)} placeholder="e.g. State Bank of India" style={INPSTYLE}/></div>
                    <div style={{marginBottom:11}}><label style={LBL}>Branch (optional)</label><input value={chequeBranch} onChange={e=>setChequeBranch(e.target.value)} placeholder="e.g. MG Road Branch" style={INPSTYLE}/></div>
                    <div style={{marginBottom:11}}><label style={LBL}>Cheque Date *</label><input type="date" required value={chequeDate} onChange={e=>setChequeDate(e.target.value)} style={INPSTYLE}/></div>
                    <div style={{marginBottom:11}}><label style={LBL}>Payee Name (optional)</label><input value={payeeName} onChange={e=>setPayeeName(e.target.value)} placeholder="Name printed on the cheque" style={INPSTYLE}/></div>
                  </>
                )}
                <div style={{marginBottom:16}}><label style={LBL}>Notes (optional)</label><textarea rows={2} value={payNotes} onChange={e=>setPayNotes(e.target.value)} style={INPSTYLE}/></div>
                <div style={{display:'flex',gap:9}}>
                  <button type="button" onClick={()=>setPayModal(null)} style={{flex:1,padding:'11px',borderRadius:12,border:'1.5px solid #e2e8f0',background:'#fff',fontFamily:'inherit',fontWeight:700,cursor:'pointer'}}>Cancel</button>
                  <button type="submit" disabled={paying} style={{flex:2,padding:'11px',borderRadius:12,border:'none',background:'linear-gradient(135deg,#8b5cf6,#6366f1)',color:'#fff',fontFamily:'inherit',fontWeight:800,cursor:'pointer',fontSize:14}}>{paying?'Saving…':`✓ Mark Paid (${payMode})`}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* INSURANCE CLAIM REVIEW MODAL */}
      <AnimatePresence>
        {reviewClaim&&(
          <div onClick={e=>{if(e.target===e.currentTarget)setReviewClaim(null)}} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.6)',backdropFilter:'blur(4px)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1002,padding:16,overflowY:'auto'}}>
            <motion.div initial={{opacity:0,y:20,scale:.96}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:20,scale:.96}} style={{background:'#fff',borderRadius:22,width:'100%',maxWidth:460,boxShadow:'0 32px 80px rgba(0,0,0,.25)',padding:24}}>
              <h3 style={{fontSize:17,fontWeight:800,margin:'0 0 4px'}}>🛡️ Review Claim — {reviewClaim.patient?.name}</h3>
              <div style={{fontSize:12.5,color:'#64748b',marginBottom:6}}>{reviewClaim.policy?.provider} — {reviewClaim.policy?.policyNumber} · Sum Insured {INR(reviewClaim.policy?.sumInsured)}</div>
              <div style={{background:'#f8fafc',borderRadius:10,padding:'10px 13px',marginBottom:16,fontSize:12.5,color:'#374151'}}>
                <div><strong>Claimed:</strong> {INR(reviewClaim.claimAmount)}</div>
                <div style={{marginTop:4}}><strong>Reason:</strong> {reviewClaim.reason}</div>
              </div>
              <form onSubmit={submitReview}>
                <div style={{marginBottom:11}}><label style={LBL}>Decision</label>
                  <select value={reviewDecision} onChange={e=>setReviewDecision(e.target.value)} style={INPSTYLE}>
                    <option value="approved">✅ Approve</option>
                    <option value="rejected">❌ Reject</option>
                    <option value="under_review">🔍 Keep Under Review (need more info)</option>
                  </select>
                </div>
                {reviewDecision==='approved'&&(
                  <div style={{marginBottom:11}}><label style={LBL}>Approved Amount (₹) *</label><input type="number" required min="1" max={reviewClaim.claimAmount} value={reviewAmount} onChange={e=>setReviewAmount(e.target.value)} style={INPSTYLE}/></div>
                )}
                <div style={{marginBottom:16}}><label style={LBL}>Notes to Patient (optional)</label><textarea rows={3} value={reviewNotes} onChange={e=>setReviewNotes(e.target.value)} style={INPSTYLE} placeholder="e.g. Partially approved due to sub-limit on room rent"/></div>
                <div style={{display:'flex',gap:9}}>
                  <button type="button" onClick={()=>setReviewClaim(null)} style={{flex:1,padding:11,borderRadius:12,border:'1.5px solid #e2e8f0',background:'#fff',fontFamily:'inherit',fontWeight:700,cursor:'pointer'}}>Cancel</button>
                  <button type="submit" disabled={reviewing} style={{flex:2,padding:11,borderRadius:12,border:'none',background:'linear-gradient(135deg,#7c3aed,#6366f1)',color:'#fff',fontFamily:'inherit',fontWeight:800,cursor:'pointer',fontSize:14}}>{reviewing?'Saving…':'✓ Submit Decision'}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ADD/EDIT EXPENSE MODAL */}
      <AnimatePresence>
        {expModal&&(
          <div onClick={e=>{if(e.target===e.currentTarget)setExpModal(null)}} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.6)',backdropFilter:'blur(4px)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1002,padding:16,overflowY:'auto'}}>
            <motion.div initial={{opacity:0,y:20,scale:.96}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:20,scale:.96}} style={{background:'#fff',borderRadius:22,width:'100%',maxWidth:460,boxShadow:'0 32px 80px rgba(0,0,0,.25)',padding:24,maxHeight:'88vh',overflowY:'auto'}}>
              <h3 style={{fontSize:17,fontWeight:800,margin:'0 0 16px'}}>{expModal._id?'✏️ Edit':'🧮 Add'} Expense</h3>
              <form onSubmit={submitExpense}>
                <div style={{marginBottom:11}}><label style={LBL}>Category</label>
                  <select value={expForm.category} onChange={e=>setExpForm(f=>({...f,category:e.target.value}))} style={INPSTYLE}>
                    {EXP_CATS.map(c=><option key={c} value={c}>{CATS[c].i} {CATS[c].l}</option>)}
                  </select>
                </div>
                <div style={{marginBottom:11}}><label style={LBL}>Description *</label><input required value={expForm.description} onChange={e=>setExpForm(f=>({...f,description:e.target.value}))} placeholder="e.g. Monthly electricity bill" style={INPSTYLE}/></div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:11}}>
                  <div><label style={LBL}>Amount (₹) *</label><input type="number" required min="1" value={expForm.amount} onChange={e=>setExpForm(f=>({...f,amount:e.target.value}))} style={INPSTYLE}/></div>
                  <div><label style={LBL}>Date</label><input type="date" value={expForm.expenseDate} onChange={e=>setExpForm(f=>({...f,expenseDate:e.target.value}))} style={INPSTYLE}/></div>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:11}}>
                  <div><label style={LBL}>Vendor</label><input value={expForm.vendor||''} onChange={e=>setExpForm(f=>({...f,vendor:e.target.value}))} style={INPSTYLE}/></div>
                  <div><label style={LBL}>Department</label><input value={expForm.department||''} onChange={e=>setExpForm(f=>({...f,department:e.target.value}))} style={INPSTYLE}/></div>
                </div>
                <div style={{marginBottom:11}}><label style={LBL}>Payment Mode</label>
                  <select value={expForm.paymentMode} onChange={e=>setExpForm(f=>({...f,paymentMode:e.target.value}))} style={INPSTYLE}>
                    <option value="cash">Cash</option><option value="cheque">Cheque</option><option value="bank_transfer">Bank Transfer</option><option value="upi">UPI</option><option value="card">Card</option>
                  </select>
                </div>
                {expForm.paymentMode==='cash'&&(
                  <div style={{marginBottom:11}}><label style={LBL}>Receipt Number *</label><input required value={expForm.receiptNumber||''} onChange={e=>setExpForm(f=>({...f,receiptNumber:e.target.value}))} style={INPSTYLE}/></div>
                )}
                {expForm.paymentMode==='cheque'&&(
                  <>
                    <div style={{marginBottom:11}}><label style={LBL}>Cheque Number *</label><input required value={expForm.chequeNumber||''} onChange={e=>setExpForm(f=>({...f,chequeNumber:e.target.value}))} style={INPSTYLE}/></div>
                    <div style={{marginBottom:11}}><label style={LBL}>Bank Name *</label><input required value={expForm.chequeBankName||''} onChange={e=>setExpForm(f=>({...f,chequeBankName:e.target.value}))} style={INPSTYLE}/></div>
                    <div style={{marginBottom:11}}><label style={LBL}>Cheque Date *</label><input type="date" required value={expForm.chequeDate||''} onChange={e=>setExpForm(f=>({...f,chequeDate:e.target.value}))} style={INPSTYLE}/></div>
                  </>
                )}
                <div style={{marginBottom:16}}><label style={LBL}>Notes</label><textarea rows={2} value={expForm.notes||''} onChange={e=>setExpForm(f=>({...f,notes:e.target.value}))} style={INPSTYLE}/></div>
                <div style={{display:'flex',gap:9}}>
                  <button type="button" onClick={()=>setExpModal(null)} style={{flex:1,padding:11,borderRadius:12,border:'1.5px solid #e2e8f0',background:'#fff',fontFamily:'inherit',fontWeight:700,cursor:'pointer'}}>Cancel</button>
                  <button type="submit" disabled={savingExp} style={{flex:2,padding:11,borderRadius:12,border:'none',background:'linear-gradient(135deg,#dc2626,#f87171)',color:'#fff',fontFamily:'inherit',fontWeight:800,cursor:'pointer',fontSize:14}}>{savingExp?'Saving…':'✓ Save Expense'}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SET BUDGET MODAL */}
      <AnimatePresence>
        {budgetModal&&(
          <div onClick={e=>{if(e.target===e.currentTarget)setBudgetModal(null)}} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.6)',backdropFilter:'blur(4px)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1002,padding:16}}>
            <motion.div initial={{opacity:0,y:20,scale:.96}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:20,scale:.96}} style={{background:'#fff',borderRadius:22,width:'100%',maxWidth:400,boxShadow:'0 32px 80px rgba(0,0,0,.25)',padding:24}}>
              <h3 style={{fontSize:17,fontWeight:800,margin:'0 0 4px'}}>{CATS[budgetModal].i} {CATS[budgetModal].l} Budget</h3>
              <div style={{fontSize:12.5,color:'#64748b',marginBottom:16}}>{MO[selMonth-1]} {selYear}</div>
              <form onSubmit={submitBudget}>
                <div style={{marginBottom:11}}><label style={LBL}>Allocated Amount (₹) *</label><input type="number" required min="0" value={budgetAmount} onChange={e=>setBudgetAmount(e.target.value)} style={INPSTYLE}/></div>
                <div style={{marginBottom:16}}><label style={LBL}>Notes (optional)</label><textarea rows={2} value={budgetNotes} onChange={e=>setBudgetNotes(e.target.value)} style={INPSTYLE}/></div>
                <div style={{display:'flex',gap:9}}>
                  <button type="button" onClick={()=>setBudgetModal(null)} style={{flex:1,padding:11,borderRadius:12,border:'1.5px solid #e2e8f0',background:'#fff',fontFamily:'inherit',fontWeight:700,cursor:'pointer'}}>Cancel</button>
                  <button type="submit" disabled={savingBudget} style={{flex:2,padding:11,borderRadius:12,border:'none',background:'linear-gradient(135deg,#8b5cf6,#6366f1)',color:'#fff',fontFamily:'inherit',fontWeight:800,cursor:'pointer',fontSize:14}}>{savingBudget?'Saving…':'✓ Save Budget'}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CREATE MANUAL INVOICE MODAL */}
      <AnimatePresence>
        {invoiceModal&&(
          <div onClick={e=>{if(e.target===e.currentTarget)setInvoiceModal(false)}} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.6)',backdropFilter:'blur(4px)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1002,padding:16,overflowY:'auto'}}>
            <motion.div initial={{opacity:0,y:20,scale:.96}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:20,scale:.96}} style={{background:'#fff',borderRadius:22,width:'100%',maxWidth:440,boxShadow:'0 32px 80px rgba(0,0,0,.25)',padding:24}}>
              <h3 style={{fontSize:17,fontWeight:800,margin:'0 0 16px'}}>🧾 Create Manual Invoice</h3>
              <form onSubmit={submitInvoice}>
                <div style={{marginBottom:11}}><label style={LBL}>Patient *</label>
                  <select required value={invForm.patientId} onChange={e=>setInvForm(f=>({...f,patientId:e.target.value}))} style={INPSTYLE}>
                    <option value="">— Select patient —</option>
                    {patients.map(p=><option key={p._id} value={p._id}>{p.name} ({p.phone||p.email})</option>)}
                  </select>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:11}}>
                  <div><label style={LBL}>Amount (₹) *</label><input type="number" required min="1" value={invForm.amount} onChange={e=>setInvForm(f=>({...f,amount:e.target.value}))} style={INPSTYLE}/></div>
                  <div><label style={LBL}>Payment Mode</label>
                    <select value={invForm.method} onChange={e=>setInvForm(f=>({...f,method:e.target.value}))} style={INPSTYLE}>
                      <option value="cash">Cash</option><option value="upi">UPI</option><option value="card">Card</option><option value="netbanking">Net Banking</option>
                    </select>
                  </div>
                </div>
                <div style={{marginBottom:11}}><label style={LBL}>Description *</label><input required value={invForm.description} onChange={e=>setInvForm(f=>({...f,description:e.target.value}))} placeholder="e.g. Wheelchair rental, misc procedure charge" style={INPSTYLE}/></div>
                <div style={{marginBottom:16}}><label style={LBL}>Notes (optional)</label><textarea rows={2} value={invForm.notes} onChange={e=>setInvForm(f=>({...f,notes:e.target.value}))} style={INPSTYLE}/></div>
                <div style={{display:'flex',gap:9}}>
                  <button type="button" onClick={()=>setInvoiceModal(false)} style={{flex:1,padding:11,borderRadius:12,border:'1.5px solid #e2e8f0',background:'#fff',fontFamily:'inherit',fontWeight:700,cursor:'pointer'}}>Cancel</button>
                  <button type="submit" disabled={savingInvoice} style={{flex:2,padding:11,borderRadius:12,border:'none',background:'linear-gradient(135deg,#8b5cf6,#6366f1)',color:'#fff',fontFamily:'inherit',fontWeight:800,cursor:'pointer',fontSize:14}}>{savingInvoice?'Creating…':'✓ Create & Mark Paid'}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* VIEW / PRINT INVOICE MODAL */}
      <AnimatePresence>
        {viewInvoice&&(
          <div onClick={e=>{if(e.target===e.currentTarget)setViewInvoice(null)}} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.6)',backdropFilter:'blur(4px)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1002,padding:16,overflowY:'auto'}}>
            <style>{`@media print { body * { visibility:hidden; } #invoice-print-area, #invoice-print-area * { visibility:visible; } #invoice-print-area { position:absolute; left:0; top:0; width:100%; } .no-print { display:none !important; } }`}</style>
            <motion.div initial={{opacity:0,y:20,scale:.96}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:20,scale:.96}} style={{background:'#fff',borderRadius:18,width:'100%',maxWidth:480,boxShadow:'0 32px 80px rgba(0,0,0,.25)',padding:0,overflow:'hidden'}}>
              <div id="invoice-print-area" style={{padding:28}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:18}}>
                  <div><div style={{fontWeight:900,fontSize:19,color:'#0f172a'}}>🏥 Mediventra</div><div style={{fontSize:11.5,color:'#94a3b8'}}>Official Payment Invoice</div></div>
                  <div style={{textAlign:'right'}}><div style={{fontSize:11,color:'#94a3b8'}}>Receipt No.</div><div style={{fontWeight:800,fontFamily:'monospace',fontSize:13}}>{viewInvoice.receiptNo||'—'}</div></div>
                </div>
                <div style={{borderTop:'1.5px dashed #e2e8f0',borderBottom:'1.5px dashed #e2e8f0',padding:'14px 0',marginBottom:14}}>
                  <Row2 label="Billed To">{viewInvoice.user?.name}</Row2>
                  <Row2 label="Contact">{viewInvoice.user?.phone||viewInvoice.user?.email||'—'}</Row2>
                  <Row2 label="Description">{viewInvoice.description||viewInvoice.type}</Row2>
                  <Row2 label="Payment Method"><span style={{textTransform:'capitalize'}}>{viewInvoice.method}</span></Row2>
                  <Row2 label="Date">{new Date(viewInvoice.paidAt||viewInvoice.createdAt).toLocaleString('en-IN')}</Row2>
                  <Row2 label="Status"><span style={{textTransform:'capitalize'}}>{viewInvoice.status}</span></Row2>
                </div>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <span style={{fontWeight:700,fontSize:14,color:'#0f172a'}}>Total Paid</span>
                  <span style={{fontWeight:900,fontSize:24,color:'#059669'}}>{INR(viewInvoice.amount)}</span>
                </div>
                <div style={{marginTop:18,fontSize:11,color:'#94a3b8',textAlign:'center'}}>This is a computer-generated invoice and does not require a signature.</div>
              </div>
              <div className="no-print" style={{display:'flex',gap:9,padding:'0 24px 24px'}}>
                <button onClick={()=>setViewInvoice(null)} style={{flex:1,padding:11,borderRadius:12,border:'1.5px solid #e2e8f0',background:'#fff',fontFamily:'inherit',fontWeight:700,cursor:'pointer'}}>Close</button>
                <button onClick={()=>window.print()} style={{flex:2,padding:11,borderRadius:12,border:'none',background:'linear-gradient(135deg,#7c3aed,#6366f1)',color:'#fff',fontFamily:'inherit',fontWeight:800,cursor:'pointer',fontSize:14}}>🖨️ Print / Save as PDF</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Row2({label,children}){
  return(
    <div style={{display:'flex',justifyContent:'space-between',padding:'4px 0',fontSize:12.5}}>
      <span style={{color:'#94a3b8'}}>{label}</span>
      <span style={{fontWeight:700,color:'#0f172a'}}>{children}</span>
    </div>
  );
}
