import fs from 'node:fs';
import path from 'node:path';
import { db } from '../db/index.js';

const uploadRoot = path.resolve(process.cwd(), 'uploads');

export function listAvailableAgents() {
  return db
    .prepare(
      `SELECT id AS agent_id, display_name, avatar_url, is_online
       FROM agents
       WHERE is_disabled = 0
       ORDER BY is_online DESC, display_name`
    )
    .all()
    .map((agent) => ({
      ...agent,
      is_online: Boolean(agent.is_online)
    }));
}

export function listOnlineAgents() {
  return listAvailableAgents().filter((agent) => agent.is_online);
}

export function findSession(sessionId) {
  return db
    .prepare(
      `SELECT s.*, u.display_name AS user_display_name, u.identifier, u.last_ip, a.display_name AS agent_display_name
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       JOIN agents a ON a.id = s.agent_id
       WHERE s.id = ?`
    )
    .get(sessionId);
}

export function createOrGetSession(userId, agentId) {
  const existing = db
    .prepare(
      `SELECT id FROM sessions
       WHERE user_id = ? AND agent_id = ? AND status = 'active'
       ORDER BY id DESC LIMIT 1`
    )
    .get(userId, agentId);

  if (existing) return findSession(existing.id);

  const result = db
    .prepare('INSERT INTO sessions (user_id, agent_id) VALUES (?, ?)')
    .run(userId, agentId);
  return findSession(result.lastInsertRowid);
}

export function closeSession(sessionId) {
  db.prepare(
    `UPDATE sessions
     SET status = 'closed', closed_at = datetime('now')
     WHERE id = ?`
  ).run(sessionId);
  return findSession(sessionId);
}

export function clearMessages(sessionId) {
  db.prepare('UPDATE messages SET is_deleted = 1 WHERE session_id = ?').run(sessionId);
}

function localUploadPath(url) {
  if (!url || !url.startsWith('/uploads/')) return null;
  const relative = url.slice('/uploads/'.length).replace(/^[/\\]+/, '');
  const filePath = path.resolve(uploadRoot, relative);
  const rootWithSeparator = uploadRoot.endsWith(path.sep) ? uploadRoot : `${uploadRoot}${path.sep}`;
  if (!filePath.startsWith(rootWithSeparator)) return null;
  return filePath;
}

export function deleteSessionCompletely(sessionId) {
  const imageUrls = db
    .prepare(
      `SELECT DISTINCT content
       FROM messages
       WHERE session_id = ? AND msg_type = 'image' AND content LIKE '/uploads/%'`
    )
    .all(sessionId)
    .map((row) => row.content);

  const deleteRows = db.transaction(() => {
    db.prepare('DELETE FROM messages WHERE session_id = ?').run(sessionId);
    return db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
  });
  const result = deleteRows();

  for (const url of imageUrls) {
    const stillUsed = db.prepare('SELECT 1 FROM messages WHERE content = ? LIMIT 1').get(url);
    if (stillUsed) continue;
    const filePath = localUploadPath(url);
    if (!filePath) continue;
    try {
      fs.rmSync(filePath, { force: true });
    } catch (err) {
      console.warn(`Failed to delete uploaded file: ${filePath}`, err);
    }
  }

  return result.changes > 0;
}

export function listAgentSessions(agentId, status = 'active') {
  return db
    .prepare(
      `SELECT
         s.id AS session_id,
         s.status,
         s.created_at,
         s.closed_at,
         u.id AS user_id,
         u.display_name AS user_display_name,
         u.identifier,
         u.last_ip,
         (
           SELECT json_object(
             'id', m.id,
             'sender_type', m.sender_type,
             'msg_type', m.msg_type,
             'content', m.content,
             'created_at', m.created_at
           )
           FROM messages m
           WHERE m.session_id = s.id AND m.is_deleted = 0
           ORDER BY m.id DESC LIMIT 1
         ) AS last_message
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.agent_id = ? AND s.status = ?
       ORDER BY s.created_at DESC`
    )
    .all(agentId, status)
    .map((row) => ({
      ...row,
      user: {
        user_id: row.user_id,
        display_name: row.user_display_name,
        identifier: row.identifier,
        ip: row.last_ip
      },
      last_message: row.last_message ? JSON.parse(row.last_message) : null
    }));
}

export function canAccessSession(actor, session) {
  if (!actor || !session) return false;
  if (actor.type === 'user') return session.user_id === actor.id;
  if (actor.type === 'agent') return actor.is_admin || session.agent_id === actor.id;
  return false;
}
