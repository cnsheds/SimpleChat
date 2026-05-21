import { getAgentByToken, getUserByToken } from './middleware/auth.js';
import { addMessage } from './services/message.js';
import { canAccessSession, findSession } from './services/session.js';
import { db } from './db/index.js';

function resolveActor(socket, tokenOverride) {
  const token = tokenOverride || socket.handshake.auth?.token;
  return getAgentByToken(token) || getUserByToken(token);
}

export function registerSocketHandlers(io) {
  io.on('connection', (socket) => {
    const actor = resolveActor(socket);
    socket.data.actor = actor;

    if (actor?.type === 'agent') {
      socket.join(`agent:${actor.id}`);
      db.prepare('UPDATE agents SET is_online = 1 WHERE id = ?').run(actor.id);
      io.emit('agent_status', { agent_id: actor.id, is_online: true });
    }

    socket.on('join_session', ({ session_id, token }, ack) => {
      const current = resolveActor(socket, token);
      const session = findSession(Number(session_id));
      if (!canAccessSession(current, session)) {
        ack?.({ ok: false, error: '无权访问该会话' });
        return;
      }
      socket.data.actor = current;
      socket.join(`session:${session.id}`);
      ack?.({ ok: true });
    });

    socket.on('send_message', ({ session_id, content, msg_type = 'text', token }, ack) => {
      const current = resolveActor(socket, token) || socket.data.actor;
      const session = findSession(Number(session_id));
      if (!canAccessSession(current, session)) {
        ack?.({ ok: false, error: '无权访问该会话' });
        return;
      }
      if (session.status !== 'active') {
        ack?.({ ok: false, error: '会话已结束' });
        return;
      }

      const cleanType = msg_type === 'image' ? 'image' : 'text';
      const cleanContent = String(content || '').trim();
      if (!cleanContent) {
        ack?.({ ok: false, error: '消息不能为空' });
        return;
      }

      const message = addMessage(session.id, current.type, current.id, cleanType, cleanContent);
      io.to(`session:${session.id}`).emit('new_message', message);
      io.to(`agent:${session.agent_id}`).emit('session_updated', {
        session_id: session.id,
        last_message: message
      });
      ack?.({ ok: true, message });
    });

    socket.on('typing', ({ session_id }) => {
      const current = socket.data.actor;
      if (!current) return;
      socket.to(`session:${Number(session_id)}`).emit('typing', { sender_type: current.type });
    });

    socket.on('agent_logout', ({ agent_id }) => {
      if (actor?.type !== 'agent' || actor.id !== Number(agent_id)) return;
      db.prepare('UPDATE agents SET is_online = 0 WHERE id = ?').run(actor.id);
      io.emit('agent_status', { agent_id: actor.id, is_online: false });
    });

    socket.on('disconnect', () => {
      if (actor?.type === 'agent') {
        db.prepare('UPDATE agents SET is_online = 0 WHERE id = ?').run(actor.id);
        io.emit('agent_status', { agent_id: actor.id, is_online: false });
      }
    });
  });
}
