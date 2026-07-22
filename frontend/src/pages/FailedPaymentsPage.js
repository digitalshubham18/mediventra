import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { salaryAPI, usersAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function FailedPaymentsPage() {
  const { user } = useAuth();
  const [salaries, setSalaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [retryingId, setRetryingId] = useState(null);

  // "Pay manually" (cash/cheque) modal
  const [payModal, setPayModal] = useState(null); // the salary record
  const [payMode, setPayMode] = useState('cash');
  const [payRef, setPayRef] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [payeeName, setPayeeName] = useState('');
  const [chequeBankName, setChequeBankName] = useState('');
  const [chequeBranch, setChequeBranch] = useState('');
  const [chequeDate, setChequeDate] = useState('');
  const [paying, setPaying] = useState(false);

  // "Edit bank details" modal — admin only, fixes the root cause directly
  const [bankModal, setBankModal] = useState(null); // the salary record
  const [bankForm, setBankForm] = useState({ accountHolder:'', accountNumber:'', ifsc:'', bankName:'' });
  const [savingBank, setSavingBank] = useState(false);

  const load = () => {
    setLoading(true);
    salaryAPI.getAll({ status: 'failed' })
      .then(res => setSalaries(res.data?.data || []))
      .catch(() => toast.error('Failed to load'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const retry = async (id) => {
    setRetryingId(id);
    try {
      await salaryAPI.credit(id);
      toast.success('✅ Payment credited!');
      load();
    } catch (e) { toast.error(e.response?.data?.error || 'Still failing — bank details may still be incorrect'); }
    setRetryingId(null);
  };

  const openPayModal = (s) => { setPayModal(s); setPayMode('cash'); setPayRef(''); setPayNotes(''); setPayeeName(''); setChequeBankName(''); setChequeBranch(''); setChequeDate(''); };
  const submitManualPay = async (e) => {
    e.preventDefault();
    if (payMode === 'cash' && !payRef.trim()) { toast.error('Receipt number is required for a cash payment'); return; }
    if (payMode === 'cheque') {
      if (!payRef.trim()) { toast.error('Cheque number is required'); return; }
      if (!chequeBankName.trim()) { toast.error('Bank name is required for a cheque payment'); return; }
      if (!chequeDate) { toast.error('Cheque date is required'); return; }
    }
    setPaying(true);
    try {
      await salaryAPI.credit(payModal._id, {
        paymentMode: payMode,
        manualReference: payRef,
        manualNotes: payNotes,
        receiptNumber: payMode === 'cash' ? payRef : undefined,
        chequeNumber: payMode === 'cheque' ? payRef : undefined,
        chequeBankName: payMode === 'cheque' ? chequeBankName : undefined,
        chequeBranch: payMode === 'cheque' ? chequeBranch : undefined,
        chequeDate: payMode === 'cheque' ? chequeDate : undefined,
        payeeName,
      });
      toast.success(`✅ Marked as paid via ${payMode}!`);
      setPayModal(null);
      load();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed to record manual payment'); }
    setPaying(false);
  };

  const openBankModal = (s) => {
    setBankModal(s);
    setBankForm({
      accountHolder: s.employee?.bankDetails?.accountHolder || s.employee?.name || '',
      accountNumber: s.employee?.bankDetails?.accountNumber || '',
      ifsc:          s.employee?.bankDetails?.ifsc || '',
      bankName:      s.employee?.bankDetails?.bankName || '',
    });
  };
  const submitBankFix = async (e) => {
    e.preventDefault();
    setSavingBank(true);
    try {
      await usersAPI.update(bankModal.employee._id, { bankDetails: bankForm });
      toast.success('✅ Bank details updated — retrying payment…');
      setBankModal(null);
      await retry(bankModal._id);
    } catch (e) { toast.error(e.response?.data?.error || 'Failed to update bank details'); }
    setSavingBank(false);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">⚠️ Failed Payments</div>
          <div className="page-subtitle">Salaries that couldn't be credited because of missing or invalid bank details</div>
        </div>
        <button className="btn btn-outline btn-sm" onClick={load}>🔄 Refresh</button>
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:60, color:'#94a3b8' }}>Loading…</div>
      ) : salaries.length === 0 ? (
        <div className="card"><div className="card-body" style={{ textAlign:'center', padding:50, color:'#94a3b8' }}>
          <div style={{ fontSize:36, marginBottom:10 }}>✅</div>
          No failed payments right now — every salary on file has valid bank details.
        </div></div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead><tr><th>Employee</th><th>Role</th><th>Period</th><th>Net Pay</th><th>Reason</th><th style={{minWidth:260}}>Actions</th></tr></thead>
              <tbody>
                {salaries.map(s => (
                  <tr key={s._id}>
                    <td>
                      <div className="td-main">{s.employee?.name}</div>
                      <div className="td-sub">{s.employee?.email}</div>
                    </td>
                    <td className="text-sm" style={{ textTransform:'capitalize' }}>{s.employee?.role?.replace('_',' ')}</td>
                    <td className="text-sm">{MONTHS[(s.month||1)-1]} {s.year}</td>
                    <td className="text-sm fw-7">₹{s.netPay?.toLocaleString('en-IN')}</td>
                    <td className="text-sm" style={{ color:'#b91c1c', maxWidth:220 }}>{s.failureReason}</td>
                    <td>
                      <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                        <button className="btn btn-primary btn-xs" disabled={retryingId===s._id} onClick={() => retry(s._id)}>
                          {retryingId===s._id ? 'Retrying…' : '🔁 Retry'}
                        </button>
                        {user?.role === 'admin' && (
                          <button className="btn btn-outline btn-xs" onClick={() => openBankModal(s)}>✏️ Edit Bank Details</button>
                        )}
                        <button className="btn btn-outline btn-xs" onClick={() => openPayModal(s)}>💵 Pay via Cash/Cheque</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Pay manually (cash/cheque) ── */}
      <AnimatePresence>
        {payModal && (
          <div className="modal-overlay" onClick={e=>{ if(e.target===e.currentTarget) setPayModal(null); }}>
            <motion.div className="modal-box" style={{ maxWidth:420 }} initial={{ opacity:0,y:20 }} animate={{ opacity:1,y:0 }}>
              <div className="modal-header">
                <span className="modal-title">💵 Pay {payModal.employee?.name} Manually</span>
                <button className="btn btn-ghost btn-icon" onClick={()=>setPayModal(null)}>✕</button>
              </div>
              <form onSubmit={submitManualPay}>
                <div className="modal-body">
                  <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:10, padding:'9px 13px', marginBottom:16, fontSize:12.5, color:'#1e40af' }}>
                    Use this when the bank account can't be fixed in time — hand over ₹{payModal.netPay?.toLocaleString('en-IN')} directly instead of waiting on a bank transfer.
                  </div>
                  <div className="form-group">
                    <label className="form-label">Payment Mode</label>
                    <select className="form-input" value={payMode} onChange={e=>setPayMode(e.target.value)}>
                      <option value="cash">Cash</option>
                      <option value="cheque">Cheque</option>
                    </select>
                  </div>
                  {payMode === 'cash' ? (
                    <>
                      <div className="form-group">
                        <label className="form-label">Receipt Number *</label>
                        <input className="form-input" required value={payRef} onChange={e=>setPayRef(e.target.value)} placeholder="e.g. RCPT-2026-00123" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Paid To (optional)</label>
                        <input className="form-input" value={payeeName} onChange={e=>setPayeeName(e.target.value)} placeholder="Name of person who collected the cash, if different" />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="form-group">
                        <label className="form-label">Cheque Number *</label>
                        <input className="form-input" required value={payRef} onChange={e=>setPayRef(e.target.value)} placeholder="e.g. 000123" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Bank Name *</label>
                        <input className="form-input" required value={chequeBankName} onChange={e=>setChequeBankName(e.target.value)} placeholder="e.g. State Bank of India" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Branch (optional)</label>
                        <input className="form-input" value={chequeBranch} onChange={e=>setChequeBranch(e.target.value)} placeholder="e.g. MG Road Branch" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Cheque Date *</label>
                        <input className="form-input" type="date" required value={chequeDate} onChange={e=>setChequeDate(e.target.value)} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Payee Name (optional)</label>
                        <input className="form-input" value={payeeName} onChange={e=>setPayeeName(e.target.value)} placeholder="Name printed on the cheque" />
                      </div>
                    </>
                  )}
                  <div className="form-group">
                    <label className="form-label">Notes (optional)</label>
                    <textarea className="form-input" rows={2} value={payNotes} onChange={e=>setPayNotes(e.target.value)} />
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-outline" onClick={()=>setPayModal(null)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={paying}>{paying ? 'Saving…' : `✓ Mark Paid (${payMode})`}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Edit bank details (admin) ── */}
      <AnimatePresence>
        {bankModal && (
          <div className="modal-overlay" onClick={e=>{ if(e.target===e.currentTarget) setBankModal(null); }}>
            <motion.div className="modal-box" style={{ maxWidth:440 }} initial={{ opacity:0,y:20 }} animate={{ opacity:1,y:0 }}>
              <div className="modal-header">
                <span className="modal-title">✏️ Fix Bank Details — {bankModal.employee?.name}</span>
                <button className="btn btn-ghost btn-icon" onClick={()=>setBankModal(null)}>✕</button>
              </div>
              <form onSubmit={submitBankFix}>
                <div className="modal-body">
                  <div className="form-group"><label className="form-label">Account Holder Name</label><input className="form-input" required value={bankForm.accountHolder} onChange={e=>setBankForm(f=>({...f,accountHolder:e.target.value}))} /></div>
                  <div className="form-group"><label className="form-label">Account Number</label><input className="form-input" required value={bankForm.accountNumber} onChange={e=>setBankForm(f=>({...f,accountNumber:e.target.value}))} /></div>
                  <div className="form-group"><label className="form-label">IFSC Code</label><input className="form-input" required value={bankForm.ifsc} onChange={e=>setBankForm(f=>({...f,ifsc:e.target.value.toUpperCase()}))} placeholder="e.g. SBIN0001234" /></div>
                  <div className="form-group"><label className="form-label">Bank Name</label><input className="form-input" value={bankForm.bankName} onChange={e=>setBankForm(f=>({...f,bankName:e.target.value}))} /></div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-outline" onClick={()=>setBankModal(null)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={savingBank}>{savingBank ? 'Saving…' : '💾 Save & Retry Payment'}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
