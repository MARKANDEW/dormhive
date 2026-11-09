import multer from 'multer';

function createUploadMiddleware(maxFileSize = 2 * 1024 * 1024) {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxFileSize }
  });
}

export const upload = createUploadMiddleware();
export const uploadUser = createUploadMiddleware();
export const uploadIdentityDocument = createUploadMiddleware(5 * 1024 * 1024);
export const uploadRegistrationDocuments = uploadIdentityDocument.fields([
  { name: 'identityDocument', maxCount: 1 },
  { name: 'selfie', maxCount: 1 }
]);
export const uploadProperty = createUploadMiddleware(5 * 1024 * 1024);
export const uploadMessage = createUploadMiddleware();
export const uploadSupport = createUploadMiddleware();
