import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { inventoryAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const inp = { width:'100%', padding:'9px 12px', border:'1.5px solid #e2e8f0', borderRadius:9, fontSize:13.5, outline:'none', fontFamily:'inherit', background:'#fff' };
const lbl = { display:'block', fontSize:11.5, fontWeight:700, color:'#374151', marginBottom:5 };
const CATEGORIES = ['Consumables','Surgical Supplies','Linen','PPE','Stationery','Housekeeping','Equipment','Diagnostics','Other'];
const UNITS = ['pcs','box','pack','kg','g','liter','ml','roll','pair','set'];
const STATUS_CFG = {
  pending:{bg:'#fef3c7',c:'#92400e',label:'⏳ Pending'}, approved:{bg:'#dcfce7',c:'#15803d',label:'✅ Approved'},
  partially_approved:{bg:'#e0f2fe',c:'#0369a1',label:'◐ Partially Approved'}, rejected:{bg:'#fee2e2',c:'#dc2626',label:'✕ Rejected'},
  fulfilled:{bg:'#f1f5f9',c:'#64748b',label:'📦 Fulfilled'}, cancelled:{bg:'#f1f5f9',c:'#94a3b8',label:'Cancelled'},
};
const emptyIndentLine = () => ({ item:'', requestedQuantity:1 });

export default function InventoryPage() {
  const { user } = useAuth();
  const isStore = ['admin','finance'].includes(user?.role);
  const [tab, setTab] = useState('items');

  const [items, setItems] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [category, setCategory] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [search, setSearch] = useState('');

  const [showItemModal, setShowItemModal] = useState(false);
  const [itemForm, setItemForm] = useState({ name:'', category:'Consumables', unit:'pcs', currentStock:0, minStock:10, unitCost:'', supplier:'', storeLocation:'Central Store', notes:'' });
  const [savingItem, setSavingItem] = useState(false);

  const [stockModal, setStockModal] = useState(null); // { item, kind: 'in'|'adjust' }
  const [stockQty, setStockQty] = useState('');
  const [stockReason, setStockReason] = useState('');
  const [savingStock, setSavingStock] = useState(false);

  const [ledgerFor, setLedgerFor] = useState(null);
  const [ledger, setLedger] = useState([]);

  const [indents, setIndents] = useState([]);
  const [indentsLoading, setIndentsLoading] = useState(true);
  const [indentStatusFilter, setIndentStatusFilter] = useState('');

  const [showIndentModal, setShowIndentModal] = useState(false);
  const [indentForm, setIndentForm] = useState({ department: user?.department || '', priority:'normal', neededBy:'', reason:'' });
  const [indentLines, setIndentLines] = useState([emptyIndentLine()]);
  const [creatingIndent, setCreatingIndent] = useState(false);

  const [reviewFor, setReviewFor] = useState(null);
  const [reviewQtys, setReviewQtys] = useState({});
  const [reviewing, setReviewing] = useState(false);

  const loadItems = useCallback(() => {
    setItemsLoading(true);
    const params = {};
    if (category) params.category = category;
    if (lowStockOnly) params.lowStock = '1';
    if (search) params.search = search;
    inventoryAPI.getItems(params).then(r => setItems(r.data.data||[])).catch(()=>toast.error('Failed to load inventory')).finally(()=>setItemsLoading(false));
  }, [category, lowStockOnly, search]);
  useEffect(() => { loadItems(); }, [loadItems]);

  const loadIndents = useCallback(() => {
    setIndentsLoading(true);
    inventoryAPI.getIndents(indentStatusFilter ? { status: indentStatusFilter } : {}).then(r => setIndents(r.data.data||[])).catch(()=>toast.error('Failed to load indents')).finally(()=>setIndentsLoading(false));
  }, [indentStatusFilter]);
  useEffect(() => { if (tab === 'indents') loadIndents(); }, [tab, loadIndents]);

  const submitItem = async (e) => {
    e.preventDefault();
    if (!itemForm.name.trim()) { toast.error('Item name is required'); return; }
    setSavingItem(true);
    try {
      await inventoryAPI.createItem({ ...itemForm, currentStock: Number(itemForm.currentStock)||0, minStock: Number(itemForm.minStock)||0, unitCost: Number(itemForm.unitCost)||0 });
      toast.success('✅ Item added to central store');
      setShowItemModal(false);
      setItemForm({ name:'', category:'Consumables', unit:'pcs', currentStock:0, minStock:10, unitCost:'', supplier:'', storeLocation:'Central Store', notes:'' });
      loadItems();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to add item'); }
    setSavingItem(false);
  };

  const openStockModal = (item, kind) => { setStockModal({ item, kind }); setStockQty(kind==='adjust' ? String(item.currentStock) : ''); setStockReason(''); };
  const submitStock = async () => {
    if (stockQty === '' || Number(stockQty) < 0) { toast.error('Enter a valid quantity'); return; }
    setSavingStock(true);
    try {
      if (stockModal.kind === 'in') await inventoryAPI.stockIn(stockModal.item._id, Number(stockQty), stockReason);
      else await inventoryAPI.adjustStock(stockModal.item._id, Number(stockQty), stockReason);
      toast.success('✅ Stock updated');
      setStockModal(null);
      loadItems();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to update stock'); }
    setSavingStock(false);
  };

  const openLedger = async (item) => {
    setLedgerFor(item);
    try { const r = await inventoryAPI.getLedger(item._id); setLedger(r.data.data||[]); } catch { setLedger([]); }
  };

  const openIndentModal = () => {
    setIndentForm({ department: user?.department || '', priority:'normal', neededBy:'', reason:'' });
    setIndentLines([emptyIndentLine()]);
    setShowIndentModal(true);
  };
  const updateIndentLine = (idx, patch) => setIndentLines(ls => ls.map((l,i)=>i===idx?{...l,...patch}:l));
  const addIndentLine = () => setIndentLines(ls => [...ls, emptyIndentLine()]);
  const removeIndentLine = (idx) => setIndentLines(ls => ls.length>1 ? ls.filter((_,i)=>i!==idx) : ls);

  const submitIndent = async (e) => {
    e.preventDefault();
    if (!indentForm.department.trim()) { toast.error('Department is required'); return; }
    if (indentLines.some(l => !l.item || !l.requestedQuantity || Number(l.requestedQuantity)<=0)) { toast.error('Select an item and a valid quantity for every line'); return; }
    setCreatingIndent(true);
    try {
      await inventoryAPI.createIndent({
        department: indentForm.department.trim(), priority: indentForm.priority, neededBy: indentForm.neededBy || undefined,
        reason: indentForm.reason.trim(), items: indentLines.map(l => ({ item: l.item, requestedQuantity: Number(l.requestedQuantity) })),
      });
      toast.success('✅ Indent submitted to central store');
      setShowIndentModal(false);
      loadIndents();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to submit indent'); }
    setCreatingIndent(false);
  };

  const openReview = (indent) => {
    setReviewFor(indent);
    const qtys = {};
    indent.items.forEach(it => { qtys[it.item._id] = it.requestedQuantity; });
    setReviewQtys(qtys);
  };
  const submitReview = async (decision) => {
    setReviewing(true);
    try {
      const reason = decision === 'reject' ? (window.prompt('Reason for rejecting this indent?','')||'') : undefined;
      await inventoryAPI.reviewIndent(reviewFor._id, decision, decision==='approve' ? reviewQtys : undefined, reason);
      toast.success(decision==='approve' ? '✅ Indent reviewed' : 'Indent rejected');
      setReviewFor(null);
      loadIndents();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to review indent'); }
    setReviewing(false);
  };

  const fulfill = async (indent) => {
    try { await inventoryAPI.fulfillIndent(indent._id); toast.success('✅ Indent fulfilled — stock dispatched'); loadIndents(); loadItems(); }
    catch (err) { toast.error(err.response?.data?.error || 'Failed to fulfill'); }
  };
  const cancelIndent = async (indent) => {
    if (!window.confirm('Cancel this indent?')) return;
    try { await inventoryAPI.cancelIndent(indent._id); toast.success('Indent cancelled'); loadIndents(); }
    catch (err) { toast.error(err.response?.data?.error || 'Failed to cancel'); }
  };

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">📦 Inventory Management</div><div className="page-subtitle">Central store, consumables tracking, and department indents</div></div>
        {tab === 'items' && isStore && <button className="btn btn-primary" onClick={()=>setShowItemModal(true)}>+ New Item</button>}
        {tab === 'indents' && <button className="btn btn-primary" onClick={openIndentModal}>+ New Indent</button>}
      </div>

      <div style={{ display:'flex', gap:6, marginBottom:18 }}>
        {[['items','📦 Store Items'],['indents','📋 Indents']].map(([k,l]) => (
          <button key={k} onClick={()=>setTab(k)} style={{ padding:'9px 16px', borderRadius:11, border:'none', background:tab===k?'#eef2ff':'#f8fafc', color:tab===k?'#4338ca':'#64748b', fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>{l}</button>
        ))}
      </div>

      {tab === 'items' && (
        <div>
          <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
            <input placeholder="Search items…" style={{ ...inp, width:220 }} value={search} onChange={e=>setSearch(e.target.value)} />
            <select style={{ ...inp, width:180 }} value={category} onChange={e=>setCategory(e.target.value)}>
              <option value="">All categories</option>
              {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
            <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12.5, fontWeight:600, color:'#92400e' }}>
              <input type="checkbox" checked={lowStockOnly} onChange={e=>setLowStockOnly(e.target.checked)} /> ⚠️ Low stock only
            </label>
          </div>
          {itemsLoading ? (
            <div style={{ textAlign:'center', padding:60, color:'#94a3b8' }}>Loading…</div>
          ) : items.length === 0 ? (
            <div className="card"><div className="card-body" style={{ textAlign:'center', padding:40, color:'#94a3b8' }}>No items found</div></div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:14 }}>
              {items.map(item => {
                const low = item.currentStock <= item.minStock;
                return (
                  <motion.div key={item._id} className="card" initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} style={{ borderLeft: low ? '4px solid #dc2626' : '4px solid #e2e8f0' }}>
                    <div className="card-body">
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                        <div style={{ fontWeight:800, fontSize:14 }}>{item.name}</div>
                        {low && <span style={{ fontSize:10, fontWeight:700, color:'#dc2626' }}>⚠️ LOW</span>}
                      </div>
                      <div style={{ fontSize:11.5, color:'#94a3b8', marginBottom:8 }}>{item.category} · {item.storeLocation}</div>
                      <div style={{ fontSize:20, fontWeight:800, color: low?'#dc2626':'#0f172a' }}>{item.currentStock} <span style={{ fontSize:12, fontWeight:600, color:'#94a3b8' }}>{item.unit}</span></div>
                      <div style={{ fontSize:11, color:'#94a3b8', marginBottom:10 }}>Reorder at {item.minStock} {item.unit} · ₹{item.unitCost}/{item.unit}</div>
                      {isStore && (
                        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                          <button className="btn btn-outline btn-sm" onClick={()=>openStockModal(item,'in')}>+ Stock In</button>
                          <button className="btn btn-outline btn-sm" onClick={()=>openStockModal(item,'adjust')}>Adjust</button>
                          <button className="btn btn-ghost btn-sm" onClick={()=>openLedger(item)}>📜 Ledger</button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'indents' && (
        <div>
          <div style={{ display:'flex', gap:6, marginBottom:16, flexWrap:'wrap' }}>
            {[['','All'],['pending','Pending'],['approved','Approved'],['partially_approved','Partial'],['fulfilled','Fulfilled'],['rejected','Rejected'],['cancelled','Cancelled']].map(([k,l]) => (
              <button key={k} onClick={()=>setIndentStatusFilter(k)} style={{ padding:'6px 12px', borderRadius:9, border:'1px solid #e2e8f0', background:indentStatusFilter===k?'#eef2ff':'#fff', color:indentStatusFilter===k?'#4338ca':'#64748b', fontWeight:600, fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>{l}</button>
            ))}
          </div>
          {indentsLoading ? (
            <div style={{ textAlign:'center', padding:60, color:'#94a3b8' }}>Loading…</div>
          ) : indents.length === 0 ? (
            <div className="card"><div className="card-body" style={{ textAlign:'center', padding:40, color:'#94a3b8' }}>No indents found</div></div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {indents.map(ind => {
                const cfg = STATUS_CFG[ind.status] || STATUS_CFG.pending;
                return (
                  <div key={ind._id} className="card">
                    <div className="card-body">
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6, flexWrap:'wrap', gap:6 }}>
                        <div>
                          <div style={{ fontWeight:800, fontSize:14 }}>{ind.indentNumber} — {ind.department}</div>
                          <div style={{ fontSize:11.5, color:'#64748b' }}>By {ind.requestedBy?.name} · {ind.priority==='urgent' && '🔴 URGENT · '}{new Date(ind.createdAt).toLocaleDateString('en-IN')}</div>
                        </div>
                        <span style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700, background:cfg.bg, color:cfg.c, height:'fit-content' }}>{cfg.label}</span>
                      </div>
                      <div style={{ fontSize:12.5, color:'#374151', marginBottom:8 }}>
                        {ind.items.map((it,i) => (
                          <div key={i}>• {it.item?.name} — requested {it.requestedQuantity} {it.item?.unit}{it.approvedQuantity!=null && it.approvedQuantity!==it.requestedQuantity && <span style={{ color:'#0369a1' }}> (approved {it.approvedQuantity})</span>}</div>
                        ))}
                      </div>
                      {ind.reason && <div style={{ fontSize:11.5, color:'#64748b', marginBottom:8 }}>📝 {ind.reason}</div>}
                      {ind.rejectionReason && <div style={{ fontSize:11.5, color:'#dc2626', marginBottom:8 }}>❌ {ind.rejectionReason}</div>}
                      <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                        {isStore && ind.status === 'pending' && (
                          <button className="btn btn-primary btn-sm" onClick={()=>openReview(ind)}>Review</button>
                        )}
                        {isStore && ['approved','partially_approved'].includes(ind.status) && (
                          <button className="btn btn-primary btn-sm" onClick={()=>fulfill(ind)}>📦 Fulfill</button>
                        )}
                        {ind.status === 'pending' && (
                          <button className="btn btn-outline btn-sm" onClick={()=>cancelIndent(ind)}>Cancel</button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── NEW ITEM MODAL ── */}
      <AnimatePresence>
        {showItemModal && (
          <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)setShowItemModal(false);}}>
            <motion.div className="modal-box" style={{ maxWidth:460 }} initial={{opacity:0,y:20}} animate={{opacity:1,y:0}}>
              <div className="modal-header"><span className="modal-title">📦 New Store Item</span><button className="btn btn-ghost btn-icon" onClick={()=>setShowItemModal(false)}>✕</button></div>
              <form onSubmit={submitItem}>
                <div className="modal-body">
                  <div style={{ marginBottom:11 }}><label style={lbl}>Item Name *</label><input style={inp} required value={itemForm.name} onChange={e=>setItemForm(f=>({...f,name:e.target.value}))} /></div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:11 }}>
                    <div><label style={lbl}>Category</label><select style={inp} value={itemForm.category} onChange={e=>setItemForm(f=>({...f,category:e.target.value}))}>{CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
                    <div><label style={lbl}>Unit</label><select style={inp} value={itemForm.unit} onChange={e=>setItemForm(f=>({...f,unit:e.target.value}))}>{UNITS.map(u=><option key={u} value={u}>{u}</option>)}</select></div>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:11 }}>
                    <div><label style={lbl}>Opening Stock</label><input type="number" min="0" style={inp} value={itemForm.currentStock} onChange={e=>setItemForm(f=>({...f,currentStock:e.target.value}))} /></div>
                    <div><label style={lbl}>Reorder At</label><input type="number" min="0" style={inp} value={itemForm.minStock} onChange={e=>setItemForm(f=>({...f,minStock:e.target.value}))} /></div>
                    <div><label style={lbl}>Unit Cost (₹)</label><input type="number" min="0" style={inp} value={itemForm.unitCost} onChange={e=>setItemForm(f=>({...f,unitCost:e.target.value}))} /></div>
                  </div>
                  <div style={{ marginBottom:11 }}><label style={lbl}>Supplier</label><input style={inp} value={itemForm.supplier} onChange={e=>setItemForm(f=>({...f,supplier:e.target.value}))} /></div>
                  <div><label style={lbl}>Store Location</label><input style={inp} value={itemForm.storeLocation} onChange={e=>setItemForm(f=>({...f,storeLocation:e.target.value}))} /></div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-outline" onClick={()=>setShowItemModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={savingItem}>{savingItem?'Saving…':'✓ Add Item'}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── STOCK IN / ADJUST MODAL ── */}
      <AnimatePresence>
        {stockModal && (
          <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)setStockModal(null);}}>
            <motion.div className="modal-box" style={{ maxWidth:380 }} initial={{opacity:0,y:20}} animate={{opacity:1,y:0}}>
              <div className="modal-header"><span className="modal-title">{stockModal.kind==='in' ? '➕ Stock In' : '⚖️ Adjust Stock'} — {stockModal.item.name}</span><button className="btn btn-ghost btn-icon" onClick={()=>setStockModal(null)}>✕</button></div>
              <div className="modal-body">
                <div style={{ fontSize:12, color:'#64748b', marginBottom:12 }}>Current stock: {stockModal.item.currentStock} {stockModal.item.unit}</div>
                <div style={{ marginBottom:11 }}><label style={lbl}>{stockModal.kind==='in' ? 'Quantity to add' : 'New total quantity'} *</label><input type="number" min="0" style={inp} value={stockQty} onChange={e=>setStockQty(e.target.value)} /></div>
                <div><label style={lbl}>Reason</label><input style={inp} value={stockReason} onChange={e=>setStockReason(e.target.value)} placeholder={stockModal.kind==='in' ? 'e.g. Purchase from ABC Suppliers' : 'e.g. Wastage, expired stock'} /></div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-outline" onClick={()=>setStockModal(null)}>Cancel</button>
                <button className="btn btn-primary" disabled={savingStock} onClick={submitStock}>{savingStock?'Saving…':'✓ Save'}</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── LEDGER MODAL ── */}
      <AnimatePresence>
        {ledgerFor && (
          <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)setLedgerFor(null);}}>
            <motion.div className="modal-box" style={{ maxWidth:480 }} initial={{opacity:0,y:20}} animate={{opacity:1,y:0}}>
              <div className="modal-header"><span className="modal-title">📜 Ledger — {ledgerFor.name}</span><button className="btn btn-ghost btn-icon" onClick={()=>setLedgerFor(null)}>✕</button></div>
              <div className="modal-body" style={{ maxHeight:'60vh', overflowY:'auto' }}>
                {ledger.length === 0 ? <div style={{ textAlign:'center', color:'#94a3b8', padding:20 }}>No transactions yet</div> : ledger.map(t => (
                  <div key={t._id} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid #f1f5f9', fontSize:12.5 }}>
                    <div>
                      <div style={{ fontWeight:700, color: t.type==='in'?'#15803d':t.type==='out'?'#dc2626':'#92400e' }}>{t.type==='in'?'+':t.type==='out'?'-':'±'}{t.quantity} {ledgerFor.unit}</div>
                      <div style={{ fontSize:11, color:'#94a3b8' }}>{t.reason} · {t.performedBy?.name}</div>
                    </div>
                    <div style={{ textAlign:'right', fontSize:11, color:'#94a3b8' }}>{new Date(t.createdAt).toLocaleDateString('en-IN')}<div>Balance: {t.balanceAfter}</div></div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── NEW INDENT MODAL ── */}
      <AnimatePresence>
        {showIndentModal && (
          <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)setShowIndentModal(false);}}>
            <motion.div className="modal-box" style={{ maxWidth:560 }} initial={{opacity:0,y:20}} animate={{opacity:1,y:0}}>
              <div className="modal-header"><span className="modal-title">📋 New Indent (Supply Request)</span><button className="btn btn-ghost btn-icon" onClick={()=>setShowIndentModal(false)}>✕</button></div>
              <form onSubmit={submitIndent}>
                <div className="modal-body" style={{ maxHeight:'70vh', overflowY:'auto' }}>
                  <div style={{ marginBottom:11 }}><label style={lbl}>Department *</label><input style={inp} required value={indentForm.department} onChange={e=>setIndentForm(f=>({...f,department:e.target.value}))} /></div>
                  <div style={{ marginBottom:11 }}>
                    <label style={lbl}>Items *</label>
                    {indentLines.map((l, idx) => (
                      <div key={idx} style={{ display:'grid', gridTemplateColumns:'2fr 1fr auto', gap:6, marginBottom:6 }}>
                        <select style={inp} value={l.item} onChange={e=>updateIndentLine(idx,{item:e.target.value})}>
                          <option value="">— Select item —</option>
                          {items.map(it=><option key={it._id} value={it._id}>{it.name} ({it.currentStock} {it.unit} in stock)</option>)}
                        </select>
                        <input type="number" min="1" placeholder="Qty" style={inp} value={l.requestedQuantity} onChange={e=>updateIndentLine(idx,{requestedQuantity:e.target.value})} />
                        <button type="button" onClick={()=>removeIndentLine(idx)} style={{ background:'none', border:'none', color:'#dc2626', cursor:'pointer', fontSize:16 }}>✕</button>
                      </div>
                    ))}
                    <button type="button" className="btn btn-outline btn-sm" onClick={addIndentLine}>+ Add Item</button>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:11 }}>
                    <div><label style={lbl}>Priority</label><select style={inp} value={indentForm.priority} onChange={e=>setIndentForm(f=>({...f,priority:e.target.value}))}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></div>
                    <div><label style={lbl}>Needed By</label><input type="date" style={inp} value={indentForm.neededBy} onChange={e=>setIndentForm(f=>({...f,neededBy:e.target.value}))} /></div>
                  </div>
                  <div><label style={lbl}>Reason</label><textarea style={inp} rows={2} value={indentForm.reason} onChange={e=>setIndentForm(f=>({...f,reason:e.target.value}))} /></div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-outline" onClick={()=>setShowIndentModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={creatingIndent}>{creatingIndent?'Submitting…':'✓ Submit Indent'}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── REVIEW INDENT MODAL ── */}
      <AnimatePresence>
        {reviewFor && (
          <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)setReviewFor(null);}}>
            <motion.div className="modal-box" style={{ maxWidth:460 }} initial={{opacity:0,y:20}} animate={{opacity:1,y:0}}>
              <div className="modal-header"><span className="modal-title">Review {reviewFor.indentNumber}</span><button className="btn btn-ghost btn-icon" onClick={()=>setReviewFor(null)}>✕</button></div>
              <div className="modal-body">
                <div style={{ fontSize:12.5, color:'#64748b', marginBottom:12 }}>Set the approved quantity for each item (defaults to what was requested).</div>
                {reviewFor.items.map((it,i) => (
                  <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8, gap:10 }}>
                    <div style={{ fontSize:12.5 }}>{it.item?.name} <span style={{ color:'#94a3b8' }}>(requested {it.requestedQuantity}, {it.item?.currentStock} in stock)</span></div>
                    <input type="number" min="0" max={it.item?.currentStock} style={{ ...inp, width:90 }} value={reviewQtys[it.item._id] ?? it.requestedQuantity} onChange={e=>setReviewQtys(q=>({...q,[it.item._id]:Number(e.target.value)}))} />
                  </div>
                ))}
              </div>
              <div className="modal-footer">
                <button className="btn btn-outline" disabled={reviewing} onClick={()=>submitReview('reject')}>Reject</button>
                <button className="btn btn-primary" disabled={reviewing} onClick={()=>submitReview('approve')}>{reviewing?'Saving…':'✓ Approve'}</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
