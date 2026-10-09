import { query } from '../config/database.js';

const mediaPath = (id) => `/api/v1/media/${id}`;
const unavailablePhoto = () => {
  const error = new Error('One or more uploaded photos are no longer available. Please upload them again.');
  error.statusCode = 422;
  error.expose = true;
  return error;
};

export async function create({ uploadedBy, userId = null, propertyId = null, messageId = null, ticketMessageId = null, filename, mimeType, buffer }) {
  const result = await query(
    `INSERT INTO media_files (uploaded_by, user_id, property_id, message_id, ticket_message_id, original_filename, mime_type, file_size, file_data)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [uploadedBy, userId, propertyId, messageId, ticketMessageId, filename, mimeType, buffer.length, buffer]
  );
  return { id: result.insertId, url: mediaPath(result.insertId) };
}

export async function assertPropertyPhotosAvailable(ids, propertyId, userId) {
  for (const id of [...new Set(ids)]) {
    const rows = await query(
      'SELECT uploaded_by, user_id, property_id, message_id, ticket_message_id FROM media_files WHERE id = ? LIMIT 1',
      [id]
    );
    const file = rows[0];
    const alreadyAttached = propertyId !== null && propertyId !== undefined
      && Number(file?.property_id) === Number(propertyId)
      && file.user_id === null && file.message_id === null && file.ticket_message_id === null;
    const stagedForUser = Number(file?.uploaded_by) === Number(userId) && file.user_id === null
      && file.property_id === null && file.message_id === null && file.ticket_message_id === null;
    if (!alreadyAttached && !stagedForUser) throw unavailablePhoto();
  }
}

export async function findAuthorized(id, user) {
  const rows = await query(
    `SELECT m.*, p.owner_id AS property_owner_id, p.status AS property_status,
      c.tenant_id AS conversation_tenant_id, c.owner_id AS conversation_owner_id,
      tm.is_internal AS ticket_is_internal, tm.ticket_id AS support_ticket_id
     FROM media_files m
     LEFT JOIN properties p ON p.id = m.property_id
     LEFT JOIN messages msg ON msg.id = m.message_id
     LEFT JOIN conversations c ON c.id = msg.conversation_id
     LEFT JOIN support_ticket_messages tm ON tm.id = m.ticket_message_id
     WHERE m.id = ? LIMIT 1`,
    [id]
  );
  const media = rows[0];
  if (!media) return null;
  if (media.user_id !== null) return media;
  if (media.property_id !== null) {
    return media.property_status === 'approved' || Number(media.property_owner_id) === Number(user.id) || user.role === 'admin' ? media : null;
  }
  if (media.message_id !== null) {
    return Number(media.conversation_tenant_id) === Number(user.id) || Number(media.conversation_owner_id) === Number(user.id) ? media : null;
  }
  if (media.ticket_message_id !== null) {
    const ticketColumns = await query('SHOW COLUMNS FROM support_tickets');
    const ownerColumn = ticketColumns.some((column) => column.Field === 'requester_id') ? 'requester_id' : 'user_id';
    const tickets = await query(`SELECT ${ownerColumn} AS ticket_owner_id FROM support_tickets WHERE id = ? LIMIT 1`, [media.support_ticket_id]);
    const ticketOwnerId = tickets[0]?.ticket_owner_id;
    if (Number(media.ticket_is_internal) && user.role !== 'admin') return null;
    return user.role === 'admin' || Number(ticketOwnerId) === Number(user.id) ? media : null;
  }
  return Number(media.uploaded_by) === Number(user.id) || user.role === 'admin' ? media : null;
}

export async function attachStagedToProperty(ids, propertyId, userId) {
  for (const id of [...new Set(ids)]) {
    const rows = await query(
      'SELECT id, uploaded_by, user_id, property_id, message_id, ticket_message_id FROM media_files WHERE id = ? LIMIT 1',
      [id]
    );
    const file = rows[0];
    const alreadyAttached = Number(file?.property_id) === Number(propertyId)
      && file.user_id === null && file.message_id === null && file.ticket_message_id === null;
    if (alreadyAttached) continue;
    if (!file || Number(file.uploaded_by) !== Number(userId) || file.user_id !== null || file.property_id !== null || file.message_id !== null || file.ticket_message_id !== null) {
      throw unavailablePhoto();
    }
    await query('UPDATE media_files SET property_id = ? WHERE id = ?', [propertyId, id]);
  }
}

export async function removePropertyPhotosNotIn(propertyId, keepIds) {
  const uniqueIds = [...new Set(keepIds)];
  if (!uniqueIds.length) {
    await query('DELETE FROM media_files WHERE property_id = ?', [propertyId]);
    return;
  }
  const placeholders = uniqueIds.map(() => '?').join(', ');
  await query(`DELETE FROM media_files WHERE property_id = ? AND id NOT IN (${placeholders})`, [propertyId, ...uniqueIds]);
}
