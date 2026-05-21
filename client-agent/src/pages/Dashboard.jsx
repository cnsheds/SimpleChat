import { LogOut, RefreshCw, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api, authHeaders } from '../api.js';
import AgentManager from './AgentManager.jsx';
import ChatPanel from './Chat.jsx';

export default function Dashboard({ token, profile, socket, onLogout }) {
  const [sessions, setSessions] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [status, setStatus] = useState('active');
  const [view, setView] = useState('sessions');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function loadSessions(nextStatus = status) {
    setLoading(true);
    setError('');
    try {
      const result = await api(`/api/agent/sessions?status=${nextStatus}`, {
        headers: authHeaders(token)
      });
      setSessions(result);
      setSelectedId((old) => (result.some((item) => item.session_id === old) ? old : result[0]?.session_id || null));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSessions(status);
  }, [status]);

  useEffect(() => {
    if (!socket) return undefined;
    const refresh = () => loadSessions(status);
    socket.on('new_session', refresh);
    socket.on('session_updated', refresh);
    socket.on('session_deleted', refresh);
    return () => {
      socket.off('new_session', refresh);
      socket.off('session_updated', refresh);
      socket.off('session_deleted', refresh);
    };
  }, [socket, status]);

  const selected = sessions.find((item) => item.session_id === selectedId) || null;

  return (
    <main className="flex h-screen overflow-hidden flex-col bg-zinc-50 text-zinc-900">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3">
        <div>
          <h1 className="text-lg font-semibold tracking-normal">客服工作台</h1>
          <p className="text-xs text-zinc-500">{profile?.display_name}</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="rounded-md border border-zinc-300 p-2 text-zinc-700" onClick={() => loadSessions(status)} title="刷新">
            <RefreshCw size={18} />
          </button>
          {profile?.is_admin && (
            <button
              className={`rounded-md border p-2 ${view === 'agents' ? 'border-teal-700 bg-teal-50 text-teal-800' : 'border-zinc-300 text-zinc-700'}`}
              onClick={() => setView((old) => (old === 'agents' ? 'sessions' : 'agents'))}
              title="客服管理"
            >
              <Users size={18} />
            </button>
          )}
          <button className="rounded-md border border-zinc-300 p-2 text-zinc-700" onClick={onLogout} title="退出">
            <LogOut size={18} />
          </button>
        </div>
      </header>
      {error && <div className="bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}
      {view === 'agents' && profile?.is_admin ? (
        <AgentManager token={token} currentAgentId={profile.agent_id} />
      ) : (
      <section className="grid min-h-0 flex-1 overflow-hidden grid-cols-1 md:grid-cols-[320px_1fr]">
        <aside className="flex min-h-0 flex-col border-r border-zinc-200 bg-white">
          <div className="flex gap-2 border-b border-zinc-200 p-3">
            <button
              className={`flex-1 rounded-md px-3 py-2 text-sm ${status === 'active' ? 'bg-teal-700 text-white' : 'bg-zinc-100 text-zinc-700'}`}
              onClick={() => setStatus('active')}
            >
              进行中
            </button>
            <button
              className={`flex-1 rounded-md px-3 py-2 text-sm ${status === 'closed' ? 'bg-teal-700 text-white' : 'bg-zinc-100 text-zinc-700'}`}
              onClick={() => setStatus('closed')}
            >
              已结束
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading && <p className="p-4 text-sm text-zinc-500">正在加载会话...</p>}
            {!loading && sessions.length === 0 && <p className="p-4 text-sm text-zinc-500">暂无会话。</p>}
            {sessions.map((session) => (
              <button
                key={session.session_id}
                className={`block w-full border-b border-zinc-100 p-4 text-left ${selectedId === session.session_id ? 'bg-teal-50' : 'bg-white'}`}
                onClick={() => setSelectedId(session.session_id)}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{session.user.display_name}</span>
                  <span className="text-xs text-zinc-500">#{session.session_id}</span>
                </div>
                <p className="mt-1 truncate text-sm text-zinc-500">
                  {session.last_message
                    ? session.last_message.msg_type === 'image'
                      ? '[图片]'
                      : session.last_message.content
                    : '尚无消息'}
                </p>
              </button>
            ))}
          </div>
        </aside>
        <ChatPanel
          token={token}
          socket={socket}
          session={selected}
          onChanged={() => loadSessions(status)}
        />
      </section>
      )}
    </main>
  );
}
