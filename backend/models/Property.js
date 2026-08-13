import { query } from '../config/database.js';

export async function list({ page, limit, municipality, roomType, minPrice, maxPrice, status, viewer }) {
  const filters = [];
  const values = [];
  if (viewer?.role === 'admin') {
    // Administrators may view and moderate every property.
  } else if (viewer?.role === 'owner') {
    filters.push("(p.status = 'approved' OR p.owner_id = ?)");
    values.push(viewer.id);
  } else {
    filters.push("p.status = 'approved'");
  }
  if (municipality) { filters.push('p.municipality = ?'); values.push(municipality); }
  if (roomType) { filters.push('p.room_type = ?'); values.push(roomType); }
  if (minPrice) { filters.push('p.monthly_rent >= ?'); values.push(minPrice); }
  if (maxPrice) { filters.push('p.monthly_rent <= ?'); values.push(maxPrice); }
  if (status) { filters.push('p.status = ?'); values.push(status); }
  const where = filters.join(' AND ') || '1 = 1';
  const offset = (page - 1) * limit;
  const rows = await query(`SELECT p.*, COALESCE(CONCAT_WS(' ', u.first_name, u.last_name), u.name) AS owner_name FROM properties p JOIN users u ON u.id = p.owner_id WHERE ${where} ORDER BY p.created_at DESC LIMIT ? OFFSET ?`, [...values, limit, offset]);
  const total = await query(`SELECT COUNT(*) AS count FROM properties p WHERE ${where}`, values);
  return { rows, total: total[0].count };
}

export async function findById(id) {
  const rows = await query(`SELECT p.*, COALESCE(CONCAT_WS(' ', u.first_name, u.last_name), u.name) AS owner_name FROM properties p JOIN users u ON u.id = p.owner_id WHERE p.id = ? LIMIT 1`, [id]);
  return rows[0] ?? null;
}

export async function create(ownerId, input) {
  const result = await query("INSERT INTO properties (owner_id, title, description, address, municipality, barangay, latitude, longitude, room_type, monthly_rent, max_occupants, available_slots, gender_preference, amenities, image_url, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')", [ownerId, input.title, input.description ?? null, input.address, input.municipality, input.barangay ?? null, input.latitude ?? null, input.longitude ?? null, input.roomType, input.monthlyRent, input.maxOccupants, input.availableSlots ?? null, input.genderPreference ?? null, input.amenities ?? null, input.imageUrl ?? null]);
  return findById(result.insertId);
}

export async function update(id, input) {
  await query(`UPDATE properties SET
    title = COALESCE(?, title),
    description = COALESCE(?, description),
    address = COALESCE(?, address),
    municipality = COALESCE(?, municipality),
    barangay = COALESCE(?, barangay),
    latitude = COALESCE(?, latitude),
    longitude = COALESCE(?, longitude),
    room_type = COALESCE(?, room_type),
    monthly_rent = COALESCE(?, monthly_rent),
    max_occupants = COALESCE(?, max_occupants),
    available_slots = COALESCE(?, available_slots),
    gender_preference = COALESCE(?, gender_preference),
    amenities = COALESCE(?, amenities),
    image_url = COALESCE(?, image_url),
    status = COALESCE(?, status)
  WHERE id = ?`, [input.title ?? null, input.description ?? null, input.address ?? null, input.municipality ?? null, input.barangay ?? null, input.latitude ?? null, input.longitude ?? null, input.roomType ?? null, input.monthlyRent ?? null, input.maxOccupants ?? null, input.availableSlots ?? null, input.genderPreference ?? null, input.amenities ?? null, input.imageUrl ?? null, input.status ?? null, id]);
  return findById(id);
}

export async function updateStatus(id, status) {
  await query('UPDATE properties SET status = ? WHERE id = ?', [status, id]);
  return findById(id);
}

export function remove(id) { return query('DELETE FROM properties WHERE id = ?', [id]); }
