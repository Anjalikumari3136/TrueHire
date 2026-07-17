import { createContext, useContext, useState, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_FASTAPI_URL || 'http://localhost:8000';

const AuthContext = createContext(null);

// The main frontend login flow stores the session under these keys, in
// localStorage (Remember me) or sessionStorage. Read from both so the
// post-login flow picks up whoever just logged in.
function readToken() {
  return (
    localStorage.getItem('truehire_token') ||
    sessionStorage.getItem('truehire_token')
  );
}

function readUser() {
  const saved =
    localStorage.getItem('truehire_user') ||
    sessionStorage.getItem('truehire_user');
  try {
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(readToken);
  const [user, setUser] = useState(readUser);

  const login = useCallback(async (email, password) => {
    let res;
    try {
      res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
    } catch {
      // Network-level failure (server down, CORS blocked, no internet)
      throw new Error(
        'Unable to reach the server. Please check that the backend is running and try again.'
      );
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.detail || data.message || 'Invalid email or password.');
    }

    const data = await res.json();
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    return data;
  }, []);

  const signup = useCallback(async (name, email, password) => {
    let res;
    try {
      res = await fetch(`${API_BASE}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
    } catch {
      throw new Error(
        'Unable to reach the server. Please check that the backend is running and try again.'
      );
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.detail || data.message || 'Signup failed. Please try again.');
    }

    const data = await res.json();
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    return data;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('truehire_token');
    localStorage.removeItem('truehire_user');
    sessionStorage.removeItem('truehire_token');
    sessionStorage.removeItem('truehire_user');
  }, []);

  return (
    <AuthContext.Provider value={{ token, user, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
