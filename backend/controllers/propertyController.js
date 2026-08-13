import * as notifications from '../models/Notification.js';
import * as properties from '../models/Property.js';

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
    const amenitiesRaw = request.body.amenities;
    const amenities = Array.isArray(amenitiesRaw)
      ? JSON.stringify(amenitiesRaw)
      : amenitiesRaw
        ? JSON.stringify([amenitiesRaw])
        : null;
    const input = {
      ...request.body,
      imageUrl: request.file ? `/uploads/properties/${request.file.filename}` : request.body.imageUrl ?? null,
      availableSlots: Number(request.body.availableSlots ?? request.body.available_slots ?? 0) || null,
      genderPreference: request.body.genderPreference ?? request.body.gender_preference ?? null,
      amenities
    };
    response.status(201).json({ data: await properties.create(request.user.id, input) });
  } catch (error) { next(error); }
}

export async function update(request, response, next) {
  try {
    const property = await properties.findById(request.params.id);
    if (!property) return response.status(404).json({ message: 'Property not found.' });
    if (property.owner_id !== request.user.id && request.user.role !== 'admin') return response.status(403).json({ message: 'Permission denied.' });
    if (request.body.status && request.user.role !== 'admin') {
      return response.status(403).json({ message: 'Only admins can change property status.' });
    }
    response.json({ data: await properties.update(request.params.id, request.body) });
  } catch (error) { next(error); }
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
