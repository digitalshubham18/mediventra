import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// The backend's Google/GitHub OAuth callback redirects the browser here
// with the JWT in the URL fragment (#token=...) rather than a query
// param, so it never ends up in any server/proxy access log. This page
// exists purely to grab it, finish logging in, and move on.
export default function OAuthCallbackPage() {
  const { loginWithOAuthToken } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    const hash = window.location.hash; // '#token=xxx'
    const token = hash.startsWith('#token=') ? hash.slice(7) : null;
    if (!token) { setError('No login token received — please try again.'); return; }

    loginWithOAuthToken(token)
      .then(() => navigate('/dashboard', { replace: true }))
      .catch(() => setError('Sign-in failed — please try again.'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#f1f5fb', fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Roboto,sans-serif" }}>
      <div style={{ textAlign:'center' }}>
        {error ? (
          <>
            <div style={{ fontSize:40, marginBottom:12 }}>⚠️</div>
            <div style={{ color:'#dc2626', fontWeight:700, marginBottom:14 }}>{error}</div>
            <button onClick={()=>navigate('/login')} style={{ padding:'10px 22px', borderRadius:10, border:'none', background:'#1648c9', color:'#fff', fontWeight:700, cursor:'pointer' }}>Back to Login</button>
          </>
        ) : (
          <>
            <div className="spinner-sm" style={{ margin:'0 auto 16px', width:32, height:32 }} />
            <div style={{ color:'#64748b', fontSize:14 }}>Signing you in…</div>
          </>
        )}
      </div>
    </div>
  );
}
