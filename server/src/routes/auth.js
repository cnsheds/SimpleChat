import express from 'express';
import bcrypt from 'bcryptjs';
import { db, toIsoDate } from '../db/index.js';
import { authenticateAgent } from '../middleware/auth.js';
import { createInviteCode, verifyInviteCode } from '../services/invite.js';
import { createOpaqueToken, hashToken, signAgentToken } from '../services/token.js';
import {
  checkAgentRateLimit,
  checkInviteRateLimit,
  clearAgentFailure,
  clearInviteFailure,
  recordAgentFailure,
  recordInviteFailure
} from '../services/rateLimit.js';

const router = express.Router();
const fakeHash = bcrypt.hashSync('not-the-password', 12);

function publicSiteUrl() {
  return String(process.env.SITE_URL || '').trim().replace(/\/+$/, '');
}

router.post('/user-login', (req, res) => {
  const ip = req.ip;
  const limited = checkInviteRateLimit(ip);
  if (limited.blocked) {
    return res.status(429).json({ error: '尝试次数过多，请稍后再试', remaining: limited.remaining });
  }

  const { invite_code, identifier, display_name } = req.body;
  const cleanIdentifier = String(identifier || '').trim();
  if (!cleanIdentifier) return res.status(400).json({ error: '请输入手机号或昵称' });

  if (!verifyInviteCode(invite_code)) {
    recordInviteFailure(ip);
    return res.status(401).json({ error: '验证码无效' });
  }

  clearInviteFailure(ip);
  const existing = db.prepare('SELECT * FROM users WHERE identifier = ?').get(cleanIdentifier);
  const name = String(display_name || cleanIdentifier).trim();
  let user = existing;
  let isNewUser = false;

  if (!user) {
    const result = db
      .prepare("INSERT INTO users (identifier, display_name, last_seen_at, last_ip) VALUES (?, ?, datetime('now'), ?)")
      .run(cleanIdentifier, name, ip);
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
    isNewUser = true;
  } else if (name && name !== user.display_name) {
    db.prepare("UPDATE users SET display_name = ?, last_seen_at = datetime('now'), last_ip = ? WHERE id = ?").run(name, ip, user.id);
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  }

  const token = createOpaqueToken();
  db.prepare("UPDATE users SET session_token = ?, token_expires_at = ?, last_seen_at = datetime('now'), last_ip = ? WHERE id = ?").run(
    hashToken(token),
    toIsoDate(30 * 24 * 60 * 60 * 1000),
    ip,
    user.id
  );

  return res.json({
    token,
    user_id: user.id,
    display_name: user.display_name,
    is_new_user: isNewUser
  });
});

router.post('/verify-token', (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ valid: false });
  const user = db
    .prepare('SELECT id, display_name, token_expires_at FROM users WHERE session_token = ?')
    .get(hashToken(token));

  if (!user || new Date(user.token_expires_at).getTime() < Date.now()) {
    return res.status(401).json({ valid: false });
  }

  db.prepare("UPDATE users SET last_seen_at = datetime('now') WHERE id = ?").run(user.id);
  return res.json({ valid: true, user_id: user.id, display_name: user.display_name });
});

router.post('/agent-login', (req, res) => {
  const ip = req.ip;
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');
  const limited = checkAgentRateLimit(ip, username || 'unknown');
  if (limited.blocked) {
    return res.status(429).json({ error: '尝试次数过多，请稍后再试', remaining: limited.remaining });
  }

  const agent = db.prepare('SELECT * FROM agents WHERE username = ?').get(username);
  const ok = bcrypt.compareSync(password, agent?.password || fakeHash);
  if (!agent || agent.is_disabled || !ok) {
    recordAgentFailure(ip, username || 'unknown');
    return res.status(401).json({ error: '账号或密码错误' });
  }

  clearAgentFailure(ip, username);
  db.prepare('UPDATE agents SET is_online = 1 WHERE id = ?').run(agent.id);

  return res.json({
    token: signAgentToken(agent),
    agent_id: agent.id,
    display_name: agent.display_name,
    is_admin: Boolean(agent.is_admin)
  });
});

router.post('/agent-logout', authenticateAgent, (req, res) => {
  db.prepare('UPDATE agents SET is_online = 0 WHERE id = ?').run(req.actor.id);
  return res.json({ success: true });
});

router.get('/invite-link', authenticateAgent, (req, res) => {
  const siteUrl = publicSiteUrl();
  if (!siteUrl) return res.status(500).json({ error: '未配置 SITE_URL' });

  const invite = createInviteCode(req.actor.id);
  const url = new URL(siteUrl);
  url.searchParams.set('invite_code', invite.code);
  return res.json({ code: invite.code, expires_at: invite.expires_at, url: url.toString() });
});

export default router;
