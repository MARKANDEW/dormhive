export function installSelfiePreview(previewImage, root = document.querySelector('#app')) {
  if (!previewImage || !root) return;

  const dialog = document.createElement('dialog');
  dialog.className = 'identity-selfie-viewer';
  dialog.setAttribute('aria-labelledby', 'identity-selfie-viewer-title');
  dialog.innerHTML = `
    <div class="identity-selfie-viewer__content">
      <header class="identity-selfie-viewer__header">
        <h2 id="identity-selfie-viewer-title">Selfie preview</h2>
        <button class="identity-selfie-viewer__close" type="button" aria-label="Close selfie preview">Close</button>
      </header>
      <img class="identity-selfie-viewer__image" alt="Captured selfie, enlarged">
    </div>`;

  const enlargedImage = dialog.querySelector('.identity-selfie-viewer__image');
  const closeButton = dialog.querySelector('.identity-selfie-viewer__close');
  const openPreview = () => {
    if (previewImage.hidden || !previewImage.src) return;
    enlargedImage.src = previewImage.src;
    dialog.showModal();
  };

  previewImage.tabIndex = 0;
  previewImage.setAttribute('role', 'button');
  previewImage.setAttribute('aria-label', 'View captured selfie larger');
  previewImage.title = 'View larger';
  previewImage.addEventListener('click', openPreview);
  previewImage.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    openPreview();
  });
  closeButton.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => {
    enlargedImage.removeAttribute('src');
    previewImage.focus();
  });
  root.append(dialog);
}