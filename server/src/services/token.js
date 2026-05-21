import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

export function createOpaqueToken() {
  return uuidv4();
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function signAgentToken(agent) {
  return jwt.sign(
    {
      sub: String(agent.id),
      agent_id: agent.id,
      username: agent.username,
      display_name: agent.display_name,
      is_admin: Boolean(agent.is_admin)
    },
    process.env.JWT_SECRET || 'dev-jwt-secret-change-me',
    { expiresIn: '8h' }
  );
}

export function verifyAgentToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET || 'dev-jwt-secret-change-me');
}
