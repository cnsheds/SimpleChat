import { db } from '../db/index.js';

export function addMessage(sessionId, senderType, senderId, msgType, content) {
  const result = db
    .prepare(
      `INSERT INTO messages (session_id, sender_type, sender_id, msg_type, content)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(sessionId, senderType, senderId, msgType, content);

  return db
    .prepare(
      `SELECT id, session_id, sender_type, sender_id, msg_type, content, created_at
       FROM messages
       WHERE id = ?`
    )
    .get(result.lastInsertRowid);
}

export function listMessages(sessionId, before, limit = 50) {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const rows = before
    ? db
        .prepare(
          `SELECT id, session_id, sender_type, sender_id, msg_type, content, created_at
           FROM messages
           WHERE session_id = ? AND is_deleted = 0 AND id < ?
           ORDER BY id DESC LIMIT ?`
        )
        .all(sessionId, before, safeLimit)
    : db
        .prepare(
          `SELECT id, session_id, sender_type, sender_id, msg_type, content, created_at
           FROM messages
           WHERE session_id = ? AND is_deleted = 0
           ORDER BY id DESC LIMIT ?`
        )
        .all(sessionId, safeLimit);

  return rows.reverse();
}
