export function getAvatarInitials(name = '', fallback = 'U') {
  const words = String(name ?? '').trim().split(/\s+/).filter(Boolean);
  const initials = words.slice(0, 2).map((word) => Array.from(word)[0]?.toLocaleUpperCase() ?? '').join('');
  return initials || fallback;
}

export function buildInitialsAvatarSvg(name = '', fallback = 'U') {
  const initials = getAvatarInitials(name, fallback).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;'
  })[character]);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" role="img" aria-label="${initials} avatar"><circle cx="60" cy="60" r="60" fill="#0f6b57"/><text x="60" y="64" text-anchor="middle" dominant-baseline="middle" fill="#ffffff" font-family="Inter,Arial,sans-serif" font-size="38" font-weight="700">${initials}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}
