import { query } from '../config/database.js';
import crypto from 'node:crypto';

// Return a computed `name` while exposing first_name and last_name when available
const publicFields = "id, COALESCE(NULLIF(TRIM(CONCAT_WS(' ', first_name, last_name)), ''), name) AS name, first_name, last_name, email, phone, avatar_url, role, status, verification_status, archived_status, archived_at, last_login_at, last_active_at, created_at, updated_at";

export async function findByEmail(email) {
  const rows = await query(`SELECT ${publicFields}, password_hash FROM users WHERE email = ? LIMIT 1`, [email]);
  return rows[0] ?? null;
}

export async function findByPhone(phone) {
  const digits = String(phone).replace(/\D/g, '');
  const localNumber = digits.startsWith('63') ? digits.slice(2) : digits;
  const candidates = [...new Set([phone, digits, localNumber, `0${localNumber}`])];
  const placeholders = candidates.map(() => '?').join(', ');
  const normalizedPhoneSql = "REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(phone, '+', ''), ' ', ''), '-', ''), '(', ''), ')', ''), '.', '')";
  const rows = await query(`SELECT ${publicFields} FROM users WHERE phone IN (${placeholders}) OR ${normalizedPhoneSql} IN (?, ?, ?) LIMIT 1`, [...candidates, digits, localNumber, `0${localNumber}`]);
  return rows[0] ?? null;
}

export async function findById(id) {
  const rows = await query(`SELECT ${publicFields} FROM users WHERE id = ? LIMIT 1`, [id]);
  return rows[0] ?? null;
}

export async function findByIdWithPassword(id) {
  const rows = await query('SELECT id, password_hash FROM users WHERE id = ? LIMIT 1', [id]);
  return rows[0] ?? null;
}

