import { Image, Power, Send, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api, authHeaders, uploadImage } from '../api.js';

export default function ChatPanel({ token, socket, session, onChanged }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [typing, setTyping] = useState(false);
  const listRef = useRef(null);

  useEffect(() => {
    setMessages([]);
    setError('');
    if (!session) return;
    api(`/api/sessions/${session.session_id}/messages`, {
      headers: authHeaders(token)
    })
      .then(setMessages)
      .catch((err) => setError(err.message));
  }, [session?.session_id, token]);

  useEffect(() => {
    if (!socket || !session) return undefined;
    socket.emit('join_session', { session_id: session.session_id, token }, (ack) => {
      if (!ack?.ok) setError(ack?.error || '无法加入会话');
    });

    const onMessage = (message) => {
      if (message.session_id === session.session_id) setMessages((old) => [...old, message]);
    };
    const onTyping = ({ sender_type }) => {
      if (sender_type === 'user') {
        setTyping(true);
        window.setTimeout(() => setTyping(false), 1600);
      }
    };
    const onClosed = ({ session_id }) => {
      if (session_id === session.session_id) onChanged();
    };
    const onCleared = ({ session_id }) => {
      if (session_id === session.session_id) setMessages([]);
    };
    const onDeleted = ({ session_id }) => {
      if (session_id === session.session_id) onChanged();
    };

    socket.on('new_message', onMessage);
    socket.on('typing', onTyping);
    socket.on('session_closed', onClosed);
    socket.on('messages_cleared', onCleared);
    socket.on('session_deleted', onDeleted);
    return () => {
      socket.off('new_message', onMessage);
      socket.off('typing', onTyping);
      socket.off('session_closed', onClosed);
      socket.off('messages_cleared', onCleared);
      socket.off('session_deleted', onDeleted);
    };
  }, [socket, session?.session_id, token]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  function send(content, msgType = 'text') {
    if (!session || !content.trim() || session.status !== 'active') return;
    socket.emit('send_message', { session_id: session.session_id, content, msg_type: msgType, token }, (ack) => {
      if (!ack?.ok) setError(ack?.error || '发送失败');
      else onChanged();
    });
    setText('');
  }

  async function handleFile(event) {
    const file = event.target.files?.[0];
    if (!file || !session) return;
    try {
      const result = await uploadImage(file, token);
      send(result.url, 'image');
    } catch (err) {
      setError(err.message);
    } finally {
      event.target.value = '';
    }
  }

  async function handlePaste(event) {
    if (!session || session.status !== 'active') return;
    const item = [...event.clipboardData.items].find((entry) => entry.type.startsWith('image/'));
    const file = item?.getAsFile();
    if (!file) return;

    event.preventDefault();
    try {
      const result = await uploadImage(file, token);
      send(result.url, 'image');
    } catch (err) {
      setError(err.message);
    }
  }

  async function closeSession() {
    if (!session) return;
    await api(`/api/sessions/${session.session_id}/close`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({})
    });
    onChanged();
  }

  async function clearHistory() {
    if (!session) return;
    if (!window.confirm('彻底删除这个对话？聊天记录和本地图片文件都会删除。')) return;
    await api(`/api/sessions/${session.session_id}/messages`, {
      method: 'DELETE',
      headers: authHeaders(token)
    });
    setMessages([]);
    onChanged();
  }

  if (!session) {
    return <section className="flex items-center justify-center text-sm text-zinc-500">请选择一个会话。</section>;
  }

  const closed = session.status !== 'active';

  return (
    <section className="flex min-h-0 overflow-hidden flex-col">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate font-semibold tracking-normal">{session.user.display_name}</h2>
          <p className="text-xs text-zinc-500">
            {closed ? '会话已结束' : typing ? '用户正在输入...' : `IP: ${session.user.ip || '未记录'} · ${session.user.identifier}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="rounded-md border border-zinc-300 p-2 text-zinc-700" onClick={clearHistory} title="清空记录">
            <Trash2 size={18} />
          </button>
          <button className="rounded-md border border-zinc-300 p-2 text-zinc-700 disabled:opacity-50" onClick={closeSession} disabled={closed} title="结束会话">
            <Power size={18} />
          </button>
        </div>
      </header>
      {error && <div className="bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}
      <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.sender_type === 'agent' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[72%] rounded-lg px-3 py-2 ${message.sender_type === 'agent' ? 'bg-teal-700 text-white' : 'bg-white text-zinc-900 shadow-sm'}`}>
              {message.msg_type === 'image' ? (
                <img src={message.content} alt="聊天图片" className="max-h-80 rounded-md object-contain" />
              ) : (
                <p className="whitespace-pre-wrap break-words text-sm">{message.content}</p>
              )}
            </div>
          </div>
        ))}
      </div>
      <form
        className="flex items-center gap-2 border-t border-zinc-200 bg-white p-3"
        onPaste={handlePaste}
        onSubmit={(event) => {
          event.preventDefault();
          send(text);
        }}
      >
        <label className="rounded-md border border-zinc-300 p-2 text-zinc-700" title="发送图片">
          <Image size={19} />
          <input className="hidden" type="file" accept="image/jpeg,image/png,image/gif,image/webp" onChange={handleFile} disabled={closed} />
        </label>
        <input
          className="min-w-0 flex-1 rounded-md border border-zinc-300 px-3 py-2 outline-none focus:border-teal-700"
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            socket?.emit('typing', { session_id: session.session_id });
          }}
          placeholder={closed ? '会话已结束' : '输入回复'}
          disabled={closed}
        />
        <button className="rounded-md bg-teal-700 p-2 text-white disabled:opacity-60" disabled={closed || !text.trim()} title="发送">
          <Send size={19} />
        </button>
      </form>
    </section>
  );
}
