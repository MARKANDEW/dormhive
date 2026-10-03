const avatarImageSelector = [
  'img.avatar-image',
  'img.user-row-avatar',
  '.avatar-wrap img',
  '.user-avatar img',
  '.profile-avatar img',
  '.profile-avatar-wrap img',
  '.avatar img',
  '.tenant-avatar img',
  '.message-participant-avatar img',
  '.avatar-chip img',
  '.tenant-avatar-circle img',
  'img[alt*="avatar" i]',
  'img[alt*="profile" i]'
].join(', ');

let installed = false;

function ensureAvatarPreviewStyles() {
  if (document.querySelector('[data-avatar-preview-style]')) return;
  const style = document.createElement('style');
  style.dataset.avatarPreviewStyle = 'true';
  style.textContent = `
    .is-avatar-previewable {
      cursor: zoom-in;
    }

    .avatar-preview-dialog {
      position: fixed;
      inset: 0;
      display: grid;
      place-items: center;
      width: 100vw;
      max-width: none;
      height: 100vh;
      max-height: none;
      margin: 0;
      padding: 1rem;
      overflow: hidden;
      border: 0;
      background: transparent;
    }

    .avatar-preview-dialog::backdrop {
      background: rgb(0 0 0 / 78%);
      backdrop-filter: blur(3px);
    }

    .avatar-preview-dialog img {
      display: block;
      max-width: 92vw;
      max-height: 92vh;
      object-fit: contain;
      cursor: zoom-out;
    }
  `;
  document.head.append(style);
}

function prepareAvatarImages(root) {
  root.querySelectorAll(avatarImageSelector).forEach((image) => {
    if (image.closest('.avatar-preview-dialog')) return;
    if (image.src.startsWith('data:image/svg+xml')) return;
    image.classList.add('is-avatar-previewable');
    image.tabIndex = 0;
    image.setAttribute('role', 'button');
    image.setAttribute('aria-label', `View ${image.alt || 'profile'} photo`);
  });
}

function showAvatarPreview(image) {
  if (!image.complete || image.naturalWidth === 0 || image.src.startsWith('data:image/svg+xml')) return;

  const dialog = document.createElement('dialog');
  dialog.className = 'avatar-preview-dialog';
  dialog.setAttribute('aria-label', `${image.alt || 'Profile'} photo preview`);

  const previewImage = document.createElement('img');
  previewImage.src = image.currentSrc || image.src;
  previewImage.alt = image.alt || 'Profile photo';
  previewImage.draggable = false;

  dialog.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => dialog.remove(), { once: true });
  dialog.append(previewImage);
  document.body.append(dialog);
  dialog.showModal();
  dialog.focus();
}

export function installAvatarPreview() {
  if (installed) return;
  installed = true;
  ensureAvatarPreviewStyles();
  prepareAvatarImages(document);

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      record.addedNodes.forEach((node) => {
        if (node instanceof HTMLImageElement && node.matches(avatarImageSelector)) {
          prepareAvatarImages(node.parentElement ?? document);
        } else if (node instanceof Element) {
          prepareAvatarImages(node);
        }
      });
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  document.addEventListener('click', (event) => {
    const image = event.target.closest(avatarImageSelector);
    if (image && !image.closest('.avatar-preview-dialog')) showAvatarPreview(image);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const image = event.target.closest?.(avatarImageSelector);
    if (!image || image.closest('.avatar-preview-dialog')) return;
    event.preventDefault();
    showAvatarPreview(image);
  });
}
