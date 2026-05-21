import { LogOut } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api, authHeaders } from '../api.js';

export default function AgentList({ token, user, onChat, onLogout }) {
  const [agents, setAgents] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/api/agents')
      .then(setAgents)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function start(agentId) {
    setError('');
    try {
      const result = await api('/api/sessions', {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({ agent_id: agentId })
      });
      onChat(result.session_id);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white px-4 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-normal">选择客服</h1>
            <p className="text-sm text-slate-500">{user?.display_name}</p>
          </div>
          <button className="rounded-md border border-slate-300 p-2 text-slate-600" onClick={onLogout} title="退出">
            <LogOut size={18} />
          </button>
        </div>
      </header>
      <section className="mx-auto max-w-3xl px-4 py-5">
        {loading && <p className="text-sm text-slate-500">正在加载客服列表...</p>}
        {error && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {!loading && agents.length === 0 && (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-slate-500">
            当前没有可用客服，请稍后再试。
          </div>
        )}
        <div className="grid gap-3">
          {agents.map((agent) => (
            <button
              key={agent.agent_id}
              onClick={() => start(agent.agent_id)}
              className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-cyan-100 font-semibold text-cyan-800">
                {agent.display_name.slice(0, 1)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium">{agent.display_name}</div>
                <div className={`text-sm ${agent.is_online ? 'text-emerald-600' : 'text-slate-500'}`}>
                  {agent.is_online ? '在线' : '离线，可留言'}
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
