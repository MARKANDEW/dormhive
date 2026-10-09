import { query } from '../config/database.js';
import * as mediaFiles from './Media.js';

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
    filters.push('COALESCE((SELECT SUM(COALESCE(b.occupants, 1)) FROM bookings b WHERE b.property_id = p.id AND b.status = "approved"), 0) < COALESCE(p.max_occupants, p.available_slots, 0)');
  }
  if (municipality) { filters.push('p.municipality = ?'); values.push(municipality); }
  if (roomType) { filters.push('p.room_type = ?'); values.push(roomType); }
  if (minPrice) { filters.push('p.monthly_rent >= ?'); values.push(minPrice); }
  if (maxPrice) { filters.push('p.monthly_rent <= ?'); values.push(maxPrice); }
  if (status) { filters.push('p.status = ?'); values.push(status); }
  const where = filters.join(' AND ') || '1 = 1';
  const offset = (page - 1) * limit;
  const rows = await query(`SELECT p.*, COALESCE((SELECT SUM(COALESCE(b.occupants, 1)) FROM bookings b WHERE b.property_id = p.id AND b.status = 'approved'), 0) AS occupied_units, COALESCE(NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''), NULLIF(TRIM(u.name), '')) AS owner_name, u.email AS owner_email, u.avatar_url AS owner_avatar_url FROM properties p JOIN users u ON u.id = p.owner_id WHERE ${where} ORDER BY p.created_at DESC LIMIT ? OFFSET ?`, [...values, limit, offset]);
  const total = await query(`SELECT COUNT(*) AS count FROM properties p WHERE ${where}`, values);
  return { rows, total: total[0].count };
}

export async function findById(id) {
  const rows = await query(`SELECT p.*, COALESCE((SELECT SUM(COALESCE(b.occupants, 1)) FROM bookings b WHERE b.property_id = p.id AND b.status = 'approved'), 0) AS occupied_units, COALESCE(NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''), NULLIF(TRIM(u.name), '')) AS owner_name, u.email AS owner_email, u.avatar_url AS owner_avatar_url FROM properties p JOIN users u ON u.id = p.owner_id WHERE p.id = ? LIMIT 1`, [id]);
  return rows[0] ?? null;
}

export async function create(ownerId, input) {
  const result = await query("INSERT INTO properties (owner_id, title, description, address, municipality, barangay, latitude, longitude, room_type, monthly_rent, max_occupants, available_slots, gender_preference, amenities, image_url, images, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')", [ownerId, input.title, input.description ?? null, input.address, input.municipality, input.barangay ?? null, input.latitude ?? null, input.longitude ?? null, input.roomType, input.monthlyRent, input.maxOccupants, input.availableSlots ?? null, input.genderPreference ?? null, input.amenities ?? null, input.imageUrl ?? null, JSON.stringify(input.images ?? [])]);
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
    images = COALESCE(?, images),
    status = COALESCE(?, status)
  WHERE id = ?`, [input.title ?? null, input.description ?? null, input.address ?? null, input.municipality ?? null, input.barangay ?? null, input.latitude ?? null, input.longitude ?? null, input.roomType ?? null, input.monthlyRent ?? null, input.maxOccupants ?? null, input.availableSlots ?? null, input.genderPreference ?? null, input.amenities ?? null, input.imageUrl ?? null, input.images ? JSON.stringify(input.images) : null, input.status ?? null, id]);
  return findById(id);
}

export async function appendImage(id, imageUrl) {
  const property = await findById(id);
  let images = [];
  try {
    images = Array.isArray(property?.images) ? property.images : JSON.parse(property?.images || '[]');
  } catch {}
  images.push(imageUrl);
  await query('UPDATE properties SET image_url = COALESCE(image_url, ?), images = ? WHERE id = ?', [imageUrl, JSON.stringify(images), id]);
  return findById(id);
}

export async function replaceImages(id, imageUrl, images) {
  await query('UPDATE properties SET image_url = ?, images = ? WHERE id = ?', [imageUrl, JSON.stringify(images), id]);
}

export async function syncAvailability(id) {
  const property = await findById(id);
  if (!property) return null;
  const totalCapacity = Math.max(0, Number(property.max_occupants ?? property.available_slots ?? 0));
  const [row] = await query('SELECT COALESCE(SUM(COALESCE(occupants, 1)), 0) AS occupied FROM bookings WHERE property_id = ? AND status = ?', [id, 'approved']);
  const occupied = Math.max(0, Number(row?.occupied ?? 0));
  const availableSlots = Math.max(0, totalCapacity - occupied);
  await query('UPDATE properties SET available_slots = ? WHERE id = ?', [availableSlots, id]);
  return { ...property, available_slots: availableSlots, occupied };
}

export async function updateStatus(id, status) {
  await query('UPDATE properties SET status = ? WHERE id = ?', [status, id]);
  return findById(id);
}

export async function remove(id) {
  await query('DELETE FROM bookings WHERE property_id = ?', [id]);
  return query('DELETE FROM properties WHERE id = ?', [id]);
}

export async function attachUploadedImages(id, images, uploaderId) {
  const ids = images.map((image) => Number(String(image).match(/^\/api\/v1\/media\/(\d+)$/)?.[1])).filter(Number.isInteger);
  if (ids.length) await mediaFiles.attachStagedToProperty(ids, id, uploaderId);
}
