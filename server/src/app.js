import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import http from 'node:http';
import { Server } from 'socket.io';
import './db/index.js';
import authRoutes from './routes/auth.js';
import sessionRoutes from './routes/sessions.js';
import uploadRoutes from './routes/upload.js';
import adminRoutes from './routes/admin.js';
import { registerSocketHandlers } from './socket.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: true,
    credentials: true
  }
});

app.set('trust proxy', true);
app.set('io', io);
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', sessionRoutes);
app.use('/api', uploadRoutes);

registerSocketHandlers(io);

const publicDir = path.resolve(__dirname, '../public');
const userDir = path.join(publicDir, 'user');
const agentDir = path.join(publicDir, 'agent');

app.use('/agent', express.static(agentDir));
app.get('/agent/*', (_req, res) => res.sendFile(path.join(agentDir, 'index.html')));
app.use(express.static(userDir));
app.get('*', (_req, res) => res.sendFile(path.join(userDir, 'index.html')));

const port = Number(process.env.PORT || 3000);
server.listen(port, () => {
  console.log(`SimpleChat server listening on http://localhost:${port}`);
});
