import { query } from '../config/database.js';
import crypto from 'node:crypto';

// Return a computed `name` while exposing first_name and last_name when available
const publicFields = "id, COALESCE(NULLIF(TRIM(CONCAT_WS(' ', first_name, last_name)), ''), name) AS name, first_name, last_name, email, phone, avatar_url, role, status, created_at, updated_at";

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

export async function create({ name, first_name, last_name, email, passwordHash, phone, role }) {
  // store both legacy `name` and the individual name parts
  const result = await query("INSERT INTO users (name, first_name, last_name, email, password_hash, phone, role, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'active')", [name ?? (first_name || last_name ? `${first_name ?? ''} ${last_name ?? ''}`.trim() : null), first_name ?? null, last_name ?? null, email, passwordHash, phone, role]);
  return findById(result.insertId);
}

export async function list({ page, limit, search }) {
  const offset = (page - 1) * limit;
  const term = `%${search}%`;
  const rows = await query(`SELECT ${publicFields} FROM users WHERE name LIKE ? OR email LIKE ? ORDER BY created_at DESC LIMIT ? OFFSET ?`, [term, term, limit, offset]);
  const total = await query('SELECT COUNT(*) AS count FROM users WHERE name LIKE ? OR email LIKE ?', [term, term]);
  return { rows, total: total[0].count };
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
  await query('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, id]);
  return findById(id);
}

async function ensurePasswordResetTable() {
  await query(`CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    token_hash CHAR(64) NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    used_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_password_reset_user (user_id),
    INDEX idx_password_reset_expiry (expires_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
}

let passwordResetOtpTableReady = false;

async function ensurePasswordResetOtpTable() {
  if (passwordResetOtpTableReady) return;
  await query(`CREATE TABLE IF NOT EXISTS password_reset_otps (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    phone_e164 VARCHAR(16) NOT NULL UNIQUE,
    verification_sid VARCHAR(64) NOT NULL,
    attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
    expires_at DATETIME NOT NULL,
    resend_after DATETIME NOT NULL,
    verified_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_password_reset_otp_expiry (expires_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  passwordResetOtpTableReady = true;
}

export async function getPasswordResetOtpChallenge(phone) {
  await ensurePasswordResetOtpTable();
  const rows = await query(`SELECT user_id, phone_e164, verification_sid, attempts, expires_at, resend_after, verified_at,
    GREATEST(TIMESTAMPDIFF(SECOND, NOW(), expires_at), 0) AS expires_in_seconds,
    GREATEST(TIMESTAMPDIFF(SECOND, NOW(), resend_after), 0) AS resend_in_seconds
    FROM password_reset_otps WHERE phone_e164 = ? LIMIT 1`, [phone]);
  return rows[0] ?? null;
}

export async function createPasswordResetOtpChallenge({ userId, phone, verificationSid }) {
  await ensurePasswordResetOtpTable();
  await query('DELETE FROM password_reset_otps WHERE expires_at < NOW() OR verified_at IS NOT NULL');
  await query(`INSERT INTO password_reset_otps (user_id, phone_e164, verification_sid, attempts, expires_at, resend_after)
    VALUES (?, ?, ?, 0, DATE_ADD(NOW(), INTERVAL 5 MINUTE), DATE_ADD(NOW(), INTERVAL 60 SECOND))
    ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), verification_sid = VALUES(verification_sid), attempts = 0,
      expires_at = VALUES(expires_at), resend_after = VALUES(resend_after), verified_at = NULL`, [userId, phone, verificationSid]);
}

export async function incrementPasswordResetOtpAttempt(phone) {
  await ensurePasswordResetOtpTable();
  const result = await query(`UPDATE password_reset_otps SET attempts = attempts + 1
    WHERE phone_e164 = ? AND expires_at > NOW() AND verified_at IS NULL AND attempts < 5`, [phone]);
  if (!result.affectedRows) return null;
  const rows = await query('SELECT attempts FROM password_reset_otps WHERE phone_e164 = ? LIMIT 1', [phone]);
  return rows[0]?.attempts ?? null;
}

export async function markPasswordResetOtpVerified(phone) {
  await ensurePasswordResetOtpTable();
  const result = await query(`UPDATE password_reset_otps SET verified_at = NOW()
    WHERE phone_e164 = ? AND expires_at > NOW() AND verified_at IS NULL AND attempts <= 5`, [phone]);
  return result.affectedRows === 1;
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

export async function remove(id) {
  const result = await query('DELETE FROM users WHERE id = ?', [id]);
  return result.affectedRows;
}
