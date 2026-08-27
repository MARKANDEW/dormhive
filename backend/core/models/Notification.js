import { query } from '../config/database.js';
export const listFor = (userId, unread) => query(`SELECT * FROM notifications WHERE user_id=? ${unread ? 'AND read_at IS NULL' : ''} ORDER BY created_at DESC`, [userId]);
export async function create(userId, title, body) {
   const result = await query('INSERT INTO notifications (user_id, title, message) VALUES (?, ?, ?)', [userId, title, body]);
  return result.insertId;
}
export async function markRead(id, userId) {
  const result = await query('UPDATE notifications SET read_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?', [id, userId]);
  return result.affectedRows;
}
