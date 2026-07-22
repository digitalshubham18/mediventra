import React, { useState, useRef, useEffect } from 'react';
import toast from 'react-hot-toast';
import { usersAPI, recordsAPI } from '../utils/api';

export default function AIScribePage() {
  const [scribeText, setScribeText] = useState('');
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const recognitionRef = useRef(null);

  const [patients, setPatients] = useState([]);
  const [patientId, setPatientId] = useState('');
  const [noteTitle, setNoteTitle] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    usersAPI.getAll({ role: 'patient', status: 'approved', limit: 300 }).then(res => {
      setPatients(res.data.data || []);
    }).catch(() => toast.error('Failed to load patient list'));
  }, []);

  const start = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { setSupported(false); toast.error('Voice dictation needs Chrome or Edge — not supported in this browser'); return; }
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-IN';
    recognition.onresult = (event) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript + ' ';
      }
      if (finalTranscript) setScribeText(prev => (prev ? prev + ' ' : '') + finalTranscript.trim());
    };
    recognition.onerror = () => { setListening(false); toast.error('Dictation stopped — mic permission needed'); };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  };

  const stop = () => { recognitionRef.current?.stop(); setListening(false); };
  const copyToClipboard = () => { navigator.clipboard.writeText(scribeText); toast.success('Copied — paste into the patient record'); };

  const selectedPatient = patients.find(p => p._id === patientId);

  const saveAsNote = async () => {
    if (!patientId) { toast.error('Select a patient before saving'); return; }
    if (!scribeText.trim()) { toast.error('Nothing to save yet — dictate or type a note first'); return; }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('patient', patientId);
      fd.append('type', 'clinical_note');
      fd.append('title', noteTitle.trim() || `Consultation Note — ${new Date().toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}`);
      fd.append('notes', scribeText.trim());
      fd.append('description', scribeText.trim());
      await recordsAPI.create(fd);
      toast.success(`✅ Note saved to ${selectedPatient?.name}'s record!`);
      setScribeText('');
      setNoteTitle('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save note');
    }
    setSaving(false);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">🎙️ AI Scribe</div>
          <div className="page-subtitle">Voice-to-text dictation that fills in your clinical notes as you talk — real browser speech recognition, no external service</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header"><span className="card-title">👤 Patient</span></div>
        <div className="card-body">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Select Patient *</label>
              <select className="form-input" value={patientId} onChange={e=>setPatientId(e.target.value)}>
                <option value="">— Select a patient —</option>
                {patients.map(p => <option key={p._id} value={p._id}>{p.name} {p.phone ? `(${p.phone})` : ''}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Note Title (optional)</label>
              <input className="form-input" value={noteTitle} onChange={e=>setNoteTitle(e.target.value)} placeholder="e.g. Follow-up consultation" />
            </div>
          </div>
          {selectedPatient && (
            <div style={{ fontSize:12.5, color:'#64748b', marginTop:4 }}>
              Dictated notes will be saved directly to <strong>{selectedPatient.name}</strong>'s medical record.
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Dictation</span>
          <div style={{ display:'flex', gap:8 }}>
            {scribeText && <button className="btn btn-outline btn-sm" onClick={copyToClipboard}>📋 Copy</button>}
            {scribeText && <button className="btn btn-outline btn-sm" onClick={()=>setScribeText('')}>Clear</button>}
          </div>
        </div>
        <div className="card-body">
          {!supported && <div style={{ fontSize:12.5, color:'#dc2626', marginBottom:14, background:'#fef2f2', padding:'10px 14px', borderRadius:9 }}>Voice dictation isn't supported in this browser — try Chrome or Edge.</div>}
          <textarea className="form-input" rows={12} value={scribeText} onChange={e=>setScribeText(e.target.value)}
            placeholder="Select a patient above, click 'Start Dictation' below, and speak naturally during the consultation — your words appear here as text, ready to save straight to the patient's record."
            style={{ fontSize:14, lineHeight:1.7 }} />
          <div style={{ marginTop:16, display:'flex', gap:10, flexWrap:'wrap' }}>
            {!listening ? (
              <button className="btn btn-primary" onClick={start} style={{ fontSize:14, padding:'12px 24px' }}>🎙️ Start Dictation</button>
            ) : (
              <button className="btn btn-danger" onClick={stop} style={{ fontSize:14, padding:'12px 24px' }}>
                <span style={{display:'inline-block',width:8,height:8,borderRadius:'50%',background:'#fff',marginRight:8,animation:'pulse 1s infinite'}}/>
                ⏹ Stop Listening…
              </button>
            )}
            <button className="btn btn-success" onClick={saveAsNote} disabled={saving || !scribeText.trim()} style={{ fontSize:14, padding:'12px 24px' }}>
              {saving ? 'Saving…' : '💾 Save to Patient Record'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
