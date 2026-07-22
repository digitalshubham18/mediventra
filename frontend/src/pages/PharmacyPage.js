import { useNavigate } from 'react-router-dom';
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { medicinesAPI, ordersAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import PaymentModal from '../components/PaymentModal';

export default function PharmacyPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [medicines, setMedicines] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [showCart, setShowCart] = useState(false);
  const [showAddMed, setShowAddMed] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [pendingPayment, setPendingPayment] = useState(null);
  const [prescriptionFile, setPrescriptionFile] = useState(null);
  const [medForm, setMedForm] = useState({ name: '', genericName: '', category: 'Pain Relief', price: '', stock: '', requiresPrescription: false, dosageForm: 'Tablet', strength: '', description: '' });

  const CATS = ['Pain Relief','Antibiotics','Anti-inflammatory','Gastric','Allergy','Diabetes','Cholesterol','Cardiac','Supplements','Respiratory','Other'];

  useEffect(() => {
    const load = async () => {
      try {
        const res = await medicinesAPI.getAll();
        setMedicines(res.data.data || []);
        setFiltered(res.data.data || []);
      } catch { toast.error('Failed to load medicines'); }
      setLoading(false);
    };
    load();
  }, []);

  useEffect(() => {
    let f = medicines;
    if (search) f = f.filter(m => m.name.toLowerCase().includes(search.toLowerCase()) || m.genericName?.toLowerCase().includes(search.toLowerCase()) || m.category.toLowerCase().includes(search.toLowerCase()));
    if (category) f = f.filter(m => m.category === category);
    setFiltered(f);
  }, [search, category, medicines]);

  const addToCart = (med) => {
    setCart(prev => {
      const ex = prev.find(c => c._id === med._id);
      if (ex) return prev.map(c => c._id === med._id ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { ...med, qty: 1 }];
    });
    toast.success(`${med.name} added to cart`);
  };

  const updateQty = (id, delta) => {
    setCart(prev => {
      const updated = prev.map(c => c._id === id ? { ...c, qty: c.qty + delta } : c).filter(c => c.qty > 0);
      return updated;
    });
  };

  const cartNeedsPrescription = cart.some(c => c.requiresPrescription);

  const placeOrder = async () => {
    if (!cart.length) return;
    if (cartNeedsPrescription && !prescriptionFile) {
      toast.error('Please upload a prescription — one or more items in your cart require it.');
      return;
    }
    setPlacing(true);
    try {
      const items = cart.map(c => ({ medicineId: c._id, quantity: c.qty }));
      const total = cart.reduce((s,c) => s + c.price * c.qty, 0);
      const deliveryAddress = { street:'Hospital Delivery', city:'Your City', state:'State', zip:'000000' };

      let payload;
      if (prescriptionFile) {
        payload = new FormData();
        payload.append('items', JSON.stringify(items));
        payload.append('deliveryAddress', JSON.stringify(deliveryAddress));
        payload.append('paymentMethod', 'online');
        payload.append('prescription', prescriptionFile);
      } else {
        payload = { items, deliveryAddress, paymentMethod: 'online' };
      }

      const res = await ordersAPI.create(payload);
      const order = res.data.data;
      setShowCart(false);
      setCart([]);
      setPrescriptionFile(null);
      setPendingPayment({ orderId: order._id, amount: total, description: `Medicine Order #${order.orderNumber} (${cart.length} item${cart.length>1?'s':''})` });
    } catch(err) { toast.error(err.response?.data?.error || 'Order failed'); }
    setPlacing(false);
  };

  const handlePaymentSuccess = (txn) => {
    setPendingPayment(null);
    toast.success(`✅ Order confirmed! Confirmation email sent.`);
    setTimeout(() => navigate(`/payments/${txn._id}`), 2600);
  };

  const handleAddMed = async (e) => {
    e.preventDefault();
    try {
      const res = await medicinesAPI.create({ ...medForm, price: parseFloat(medForm.price), stock: parseInt(medForm.stock) });
      setMedicines(prev => [...prev, res.data.data]);
      toast.success('Medicine added to inventory!');
      setShowAddMed(false);
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to add medicine'); }
  };

  const cartTotal = cart.reduce((s, c) => s + c.price * c.qty, 0);
  const categories = [...new Set(medicines.map(m => m.category))];

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Pharmacy</div>
          <div className="page-subtitle">{filtered.length} medicines available</div>
        </div>
        <div className="page-actions">
          {['admin','pharmacist'].includes(user?.role) && (
            <button className="btn btn-outline" onClick={() => setShowAddMed(true)}>+ Add Medicine</button>
          )}
          <button className="btn btn-primary" onClick={() => setShowCart(true)} style={{ position: 'relative' }}>
            🛒 Cart
            {cart.length > 0 && <span style={{ position: 'absolute', top: -6, right: -6, background: '#dc2626', color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{cart.length}</span>}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
        <div className="search-wrap" style={{ flex: 1, minWidth: 200 }}>
          <span className="search-icon">🔍</span>
          <input className="form-input" style={{ paddingLeft: 34 }} placeholder="Search by name, generic, category…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="form-input" style={{ width: 180 }} value={category} onChange={e => setCategory(e.target.value)}>
          <option value="">All Categories</option>
          {categories.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12 }}>
          {Array(8).fill(0).map((_, i) => <div key={i} className="skeleton skeleton-card" style={{ height: 180 }} />)}
        </div>
      ) : (
        <div className="medicine-grid">
          <AnimatePresence>
            {filtered.map((m, i) => (
              <motion.div key={m._id} className="medicine-card" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <div className="medicine-icon">{m.icon || '💊'}</div>
                <div className="medicine-name">{m.name}</div>
                <div className="medicine-cat">{m.category}</div>
                <div className="medicine-price">${m.price?.toFixed(2)}</div>
                <div className="medicine-stock">Stock: {m.stock} units</div>
                {m.requiresPrescription && <span className="badge badge-danger mt-1" style={{ fontSize: 10 }}>Rx Required</span>}
                <button className="btn btn-primary btn-sm" style={{ width: '100%', justifyContent: 'center', marginTop: 9 }} onClick={() => addToCart(m)}>
                  + Add to Cart
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
          {filtered.length === 0 && <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 40, color: '#94a3b8' }}>No medicines found</div>}
        </div>
      )}

      {/* Inventory table for admin/pharmacist */}
      {['admin','pharmacist'].includes(user?.role) && !loading && (
        <motion.div className="card mt-3" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <div className="card-header"><span className="card-title">📦 Inventory Management</span></div>
          <div className="card-body-0">
            <div className="table-wrap">
              <table>
                <thead><tr><th>Medicine</th><th>Category</th><th>Price</th><th>Stock</th><th>Level</th><th>Rx?</th><th>Action</th></tr></thead>
                <tbody>
                  {medicines.map(m => (
                    <tr key={m._id}>
                      <td><div className="td-main">{m.icon} {m.name}</div><div className="td-sub">{m.description}</div></td>
                      <td><span className="badge badge-primary">{m.category}</span></td>
                      <td className="fw-7 text-green">${m.price?.toFixed(2)}</td>
                      <td className="text-sm">{m.stock}</td>
                      <td style={{ minWidth: 90 }}>
                        <div className="progress">
                          <div className="progress-bar" style={{ background: m.stock > 150 ? 'var(--green)' : m.stock > 75 ? 'var(--amber)' : 'var(--red)', width: `${Math.min(m.stock / 3.2, 100)}%` }} />
                        </div>
                      </td>
                      <td><span className={`badge ${m.requiresPrescription ? 'badge-danger' : 'badge-success'}`}>{m.requiresPrescription ? 'Rx' : 'OTC'}</span></td>
                      <td><button className="btn btn-primary btn-xs" onClick={() => addToCart(m)}>+ Cart</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}

      {/* Cart Modal */}
      {showCart && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowCart(false); }}>
          <motion.div className="modal-box" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="modal-header">
              <span className="modal-title">🛒 Your Cart</span>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowCart(false)}>✕</button>
            </div>
            <div className="modal-body">
              {cart.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 32, color: '#94a3b8' }}>Cart is empty. Add medicines to continue.</div>
              ) : (
                <>
                  {cart.map(c => (
                    <div key={c._id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 11, border: '1.5px solid #e2e8f0', borderRadius: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: 22 }}>{c.icon || '💊'}</span>
                      <div style={{ flex: 1 }}>
                        <div className="fw-7 text-sm">{c.name}{c.requiresPrescription && <span className="badge badge-danger" style={{ fontSize: 9, marginLeft: 6 }}>Rx</span>}</div>
                        <div className="text-xs text-muted">₹{c.price?.toFixed(2)} × {c.qty}</div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button className="btn btn-outline btn-xs" onClick={() => updateQty(c._id, -1)}>-</button>
                        <span className="fw-7">{c.qty}</span>
                        <button className="btn btn-outline btn-xs" onClick={() => updateQty(c._id, 1)}>+</button>
                      </div>
                      <div className="fw-7 text-green">₹{(c.price * c.qty).toFixed(2)}</div>
                    </div>
                  ))}

                  {cartNeedsPrescription && (
                    <div style={{ background: '#fef3c7', border: '1.5px solid #fde68a', borderRadius: 10, padding: 14, marginTop: 12, marginBottom: 4 }}>
                      <div className="text-sm fw-7" style={{ color: '#92400e', marginBottom: 8 }}>📋 Prescription Required</div>
                      <div className="text-xs" style={{ color: '#92400e', marginBottom: 10 }}>One or more items in your cart require a valid prescription. Please upload it to place this order.</div>
                      <input
                        type="file"
                        id="rx-upload"
                        accept="image/jpeg,image/png,image/jpg,image/webp,application/pdf"
                        style={{ display: 'none' }}
                        onChange={e => setPrescriptionFile(e.target.files?.[0] || null)}
                      />
                      <label htmlFor="rx-upload" className="btn btn-outline btn-sm" style={{ cursor: 'pointer', display: 'inline-flex' }}>
                        📄 {prescriptionFile ? 'Change File' : 'Upload Prescription'}
                      </label>
                      {prescriptionFile && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                          <span className="text-xs" style={{ color: '#15803d', fontWeight: 700 }}>✅ {prescriptionFile.name}</span>
                          <button className="btn btn-ghost btn-xs" onClick={() => setPrescriptionFile(null)} style={{ color: '#dc2626' }}>Remove</button>
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ borderTop: '2px solid #e2e8f0', paddingTop: 12, marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="fw-7">Total:</span>
                    <span className="fw-7 text-green" style={{ fontSize: 18 }}>₹{cartTotal.toFixed(2)}</span>
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowCart(false)}>Continue Shopping</button>
              <button className="btn btn-primary" onClick={placeOrder} disabled={placing || !cart.length || (cartNeedsPrescription && !prescriptionFile)}>
                {placing ? <><span className="spinner-sm" /> Placing…</> : '🚀 Place Order'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Add Medicine Modal */}
      {showAddMed && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowAddMed(false); }}>
          <motion.div className="modal-box" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="modal-header">
              <span className="modal-title">+ Add Medicine</span>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowAddMed(false)}>✕</button>
            </div>
            <form onSubmit={handleAddMed}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group"><label className="form-label">Name *</label><input className="form-input" required value={medForm.name} onChange={e => setMedForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Paracetamol 500mg" /></div>
                  <div className="form-group"><label className="form-label">Generic Name</label><input className="form-input" value={medForm.genericName} onChange={e => setMedForm(f => ({ ...f, genericName: e.target.value }))} placeholder="Generic name" /></div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label className="form-label">Category</label><select className="form-input" value={medForm.category} onChange={e => setMedForm(f => ({ ...f, category: e.target.value }))}>{CATS.map(c => <option key={c}>{c}</option>)}</select></div>
                  <div className="form-group"><label className="form-label">Dosage Form</label><select className="form-input" value={medForm.dosageForm} onChange={e => setMedForm(f => ({ ...f, dosageForm: e.target.value }))}>{['Tablet','Capsule','Syrup','Injection','Cream','Inhaler'].map(d => <option key={d}>{d}</option>)}</select></div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label className="form-label">Price (₹) *</label><input className="form-input" type="number" step="0.01" required value={medForm.price} onChange={e => setMedForm(f => ({ ...f, price: e.target.value }))} placeholder="0.00" /></div>
                  <div className="form-group"><label className="form-label">Stock *</label><input className="form-input" type="number" required value={medForm.stock} onChange={e => setMedForm(f => ({ ...f, stock: e.target.value }))} placeholder="Units" /></div>
                </div>
                <div className="form-group"><label className="form-label">Description</label><input className="form-input" value={medForm.description} onChange={e => setMedForm(f => ({ ...f, description: e.target.value }))} placeholder="Brief description" /></div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                  <input type="checkbox" checked={medForm.requiresPrescription} onChange={e => setMedForm(f => ({ ...f, requiresPrescription: e.target.checked }))} />
                  Requires Prescription (Rx)
                </label>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowAddMed(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Add Medicine</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
      {pendingPayment && (
        <PaymentModal
          type="order"
          refId={pendingPayment.orderId}
          amount={pendingPayment.amount}
          description={pendingPayment.description}
          onSuccess={handlePaymentSuccess}
          onClose={() => setPendingPayment(null)}
        />
      )}
    </div>
  );
}