import React, { useRef, useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { attendanceAPI } from '../utils/api';

let modelsLoadPromise = null;
// Lazily loads face-api.js and its model weights from /models exactly once
// per page session, however many times this component is mounted.
function loadModels() {
  if (!modelsLoadPromise) {
    // modelsLoadPromise = import('face-api.js').then(async (faceapi) => {
      modelsLoadPromise = import('@vladmandic/face-api').then(async (faceapi) => {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
        faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
        faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
      ]);
      return faceapi;
    });
  }
  return modelsLoadPromise;
}

/**
 * mode: 'enroll' | 'checkin' | 'checkout'
 * onDone(result) — called after a successful action; onClose() — dismiss without action
 */
export default function FaceCapture({ mode, onDone, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [status, setStatus] = useState('loading'); // loading | ready | detecting | nofaceyet | working | error
  const [error, setError] = useState('');
  const [faceapi, setFaceapi] = useState(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const fa = await loadModels();
        if (cancelled) return;
        setFaceapi(fa);
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240, facingMode: 'user' } });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
        setStatus('ready');
      } catch (e) {
        setError(e?.name === 'NotAllowedError' ? 'Camera permission denied — please allow camera access to use face check-in.' : 'Could not start the camera or load face models.');
        setStatus('error');
      }
    })();
    return () => { cancelled = true; stopCamera(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const capture = async () => {
    if (!faceapi || !videoRef.current) return;
    setStatus('detecting');
    try {
      const detection = await faceapi
        .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        setStatus('nofaceyet');
        toast.error("Couldn't detect a face — center your face in frame and try again");
        return;
      }

      const descriptor = Array.from(detection.descriptor);
      setStatus('working');

      if (mode === 'enroll') {
        const res = await attendanceAPI.enrollFace(descriptor);
        toast.success(res.data.message || '✅ Face enrolled');
        onDone?.(res.data.data);
      } else if (mode === 'checkin') {
        const res = await attendanceAPI.checkIn({ faceDescriptor: descriptor });
        toast.success(res.data.message || '✅ Checked in with face recognition');
        onDone?.(res.data.data);
      } else {
        const res = await attendanceAPI.checkOut({ faceDescriptor: descriptor });
        toast.success(res.data.message || '✅ Checked out with face recognition');
        onDone?.(res.data.data);
      }
    } catch (e) {
      toast.error(e.response?.data?.error || 'Face verification failed');
      setStatus('ready');
    }
  };

  const titleFor = { enroll: '📸 Enroll Your Face', checkin: '📸 Face Check-In', checkout: '📸 Face Check-Out' }[mode];

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) { stopCamera(); onClose?.(); } }}>
      <motion.div className="modal-box" style={{ maxWidth: 420 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="modal-header">
          <span className="modal-title">{titleFor}</span>
          <button className="btn btn-ghost btn-icon" onClick={() => { stopCamera(); onClose?.(); }}>✕</button>
        </div>
        <div className="modal-body" style={{ textAlign: 'center' }}>
          {mode === 'enroll' && (
            <div style={{ background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 10, padding: '10px 14px', marginBottom: 12, fontSize: 12, color: '#4338ca', textAlign: 'left' }}>
              This stores a mathematical face signature (not a photo) used only to confirm it's really you clocking in — it never leaves this hospital's system.
            </div>
          )}
          {error ? (
            <div style={{ color: '#dc2626', fontSize: 13, padding: 20 }}>⚠️ {error}</div>
          ) : (
            <>
              <div style={{ position: 'relative', width: 320, height: 240, margin: '0 auto', borderRadius: 12, overflow: 'hidden', background: '#0f172a' }}>
                <video ref={videoRef} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
                {status === 'loading' && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12.5 }}>Loading camera & face model…</div>}
              </div>
              <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 8 }}>Center your face in the frame, in good light, then capture.</div>
            </>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={() => { stopCamera(); onClose?.(); }}>Cancel</button>
          <button className="btn btn-primary" disabled={!['ready','nofaceyet'].includes(status) || !!error} onClick={capture}>
            {status === 'detecting' || status === 'working' ? 'Working…' : '📸 Capture'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
