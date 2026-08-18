const API_BASE = (window.DORMHIVE_API_URL ?? 'http://localhost:5000/api/v1').replace(/\/api\/v1\/?$/, '');

export function buildDefaultUserAvatarSvg(name = 'User') {
  const initials = String(name || 'User').trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || 'U';
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" role="img" aria-label="${name} profile avatar">
      <rect width="120" height="120" rx="60" fill="#efe6d6"/>
      <circle cx="60" cy="42" r="22" fill="#4a3d2f"/>
      <path d="M28 96c6-16 18-25 32-25s26 9 32 25" fill="#8d6435"/>
      <text x="50%" y="67%" text-anchor="middle" font-size="34" font-family="Inter, Arial, sans-serif" font-weight="700" fill="#ffffff">${initials}</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export function normalizeUserAvatarPath(value = '') {
  const url = String(value ?? '').trim();
  if (!url) return '';
  if (url.startsWith('data:') || url.startsWith('blob:') || /^https?:\/\//i.test(url)) return url;
  const normalized = url.replace(/^\.\//, '').replace(/^\/+/, '');
  return normalized.startsWith('uploads/') ? `/${normalized}` : `/${normalized}`;
}

export function resolveUserAvatarUrl(value = '', fallbackName = 'User') {
  const url = normalizeUserAvatarPath(value);
  if (!url) return buildDefaultUserAvatarSvg(fallbackName);
  if (url.startsWith('data:') || url.startsWith('blob:') || /^https?:\/\//i.test(url)) return url;
  return `${API_BASE}${url.startsWith('/') ? '' : '/'}${url}`;
}
