import * as notifications from '../models/Notification.js';

export async function list(request, response, next) {
  try { response.json({ data: await notifications.listFor(request.user.id, request.query.unread === 'true') }); } catch (error) { next(error); }
}

export async function markRead(request, response, next) {
  try {
    const changed = await notifications.markRead(request.params.id, request.user.id);
    return changed ? response.status(204).end() : response.status(404).json({ message: 'Notification not found.' });
  } catch (error) { next(error); }
}
