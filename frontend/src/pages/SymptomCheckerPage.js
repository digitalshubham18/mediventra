// SymptomCheckerPage.js
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { alertsAPI } from '../utils/api';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const SYMPTOMS = ['Fever','Headache','Chest Pain','Shortness of Breath','Cough','Fatigue','Nausea','Dizziness','Sore Throat','Back Pain','Joint Pain','Rash','Abdominal Pain','Blurred Vision','Palpitations','Swelling','Chills','Vomiting'];

const AI_ENGINE = {
  'Chest Pain': { cond:'Possible Cardiac Event', risk:'Critical', action:'SEEK EMERGENCY CARE IMMEDIATELY. Do not wait.', dept:'Cardiology', meds:[], urgent:true },
  'Shortness of Breath': { cond:'Respiratory / Cardiac Distress', risk:'High', action:'Consult doctor immediately. May need oxygen assessment.', dept:'Pulmonology', meds:[], urgent:true },
  'Fever': { cond:'Infectious / Viral Illness', risk:'Low', action:'Rest, hydrate, antipyretics. Consult if fever > 3 days.', dept:'General Medicine', meds:['Paracetamol 500mg'] },
  'Headache': { cond:'Tension Headache / Migraine', risk:'Low', action:'OTC pain relief. Monitor frequency. Consult if recurrent.', dept:'Neurology', meds:['Ibuprofen 400mg'] },
  'Rash': { cond:'Allergic Reaction / Dermatitis', risk:'Low', action:'Antihistamines. Identify and avoid allergen.', dept:'Dermatology', meds:['Cetirizine 10mg'] },
  'Nausea': { cond:'Gastrointestinal Disorder', risk:'Low', action:'Dietary modification. OTC antacids if needed.', dept:'Gastroenterology', meds:['Omeprazole 20mg'] },
  'Palpitations': { cond:'Arrhythmia / Anxiety', risk:'Medium', action:'Avoid caffeine & stress. ECG recommended if recurrent.', dept:'Cardiology', meds:[] },
  'Dizziness': { cond:'Vertigo / Hypo-tension', risk:'Medium', action:'Check BP. Hydrate. Consult if persistent.', dept:'Neurology', meds:[] },
};

export default function SymptomCheckerPage() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState([]);
  const [duration, setDuration] = useState('');
  const [severity, setSeverity] = useState('Moderate');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const toggle = (s) => setSelected(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  const analyze = async () => {
    if (!selected.length) { toast.error('Select at least one symptom'); return; }
    setLoading(true);
    setResult(null);
    await new Promise(r => setTimeout(r, 2000));
    let match = null;
    for (const key of Object.keys(AI_ENGINE)) {
      if (selected.includes(key)) { match = AI_ENGINE[key]; break; }
    }
    if (!match) match = { cond: 'General Health Concern', risk: 'Low', action: 'Monitor symptoms. Consult a GP if worsening.', dept: 'General Medicine', meds: ['Paracetamol 500mg'] };
    setResult(match);
    setLoading(false);
  };

  const RISK_COLOR = { Critical: '#dc2626', High: '#d97706', Medium: '#d97706', Low: '#059669' };
  const RISK_BG = { Critical: '#fef2f2', High: '#fffbeb', Medium: '#fffbeb', Low: '#ecfdf5' };

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">🤖 AI Symptom Checker</div><div className="page-subtitle">Select symptoms for an instant AI-powered preliminary assessment</div></div>
      </div>
      <motion.div className="card mb-3" initial={{ opacity:0,y:14 }} animate={{ opacity:1,y:0 }}>
        <div className="card-body">
          <div className="fw-7 mb-2">Select your symptoms:</div>
          <div style={{ marginBottom:12 }}>
            {SYMPTOMS.map(s => (
              <button key={s} className={`symptom-chip${selected.includes(s)?' selected':''}`} onClick={() => toggle(s)}>{s}</button>
            ))}
          </div>
          {selected.length > 0 && (
            <div className="mt-2 mb-2">
              <span className="fw-7 text-primary text-sm">Selected ({selected.length}): </span>
              {selected.map(s => <span key={s} className="badge badge-primary" style={{ margin:2 }}>{s}</span>)}
            </div>
          )}
          <div style={{ display:'flex',gap:10,marginTop:14,flexWrap:'wrap' }}>
            <input className="form-input" style={{ flex:1,minWidth:160 }} placeholder="Duration (e.g. 2 days, 1 week)" value={duration} onChange={e => setDuration(e.target.value)} />
            <select className="form-input" style={{ width:150 }} value={severity} onChange={e => setSeverity(e.target.value)}>
              <option>Mild</option><option>Moderate</option><option>Severe</option>
            </select>
          </div>
          <button className="btn btn-primary btn-full mt-2" style={{ padding:11 }} onClick={analyze} disabled={loading || !selected.length}>
            {loading ? <><span className="spinner-sm" /> Analyzing symptoms…</> : '🤖 Analyze with AI Engine'}
          </button>
        </div>
      </motion.div>

      <AnimatePresence>
        {result && (
          <motion.div className="card" initial={{ opacity:0,y:16 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0,y:-8 }}>
            <div className="card-header" style={{ background:RISK_BG[result.risk] }}>
              <span className="card-title">🤖 AI Assessment Result</span>
              <span className="badge" style={{ background:RISK_BG[result.risk],color:RISK_COLOR[result.risk],border:`1px solid ${RISK_COLOR[result.risk]}` }}>Risk: {result.risk}</span>
            </div>
            <div className="card-body">
              <div className="grid-2 mb-3">
                <div>
                  <div className="text-xs text-muted">Likely Condition</div>
                  <div className="fw-7" style={{ fontSize:17,marginTop:3 }}>{result.cond}</div>
                  <div className="text-xs text-muted mt-2">Recommended Department</div>
                  <span className="badge badge-teal mt-1">{result.dept}</span>
                </div>
                <div>
                  <div className="text-xs text-muted">Recommended Action</div>
                  <div style={{ background:RISK_BG[result.risk],borderRadius:8,padding:11,marginTop:3,fontSize:13,fontWeight:700,color:RISK_COLOR[result.risk] }}>{result.action}</div>
                </div>
              </div>
              {result.meds?.length > 0 && (
                <div className="mb-3">
                  <div className="text-xs text-muted mb-2">💊 Suggested Medicines</div>
                  {result.meds.map(m => <span key={m} className="badge badge-primary" style={{ margin:3,fontSize:12,padding:'5px 12px' }}>{m}</span>)}
                </div>
              )}
              <div style={{ background:'#f8fafc',borderRadius:8,padding:11,fontSize:12,color:'#64748b',border:'1px solid #e2e8f0',marginBottom:14 }}>
                ⚠️ <strong>Disclaimer:</strong> This is an AI-based preliminary assessment only. Always consult a qualified medical professional.
              </div>
              <div className="flex gap-2" style={{ flexWrap:'wrap' }}>
                <button className="btn btn-primary btn-sm" onClick={() => navigate('/appointments')}>📅 Book Appointment</button>
                {result.urgent && <button className="btn btn-danger btn-sm" onClick={async () => { await alertsAPI.create({ type:'SOS',severity:'critical',message:'AI checker detected critical symptoms' }); toast.error('🚨 Emergency team alerted!'); }}>🚨 Emergency SOS</button>}
                <button className="btn btn-outline btn-sm" onClick={() => { setResult(null); setSelected([]); }}>Reset</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}