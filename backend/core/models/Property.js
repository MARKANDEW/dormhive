import { query } from '../config/database.js';
import * as mediaFiles from './Media.js';

export async function list({ page, limit, municipality, roomType, minPrice, maxPrice, status, viewer }) {
  const filters = [];
  const values = [];
  const availableRentalSlots = 'GREATEST(0, COALESCE(p.total_slots, 1) - (SELECT COUNT(*) FROM bookings slot_booking WHERE slot_booking.property_id = p.id AND slot_booking.status = \'approved\'))';
  if (viewer?.role === 'admin') {
    // Administrators may view and moderate every property.
  } else if (viewer?.role === 'owner') {
    filters.push("((p.status = 'approved' AND u.status = 'active') OR p.owner_id = ?)");
    values.push(viewer.id);
  } else {
    filters.push("p.status = 'approved'");
    filters.push("u.status = 'active'");
    filters.push(`${availableRentalSlots} > 0`);
  }
  if (municipality) { filters.push('p.municipality = ?'); values.push(municipality); }
  if (roomType) { filters.push('p.room_type = ?'); values.push(roomType); }
  if (minPrice) { filters.push('p.monthly_rent >= ?'); values.push(minPrice); }
  if (maxPrice) { filters.push('p.monthly_rent <= ?'); values.push(maxPrice); }
  if (status) { filters.push('p.status = ?'); values.push(status); }
  const where = filters.join(' AND ') || '1 = 1';
  const offset = (page - 1) * limit;
  const rows = await query(`SELECT p.*, ${availableRentalSlots} AS rentable_slots_available, COALESCE((SELECT SUM(COALESCE(b.occupants, 1)) FROM bookings b WHERE b.property_id = p.id AND b.status = 'approved'), 0) AS occupied_units, EXISTS(SELECT 1 FROM media_files proof WHERE proof.id = p.ownership_document_id AND proof.uploaded_by = p.owner_id AND proof.is_private = 1) AS has_ownership_proof, COALESCE(NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''), NULLIF(TRIM(u.name), '')) AS owner_name, u.email AS owner_email, u.avatar_url AS owner_avatar_url, u.status AS owner_status FROM properties p JOIN users u ON u.id = p.owner_id WHERE ${where} ORDER BY p.created_at DESC LIMIT ? OFFSET ?`, [...values, limit, offset]);
  const total = await query(`SELECT COUNT(*) AS count FROM properties p JOIN users u ON u.id = p.owner_id WHERE ${where}`, values);
  return {
    rows: rows.map(({ rentable_slots_available, ...property }) => ({
      ...property,
      available_slots: Number(rentable_slots_available ?? 0)
    })),
    total: total[0].count
  };
}

export async function findById(id) {
  const rows = await query(`SELECT p.*, GREATEST(0, COALESCE(p.total_slots, 1) - (SELECT COUNT(*) FROM bookings slot_booking WHERE slot_booking.property_id = p.id AND slot_booking.status = 'approved')) AS rentable_slots_available, COALESCE((SELECT SUM(COALESCE(b.occupants, 1)) FROM bookings b WHERE b.property_id = p.id AND b.status = 'approved'), 0) AS occupied_units, EXISTS(SELECT 1 FROM media_files proof WHERE proof.id = p.ownership_document_id AND proof.uploaded_by = p.owner_id AND proof.is_private = 1) AS has_ownership_proof, COALESCE(NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''), NULLIF(TRIM(u.name), '')) AS owner_name, u.email AS owner_email, u.avatar_url AS owner_avatar_url, u.status AS owner_status FROM properties p JOIN users u ON u.id = p.owner_id WHERE p.id = ? LIMIT 1`, [id]);
  const property = rows[0];
  if (!property) return null;
  const { rentable_slots_available, ...details } = property;
  return { ...details, available_slots: Number(rentable_slots_available ?? 0) };
}

export async function countPendingByOwner(ownerId) {
  const rows = await query("SELECT COUNT(*) AS count FROM properties WHERE owner_id = ? AND status = 'pending'", [ownerId]);
  return Number(rows[0]?.count ?? 0);
}

