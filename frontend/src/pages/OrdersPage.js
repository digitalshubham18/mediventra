import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ordersAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const INR = v => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

const STATUS_NEXT  = { processing: 'confirmed', confirmed: 'shipped', shipped: 'delivered' };
const STATUS_BADGE = { processing: 'badge-warning', confirmed: 'badge-primary', shipped: 'badge-teal', delivered: 'badge-success', cancelled: 'badge-danger', pending: 'badge-gray' };
const STATUS_FLOW  = ['processing', 'confirmed', 'shipped', 'delivered'];

export function OrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState(null);
  const [advancing, setAdvancing] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await ordersAPI.getAll(filter ? { status: filter } : {});
      setOrders(res.data.data || []);
    } catch { toast.error('Failed to load orders'); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [filter]);

  const advance = async (id, next) => {
    setAdvancing(id);
    try {
      await ordersAPI.updateStatus(id, next);
      toast.success(`Order status → ${next}`);
      load();
      if (selected?._id === id) setSelected(s => ({ ...s, status: next }));
    } catch (e) { toast.error(e.response?.data?.error || 'Update failed'); }
    setAdvancing(null);
  };

  const cancelOrder = async (id) => {
    if (!window.confirm('Cancel this order?')) return;
    try {
      await ordersAPI.cancel(id);
      toast.success('Order cancelled');
      load();
      setSelected(null);
    } catch (e) { toast.error(e.response?.data?.error || 'Failed to cancel'); }
  };

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">Medicine Orders</div><div className="page-subtitle">Track and manage all orders</div></div>
        <select className="form-input" style={{ width: 150 }} value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="">All Status</option>
          {['processing', 'confirmed', 'shipped', 'delivered', 'cancelled'].map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      <div className="stat-grid mb-3">
        {[['🛒', 'Total', orders.length, '#e8effe'], ['⏳', 'Processing', orders.filter(o => o.status === 'processing').length, '#fffbeb'], ['🚚', 'Shipped', orders.filter(o => o.status === 'shipped').length, '#e0f7fa'], ['✅', 'Delivered', orders.filter(o => o.status === 'delivered').length, '#ecfdf5']].map(([ic, l, v, c], i) => (
          <motion.div key={l} className="stat-card" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * .07 }}>
            <div className="stat-icon" style={{ background: c }}>{ic}</div>
            <div className="stat-value">{v}</div>
            <div className="stat-label">{l}</div>
          </motion.div>
        ))}
      </div>

      <motion.div className="card" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <div className="card-body-0">
          {loading ? <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner-lg" style={{ margin: '0 auto' }} /></div> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>#</th><th>Patient</th><th>Items</th><th>Total</th><th>Payment</th><th>Date</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {orders.length === 0 ? <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: '#94a3b8' }}>No orders found</td></tr>
                    : orders.map(o => (
                      <tr key={o._id}>
                        <td className="text-xs text-muted">{o.orderNumber}</td>
                        <td className="td-main">{o.patient?.name}</td>
                        <td className="text-sm" style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {o.items?.map(i => `${i.medicineName} ×${i.quantity}`).join(', ')}
                        </td>
                        <td className="fw-7 text-green">{INR(o.totalAmount)}</td>
                        <td><span className={`badge ${o.paymentStatus === 'paid' ? 'badge-success' : 'badge-warning'}`}>{o.paymentStatus === 'paid' ? '✅ Paid' : '⏳ Pending'}</span></td>
                        <td className="text-sm">{new Date(o.createdAt).toLocaleDateString()}</td>
                        <td><span className={`badge ${STATUS_BADGE[o.status] || 'badge-gray'}`}>{o.status}</span></td>
                        <td>
                          <div className="flex gap-1">
                            {STATUS_NEXT[o.status] && ['admin', 'pharmacist'].includes(user?.role) && (
                              <button className="btn btn-success btn-xs" disabled={advancing === o._id} onClick={() => advance(o._id, STATUS_NEXT[o.status])}>
                                {advancing === o._id ? '…' : `${STATUS_NEXT[o.status]} →`}
                              </button>
                            )}
                            <button className="btn btn-outline btn-xs" onClick={() => setSelected(o)}>Details</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </motion.div>

      {/* ── Order Details Modal ── */}
      <AnimatePresence>
        {selected && (
          <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setSelected(null); }}>
            <motion.div className="modal-box" style={{ maxWidth: 560 }} initial={{ opacity: 0, y: 20, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: .97 }}>
              <div className="modal-header">
                <span className="modal-title">📦 Order {selected.orderNumber}</span>
                <button className="btn btn-ghost btn-icon" onClick={() => setSelected(null)}>✕</button>
              </div>
              <div className="modal-body">
                {/* Status progress */}
                {selected.status !== 'cancelled' && (
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 22, padding: '0 4px' }}>
                    {STATUS_FLOW.map((s, i) => {
                      const currentIdx = STATUS_FLOW.indexOf(selected.status);
                      const done = i <= currentIdx;
                      return (
                        <React.Fragment key={s}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                            <div style={{ width: 26, height: 26, borderRadius: '50%', background: done ? '#22c55e' : '#e2e8f0', color: done ? '#fff' : '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>{done ? '✓' : i + 1}</div>
                            <span style={{ fontSize: 10.5, color: done ? '#15803d' : '#94a3b8', fontWeight: 600, textTransform: 'capitalize', whiteSpace: 'nowrap' }}>{s}</span>
                          </div>
                          {i < STATUS_FLOW.length - 1 && <div style={{ flex: 1, height: 2, background: i < currentIdx ? '#22c55e' : '#e2e8f0', margin: '0 4px 14px' }} />}
                        </React.Fragment>
                      );
                    })}
                  </div>
                )}
                {selected.status === 'cancelled' && (
                  <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '10px 14px', marginBottom: 18, color: '#dc2626', fontSize: 13, fontWeight: 700, textAlign: 'center' }}>❌ This order was cancelled</div>
                )}

                {/* Patient & payment info */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18 }}>
                  <div style={{ background: '#f8fafc', borderRadius: 10, padding: '10px 14px' }}>
                    <div className="text-xs text-muted" style={{ marginBottom: 3 }}>Patient</div>
                    <div className="fw-7 text-sm">{selected.patient?.name}</div>
                    <div className="text-xs text-muted">{selected.patient?.email}</div>
                  </div>
                  <div style={{ background: '#f8fafc', borderRadius: 10, padding: '10px 14px' }}>
                    <div className="text-xs text-muted" style={{ marginBottom: 3 }}>Payment</div>
                    <div className="fw-7 text-sm">
                      <span className={`badge ${selected.paymentStatus === 'paid' ? 'badge-success' : 'badge-warning'}`}>{selected.paymentStatus === 'paid' ? '✅ Paid' : '⏳ Pending'}</span>
                    </div>
                    <div className="text-xs text-muted" style={{ textTransform: 'capitalize', marginTop: 3 }}>{selected.paymentMethod}</div>
                  </div>
                </div>

                {/* Items table */}
                <div className="text-xs text-muted" style={{ marginBottom: 8, fontWeight: 700, letterSpacing: .5, textTransform: 'uppercase' }}>Order Items</div>
                <div style={{ background: '#f8fafc', borderRadius: 10, padding: '4px 14px', marginBottom: 18 }}>
                  {selected.items?.map((it, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: i < selected.items.length - 1 ? '1px solid #e2e8f0' : 'none' }}>
                      <div>
                        <div className="text-sm fw-6">{it.medicineName}</div>
                        <div className="text-xs text-muted">{INR(it.unitPrice)} × {it.quantity}</div>
                      </div>
                      <div className="fw-7 text-sm">{INR(it.subtotal)}</div>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 6px', borderTop: '2px solid #e2e8f0', marginTop: 4 }}>
                    <span className="fw-8">Total</span>
                    <span className="fw-8 text-green" style={{ fontSize: 15 }}>{INR(selected.totalAmount)}</span>
                  </div>
                </div>

                {/* Delivery address */}
                {selected.deliveryAddress && (
                  <>
                    <div className="text-xs text-muted" style={{ marginBottom: 8, fontWeight: 700, letterSpacing: .5, textTransform: 'uppercase' }}>Delivery Address</div>
                    <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 10, padding: '10px 14px', marginBottom: 18, fontSize: 13, color: '#0369a1' }}>
                      📍 {selected.deliveryAddress.street}, {selected.deliveryAddress.city}, {selected.deliveryAddress.state} {selected.deliveryAddress.zip}
                      {selected.deliveryNotes && <div style={{ marginTop: 4, fontSize: 12, color: '#64748b' }}>📝 {selected.deliveryNotes}</div>}
                    </div>
                  </>
                )}

                {/* Status history */}
                {selected.statusHistory?.length > 0 && (
                  <>
                    <div className="text-xs text-muted" style={{ marginBottom: 8, fontWeight: 700, letterSpacing: .5, textTransform: 'uppercase' }}>Order Timeline</div>
                    <div style={{ marginBottom: 6 }}>
                      {selected.statusHistory.map((h, i) => (
                        <div key={i} style={{ display: 'flex', gap: 10, padding: '6px 0', fontSize: 12.5 }}>
                          <span style={{ color: '#94a3b8', minWidth: 110 }}>{new Date(h.timestamp).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                          <span className="fw-6" style={{ textTransform: 'capitalize' }}>{h.status}</span>
                          {h.note && <span style={{ color: '#64748b' }}>— {h.note}</span>}
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {selected.prescriptionRequired && (
                  <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 10, padding: '10px 14px', fontSize: 12.5, color: '#92400e' }}>
                    📋 This order requires a valid prescription{selected.prescription ? ' — uploaded ✅' : ' — not yet uploaded ⚠️'}
                  </div>
                )}
              </div>
              <div className="modal-footer">
                {selected.status !== 'cancelled' && selected.status !== 'delivered' && ['admin', 'pharmacist'].includes(user?.role) && (
                  <button className="btn btn-outline" style={{ color: '#dc2626', borderColor: '#fecaca' }} onClick={() => cancelOrder(selected._id)}>Cancel Order</button>
                )}
                {STATUS_NEXT[selected.status] && ['admin', 'pharmacist'].includes(user?.role) && (
                  <button className="btn btn-success" disabled={advancing === selected._id} onClick={() => advance(selected._id, STATUS_NEXT[selected.status])}>
                    {advancing === selected._id ? 'Updating…' : `Mark as ${STATUS_NEXT[selected.status]} →`}
                  </button>
                )}
                <button className="btn btn-primary" onClick={() => setSelected(null)}>Close</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default OrdersPage;
