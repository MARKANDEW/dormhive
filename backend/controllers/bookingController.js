import * as bookings from '../models/Booking.js';
import { createConversation } from '../models/Message.js';
import { findById as findPropertyById } from '../models/Property.js';

export async function create(request, response, next) {
  try {
    const property = await findPropertyById(request.body.propertyId);
    if (!property || property.status !== 'approved') return response.status(404).json({ message: 'Property not found.' });
    if (property.owner_id === request.user.id) return response.status(422).json({ message: 'You cannot book your own property.' });
    if (Number(request.body.occupants) > property.max_occupants) return response.status(422).json({ message: 'Occupants exceed the property capacity.' });
    const booking = await bookings.create(request.user.id, request.body);
    await createConversation({ tenantId: request.user.id, ownerId: property.owner_id, propertyId: property.id });
    response.status(201).json({ data: booking });
  } catch (error) { next(error); }
}

export async function list(request, response, next) { try { response.json({ data: await bookings.listForUser(request.user) }); } catch (error) { next(error); } }

export async function get(request, response, next) {
  try {
    const booking = await bookings.findById(request.params.id);
    if (!booking) return response.status(404).json({ message: 'Booking not found.' });
    const mayView = request.user.role === 'admin' || booking.tenant_id === request.user.id || booking.owner_id === request.user.id;
    return mayView ? response.json({ data: booking }) : response.status(403).json({ message: 'Permission denied.' });
  } catch (error) { next(error); }
}

export async function updateStatus(request, response, next) {
  try {
    const booking = await bookings.findById(request.params.id);
    if (!booking) return response.status(404).json({ message: 'Booking not found.' });
    const allowed = request.user.role === 'admin' || booking.owner_id === request.user.id || (booking.tenant_id === request.user.id && request.body.status === 'cancelled');
    if (!allowed) return response.status(403).json({ message: 'Permission denied.' });
    if (!['approved', 'rejected', 'cancelled'].includes(request.body.status)) return response.status(422).json({ message: 'Invalid booking status.' });
    response.json({ data: await bookings.updateStatus(booking.id, request.body.status) });
  } catch (error) { next(error); }
}
