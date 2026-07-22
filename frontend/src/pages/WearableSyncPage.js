import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, LineElement, PointElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import { wearableAPI } from '../utils/api';
import toast from 'react-hot-toast';

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, Title, Tooltip, Legend, Filler);

const CHART_OPTS = { responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display:true, position:'bottom', labels:{ boxWidth:10, font:{ size:11 } } } }, scales:{ x:{ grid:{ display:false }, ticks:{ font:{ size:10 } } }, y:{ grid:{ color:'rgba(0,0,0,.04)' } } } };

const EMPTY_FORM = { steps:'', heartRate:'', sleepHours:'', caloriesBurned:'', weight:'', spo2:'', bpSystolic:'', bpDiastolic:'', bloodGlucose:'' };

export default function WearableSyncPage() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [fitbitNotice, setFitbitNotice] = useState('');
  const [googleFitNotice, setGoogleFitNotice] = useState('');
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);

  const load = () => {
    setLoading(true);
    wearableAPI.getMine().then(res => setEntries(res.data.data || [])).catch(()=>{}).finally(()=>setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const latest = entries[0];
  const flaggedRecent = entries.filter(e => e.flagged).slice(0, 5);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await wearableAPI.addEntry(form);
      toast.success(res.data.data?.flagged ? '⚠️ Logged — one or more readings look outside the normal range' : '✅ Logged!');
      setShowAdd(false);
      setForm(EMPTY_FORM);
      load();
    } catch { toast.error('Failed to save'); }
    setSaving(false);
  };

  const connectFitbit = async () => {
    setFitbitNotice('');
    try {
      const res = await wearableAPI.fitbitConnect();
      window.location.href = res.data.url;
    } catch (err) {
      const msg = err.response?.data?.error || 'Fitbit sync not available';
      setFitbitNotice(msg);
      toast.error('Fitbit isn\u2019t set up yet — try importing a file instead');
    }
  };

  const connectGoogleFit = async () => {
    setGoogleFitNotice('');
    try {
      const res = await wearableAPI.googleFitConnect();
      window.location.href = res.data.url;
    } catch (err) {
      const msg = err.response?.data?.error || 'Google Fit sync not available';
      setGoogleFitNotice(msg);
      toast.error('Google Fit isn\u2019t set up yet — try importing a file instead');
    }
  };

  const pickFile = () => fileInputRef.current?.click();

  const onFileSelected = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;
    if (!/\.csv$/i.test(file.name)) { toast.error('Please choose a .csv file'); return; }
    setImporting(true);
    try {
      const text = await file.text();
      const res = await wearableAPI.importCsv(text);
      const { imported, flagged, skipped } = res.data;
      toast.success(`✅ Imported ${imported} entr${imported===1?'y':'ies'}${flagged ? ` — ${flagged} flagged for review` : ''}${skipped ? ` (${skipped} row(s) skipped)` : ''}`, { duration:6000 });
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to import file');
    }
    setImporting(false);
  };

  // Build a 14-point trend from the most recent entries (oldest → newest)
  const trendSource = [...entries].slice(0, 14).reverse();
  const trendLabels = trendSource.map(e => new Date(e.date).toLocaleDateString('en-IN',{ day:'numeric', month:'short' }));
  const trendData = {
    labels: trendLabels,
    datasets: [
      { label:'Steps (÷100)', data: trendSource.map(e => e.steps!=null ? Math.round(e.steps/100) : null), borderColor:'#1648c9', backgroundColor:'rgba(22,72,201,.08)', tension:.35, spanGaps:true, pointRadius:3 },
      { label:'Resting HR (bpm)', data: trendSource.map(e => e.heartRate ?? null), borderColor:'#dc2626', backgroundColor:'rgba(220,38,38,.08)', tension:.35, spanGaps:true, pointRadius:3 },
      { label:'Sleep (h)', data: trendSource.map(e => e.sleepHours ?? null), borderColor:'#7c3aed', backgroundColor:'rgba(124,58,237,.08)', tension:.35, spanGaps:true, pointRadius:3 },
    ],
  };
  const hasTrendData = trendSource.some(e => e.steps!=null || e.heartRate!=null || e.sleepHours!=null);

  // Clinical vitals get their own chart (different units/purpose from the
  // fitness metrics above) — weight rides a secondary axis since its scale
  // doesn't share ground with BP/SpO2/glucose.
  const clinicalData = {
    labels: trendLabels,
    datasets: [
      { label:'BP Systolic', data: trendSource.map(e => e.bpSystolic ?? null), borderColor:'#dc2626', backgroundColor:'rgba(220,38,38,.06)', tension:.35, spanGaps:true, pointRadius:3, yAxisID:'y' },
      { label:'BP Diastolic', data: trendSource.map(e => e.bpDiastolic ?? null), borderColor:'#f97316', backgroundColor:'rgba(249,115,22,.06)', tension:.35, spanGaps:true, pointRadius:3, yAxisID:'y' },
      { label:'SpO2 (%)', data: trendSource.map(e => e.spo2 ?? null), borderColor:'#0891b2', backgroundColor:'rgba(8,145,178,.06)', tension:.35, spanGaps:true, pointRadius:3, yAxisID:'y' },
      { label:'Glucose (mg/dL)', data: trendSource.map(e => e.bloodGlucose ?? null), borderColor:'#7c3aed', backgroundColor:'rgba(124,58,237,.06)', tension:.35, spanGaps:true, pointRadius:3, yAxisID:'y' },
      { label:'Weight (kg)', data: trendSource.map(e => e.weight ?? null), borderColor:'#059669', backgroundColor:'rgba(5,150,105,.06)', tension:.35, spanGaps:true, pointRadius:3, yAxisID:'y1', borderDash:[5,3] },
    ],
  };
  const CLINICAL_CHART_OPTS = { ...CHART_OPTS, scales:{ x:{ grid:{ display:false }, ticks:{ font:{ size:10 } } }, y:{ grid:{ color:'rgba(0,0,0,.04)' }, title:{ display:true, text:'BP / SpO2 / Glucose', font:{ size:10 } } }, y1:{ position:'right', grid:{ display:false }, title:{ display:true, text:'Weight (kg)', font:{ size:10 } } } } };
  const hasClinicalData = trendSource.some(e => e.bpSystolic!=null || e.spo2!=null || e.bloodGlucose!=null || e.weight!=null);

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">⌚ Health & Vitals Tracker</div>
          <div className="page-subtitle">Steps, heart rate, sleep, weight, BP, SpO2 and glucose — logged manually, imported from a health-app export, or synced via Fitbit / Google Fit</div>
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <input ref={fileInputRef} type="file" accept=".csv" style={{ display:'none' }} onChange={onFileSelected} />
          <button className="btn btn-outline" onClick={pickFile} disabled={importing}>{importing ? 'Importing…' : '📤 Import CSV'}</button>
          <button className="btn btn-outline" onClick={connectFitbit}>Connect Fitbit</button>
          <button className="btn btn-outline" onClick={connectGoogleFit}>Connect Google Fit</button>
          <button className="btn btn-primary" onClick={()=>setShowAdd(true)}>+ Log Manually</button>
        </div>
      </div>

      {fitbitNotice && (
        <div style={{ background:'#fef3c7', border:'1px solid #fde68a', borderRadius:10, padding:'12px 16px', marginBottom:18, fontSize:13, color:'#92400e' }}>
          ⚠️ <strong>Fitbit isn't connected yet:</strong> {fitbitNotice}
          <div style={{ marginTop:6, fontSize:12 }}>In the meantime, you can <strong>Import CSV</strong> — most fitness/health apps (Fitbit, Google Fit, Samsung Health) let you export your data as a CSV file from their own app or web dashboard, no account linking needed here.</div>
        </div>
      )}
      {googleFitNotice && (
        <div style={{ background:'#fef3c7', border:'1px solid #fde68a', borderRadius:10, padding:'12px 16px', marginBottom:18, fontSize:13, color:'#92400e' }}>
          ⚠️ <strong>Google Fit isn't connected yet:</strong> {googleFitNotice}
          <div style={{ marginTop:6, fontSize:12 }}>In the meantime, you can <strong>Import CSV</strong> instead.</div>
        </div>
      )}

      {flaggedRecent.length > 0 && (
        <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:10, padding:'12px 16px', marginBottom:18 }}>
          <div style={{ fontSize:13, fontWeight:800, color:'#dc2626', marginBottom:6 }}>⚠️ Some recent readings are outside the normal range</div>
          {flaggedRecent.map(e => (
            <div key={e._id} style={{ fontSize:12, color:'#991b1b', marginBottom:3 }}>
              {new Date(e.date).toLocaleDateString('en-IN',{day:'numeric',month:'short'})} — {e.flagReasons.join(' · ')}
            </div>
          ))}
          <div style={{ fontSize:11, color:'#b91c1c', marginTop:4 }}>Your last treating doctor has been notified. Please consult a doctor if you feel unwell.</div>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign:'center', padding:60, color:'#94a3b8' }}>Loading…</div>
      ) : (
        <>
          <div className="card" style={{ marginBottom:18 }}>
            <div className="card-header"><span className="card-title">Today's Snapshot</span></div>
            <div className="card-body">
              {!latest ? (
                <div style={{ textAlign:'center', padding:20, color:'#94a3b8', fontSize:13 }}>No health data yet — log manually, import a file, or connect Fitbit to get started.</div>
              ) : (
                <div style={{ display:'flex', gap:28, flexWrap:'wrap' }}>
                  {latest.steps!=null && <Stat v={latest.steps.toLocaleString()} l="Steps" />}
                  {latest.heartRate!=null && <Stat v={latest.heartRate} l="Resting BPM" bad={latest.flagged && latest.flagReasons.some(r=>r.includes('heart rate'))} />}
                  {latest.sleepHours!=null && <Stat v={`${latest.sleepHours}h`} l="Sleep" />}
                  {latest.weight!=null && <Stat v={`${latest.weight}kg`} l="Weight" />}
                  {latest.spo2!=null && <Stat v={`${latest.spo2}%`} l="SpO2" bad={latest.flagged && latest.flagReasons.some(r=>r.includes('Oxygen'))} />}
                  {(latest.bpSystolic!=null && latest.bpDiastolic!=null) && <Stat v={`${latest.bpSystolic}/${latest.bpDiastolic}`} l="BP (mmHg)" bad={latest.flagged && latest.flagReasons.some(r=>r.includes('Blood pressure'))} />}
                  {latest.bloodGlucose!=null && <Stat v={latest.bloodGlucose} l="Glucose (mg/dL)" bad={latest.flagged && latest.flagReasons.some(r=>r.includes('glucose'))} />}
                  <div style={{fontSize:11,color:'#cbd5e1',alignSelf:'flex-end'}}>via {{manual:'manual entry',fitbit:'Fitbit',google_fit:'Google Fit',import:'file import'}[latest.source] || latest.source} · {new Date(latest.date).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</div>
                </div>
              )}
            </div>
          </div>

          {hasTrendData && (
            <div className="card" style={{ marginBottom:18 }}>
              <div className="card-header"><span className="card-title">Fitness Trend (last {trendSource.length} entries)</span></div>
              <div className="card-body" style={{ height:240 }}>
                <Line data={trendData} options={CHART_OPTS} />
              </div>
            </div>
          )}

          {hasClinicalData && (
            <div className="card" style={{ marginBottom:18 }}>
              <div className="card-header"><span className="card-title">Clinical Vitals Trend (BP · SpO2 · Glucose · Weight)</span></div>
              <div className="card-body" style={{ height:240 }}>
                <Line data={clinicalData} options={CLINICAL_CHART_OPTS} />
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-header"><span className="card-title">History</span></div>
            <div className="card-body">
              {entries.length === 0 ? (
                <div style={{ textAlign:'center', padding:16, color:'#94a3b8', fontSize:12.5 }}>Nothing logged yet.</div>
              ) : entries.map(e => (
                <div key={e._id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'9px 12px', background: e.flagged ? '#fef2f2' : '#f8fafc', borderRadius:9, marginBottom:6, flexWrap:'wrap', gap:6 }}>
                  <span className="text-sm">{e.flagged && '⚠️ '}{new Date(e.date).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</span>
                  <span className="text-xs text-muted">
                    {[
                      e.steps!=null && `${e.steps} steps`,
                      e.heartRate!=null && `${e.heartRate} bpm`,
                      e.sleepHours!=null && `${e.sleepHours}h sleep`,
                      e.weight!=null && `${e.weight}kg`,
                      e.spo2!=null && `SpO2 ${e.spo2}%`,
                      (e.bpSystolic!=null && e.bpDiastolic!=null) && `BP ${e.bpSystolic}/${e.bpDiastolic}`,
                      e.bloodGlucose!=null && `Glucose ${e.bloodGlucose}`,
                    ].filter(Boolean).join(' · ')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <AnimatePresence>
        {showAdd && (
          <div className="modal-overlay" onClick={e=>{ if(e.target===e.currentTarget) setShowAdd(false); }}>
            <motion.div className="modal-box" style={{ maxWidth:440 }} initial={{ opacity:0,y:20,scale:.97 }} animate={{ opacity:1,y:0,scale:1 }}>
              <div className="modal-header"><span className="modal-title">Log Today's Data</span><button className="btn btn-ghost btn-icon" onClick={()=>setShowAdd(false)}>✕</button></div>
              <form onSubmit={submit}>
                <div className="modal-body">
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                    <div className="form-group"><label className="form-label">Steps</label><input type="number" className="form-input" value={form.steps} onChange={e=>setForm(f=>({...f,steps:e.target.value}))} /></div>
                    <div className="form-group"><label className="form-label">Resting Heart Rate (bpm)</label><input type="number" className="form-input" value={form.heartRate} onChange={e=>setForm(f=>({...f,heartRate:e.target.value}))} /></div>
                    <div className="form-group"><label className="form-label">Sleep (hours)</label><input type="number" step="0.1" className="form-input" value={form.sleepHours} onChange={e=>setForm(f=>({...f,sleepHours:e.target.value}))} /></div>
                    <div className="form-group"><label className="form-label">Calories Burned</label><input type="number" className="form-input" value={form.caloriesBurned} onChange={e=>setForm(f=>({...f,caloriesBurned:e.target.value}))} /></div>
                    <div className="form-group"><label className="form-label">Weight (kg)</label><input type="number" step="0.1" className="form-input" value={form.weight} onChange={e=>setForm(f=>({...f,weight:e.target.value}))} /></div>
                    <div className="form-group"><label className="form-label">SpO2 (%)</label><input type="number" className="form-input" value={form.spo2} onChange={e=>setForm(f=>({...f,spo2:e.target.value}))} /></div>
                    <div className="form-group"><label className="form-label">BP Systolic</label><input type="number" className="form-input" value={form.bpSystolic} onChange={e=>setForm(f=>({...f,bpSystolic:e.target.value}))} /></div>
                    <div className="form-group"><label className="form-label">BP Diastolic</label><input type="number" className="form-input" value={form.bpDiastolic} onChange={e=>setForm(f=>({...f,bpDiastolic:e.target.value}))} /></div>
                    <div className="form-group" style={{ gridColumn:'1 / -1' }}><label className="form-label">Blood Glucose (mg/dL)</label><input type="number" className="form-input" value={form.bloodGlucose} onChange={e=>setForm(f=>({...f,bloodGlucose:e.target.value}))} /></div>
                  </div>
                  <div style={{ fontSize:11, color:'#94a3b8', marginTop:6 }}>Leave anything you didn't measure today blank. Readings outside the normal range are automatically flagged and your last treating doctor is notified.</div>
                </div>
                <div className="modal-footer"><button type="button" className="btn btn-outline" onClick={()=>setShowAdd(false)}>Cancel</button><button type="submit" className="btn btn-primary" disabled={saving}>{saving?'Saving…':'Save'}</button></div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Stat({ v, l, bad }) {
  return (
    <div>
      <div style={{ fontSize:26, fontWeight:800, color: bad ? '#dc2626' : '#0f172a' }}>{v}</div>
      <div style={{ fontSize:12, color:'#94a3b8' }}>{l}</div>
    </div>
  );
}
