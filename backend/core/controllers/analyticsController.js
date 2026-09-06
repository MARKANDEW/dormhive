import { query } from '../config/database.js';

function range(request) {
  const limit = Math.min(100, Math.max(1, Number(request.query.limit) || 100));
  return { limit };
}

export async function users(request, response, next) {
  try {
    const { limit } = range(request);
    const [data, activity] = await Promise.all([
      query('SELECT role, status, COUNT(*) AS count FROM users GROUP BY role, status LIMIT ?', [limit]),
      query('SELECT name, email, status, created_at, updated_at FROM users ORDER BY COALESCE(updated_at, created_at) DESC LIMIT ?', [limit])
    ]);
    response.json({ data, activity });
  } catch (error) { next(error); }
}

export async function properties(request, response, next) {
  try {
    const { limit } = range(request);
    const [data, activity] = await Promise.all([
      query('SELECT status, municipality, COUNT(*) AS count FROM properties GROUP BY status, municipality LIMIT ?', [limit]),
      query('SELECT title, status, created_at, updated_at FROM properties ORDER BY COALESCE(updated_at, created_at) DESC LIMIT ?', [limit])
    ]);
    response.json({ data, activity });
  } catch (error) { next(error); }
}

export async function bookings(request, response, next) {
  try {
    const { limit } = range(request);
    const [data, activity] = await Promise.all([
      query('SELECT status, COUNT(*) AS count FROM bookings GROUP BY status LIMIT ?', [limit]),
      query(`SELECT bookings.status, bookings.created_at, bookings.updated_at, users.name AS tenant_name
        FROM bookings LEFT JOIN users ON users.id = bookings.tenant_id
        ORDER BY COALESCE(bookings.updated_at, bookings.created_at) DESC LIMIT ?`, [limit])
    ]);
    response.json({ data, activity });
  } catch (error) { next(error); }
}
