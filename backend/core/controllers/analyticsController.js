import { query } from '../config/database.js';

function range(request) {
  const limit = Math.min(100, Math.max(1, Number(request.query.limit) || 100));
  return { limit };
}

export async function users(request, response, next) {
  try {
    const { limit } = range(request);
    response.json({ data: await query('SELECT role, status, COUNT(*) AS count FROM users GROUP BY role, status LIMIT ?', [limit]) });
  } catch (error) { next(error); }
}

export async function properties(request, response, next) {
  try {
    const { limit } = range(request);
    response.json({ data: await query('SELECT status, municipality, COUNT(*) AS count FROM properties GROUP BY status, municipality LIMIT ?', [limit]) });
  } catch (error) { next(error); }
}

export async function bookings(request, response, next) {
  try {
    const { limit } = range(request);
    response.json({ data: await query('SELECT status, COUNT(*) AS count FROM bookings GROUP BY status LIMIT ?', [limit]) });
  } catch (error) { next(error); }
}
