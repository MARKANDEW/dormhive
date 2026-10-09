import { withMediaAccessToken } from '../../services/mediaAccess.js';
import { buildInitialsAvatarSvg } from '../../services/avatar.js';

const API_BASE = (window.DORMHIVE_API_URL ?? 'http://localhost:5000/api/v1').replace(/\/api\/v1\/?$/, '');
export function buildDefaultUserAvatarSvg(name = 'User') {
  return buildInitialsAvatarSvg(name);
}

export function normalizeUserAvatarPath(value = '') {
  const url = String(value ?? '').trim();
  if (!url) return '';
  if (url.startsWith('data:') || url.startsWith('blob:') || /^https?:\/\//i.test(url)) return url;
  const normalized = url.replace(/^\.\//, '').replace(/^\/+/, '');
  return `/${normalized}`;
}

export function resolveUserAvatarUrl(value = '', fallbackName = 'User') {
  const url = normalizeUserAvatarPath(value);
  if (!url) return buildDefaultUserAvatarSvg(fallbackName);
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;
  const resolved = withMediaAccessToken(/^https?:\/\//i.test(url) ? url : `${API_BASE}${url.startsWith('/') ? '' : '/'}${url}`);
  return resolved || buildDefaultUserAvatarSvg(fallbackName);
}
