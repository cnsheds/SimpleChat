import { useState } from 'react';
import { api } from '../api.js';

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await api('/api/auth/agent-login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
      });
      onLogin(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-5 py-8 text-zinc-900">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-sm flex-col justify-center">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-normal">客服工作台</h1>
          <p className="mt-2 text-sm text-zinc-500">使用客服账号登录。</p>
        </div>
        <form onSubmit={submit} className="space-y-4 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <label className="block">
            <span className="text-sm font-medium text-zinc-700">账号</span>
            <input
              className="mt-2 w-full rounded-md border border-zinc-300 px-3 py-3 outline-none focus:border-teal-700"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-zinc-700">密码</span>
            <input
              className="mt-2 w-full rounded-md border border-zinc-300 px-3 py-3 outline-none focus:border-teal-700"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <button
            className="w-full rounded-md bg-teal-700 px-4 py-3 font-medium text-white disabled:opacity-60"
            disabled={loading}
          >
            {loading ? '登录中...' : '登录'}
          </button>
        </form>
      </section>
    </main>
  );
}
