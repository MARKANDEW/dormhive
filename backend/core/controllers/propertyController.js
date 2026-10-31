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

const MAX_PROPERTY_PHOTO_SIZE = 2 * 1024 * 1024;
const MAX_OWNERSHIP_PROOF_SIZE = 5 * 1024 * 1024;
const ownershipProofTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

function validatePropertyPhotos(files) {
  return files.map((file) => {
    if (file.buffer.length > MAX_PROPERTY_PHOTO_SIZE) {
      const error = new Error('Property photos must be no larger than 2 MB each.');
      error.statusCode = 422;
      error.expose = true;
      throw error;
    }
    return { file, ...validateUpload(file, { imagesOnly: true }) };
  });
}

function validateOwnershipProof(file, required) {
  if (!file) {
    if (!required) return null;
    const error = new Error('Upload proof of ownership or authorization for this property.');
    error.statusCode = 422;
    error.expose = true;
    throw error;
  }
  if (file.buffer.length > MAX_OWNERSHIP_PROOF_SIZE) {
    const error = new Error('Ownership proof must be no larger than 5 MB.');
    error.statusCode = 422;
    error.expose = true;
    throw error;
  }
  const proof = validateUpload(file);
  if (!ownershipProofTypes.includes(proof.mimeType)) {
    const error = new Error('Ownership proof must be a JPEG, PNG, WEBP, or PDF file.');
    error.statusCode = 422;
    error.expose = true;
    throw error;
  }
  return proof;
}

async function validateOwnerListing({ request, address, municipality, barangay, excludeId = null, needsPendingSlot = true }) {
  if (request.user.role !== 'owner') return;
  if (needsPendingSlot && await properties.countPendingByOwner(request.user.id) >= 3) {
    const error = new Error('You can have up to 3 listings awaiting review at a time. Wait for a review before submitting another.');
    error.statusCode = 409;
    error.expose = true;
    throw error;
  }
  const duplicate = await properties.findDuplicateAddress({
    ownerId: request.user.id,
    address,
    municipality,
    barangay,
    excludeId
  });
  if (duplicate) {
    const error = new Error(`You already have a pending or approved listing at this address (${duplicate.title || 'existing listing'}).`);
    error.statusCode = 409;
    error.expose = true;
    throw error;
  }
}

function withoutOwnershipDocument(property) {
  if (!property) return property;
  const { ownership_document_id: _ownershipDocumentId, has_ownership_proof: _hasOwnershipProof, ...publicProperty } = property;
  return publicProperty;
}

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
    const data = result.rows.map((property) => ['admin', 'owner'].includes(request.user?.role)
      ? { ...withoutOwnershipDocument(property), has_ownership_proof: Boolean(property.has_ownership_proof) }
      : withoutOwnershipDocument(property));
    response.json({ data, pagination: { page, limit, total: result.total } });
  } catch (error) { next(error); }
}

export async function get(request, response, next) {
  try {
    const property = await properties.findById(request.params.id);
    const mayView = (property?.status === 'approved' && property?.owner_status === 'active')
      || property?.owner_id === request.user?.id
      || request.user?.role === 'admin';
    if (!mayView) return response.status(404).json({ message: 'Property not found.' });
    const responseProperty = withoutOwnershipDocument(property);
    if (['owner', 'admin'].includes(request.user?.role)) {
      responseProperty.has_ownership_proof = Boolean(property.has_ownership_proof);
    }
    return response.json({ data: responseProperty });
  } catch (error) { next(error); }
}

export async function ownershipDocument(request, response, next) {
  try {
    const property = await properties.findById(request.params.id);
    if (!property) return response.status(404).json({ message: 'Property not found.' });
    const document = await properties.findOwnershipDocument(request.params.id);
    return document
      ? response.json({ data: { id: document.id, filename: document.original_filename, mimeType: document.mime_type } })
      : response.status(404).json({ message: 'No ownership or authorization proof was uploaded for this listing.' });
  } catch (error) { next(error); }
}

