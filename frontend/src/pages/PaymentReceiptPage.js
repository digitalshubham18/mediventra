import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { paymentsAPI } from '../utils/api';
import toast from 'react-hot-toast';

const INR = v => `₹${Number(v||0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

const STATUS_STYLE = {
  success:  { bg:'#f0fdf4', border:'#bbf7d0', color:'#15803d', icon:'✅', label:'Successful' },
  pending:  { bg:'#fffbeb', border:'#fde68a', color:'#92400e', icon:'⏳', label:'Pending' },
  failed:   { bg:'#fef2f2', border:'#fecaca', color:'#dc2626', icon:'❌', label:'Failed' },
  refunded: { bg:'#eff6ff', border:'#bfdbfe', color:'#1d4ed8', icon:'↩️', label:'Refunded' },
};

export default function PaymentReceiptPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    paymentsAPI.getOne(id)
      .then(res => { setPayment(res.data.data); setLoading(false); })
      .catch(err => { toast.error(err.response?.data?.error || 'Payment not found'); setLoading(false); });
  }, [id]);

  if (loading) {
    return (
      <div style={{ textAlign:'center', padding:64, color:'#94a3b8' }}>
        <div className="spinner-lg" style={{ margin:'0 auto 12px' }}/>
        Loading payment details…
      </div>
    );
  }

  if (!payment) {
    return (
      <div style={{ textAlign:'center', padding:64, color:'#94a3b8' }}>
        <div style={{ fontSize:40, marginBottom:12 }}>🔍</div>
        <div style={{ fontWeight:700, marginBottom:8 }}>Payment not found</div>
        <button className="btn btn-outline btn-sm" onClick={()=>navigate('/dashboard')}>← Back to Dashboard</button>
      </div>
    );
  }

  const sc = STATUS_STYLE[payment.status] || STATUS_STYLE.pending;
  const appt = payment.appointment;
  const order = payment.order;

  return (
    <div style={{ fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif", maxWidth:640, margin:'0 auto' }}>
      <motion.div initial={{ opacity:0,y:14 }} animate={{ opacity:1,y:0 }} style={{ background:'#fff', border:'1px solid #e8edf3', borderRadius:20, overflow:'hidden', boxShadow:'0 8px 32px rgba(0,0,0,.06)' }}>

        {/* Header */}
        <div style={{ background: sc.color === '#15803d' ? 'linear-gradient(135deg,#059669,#34d399)' : sc.color === '#dc2626' ? 'linear-gradient(135deg,#dc2626,#f87171)' : 'linear-gradient(135deg,#2563eb,#60a5fa)', padding:'32px', textAlign:'center', color:'#fff' }}>
          <motion.div initial={{ scale:0 }} animate={{ scale:1 }} transition={{ type:'spring', bounce:.5, delay:.1 }} style={{ fontSize:48, marginBottom:8 }}>{sc.icon}</motion.div>
          <h2 style={{ fontSize:22, fontWeight:800, margin:'0 0 4px' }}>Payment {sc.label}</h2>
          <div style={{ fontSize:32, fontWeight:900, fontFamily:'monospace', marginTop:8 }}>{INR(payment.amount)}</div>
          {payment.paidAt && <div style={{ fontSize:13, opacity:.85, marginTop:6 }}>{new Date(payment.paidAt).toLocaleString('en-IN', { dateStyle:'long', timeStyle:'short' })}</div>}
        </div>

        {/* Body */}
        <div style={{ padding:'24px 28px' }}>
          <h4 style={{ fontSize:12, color:'#94a3b8', fontWeight:700, letterSpacing:1, textTransform:'uppercase', margin:'0 0 12px' }}>Transaction Details</h4>
          <div style={{ background:'#f8fafc', borderRadius:14, padding:'4px 16px', marginBottom:20 }}>
            {[
              ['Receipt No.', payment.receiptNo || '—'],
              ['Transaction ID', payment.transactionId || '—'],
              ['Payment Method', payment.method === 'card' ? `${payment.cardBrand || 'Card'} ••••${payment.cardLast4}` : payment.method?.toUpperCase()],
              ['Type', payment.type?.charAt(0).toUpperCase() + payment.type?.slice(1)],
              ['Status', <span key="s" style={{ padding:'2px 10px', borderRadius:20, fontSize:12, fontWeight:700, background:sc.bg, color:sc.color, border:`1px solid ${sc.border}` }}>{sc.icon} {sc.label}</span>],
            ].map(([l,v]) => (
              <div key={l} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom:'1px solid #e2e8f0' }}>
                <span style={{ fontSize:13, color:'#64748b' }}>{l}</span>
                <span style={{ fontSize:13, fontWeight:700, color:'#0f172a', fontFamily: l.includes('ID')||l.includes('Receipt') ? 'monospace' : 'inherit' }}>{v}</span>
              </div>
            ))}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0' }}>
              <span style={{ fontSize:13, color:'#64748b' }}>Patient</span>
              <span style={{ fontSize:13, fontWeight:700, color:'#0f172a' }}>{payment.user?.name || '—'}</span>
            </div>
          </div>

          {order && (
            <>
              <h4 style={{ fontSize:12, color:'#94a3b8', fontWeight:700, letterSpacing:1, textTransform:'uppercase', margin:'0 0 12px' }}>Order Details</h4>
              <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:14, padding:'16px 18px', marginBottom:20 }}>
                <div style={{ display:'flex', justifyContent:'space-between', padding:'4px 0', fontSize:13, marginBottom:6 }}>
                  <span style={{ color:'#15803d' }}>Order Number</span>
                  <span style={{ fontWeight:700, color:'#0f172a', fontFamily:'monospace' }}>{order.orderNumber}</span>
                </div>
                {order.items?.map((it,i) => (
                  <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', fontSize:12.5, borderTop:'1px solid #dcfce7' }}>
                    <span style={{ color:'#374151' }}>{it.medicineName} × {it.quantity}</span>
                    <span style={{ fontWeight:700, color:'#0f172a' }}>{INR(it.subtotal)}</span>
                  </div>
                ))}
                <div style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', fontSize:11.5, marginTop:6 }}>
                  <span style={{ color:'#15803d' }}>Status</span>
                  <span className="badge badge-success" style={{textTransform:'capitalize'}}>{order.status}</span>
                </div>
              </div>
            </>
          )}

          {appt && (
            <>
              <h4 style={{ fontSize:12, color:'#94a3b8', fontWeight:700, letterSpacing:1, textTransform:'uppercase', margin:'0 0 12px' }}>Appointment Details</h4>
              <div style={{ background:'#f0f9ff', border:'1px solid #bae6fd', borderRadius:14, padding:'16px 18px', marginBottom:20 }}>
                {[
                  ['Doctor', `Dr. ${appt.doctor?.name || '—'}${appt.doctor?.specialization ? ` (${appt.doctor.specialization})` : ''}`],
                  ['Date', appt.date ? new Date(appt.date).toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric' }) : '—'],
                  ['Time', appt.timeSlot || '—'],
                  ['Type', appt.type || 'Consultation'],
                  ['Status', <span key="as" className="badge badge-success" style={{textTransform:'capitalize'}}>{appt.status}</span>],
                ].map(([l,v]) => (
                  <div key={l} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', fontSize:13 }}>
                    <span style={{ color:'#0369a1' }}>{l}</span>
                    <span style={{ fontWeight:700, color:'#0f172a' }}>{v}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {payment.description && (
            <div style={{ fontSize:13, color:'#64748b', marginBottom:20 }}>
              <strong>Description:</strong> {payment.description}
            </div>
          )}

          <div style={{ display:'flex', gap:10 }}>
            <button className="btn btn-outline" style={{ flex:1 }} onClick={()=>window.print()}>🖨️ Print Receipt</button>
            <Link to="/appointments" className="btn btn-primary" style={{ flex:1, textAlign:'center' }}>📅 My Appointments</Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
