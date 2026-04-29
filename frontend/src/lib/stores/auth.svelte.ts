import { browser } from '$app/environment';

interface User {
  id: string;
  email: string;
  created_at: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
}

function createAuthStore() {
  let state = $state<AuthState>({
    user: null,
    token: null,
    loading: false,
    error: null
  });

  if (browser) {
    const stored = localStorage.getItem('auth');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        state.user = parsed.user;
        state.token = parsed.token;
      } catch {}
    }
  }

  function persist() {
    if (!browser) return;
    if (state.token && state.user) {
      localStorage.setItem('auth', JSON.stringify({ user: state.user, token: state.token }));
    } else {
      localStorage.removeItem('auth');
    }
  }

  async function login(email: string, password: string) {
    state.loading = true;
    state.error = null;
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Login failed' }));
        throw new Error(err.error || 'Login failed');
      }
      const data = await res.json();
      state.token = data.token;
      state.user = data.user;
      persist();
      return true;
    } catch (e: any) {
      state.error = e.message;
      return false;
    } finally {
      state.loading = false;
    }
  }

  async function signup(email: string, password: string) {
    state.loading = true;
    state.error = null;
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Registration failed' }));
        throw new Error(err.error || 'Registration failed');
      }
      const data = await res.json();
      state.token = data.token;
      state.user = data.user;
      persist();
      return true;
    } catch (e: any) {
      state.error = e.message;
      return false;
    } finally {
      state.loading = false;
    }
  }

  async function logout() {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: state.token ? { Authorization: `Bearer ${state.token}` } : {}
      });
    } catch {}
    state.user = null;
    state.token = null;
    persist();
  }

  return {
    get user() { return state.user; },
    get token() { return state.token; },
    get loading() { return state.loading; },
    get error() { return state.error; },
    get isAuthenticated() { return !!state.token; },
    login,
    signup,
    logout,
    clearError: () => { state.error = null; }
  };
}

export const auth = createAuthStore();
