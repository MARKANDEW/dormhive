import * as bookings from '../models/Booking.js';
import * as properties from '../models/Property.js';
import { createConversation } from '../models/Message.js';
import { findById as findPropertyById } from '../models/Property.js';

function isValidSqlDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function resolveMoveOutSchedule(moveInDate, moveOutDate, indefiniteValue = false) {
  if (!isValidSqlDate(moveInDate)) return { valid: false, message: 'Provide a valid move-in date.' };
  const isIndefinite = indefiniteValue === true || indefiniteValue === 1 || indefiniteValue === '1' || indefiniteValue === 'true';
  if (isIndefinite) return { valid: true, moveOutDate: null, isIndefiniteMoveOut: true };
  if (!moveOutDate) return { valid: true, moveOutDate: null, isIndefiniteMoveOut: false };
  if (!isValidSqlDate(moveOutDate)) return { valid: false, message: 'Provide a valid move-out date.' };
  if (moveOutDate <= moveInDate) return { valid: false, message: 'Move-out date must be after the move-in date.' };
  return { valid: true, moveOutDate, isIndefiniteMoveOut: false };
}

export async function create(request, response, next) {
  try {
    const moveOutSchedule = resolveMoveOutSchedule(
      request.body.moveInDate,
      request.body.moveOutDate,
      request.body.isIndefiniteMoveOut
    );
    if (!moveOutSchedule.valid) return response.status(422).json({ message: moveOutSchedule.message });

    const viewingSchedule = resolveViewingSchedule(request.body.viewingDate, request.body.viewingTime);
    if (!viewingSchedule.valid) return response.status(422).json({ message: viewingSchedule.message });

    const property = await findPropertyById(request.body.propertyId);
    if (!property || property.status !== 'approved') return response.status(404).json({ message: 'Property not found.' });
    if (property.owner_id === request.user.id) return response.status(422).json({ message: 'You cannot book your own property.' });
    if (Number(request.body.occupants) > property.max_occupants) return response.status(422).json({ message: 'Occupants exceed the property capacity.' });
    const booking = await bookings.create(request.user.id, { ...request.body, ...moveOutSchedule, ...viewingSchedule });
    await createConversation({ tenantId: request.user.id, ownerId: property.owner_id, propertyId: property.id });
    response.status(201).json({ data: booking });
  } catch (error) { next(error); }
}

export async function list(request, response, next) { try { response.json({ data: await bookings.listForUser(request.user) }); } catch (error) { next(error); } }

export async function updateMoveOut(request, response, next) {
  try {
    const booking = await bookings.findById(request.params.id);
    if (!booking) return response.status(404).json({ message: 'Booking not found.' });
    const mayUpdateMoveOut = request.user.role === 'admin' || booking.tenant_id === request.user.id;
    if (!mayUpdateMoveOut) return response.status(403).json({ message: 'Permission denied.' });

    const moveOutSchedule = resolveMoveOutSchedule(
      booking.move_in_date,
      request.body.moveOutDate,
      request.body.isIndefiniteMoveOut
    );
    if (!moveOutSchedule.valid) return response.status(422).json({ message: moveOutSchedule.message });

    response.json({ data: await bookings.updateMoveOut(booking.id, moveOutSchedule.moveOutDate, moveOutSchedule.isIndefiniteMoveOut) });
  } catch (error) { next(error); }
}

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
    const nextStatus = String(request.body.status || '').toLowerCase();
    if (!['approved', 'rejected', 'cancelled'].includes(nextStatus)) return response.status(422).json({ message: 'Invalid booking status.' });
    const previousStatus = String(booking.status || '').toLowerCase();
    const updated = await bookings.updateStatus(booking.id, nextStatus);
    if (previousStatus === 'approved' || nextStatus === 'approved') {
      await properties.syncAvailability(booking.property_id);
    }
    response.json({ data: updated });
  } catch (error) { next(error); }
}

export function isValidViewingSchedule(viewingDate, viewingTime) {
  if (typeof viewingDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(viewingDate)) return false;
  if (typeof viewingTime !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(viewingTime)) return false;
  const parsedDate = new Date(`${viewingDate}T00:00:00.000Z`);
  return !Number.isNaN(parsedDate.getTime()) && parsedDate.toISOString().slice(0, 10) === viewingDate;
}

export function resolveViewingSchedule(viewingDate, viewingTime) {
  const hasDate = Boolean(viewingDate);
  const hasTime = Boolean(viewingTime);
  if (!hasDate && !hasTime) return { valid: true, viewingDate: null, viewingTime: null };
  if (!hasDate || !hasTime || !isValidViewingSchedule(viewingDate, viewingTime)) {
    return { valid: false, message: 'Provide both a valid viewing date and time, or leave both blank.' };
  }
  return { valid: true, viewingDate, viewingTime };
}

export function canTenantEditViewingSchedule(booking, user) {
  return user?.role === 'tenant'
    && String(booking?.tenant_id) === String(user.id)
    && booking?.status === 'pending';
}

