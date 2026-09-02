import * as bookings from '../models/Booking.js';
import * as messages from '../models/Message.js';
import { query } from '../config/database.js';
import { findById as findPropertyById } from '../models/Property.js';

export async function listConversations(request, response, next) {
  try { response.json({ data: await messages.conversationsFor(request.user) }); } catch (error) { next(error); }
}

export async function getConversation(request, response, next) {
  try {
    const conversation = await messages.conversationFor(request.params.id, request.user);
    if (!conversation) return response.status(404).json({ message: 'Conversation not found.' });
    await messages.markRead(conversation.id, request.user.id);
    response.json({ data: await messages.history(conversation.id) });
  } catch (error) { next(error); }
}

export async function createConversation(request, response, next) {
  try {
    let selectedBooking = request.body.bookingId ? await bookings.findById(request.body.bookingId) : null;
    const property = request.body.propertyId ? await findPropertyById(request.body.propertyId) : selectedBooking ? await findPropertyById(selectedBooking.property_id) : null;

    if (!selectedBooking && request.body.tenantId && request.body.propertyId) {
      const bookingRows = await query('SELECT * FROM bookings WHERE tenant_id = ? AND property_id = ? ORDER BY created_at DESC LIMIT 1', [request.body.tenantId, request.body.propertyId]);
      if (bookingRows[0]) selectedBooking = bookingRows[0];
    }

    let ownerId = request.body.ownerId ? Number(request.body.ownerId) : null;
    let tenantId = request.body.tenantId ? Number(request.body.tenantId) : null;

    if (!tenantId && request.user.role === 'tenant') {
      tenantId = request.user.id;
    }
    if (!ownerId && request.user.role === 'owner') {
      ownerId = request.user.id;
    }

    if (!ownerId && property?.owner_id) {
      ownerId = property.owner_id;
    }
    if (!tenantId && selectedBooking?.tenant_id) {
      tenantId = selectedBooking.tenant_id;
    }

    if (!tenantId && request.user.role === 'owner' && (property?.id ?? selectedBooking?.property_id)) {
      const bookingRows = await query('SELECT tenant_id FROM bookings WHERE property_id = ? ORDER BY created_at DESC LIMIT 1', [property?.id ?? selectedBooking?.property_id]);
      tenantId = Number(bookingRows[0]?.tenant_id ?? null);
    }

    if (!ownerId || !tenantId) return response.status(422).json({ message: 'A valid tenant and owner are required.' });
    if (request.user.role !== 'tenant' && request.user.role !== 'owner') return response.status(403).json({ message: 'Permission denied.' });
    if (request.user.role === 'tenant' && request.user.id !== tenantId) return response.status(403).json({ message: 'Permission denied.' });
    if (request.user.role === 'owner' && request.user.id !== ownerId) return response.status(403).json({ message: 'Permission denied.' });
    if (property && property.status !== 'approved') return response.status(404).json({ message: 'Property not found.' });

    const conversation = await messages.createConversation({ tenantId, ownerId, propertyId: property?.id ?? selectedBooking?.property_id ?? null });
    const summary = await messages.conversationSummaryFor(conversation.id, request.user);
    response.status(201).json({ data: summary ?? conversation });
  } catch (error) { next(error); }
}

export async function send(request, response, next) {
  try {
    const conversation = await messages.conversationFor(request.body.conversationId, request.user);
    if (!conversation) return response.status(404).json({ message: 'Conversation not found.' });
    response.status(201).json({ data: await messages.send(conversation.id, request.user.id, request.body.body.trim()) });
  } catch (error) { next(error); }
}

export async function markRead(request, response, next) {
  try {
    const conversation = await messages.conversationFor(request.params.id, request.user);
    if (!conversation) return response.status(404).json({ message: 'Conversation not found.' });
    await messages.markRead(conversation.id, request.user.id);
    response.status(204).end();
  } catch (error) { next(error); }
}

export async function remove(request, response, next) {
  try {
    const removed = await messages.remove(request.params.id, request.user.id);
    return removed ? response.status(204).end() : response.status(404).json({ message: 'Message not found.' });
  } catch (error) { next(error); }
}
