import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { invoiceAPI, usersAPI, insuranceAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const inp = { width:'100%', padding:'9px 12px', border:'1.5px solid #e2e8f0', borderRadius:9, fontSize:13.5, outline:'none', fontFamily:'inherit', background:'#fff' };
const lbl = { display:'block', fontSize:11.5, fontWeight:700, color:'#374151', marginBottom:5 };
const INR = n => `₹${Number(n||0).toLocaleString('en-IN',{maximumFractionDigits:2})}`;
const GST_RATES = [0, 5, 12, 18, 28];
const PAY_STATUS_CFG = { unpaid:{bg:'#fee2e2',c:'#dc2626',label:'Unpaid'}, partial:{bg:'#fef3c7',c:'#92400e',label:'Partially Paid'}, paid:{bg:'#dcfce7',c:'#15803d',label:'Paid'} };

const emptyLine = () => ({ description:'', hsnSac:'', quantity:1, unitPrice:'', discount:0, gstRate:0 });

function computeLinePreview(l, interState) {
  const qty = Math.max(1, Number(l.quantity)||1);
  const price = Number(l.unitPrice)||0;
  const disc = Number(l.discount)||0;
  const rate = Number(l.gstRate)||0;
  const taxable = Math.max(0, qty*price - disc);
  const gst = taxable * rate/100;
  return { taxable, cgst: interState?0:gst/2, sgst: interState?0:gst/2, igst: interState?gst:0, total: taxable+gst };
}

export default function BillingPage() {
  const { user } = useAuth();
  const isHR = ['admin','finance'].includes(user?.role);
  const canBill = ['admin','finance','receptionist'].includes(user?.role);
  const [tab, setTab] = useState('invoices');

  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  const [patients, setPatients] = useState([]);
  const [packages, setPackages] = useState([]);
  const [claims, setClaims] = useState([]);

  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [mode, setMode] = useState('items'); // 'items' | 'package'
  const [form, setForm] = useState({ patientId:'', packageId:'', interState:false, placeOfSupply:'', insuranceClaimId:'', notes:'' });
  const [lines, setLines] = useState([emptyLine()]);

  const [viewInvoice, setViewInvoice] = useState(null);
  const [payModal, setPayModal] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMode, setPayMode] = useState('cash');
  const [paying, setPaying] = useState(false);

  const [showPkgModal, setShowPkgModal] = useState(false);
  const [pkgForm, setPkgForm] = useState({ name:'', category:'', description:'', price:'', gstRate:0, includedItemsText:'' });
  const [savingPkg, setSavingPkg] = useState(false);

  const [gstRange, setGstRange] = useState({ from:'', to:'' });
  const [gstData, setGstData] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    invoiceAPI.getAll(statusFilter ? { paymentStatus: statusFilter } : {}).then(r => setInvoices(r.data.data||[])).catch(()=>toast.error('Failed to load invoices')).finally(()=>setLoading(false));
  }, [statusFilter]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { invoiceAPI.getPackages().then(r=>setPackages(r.data.data||[])).catch(()=>{}); }, []);

  const openCreate = async () => {
    if (patients.length === 0) {
      try { const r = await usersAPI.getAll({ role:'patient', status:'approved', limit:300 }); setPatients(r.data.data||[]); } catch {}
    }
    setForm({ patientId:'', packageId:'', interState:false, placeOfSupply:'', insuranceClaimId:'', notes:'' });
    setLines([emptyLine()]);
    setMode('items');
    setClaims([]);
    setShowCreate(true);
  };

  const onPatientChange = async (patientId) => {
    setForm(f => ({ ...f, patientId, insuranceClaimId:'' }));
    try {
      const r = await insuranceAPI.getAllClaims({ patientId, status: 'approved' });
      setClaims((r.data.data||[]).filter(c => c.patient?._id === patientId || c.patient === patientId));
    } catch { setClaims([]); }
  };

  const updateLine = (idx, patch) => setLines(ls => ls.map((l,i) => i===idx ? { ...l, ...patch } : l));
  const addLine = () => setLines(ls => [...ls, emptyLine()]);
  const removeLine = (idx) => setLines(ls => ls.length>1 ? ls.filter((_,i)=>i!==idx) : ls);

  const preview = mode === 'package'
    ? (() => { const pkg = packages.find(p=>p._id===form.packageId); return pkg ? [computeLinePreview({ quantity:1, unitPrice:pkg.price, discount:0, gstRate:pkg.gstRate }, form.interState)] : []; })()
    : lines.map(l => computeLinePreview(l, form.interState));
  const previewTotal = preview.reduce((s,p)=>s+p.total, 0);

  const submitCreate = async (e) => {
    e.preventDefault();
    if (!form.patientId) { toast.error('Select a patient'); return; }
    if (mode === 'package' && !form.packageId) { toast.error('Select a package'); return; }
    if (mode === 'items' && lines.some(l => !l.description.trim() || l.unitPrice === '')) { toast.error('Fill in description and unit price for every line'); return; }
    setCreating(true);
    try {
      await invoiceAPI.create({
        patient: form.patientId,
        packageId: mode === 'package' ? form.packageId : undefined,
        lineItems: mode === 'items' ? lines : undefined,
        interState: form.interState, placeOfSupply: form.placeOfSupply.trim(),
        insuranceClaimId: form.insuranceClaimId || undefined,
        notes: form.notes.trim(),
      });
      toast.success('✅ Invoice created');
      setShowCreate(false);
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to create invoice'); }
    setCreating(false);
  };

  const openPay = (inv) => { setPayModal(inv); setPayAmount(''); setPayMode('cash'); };
  const submitPay = async () => {
    if (!payAmount || Number(payAmount) <= 0) { toast.error('Enter a valid amount'); return; }
    setPaying(true);
    try {
      await invoiceAPI.recordPayment(payModal._id, Number(payAmount), payMode);
      toast.success('✅ Payment recorded');
      setPayModal(null);
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to record payment'); }
    setPaying(false);
  };

  const cancelInvoice = async (inv) => {
    const reason = window.prompt('Reason for cancelling this invoice?', '') || '';
    try { await invoiceAPI.cancel(inv._id, reason); toast.success('Invoice cancelled'); load(); }
    catch (e) { toast.error(e.response?.data?.error || 'Failed to cancel'); }
  };

  const openPkgModal = () => { setPkgForm({ name:'', category:'', description:'', price:'', gstRate:0, includedItemsText:'' }); setShowPkgModal(true); };
  const submitPkg = async (e) => {
    e.preventDefault();
    if (!pkgForm.name.trim() || pkgForm.price === '') { toast.error('Name and price are required'); return; }
    setSavingPkg(true);
    try {
      await invoiceAPI.createPackage({
        name: pkgForm.name.trim(), category: pkgForm.category.trim(), description: pkgForm.description.trim(),
        price: Number(pkgForm.price), gstRate: Number(pkgForm.gstRate),
        includedItems: pkgForm.includedItemsText.split('\n').map(s=>s.trim()).filter(Boolean),
      });
      toast.success('✅ Package created');
      setShowPkgModal(false);
      invoiceAPI.getPackages().then(r=>setPackages(r.data.data||[]));
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to create package'); }
    setSavingPkg(false);
  };

  const deactivatePkg = async (pkg) => {
    if (!window.confirm(`Deactivate "${pkg.name}"? It will no longer be selectable for new invoices.`)) return;
    try { await invoiceAPI.deletePackage(pkg._id); toast.success('Package deactivated'); invoiceAPI.getPackages(true).then(r=>setPackages(r.data.data||[])); }
    catch (e) { toast.error('Failed to deactivate'); }
  };

  const loadGst = async () => {
    try { const r = await invoiceAPI.gstSummary(gstRange.from && gstRange.to ? gstRange : {}); setGstData(r.data.data); }
    catch { toast.error('Failed to load GST summary'); }
  };
  useEffect(() => { if (tab === 'gst') loadGst(); /* eslint-disable-next-line */ }, [tab]);

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">🧾 Billing & Invoicing</div><div className="page-subtitle">GST-compliant invoices, packages, and insurance-linked billing</div></div>
        {tab === 'invoices' && canBill && <button className="btn btn-primary" onClick={openCreate}>+ New Invoice</button>}
        {tab === 'packages' && isHR && <button className="btn btn-primary" onClick={openPkgModal}>+ New Package</button>}
      </div>

      <div style={{ display:'flex', gap:6, marginBottom:18, flexWrap:'wrap' }}>
        {[['invoices','🧾 Invoices'],['packages','📦 Packages'],...(isHR?[['gst','📊 GST Summary']]:[])].map(([k,l]) => (
          <button key={k} onClick={()=>setTab(k)} style={{ padding:'9px 16px', borderRadius:11, border:'none', background:tab===k?'#eef2ff':'#f8fafc', color:tab===k?'#4338ca':'#64748b', fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>{l}</button>
        ))}
      </div>

      {tab === 'invoices' && (
        <div>
          <div style={{ display:'flex', gap:6, marginBottom:16 }}>
            {[['','All'],['unpaid','Unpaid'],['partial','Partial'],['paid','Paid']].map(([k,l]) => (
              <button key={k} onClick={()=>setStatusFilter(k)} style={{ padding:'6px 12px', borderRadius:9, border:'1px solid #e2e8f0', background:statusFilter===k?'#eef2ff':'#fff', color:statusFilter===k?'#4338ca':'#64748b', fontWeight:600, fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>{l}</button>
            ))}
          </div>
          {loading ? (
            <div style={{ textAlign:'center', padding:60, color:'#94a3b8' }}>Loading…</div>
          ) : invoices.length === 0 ? (
            <div className="card"><div className="card-body" style={{ textAlign:'center', padding:48 }}>
              <div style={{ fontSize:44, marginBottom:10 }}>🧾</div>
              <div style={{ fontWeight:700, fontSize:16 }}>No invoices yet</div>
            </div></div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))', gap:14 }}>
              {invoices.map(inv => {
                const psCfg = PAY_STATUS_CFG[inv.paymentStatus] || PAY_STATUS_CFG.unpaid;
                const due = inv.grandTotal - inv.insuranceCoveredAmount - inv.amountPaid;
                return (
                  <motion.div key={inv._id} className="card" initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} style={{ opacity: inv.status==='cancelled'?0.55:1 }}>
                    <div className="card-body">
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                        <div>
                          <div style={{ fontWeight:800, fontSize:14 }}>{inv.invoiceNumber}</div>
                          <div style={{ fontSize:12, color:'#64748b' }}>{inv.patient?.name}</div>
                        </div>
                        <span style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700, background: inv.status==='cancelled'?'#f1f5f9':psCfg.bg, color: inv.status==='cancelled'?'#64748b':psCfg.c, height:'fit-content' }}>
                          {inv.status==='cancelled' ? 'Cancelled' : psCfg.label}
                        </span>
                      </div>
                      <div style={{ fontSize:13, color:'#374151', marginBottom:4 }}>Grand Total: <strong>{INR(inv.grandTotal)}</strong> <span style={{ fontSize:11, color:'#94a3b8' }}>(GST {INR(inv.totalGST)})</span></div>
                      {inv.insuranceCoveredAmount > 0 && <div style={{ fontSize:11.5, color:'#0369a1', marginBottom:4 }}>🛡️ Insurance covers {INR(inv.insuranceCoveredAmount)}</div>}
                      {inv.status !== 'cancelled' && <div style={{ fontSize:11.5, color:'#64748b', marginBottom:10 }}>Paid {INR(inv.amountPaid)} · Due {INR(Math.max(0,due))}</div>}
                      <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                        <button className="btn btn-outline btn-sm" onClick={()=>setViewInvoice(inv)}>👁️ View</button>
                        {canBill && inv.status !== 'cancelled' && inv.paymentStatus !== 'paid' && (
                          <button className="btn btn-primary btn-sm" onClick={()=>openPay(inv)}>💳 Record Payment</button>
                        )}
                        {isHR && inv.status !== 'cancelled' && inv.amountPaid === 0 && (
                          <button className="btn btn-outline btn-sm" onClick={()=>cancelInvoice(inv)}>Cancel</button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'packages' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:14 }}>
          {packages.length === 0 ? (
            <div className="card" style={{ gridColumn:'1/-1' }}><div className="card-body" style={{ textAlign:'center', padding:40, color:'#94a3b8' }}>No packages yet</div></div>
          ) : packages.map(pkg => (
            <div key={pkg._id} className="card">
              <div className="card-body">
                <div style={{ fontWeight:800, fontSize:14 }}>{pkg.name}</div>
                {pkg.category && <div style={{ fontSize:11.5, color:'#94a3b8', marginBottom:6 }}>{pkg.category}</div>}
                <div style={{ fontSize:16, fontWeight:800, color:'#4338ca', margin:'6px 0' }}>{INR(pkg.price)} <span style={{ fontSize:11, color:'#94a3b8', fontWeight:600 }}>+{pkg.gstRate}% GST</span></div>
                {pkg.includedItems?.length > 0 && (
                  <ul style={{ fontSize:11.5, color:'#64748b', paddingLeft:16, margin:'6px 0' }}>
                    {pkg.includedItems.map((it,i)=><li key={i}>{it}</li>)}
                  </ul>
                )}
                {isHR && <button className="btn btn-outline btn-sm" style={{ marginTop:8 }} onClick={()=>deactivatePkg(pkg)}>Deactivate</button>}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'gst' && isHR && (
        <div>
          <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:16, flexWrap:'wrap' }}>
            <input type="date" value={gstRange.from} onChange={e=>setGstRange(r=>({...r,from:e.target.value}))} style={{ padding:'8px 12px', border:'1.5px solid #e2e8f0', borderRadius:9, fontSize:13 }} />
            <span style={{ color:'#94a3b8' }}>to</span>
            <input type="date" value={gstRange.to} onChange={e=>setGstRange(r=>({...r,to:e.target.value}))} style={{ padding:'8px 12px', border:'1.5px solid #e2e8f0', borderRadius:9, fontSize:13 }} />
            <button className="btn btn-primary btn-sm" onClick={loadGst}>Apply</button>
          </div>
          {gstData && (
            <div>
              <div style={{ fontSize:12.5, color:'#64748b', marginBottom:12 }}>{gstData.invoiceCount} invoice(s) from {new Date(gstData.from).toLocaleDateString('en-IN')} to {new Date(gstData.to).toLocaleDateString('en-IN')}</div>
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12.5 }}>
                  <thead><tr style={{ background:'#f8fafc', textAlign:'left' }}>
                    <th style={{ padding:'8px 10px' }}>GST Rate</th><th style={{ padding:'8px 10px' }}>Taxable</th><th style={{ padding:'8px 10px' }}>CGST</th><th style={{ padding:'8px 10px' }}>SGST</th><th style={{ padding:'8px 10px' }}>IGST</th><th style={{ padding:'8px 10px' }}>Total</th>
                  </tr></thead>
                  <tbody>
                    {gstData.byRate.map(r => (
                      <tr key={r.rate} style={{ borderTop:'1px solid #f1f5f9' }}>
                        <td style={{ padding:'8px 10px', fontWeight:700 }}>{r.rate}%</td>
                        <td style={{ padding:'8px 10px' }}>{INR(r.taxable)}</td><td style={{ padding:'8px 10px' }}>{INR(r.cgst)}</td>
                        <td style={{ padding:'8px 10px' }}>{INR(r.sgst)}</td><td style={{ padding:'8px 10px' }}>{INR(r.igst)}</td><td style={{ padding:'8px 10px', fontWeight:700 }}>{INR(r.total)}</td>
                      </tr>
                    ))}
                    <tr style={{ borderTop:'2px solid #e2e8f0', fontWeight:800 }}>
                      <td style={{ padding:'8px 10px' }}>Total</td><td style={{ padding:'8px 10px' }}>{INR(gstData.grand.taxable)}</td><td style={{ padding:'8px 10px' }}>{INR(gstData.grand.cgst)}</td>
                      <td style={{ padding:'8px 10px' }}>{INR(gstData.grand.sgst)}</td><td style={{ padding:'8px 10px' }}>{INR(gstData.grand.igst)}</td><td style={{ padding:'8px 10px' }}>{INR(gstData.grand.total)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── CREATE INVOICE MODAL ── */}
      <AnimatePresence>
        {showCreate && (
          <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)setShowCreate(false);}}>
            <motion.div className="modal-box" style={{ maxWidth:640 }} initial={{opacity:0,y:20}} animate={{opacity:1,y:0}}>
              <div className="modal-header"><span className="modal-title">🧾 New Invoice</span><button className="btn btn-ghost btn-icon" onClick={()=>setShowCreate(false)}>✕</button></div>
              <form onSubmit={submitCreate}>
                <div className="modal-body" style={{ maxHeight:'70vh', overflowY:'auto' }}>
                  <div style={{ marginBottom:11 }}><label style={lbl}>Patient *</label>
                    <select style={inp} required value={form.patientId} onChange={e=>onPatientChange(e.target.value)}>
                      <option value="">— Select patient —</option>
                      {patients.map(p=><option key={p._id} value={p._id}>{p.name} ({p.phone||p.email})</option>)}
                    </select>
                  </div>

                  <div style={{ display:'flex', gap:6, marginBottom:12 }}>
                    <button type="button" onClick={()=>setMode('items')} style={{ flex:1, padding:'8px', borderRadius:9, border:'none', background:mode==='items'?'#eef2ff':'#f8fafc', color:mode==='items'?'#4338ca':'#64748b', fontWeight:700, fontSize:12.5, cursor:'pointer' }}>📝 Itemized Bill</button>
                    <button type="button" onClick={()=>setMode('package')} style={{ flex:1, padding:'8px', borderRadius:9, border:'none', background:mode==='package'?'#eef2ff':'#f8fafc', color:mode==='package'?'#4338ca':'#64748b', fontWeight:700, fontSize:12.5, cursor:'pointer' }}>📦 Use Package</button>
                  </div>

                  {mode === 'package' ? (
                    <div style={{ marginBottom:14 }}>
                      <label style={lbl}>Package *</label>
                      <select style={inp} value={form.packageId} onChange={e=>setForm(f=>({...f,packageId:e.target.value}))}>
                        <option value="">— Select package —</option>
                        {packages.map(p=><option key={p._id} value={p._id}>{p.name} — {INR(p.price)} (+{p.gstRate}% GST)</option>)}
                      </select>
                    </div>
                  ) : (
                    <div style={{ marginBottom:14 }}>
                      <label style={lbl}>Line Items</label>
                      {lines.map((l, idx) => (
                        <div key={idx} style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr auto', gap:6, marginBottom:6, alignItems:'center' }}>
                          <input placeholder="Description" style={inp} value={l.description} onChange={e=>updateLine(idx,{description:e.target.value})} />
                          <input placeholder="HSN/SAC" style={inp} value={l.hsnSac} onChange={e=>updateLine(idx,{hsnSac:e.target.value})} />
                          <input type="number" min="1" placeholder="Qty" style={inp} value={l.quantity} onChange={e=>updateLine(idx,{quantity:e.target.value})} />
                          <input type="number" min="0" placeholder="Unit ₹" style={inp} value={l.unitPrice} onChange={e=>updateLine(idx,{unitPrice:e.target.value})} />
                          <select style={inp} value={l.gstRate} onChange={e=>updateLine(idx,{gstRate:Number(e.target.value)})}>
                            {GST_RATES.map(r=><option key={r} value={r}>{r}% GST</option>)}
                          </select>
                          <button type="button" onClick={()=>removeLine(idx)} style={{ background:'none', border:'none', color:'#dc2626', cursor:'pointer', fontSize:16 }}>✕</button>
                        </div>
                      ))}
                      <button type="button" className="btn btn-outline btn-sm" onClick={addLine}>+ Add Line</button>
                    </div>
                  )}

                  <div style={{ display:'flex', gap:14, alignItems:'center', marginBottom:11 }}>
                    <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12.5, fontWeight:600 }}>
                      <input type="checkbox" checked={form.interState} onChange={e=>setForm(f=>({...f,interState:e.target.checked}))} /> Inter-state supply (IGST instead of CGST+SGST)
                    </label>
                  </div>

                  {claims.length > 0 && (
                    <div style={{ marginBottom:11 }}><label style={lbl}>Link Approved Insurance Claim (optional)</label>
                      <select style={inp} value={form.insuranceClaimId} onChange={e=>setForm(f=>({...f,insuranceClaimId:e.target.value}))}>
                        <option value="">— No insurance link —</option>
                        {claims.map(c=><option key={c._id} value={c._id}>Claim {c._id.slice(-6)} — Approved {INR(c.approvedAmount)}</option>)}
                      </select>
                    </div>
                  )}

                  <div style={{ marginBottom:11 }}><label style={lbl}>Notes</label><textarea style={inp} rows={2} value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} /></div>

                  <div style={{ background:'#eef2ff', borderRadius:10, padding:'12px 14px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={{ fontWeight:700, color:'#4338ca' }}>Estimated Grand Total</span>
                    <span style={{ fontWeight:900, fontSize:20, color:'#4338ca' }}>{INR(previewTotal)}</span>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-outline" onClick={()=>setShowCreate(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={creating}>{creating?'Creating…':'✓ Create Invoice'}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── VIEW / PRINT INVOICE MODAL ── */}
      <AnimatePresence>
        {viewInvoice && (
          <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)setViewInvoice(null);}}>
            <motion.div className="modal-box" style={{ maxWidth:600 }} initial={{opacity:0,y:20}} animate={{opacity:1,y:0}}>
              <div className="modal-header"><span className="modal-title">🧾 {viewInvoice.invoiceNumber}</span><button className="btn btn-ghost btn-icon" onClick={()=>setViewInvoice(null)}>✕</button></div>
              <div className="modal-body" id="invoice-print-area" style={{ maxHeight:'65vh', overflowY:'auto' }}>
                <div style={{ marginBottom:10, fontSize:13 }}><strong>Patient:</strong> {viewInvoice.patient?.name}</div>
                <div style={{ marginBottom:14, fontSize:12, color:'#64748b' }}>Date: {new Date(viewInvoice.createdAt).toLocaleDateString('en-IN')} · {viewInvoice.interState ? 'Inter-state (IGST)' : 'Intra-state (CGST+SGST)'}</div>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                  <thead><tr style={{ background:'#f8fafc', textAlign:'left' }}><th style={{ padding:6 }}>Item</th><th style={{ padding:6 }}>Qty</th><th style={{ padding:6 }}>Rate</th><th style={{ padding:6 }}>GST%</th><th style={{ padding:6 }}>Total</th></tr></thead>
                  <tbody>
                    {viewInvoice.lineItems.map((li,i) => (
                      <tr key={i} style={{ borderTop:'1px solid #f1f5f9' }}>
                        <td style={{ padding:6 }}>{li.description}{li.hsnSac && <div style={{ fontSize:10, color:'#94a3b8' }}>HSN/SAC: {li.hsnSac}</div>}</td>
                        <td style={{ padding:6 }}>{li.quantity}</td><td style={{ padding:6 }}>{INR(li.unitPrice)}</td><td style={{ padding:6 }}>{li.gstRate}%</td><td style={{ padding:6, fontWeight:700 }}>{INR(li.lineTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ marginTop:14, fontSize:12.5, display:'flex', flexDirection:'column', gap:3 }}>
                  <div style={{ display:'flex', justifyContent:'space-between' }}><span>Subtotal</span><span>{INR(viewInvoice.subtotal)}</span></div>
                  <div style={{ display:'flex', justifyContent:'space-between' }}><span>Discount</span><span>-{INR(viewInvoice.totalDiscount)}</span></div>
                  {viewInvoice.totalCGST > 0 && <div style={{ display:'flex', justifyContent:'space-between' }}><span>CGST</span><span>{INR(viewInvoice.totalCGST)}</span></div>}
                  {viewInvoice.totalSGST > 0 && <div style={{ display:'flex', justifyContent:'space-between' }}><span>SGST</span><span>{INR(viewInvoice.totalSGST)}</span></div>}
                  {viewInvoice.totalIGST > 0 && <div style={{ display:'flex', justifyContent:'space-between' }}><span>IGST</span><span>{INR(viewInvoice.totalIGST)}</span></div>}
                  {viewInvoice.insuranceCoveredAmount > 0 && <div style={{ display:'flex', justifyContent:'space-between', color:'#0369a1' }}><span>Insurance Covered</span><span>-{INR(viewInvoice.insuranceCoveredAmount)}</span></div>}
                  <div style={{ display:'flex', justifyContent:'space-between', fontWeight:800, fontSize:14, borderTop:'1px solid #e2e8f0', paddingTop:6, marginTop:4 }}><span>Grand Total</span><span>{INR(viewInvoice.grandTotal)}</span></div>
                  <div style={{ display:'flex', justifyContent:'space-between', color:'#15803d' }}><span>Paid</span><span>{INR(viewInvoice.amountPaid)}</span></div>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-outline" onClick={()=>window.print()}>🖨️ Print</button>
                <button className="btn btn-primary" onClick={()=>setViewInvoice(null)}>Close</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── RECORD PAYMENT MODAL ── */}
      <AnimatePresence>
        {payModal && (
          <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)setPayModal(null);}}>
            <motion.div className="modal-box" style={{ maxWidth:380 }} initial={{opacity:0,y:20}} animate={{opacity:1,y:0}}>
              <div className="modal-header"><span className="modal-title">💳 Record Payment</span><button className="btn btn-ghost btn-icon" onClick={()=>setPayModal(null)}>✕</button></div>
              <div className="modal-body">
                <div style={{ fontSize:12.5, color:'#64748b', marginBottom:12 }}>Invoice {payModal.invoiceNumber} — Due {INR(payModal.grandTotal - payModal.insuranceCoveredAmount - payModal.amountPaid)}</div>
                <div style={{ marginBottom:11 }}><label style={lbl}>Amount (₹) *</label><input type="number" min="0" style={inp} value={payAmount} onChange={e=>setPayAmount(e.target.value)} /></div>
                <div><label style={lbl}>Payment Mode</label>
                  <select style={inp} value={payMode} onChange={e=>setPayMode(e.target.value)}>
                    <option value="cash">Cash</option><option value="card">Card</option><option value="upi">UPI</option><option value="netbanking">Net Banking</option><option value="insurance">Insurance</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-outline" onClick={()=>setPayModal(null)}>Cancel</button>
                <button className="btn btn-primary" disabled={paying} onClick={submitPay}>{paying?'Saving…':'✓ Record Payment'}</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── NEW PACKAGE MODAL ── */}
      <AnimatePresence>
        {showPkgModal && (
          <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)setShowPkgModal(false);}}>
            <motion.div className="modal-box" style={{ maxWidth:460 }} initial={{opacity:0,y:20}} animate={{opacity:1,y:0}}>
              <div className="modal-header"><span className="modal-title">📦 New Billing Package</span><button className="btn btn-ghost btn-icon" onClick={()=>setShowPkgModal(false)}>✕</button></div>
              <form onSubmit={submitPkg}>
                <div className="modal-body">
                  <div style={{ marginBottom:11 }}><label style={lbl}>Package Name *</label><input style={inp} required value={pkgForm.name} onChange={e=>setPkgForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Normal Delivery Package" /></div>
                  <div style={{ marginBottom:11 }}><label style={lbl}>Category</label><input style={inp} value={pkgForm.category} onChange={e=>setPkgForm(f=>({...f,category:e.target.value}))} placeholder="e.g. Maternity" /></div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:11 }}>
                    <div><label style={lbl}>Price (₹) *</label><input type="number" min="0" style={inp} required value={pkgForm.price} onChange={e=>setPkgForm(f=>({...f,price:e.target.value}))} /></div>
                    <div><label style={lbl}>GST Rate</label><select style={inp} value={pkgForm.gstRate} onChange={e=>setPkgForm(f=>({...f,gstRate:e.target.value}))}>{GST_RATES.map(r=><option key={r} value={r}>{r}%</option>)}</select></div>
                  </div>
                  <div style={{ marginBottom:11 }}><label style={lbl}>Description</label><textarea style={inp} rows={2} value={pkgForm.description} onChange={e=>setPkgForm(f=>({...f,description:e.target.value}))} /></div>
                  <div><label style={lbl}>Included Items (one per line)</label><textarea style={inp} rows={4} value={pkgForm.includedItemsText} onChange={e=>setPkgForm(f=>({...f,includedItemsText:e.target.value}))} placeholder={"3 days ward stay\nSurgeon fee\nStandard consumables"} /></div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-outline" onClick={()=>setShowPkgModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={savingPkg}>{savingPkg?'Saving…':'✓ Create Package'}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
