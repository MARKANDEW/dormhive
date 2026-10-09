import { query } from '../config/database.js';
import * as mediaFiles from './Media.js';

export async function conversationsFor(user) {
  return query(`SELECT c.*, CASE WHEN c.tenant_id=? THEN COALESCE(NULLIF(TRIM(CONCAT_WS(' ', o.first_name, o.last_name)), ''), NULLIF(TRIM(o.name), '')) ELSE COALESCE(NULLIF(TRIM(CONCAT_WS(' ', t.first_name, t.last_name)), ''), NULLIF(TRIM(t.name), '')) END participant_name, CASE WHEN c.tenant_id=? THEN o.avatar_url ELSE t.avatar_url END participant_avatar_url, (SELECT CASE WHEN m.body = '' AND EXISTS (SELECT 1 FROM media_files mf WHERE mf.message_id=m.id) THEN 'Photo' ELSE m.body END FROM messages m WHERE m.conversation_id=c.id ORDER BY m.created_at DESC LIMIT 1) last_message, (SELECT COUNT(*) FROM messages m WHERE m.conversation_id=c.id AND m.sender_id<>? AND m.read_at IS NULL) unread_count FROM conversations c JOIN users t ON t.id=c.tenant_id JOIN users o ON o.id=c.owner_id WHERE (c.tenant_id=? OR c.owner_id=?) AND EXISTS (SELECT 1 FROM messages m WHERE m.conversation_id=c.id) ORDER BY c.updated_at DESC`, [user.id, user.id, user.id, user.id, user.id]);
}

export async function conversationSummaryFor(id, user) {
  const rows = await query(`SELECT c.*, CASE WHEN c.tenant_id=? THEN COALESCE(NULLIF(TRIM(CONCAT_WS(' ', o.first_name, o.last_name)), ''), NULLIF(TRIM(o.name), '')) ELSE COALESCE(NULLIF(TRIM(CONCAT_WS(' ', t.first_name, t.last_name)), ''), NULLIF(TRIM(t.name), '')) END participant_name, CASE WHEN c.tenant_id=? THEN o.avatar_url ELSE t.avatar_url END participant_avatar_url, (SELECT CASE WHEN m.body = '' AND EXISTS (SELECT 1 FROM media_files mf WHERE mf.message_id=m.id) THEN 'Photo' ELSE m.body END FROM messages m WHERE m.conversation_id=c.id ORDER BY m.created_at DESC LIMIT 1) last_message, (SELECT COUNT(*) FROM messages m WHERE m.conversation_id=c.id AND m.sender_id<>? AND m.read_at IS NULL) unread_count FROM conversations c JOIN users t ON t.id=c.tenant_id JOIN users o ON o.id=c.owner_id WHERE c.id=? AND (c.tenant_id=? OR c.owner_id=?) LIMIT 1`, [user.id, user.id, user.id, id, user.id, user.id]);
  return rows[0] ?? null;
}

export async function conversationFor(id, user) {
  const rows = await query('SELECT * FROM conversations WHERE id=? AND (tenant_id=? OR owner_id=?) LIMIT 1', [id, user.id, user.id]);
  return rows[0] ?? null;
}

export function history(id) {
  return query(`SELECT msg.id, msg.conversation_id, msg.sender_id,
      CASE WHEN msg.body LIKE 'data:image/%' THEN '[Photo]' ELSE msg.body END AS body,
      msg.read_at, msg.created_at,
      CASE WHEN media.id IS NOT NULL THEN CONCAT('/api/v1/media/', media.id) END AS attachment_url,
      media.original_filename AS attachment_name, media.mime_type AS attachment_mime_type
    FROM messages msg LEFT JOIN media_files media ON media.message_id = msg.id
    WHERE msg.conversation_id = ? ORDER BY msg.created_at ASC`, [id]);
}

export async function createConversation({ tenantId, ownerId, propertyId = null }) {
  const existing = await query('SELECT * FROM conversations WHERE tenant_id=? AND owner_id=? AND property_id <=> ? LIMIT 1', [tenantId, ownerId, propertyId]);
  if (existing[0]) return existing[0];
  const result = await query('INSERT INTO conversations (tenant_id, owner_id, property_id) VALUES (?, ?, ?)', [tenantId, ownerId, propertyId]);
  const rows = await query('SELECT * FROM conversations WHERE id=?', [result.insertId]);
  return rows[0];
}

export async function send(conversationId, senderId, body, attachment = null) {
  const result = await query('INSERT INTO messages (conversation_id, sender_id, body) VALUES (?,?,?)', [conversationId, senderId, body]);
  await query('UPDATE conversations SET updated_at=CURRENT_TIMESTAMP WHERE id=?', [conversationId]);
  if (attachment) {
    await mediaFiles.create({
      uploadedBy: senderId,
      messageId: result.insertId,
      filename: attachment.filename,
      mimeType: attachment.mimeType,
      buffer: attachment.buffer
    });
  }
  const rows = await query('SELECT * FROM messages WHERE id=?', [result.insertId]);
  const files = attachment ? await query('SELECT id, original_filename, mime_type FROM media_files WHERE message_id = ? LIMIT 1', [result.insertId]) : [];
  return {
    ...rows[0],
    attachment_url: files[0] ? `/api/v1/media/${files[0].id}` : null,
    attachment_name: files[0]?.original_filename ?? null,
    attachment_mime_type: files[0]?.mime_type ?? null
  };
}

export function markRead(conversationId, userId) { return query('UPDATE messages SET read_at=CURRENT_TIMESTAMP WHERE conversation_id=? AND sender_id<>? AND read_at IS NULL', [conversationId, userId]); }

export async function remove(id, userId) {
  const result = await query('DELETE FROM messages WHERE id=? AND sender_id=?', [id, userId]);
  return result.affectedRows;
}
