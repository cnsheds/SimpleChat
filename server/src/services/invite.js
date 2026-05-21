import crypto from 'node:crypto';
import { db } from '../db/index.js';

const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
const cleanupMs = 10 * 60 * 1000;

function inviteTtlMs() {
  const minutes = Number(process.env.INVITE_TTL_MINUTES || 120);
  const safeMinutes = Number.isFinite(minutes) && minutes > 0 ? minutes : 120;
  return safeMinutes * 60 * 1000;
}

function cleanupExpiredInvites() {
  db.prepare('DELETE FROM invite_codes WHERE expires_at <= ?').run(new Date().toISOString());
}

function randomCode() {
  let code = '';
  for (let index = 0; index < 8; index += 1) {
    code += alphabet[crypto.randomInt(alphabet.length)];
  }
  return code;
}

export function createInviteCode(agentId) {
  cleanupExpiredInvites();

  let code = randomCode();
  while (db.prepare('SELECT 1 FROM invite_codes WHERE code = ?').get(code)) code = randomCode();

  const expiresAt = Date.now() + inviteTtlMs();
  db.prepare('INSERT INTO invite_codes (code, agent_id, expires_at) VALUES (?, ?, ?)').run(
    code,
    agentId,
    new Date(expiresAt).toISOString()
  );
  return {
    code,
    expires_at: new Date(expiresAt).toISOString()
  };
}

export function verifyInviteCode(code) {
  cleanupExpiredInvites();
  const cleanCode = String(code || '').trim();
  const invite = db.prepare('SELECT expires_at FROM invite_codes WHERE code = ?').get(cleanCode);
  return Boolean(invite && new Date(invite.expires_at).getTime() > Date.now());
}

setInterval(cleanupExpiredInvites, cleanupMs).unref();
