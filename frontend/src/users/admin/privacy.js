const PRIVACY_KEY = 'dormhive.adminPrivacyMode';

export function getAdminPrivacyMode() {
  try {
    return localStorage.getItem(PRIVACY_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setAdminPrivacyMode(enabled) {
  const isEnabled = Boolean(enabled);
  try {
    localStorage.setItem(PRIVACY_KEY, String(isEnabled));
  } catch {}
  document.body?.setAttribute('data-admin-privacy', isEnabled ? 'on' : 'off');
  applyAdminPrivacy(document);
  document.dispatchEvent(new CustomEvent('dormhive:privacy-mode-change', { detail: { enabled: isEnabled } }));
}

function maskName(value) {
  const text = String(value ?? '').trim();
  if (!text) return '••••';
  return text.split(/\s+/).map((part) => {
    if (!part) return '••••';
    if (part.length === 1) return `${part[0]}•••`;
    return `${part[0]}${'•'.repeat(Math.max(3, part.length - 1))}`;
  }).join(' ');
}

function maskEmail(value) {
  const text = String(value ?? '').trim();
  if (!text) return '••••@••••.com';
  const at = text.indexOf('@');
  const domain = text.includes('@') ? text.slice(at + 1) : '••••.com';
  const local = text.includes('@') ? text.slice(0, at) : text;
  const first = local.slice(0, 1) || '•';
  const maskedLocal = local.length > 1 ? `${first}${'•'.repeat(Math.max(3, local.length - 1))}` : '••••';
  if (!text.includes('@')) return maskedLocal;
  const domainParts = domain.split('.');
  const maskedDomain = domainParts.map((segment, index) => { 
    if (!segment) return '••••';
    if (index === domainParts.length - 1) return segment.length > 1 ? `${segment[0]}${'•'.repeat(Math.max(2, segment.length - 1))}` : '••••';
    return '••••';
  }).join('.');
  return `${maskedLocal}@${maskedDomain}`;
}

function maskPhone(value) {
  const text = String(value ?? '').trim();
  if (!text) return '••••••••';
  return '••••••••';
}

function maskStat(value) {
  const text = String(value ?? '').trim();
  if (!text) return '••';
  if (/^\d+$/.test(text.replace(/[^0-9]/g, ''))) {
    return '••';
  }
  return '••••';
}

function maskText(value, mode = 'text') {
  switch (mode) {
    case 'name': return maskName(value);
    case 'email': return maskEmail(value);
    case 'phone': return maskPhone(value);
    case 'stat': return maskStat(value);
    case 'address':
    case 'detail':
    case 'text': {
      const text = String(value ?? '').trim();
      if (!text) return '••••••';
      return text.split(/\s+/).map((part) => (part.length > 1 ? `${part[0]}${'•'.repeat(Math.max(3, part.length - 1))}` : '•••')).join(' ');
    }
    default: return '••••••';
  }
}

function attachRevealButton(element) {
  if (element.dataset.privacyButtonBound === 'true') return;
  const wrapper = element.parentElement;
  if (!wrapper) return;
  if (wrapper.querySelector('.privacy-reveal')) return;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'privacy-reveal';
  button.setAttribute('aria-label', 'Reveal hidden value');
  button.title = 'Reveal';
  button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5C5.5 5 1.9 10.2 1.2 12c.7 1.8 4.3 7 10.8 7 6.5 0 10.1-5.2 10.8-7-.7-1.8-4.3-7-10.8-7zm0 2.2A4.8 4.8 0 0 1 16.8 12 4.8 4.8 0 0 1 12 16.8 4.8 4.8 0 0 1 7.2 12 4.8 4.8 0 0 1 12 7.2zm0 2A2.8 2.8 0 0 0 9.2 12 2.8 2.8 0 0 0 12 14.8 2.8 2.8 0 0 0 14.8 12 2.8 2.8 0 0 0 12 9.2z" fill="currentColor"/></svg>';
  button.addEventListener('click', () => {
    const isRevealed = element.dataset.privacyRevealed === 'true';
    const original = element.dataset.privacyOriginal ?? element.getAttribute('value') ?? element.textContent ?? '';
    if (isRevealed) {
      element.dataset.privacyRevealed = 'false';
      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        element.value = maskText(original, element.dataset.privacyMask || 'text');
      } else {
        element.textContent = maskText(original, element.dataset.privacyMask || 'text');
      }
    } else {
      element.dataset.privacyRevealed = 'true';
      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        element.value = original;
      } else {
        element.textContent = original;
      }
    }
  });
  wrapper.appendChild(button);
  element.dataset.privacyButtonBound = 'true';
}

export function applyAdminPrivacy(root = document) {
  const enabled = getAdminPrivacyMode();
  const scope = root ?? document;
  scope.body?.setAttribute('data-admin-privacy', enabled ? 'on' : 'off');

  scope.querySelectorAll('[data-privacy-mask]').forEach((element) => {
    const mode = element.dataset.privacyMask || 'text';
    const original = element.dataset.privacyOriginal ?? (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement ? element.value : element.textContent ?? '');
    if (!original) return;
    element.dataset.privacyOriginal = String(original);

    if (!enabled) {
      element.dataset.privacyRevealed = 'false';
      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        element.value = original;
      } else {
        element.textContent = original;
      }
      element.parentElement?.querySelector('.privacy-reveal')?.remove();
      element.dataset.privacyButtonBound = 'false';
      return;
    }

    const masked = maskText(original, mode);
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      element.value = masked;
    } else {
      element.textContent = masked;
    }
    element.dataset.privacyRevealed = 'false';
    attachRevealButton(element);
  });
}

document.addEventListener('dormhive:privacy-mode-change', () => {
  applyAdminPrivacy(document);
});
