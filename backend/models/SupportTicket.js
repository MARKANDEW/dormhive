import { query } from '../config/database.js';

export function listForUser(user) {
  if (user.role === 'admin') return query("SELECT s.*, COALESCE(CONCAT_WS(' ', u.first_name, u.last_name), u.name) requester_name FROM support_tickets s JOIN users u ON u.id=s.requester_id ORDER BY s.created_at DESC");
  return query("SELECT s.*, COALESCE(CONCAT_WS(' ', u.first_name, u.last_name), u.name) requester_name FROM support_tickets s JOIN users u ON u.id=s.requester_id WHERE s.requester_id=? ORDER BY s.created_at DESC", [user.id]);
}

export async function create(requesterId, input) {
  const result = await query('INSERT INTO support_tickets (requester_id,subject,description,priority) VALUES (?,?,?,?)', [requesterId, input.subject, input.description, input.priority ?? 'medium']);
  const rows = await query('SELECT * FROM support_tickets WHERE id=?', [result.insertId]);
  return rows[0];
}

export async function update(id, input) {
  await query("UPDATE support_tickets SET status=COALESCE(?,status),priority=COALESCE(?,priority),assigned_admin_id=COALESCE(?,assigned_admin_id),resolved_at=CASE WHEN ? IN ('resolved','closed') THEN CURRENT_TIMESTAMP ELSE resolved_at END WHERE id=?", [input.status ?? null, input.priority ?? null, input.assignedAdminId ?? null, input.status ?? null, id]);
  const rows = await query('SELECT * FROM support_tickets WHERE id=?', [id]);
  return rows[0] ?? null;
}
