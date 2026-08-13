const API_BASE = (window.DORMHIVE_API_URL ?? 'http://localhost:5000/api/v1').replace(/\/api\/v1\/?$/, '');

export function resolveImageUrl(value = '') {
  const url = String(value || '').trim();
  if (!url) return '';
  if (url.startsWith('data:')) return url;
  if (/^https?:\/\//i.test(url)) return url;
  const normalized = url.startsWith('uploads/') ? `/${url}` : url;
  return `${API_BASE}${normalized.startsWith('/') ? '' : '/'}${normalized}`;
}

export function buildDefaultUserAvatarSvg(name = 'Tenant User') {
  const initials = String(name).trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('') || 'T';
  const svg = `
    <svg viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${name} portrait">
      <rect width="240" height="240" rx="120" fill="#f2efe9"/>
      <circle cx="120" cy="94" r="46" fill="#223547"/>
      <path d="M67 198c8-37 32-57 53-57s45 20 53 57" fill="#2b4963"/>
      <path d="M85 106c9-27 24-43 36-43 26 0 40 20 40 44 0 18-7 29-20 37-13 7-29 8-42 2-13-6-20-17-24-40z" fill="#1d2d3c"/>
      <path d="M75 175c15-14 31-22 45-22 16 0 31 8 45 22" fill="#11212d"/>
      <rect x="72" y="164" width="96" height="24" rx="12" fill="#0f2b3f"/>
      <rect x="86" y="171" width="68" height="10" rx="5" fill="#4b6781"/>
      <text x="50%" y="86%" text-anchor="middle" font-size="42" font-family="Inter, Arial, sans-serif" fill="#ffffff" font-weight="700">${initials}</text>
    </svg>`;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export function getUserAvatarUrl(user = {}, name = 'Tenant User') {
  const profileName = String(user?.name || name || 'Tenant User').trim();
  if (!user || !user.avatar_url) return buildDefaultUserAvatarSvg(profileName);
  return resolveImageUrl(user.avatar_url);
}
