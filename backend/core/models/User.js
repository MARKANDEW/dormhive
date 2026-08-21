import { query } from '../config/database.js';

// Return a computed `name` while exposing first_name and last_name when available
const publicFields = 'id, COALESCE(CONCAT_WS(" ", first_name, last_name), name) AS name, first_name, last_name, email, phone, avatar_url, role, status, created_at, updated_at';

export async function findByEmail(email) {
  const rows = await query(`SELECT ${publicFields}, password_hash FROM users WHERE email = ? LIMIT 1`, [email]);
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

export async function remove(id) {
  const result = await query('DELETE FROM users WHERE id = ?', [id]);
  return result.affectedRows;
}
