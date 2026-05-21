import { useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import { api, authHeaders } from './api.js';

const savedToken = localStorage.getItem('agent_token');
const savedProfile = JSON.parse(localStorage.getItem('agent_profile') || 'null');

export default function App() {
  const [token, setToken] = useState(savedToken);
  const [profile, setProfile] = useState(savedProfile);

  const socket = useMemo(() => {
    if (!token) return null;
    return io('/', { auth: { token } });
  }, [token]);

  function handleLogin(payload) {
    const nextProfile = { agent_id: payload.agent_id, display_name: payload.display_name, is_admin: payload.is_admin };
    localStorage.setItem('agent_token', payload.token);
    localStorage.setItem('agent_profile', JSON.stringify(nextProfile));
    setToken(payload.token);
    setProfile(nextProfile);
  }

  async function logout() {
    if (token) {
      await api('/api/auth/agent-logout', {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({})
      }).catch(() => {});
    }
    socket?.emit('agent_logout', { agent_id: profile?.agent_id });
    socket?.disconnect();
    localStorage.removeItem('agent_token');
    localStorage.removeItem('agent_profile');
    setToken(null);
    setProfile(null);
  }

  if (!token) return <Login onLogin={handleLogin} />;
  return <Dashboard token={token} profile={profile} socket={socket} onLogout={logout} />;
}