export async function findDuplicateAddress({ ownerId, address, municipality, barangay, excludeId = null }) {
  const excludeClause = excludeId ? ' AND id <> ?' : '';
  const values = [ownerId, address, municipality, barangay ?? ''];
  if (excludeId) values.push(excludeId);
  const rows = await query(
    `SELECT id, title FROM properties
     WHERE owner_id = ? AND status IN ('pending', 'approved')
       AND LOWER(TRIM(address)) = LOWER(TRIM(?))
       AND LOWER(TRIM(municipality)) = LOWER(TRIM(?))
       AND LOWER(TRIM(COALESCE(barangay, ''))) = LOWER(TRIM(?))${excludeClause}
     LIMIT 1`,
    values
  );
  return rows[0] ?? null;
}

export async function findOwnershipDocument(id) {
  const rows = await query(
    `SELECT m.id, m.original_filename, m.mime_type
     FROM properties p
     JOIN media_files m ON m.id = p.ownership_document_id AND m.uploaded_by = p.owner_id AND m.is_private = 1
     WHERE p.id = ? LIMIT 1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function create(ownerId, input) {
  const totalSlots = Math.max(1, Number(input.totalSlots ?? 1));
  const result = await query("INSERT INTO properties (owner_id, title, description, address, municipality, barangay, latitude, longitude, room_type, monthly_rent, max_occupants, total_slots, available_slots, gender_preference, amenities, image_url, images, ownership_document_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')", [ownerId, input.title, input.description ?? null, input.address, input.municipality, input.barangay ?? null, input.latitude ?? null, input.longitude ?? null, input.roomType, input.monthlyRent, input.maxOccupants ?? null, totalSlots, totalSlots, input.genderPreference ?? null, input.amenities ?? null, input.imageUrl ?? null, JSON.stringify(input.images ?? []), input.ownershipDocumentId ?? null]);
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
    total_slots = COALESCE(?, total_slots),
    gender_preference = COALESCE(?, gender_preference),
    amenities = COALESCE(?, amenities),
    image_url = COALESCE(?, image_url),
    images = COALESCE(?, images),
    ownership_document_id = COALESCE(?, ownership_document_id),
    status = COALESCE(?, status)
  WHERE id = ?`, [input.title ?? null, input.description ?? null, input.address ?? null, input.municipality ?? null, input.barangay ?? null, input.latitude ?? null, input.longitude ?? null, input.roomType ?? null, input.monthlyRent ?? null, input.maxOccupants ?? null, input.totalSlots ?? null, input.genderPreference ?? null, input.amenities ?? null, input.imageUrl ?? null, input.images ? JSON.stringify(input.images) : null, input.ownershipDocumentId ?? null, input.status ?? null, id]);
  return syncAvailability(id);
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
  const totalSlots = Math.max(0, Number(property.total_slots ?? 1));
  const [row] = await query('SELECT COUNT(*) AS occupied_slots FROM bookings WHERE property_id = ? AND status = ?', [id, 'approved']);
  const occupiedSlots = Math.max(0, Number(row?.occupied_slots ?? 0));
  const availableSlots = Math.max(0, totalSlots - occupiedSlots);
  await query('UPDATE properties SET available_slots = ? WHERE id = ?', [availableSlots, id]);
  return { ...property, available_slots: availableSlots, occupied_slots: occupiedSlots };
}

export async function updateStatus(id, status) {
  await query('UPDATE properties SET status = ? WHERE id = ?', [status, id]);
  return findById(id);
}

export async function archive(id) {
  const result = await query(
    "UPDATE properties SET archived_status = status, status = 'archived', archived_at = NOW() WHERE id = ? AND status != 'archived'",
    [id]
  );
  return result.affectedRows ? findById(id) : null;
}

export async function restore(id) {
  const result = await query(
    "UPDATE properties SET status = COALESCE(archived_status, 'pending'), archived_status = NULL, archived_at = NULL WHERE id = ? AND status = 'archived'",
    [id]
  );
  return result.affectedRows ? findById(id) : null;
}

export async function remove(id) {
  await query('DELETE FROM bookings WHERE property_id = ?', [id]);
  return query('DELETE FROM properties WHERE id = ?', [id]);
}

export async function attachUploadedImages(id, images, uploaderId) {
  const ids = images.map((image) => Number(String(image).match(/^\/api\/v1\/media\/(\d+)$/)?.[1])).filter(Number.isInteger);
  if (ids.length) await mediaFiles.attachStagedToProperty(ids, id, uploaderId);
}