export async function create(request, response, next) {
  try {
    const totalSlots = Number(request.body.totalSlots);
    if (!Number.isInteger(totalSlots) || totalSlots < 1) {
      return response.status(422).json({ message: 'Total rental slots must be a whole number greater than zero.' });
    }
    const uploadedFiles = [...(request.files?.images ?? []), ...(request.files?.image ?? [])];
    const ownershipProofFile = request.files?.ownershipProof?.[0] ?? null;
    const proofMetadata = validateOwnershipProof(ownershipProofFile, request.user.role === 'owner');
    const requestedImages = parseImages(request.body.images);
    const imageReferences = validateImageReferences([...requestedImages, request.body.imageUrl]);
    const stagedImages = imageReferences.filter((image) => /^\/api\/v1\/media\/\d+$/.test(image));
    const fileMetadata = validatePropertyPhotos(uploadedFiles);
    const stagedIds = stagedImages.map((image) => Number(image.match(/^\/api\/v1\/media\/(\d+)$/)[1]));
    await mediaFiles.assertPropertyPhotosAvailable(stagedIds, null, request.user.id);
    await validateOwnerListing({
      request,
      address: request.body.address,
      municipality: request.body.municipality,
      barangay: request.body.barangay
    });
    const amenitiesRaw = request.body.amenities;
    const amenities = Array.isArray(amenitiesRaw)
      ? JSON.stringify(amenitiesRaw)
      : amenitiesRaw
        ? JSON.stringify([amenitiesRaw])
        : null;
    const input = {
      ...request.body,
      totalSlots,
      ownershipDocumentId: null,
      imageUrl: imageReferences[0] ?? (fileMetadata.length ? null : request.body.imageUrl ?? null),
      images: imageReferences,
      genderPreference: request.body.genderPreference ?? request.body.gender_preference ?? null,
      amenities
    };
    let property;
    try {
      property = await properties.create(request.user.id, input);
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
      if (proofMetadata) {
        const ownershipDocument = await mediaFiles.create({
          uploadedBy: request.user.id,
          propertyId: property.id,
          isPrivate: true,
          filename: proofMetadata.filename,
          mimeType: proofMetadata.mimeType,
          buffer: ownershipProofFile.buffer
        });
        property = await properties.update(property.id, { ownershipDocumentId: ownershipDocument.id });
      }
    } catch (error) {
      if (property?.id) await properties.remove(property.id).catch(() => {});
      throw error;
    }
    response.status(201).json({ data: withoutOwnershipDocument(await properties.findById(property.id)) });
  } catch (error) { next(error); }
}

