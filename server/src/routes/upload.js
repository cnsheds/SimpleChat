import express from 'express';
import { authenticateAny } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';

const router = express.Router();

router.post('/upload', authenticateAny, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '请选择图片文件' });
  const parts = req.file.path.replace(/\\/g, '/').split('/uploads/');
  return res.json({ url: `/uploads/${parts[1]}` });
});

export default router;
