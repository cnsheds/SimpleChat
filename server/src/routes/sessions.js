import express from 'express';
import { db } from '../db/index.js';
import { authenticateAgent, authenticateAny, authenticateUser } from '../middleware/auth.js';
import { listMessages } from '../services/message.js';
import {
  canAccessSession,
  closeSession,
  createOrGetSession,
  deleteSessionCompletely,
  findSession,
  listAvailableAgents,
  listAgentSessions,
  listOnlineAgents
} from '../services/session.js';

const router = express.Router();

router.get('/agents/online', (_req, res) => {
  return res.json(listOnlineAgents());
});

router.get('/agents', (_req, res) => {
  return res.json(listAvailableAgents());
});

router.post('/sessions', authenticateUser, (req, res) => {
  const agentId = Number(req.body.agent_id);
  const agent = db.prepare('SELECT id, display_name, is_online, is_disabled FROM agents WHERE id = ?').get(agentId);
  if (!agent) return res.status(404).json({ error: '客服不存在' });
  if (agent.is_disabled) return res.status(403).json({ error: '该客服暂不可用' });

  db.prepare("UPDATE users SET last_seen_at = datetime('now'), last_ip = ? WHERE id = ?").run(req.ip, req.actor.id);
  const session = createOrGetSession(req.actor.id, agentId);
  req.app.get('io')?.to(`agent:${agentId}`).emit('new_session', {
    session_id: session.id,
    user: {
      user_id: session.user_id,
      display_name: session.user_display_name,
      identifier: session.identifier
    }
  });

  return res.json({ session_id: session.id, agent });
});

router.get('/sessions/:id/messages', authenticateAny, (req, res) => {
  const session = findSession(Number(req.params.id));
  if (!canAccessSession(req.actor, session)) return res.status(403).json({ error: '无权访问该会话' });
  return res.json(listMessages(session.id, req.query.before, req.query.limit));
});

router.post('/sessions/:id/close', authenticateAgent, (req, res) => {
  const session = findSession(Number(req.params.id));
  if (!canAccessSession(req.actor, session)) return res.status(403).json({ error: '无权访问该会话' });
  const closed = closeSession(session.id);
  req.app.get('io')?.to(`session:${session.id}`).emit('session_closed', { session_id: session.id });
  return res.json({ success: true, session: closed });
});

router.delete('/sessions/:id/messages', authenticateAgent, (req, res) => {
  const session = findSession(Number(req.params.id));
  if (!canAccessSession(req.actor, session)) return res.status(403).json({ error: '无权访问该会话' });
  deleteSessionCompletely(session.id);
  const io = req.app.get('io');
  io?.to(`session:${session.id}`).emit('session_deleted', { session_id: session.id });
  io?.to(`agent:${session.agent_id}`).emit('session_deleted', { session_id: session.id });
  return res.json({ success: true });
});

router.get('/agent/sessions', authenticateAgent, (req, res) => {
  const status = req.query.status === 'closed' ? 'closed' : 'active';
  return res.json(listAgentSessions(req.actor.id, status));
});

export default router;
