import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';

const uploadBaseDir = path.resolve('uploads');

function createUploadMiddleware(subfolder) {
  const uploadDir = path.join(uploadBaseDir, subfolder);
  fs.mkdirSync(uploadDir, { recursive: true });
  return multer({
    storage: multer.diskStorage({
      destination: (_request, _file, callback) => callback(null, uploadDir),
      filename: (_request, file, callback) => {
        const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '-');
        callback(null, `${Date.now()}-${safeName}`);
      }
    }),
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (_request, file, callback) => {
      if (file.mimetype.startsWith('image/')) callback(null, true);
      else callback(new Error('Only image uploads are allowed.'));
    }
  });
}

export const upload = createUploadMiddleware('properties');
export const uploadUser = createUploadMiddleware('users');
