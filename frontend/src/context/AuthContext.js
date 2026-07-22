import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { authAPI } from '../utils/api';
import { initSocket, disconnectSocket } from '../utils/socket';

const AuthContext = createContext(null);

// ── Helpers ──────────────────────────────────────────────────────────────
const STORAGE_TOKEN = 'mediventra_token';
const STORAGE_USER  = 'mediventra_user';

// sessionStorage (not localStorage) is deliberate: it's isolated per
// browser TAB, not shared across every tab of the same browser. Hospital
// staff frequently share one front-desk computer with different people
// logged in on different tabs — with localStorage, logging in as one
// person in one tab would force every other open tab to switch to that
// same account (or log out), which is exactly the "other user logs out
// automatically" bug. sessionStorage keeps each tab's session fully
// independent. The trade-off: closing a tab ends that session — an
// acceptable (arguably safer) default for shared clinical workstations.
function readStoredUser() {
  try {
    const s = sessionStorage.getItem(STORAGE_USER);
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}

function writeSession(token, user) {
  sessionStorage.setItem(STORAGE_TOKEN, token);
  sessionStorage.setItem(STORAGE_USER, JSON.stringify(user));
}

function clearSession() {
  sessionStorage.removeItem(STORAGE_TOKEN);
  sessionStorage.removeItem(STORAGE_USER);
}

export function AuthProvider({ children }) {
  // Initialise synchronously from sessionStorage to avoid a flash of the
  // login page, but always re-verify against the server before trusting
  // the cached user.
  const [user, setUser] = useState(readStoredUser);
  const [loading, setLoading] = useState(true);
  const didVerify = useRef(false);

  // ── verifyUser — called once on mount and after every login ────────────
  // Re-fetches the current user from the server using the stored token.
  // If the token is expired, stale, or belongs to a previous user who
  // didn't log out properly, this wipes the session so the correct (or no)
  // user is shown.
  const verifyUser = useCallback(async () => {
    const token = sessionStorage.getItem(STORAGE_TOKEN);
    if (!token) { setUser(null); setLoading(false); return; }
    try {
      const res = await authAPI.getMe();
      const fresh = res.data.data;
      sessionStorage.setItem(STORAGE_USER, JSON.stringify(fresh));
      setUser(fresh);
      initSocket(fresh._id);
    } catch {
      // Token invalid / expired — clear everything so no ghost session
      // leaks from a previous user.
      clearSession();
      disconnectSocket();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (didVerify.current) return;
    didVerify.current = true;
    verifyUser();
  }, [verifyUser]);

  // ── applySession — shared by login() and verifyTwoFactor() ─────────────
  // Always wipes any existing session first so a new login never inherits
  // state from the previously logged-in user.
  const applySession = (resData) => {
    const { token, data } = resData;
    // Clear old session data BEFORE writing the new one — this is the key
    // fix for "previous user auto-logs in": stale data in sessionStorage was
    // surviving across account switches.
    clearSession();
    disconnectSocket();
    writeSession(token, data);
    setUser(data);
    initSocket(data._id);
    return data;
  };

  // ── login ─────────────────────────────────────────────────────────────
  const login = async (email, password) => {
    const res = await authAPI.login({ email, password });

    // 2FA: backend didn't issue a token yet — waiting on OTP verification.
    // Don't touch sessionStorage or the socket until verifyTwoFactor() passes.
    if (res.data?.requiresTwoFactor) {
      return { requiresTwoFactor: true, email: res.data.email };
    }

    return applySession(res.data);
  };

  // ── verifyTwoFactor ────────────────────────────────────────────────────
  const verifyTwoFactor = async (email, otp) => {
    const res = await authAPI.verifyLoginOtp({ email, otp });
    return applySession(res.data);
  };

  // ── logout ─────────────────────────────────────────────────────────────
  const logout = async () => {
    try { await authAPI.logout(); } catch {}
    clearSession();
    disconnectSocket();
    setUser(null);
  };

  // ── updateUser — patch the in-memory and cached user after profile edits
  const updateUser = (updates) => {
    const updated = { ...user, ...updates };
    setUser(updated);
    sessionStorage.setItem(STORAGE_USER, JSON.stringify(updated));
  };

  // ── loginWithOAuthToken — completes a Google/GitHub login ──────────────
  // The backend OAuth callback redirects the browser to /oauth-callback
  // with a JWT in the URL fragment (never sent to any server/proxy log,
  // unlike a query param). This picks it up, stores it the same way a
  // normal login would, and fetches the user record.
  const loginWithOAuthToken = async (token) => {
    clearSession();
    disconnectSocket();
    sessionStorage.setItem(STORAGE_TOKEN, token);
    await verifyUser();
  };

  return (
    <AuthContext.Provider value={{
      user, loading,
      isAuthenticated: !!user,
      login, verifyTwoFactor, logout, updateUser, verifyUser, loginWithOAuthToken,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
