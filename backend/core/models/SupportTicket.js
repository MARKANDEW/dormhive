import { query } from '../config/database.js';
import * as mediaFiles from './Media.js';

const normalizeStatus = (status) => {
  const value = String(status ?? 'open').trim().toLowerCase();
  if (value === 'in_progress' || value === 'in-progress' || value === 'pending') return 'pending';
  if (value === 'resolved') return 'resolved';
  if (value === 'closed') return 'closed';
  return 'open';
};

const normalizePriority = (priority) => {
  const value = String(priority ?? 'medium').trim().toLowerCase();
  if (value === 'high' || value === 'low' || value === 'medium') return value;
  return 'medium';
};

const columnNames = async () => {
  const rows = await query('SHOW COLUMNS FROM support_tickets');
  return rows.map((row) => row.Field);
};

const userColumn = async () => {
  const fields = await columnNames();
  return fields.includes('requester_id') ? 'requester_id' : 'user_id';
};

async function ensureMessageTable() {
  await query(`CREATE TABLE IF NOT EXISTS support_ticket_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ticket_id INT NOT NULL,
    sender_id INT NOT NULL,
    body TEXT NOT NULL,
    attachment_url VARCHAR(500) NULL,
    attachment_name VARCHAR(255) NULL,
    is_internal TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_ticket_messages_ticket (ticket_id),
    INDEX idx_ticket_messages_sender (sender_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  const fields = await query('SHOW COLUMNS FROM support_ticket_messages');
  const names = fields.map((field) => field.Field);
  if (!names.includes('attachment_url')) await query('ALTER TABLE support_ticket_messages ADD COLUMN attachment_url VARCHAR(500) NULL');
  if (!names.includes('attachment_name')) await query('ALTER TABLE support_ticket_messages ADD COLUMN attachment_name VARCHAR(255) NULL');
}

export async function listMessages(ticketId) {
  await ensureMessageTable();
  return query(`SELECT m.id, m.ticket_id, m.sender_id, m.body, COALESCE(CONCAT('/api/v1/media/', media.id), m.attachment_url) AS attachment_url,
    COALESCE(media.original_filename, m.attachment_name) AS attachment_name, media.mime_type AS attachment_mime_type, m.is_internal, m.created_at,
    COALESCE(CONCAT_WS(' ', u.first_name, u.last_name), u.name) AS sender_name,
    u.email AS sender_email, u.role AS sender_role
    FROM support_ticket_messages m
    JOIN users u ON u.id = m.sender_id
    LEFT JOIN media_files media ON media.ticket_message_id = m.id
    WHERE m.ticket_id = ? ORDER BY m.created_at ASC, m.id ASC`, [ticketId]);
}

export async function addMessage(ticketId, senderId, body, isInternal = false, attachment = null) {
  await ensureMessageTable();
  const result = await query(
    'INSERT INTO support_ticket_messages (ticket_id, sender_id, body, is_internal) VALUES (?, ?, ?, ?)',
    [ticketId, senderId, body, isInternal ? 1 : 0]
  );
  if (attachment) {
    const stored = await mediaFiles.create({
      uploadedBy: senderId,
      ticketMessageId: result.insertId,
      filename: attachment.filename,
      mimeType: attachment.mimeType,
      buffer: attachment.buffer
    });
    await query('UPDATE support_ticket_messages SET attachment_url = ?, attachment_name = ? WHERE id = ?', [stored.url, attachment.filename, result.insertId]);
  }
  const rows = await query(`SELECT m.id, m.ticket_id, m.sender_id, m.body, m.attachment_url, m.attachment_name, m.is_internal, m.created_at,
    COALESCE(CONCAT_WS(' ', u.first_name, u.last_name), u.name) AS sender_name,
    u.email AS sender_email, u.role AS sender_role
    FROM support_ticket_messages m JOIN users u ON u.id = m.sender_id WHERE m.id = ?`, [result.insertId]);
  const file = attachment ? await query('SELECT id, original_filename, mime_type FROM media_files WHERE ticket_message_id = ? LIMIT 1', [result.insertId]) : [];
  return rows[0] ? {
    ...rows[0],
    attachment_url: file[0] ? `/api/v1/media/${file[0].id}` : rows[0].attachment_url,
    attachment_name: file[0]?.original_filename ?? rows[0].attachment_name,
    attachment_mime_type: file[0]?.mime_type ?? null
  } : null;
}

export async function listForUser(user) {
  const fields = await columnNames();
  const userKey = await userColumn();
  const hasPriority = fields.includes('priority');
  const hasAssignedAdmin = fields.includes('assigned_admin_id');
  const baseSelect = [
    's.*',
    "COALESCE(CONCAT_WS(' ', u.first_name, u.last_name), u.name) AS requester_name",
    'u.email AS requester_email',
    'u.role AS requester_role',
    'a.name AS assigned_admin_name',
    'a.email AS assigned_admin_email'
  ];

  if (hasPriority) {
    baseSelect.push('s.priority');
  } else {
    baseSelect.push("'medium' AS priority");
  }

  if (hasAssignedAdmin) {
    baseSelect.push('s.assigned_admin_id');
  }

  const whereClause = user.role === 'admin' ? '' : ` WHERE s.${userKey} = ?`;
  const values = user.role === 'admin' ? [] : [user.id];
  const rows = await query(`SELECT ${baseSelect.join(', ')} FROM support_tickets s JOIN users u ON u.id = s.${userKey} LEFT JOIN users a ON a.id = s.assigned_admin_id${whereClause} ORDER BY s.created_at DESC`, values);

  return rows.map((row) => ({
    ...row,
    status: normalizeStatus(row.status),
    priority: normalizePriority(row.priority),
    requester_name: row.requester_name || row.name || 'Unknown user',
    requester_email: row.requester_email || row.email || null,
    assigned_admin_name: row.assigned_admin_name || null,
    assigned_admin_email: row.assigned_admin_email || null
  }));
}

export async function create(requesterId, input) {
  const fields = await columnNames();
  const userKey = fields.includes('requester_id') ? 'requester_id' : 'user_id';
  const params = [requesterId, input.subject, input.description, normalizePriority(input.priority), input.status ?? 'open'];
  const hasPriority = fields.includes('priority');
  const hasStatus = fields.includes('status');

  const sql = hasPriority
    ? `INSERT INTO support_tickets (${userKey}, subject, description, priority, status) VALUES (?, ?, ?, ?, ?)`
    : `INSERT INTO support_tickets (${userKey}, subject, description, status) VALUES (?, ?, ?, ?)`;

  const values = hasPriority
    ? params
    : [requesterId, input.subject, input.description, normalizeStatus(input.status)];

  const result = await query(sql, values);
  const rows = await query('SELECT * FROM support_tickets WHERE id = ?', [result.insertId]);
  return rows[0] ?? null;
}

export async function update(id, input) {
  const fields = await columnNames();
  const updates = [];
  const values = [];

  if (input.status) {
    updates.push('status = ?');
    values.push(normalizeStatus(input.status));
  }
  if (input.priority && fields.includes('priority')) {
    updates.push('priority = ?');
    values.push(normalizePriority(input.priority));
  }
  if (input.assignedAdminId && fields.includes('assigned_admin_id')) {
    updates.push('assigned_admin_id = ?');
    values.push(input.assignedAdminId);
  }

  if (!updates.length) {
    const rows = await query('SELECT * FROM support_tickets WHERE id = ?', [id]);
    return rows[0] ?? null;
  }

  const sql = `UPDATE support_tickets SET ${updates.join(', ')} WHERE id = ?`;
  await query(sql, [...values, id]);
  const rows = await query('SELECT * FROM support_tickets WHERE id = ?', [id]);
  return rows[0] ?? null;
}
