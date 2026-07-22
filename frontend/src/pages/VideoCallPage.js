import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { appointmentsAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { getSocket } from '../utils/socket';
import toast from 'react-hot-toast';

// Public STUN server — only used to discover each participant's public
// network address so the two browsers can find each other directly.
// No media or call content ever passes through this or any server of
// ours; once connected, video/audio flows peer-to-peer.
const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }];

export default function VideoCallPage() {
  const { appointmentId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [status, setStatus] = useState('connecting'); // connecting | waiting | in-call | ended | error
  const [errorMsg, setErrorMsg] = useState('');
  const [peerInfo, setPeerInfo] = useState(null); // { patientName, doctorName }
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [captionsOn, setCaptionsOn] = useState(false);
  const [captionsSupported] = useState(() => !!(window.SpeechRecognition || window.webkitSpeechRecognition));
  const [captions, setCaptions] = useState([]); // [{ id, speaker, text }] — most recent last

  const recognitionRef = useRef(null);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const roomIdRef = useRef(null);
  const isInitiatorRef = useRef(false); // the one already in the room when the other joins makes the offer
  const timerRef = useRef(null);

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    pcRef.current?.close();
    recognitionRef.current?.stop();
    const socket = getSocket();
    if (socket && roomIdRef.current) socket.emit('video_leave', { roomId: roomIdRef.current, name: user?.name });
  }, [user]);

  const endCall = useCallback(() => {
    cleanup();
    appointmentsAPI.endVideoCall(appointmentId).catch(()=>{});
    setStatus('ended');
    setTimeout(() => navigate('/appointments'), 1500);
  }, [cleanup, appointmentId, navigate]);

  useEffect(() => {
    let cancelled = false;
    const socket = getSocket();

    async function start() {
      try {
        const res = await appointmentsAPI.getVideoRoom(appointmentId);
        if (cancelled) return;
        const { roomId, patientName, doctorName } = res.data.data;
        roomIdRef.current = roomId;
        setPeerInfo({ patientName, doctorName });

        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (cancelled) { stream.getTracks().forEach(t=>t.stop()); return; }
        localStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;

        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        pcRef.current = pc;
        stream.getTracks().forEach(track => pc.addTrack(track, stream));

        pc.ontrack = (e) => {
          if (remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0];
          setStatus('in-call');
        };
        pc.onicecandidate = (e) => {
          if (e.candidate && socket) socket.emit('video_signal', { roomId, signal: { type: 'ice', candidate: e.candidate } });
        };
        pc.onconnectionstatechange = () => {
          if (['disconnected','failed','closed'].includes(pc.connectionState) && status !== 'ended') {
            // Peer dropped — don't hard-end, just let them see we lost the other side
          }
        };

        if (!socket) { setStatus('error'); setErrorMsg('Real-time connection unavailable — please refresh and try again.'); return; }

        socket.emit('video_join', { roomId, name: user?.name, role: user?.role });
        setStatus('waiting');

        socket.on('video_peer_joined', async () => {
          // We were already here when they joined — we make the offer.
          isInitiatorRef.current = true;
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit('video_signal', { roomId, signal: { type: 'offer', sdp: offer } });
        });

        socket.on('video_signal', async ({ signal }) => {
          if (signal.type === 'offer') {
            await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit('video_signal', { roomId, signal: { type: 'answer', sdp: answer } });
          } else if (signal.type === 'answer') {
            await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          } else if (signal.type === 'ice') {
            try { await pc.addIceCandidate(new RTCIceCandidate(signal.candidate)); } catch { /* benign race, ignore */ }
          } else if (signal.type === 'caption') {
            pushCaption(signal.name, signal.text);
          }
        });

        socket.on('video_peer_left', () => {
          toast('The other participant left the call', { icon: '📵' });
          setStatus('waiting');
          if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
        });

        appointmentsAPI.startVideoCall(appointmentId).catch(()=>{});
      } catch (err) {
        setStatus('error');
        setErrorMsg(
          err.name === 'NotAllowedError' ? 'Camera/microphone access was denied. Please allow access and try again.' :
          err.response?.data?.error || 'Could not start the video call.'
        );
      }
    }
    start();

    return () => {
      cancelled = true;
      const s = getSocket();
      s?.off('video_peer_joined'); s?.off('video_signal'); s?.off('video_peer_left');
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointmentId]);

  useEffect(() => {
    if (status === 'in-call' && !timerRef.current) {
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    }
    return () => { if (status !== 'in-call' && timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };
  }, [status]);

  const toggleMic = () => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) { track.enabled = !track.enabled; setMicOn(track.enabled); }
  };
  const toggleCam = () => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (track) { track.enabled = !track.enabled; setCamOn(track.enabled); }
  };

  const pushCaption = useCallback((speaker, text) => {
    if (!text?.trim()) return;
    setCaptions(prev => [...prev.slice(-5), { id: `${Date.now()}-${Math.random()}`, speaker, text: text.trim() }]);
  }, []);

  // Live captions — each participant runs speech recognition on their OWN
  // microphone locally (the browser's built-in on-device/cloud speech
  // engine, e.g. Chrome's Web Speech API — no extra service or API key of
  // ours involved), then broadcasts just the transcribed text to the
  // other side over the same signaling channel already used for the
  // call. Nobody's raw audio is sent anywhere extra — only the resulting
  // text, and only while this is switched on.
  const toggleCaptions = () => {
    if (!captionsSupported) {
      toast.error('Live captions need Chrome or Edge — this browser doesn\u2019t support on-device speech recognition.');
      return;
    }
    if (captionsOn) {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      setCaptionsOn(false);
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    recognition.onresult = (e) => {
      const text = e.results[e.results.length - 1][0].transcript;
      pushCaption('You', text);
      const socket = getSocket();
      if (socket && roomIdRef.current) socket.emit('video_signal', { roomId: roomIdRef.current, signal: { type: 'caption', name: user?.name || 'Them', text } });
    };
    recognition.onerror = (e) => {
      // "no-speech" fires constantly during natural pauses — harmless,
      // just restart. Anything else, stop rather than loop on a real error.
      if (e.error === 'no-speech' || e.error === 'aborted') { try { recognition.start(); } catch {} }
      else { setCaptionsOn(false); }
    };
    recognition.onend = () => {
      // Some browsers auto-stop after a period of silence — restart
      // transparently as long as the user hasn't turned captions off.
      if (recognitionRef.current === recognition) { try { recognition.start(); } catch {} }
    };
    recognitionRef.current = recognition;
    recognition.start();
    setCaptionsOn(true);
  };

  const fmtTime = (s) => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
  const otherPartyLabel = user?.role === 'doctor' ? peerInfo?.patientName : peerInfo?.doctorName ? `Dr. ${peerInfo.doctorName}` : '';

  return (
    <div style={{ position:'fixed', inset:0, background:'#0f172a', zIndex:200, display:'flex', flexDirection:'column' }}>
      <div style={{ padding:'14px 20px', display:'flex', justifyContent:'space-between', alignItems:'center', color:'#fff' }}>
        <div style={{ fontSize:14, fontWeight:700 }}>📹 Video Consultation {otherPartyLabel && `with ${otherPartyLabel}`}</div>
        {status === 'in-call' && <div style={{ fontSize:13, color:'#86efac', fontVariantNumeric:'tabular-nums' }}>● {fmtTime(elapsed)}</div>}
      </div>

      <div style={{ flex:1, position:'relative', margin:'0 16px 16px', borderRadius:16, overflow:'hidden', background:'#1e293b' }}>
        <video ref={remoteVideoRef} autoPlay playsInline style={{ width:'100%', height:'100%', objectFit:'cover', display: status==='in-call' ? 'block':'none' }} />

        {status !== 'in-call' && (
          <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', color:'#94a3b8', gap:10, textAlign:'center', padding:20 }}>
            {status === 'connecting' && <><div className="spinner-sm" /><div>Connecting…</div></>}
            {status === 'waiting' && <><div style={{ fontSize:38 }}>⏳</div><div style={{ fontSize:15, fontWeight:600, color:'#e2e8f0' }}>Waiting for {otherPartyLabel || 'the other participant'} to join…</div><div style={{ fontSize:12 }}>You're connected — the call will start automatically once they join.</div></>}
            {status === 'error' && <><div style={{ fontSize:38 }}>⚠️</div><div style={{ fontSize:14, color:'#fca5a5', maxWidth:360 }}>{errorMsg}</div><button className="btn btn-outline" style={{marginTop:8}} onClick={()=>navigate('/appointments')}>Back to Appointments</button></>}
            {status === 'ended' && <><div style={{ fontSize:38 }}>👋</div><div style={{ fontSize:15, color:'#e2e8f0' }}>Call ended</div></>}
          </div>
        )}

        <div style={{ position:'absolute', bottom:16, right:16, width:150, height:112, borderRadius:12, overflow:'hidden', border:'2px solid rgba(255,255,255,.2)', background:'#0f172a' }}>
          <video ref={localVideoRef} autoPlay playsInline muted style={{ width:'100%', height:'100%', objectFit:'cover', transform:'scaleX(-1)', display: camOn ? 'block':'none' }} />
          {!camOn && <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', color:'#64748b', fontSize:24 }}>📷</div>}
        </div>

        {captionsOn && captions.length > 0 && (
          <div style={{ position:'absolute', left:16, right:180, bottom:16, display:'flex', flexDirection:'column', gap:4 }}>
            {captions.map(c => (
              <div key={c.id} style={{ background:'rgba(15,23,42,.75)', color:'#fff', fontSize:13, padding:'6px 12px', borderRadius:8, alignSelf:'flex-start', maxWidth:'100%' }}>
                <strong style={{ color:'#93c5fd' }}>{c.speaker}:</strong> {c.text}
              </div>
            ))}
          </div>
        )}
      </div>

      {status !== 'error' && (
        <div style={{ display:'flex', justifyContent:'center', gap:14, paddingBottom:26 }}>
          <button onClick={toggleMic} title={micOn?'Mute':'Unmute'} style={{ width:52, height:52, borderRadius:'50%', border:'none', background: micOn?'#334155':'#dc2626', color:'#fff', fontSize:19, cursor:'pointer' }}>{micOn?'🎤':'🔇'}</button>
          <button onClick={endCall} title="End call" style={{ width:60, height:60, borderRadius:'50%', border:'none', background:'#dc2626', color:'#fff', fontSize:24, cursor:'pointer' }}>📞</button>
          <button onClick={toggleCam} title={camOn?'Turn camera off':'Turn camera on'} style={{ width:52, height:52, borderRadius:'50%', border:'none', background: camOn?'#334155':'#dc2626', color:'#fff', fontSize:19, cursor:'pointer' }}>{camOn?'📹':'🚫'}</button>
          <button onClick={toggleCaptions} title={captionsSupported ? (captionsOn?'Turn off live captions':'Turn on live captions (AI speech-to-text)') : 'Live captions need Chrome/Edge'} style={{ width:52, height:52, borderRadius:'50%', border:'none', background: captionsOn?'#7c3aed':'#334155', color:'#fff', fontSize:18, cursor:'pointer', opacity: captionsSupported?1:.5 }}>💬</button>
        </div>
      )}
    </div>
  );
}
