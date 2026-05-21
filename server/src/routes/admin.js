import express from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db/index.js';
import { authenticateAdmin } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateAdmin);

function cleanText(value) {
  return String(value || '').trim();
}

function enabledAdminCount(excludeId = null) {
  if (excludeId) {
    return db
      .prepare('SELECT COUNT(*) AS count FROM agents WHERE is_admin = 1 AND is_disabled = 0 AND id != ?')
      .get(excludeId).count;
  }
  return db.prepare('SELECT COUNT(*) AS count FROM agents WHERE is_admin = 1 AND is_disabled = 0').get().count;
}

function agentList() {
  return db
    .prepare(
      `SELECT
         a.id,
         a.username,
         a.display_name,
         a.avatar_url,
         a.is_online,
         a.is_admin,
         a.is_disabled,
         a.created_at,
         COUNT(s.id) AS session_count
       FROM agents a
       LEFT JOIN sessions s ON s.agent_id = a.id
       GROUP BY a.id
       ORDER BY a.id DESC`
    )
    .all()
    .map((agent) => ({
      ...agent,
      is_online: Boolean(agent.is_online),
      is_admin: Boolean(agent.is_admin),
      is_disabled: Boolean(agent.is_disabled)
    }));
}

router.get('/agents', (_req, res) => {
  return res.json(agentList());
});

router.post('/agents', (req, res) => {
  const username = cleanText(req.body.username);
  const password = String(req.body.password || '');
  const displayName = cleanText(req.body.display_name);
  const isAdmin = req.body.is_admin ? 1 : 0;

  if (!username || !password || !displayName) {
    return res.status(400).json({ error: '账号、密码和显示名称不能为空' });
  }

  try {
    const hash = bcrypt.hashSync(password, 12);
    const result = db
      .prepare(
        `INSERT INTO agents (username, password, display_name, is_admin, is_disabled)
         VALUES (?, ?, ?, ?, 0)`
      )
      .run(username, hash, displayName, isAdmin);
    return res.status(201).json({ agent: agentList().find((agent) => agent.id === result.lastInsertRowid) });
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      return res.status(409).json({ error: '账号已存在' });
    }
    throw err;
  }
});

router.patch('/agents/:id', (req, res) => {
  const id = Number(req.params.id);
  const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(id);
  if (!agent) return res.status(404).json({ error: '客服不存在' });

  const nextIsAdmin = req.body.is_admin === undefined ? Boolean(agent.is_admin) : Boolean(req.body.is_admin);
  const nextDisabled = req.body.is_disabled === undefined ? Boolean(agent.is_disabled) : Boolean(req.body.is_disabled);
  if (agent.is_admin && (!nextIsAdmin || nextDisabled) && enabledAdminCount(id) < 1) {
    return res.status(400).json({ error: '至少保留一个启用状态的管理员' });
  }

  const username = req.body.username === undefined ? agent.username : cleanText(req.body.username);
  const displayName = req.body.display_name === undefined ? agent.display_name : cleanText(req.body.display_name);
  const password = String(req.body.password || '');
  if (!username || !displayName) return res.status(400).json({ error: '账号和显示名称不能为空' });

  try {
    if (password) {
      db.prepare(
        `UPDATE agents
         SET username = ?, password = ?, display_name = ?, is_admin = ?, is_disabled = ?, is_online = CASE WHEN ? = 1 THEN 0 ELSE is_online END
         WHERE id = ?`
      ).run(username, bcrypt.hashSync(password, 12), displayName, nextIsAdmin ? 1 : 0, nextDisabled ? 1 : 0, nextDisabled ? 1 : 0, id);
    } else {
      db.prepare(
        `UPDATE agents
         SET username = ?, display_name = ?, is_admin = ?, is_disabled = ?, is_online = CASE WHEN ? = 1 THEN 0 ELSE is_online END
         WHERE id = ?`
      ).run(username, displayName, nextIsAdmin ? 1 : 0, nextDisabled ? 1 : 0, nextDisabled ? 1 : 0, id);
    }
    return res.json({ agent: agentList().find((item) => item.id === id) });
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      return res.status(409).json({ error: '账号已存在' });
    }
    throw err;
  }
});

router.delete('/agents/:id', (req, res) => {
  const id = Number(req.params.id);
  const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(id);
  if (!agent) return res.status(404).json({ error: '客服不存在' });
  if (agent.is_admin && enabledAdminCount(id) < 1) {
    return res.status(400).json({ error: '至少保留一个启用状态的管理员' });
  }

  const sessionCount = db.prepare('SELECT COUNT(*) AS count FROM sessions WHERE agent_id = ?').get(id).count;
  if (sessionCount > 0) {
    return res.status(409).json({ error: '该客服已有会话记录，请改用禁用' });
  }

  db.prepare('DELETE FROM agents WHERE id = ?').run(id);
  return res.json({ success: true });
});

export default router;
