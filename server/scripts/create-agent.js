import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { db } from '../src/db/index.js';

function readArg(name) {
  const index = process.argv.indexOf(`--${name}`);
  if (index >= 0) return process.argv[index + 1];
  const envValue = process.env[`npm_config_${name.replaceAll('-', '_')}`];
  return envValue && envValue !== 'true' ? envValue : null;
}

const username = readArg('username');
const password = readArg('password');
const displayName = readArg('name') || username;
const isAdmin = readArg('admin') === 'true' ? 1 : 0;

if (!username || !password || !displayName) {
  console.error('Usage: node scripts/create-agent.js --username admin --password secret --name "客服小王" [--admin true]');
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 12);
db.prepare(
  `INSERT INTO agents (username, password, display_name, is_admin)
   VALUES (?, ?, ?, ?)
   ON CONFLICT(username) DO UPDATE SET
     password = excluded.password,
     display_name = excluded.display_name,
     is_admin = excluded.is_admin,
     is_disabled = 0`
).run(username, hash, displayName, isAdmin);

console.log(`Agent "${username}" saved.`);
