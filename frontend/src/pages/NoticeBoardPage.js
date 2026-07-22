import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { announcementsAPI } from '../utils/api';
import { getSocket } from '../utils/socket';
import toast from 'react-hot-toast';

const TYPES = ['general','emergency','maintenance','holiday','event'];
const PRIORITIES = { urgent:'🔴', high:'🟠', medium:'🟡', low:'🟢' };
const TYPE_LABEL = { general:'General', emergency:'Emergency', maintenance:'Maintenance', holiday:'Holiday', event:'Event', pinned:'Pinned' };

export default function NoticeBoardPage() {
  const { user } = useAuth();
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [selected, setSelected] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pinning, setPinning] = useState(null);
  const [form, setForm] = useState({ title:'', type:'general', priority:'medium', content:'' });

  const isAdmin = user?.role === 'admin';

  const load = useCallback(() => {
    announcementsAPI.getAll()
      .then(res => { setNotices(res.data.data || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const socket = getSocket();
    if (socket) {
      const handler = () => load();
      socket.on('new_announcement', handler);
      socket.on('announcement_pinned', handler);
      return () => { socket.off('new_announcement', handler); socket.off('announcement_pinned', handler); };
    }
  }, [load]);

  const filtered = filter === 'All' ? notices : notices.filter(n => n.type === filter);
  const pinned   = filtered.filter(n => n.pinned);
  const regular  = filtered.filter(n => !n.pinned);

  const handleCreate = async () => {
    if (!form.title.trim() || !form.content.trim()) { toast.error('Title and content required'); return; }
    setSaving(true);
    try {
      await announcementsAPI.create(form);
      setShowCreate(false);
      setForm({ title:'', type:'general', priority:'medium', content:'' });
      toast.success('Notice posted!');
      load();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed to post'); }
    setSaving(false);
  };

  const togglePin = async (notice) => {
    setPinning(notice._id);
    try {
      if (notice.pinned) {
        await announcementsAPI.unpin(notice._id);
        toast.success('📌 Unpinned');
      } else {
        await announcementsAPI.pin(notice._id);
        toast.success('📌 Pinned to top!');
      }
      load();
      if (selected?._id === notice._id) setSelected(s => ({ ...s, pinned: !s.pinned }));
    } catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
    setPinning(null);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this notice?')) return;
    try { await announcementsAPI.delete(id); toast.success('Deleted'); setSelected(null); load(); }
    catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
  };

  const NoticeCard = ({ n }) => (
    <motion.div onClick={()=>setSelected(n)} whileHover={{ y:-2 }}
      style={{ background:'#fff', border:`1.5px solid ${n.pinned?'#fde68a':'#e8edf3'}`, borderRadius:14, padding:'16px', cursor:'pointer', transition:'all .2s', position:'relative' }}
      onMouseEnter={e=>e.currentTarget.style.boxShadow='0 8px 24px rgba(0,0,0,.09)'}
      onMouseLeave={e=>e.currentTarget.style.boxShadow='none'}>
      {n.pinned && <div style={{ position:'absolute',top:12,right:12,fontSize:14 }}>📌</div>}
      <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:8 }}>
        <span>{PRIORITIES[n.priority]}</span>
        <span style={{ padding:'2px 9px',borderRadius:20,fontSize:11,fontWeight:700,background:'#f1f5f9',color:'#374151',textTransform:'capitalize' }}>{TYPE_LABEL[n.type] || n.type}</span>
        <span style={{ marginLeft:'auto',fontSize:11,color:'#94a3b8' }}>{new Date(n.createdAt).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</span>
      </div>
      <h3 style={{ fontSize:14,fontWeight:800,color:'#0f172a',margin:'0 0 6px',lineHeight:1.3 }}>{n.title}</h3>
      <p style={{ fontSize:12.5,color:'#64748b',margin:0,display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden' }}>{n.content}</p>
      <div style={{ fontSize:11.5,color:'#94a3b8',marginTop:8 }}>— {n.createdBy?.name || 'Admin'}</div>
    </motion.div>
  );

  return (
    <div style={{ fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif" }}>
      <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20,flexWrap:'wrap',gap:10 }}>
        <div><h1 style={{ fontSize:22,fontWeight:800,color:'#0f172a',margin:0 }}>📢 Notice Board</h1><p style={{ color:'#94a3b8',fontSize:13,marginTop:3 }}>{notices.length} notices · {pinned.length} pinned</p></div>
        {isAdmin && <button onClick={()=>setShowCreate(true)} style={{ padding:'9px 18px',borderRadius:12,border:'none',background:'#2563eb',color:'#fff',fontFamily:'inherit',fontWeight:700,fontSize:13,cursor:'pointer' }}>+ Post Notice</button>}
      </div>

      <div style={{ display:'flex',gap:6,flexWrap:'wrap',marginBottom:20 }}>
        {['All', ...TYPES].map(c => (
          <button key={c} onClick={()=>setFilter(c)}
            style={{ padding:'5px 14px',borderRadius:20,border:`1.5px solid ${filter===c?'#2563eb':'#e2e8f0'}`,background:filter===c?'#2563eb':'#fff',color:filter===c?'#fff':'#64748b',fontFamily:'inherit',fontSize:12,fontWeight:600,cursor:'pointer',transition:'all .15s',textTransform:'capitalize' }}>
            {c === 'All' ? 'All' : TYPE_LABEL[c]}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:48, color:'#94a3b8' }}>Loading notices…</div>
      ) : notices.length === 0 ? (
        <div style={{ textAlign:'center', padding:48, color:'#94a3b8' }}>
          <div style={{ fontSize:40, marginBottom:10 }}>📢</div>
          <div style={{ fontWeight:700 }}>No notices yet</div>
          {isAdmin && <div style={{ fontSize:13, marginTop:6 }}>Click "+ Post Notice" to create the first one</div>}
        </div>
      ) : (
        <>
          {pinned.length > 0 && (
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:11,color:'#94a3b8',fontWeight:700,letterSpacing:1,textTransform:'uppercase',marginBottom:10 }}>📌 Pinned Notices</div>
              <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:12 }}>
                {pinned.map(n => <NoticeCard key={n._id} n={n} />)}
              </div>
            </div>
          )}
          <div style={{ fontSize:11,color:'#94a3b8',fontWeight:700,letterSpacing:1,textTransform:'uppercase',marginBottom:10 }}>All Notices</div>
          <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:12 }}>
            {regular.map(n => <NoticeCard key={n._id} n={n} />)}
            {regular.length === 0 && <div style={{ color:'#94a3b8', fontSize:13, padding:'12px 0' }}>No other notices in this category.</div>}
          </div>
        </>
      )}

      {/* Detail modal */}
      <AnimatePresence>
        {selected && (
          <div onClick={e=>{if(e.target===e.currentTarget)setSelected(null)}} style={{ position:'fixed',inset:0,background:'rgba(0,0,0,.5)',backdropFilter:'blur(4px)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16 }}>
            <motion.div initial={{ opacity:0,y:20,scale:.96 }} animate={{ opacity:1,y:0,scale:1 }} exit={{ opacity:0,y:20,scale:.96 }}
              style={{ background:'#fff',borderRadius:20,width:'100%',maxWidth:560,boxShadow:'0 32px 80px rgba(0,0,0,.2)',overflow:'hidden' }}>
              <div style={{ background:'linear-gradient(135deg,#1e3a8a,#2563eb)',padding:'18px 22px' }}>
                <div style={{ display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12 }}>
                  <div>
                    <div style={{ display:'flex',gap:8,marginBottom:8 }}>
                      <span>{PRIORITIES[selected.priority]}</span>
                      <span style={{ padding:'2px 9px',borderRadius:20,fontSize:11,fontWeight:700,background:'rgba(255,255,255,.2)',color:'#fff',textTransform:'capitalize' }}>{TYPE_LABEL[selected.type] || selected.type}</span>
                      {selected.pinned && <span style={{ fontSize:13 }}>📌</span>}
                    </div>
                    <h2 style={{ color:'#fff',fontWeight:800,fontSize:17,margin:0 }}>{selected.title}</h2>
                  </div>
                  <button onClick={()=>setSelected(null)} style={{ background:'rgba(255,255,255,.2)',border:'none',borderRadius:'50%',width:28,height:28,cursor:'pointer',color:'#fff',fontSize:14,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>✕</button>
                </div>
              </div>
              <div style={{ padding:'20px 22px' }}>
                <div style={{ fontSize:11.5,color:'#94a3b8',marginBottom:14,display:'flex',gap:16,flexWrap:'wrap' }}>
                  <span>👤 {selected.createdBy?.name || 'Admin'}</span>
                  <span>📅 {new Date(selected.createdAt).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})}</span>
                  {selected.pinned && selected.pinnedBy && <span>📌 Pinned by {selected.pinnedBy?.name}</span>}
                </div>
                <p style={{ fontSize:14,color:'#374151',lineHeight:1.7,margin:0 }}>{selected.content}</p>

                {isAdmin && (
                  <div style={{ display:'flex',gap:10,marginTop:20,paddingTop:16,borderTop:'1px solid #f1f5f9' }}>
                    <button onClick={()=>togglePin(selected)} disabled={pinning===selected._id}
                      style={{ flex:1,padding:'10px',borderRadius:11,border:`1.5px solid ${selected.pinned?'#f59e0b':'#2563eb'}`,background:selected.pinned?'#fffbeb':'#eff6ff',color:selected.pinned?'#92400e':'#2563eb',fontFamily:'inherit',fontWeight:700,fontSize:13,cursor:'pointer' }}>
                      {pinning===selected._id ? '…' : selected.pinned ? '📌 Unpin Notice' : '📌 Pin to Top'}
                    </button>
                    <button onClick={()=>handleDelete(selected._id)}
                      style={{ padding:'10px 16px',borderRadius:11,border:'1.5px solid #fecaca',background:'#fef2f2',color:'#dc2626',fontFamily:'inherit',fontWeight:700,fontSize:13,cursor:'pointer' }}>
                      🗑️ Delete
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Create modal */}
      <AnimatePresence>
        {showCreate && (
          <div onClick={e=>{if(e.target===e.currentTarget)setShowCreate(false)}} style={{ position:'fixed',inset:0,background:'rgba(0,0,0,.5)',backdropFilter:'blur(4px)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16 }}>
            <motion.div initial={{ opacity:0,y:20,scale:.96 }} animate={{ opacity:1,y:0,scale:1 }} exit={{ opacity:0,y:20,scale:.96 }}
              style={{ background:'#fff',borderRadius:20,width:'100%',maxWidth:500,boxShadow:'0 32px 80px rgba(0,0,0,.2)',padding:'24px' }}>
              <h3 style={{ fontSize:17,fontWeight:800,margin:'0 0 20px' }}>📢 Post New Notice</h3>
              <div style={{ marginBottom:12 }}>
                <label style={{ display:'block',fontSize:11,fontWeight:700,color:'#374151',marginBottom:5,textTransform:'uppercase',letterSpacing:.4 }}>Title *</label>
                <input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} style={{ width:'100%',padding:'10px 12px',border:'1.5px solid #e2e8f0',borderRadius:10,fontFamily:'inherit',fontSize:13.5,outline:'none',boxSizing:'border-box' }} />
              </div>
              <div className="form-row" style={{ display:'flex', gap:12, marginBottom:12 }}>
                <div style={{ flex:1 }}>
                  <label style={{ display:'block',fontSize:11,fontWeight:700,color:'#374151',marginBottom:5,textTransform:'uppercase',letterSpacing:.4 }}>Type</label>
                  <select value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))} style={{ width:'100%',padding:'10px 12px',border:'1.5px solid #e2e8f0',borderRadius:10,fontFamily:'inherit',fontSize:13.5,outline:'none',background:'#fff',boxSizing:'border-box' }}>
                    {TYPES.map(o=><option key={o} value={o}>{TYPE_LABEL[o]}</option>)}
                  </select>
                </div>
                <div style={{ flex:1 }}>
                  <label style={{ display:'block',fontSize:11,fontWeight:700,color:'#374151',marginBottom:5,textTransform:'uppercase',letterSpacing:.4 }}>Priority</label>
                  <select value={form.priority} onChange={e=>setForm(f=>({...f,priority:e.target.value}))} style={{ width:'100%',padding:'10px 12px',border:'1.5px solid #e2e8f0',borderRadius:10,fontFamily:'inherit',fontSize:13.5,outline:'none',background:'#fff',boxSizing:'border-box' }}>
                    {['urgent','high','medium','low'].map(o=><option key={o} value={o}>{PRIORITIES[o]} {o}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ marginBottom:18 }}>
                <label style={{ display:'block',fontSize:11,fontWeight:700,color:'#374151',marginBottom:5,textTransform:'uppercase',letterSpacing:.4 }}>Content *</label>
                <textarea value={form.content} onChange={e=>setForm(f=>({...f,content:e.target.value}))} rows={4} style={{ width:'100%',padding:'10px 12px',border:'1.5px solid #e2e8f0',borderRadius:10,fontFamily:'inherit',fontSize:13.5,outline:'none',resize:'none',boxSizing:'border-box' }} />
              </div>
              <div style={{ display:'flex',gap:10 }}>
                <button onClick={()=>setShowCreate(false)} style={{ flex:1,padding:'11px',borderRadius:12,border:'1.5px solid #e2e8f0',background:'#fff',fontFamily:'inherit',fontWeight:700,cursor:'pointer' }}>Cancel</button>
                <button onClick={handleCreate} disabled={saving} style={{ flex:2,padding:'11px',borderRadius:12,border:'none',background:'#2563eb',color:'#fff',fontFamily:'inherit',fontWeight:700,cursor:'pointer' }}>{saving?'Posting…':'📢 Post Notice'}</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
