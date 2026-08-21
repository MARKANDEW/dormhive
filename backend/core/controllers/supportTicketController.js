import * as tickets from '../models/SupportTicket.js';

export async function list(request, response, next) {
  try { response.json({ data: await tickets.listForUser(request.user) }); } catch (error) { next(error); }
}

export async function create(request, response, next) {
  try { response.status(201).json({ data: await tickets.create(request.user.id, request.body) }); } catch (error) { next(error); }
}

export async function update(request, response, next) {
  try {
    const ticket = await tickets.update(request.params.id, request.body);
    return ticket ? response.json({ data: ticket }) : response.status(404).json({ message: 'Support ticket not found.' });
  } catch (error) { next(error); }
}