export async function update(request, response, next) {
  try {
    if (request.body.totalSlots !== undefined) {
      const totalSlots = Number(request.body.totalSlots);
      if (!Number.isInteger(totalSlots) || totalSlots < 1) {
        return response.status(422).json({ message: 'Total rental slots must be a whole number greater than zero.' });
      }
      request.body.totalSlots = totalSlots;
    }
    const uploadedFiles = [...(request.files?.images ?? []), ...(request.files?.image ?? [])];
    const ownershipProofFile = request.files?.ownershipProof?.[0] ?? null;
    const proofMetadata = validateOwnershipProof(ownershipProofFile, false);
    const requestedImages = parseImages(request.body.images);
    const imageReferences = validateImageReferences([...requestedImages, request.body.imageUrl]);
    const stagedImages = imageReferences.filter((image) => /^\/api\/v1\/media\/\d+$/.test(image));
    const fileMetadata = validatePropertyPhotos(uploadedFiles);
    const property = await properties.findById(request.params.id);
    if (!property) return response.status(404).json({ message: 'Property not found.' });
    if (property.owner_id !== request.user.id && request.user.role !== 'admin') return response.status(403).json({ message: 'Permission denied.' });
    const stagedIds = stagedImages.map((image) => Number(image.match(/^\/api\/v1\/media\/(\d+)$/)[1]));
    await mediaFiles.assertPropertyPhotosAvailable(stagedIds, property.id, request.user.id);

    const requestedStatus = typeof request.body.status === 'string' ? request.body.status.trim().toLowerCase() : '';
    const isOwnerEdit = request.user.role === 'owner';
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
    if (requestedStatus === 'approved' && !await properties.findOwnershipDocument(property.id)) {
      return response.status(409).json({ message: 'This listing cannot be approved until the owner uploads proof of ownership or authorization.' });
    }

    const address = request.body.address ?? property.address;
    const municipality = request.body.municipality ?? property.municipality;
    const barangay = request.body.barangay ?? property.barangay;
    const addressChanged = [address, municipality, barangay ?? ''].some((value, index) =>
      String(value ?? '').trim().toLowerCase() !== String([property.address, property.municipality, property.barangay ?? ''][index] ?? '').trim().toLowerCase()
    );
    const proofRequired = isOwnerEdit && requestedStatus !== 'archived'
      && (!property.has_ownership_proof || addressChanged);
    const validatedProof = validateOwnershipProof(ownershipProofFile, proofRequired);

    if (isOwnerEdit && requestedStatus !== 'archived') {
      await validateOwnerListing({
        request,
        address,
        municipality,
        barangay,
        excludeId: property.id,
        needsPendingSlot: property.status !== 'pending'
      });
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
      ownershipDocumentId: undefined,
      status: isOwnerEdit && !requestedStatus ? 'pending' : request.body.status ?? null,
      genderPreference: request.body.genderPreference ?? request.body.gender_preference ?? null,
      amenities
    };

    let newOwnershipDocument = null;
    if (validatedProof) {
      newOwnershipDocument = await mediaFiles.create({
        uploadedBy: request.user.id,
        propertyId: property.id,
        isPrivate: true,
        filename: validatedProof.filename,
        mimeType: validatedProof.mimeType,
        buffer: ownershipProofFile.buffer
      });
      input.ownershipDocumentId = newOwnershipDocument.id;
    }

    let updated;
    try {
      updated = requestedStatus === 'archived'
        ? await properties.archive(request.params.id)
        : await properties.update(request.params.id, input);
      if (!updated) {
        if (newOwnershipDocument) await mediaFiles.remove(newOwnershipDocument.id);
        return response.status(409).json({ message: 'This property is already archived.' });
      }
      updated = await properties.syncAvailability(request.params.id) ?? updated;
    } catch (error) {
      if (newOwnershipDocument) await mediaFiles.remove(newOwnershipDocument.id).catch(() => {});
      throw error;
    }
    if (newOwnershipDocument && property.ownership_document_id) {
      await mediaFiles.remove(property.ownership_document_id).catch(() => {});
    }
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
    response.json({ data: withoutOwnershipDocument(photosChanged ? await properties.findById(request.params.id) : updated) });
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

export async function restore(request, response, next) {
  try {
    const property = await properties.findById(request.params.id);
    if (!property) return response.status(404).json({ message: 'Property not found.' });
    if (property.owner_id !== request.user.id && request.user.role !== 'admin') return response.status(403).json({ message: 'Permission denied.' });
    if (property.status !== 'archived') return response.status(409).json({ message: 'This property is not archived.' });
    const restored = await properties.restore(request.params.id);
    return restored ? response.json({ data: withoutOwnershipDocument(restored) }) : response.status(409).json({ message: 'This property could not be restored.' });
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
    if (status === 'approved' && !await properties.findOwnershipDocument(request.params.id)) {
      return response.status(409).json({ message: 'This listing cannot be approved until the owner uploads proof of ownership or authorization.' });
    }

    const rejectionReason = typeof request.body.rejectionReason === 'string' ? request.body.rejectionReason.trim() : '';
    const updated = await properties.updateStatus(request.params.id, status);

    if (status === 'approved') {
      await notifications.create(property.owner_id, 'Property approved', `Your listing "${property.title}" has been approved and is now live for tenants to browse.`);
    } else {
      const reasonText = rejectionReason ? ` Reason: ${rejectionReason}` : '';
      await notifications.create(property.owner_id, 'Property rejected', `Your listing "${property.title}" has been rejected and will remain hidden from tenants.${reasonText}`);
    }

    response.json({ data: withoutOwnershipDocument(updated) });
  } catch (error) { next(error); }
}
