import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';

const uploadRoot = path.resolve(process.cwd(), 'uploads');
const allowed = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/gif', '.gif'],
  ['image/webp', '.webp']
]);

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    const month = new Date().toISOString().slice(0, 7);
    const dir = path.join(uploadRoot, month);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(_req, file, cb) {
    cb(null, `${uuidv4()}${allowed.get(file.mimetype)}`);
  }
});

export const upload = multer({
  storage,
  limits: {
    fileSize: Number(process.env.MAX_FILE_SIZE || 10 * 1024 * 1024)
  },
  fileFilter(_req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const expected = allowed.get(file.mimetype);
    if (!expected || (expected === '.jpg' ? !['.jpg', '.jpeg'].includes(ext) : ext !== expected)) {
      return cb(new Error('仅支持 jpg/png/gif/webp 图片'));
    }
    return cb(null, true);
  }
});
