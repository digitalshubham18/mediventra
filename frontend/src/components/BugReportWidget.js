import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { bugReportsAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

// Small floating "report a bug" icon that opens a dark, centered dialog
// (matching the reference design) for describing an issue, optionally
// with a screenshot attached. Colors are pulled from the app's own
// palette (--sidebar navy, --primary blue, --red) rather than an
// arbitrary theme, so it reads as part of Mediventra rather than a
// bolted-on widget. Submitting saves the report and emails the
// configured recipient (see backend/.env → BUG_REPORT_EMAIL).
const NAVY       = '#0c1f4a'; // matches --sidebar
const NAVY_LIGHT = '#15295c'; // one step lighter, for inputs/borders
const NAVY_BORDER= '#26386e';
const MUTED      = '#94a3c8'; // matches --sidebar-text
const PRIMARY    = '#1648c9'; // matches --primary
const PRIMARY_2  = '#0f3aa8'; // matches --primary-2
const RED        = '#dc2626'; // matches --red

export default function BugReportWidget() {
  const [open, setOpen]               = useState(false);
  const [description, setDescription] = useState('');
  const [image, setImage]             = useState(null);       // File
  const [imagePreview, setImagePreview] = useState('');
  const [submitting, setSubmitting]   = useState(false);
  const { user } = useAuth();
  const location = useLocation();
  const fileInputRef = useRef(null);

  const resetAndClose = () => {
    setDescription('');
    setImage(null);
    setImagePreview('');
    setOpen(false);
  };

  const onPickImage = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Only image files are allowed'); return; }
    setImage(file);
    const reader = new FileReader();
    reader.onload = ev => setImagePreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!description.trim()) { toast.error('Please describe the bug first'); return; }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('description', description.trim());
      fd.append('page', location.pathname);
      if (image) fd.append('image', image);
      await bugReportsAPI.create(fd);
      toast.success('🐞 Bug report sent — thank you!');
      resetAndClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send report — please try again');
    }
    setSubmitting(false);
  };

  return (
    <>
      <motion.button
        whileHover={{ scale:1.08 }} whileTap={{ scale:.95 }}
        onClick={()=>setOpen(true)}
        title="Report a bug"
        style={{
          position:'fixed', bottom:100, right:28, zIndex:99998,
          width:48, height:48, borderRadius:'50%', border:'none', cursor:'pointer',
          background:`linear-gradient(135deg,${RED},#f87171)`, color:'#fff', fontSize:20,
          display:'flex', alignItems:'center', justifyContent:'center',
          boxShadow:'0 8px 24px rgba(220,38,38,.35)',
          fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Roboto,sans-serif",
        }}>
        🐞
      </motion.button>

      <AnimatePresence>
        {open && (
          <div
            onClick={e=>{ if (e.target===e.currentTarget) resetAndClose(); }}
            style={{ position:'fixed', inset:0, background:'rgba(6,12,30,.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:99999, padding:16 }}>
            <motion.div
              initial={{ opacity:0, y:20, scale:.96 }} animate={{ opacity:1, y:0, scale:1 }} exit={{ opacity:0, y:20, scale:.96 }}
              style={{
                width:'100%', maxWidth:460, background:NAVY, borderRadius:18,
                border:`1px solid ${NAVY_BORDER}`, boxShadow:'0 30px 80px rgba(0,0,0,.5)',
                fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Roboto,sans-serif", overflow:'hidden',
              }}>
              {/* Header */}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'20px 24px 16px', borderBottom:`1px solid ${NAVY_BORDER}` }}>
                <span style={{ color:'#fff', fontSize:19, fontWeight:800, display:'flex', alignItems:'center', gap:8 }}>🐞 Report Bug</span>
                <button onClick={resetAndClose} style={{ background:'none', border:'none', color:MUTED, fontSize:20, cursor:'pointer', lineHeight:1 }}>✕</button>
              </div>

              <form onSubmit={submit}>
                <div style={{ padding:'20px 24px' }}>
                  {/* Reporter info */}
                  <div style={{ display:'flex', justifyContent:'space-between', gap:16, marginBottom:18 }}>
                    <div>
                      <div style={{ color:'#fff', fontWeight:700, fontSize:13.5, marginBottom:3 }}>Name:</div>
                      <div style={{ color:MUTED, fontSize:13 }}>{user?.name || 'Unknown'}</div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ color:'#fff', fontWeight:700, fontSize:13.5, marginBottom:3 }}>Role:</div>
                      <div style={{ color:MUTED, fontSize:13, textTransform:'capitalize' }}>{user?.role?.replace('_',' ') || '—'}</div>
                    </div>
                  </div>

                  <div style={{ marginBottom:18 }}>
                    <div style={{ color:'#fff', fontWeight:700, fontSize:13.5, marginBottom:3 }}>Email:</div>
                    <div style={{ color:MUTED, fontSize:13 }}>{user?.email || '—'}</div>
                  </div>

                  {/* Description */}
                  <div style={{ marginBottom:18 }}>
                    <div style={{ color:'#fff', fontWeight:700, fontSize:13.5, marginBottom:8 }}>Bug Description:</div>
                    <textarea
                      autoFocus
                      value={description}
                      onChange={e=>setDescription(e.target.value)}
                      rows={5}
                      placeholder="Describe the bug in detail..."
                      style={{
                        width:'100%', padding:'12px 14px', borderRadius:10, resize:'vertical',
                        background:NAVY_LIGHT, border:`1px solid ${NAVY_BORDER}`, color:'#e7ebf7',
                        fontFamily:'inherit', fontSize:13.5, outline:'none', boxSizing:'border-box', minHeight:110,
                      }}
                    />
                  </div>

                  {/* Attachment */}
                  <div>
                    <div style={{ color:'#fff', fontWeight:700, fontSize:13.5, marginBottom:8 }}>Attachment (Image Only):</div>
                    <input ref={fileInputRef} type="file" accept="image/*" style={{ display:'none' }} onChange={e=>onPickImage(e.target.files?.[0]||null)} />
                    {!imagePreview ? (
                      <button type="button" onClick={()=>fileInputRef.current?.click()}
                        style={{
                          padding:'10px 18px', borderRadius:9, border:`1.5px dashed ${MUTED}`, background:'transparent',
                          color:MUTED, fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'inherit',
                        }}>
                        📎 Add Image
                      </button>
                    ) : (
                      <div style={{ position:'relative', display:'inline-block' }}>
                        <img src={imagePreview} alt="Attachment preview" style={{ maxWidth:160, maxHeight:110, borderRadius:9, border:`1px solid ${NAVY_BORDER}`, display:'block' }} />
                        <button type="button" onClick={()=>{ setImage(null); setImagePreview(''); }}
                          style={{ position:'absolute', top:-8, right:-8, width:22, height:22, borderRadius:'50%', border:'none', background:RED, color:'#fff', fontSize:12, cursor:'pointer', lineHeight:1 }}>✕</button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div style={{ display:'flex', justifyContent:'flex-end', gap:10, padding:'16px 24px', borderTop:`1px solid ${NAVY_BORDER}` }}>
                  <button type="button" onClick={resetAndClose}
                    style={{ padding:'10px 22px', borderRadius:22, border:`1px solid ${NAVY_BORDER}`, background:NAVY_LIGHT, color:'#e7ebf7', fontWeight:700, fontSize:13.5, cursor:'pointer', fontFamily:'inherit' }}>
                    Close
                  </button>
                  <button type="submit" disabled={submitting || !description.trim()}
                    style={{
                      padding:'10px 26px', borderRadius:22, border:'none',
                      background: description.trim() ? `linear-gradient(135deg,${PRIMARY},${PRIMARY_2})` : '#3a4468',
                      color:'#fff', fontWeight:700, fontSize:13.5,
                      cursor: description.trim() ? 'pointer' : 'not-allowed', fontFamily:'inherit',
                      opacity: submitting ? 0.7 : 1,
                    }}>
                    {submitting ? 'Sending…' : 'Submit'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
