import { useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import Login from './pages/Login.jsx';
import AgentList from './pages/AgentList.jsx';
import Chat from './pages/Chat.jsx';
import { api } from './api.js';

const savedToken = localStorage.getItem('user_token');
const savedUser = JSON.parse(localStorage.getItem('user_profile') || 'null');

function currentView() {
  const match = window.location.pathname.match(/^\/chat\/(\d+)/);
  if (match) return { name: 'chat', sessionId: Number(match[1]) };
  if (window.location.pathname === '/agents') return { name: 'agents' };
  return { name: 'login' };
}

export default function App() {
  const [token, setToken] = useState(savedToken);
  const [user, setUser] = useState(savedUser);
  const [view, setView] = useState(currentView);
  const [checking, setChecking] = useState(Boolean(savedToken));

  const socket = useMemo(() => {
    if (!token) return null;
    return io('/', { auth: { token } });
  }, [token]);

  useEffect(() => {
    if (!savedToken) return;
    api('/api/auth/verify-token', {
      method: 'POST',
      body: JSON.stringify({ token: savedToken })
    })
      .then((profile) => {
        setUser({ user_id: profile.user_id, display_name: profile.display_name });
        setView((old) => (old.name === 'login' ? { name: 'agents' } : old));
      })
      .catch(() => {
        localStorage.removeItem('user_token');
        localStorage.removeItem('user_profile');
        setToken(null);
        setUser(null);
        setView({ name: 'login' });
      })
      .finally(() => setChecking(false));
  }, []);

  useEffect(() => {
    const onPop = () => setView(currentView());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  function navigate(next) {
    const path = next.name === 'chat' ? `/chat/${next.sessionId}` : next.name === 'agents' ? '/agents' : '/';
    window.history.pushState({}, '', path);
    setView(next);
  }

  function handleLogin(payload) {
    const profile = { user_id: payload.user_id, display_name: payload.display_name };
    localStorage.setItem('user_token', payload.token);
    localStorage.setItem('user_profile', JSON.stringify(profile));
    setToken(payload.token);
    setUser(profile);
    navigate({ name: 'agents' });
  }

  function logout() {
    localStorage.removeItem('user_token');
    localStorage.removeItem('user_profile');
    setToken(null);
    setUser(null);
    navigate({ name: 'login' });
  }

  if (checking) {
    return <div className="min-h-screen bg-slate-50 p-6 text-slate-600">正在恢复登录状态...</div>;
  }

  if (!token || view.name === 'login') return <Login onLogin={handleLogin} />;
  if (view.name === 'chat') {
    return <Chat token={token} user={user} socket={socket} sessionId={view.sessionId} onBack={() => navigate({ name: 'agents' })} />;
  }
  return <AgentList token={token} user={user} onChat={(sessionId) => navigate({ name: 'chat', sessionId })} onLogout={logout} />;
}
