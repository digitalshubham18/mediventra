import React, { useState, useEffect } from 'react';
import { staffingAPI } from '../utils/api';

export default function PredictiveStaffingPage() {
  const [forecast, setForecast] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    staffingAPI.getForecast().then(res => setForecast(res.data.data || [])).catch(()=>{}).finally(()=>setLoading(false));
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">📈 Predictive Staffing</div>
          <div className="page-subtitle">7-day patient volume forecast based on real historical appointment trends — a transparent weekday-average model, not a black box</div>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:60, color:'#94a3b8' }}>Loading…</div>
      ) : forecast.length === 0 ? (
        <div style={{ textAlign:'center', padding:60, color:'#94a3b8' }}>Not enough appointment history yet to forecast.</div>
      ) : (
        <div className="card">
          <div className="card-body">
            <div style={{ display:'flex', gap:14, marginBottom:20 }}>
              {forecast.map(d => (
                <div key={d.date} style={{ flex:1, textAlign:'center' }}>
                  <div style={{ fontSize:12, color:'#64748b', marginBottom:6, fontWeight:700 }}>{d.weekday}</div>
                  <div style={{ fontSize:10.5, color:'#94a3b8', marginBottom:6 }}>{new Date(d.date).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</div>
                  <div style={{
                    height:110, borderRadius:10, display:'flex', alignItems:'flex-end', justifyContent:'center', paddingBottom:8,
                    background: d.surgeRisk==='high' ? '#fee2e2' : d.surgeRisk==='moderate' ? '#fef3c7' : '#f0fdf4',
                  }}>
                    <span style={{ fontSize:20, fontWeight:800, color: d.surgeRisk==='high' ? '#dc2626' : d.surgeRisk==='moderate' ? '#d97706' : '#059669' }}>{d.projectedPatients}</span>
                  </div>
                  <div style={{ fontSize:10, color:'#94a3b8', marginTop:6, textTransform:'uppercase', fontWeight:700 }}>{d.surgeRisk}</div>
                </div>
              ))}
            </div>
            {forecast.some(d=>d.surgeRisk==='high') && (
              <div style={{ fontSize:13, color:'#dc2626', background:'#fef2f2', padding:'12px 16px', borderRadius:10 }}>
                ⚠️ <strong>{forecast.filter(d=>d.surgeRisk==='high').map(d=>d.weekday).join(', ')}</strong> projected above normal volume — consider scheduling extra staff.
              </div>
            )}
            <div style={{ fontSize:11, color:'#cbd5e1', marginTop:14 }}>Method: weekday historical average over the last 8 weeks of appointments</div>
          </div>
        </div>
      )}
    </div>
  );
}
