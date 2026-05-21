import { CheckCircle2, Pencil, Plus, Save, Trash2, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api, authHeaders } from '../api.js';

const emptyForm = {
  username: '',
  display_name: '',
  password: '',
  is_admin: false
};

export default function AgentManager({ token, currentAgentId }) {
  const [agents, setAgents] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function loadAgents() {
    setLoading(true);
    setError('');
    try {
      const result = await api('/api/admin/agents', {
        headers: authHeaders(token)
      });
      setAgents(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAgents();
  }, []);

  async function createAgent(event) {
    event.preventDefault();
    setError('');
    try {
      await api('/api/admin/agents', {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify(form)
      });
      setForm(emptyForm);
      await loadAgents();
    } catch (err) {
      setError(err.message);
    }
  }

  function startEdit(agent) {
    setEditingId(agent.id);
    setEditForm({
      username: agent.username,
      display_name: agent.display_name,
      password: '',
      is_admin: agent.is_admin,
      is_disabled: agent.is_disabled
    });
  }

  async function saveEdit(agentId) {
    setError('');
    try {
      await api(`/api/admin/agents/${agentId}`, {
        method: 'PATCH',
        headers: authHeaders(token),
        body: JSON.stringify(editForm)
      });
      setEditingId(null);
      await loadAgents();
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggleDisabled(agent) {
    setError('');
    try {
      await api(`/api/admin/agents/${agent.id}`, {
        method: 'PATCH',
        headers: authHeaders(token),
        body: JSON.stringify({ is_disabled: !agent.is_disabled })
      });
      await loadAgents();
    } catch (err) {
      setError(err.message);
    }
  }

  async function deleteAgent(agent) {
    if (!window.confirm(`删除客服 ${agent.display_name}？已有会话的客服不能删除，只能禁用。`)) return;
    setError('');
    try {
      await api(`/api/admin/agents/${agent.id}`, {
        method: 'DELETE',
        headers: authHeaders(token)
      });
      await loadAgents();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="min-h-0 flex-1 overflow-y-auto bg-zinc-50 p-4">
      <div className="mx-auto max-w-6xl space-y-4">
        <form onSubmit={createAgent} className="grid gap-3 rounded-lg border border-zinc-200 bg-white p-4 md:grid-cols-[1fr_1fr_1fr_auto_auto]">
          <input
            className="rounded-md border border-zinc-300 px-3 py-2 outline-none focus:border-teal-700"
            value={form.username}
            onChange={(event) => setForm({ ...form, username: event.target.value })}
            placeholder="账号"
            required
          />
          <input
            className="rounded-md border border-zinc-300 px-3 py-2 outline-none focus:border-teal-700"
            value={form.display_name}
            onChange={(event) => setForm({ ...form, display_name: event.target.value })}
            placeholder="显示名称"
            required
          />
          <input
            className="rounded-md border border-zinc-300 px-3 py-2 outline-none focus:border-teal-700"
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
            placeholder="初始密码"
            type="password"
            required
          />
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={form.is_admin}
              onChange={(event) => setForm({ ...form, is_admin: event.target.checked })}
            />
            管理员
          </label>
          <button className="inline-flex items-center justify-center gap-2 rounded-md bg-teal-700 px-4 py-2 text-white">
            <Plus size={17} />
            添加
          </button>
        </form>

        {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
          <div className="grid grid-cols-[1.1fr_1.1fr_90px_90px_90px_160px] border-b border-zinc-200 bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-600">
            <div>账号</div>
            <div>显示名称</div>
            <div>角色</div>
            <div>状态</div>
            <div>会话数</div>
            <div>操作</div>
          </div>
          {loading && <div className="px-4 py-5 text-sm text-zinc-500">正在加载客服列表...</div>}
          {!loading && agents.length === 0 && <div className="px-4 py-5 text-sm text-zinc-500">暂无客服账号。</div>}
          {agents.map((agent) => {
            const editing = editingId === agent.id;
            return (
              <div key={agent.id} className="grid grid-cols-[1.1fr_1.1fr_90px_90px_90px_160px] items-center gap-2 border-b border-zinc-100 px-4 py-3 text-sm last:border-b-0">
                <div>
                  {editing ? (
                    <input
                      className="w-full rounded-md border border-zinc-300 px-2 py-2 outline-none focus:border-teal-700"
                      value={editForm.username}
                      onChange={(event) => setEditForm({ ...editForm, username: event.target.value })}
                    />
                  ) : (
                    <span className="font-medium">{agent.username}</span>
                  )}
                </div>
                <div>
                  {editing ? (
                    <div className="grid gap-2">
                      <input
                        className="w-full rounded-md border border-zinc-300 px-2 py-2 outline-none focus:border-teal-700"
                        value={editForm.display_name}
                        onChange={(event) => setEditForm({ ...editForm, display_name: event.target.value })}
                      />
                      <input
                        className="w-full rounded-md border border-zinc-300 px-2 py-2 outline-none focus:border-teal-700"
                        value={editForm.password}
                        onChange={(event) => setEditForm({ ...editForm, password: event.target.value })}
                        placeholder="新密码，留空不改"
                        type="password"
                      />
                    </div>
                  ) : (
                    agent.display_name
                  )}
                </div>
                <div>
                  {editing ? (
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={editForm.is_admin}
                        onChange={(event) => setEditForm({ ...editForm, is_admin: event.target.checked })}
                      />
                      管理
                    </label>
                  ) : agent.is_admin ? (
                    '管理员'
                  ) : (
                    '客服'
                  )}
                </div>
                <div className={agent.is_disabled ? 'text-zinc-400' : 'text-emerald-700'}>
                  {agent.is_disabled ? '禁用' : agent.is_online ? '在线' : '启用'}
                </div>
                <div>{agent.session_count}</div>
                <div className="flex items-center gap-2">
                  {editing ? (
                    <>
                      <button className="rounded-md border border-zinc-300 p-2 text-zinc-700" onClick={() => saveEdit(agent.id)} title="保存">
                        <Save size={17} />
                      </button>
                      <button className="rounded-md border border-zinc-300 p-2 text-zinc-700" onClick={() => setEditingId(null)} title="取消">
                        <XCircle size={17} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="rounded-md border border-zinc-300 p-2 text-zinc-700" onClick={() => startEdit(agent)} title="编辑">
                        <Pencil size={17} />
                      </button>
                      <button
                        className="rounded-md border border-zinc-300 p-2 text-zinc-700 disabled:opacity-40"
                        onClick={() => toggleDisabled(agent)}
                        disabled={agent.id === currentAgentId}
                        title={agent.is_disabled ? '启用' : '禁用'}
                      >
                        {agent.is_disabled ? <CheckCircle2 size={17} /> : <XCircle size={17} />}
                      </button>
                      <button className="rounded-md border border-zinc-300 p-2 text-red-700" onClick={() => deleteAgent(agent)} title="删除">
                        <Trash2 size={17} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
