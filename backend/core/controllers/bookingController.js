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
    const moveOutDate = formatDate(booking.move_out_date);
    const datesRange = booking.move_out_date ? `${moveInDate} - ${moveOutDate}` : moveInDate;
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
            border-bottom: 2px solid #b07b34;
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
            background: #f9f5f1;
            border-radius: 6px;
            margin-bottom: 20px;
          }
          .dates-item {
            text-align: center;
          }
          .dates-item-value {
            font-size: 18px;
            font-weight: 700;
            color: #b07b34;
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
            border-top: 1px solid #e6dccd;
            padding-top: 20px;
            font-size: 12px;
            color: #8a7f75;
            text-align: center;
          }
          .print-btn {
            display: block;
            margin: 20px auto;
            padding: 10px 20px;
            background: #b07b34;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 600;
          }
          .print-btn:hover {
            background: #9d6a2a;
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
              <div class="dates-item-value">${formatDate(booking.move_out_date)}</div>
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
