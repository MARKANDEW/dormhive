import { query } from '../config/database.js';

export function buildBookingListSql(role = 'owner') {
  const fields = "b.*, p.title AS property_title, p.monthly_rent, p.owner_id, COALESCE(CONCAT_WS(' ', u.first_name, u.last_name), u.name) AS tenant_name, u.avatar_url AS tenant_avatar_url";

  if (role === 'admin') {
    return `SELECT ${fields} FROM bookings b JOIN properties p ON p.id = b.property_id JOIN users u ON u.id = b.tenant_id ORDER BY b.created_at DESC`;
  }

  if (role === 'tenant') {
    return `SELECT ${fields} FROM bookings b JOIN properties p ON p.id = b.property_id JOIN users u ON u.id = b.tenant_id WHERE b.tenant_id = ? AND p.status != 'archived' ORDER BY b.created_at DESC`;
  }

  return `SELECT ${fields} FROM bookings b JOIN properties p ON p.id = b.property_id JOIN users u ON u.id = b.tenant_id WHERE p.owner_id = ? ORDER BY b.created_at DESC`;
}

export async function create(tenantId, { propertyId, moveInDate, moveOutDate, isIndefiniteMoveOut = false, viewingDate, viewingTime, occupants, message }) {
  const viewingScheduleSubmitted = Boolean(viewingDate && viewingTime);
  const result = await query("INSERT INTO bookings (property_id, tenant_id, move_in_date, move_out_date, is_indefinite_move_out, viewing_date, viewing_time, viewing_schedule_tenant_submitted, occupants, message, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')", [propertyId, tenantId, moveInDate, moveOutDate ?? null, isIndefiniteMoveOut ? 1 : 0, viewingDate ?? null, viewingTime ?? null, viewingScheduleSubmitted ? 1 : 0, occupants, message ?? null]);
  return findById(result.insertId);
}

export async function findById(id) {
  const rows = await query('SELECT b.*, p.title AS property_title, p.monthly_rent, p.owner_id FROM bookings b JOIN properties p ON p.id = b.property_id WHERE b.id = ? LIMIT 1', [id]);
  return rows[0] ?? null;
}

export async function listForUser(user) {
  const sql = buildBookingListSql(user.role);
  return query(sql, [user.id]);
}

export async function updateStatus(id, status) {
  await query('UPDATE bookings SET status = ? WHERE id = ?', [status, id]);
  return findById(id);
}

export async function updateViewingSchedule(id, viewingDate, viewingTime) {
  await query('UPDATE bookings SET viewing_date = ?, viewing_time = ?, viewing_schedule_tenant_submitted = 1 WHERE id = ?', [viewingDate, viewingTime, id]);
  return findById(id);
}

export async function updateMoveOut(id, moveOutDate, isIndefiniteMoveOut) {
  await query('UPDATE bookings SET move_out_date = ?, is_indefinite_move_out = ? WHERE id = ?', [moveOutDate, isIndefiniteMoveOut ? 1 : 0, id]);
  return findById(id);
}
