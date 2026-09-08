import * as tickets from '../models/SupportTicket.js';

export async function list(request, response, next) {
  try { response.json({ data: await tickets.listForUser(request.user) }); } catch (error) { next(error); }
}

export async function create(request, response, next) {
  try { response.status(201).json({ data: await tickets.create(request.user.id, request.body) }); } catch (error) { next(error); }
}

export async function messages(request, response, next) {
  try {
    if (request.user.role !== 'admin') {
      const ticketRows = await tickets.listForUser(request.user);
      if (!ticketRows.some((ticket) => Number(ticket.id) === Number(request.params.id))) {
        return response.status(403).json({ message: 'Permission denied.' });
      }
    }
    response.json({ data: await tickets.listMessages(request.params.id) });
  } catch (error) { next(error); }
}

export async function addMessage(request, response, next) {
  try {
    const body = String(request.body.body ?? '').trim();
    if (!body) return response.status(422).json({ message: 'Message cannot be empty.' });
    if (body.length > 5000) return response.status(422).json({ message: 'Message is too long.' });
    const ticketRows = await tickets.listForUser(request.user);
    if (request.user.role !== 'admin' && !ticketRows.some((ticket) => Number(ticket.id) === Number(request.params.id))) {
      return response.status(403).json({ message: 'Permission denied.' });
    }
    const message = await tickets.addMessage(request.params.id, request.user.id, body, request.body.isInternal === true && request.user.role === 'admin');
    response.status(201).json({ data: message });
  } catch (error) { next(error); }
}

export async function update(request, response, next) {
  try {
    const ticket = await tickets.update(request.params.id, request.body);
    return ticket ? response.json({ data: ticket }) : response.status(404).json({ message: 'Support ticket not found.' });
  } catch (error) { next(error); }
}
