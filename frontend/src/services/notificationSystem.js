import { api } from './api.js';
export async function refreshNotificationBadge(badge) { const response = await api.notifications.list({ unread: true }); const items = response?.data ?? response ?? []; const count = items.filter((item) => !item.read_at).length; badge.textContent = count > 99 ? '99+' : String(count); badge.hidden = count === 0; badge.setAttribute('aria-label', `${count} unread notifications`); return items; }
export const markNotificationRead = (id) => api.notifications.update(id, { read: true });
export function pollNotifications(badge, interval = 15000) { const update = () => refreshNotificationBadge(badge).catch(() => { badge.hidden = true; }); update(); return setInterval(update, interval); }
