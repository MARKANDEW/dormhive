import multer from 'multer';

function createUploadMiddleware() {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024 }
  });
}

export const upload = createUploadMiddleware();
export const uploadUser = createUploadMiddleware();
export const uploadMessage = createUploadMiddleware();
export const uploadSupport = createUploadMiddleware();
