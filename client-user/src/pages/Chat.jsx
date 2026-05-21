import { ArrowLeft, Bell, Image, Send } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api, authHeaders, uploadImage } from '../api.js';
import { getNotificationPermission, messagePreview, requestNotificationPermission, showIncomingNotification } from '../notifications.js';

export default function Chat({ token, socket, sessionId, onBack }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [closed, setClosed] = useState(false);
  const [typing, setTyping] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState(getNotificationPermission);
  const listRef = useRef(null);

  useEffect(() => {
    api(`/api/sessions/${sessionId}/messages`, {
      headers: authHeaders(token)
    })
      .then(setMessages)
      .catch((err) => setError(err.message));
  }, [sessionId, token]);

  useEffect(() => {
    let cancelled = false;
    requestNotificationPermission().then((permission) => {
      if (!cancelled) setNotificationPermission(permission);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!socket) return undefined;
    socket.emit('join_session', { session_id: sessionId, token }, (ack) => {
      if (!ack?.ok) setError(ack?.error || '无法加入会话');
    });

    const onMessage = (message) => {
      if (message.session_id === sessionId) {
        setMessages((old) => [...old, message]);
        if (message.sender_type === 'agent') {
          showIncomingNotification('客服新消息', {
            body: messagePreview(message),
            tag: `user-session-${sessionId}`
          });
        }
      }
    };
    const onTyping = ({ sender_type }) => {
      if (sender_type === 'agent') {
        setTyping(true);
        window.setTimeout(() => setTyping(false), 1600);
      }
    };
    const onClosed = ({ session_id }) => {
      if (session_id === sessionId) setClosed(true);
    };
    const onCleared = ({ session_id }) => {
      if (session_id === sessionId) setMessages([]);
    };
    const onDeleted = ({ session_id }) => {
      if (session_id === sessionId) {
        setMessages([]);
        setClosed(true);
        setError('本次对话已被客服清空');
      }
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
  }, [sessionId, socket, token]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  function send(content, msgType = 'text') {
    if (!content.trim() || closed) return;
    socket.emit('send_message', { session_id: sessionId, content, msg_type: msgType, token }, (ack) => {
      if (!ack?.ok) setError(ack?.error || '发送失败');
    });
    setText('');
  }

  async function handleFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
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
    if (closed) return;
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

  async function enableNotifications() {
    setNotificationPermission(await requestNotificationPermission());
  }

  const notificationTitle =
    notificationPermission === 'granted'
      ? '浏览器通知已开启'
      : notificationPermission === 'denied'
        ? '浏览器通知已被拒绝'
        : '开启浏览器通知';

  return (
    <main className="flex h-screen flex-col bg-slate-50 text-slate-900">
      <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-3 py-3">
        <button className="rounded-md border border-slate-300 p-2 text-slate-700" onClick={onBack} title="返回">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="font-semibold tracking-normal">客服会话</h1>
          <p className="text-xs text-slate-500">{closed ? '本次对话已结束' : typing ? '对方正在输入...' : '消息实时同步'}</p>
        </div>
        <button
          className={`ml-auto rounded-md border p-2 ${notificationPermission === 'granted' ? 'border-cyan-700 bg-cyan-50 text-cyan-800' : 'border-slate-300 text-slate-700'} disabled:opacity-50`}
          onClick={enableNotifications}
          disabled={notificationPermission === 'unsupported'}
          title={notificationTitle}
        >
          <Bell size={18} />
        </button>
      </header>
      {error && <div className="bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <section ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-4">
        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.sender_type === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[78%] rounded-lg px-3 py-2 ${message.sender_type === 'user' ? 'bg-cyan-700 text-white' : 'bg-white text-slate-900 shadow-sm'}`}>
              {message.msg_type === 'image' ? (
                <img src={message.content} alt="聊天图片" className="max-h-72 rounded-md object-contain" />
              ) : (
                <p className="whitespace-pre-wrap break-words text-sm">{message.content}</p>
              )}
            </div>
          </div>
        ))}
      </section>
      <form
        className="flex items-center gap-2 border-t border-slate-200 bg-white p-3"
        onPaste={handlePaste}
        onSubmit={(event) => {
          event.preventDefault();
          send(text);
        }}
      >
        <label className="rounded-md border border-slate-300 p-2 text-slate-700" title="发送图片">
          <Image size={19} />
          <input className="hidden" type="file" accept="image/jpeg,image/png,image/gif,image/webp" onChange={handleFile} disabled={closed} />
        </label>
        <input
          className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-cyan-600"
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            socket?.emit('typing', { session_id: sessionId });
          }}
          placeholder={closed ? '会话已结束' : '输入消息'}
          disabled={closed}
        />
        <button className="rounded-md bg-cyan-700 p-2 text-white disabled:opacity-60" disabled={closed || !text.trim()} title="发送">
          <Send size={19} />
        </button>
      </form>
    </main>
  );
}
