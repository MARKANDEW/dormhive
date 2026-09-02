import * as notifications from '../models/Notification.js';
import * as properties from '../models/Property.js';

const parseImages = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [value];
  } catch { return [value]; }
};

export async function list(request, response, next) {
  try {
    const page = Math.max(1, Number(request.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(request.query.limit) || 20));
    const result = await properties.list({
      page,
      limit,
      viewer: request.user,
      municipality: request.query.municipality,
      roomType: request.query.roomType,
      minPrice: request.query.minPrice,
      maxPrice: request.query.maxPrice,
      status: request.query.status
    });
    response.json({ data: result.rows, pagination: { page, limit, total: result.total } });
  } catch (error) { next(error); }
}

export async function get(request, response, next) {
  try {
    const property = await properties.findById(request.params.id);
    const mayView = property?.status === 'approved' || property?.owner_id === request.user?.id || request.user?.role === 'admin';
    return mayView ? response.json({ data: property }) : response.status(404).json({ message: 'Property not found.' });
  } catch (error) { next(error); }
}

export async function create(request, response, next) {
  try {
    const uploadedFiles = [...(request.files?.images ?? []), ...(request.files?.image ?? [])];
    const amenitiesRaw = request.body.amenities;
    const amenities = Array.isArray(amenitiesRaw)
      ? JSON.stringify(amenitiesRaw)
      : amenitiesRaw
        ? JSON.stringify([amenitiesRaw])
        : null;
    const input = {
      ...request.body,
      imageUrl: uploadedFiles[0] ? `/uploads/properties/${uploadedFiles[0].filename}` : request.body.imageUrl ?? null,
      images: uploadedFiles.length ? uploadedFiles.map((file) => `/uploads/properties/${file.filename}`) : parseImages(request.body.images),
      availableSlots: Number(request.body.availableSlots ?? request.body.available_slots ?? 0) || null,
      genderPreference: request.body.genderPreference ?? request.body.gender_preference ?? null,
      amenities
    };
    response.status(201).json({ data: await properties.create(request.user.id, input) });
  } catch (error) { next(error); }
}

export async function update(request, response, next) {
  try {
    const uploadedFiles = [...(request.files?.images ?? []), ...(request.files?.image ?? [])];
    const property = await properties.findById(request.params.id);
    if (!property) return response.status(404).json({ message: 'Property not found.' });
    if (property.owner_id !== request.user.id && request.user.role !== 'admin') return response.status(403).json({ message: 'Permission denied.' });

    const requestedStatus = typeof request.body.status === 'string' ? request.body.status.trim().toLowerCase() : '';
    if (requestedStatus && request.user.role !== 'admin') {
      const allowedOwnerStatus = ['archived'];
      if (!allowedOwnerStatus.includes(requestedStatus)) {
        return response.status(403).json({ message: 'Only admins can change this property status.' });
      }
      if (property.owner_id !== request.user.id) {
        return response.status(403).json({ message: 'Permission denied.' });
      }
    }

    if (requestedStatus && !['approved', 'rejected', 'archived'].includes(requestedStatus)) {
      return response.status(422).json({ message: 'Invalid property status.' });
    }

    const amenitiesRaw = request.body.amenities;
    const amenities = Array.isArray(amenitiesRaw)
      ? JSON.stringify(amenitiesRaw)
      : typeof amenitiesRaw === 'string' && amenitiesRaw.trim()
        ? JSON.stringify(amenitiesRaw.split(',').map((value) => value.trim()).filter(Boolean))
        : property.amenities;

    const input = {
      ...request.body,
      imageUrl: uploadedFiles[0] ? `/uploads/properties/${uploadedFiles[0].filename}` : request.body.imageUrl ?? null,
      images: uploadedFiles.length ? uploadedFiles.map((file) => `/uploads/properties/${file.filename}`) : parseImages(request.body.images),
      availableSlots: Number(request.body.availableSlots ?? request.body.available_slots ?? 0) || null,
      genderPreference: request.body.genderPreference ?? request.body.gender_preference ?? null,
      amenities
    };

    response.json({ data: await properties.update(request.params.id, input) });
  } catch (error) { next(error); }
}

export async function addImage(request, response, next) {
  try {
    const property = await properties.findById(request.params.id);
    if (!property) return response.status(404).json({ message: 'Property not found.' });
    if (property.owner_id !== request.user.id && request.user.role !== 'admin') return response.status(403).json({ message: 'Permission denied.' });
    if (!request.file) return response.status(422).json({ message: 'An image is required.' });
    const imageUrl = `/uploads/properties/${request.file.filename}`;
    const updated = await properties.appendImage(request.params.id, imageUrl);
    response.status(201).json({ data: updated });
  } catch (error) { next(error); }
}

export function uploadImage(request, response) {
  console.info('[property upload] received', {
    userId: request.user?.id,
    role: request.user?.role,
    field: request.file?.fieldname,
    originalName: request.file?.originalname,
    size: request.file?.size,
    path: request.file?.path
  });
  if (!request.file) return response.status(422).json({ message: 'An image is required.' });
  const imageUrl = `/uploads/properties/${request.file.filename}`;
  console.info('[property upload] stored', { imageUrl, filename: request.file.filename });
  response.status(201).json({ data: { imageUrl, fileId: request.file.filename } });
}

export async function remove(request, response, next) {
  try {
    const property = await properties.findById(request.params.id);
    if (!property) return response.status(404).json({ message: 'Property not found.' });
    if (property.owner_id !== request.user.id && request.user.role !== 'admin') return response.status(403).json({ message: 'Permission denied.' });
    await properties.remove(request.params.id);
    response.status(204).end();
  } catch (error) { next(error); }
}

export async function changeStatus(request, response, next) {
  try {
    if (request.user.role !== 'admin') return response.status(403).json({ message: 'Permission denied.' });
    const property = await properties.findById(request.params.id);
    if (!property) return response.status(404).json({ message: 'Property not found.' });

    const status = String(request.body.status || '').toLowerCase();
    if (!['approved', 'rejected'].includes(status)) {
      return response.status(422).json({ message: 'Status must be approved or rejected.' });
    }

    const rejectionReason = typeof request.body.rejectionReason === 'string' ? request.body.rejectionReason.trim() : '';
    const updated = await properties.updateStatus(request.params.id, status);

    if (status === 'approved') {
      await notifications.create(property.owner_id, 'Property approved', `Your listing "${property.title}" has been approved and is now live for tenants to browse.`);
    } else {
      const reasonText = rejectionReason ? ` Reason: ${rejectionReason}` : '';
      await notifications.create(property.owner_id, 'Property rejected', `Your listing "${property.title}" has been rejected and will remain hidden from tenants.${reasonText}`);
    }

    response.json({ data: updated });
  } catch (error) { next(error); }
}
