const MAX_OUTPUT_SIZE = 512;
const OUTPUT_QUALITY = 0.9;

export async function uploadAvatarPhoto(userId, file) {
  const api = String(window.DORMHIVE_API_URL ?? 'http://localhost:5000/api/v1').replace(/\/+$/, '');
  const apiBase = api.endsWith('/api/v1') ? api : api.endsWith('/api') ? `${api}/v1` : `${api}/api/v1`;
  const formData = new FormData();
  formData.append('avatar', file, file.name);
  const response = await fetch(`${apiBase}/users/${userId}/avatar`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${localStorage.getItem('dormhive.accessToken') ?? ''}` },
    body: formData
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message ?? 'Unable to upload profile picture.');
  const updatedUser = body.data ?? body;
  if (!updatedUser.avatar_url) throw new Error('The server did not return the saved profile photo.');
  return updatedUser;
}

function ensureStyles() {
  if (document.querySelector('[data-avatar-editor-styles]')) return;
  const style = document.createElement('style');
  style.dataset.avatarEditorStyles = 'true';
  style.textContent = `
    .avatar-editor {
      position: fixed;
      inset: 0;
      margin: auto;
      width: min(94vw, 460px);
      max-width: 460px;
      max-height: min(92vh, 760px);
      padding: 0;
      overflow: auto;
      border: 1px solid #d7e3dc;
      border-radius: 10px;
      color: #1f2d2b;
      background: #fff;
      box-shadow: 0 24px 70px rgb(10 35 28 / 28%);
    }
    .avatar-editor::backdrop { background: rgb(13 30 26 / 68%); backdrop-filter: blur(4px); }
    .avatar-editor__header { display: flex; justify-content: space-between; align-items: center; padding: 20px 22px 14px; }
    .avatar-editor__header h2 { margin: 0; font-size: 1.15rem; }
    .avatar-editor__close { width: 34px; height: 34px; border: 0; border-radius: 50%; background: #f0f4f1; color: #31443d; font-size: 1.25rem; cursor: pointer; }
    .avatar-editor__stage { display: grid; place-items: center; padding: 18px; background: #f2f6f3; }
    .avatar-editor__canvas { display: block; width: min(68vw, 300px); height: min(68vw, 300px); max-width: 300px; max-height: 300px; border-radius: 50%; background: #dfe8e2; cursor: grab; touch-action: none; }
    .avatar-editor__canvas:active { cursor: grabbing; }
    .avatar-editor__controls { display: grid; grid-template-columns: 1fr auto; gap: 12px 16px; align-items: center; padding: 20px 22px 10px; }
    .avatar-editor__zoom { display: grid; gap: 6px; font-size: .86rem; font-weight: 650; }
    .avatar-editor__zoom input { width: 100%; accent-color: #11765d; }
    .avatar-editor__rotate { display: inline-flex; gap: 8px; align-items: center; min-height: 40px; padding: 0 12px; border: 1px solid #d4e0d8; border-radius: 6px; color: #214c3d; background: white; font-weight: 650; cursor: pointer; }
    .avatar-editor__error { min-height: 20px; margin: 0; padding: 0 22px; color: #a12626; font-size: .88rem; }
    .avatar-editor__actions { display: flex; justify-content: flex-end; gap: 10px; padding: 10px 22px 22px; }
    .avatar-editor__actions button { min-height: 42px; padding: 0 16px; border: 1px solid #d2ddd6; border-radius: 6px; background: #fff; color: #263b32; font-weight: 700; cursor: pointer; }
    .avatar-editor__actions .avatar-editor__save { border-color: #0b684f; color: white; background: #0b684f; }
    .avatar-editor button:disabled { cursor: wait; opacity: .65; }
    @media (max-width: 480px) {
      .avatar-editor { width: calc(100vw - 24px); }
      .avatar-editor__header { padding-inline: 16px; }
      .avatar-editor__controls { padding-inline: 16px; }
      .avatar-editor__actions { padding-inline: 16px; }
      .avatar-editor__error { padding-inline: 16px; }
    }
  `;
  document.head.append(style);
}

function drawCrop(context, image, size, zoom, rotation, offset, circular = true) {
  context.clearRect(0, 0, size, size);
  context.save();
  if (circular) {
    context.beginPath();
    context.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    context.clip();
  }
  context.fillStyle = '#e6eee8';
  context.fillRect(0, 0, size, size);
  context.translate(size / 2 + offset.x, size / 2 + offset.y);
  context.rotate(rotation * Math.PI / 180);

  const radians = rotation * Math.PI / 180;
  const boundsWidth = Math.abs(image.naturalWidth * Math.cos(radians)) + Math.abs(image.naturalHeight * Math.sin(radians));
  const boundsHeight = Math.abs(image.naturalWidth * Math.sin(radians)) + Math.abs(image.naturalHeight * Math.cos(radians));
  const scale = Math.max(size / boundsWidth, size / boundsHeight) * zoom;
  context.drawImage(image, -image.naturalWidth * scale / 2, -image.naturalHeight * scale / 2, image.naturalWidth * scale, image.naturalHeight * scale);
  context.restore();
}

function maxCropOffset(image, size, zoom, rotation) {
  const radians = rotation * Math.PI / 180;
  const boundsWidth = Math.abs(image.naturalWidth * Math.cos(radians)) + Math.abs(image.naturalHeight * Math.sin(radians));
  const boundsHeight = Math.abs(image.naturalWidth * Math.sin(radians)) + Math.abs(image.naturalHeight * Math.cos(radians));
  const scale = Math.max(size / boundsWidth, size / boundsHeight) * zoom;
  return {
    x: Math.max(0, (boundsWidth * scale - size) / 2),
    y: Math.max(0, (boundsHeight * scale - size) / 2)
  };
}

function canvasToFile(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('The edited photo could not be prepared. Please try another image.'));
        return;
      }
      resolve(new File([blob], 'profile-photo.jpg', { type: 'image/jpeg', lastModified: Date.now() }));
    }, 'image/jpeg', OUTPUT_QUALITY);
  });
}

export async function openAvatarEditor(file, savePhoto) {
  if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Choose a JPG, PNG, or WebP image.');
  }

  ensureStyles();
  const objectUrl = URL.createObjectURL(file);
  const image = new Image();
  try {
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('This image could not be opened. Choose another file.'));
      image.src = objectUrl;
    });
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }

  const dialog = document.createElement('dialog');
  dialog.className = 'avatar-editor';
  dialog.setAttribute('aria-labelledby', 'avatar-editor-title');
  dialog.innerHTML = `
    <div class="avatar-editor__header">
      <h2 id="avatar-editor-title">Edit profile photo</h2>
      <button class="avatar-editor__close" type="button" aria-label="Close photo editor">&times;</button>
    </div>
    <div class="avatar-editor__stage"><canvas class="avatar-editor__canvas" width="320" height="320" aria-label="Circular crop preview. Drag to reposition."></canvas></div>
    <div class="avatar-editor__controls">
      <label class="avatar-editor__zoom">Zoom
        <input class="avatar-editor__zoom-input" type="range" min="1" max="3" step="0.01" value="1" aria-label="Zoom photo">
      </label>
      <button class="avatar-editor__rotate" type="button" aria-label="Rotate photo 90 degrees">&#8635; Rotate</button>
    </div>
    <p class="avatar-editor__error" role="alert" aria-live="polite"></p>
    <div class="avatar-editor__actions">
      <button class="avatar-editor__cancel" type="button">Cancel</button>
      <button class="avatar-editor__save" type="button">Save Photo</button>
    </div>`;

  const canvas = dialog.querySelector('canvas');
  const context = canvas.getContext('2d');
  const zoomInput = dialog.querySelector('.avatar-editor__zoom-input');
  const rotateButton = dialog.querySelector('.avatar-editor__rotate');
  const saveButton = dialog.querySelector('.avatar-editor__save');
  const errorMessage = dialog.querySelector('.avatar-editor__error');
  let zoom = 1;
  let rotation = 0;
  let offset = { x: 0, y: 0 };
  let dragPosition = null;
  let settled = false;

  const repaint = () => drawCrop(context, image, canvas.width, zoom, rotation, offset);
  const close = () => {
    if (dialog.open) dialog.close();
  };
  const cleanup = () => {
    URL.revokeObjectURL(objectUrl);
    dialog.remove();
  };

  zoomInput.addEventListener('input', () => {
    zoom = Number(zoomInput.value);
    repaint();
  });
  rotateButton.addEventListener('click', () => {
    rotation = (rotation + 90) % 360;
    offset = { x: 0, y: 0 };
    repaint();
  });
  canvas.addEventListener('pointerdown', (event) => {
    dragPosition = { x: event.clientX, y: event.clientY };
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!dragPosition) return;
    const bounds = canvas.getBoundingClientRect();
    const scale = canvas.width / bounds.width;
    const maxOffset = maxCropOffset(image, canvas.width, zoom, rotation);
    offset.x = Math.max(-maxOffset.x, Math.min(maxOffset.x, offset.x + (event.clientX - dragPosition.x) * scale));
    offset.y = Math.max(-maxOffset.y, Math.min(maxOffset.y, offset.y + (event.clientY - dragPosition.y) * scale));
    dragPosition = { x: event.clientX, y: event.clientY };
    repaint();
  });
  canvas.addEventListener('pointerup', () => { dragPosition = null; });
  canvas.addEventListener('pointercancel', () => { dragPosition = null; });

  const result = new Promise((resolve) => {
    dialog.addEventListener('close', () => {
      cleanup();
      if (!settled) resolve(null);
    }, { once: true });
    dialog.querySelector('.avatar-editor__close').addEventListener('click', close);
    dialog.querySelector('.avatar-editor__cancel').addEventListener('click', close);
    saveButton.addEventListener('click', async () => {
      saveButton.disabled = true;
      saveButton.textContent = 'Saving...';
      errorMessage.textContent = '';
      try {
        const output = document.createElement('canvas');
        output.width = MAX_OUTPUT_SIZE;
        output.height = MAX_OUTPUT_SIZE;
        drawCrop(output.getContext('2d'), image, MAX_OUTPUT_SIZE, zoom, rotation, {
          x: offset.x * MAX_OUTPUT_SIZE / canvas.width,
          y: offset.y * MAX_OUTPUT_SIZE / canvas.height
        }, false);
        const optimizedFile = await canvasToFile(output);
        await savePhoto(optimizedFile);
        settled = true;
        resolve(optimizedFile);
        close();
      } catch (error) {
        errorMessage.textContent = error.message || 'Unable to save this photo.';
        saveButton.disabled = false;
        saveButton.textContent = 'Save Photo';
      }
    });
    document.body.append(dialog);
    dialog.showModal();
    repaint();
  });

  return result;
}