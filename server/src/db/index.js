import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.resolve(__dirname, '../../data');
const dbPath = path.join(dataDir, 'chat.db');

fs.mkdirSync(dataDir, { recursive: true });

export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

const agentColumns = db.prepare('PRAGMA table_info(agents)').all().map((column) => column.name);
if (!agentColumns.includes('is_disabled')) {
  db.exec('ALTER TABLE agents ADD COLUMN is_disabled INTEGER DEFAULT 0');
}

const userColumns = db.prepare('PRAGMA table_info(users)').all().map((column) => column.name);
if (!userColumns.includes('last_ip')) {
  db.exec('ALTER TABLE users ADD COLUMN last_ip TEXT');
}

export function toIsoDate(msFromNow = 0) {
  return new Date(Date.now() + msFromNow).toISOString();
}
