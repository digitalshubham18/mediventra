import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { facilityAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { getSocket } from '../utils/socket';
import toast from 'react-hot-toast';

const CHANNELS = [
  { id:'general',    name:'General',       icon:'🏥', desc:'Hospital-wide' },
  { id:'doctors',    name:'Doctors',       icon:'⚕️',  desc:'Medical staff' },
  { id:'nurses',     name:'Nurses',        icon:'💉',  desc:'Nursing team' },
  { id:'admin',      name:'Admin',         icon:'🛡️',  desc:'Admin notices' },
  { id:'emergency',  name:'Emergency',     icon:'🚨',  desc:'Critical alerts' },
  { id:'pharmacy',   name:'Pharmacy',      icon:'💊',  desc:'Pharmacy team' },
];

const ROLE_COLOR = { admin:'#6366f1',doctor:'#0891b2',patient:'#7c3aed',nurse:'#db2777',pharmacist:'#d97706',wardboy:'#059669' };
const ROLE_BG    = { admin:'#eef2ff',doctor:'#ecfeff',patient:'#f5f3ff',nurse:'#fdf2f8',pharmacist:'#fffbeb',wardboy:'#f0fdf4' };

export default function ChatPage() {
  const { user } = useAuth();
  const isPatient = user?.role === 'patient';
  const [activeRoom, setActiveRoom] = useState(isPatient ? '' : 'general');
  const [activeDM, setActiveDM] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [users, setUsers] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState(isPatient ? 'dms' : 'channels'); // channels | dms
  const [unread, setUnread] = useState({}); // { roomId: count }
  const endRef = useRef();
  const inputRef = useRef();

  const dmRoomId = (otherId) => ['dm', [user._id, otherId].sort().join('_')].join('_');

  // Patients have no channel access at all — until they've picked (or been
  // auto-assigned) a doctor to talk to, there is no valid room to request,
  // so roomId stays null rather than falling back to a channel they'd be
  // rejected from.
  const roomId = activeDM
    ? dmRoomId(activeDM._id)
    : (isPatient ? null : activeRoom);

  const loadMsgs = useCallback(async () => {
    if (!roomId) { setMsgs([]); return; }
    setLoadingMsgs(true);
    try {
      const res = await facilityAPI.getMessages({ room: roomId, limit: 80 });
      setMsgs(res.data.data || []);
    } catch { toast.error('Failed to load messages'); }
    setLoadingMsgs(false);
  }, [roomId]);

  const loadUsers = useCallback(async () => {
    try {
      const res = await facilityAPI.getChatUsers();
      setUsers(res.data.data || []);
    } catch {}
  }, []);

  useEffect(() => { loadMsgs(); loadUsers(); }, [loadMsgs, loadUsers]);

  const loadUnread = useCallback(() => {
    facilityAPI.getUnreadCounts().then(res => setUnread(res.data.data || {})).catch(() => {});
  }, []);
  useEffect(() => { loadUnread(); }, [loadUnread]);

  // Opening a conversation marks it read immediately — both on the server
  // (so the sidebar badge and a fresh page load reflect it) and locally
  // (so the badge disappears instantly instead of waiting on a refetch).
  useEffect(() => {
    if (!roomId) return;
    facilityAPI.markRoomRead(roomId).catch(() => {});
    setUnread(u => { const next = { ...u }; delete next[roomId]; return next; });
  }, [roomId]);

  // Patients only ever talk to their treating doctor(s) — if there's just
  // one, open that conversation immediately instead of an empty channel list.
  useEffect(() => {
    if (isPatient && !activeDM && users.length === 1) setActiveDM(users[0]);
  }, [isPatient, users, activeDM]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket || !roomId) return;
    socket.emit('join_chat_room', roomId);
    const handler = (msg) => {
      if (msg.room === roomId) { setMsgs(m => [...m, msg]); return; }
      // A message for some other conversation — bump its badge rather than
      // waiting for the next full refetch, as long as it's not our own echo.
      const mine = msg.sender?._id === user._id || msg.sender === user._id;
      if (!mine) setUnread(u => ({ ...u, [msg.room]: (u[msg.room] || 0) + 1 }));
    };
    socket.on('new_message', handler);
    return () => { socket.off('new_message', handler); socket.emit('leave_chat_room', roomId); };
  }, [roomId]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior:'smooth' }); }, [msgs]);
  useEffect(() => { inputRef.current?.focus(); }, [activeRoom, activeDM]);

  const send = async () => {
    if (!input.trim() || sending) return;
    const text = input.trim();
    setInput('');
    setSending(true);
    try {
      await facilityAPI.sendMessage({ message: text, room: roomId, receiver: activeDM?._id });
    } catch { toast.error('Failed to send'); setInput(text); }
    setSending(false);
    inputRef.current?.focus();
  };

  const filteredUsers = users.filter(u => u.name.toLowerCase().includes(search.toLowerCase()) || u.role.toLowerCase().includes(search.toLowerCase()));

  const fmt = (d) => {
    const date = new Date(d);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) return date.toLocaleTimeString('en',{hour:'2-digit',minute:'2-digit'});
    return date.toLocaleDateString('en',{month:'short',day:'numeric'}) + ' ' + date.toLocaleTimeString('en',{hour:'2-digit',minute:'2-digit'});
  };

  const isMine = (msg) => msg.sender?._id === user._id || msg.sender === user._id;

  const initials = (name) => name?.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()||'?';

  const ac = ROLE_COLOR[user?.role] || '#2563eb';

  const currentName = activeDM ? activeDM.name : CHANNELS.find(c=>c.id===activeRoom)?.name || activeRoom;
  const currentDesc = activeDM ? `${activeDM.role} · ${activeDM.isOnline?'Online':'Offline'}` : CHANNELS.find(c=>c.id===activeRoom)?.desc || '';

  return (
    <div style={{ display:'flex', height:'calc(100vh - 80px)', background:'#f8fafc', borderRadius:20, overflow:'hidden', border:'1px solid #e8edf3', fontFamily:"'Outfit',system-ui,sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap'); ::-webkit-scrollbar{width:4px;} ::-webkit-scrollbar-thumb{background:#e2e8f0;border-radius:4px;}`}</style>

      {/* ── Sidebar ── */}
      <div style={{ width:260, background:'#fff', borderRight:'1px solid #f1f5f9', display:'flex', flexDirection:'column', flexShrink:0 }}>

        {/* Header */}
        <div style={{ padding:'18px 16px 12px', borderBottom:'1px solid #f1f5f9' }}>
          <h2 style={{ fontSize:16, fontWeight:800, color:'#0f172a', margin:0 }}>💬 Messages</h2>
          <p style={{ fontSize:11.5, color:'#94a3b8', marginTop:3 }}>Real-time hospital chat</p>
        </div>

        {/* Tabs */}
        {!isPatient && (
          <div style={{ display:'flex', padding:'8px 12px', gap:4 }}>
            {['channels','dms'].map(t => (
              <button key={t} onClick={() => setTab(t)}
                style={{ flex:1, padding:'7px', borderRadius:9, border:'none', background: tab===t?ac:'transparent', color: tab===t?'#fff':'#64748b', fontFamily:'inherit', fontSize:12, fontWeight:700, cursor:'pointer', transition:'all .18s', textTransform:'capitalize' }}>
                {t==='channels'?'📢 Channels':'👤 Direct'}
              </button>
            ))}
          </div>
        )}
        {isPatient && (
          <div style={{ padding:'8px 14px 4px' }}>
            <div style={{ fontSize:11.5, color:'#94a3b8', fontWeight:600 }}>💬 Direct message with your treating doctor{users.length>1?'s':''}</div>
          </div>
        )}

        {/* Search (DM only) */}
        {tab==='dms' && (
          <div style={{ padding:'4px 12px 8px' }}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search users…"
              style={{ width:'100%', padding:'8px 12px', border:'1.5px solid #e2e8f0', borderRadius:10, fontSize:12, fontFamily:'inherit', outline:'none', boxSizing:'border-box' }} />
          </div>
        )}

        {/* Channel/User list */}
        <div style={{ flex:1, overflowY:'auto' }}>
          {tab==='channels' ? (
            <div style={{ padding:'4px 8px' }}>
              {CHANNELS.map(ch => (
                <button key={ch.id} onClick={() => { setActiveRoom(ch.id); setActiveDM(null); }}
                  style={{ width:'100%', display:'flex', alignItems:'center', gap:10, padding:'10px 10px', borderRadius:11, border:'none', background: !activeDM&&activeRoom===ch.id?`${ac}12`:'transparent', cursor:'pointer', fontFamily:'inherit', marginBottom:2, transition:'all .15s' }}
                  onMouseEnter={e => { if(!(!activeDM&&activeRoom===ch.id)) e.currentTarget.style.background='#f8fafc'; }}
                  onMouseLeave={e => { if(!(!activeDM&&activeRoom===ch.id)) e.currentTarget.style.background='transparent'; }}>
                  <div style={{ width:36, height:36, borderRadius:10, background: !activeDM&&activeRoom===ch.id?`${ac}20`:'#f1f5f9', display:'flex', alignItems:'center', justifyContent:'center', fontSize:17, flexShrink:0 }}>{ch.icon}</div>
                  <div style={{ textAlign:'left', flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:700, color: !activeDM&&activeRoom===ch.id?ac:'#374151' }}>{ch.name}</div>
                    <div style={{ fontSize:11, color:'#94a3b8' }}>{ch.desc}</div>
                  </div>
                  {unread[ch.id] > 0 && <span style={{ background:'#dc2626', color:'#fff', fontSize:10, fontWeight:700, padding:'2px 6px', borderRadius:10, flexShrink:0 }}>{unread[ch.id]>9?'9+':unread[ch.id]}</span>}
                </button>
              ))}
            </div>
          ) : (
            <div style={{ padding:'4px 8px' }}>
              {filteredUsers.length === 0 ? (
                <div style={{ padding:20, textAlign:'center', color:'#94a3b8', fontSize:12 }}>{isPatient ? 'You can chat here once you\u2019ve had an appointment with a doctor.' : 'No users found'}</div>
              ) : filteredUsers.map(u => (
                <button key={u._id} onClick={() => { setActiveDM(u); }}
                  style={{ width:'100%', display:'flex', alignItems:'center', gap:10, padding:'9px 10px', borderRadius:11, border:'none', background: activeDM?._id===u._id?`${ac}12`:'transparent', cursor:'pointer', fontFamily:'inherit', marginBottom:2, transition:'all .15s' }}
                  onMouseEnter={e => { if(activeDM?._id!==u._id) e.currentTarget.style.background='#f8fafc'; }}
                  onMouseLeave={e => { if(activeDM?._id!==u._id) e.currentTarget.style.background='transparent'; }}>
                  <div style={{ position:'relative', flexShrink:0 }}>
                    <div style={{ width:36, height:36, borderRadius:'50%', background:`linear-gradient(135deg,${ROLE_COLOR[u.role]||'#64748b'},${ROLE_COLOR[u.role]||'#64748b'}99)`, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:700, fontSize:13 }}>{initials(u.name)}</div>
                    <div style={{ position:'absolute', bottom:0, right:0, width:9, height:9, borderRadius:'50%', background: u.isOnline?'#22c55e':'#94a3b8', border:'2px solid #fff' }} />
                  </div>
                  <div style={{ textAlign:'left', minWidth:0, flex:1 }}>
                    <div style={{ fontSize:12.5, fontWeight:700, color: activeDM?._id===u._id?ac:'#374151', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{u.name}</div>
                    <div style={{ fontSize:11, color: ROLE_COLOR[u.role]||'#94a3b8', fontWeight:600, textTransform:'capitalize' }}>{u.role}</div>
                  </div>
                  {unread[dmRoomId(u._id)] > 0 && <span style={{ background:'#dc2626', color:'#fff', fontSize:10, fontWeight:700, padding:'2px 6px', borderRadius:10, flexShrink:0 }}>{unread[dmRoomId(u._id)]>9?'9+':unread[dmRoomId(u._id)]}</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Current user */}
        <div style={{ padding:'12px 14px', borderTop:'1px solid #f1f5f9', display:'flex', alignItems:'center', gap:9 }}>
          <div style={{ width:34, height:34, borderRadius:'50%', background:`linear-gradient(135deg,${ac},${ac}99)`, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:700, fontSize:13, flexShrink:0 }}>{initials(user?.name)}</div>
          <div style={{ minWidth:0 }}>
            <div style={{ fontSize:12.5, fontWeight:700, color:'#0f172a', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user?.name}</div>
            <div style={{ fontSize:11, color:ac, fontWeight:600, textTransform:'capitalize' }}>{user?.role}</div>
          </div>
          <div style={{ width:8, height:8, borderRadius:'50%', background:'#22c55e', flexShrink:0, marginLeft:'auto' }} />
        </div>
      </div>

      {/* ── Chat area ── */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0 }}>

        {!roomId ? (
          <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:10, color:'#94a3b8', padding:24, textAlign:'center' }}>
            <div style={{ fontSize:48 }}>🩺</div>
            <div style={{ fontWeight:700, fontSize:15, color:'#374151' }}>
              {users.length === 0 ? "You don't have a treating doctor yet" : 'Select a doctor to start chatting'}
            </div>
            <div style={{ fontSize:13, maxWidth:320 }}>
              {users.length === 0
                ? 'Once you\u2019ve had an appointment with a doctor, you\u2019ll be able to message them here.'
                : 'Choose a doctor from the list on the left to open your conversation.'}
            </div>
          </div>
        ) : (
        <>
        {/* Chat header */}
        <div style={{ padding:'14px 20px', background:'#fff', borderBottom:'1px solid #f1f5f9', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            {activeDM ? (
              <>
                <div style={{ position:'relative' }}>
                  <div style={{ width:40, height:40, borderRadius:'50%', background:`linear-gradient(135deg,${ROLE_COLOR[activeDM.role]||'#64748b'},${ROLE_COLOR[activeDM.role]||'#64748b'}99)`, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:700, fontSize:15 }}>{initials(activeDM.name)}</div>
                  <div style={{ position:'absolute', bottom:0, right:0, width:10, height:10, borderRadius:'50%', background: activeDM.isOnline?'#22c55e':'#94a3b8', border:'2px solid #fff' }} />
                </div>
                <div>
                  <div style={{ fontWeight:800, color:'#0f172a', fontSize:15 }}>{activeDM.name}</div>
                  <div style={{ fontSize:12, color: activeDM.isOnline?'#22c55e':'#94a3b8' }}>{activeDM.isOnline?'● Online':'○ Offline'}</div>
                </div>
              </>
            ) : (
              <>
                <div style={{ width:40, height:40, borderRadius:12, background:`${ac}15`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>{CHANNELS.find(c=>c.id===activeRoom)?.icon||'💬'}</div>
                <div>
                  <div style={{ fontWeight:800, color:'#0f172a', fontSize:15 }}>#{currentName}</div>
                  <div style={{ fontSize:12, color:'#94a3b8' }}>{currentDesc}</div>
                </div>
              </>
            )}
          </div>
          <div style={{ display:'flex', gap:6 }}>
            <div style={{ padding:'5px 12px', background:'#f8fafc', borderRadius:20, fontSize:11.5, color:'#64748b', fontWeight:600 }}>
              🔒 End-to-end encrypted
            </div>
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex:1, overflowY:'auto', padding:'16px 20px', display:'flex', flexDirection:'column', gap:4 }}>
          {loadingMsgs ? (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', flex:1 }}>
              <div style={{ width:28, height:28, border:`3px solid ${ac}30`, borderTopColor:ac, borderRadius:'50%', animation:'spin .7s linear infinite' }} />
            </div>
          ) : msgs.length === 0 ? (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', flex:1, gap:12, color:'#94a3b8' }}>
              <div style={{ fontSize:48 }}>💬</div>
              <div style={{ fontWeight:700, fontSize:15, color:'#374151' }}>No messages yet</div>
              <div style={{ fontSize:13 }}>Be the first to say something!</div>
            </div>
          ) : (
            msgs.map((msg, i) => {
              const mine = isMine(msg);
              const sender = msg.sender;
              const senderName = sender?.name || msg.senderName || 'Unknown';
              const senderRole = sender?.role || msg.senderRole || '';
              const showAvatar = !mine && (i === 0 || msgs[i-1]?.sender?._id !== msg.sender?._id);
              return (
                <div key={msg._id||i} style={{ display:'flex', gap:8, alignItems:'flex-end', flexDirection: mine?'row-reverse':'row', marginTop: showAvatar&&!mine?8:2 }}>
                  {!mine && (
                    <div style={{ width:32, height:32, borderRadius:'50%', background:`linear-gradient(135deg,${ROLE_COLOR[senderRole]||'#64748b'},${ROLE_COLOR[senderRole]||'#64748b'}99)`, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:700, fontSize:12, flexShrink:0, opacity: showAvatar?1:0 }}>
                      {initials(senderName)}
                    </div>
                  )}
                  <div style={{ maxWidth:'65%' }}>
                    {showAvatar && !mine && (
                      <div style={{ fontSize:11, color: ROLE_COLOR[senderRole]||'#94a3b8', fontWeight:700, marginBottom:3, display:'flex', alignItems:'center', gap:5 }}>
                        {senderName}
                        <span style={{ padding:'1px 6px', borderRadius:8, background: ROLE_BG[senderRole]||'#f1f5f9', color: ROLE_COLOR[senderRole]||'#64748b', fontSize:10 }}>{senderRole}</span>
                      </div>
                    )}
                    <div style={{ padding:'9px 13px', borderRadius: mine?'16px 4px 16px 16px':'4px 16px 16px 16px',
                      background: mine?`linear-gradient(135deg,${ac},${ac}dd)`:'#fff',
                      color: mine?'#fff':'#0f172a', fontSize:13.5, lineHeight:1.5,
                      boxShadow: mine?`0 4px 12px ${ac}30`:'0 2px 8px rgba(0,0,0,.06)',
                      border: mine?'none':'1px solid #f1f5f9' }}>
                      {msg.message}
                    </div>
                    <div style={{ fontSize:10, color:'#94a3b8', marginTop:3, textAlign: mine?'right':'left' }}>{fmt(msg.createdAt)}</div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={endRef} />
        </div>

        {/* Input bar */}
        <div style={{ padding:'12px 16px 16px', background:'#fff', borderTop:'1px solid #f1f5f9' }}>
          <div style={{ display:'flex', gap:10, alignItems:'flex-end', background:'#f8fafc', border:`1.5px solid #e2e8f0`, borderRadius:16, padding:'8px 8px 8px 14px', transition:'border-color .2s' }}
            onFocus={() => {}} >
            <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();} }}
              placeholder={`Message ${activeDM?activeDM.name:'#'+currentName}…`}
              rows={1} style={{ flex:1, background:'none', border:'none', outline:'none', fontFamily:'inherit', fontSize:14, color:'#0f172a', resize:'none', maxHeight:100, lineHeight:1.5 }} />
            <button onClick={send} disabled={!input.trim()||sending}
              style={{ width:38, height:38, borderRadius:12, border:'none', background: input.trim()?`linear-gradient(135deg,${ac},#0ea5e9)`:'#e2e8f0', color: input.trim()?'#fff':'#94a3b8', cursor: input.trim()?'pointer':'not-allowed', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'all .2s' }}>
              {sending ? <div style={{ width:14, height:14, border:'2px solid rgba(255,255,255,.3)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin .7s linear infinite' }} /> : '↑'}
            </button>
          </div>
          <div style={{ fontSize:11, color:'#94a3b8', marginTop:6, textAlign:'center' }}>Press Enter to send · Shift+Enter for new line</div>
        </div>
        </>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
