import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pool from '../core/config/database.js';
import { query } from '../core/config/database.js';
import * as mediaFiles from '../core/models/Media.js';
import { detectMimeType } from '../core/utils/fileValidation.js';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const uploadsRoot = path.join(backendRoot, 'core', 'uploads');
const counts = { avatars: 0, propertyPhotos: 0, supportAttachments: 0, messagePhotos: 0, skipped: 0, failed: 0 };

function parseImages(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [value];
  } catch {
    return [value];
  }
}

function legacyUploadPath(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  let pathname = value.trim();
  if (/^https?:\/\//i.test(pathname)) {
    try { pathname = new URL(pathname).pathname; } catch { return null; }
  }
  pathname = decodeURIComponent(pathname.replace(/\\/g, '/')).replace(/^\/+/, '');
  if (!pathname.startsWith('uploads/')) return null;
  const relativePath = pathname.slice('uploads/'.length);
  const fullPath = path.resolve(uploadsRoot, relativePath);
  const relative = path.relative(uploadsRoot, fullPath);
  if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error('The stored upload path resolves outside backend/core/uploads.');
  }
  return fullPath;
}

async function readLegacyFile(value, { imagesOnly = false } = {}) {
  const filePath = legacyUploadPath(value);
  if (!filePath) return null;
  const buffer = await fs.readFile(filePath);
  const mimeType = detectMimeType(buffer);
  const allowed = imagesOnly
    ? ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    : ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
  if (!mimeType || !allowed.includes(mimeType)) throw new Error(`Unsupported file content at ${path.relative(uploadsRoot, filePath)}.`);
  return {
    buffer,
    mimeType,
    filename: path.basename(filePath).replace(/[\u0000-\u001f\u007f"]/g, '').slice(0, 255) || 'upload'
  };
}

async function saveLegacyReference(value, association, { imagesOnly = false } = {}) {
  const file = await readLegacyFile(value, { imagesOnly });
  if (!file) return value;
  const stored = await mediaFiles.create({ ...association, ...file });
  return stored.url;
}

function decodeLegacyMessageImage(value) {
  const match = String(value).match(/^data:(image\/(?:jpeg|png|gif|webp));base64,([\s\S]+)$/i);
  if (!match) return null;
  const buffer = Buffer.from(match[2].replace(/\s/g, ''), 'base64');
  const mimeType = detectMimeType(buffer);
  if (!mimeType || mimeType !== match[1].toLowerCase()) throw new Error('A legacy message photo did not match its declared image type.');
  const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp' }[mimeType];
  return { buffer, mimeType, filename: `message-${extension}` };
}

async function run() {
  const users = await query("SELECT id, avatar_url FROM users WHERE avatar_url LIKE '%uploads/%'");
  for (const user of users) {
    try {
      const url = await saveLegacyReference(user.avatar_url, { uploadedBy: user.id, userId: user.id }, { imagesOnly: true });
      if (url === user.avatar_url) counts.skipped += 1;
      else {
        await query('UPDATE users SET avatar_url = ? WHERE id = ?', [url, user.id]);
        counts.avatars += 1;
      }
    } catch (error) {
      counts.failed += 1;
      console.error(`Avatar user ${user.id} was left unchanged: ${error.message}`);
    }
  }

  const properties = await query('SELECT id, owner_id, image_url, images FROM properties');
  for (const property of properties) {
    try {
      const originalImages = parseImages(property.images);
      const convertedImages = [];
      const propertyPaths = new Map();
      const convertPropertyImage = async (value) => {
        if (typeof value !== 'string') return value;
        if (propertyPaths.has(value)) return propertyPaths.get(value);
        const converted = await saveLegacyReference(value, { uploadedBy: property.owner_id, propertyId: property.id }, { imagesOnly: true });
        propertyPaths.set(value, converted);
        return converted;
      };
      for (const image of originalImages) {
        if (typeof image === 'string') {
          convertedImages.push(await convertPropertyImage(image));
        } else if (image && typeof image === 'object') {
          const key = typeof image.url === 'string' ? 'url' : typeof image.image_url === 'string' ? 'image_url' : null;
          convertedImages.push(key
            ? { ...image, [key]: await convertPropertyImage(image[key]) }
            : image);
        } else {
          convertedImages.push(image);
        }
      }
      const imageUrl = await convertPropertyImage(property.image_url);
      const changed = imageUrl !== property.image_url || JSON.stringify(convertedImages) !== JSON.stringify(originalImages);
      if (changed) {
        await query('UPDATE properties SET image_url = ?, images = ? WHERE id = ?', [imageUrl, JSON.stringify(convertedImages), property.id]);
        counts.propertyPhotos += convertedImages.filter((image, index) => image !== originalImages[index]).length + (imageUrl !== property.image_url ? 1 : 0);
      }
    } catch (error) {
      counts.failed += 1;
      console.error(`Property ${property.id} photos were left unchanged: ${error.message}`);
    }
  }

  const ticketMessages = await query("SELECT id, sender_id, attachment_url FROM support_ticket_messages WHERE attachment_url LIKE '%uploads/%'");
  for (const message of ticketMessages) {
    try {
      const url = await saveLegacyReference(message.attachment_url, { uploadedBy: message.sender_id, ticketMessageId: message.id });
      if (url === message.attachment_url) counts.skipped += 1;
      else {
        await query('UPDATE support_ticket_messages SET attachment_url = ? WHERE id = ?', [url, message.id]);
        counts.supportAttachments += 1;
      }
    } catch (error) {
      counts.failed += 1;
      console.error(`Ticket message ${message.id} attachment was left unchanged: ${error.message}`);
    }
  }

  const legacyMessages = await query("SELECT id, sender_id, body FROM messages WHERE body LIKE 'data:image/%'");
  for (const message of legacyMessages) {
    try {
      const file = decodeLegacyMessageImage(message.body);
      if (!file) {
        counts.skipped += 1;
        continue;
      }
      const stored = await mediaFiles.create({ uploadedBy: message.sender_id, messageId: message.id, ...file });
      await query("UPDATE messages SET body = '' WHERE id = ?", [message.id]);
      counts.messagePhotos += 1;
      console.info(`Message ${message.id} photo moved to ${stored.url}.`);
    } catch (error) {
      counts.failed += 1;
      console.error(`Message ${message.id} photo was left unchanged: ${error.message}`);
    }
  }

  console.info('Media backfill summary:', counts);
  if (counts.failed) process.exitCode = 1;
}

try {
  await run();
} finally {
  await pool.end();
}
