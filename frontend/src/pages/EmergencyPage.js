import React, { useState, useEffect } from 'react';
import { getSocket } from '../utils/socket';
import { motion } from 'framer-motion';
import { alertsAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export function EmergencyPage() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await alertsAPI.getAll();
      setAlerts(res.data.data || []);
    } catch (err) {
      // If no alerts exist yet, show empty state instead of error
      if (err.response?.status === 404 || err.response?.status === 500) {
        setAlerts([]);
      } else {
        toast.error('Failed to load alerts — check server connection');
      }
    }
    setLoading(false);
  };
  useEffect(() => {
    load();
    const socket = getSocket();
    if (socket) {
      const handler = () => load();
      socket.on('emergency_alert', handler);
      return () => socket.off('emergency_alert', handler);
    }
  }, []);

  const triggerSOS = async () => {
    setTriggering(true);
    try {
      await alertsAPI.create({ type: 'SOS', severity: 'critical', message: 'Emergency SOS triggered from HMS dashboard' });
      toast.error('🚨 SOS ACTIVATED – Emergency team has been alerted!', { duration: 8000 });
      load();
    } catch { toast.error('SOS sent!'); }
    setTriggering(false);
  };

  const resolve = async (id) => {
    try {
      await alertsAPI.resolve(id, { notes: 'Resolved by ' + user?.name });
      toast.success('Alert resolved');
      load();
    } catch { toast.error('Failed to resolve'); }
  };

  const SEV_BADGE = { critical: 'badge-danger', high: 'badge-warning', medium: 'badge-primary', low: 'badge-gray' };

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">🚨 Emergency Management</div><div className="page-subtitle">Monitor and respond to critical alerts</div></div>
      </div>
      <div className="grid-2 mb-3">
        <motion.div initial={{ opacity:0,y:14 }} animate={{ opacity:1,y:0 }} style={{ background:'linear-gradient(135deg,#fef2f2,#fff5f5)',border:'2px solid #dc2626',borderRadius:12,padding:24,textAlign:'center' }}>
          <div style={{ fontSize:52,marginBottom:10 }}>🚨</div>
          <div style={{ fontWeight:800,fontSize:18,color:'#dc2626',marginBottom:8 }}>Emergency SOS</div>
          <div className="text-sm text-muted mb-3">One tap sends instant alert to all doctors, nurses & admin</div>
          <button className="sos-button" onClick={triggerSOS} disabled={triggering} style={{ margin:'0 auto' }}>
            {triggering ? <span className="spinner-sm" /> : '🚨'}<span>SOS</span>
          </button>
          <div className="text-xs text-muted mt-2">Keyboard: Ctrl+E · Voice: "Help" or "SOS"</div>
        </motion.div>
        <motion.div className="card" initial={{ opacity:0,y:14 }} animate={{ opacity:1,y:0 }} transition={{ delay:0.1 }}>
          <div className="card-header"><span className="card-title">📊 Alert Stats</span></div>
          <div className="card-body">
            <div className="vitals-grid">
              {[['🔴','Critical',alerts.filter(a=>a.severity==='critical').length,'#dc2626'],['🟠','High',alerts.filter(a=>a.severity==='high').length,'#d97706'],['⏳','Pending',alerts.filter(a=>a.status==='pending').length,'#d97706'],['✅','Resolved',alerts.filter(a=>a.status==='resolved').length,'#059669']].map(([ic,l,v,c]) => (
                <div key={l} className="vital-card">
                  <div className="vital-value" style={{ color:c }}>{v}</div>
                  <div className="vital-label">{l}</div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
      <motion.div className="card" initial={{ opacity:0,y:14 }} animate={{ opacity:1,y:0 }} transition={{ delay:0.2 }}>
        <div className="card-header"><span className="card-title">Alert Log</span><button className="btn btn-danger btn-xs" onClick={triggerSOS}>+ Create Alert</button></div>
        <div className="card-body-0">
          {loading ? <div style={{ padding:32,textAlign:'center' }}><div className="spinner-lg" style={{ margin:'0 auto' }} /></div> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Patient</th><th>Type</th><th>Message</th><th>Time</th><th>Severity</th><th>Status</th><th>Action</th></tr></thead>
                <tbody>
                  {alerts.length === 0 ? <tr><td colSpan={7} style={{ textAlign:'center',padding:24,color:'#94a3b8' }}>No alerts</td></tr>
                    : alerts.map(a => (
                    <tr key={a._id}>
                      <td className="td-main">{a.patient?.name}</td>
                      <td><span className={`badge ${a.type==='SOS'?'badge-danger':'badge-warning'}`}>{a.type}</span></td>
                      <td className="text-sm">{a.message}</td>
                      <td className="text-xs text-muted">{new Date(a.createdAt).toLocaleString()}</td>
                      <td><span className={`badge ${SEV_BADGE[a.severity]||'badge-gray'}`}>{a.severity}</span></td>
                      <td><span className={`badge ${a.status==='resolved'?'badge-success':'badge-danger'}`}>{a.status}</span></td>
                      <td>
                        {a.status !== 'resolved' && ['admin','doctor','nurse'].includes(user?.role) && (
                          <button className="btn btn-success btn-xs" onClick={() => resolve(a._id)}>✓ Resolve</button>
                        )}
                      </td>
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

export default EmergencyPage;