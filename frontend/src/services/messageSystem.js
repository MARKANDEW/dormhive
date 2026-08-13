import { api } from './api.js';
export const formatMessageTime = (value) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
export const currentUserId = () => { try { return JSON.parse(localStorage.getItem('dormhive.user') ?? '{}').id; } catch { return null; } };
export const markConversationRead = (id) => api.messages.update(id, { read: true });
export function poll(callback, interval = 8000) { const id = setInterval(callback, interval); return () => clearInterval(id); }
