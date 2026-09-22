export function ensureStyleSheet({ id, href }) {
  const selector = `link[data-dormhive-style="${id}"]`;
  const existing = document.querySelector(selector);
  if (existing) return existing;

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  link.dataset.dormhiveStyle = id;
  document.head.append(link);
  return link;
}

export function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

export function toClassNames(...values) {
  return values.filter(Boolean).join(' ');
}
