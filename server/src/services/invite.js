import crypto from 'node:crypto';

const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
const invites = new Map();
const cleanupMs = 10 * 60 * 1000;

function inviteTtlMs() {
  const minutes = Number(process.env.INVITE_TTL_MINUTES || 120);
  const safeMinutes = Number.isFinite(minutes) && minutes > 0 ? minutes : 120;
  return safeMinutes * 60 * 1000;
}

function cleanupExpiredInvites() {
  const now = Date.now();
  for (const [code, invite] of invites.entries()) {
    if (invite.expiresAt <= now) invites.delete(code);
  }
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
  while (invites.has(code)) code = randomCode();

  const expiresAt = Date.now() + inviteTtlMs();
  invites.set(code, { agentId, expiresAt });
  return {
    code,
    expires_at: new Date(expiresAt).toISOString()
  };
}

export function verifyInviteCode(code) {
  cleanupExpiredInvites();
  const cleanCode = String(code || '').trim();
  const invite = invites.get(cleanCode);
  return Boolean(invite && invite.expiresAt > Date.now());
}

setInterval(cleanupExpiredInvites, cleanupMs).unref();
