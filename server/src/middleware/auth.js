import { db } from '../db/index.js';
import { hashToken, verifyAgentToken } from '../services/token.js';

function bearerToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  return req.body?.token || req.query?.token || null;
}

export function getUserByToken(token) {
  if (!token) return null;
  const row = db
    .prepare(
      `SELECT id, identifier, display_name, token_expires_at
       FROM users
       WHERE session_token = ?`
    )
    .get(hashToken(token));

  if (!row || new Date(row.token_expires_at).getTime() < Date.now()) return null;
  return { type: 'user', id: row.id, ...row };
}

export function getAgentByToken(token) {
  if (!token) return null;
  try {
    const payload = verifyAgentToken(token);
    const agent = db
      .prepare(
        `SELECT id, username, display_name, is_admin, is_disabled
         FROM agents
         WHERE id = ?`
      )
      .get(Number(payload.agent_id));
    if (!agent || agent.is_disabled) return null;
    return {
      type: 'agent',
      id: agent.id,
      username: agent.username,
      display_name: agent.display_name,
      is_admin: Boolean(agent.is_admin)
    };
  } catch {
    return null;
  }
}

export function authenticateUser(req, res, next) {
  const user = getUserByToken(bearerToken(req));
  if (!user) return res.status(401).json({ error: '未登录或登录已过期' });
  req.actor = user;
  return next();
}

export function authenticateAgent(req, res, next) {
  const agent = getAgentByToken(bearerToken(req));
  if (!agent) return res.status(401).json({ error: '未登录或登录已过期' });
  req.actor = agent;
  return next();
}

export function authenticateAny(req, res, next) {
  const token = bearerToken(req);
  const actor = getAgentByToken(token) || getUserByToken(token);
  if (!actor) return res.status(401).json({ error: '未登录或登录已过期' });
  req.actor = actor;
  return next();
}

export function authenticateAdmin(req, res, next) {
  const agent = getAgentByToken(bearerToken(req));
  if (!agent) return res.status(401).json({ error: '未登录或登录已过期' });
  if (!agent.is_admin) return res.status(403).json({ error: '需要管理员权限' });
  req.actor = agent;
  return next();
}
