import { useState } from 'react';
import { api } from '../api.js';

export default function Login({ onLogin }) {
  const inviteCode = new URLSearchParams(window.location.search).get('invite_code') || '';
  const [inviteCodeInput, setInviteCodeInput] = useState(inviteCode);
  const [identifier, setIdentifier] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await api('/api/auth/user-login', {
        method: 'POST',
        body: JSON.stringify({
          invite_code: inviteCodeInput,
          identifier,
          display_name: displayName || identifier
        })
      });
      onLogin(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-normal">在线客服</h1>
          <p className="mt-2 text-sm text-slate-500">请输入邀请码和身份信息进入咨询。</p>
        </div>
        <form onSubmit={submit} className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">邀请码</span>
            <input
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-3 text-lg outline-none focus:border-cyan-600"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={inviteCodeInput}
              onChange={(event) => setInviteCodeInput(event.target.value)}
              required
            />
            {inviteCode && <span className="mt-2 block text-xs text-cyan-700">已从邀请链接填入邀请码。</span>}
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">手机号或昵称</span>
            <input
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-3 outline-none focus:border-cyan-600"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              required
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">显示名称</span>
            <input
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-3 outline-none focus:border-cyan-600"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="默认使用上方身份"
            />
          </label>
          {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <button
            className="w-full rounded-md bg-cyan-700 px-4 py-3 font-medium text-white disabled:opacity-60"
            disabled={loading}
          >
            {loading ? '登录中...' : '进入客服'}
          </button>
        </form>
      </section>
    </main>
  );
}