export async function updateViewingSchedule(request, response, next) {
  try {
    const booking = await bookings.findById(request.params.id);
    if (!booking) return response.status(404).json({ message: 'Booking not found.' });
    if (request.user.role !== 'tenant' || String(booking.tenant_id) !== String(request.user.id)) {
      return response.status(403).json({ message: 'Only the tenant can manage the viewing schedule.' });
    }
    if (!canTenantEditViewingSchedule(booking, request.user)) {
      return response.status(409).json({ message: 'The viewing schedule is locked after the inquiry is reviewed.' });
    }

    const { viewingDate, viewingTime } = request.body;
    if (!isValidViewingSchedule(viewingDate, viewingTime)) {
      return response.status(422).json({ message: 'Provide a valid viewing date and time.' });
    }

    response.json({ data: await bookings.updateViewingSchedule(booking.id, viewingDate, viewingTime) });
  } catch (error) { next(error); }
}

export async function ticket(request, response, next) {
  try {
    const booking = await bookings.findById(request.params.id);
    if (!booking) return response.status(404).json({ message: 'Booking not found.' });
    
    // Only tenant can view their own ticket, or admin can view any
    const canView = request.user.role === 'admin' || booking.tenant_id === request.user.id;
    if (!canView) return response.status(403).json({ message: 'Permission denied.' });
    
    // Return ticket as HTML document
    const formatDate = (dateStr) => {
      if (!dateStr) return 'TBA';
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };
    
    const ticketId = `DHB${String(booking.id).padStart(6, '0')}`;
    const moveInDate = formatDate(booking.move_in_date);
    const moveOutDate = booking.is_indefinite_move_out ? 'Indefinite' : formatDate(booking.move_out_date);
    const datesRange = booking.is_indefinite_move_out ? `${moveInDate} - Indefinite` : booking.move_out_date ? `${moveInDate} - ${moveOutDate}` : moveInDate;
    const price = booking.monthly_rent ? `₱${Number(booking.monthly_rent).toLocaleString('en-PH')}` : '—';
    
    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>E-Ticket - ${ticketId}</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background: #f5f5f5;
            color: #333;
          }
          .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          }
          .ticket-header {
            text-align: center;
            border-bottom: 2px solid #1f8c75;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .ticket-header h1 {
            margin: 0 0 5px;
            color: #2f2723;
          }
          .ticket-id {
            font-size: 14px;
            color: #8a7f75;
            letter-spacing: 1px;
          }
          .ticket-content {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
            margin-bottom: 30px;
          }
          .section {
            display: grid;
            gap: 12px;
          }
          .section-title {
            font-size: 12px;
            color: #8a7f75;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            font-weight: 700;
          }
          .field {
            display: grid;
            gap: 4px;
          }
          .field-label {
            font-size: 12px;
            color: #8a7f75;
          }
          .field-value {
            font-size: 16px;
            color: #2f2723;
            font-weight: 600;
          }
          .dates-section {
            grid-column: 1 / -1;
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 20px;
            padding: 20px;
            background: #e7f8f2;
            border-radius: 6px;
            margin-bottom: 20px;
          }
          .dates-item {
            text-align: center;
          }
          .dates-item-value {
            font-size: 18px;
            font-weight: 700;
            color: #1f8c75;
            margin-bottom: 4px;
          }
          .dates-item-label {
            font-size: 12px;
            color: #8a7f75;
          }
          .status-confirmed {
            display: inline-block;
            background: #e6f8ed;
            color: #1d7b47;
            padding: 6px 12px;
            border-radius: 999px;
            font-size: 12px;
            font-weight: 700;
            margin-bottom: 20px;
          }
          .footer {
            border-top: 1px solid #d6ebe2;
            padding-top: 20px;
            font-size: 12px;
            color: #8a7f75;
            text-align: center;
          }
          .print-btn {
            display: block;
            margin: 20px auto;
            padding: 10px 20px;
            background: #1f8c75;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 600;
          }
          .print-btn:hover {
            background: #16705e;
          }
          @media print {
            .print-btn { display: none; }
            body { background: white; }
            .container { box-shadow: none; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="ticket-header">
            <h1>Booking Confirmation</h1>
            <div class="ticket-id">Ticket ID: ${ticketId}</div>
          </div>
          
          <span class="status-confirmed">✓ Confirmed</span>
          
          <div class="ticket-content">
            <div class="section">
              <div class="section-title">Property</div>
              <div class="field">
                <div class="field-label">Name</div>
                <div class="field-value">${booking.property_title || 'Property'}</div>
              </div>
              <div class="field">
                <div class="field-label">Price</div>
                <div class="field-value">${price}/month</div>
              </div>
            </div>
            
            <div class="section">
              <div class="section-title">Booking Details</div>
              <div class="field">
                <div class="field-label">Booking Date</div>
                <div class="field-value">${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
              </div>
              <div class="field">
                <div class="field-label">Occupants</div>
                <div class="field-value">${booking.occupants || 1}</div>
              </div>
            </div>
          </div>
          
          <div class="dates-section">
            <div class="dates-item">
              <div class="dates-item-value">${formatDate(booking.move_in_date)}</div>
              <div class="dates-item-label">Check-in</div>
            </div>
            <div class="dates-item">
              <div class="dates-item-label">—</div>
              <div class="dates-item-label">Duration</div>
            </div>
            <div class="dates-item">
              <div class="dates-item-value">${moveOutDate}</div>
              <div class="dates-item-label">Check-out</div>
            </div>
          </div>
          
          <button class="print-btn" onclick="window.print()">Print E-Ticket</button>
          
          <div class="footer">
            <p>This e-ticket confirms your booking. Please bring this confirmation when checking in.</p>
            <p style="margin-top: 10px;">Questions? Contact your property landlord for assistance.</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.send(html);
  } catch (error) { next(error); }
}
