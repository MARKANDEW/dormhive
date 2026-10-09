import path from 'node:path';
import { TextDecoder } from 'node:util';

const MIME_TYPES = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  text: 'text/plain'
};

export function detectMimeType(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) return null;
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return MIME_TYPES.jpeg;
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return MIME_TYPES.png;
  if (buffer.length >= 6 && ['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('ascii'))) return MIME_TYPES.gif;
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return MIME_TYPES.webp;
  if (buffer.length >= 5 && buffer.toString('ascii', 0, 5) === '%PDF-') return MIME_TYPES.pdf;
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))) return MIME_TYPES.doc;

  if (buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && [0x03, 0x05, 0x07].includes(buffer[2]) && [0x04, 0x06, 0x08].includes(buffer[3])) {
    const archiveContents = buffer.toString('latin1');
    if (archiveContents.includes('[Content_Types].xml') && archiveContents.includes('word/document.xml')) return MIME_TYPES.docx;
    return null;
  }

  if (buffer.includes(0)) return null;
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    return MIME_TYPES.text;
  } catch {
    return null;
  }
}

export function validateUpload(file, { imagesOnly = false } = {}) {
  if (!file?.buffer) {
    const error = new Error('An uploaded file is required.');
    error.statusCode = 422;
    error.expose = true;
    throw error;
  }

  const mimeType = detectMimeType(file.buffer);
  const allowed = imagesOnly
    ? [MIME_TYPES.jpeg, MIME_TYPES.png, MIME_TYPES.gif, MIME_TYPES.webp]
    : Object.values(MIME_TYPES);
  if (!mimeType || !allowed.includes(mimeType)) {
    const error = new Error(imagesOnly ? 'Only valid JPEG, PNG, GIF, or WEBP images are allowed.' : 'Unsupported or invalid attachment file.');
    error.statusCode = 422;
    error.expose = true;
    throw error;
  }
  if (file.mimetype && file.mimetype !== 'application/octet-stream' && file.mimetype !== mimeType) {
    const error = new Error('The uploaded file content does not match its declared type.');
    error.statusCode = 422;
    error.expose = true;
    throw error;
  }

  return {
    mimeType,
    filename: path.basename(String(file.originalname || 'upload').replace(/[\\/]/g, '-')).replace(/[\u0000-\u001f\u007f"]/g, '').slice(0, 255) || 'upload'
  };
}