export async function create({ name, first_name, last_name, email, passwordHash, phone, role, status = 'active', verificationStatus = 'approved' }) {
  // store both legacy `name` and the individual name parts
  const result = await query('INSERT INTO users (name, first_name, last_name, email, password_hash, phone, role, status, verification_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [name ?? (first_name || last_name ? `${first_name ?? ''} ${last_name ?? ''}`.trim() : null), first_name ?? null, last_name ?? null, email, passwordHash, phone, role, status, verificationStatus]);
  return findById(result.insertId);
}

export async function setVerificationDocument(id, documentId) {
  await query('UPDATE users SET verification_document_id = ? WHERE id = ?', [documentId, id]);
  return findById(id);
}

export async function findVerificationDocument(id) {
  const rows = await query(
    `SELECT m.id, m.original_filename, m.mime_type
     FROM users u
     JOIN media_files m ON m.id = u.verification_document_id AND m.uploaded_by = u.id
     WHERE u.id = ? AND u.verification_status = 'pending' LIMIT 1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function reviewVerification(id, verificationStatus) {
  const nextStatus = verificationStatus === 'approved' ? 'active' : 'suspended';
  const result = await query(
    `UPDATE users
     SET verification_status = ?, status = ?
     WHERE id = ? AND verification_status = 'pending' AND verification_document_id IS NOT NULL`,
    [verificationStatus, nextStatus, id]
  );
  return result.affectedRows === 1;
}

export async function clearVerificationDocument(id, documentId) {
  await query('UPDATE users SET verification_document_id = NULL WHERE id = ? AND verification_document_id = ?', [id, documentId]);
}

export async function list({ page, limit, search, archivedOnly = false, verificationStatus = null }) {
  const offset = (page - 1) * limit;
  const term = `%${search}%`;
  const archiveFilter = archivedOnly ? "status = 'archived'" : "status != 'archived'";
  const searchFilter = '(name LIKE ? OR email LIKE ?)';
  const verificationFilter = verificationStatus ? ' AND verification_status = ?' : '';
  const filters = `${archiveFilter} AND ${searchFilter}${verificationFilter}`;
  const values = verificationStatus ? [term, term, verificationStatus] : [term, term];
  const rows = await query(`SELECT ${publicFields} FROM users WHERE ${filters} ORDER BY created_at DESC LIMIT ? OFFSET ?`, [...values, limit, offset]);
  const total = await query(`SELECT COUNT(*) AS count FROM users WHERE ${filters}`, values);
  const verificationCounts = await query(
    `SELECT verification_status AS status, COUNT(*) AS count
     FROM users WHERE ${archiveFilter} AND ${searchFilter} GROUP BY verification_status`,
    [term, term]
  );
  const counts = { pending: 0, approved: 0, rejected: 0 };
  verificationCounts.forEach(({ status, count }) => { counts[status] = Number(count); });
  return { rows, total: Number(total[0].count), counts };
}

export async function update(id, { name, first_name, last_name, phone, avatar_url, status, role }) {
  // If first_name/last_name provided, compute a new `name` value for legacy consumers
  const computedName = (first_name || last_name) ? `${first_name ?? ''} ${last_name ?? ''}`.trim() : name ?? null;
  await query(
    'UPDATE users SET name = COALESCE(?, name), first_name = COALESCE(?, first_name), last_name = COALESCE(?, last_name), phone = COALESCE(?, phone), avatar_url = COALESCE(?, avatar_url), status = COALESCE(?, status), role = COALESCE(?, role) WHERE id = ?',
    [computedName ?? null, first_name ?? null, last_name ?? null, phone ?? null, avatar_url ?? null, status ?? null, role ?? null, id]
  );
  return findById(id);
}

export async function updatePassword(id, passwordHash) {
  await query('UPDATE users SET password_hash = ?, updated_at = updated_at WHERE id = ?', [passwordHash, id]);
  return findById(id);
}

export async function recordLogin(id) {
  await query('UPDATE users SET last_login_at = NOW(), last_active_at = NOW(), updated_at = updated_at WHERE id = ?', [id]);
  return findById(id);
}

async function ensurePasswordResetTable() {
  const columns = await query('SHOW COLUMNS FROM users');
  const idColumn = columns.find((column) => column.Field === 'id');
  const userIdType = String(idColumn?.Type ?? '').toLowerCase();
  if (!/^(tinyint|smallint|mediumint|int|bigint)(\(\d+\))?( unsigned)?$/.test(userIdType)) {
    throw new Error(`Unsupported users.id type for password reset foreign key: ${userIdType || 'missing'}`);
  }
  const foreignKeyType = userIdType.replace(/\(\d+\)/, '');
  await query(`CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id ${foreignKeyType} NOT NULL,
    token_hash CHAR(64) NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    used_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_password_reset_user (user_id),
    INDEX idx_password_reset_expiry (expires_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
}

export async function createPasswordResetToken(userId) {
  await ensurePasswordResetTable();
  await query('DELETE FROM password_reset_tokens WHERE user_id = ? OR expires_at < NOW() OR used_at IS NOT NULL', [userId]);
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  await query('INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))', [userId, tokenHash]);
  return token;
}

export async function consumePasswordResetToken(token) {
  await ensurePasswordResetTable();
  const tokenHash = crypto.createHash('sha256').update(String(token)).digest('hex');
  const result = await query('UPDATE password_reset_tokens SET used_at = NOW() WHERE token_hash = ? AND used_at IS NULL AND expires_at > NOW()', [tokenHash]);
  if (result.affectedRows !== 1) return null;
  const rows = await query('SELECT user_id FROM password_reset_tokens WHERE token_hash = ? LIMIT 1', [tokenHash]);
  return rows[0]?.user_id ?? null;
}

export async function revokePasswordResetToken(token) {
  await ensurePasswordResetTable();
  const tokenHash = crypto.createHash('sha256').update(String(token)).digest('hex');
  await query('DELETE FROM password_reset_tokens WHERE token_hash = ? AND used_at IS NULL', [tokenHash]);
}

export async function remove(id) {
  const result = await query('DELETE FROM users WHERE id = ?', [id]);
  return result.affectedRows;
}

export async function archive(id) {
  const result = await query(
    "UPDATE users SET last_active_at = COALESCE(last_login_at, last_active_at), archived_status = status, status = 'archived', archived_at = NOW() WHERE id = ? AND status != 'archived'",
    [id]
  );
  return result.affectedRows;
}

export async function restore(id) {
  const result = await query(
    "UPDATE users SET status = COALESCE(archived_status, 'active'), archived_status = NULL, archived_at = NULL WHERE id = ? AND status = 'archived'",
    [id]
  );
  return result.affectedRows;
}
