import { query } from '../config/database.js';

export async function conversationsFor(user) {
  return query(`SELECT c.*, CASE WHEN c.tenant_id=? THEN COALESCE(CONCAT_WS(' ', o.first_name, o.last_name), o.name) ELSE COALESCE(CONCAT_WS(' ', t.first_name, t.last_name), t.name) END participant_name, CASE WHEN c.tenant_id=? THEN o.avatar_url ELSE t.avatar_url END participant_avatar_url, (SELECT m.body FROM messages m WHERE m.conversation_id=c.id ORDER BY m.created_at DESC LIMIT 1) last_message, (SELECT COUNT(*) FROM messages m WHERE m.conversation_id=c.id AND m.sender_id<>? AND m.read_at IS NULL) unread_count FROM conversations c JOIN users t ON t.id=c.tenant_id JOIN users o ON o.id=c.owner_id WHERE c.tenant_id=? OR c.owner_id=? ORDER BY c.updated_at DESC`, [user.id, user.id, user.id, user.id, user.id]);
}

export async function conversationFor(id, user) {
  const rows = await query('SELECT * FROM conversations WHERE id=? AND (tenant_id=? OR owner_id=?) LIMIT 1', [id, user.id, user.id]);
  return rows[0] ?? null;
}

export function history(id) { return query('SELECT * FROM messages WHERE conversation_id=? ORDER BY created_at ASC', [id]); }

export async function createConversation({ tenantId, ownerId, propertyId = null }) {
  const existing = await query('SELECT * FROM conversations WHERE tenant_id=? AND owner_id=? AND property_id <=> ? LIMIT 1', [tenantId, ownerId, propertyId]);
  if (existing[0]) return existing[0];
  const result = await query('INSERT INTO conversations (tenant_id, owner_id, property_id) VALUES (?, ?, ?)', [tenantId, ownerId, propertyId]);
  const rows = await query('SELECT * FROM conversations WHERE id=?', [result.insertId]);
  return rows[0];
}

export async function send(conversationId, senderId, body) {
  const result = await query('INSERT INTO messages (conversation_id, sender_id, body) VALUES (?,?,?)', [conversationId, senderId, body]);
  await query('UPDATE conversations SET updated_at=CURRENT_TIMESTAMP WHERE id=?', [conversationId]);
  const rows = await query('SELECT * FROM messages WHERE id=?', [result.insertId]);
  return rows[0];
}

export function markRead(conversationId, userId) { return query('UPDATE messages SET read_at=CURRENT_TIMESTAMP WHERE conversation_id=? AND sender_id<>? AND read_at IS NULL', [conversationId, userId]); }

export async function remove(id, userId) {
  const result = await query('DELETE FROM messages WHERE id=? AND sender_id=?', [id, userId]);
  return result.affectedRows;
}
