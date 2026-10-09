import * as notifications from '../models/Notification.js';
import * as properties from '../models/Property.js';
import * as mediaFiles from '../models/Media.js';
import { validateUpload } from '../utils/fileValidation.js';

const parseImages = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [value];
  } catch { return [value]; }
};

const validateImageReferences = (values) => {
  const references = [...new Set(values.filter((value) => typeof value === 'string' && value.trim()))];
  const invalid = references.some((value) => !/^\/api\/v1\/media\/\d+$/.test(value));
  if (invalid) {
    const error = new Error('Property photos must be uploaded to database storage first; legacy filesystem paths are not accepted.');
    error.statusCode = 422;
    error.expose = true;
    throw error;
  }
  return references;
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
    const requestedImages = parseImages(request.body.images);
    const imageReferences = validateImageReferences([...requestedImages, request.body.imageUrl]);
    const stagedImages = imageReferences.filter((image) => /^\/api\/v1\/media\/\d+$/.test(image));
    const fileMetadata = uploadedFiles.map((file) => ({ file, ...validateUpload(file, { imagesOnly: true }) }));
    const stagedIds = stagedImages.map((image) => Number(image.match(/^\/api\/v1\/media\/(\d+)$/)[1]));
    await mediaFiles.assertPropertyPhotosAvailable(stagedIds, null, request.user.id);
    const amenitiesRaw = request.body.amenities;
    const amenities = Array.isArray(amenitiesRaw)
      ? JSON.stringify(amenitiesRaw)
      : amenitiesRaw
        ? JSON.stringify([amenitiesRaw])
        : null;
    const input = {
      ...request.body,
      imageUrl: imageReferences[0] ?? (fileMetadata.length ? null : request.body.imageUrl ?? null),
      images: imageReferences,
      availableSlots: Number(request.body.availableSlots ?? request.body.available_slots ?? 0) || null,
      genderPreference: request.body.genderPreference ?? request.body.gender_preference ?? null,
      amenities
    };
    const property = await properties.create(request.user.id, input);
    await properties.attachUploadedImages(property.id, stagedImages, request.user.id);
    for (const item of fileMetadata) {
      const stored = await mediaFiles.create({
        uploadedBy: request.user.id,
        propertyId: property.id,
        filename: item.filename,
        mimeType: item.mimeType,
        buffer: item.file.buffer
      });
      stagedImages.push(stored.url);
    }
    if (fileMetadata.length) await properties.update(property.id, { imageUrl: stagedImages[0], images: stagedImages });
    response.status(201).json({ data: await properties.findById(property.id) });
  } catch (error) { next(error); }
}

export async function update(request, response, next) {
  try {
    const uploadedFiles = [...(request.files?.images ?? []), ...(request.files?.image ?? [])];
    const requestedImages = parseImages(request.body.images);
    const imageReferences = validateImageReferences([...requestedImages, request.body.imageUrl]);
    const stagedImages = imageReferences.filter((image) => /^\/api\/v1\/media\/\d+$/.test(image));
    const fileMetadata = uploadedFiles.map((file) => ({ file, ...validateUpload(file, { imagesOnly: true }) }));
    const property = await properties.findById(request.params.id);
    if (!property) return response.status(404).json({ message: 'Property not found.' });
    if (property.owner_id !== request.user.id && request.user.role !== 'admin') return response.status(403).json({ message: 'Permission denied.' });
    const stagedIds = stagedImages.map((image) => Number(image.match(/^\/api\/v1\/media\/(\d+)$/)[1]));
    await mediaFiles.assertPropertyPhotosAvailable(stagedIds, property.id, request.user.id);

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
      imageUrl: undefined,
      images: undefined,
      availableSlots: Number(request.body.availableSlots ?? request.body.available_slots ?? 0) || null,
      genderPreference: request.body.genderPreference ?? request.body.gender_preference ?? null,
      amenities
    };

    const updated = await properties.update(request.params.id, input);
    await properties.attachUploadedImages(request.params.id, stagedImages, request.user.id);
    const addedImageUrls = [];
    const photoFieldsProvided = request.body.images !== undefined || request.body.imageUrl !== undefined;
    if (fileMetadata.length) {
      for (const item of fileMetadata) {
        const stored = await mediaFiles.create({
          uploadedBy: request.user.id,
          propertyId: request.params.id,
          filename: item.filename,
          mimeType: item.mimeType,
          buffer: item.file.buffer
        });
        addedImageUrls.push(stored.url);
      }
    }
    const photosChanged = photoFieldsProvided || fileMetadata.length > 0;
    let savedImages = [];
    if (photosChanged) {
      if (request.body.images !== undefined) {
        savedImages = [...imageReferences, ...addedImageUrls];
      } else {
        const existingImages = [
          ...(property.image_url ? [property.image_url] : []),
          ...parseImages(property.images)
        ];
        savedImages = [...new Set([...existingImages, ...imageReferences, ...addedImageUrls])];
      }
      const imageUrl = request.body.images !== undefined
        ? savedImages[0] ?? null
        : request.body.imageUrl !== undefined
          ? imageReferences[0] ?? null
          : property.image_url ?? savedImages[0] ?? null;
      await properties.replaceImages(request.params.id, imageUrl, savedImages);
      const retainedIds = [...savedImages, imageUrl]
        .map((image) => Number(String(image).match(/^\/api\/v1\/media\/(\d+)$/)?.[1]))
        .filter(Number.isInteger);
      await mediaFiles.removePropertyPhotosNotIn(request.params.id, retainedIds);
    }
    response.json({ data: photosChanged ? await properties.findById(request.params.id) : updated });
  } catch (error) { next(error); }
}

export async function addImage(request, response, next) {
  try {
    const property = await properties.findById(request.params.id);
    if (!property) return response.status(404).json({ message: 'Property not found.' });
    if (property.owner_id !== request.user.id && request.user.role !== 'admin') return response.status(403).json({ message: 'Permission denied.' });
    if (!request.file) return response.status(422).json({ message: 'An image is required.' });
    const file = validateUpload(request.file, { imagesOnly: true });
    const stored = await mediaFiles.create({
      uploadedBy: request.user.id,
      propertyId: request.params.id,
      filename: file.filename,
      mimeType: file.mimeType,
      buffer: request.file.buffer
    });
    const imageUrl = stored.url;
    const updated = await properties.appendImage(request.params.id, imageUrl);
    response.status(201).json({ data: updated });
  } catch (error) { next(error); }
}

export async function uploadImage(request, response, next) {
  try {
    if (!request.file) return response.status(422).json({ message: 'An image is required.' });
    const file = validateUpload(request.file, { imagesOnly: true });
    const stored = await mediaFiles.create({
      uploadedBy: request.user.id,
      filename: file.filename,
      mimeType: file.mimeType,
      buffer: request.file.buffer
    });
    response.status(201).json({ data: { imageUrl: stored.url, fileId: stored.id } });
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
