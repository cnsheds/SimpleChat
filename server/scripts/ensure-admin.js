import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { db } from '../src/db/index.js';

const username = String(process.env.DEFAULT_ADMIN_USERNAME || '').trim();
const password = String(process.env.DEFAULT_ADMIN_PASSWORD || '');
const displayName = String(process.env.DEFAULT_ADMIN_NAME || username).trim();

if (!username || !password || !displayName) {
  console.log('Default admin env is incomplete, skip creating default admin.');
} else {
  const existing = db.prepare('SELECT id FROM agents WHERE username = ?').get(username);
  if (existing) {
    console.log(`Default admin "${username}" already exists, skip.`);
  } else {
    db.prepare(
      `INSERT INTO agents (username, password, display_name, is_admin, is_disabled)
       VALUES (?, ?, ?, 1, 0)`
    ).run(username, bcrypt.hashSync(password, 12), displayName);
    console.log(`Default admin "${username}" created.`);
  }
}
