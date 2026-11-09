export function installLiveSelfieCapture({ root, previewImage, openButton, retakeButton, submitButton, statusMessage }) {
  let stream = null;
  let selfieFile = null;
  let previewUrl = null;

  const dialog = document.createElement('dialog');
  dialog.className = 'identity-camera-dialog';
  dialog.setAttribute('aria-labelledby', 'identity-camera-dialog-title');
  dialog.innerHTML = `
    <div class="identity-camera-dialog__content">
      <header class="identity-camera-dialog__header">
        <h2 id="identity-camera-dialog-title">Take a live selfie</h2>
        <button class="identity-camera-dialog__cancel" type="button">Cancel</button>
      </header>
      <p class="identity-camera-dialog__status" role="status" aria-live="polite"></p>
      <div class="identity-camera-dialog__stage">
        <video class="identity-camera-dialog__video" autoplay playsinline muted></video>
        <img class="identity-camera-dialog__photo" alt="Captured selfie preview" hidden>
      </div>
      <div class="identity-camera-dialog__actions">
        <button class="btn identity-camera-dialog__capture" type="button">Capture selfie</button>
        <button class="btn identity-camera-dialog__retake" type="button" hidden>Retake</button>
        <button class="btn identity-camera-dialog__use" type="button" hidden>Use this photo</button>
      </div>
    </div>`;
  root.append(dialog);

  const video = dialog.querySelector('.identity-camera-dialog__video');
  const photo = dialog.querySelector('.identity-camera-dialog__photo');
  const message = dialog.querySelector('.identity-camera-dialog__status');
  const captureButton = dialog.querySelector('.identity-camera-dialog__capture');
  const retakeCaptureButton = dialog.querySelector('.identity-camera-dialog__retake');
  const useButton = dialog.querySelector('.identity-camera-dialog__use');

  const stopStream = () => {
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
    video.pause();
    video.srcObject = null;
  };

  const clearCapturedPhoto = () => {
    selfieFile = null;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = null;
    photo.removeAttribute('src');
    photo.hidden = true;
    previewImage.removeAttribute('src');
    previewImage.hidden = true;
    openButton.hidden = false;
    retakeButton.hidden = true;
    submitButton.hidden = true;
  };

  const startStream = async () => {
    message.textContent = 'Opening camera…';
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false
      });
      video.srcObject = stream;
      await video.play();
      video.hidden = false;
      photo.hidden = true;
      captureButton.hidden = false;
      captureButton.disabled = false;
      retakeCaptureButton.hidden = true;
      useButton.hidden = true;
      message.textContent = 'Center your face in the frame, then capture the photo.';
    } catch (error) {
      stopStream();
      video.hidden = true;
      captureButton.hidden = true;
      message.textContent = error.name === 'NotAllowedError'
        ? 'Camera access was denied. Allow camera access to continue.'
        : 'Unable to open the camera. Check that it is connected and not being used by another app.';
    }
  };

  const open = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      statusMessage.textContent = 'Camera capture is unavailable in this browser. Use a supported browser on HTTPS or localhost.';
      return;
    }
    clearCapturedPhoto();
    openButton.hidden = true;
    if (!dialog.open) dialog.showModal();
    await startStream();
  };

  const close = () => {
    stopStream();
    if (dialog.open) dialog.close();
    clearCapturedPhoto();
    openButton.hidden = false;
    statusMessage.textContent = 'Camera closed. Select Open camera to try again.';
    openButton.focus();
  };

  openButton.addEventListener('click', open);
  dialog.querySelector('.identity-camera-dialog__cancel').addEventListener('click', close);
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    close();
  });
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) close();
  });
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) close();
  });

  captureButton.addEventListener('click', () => {
    if (!video.videoWidth || !video.videoHeight) {
      message.textContent = 'The camera is not ready yet. Please wait a moment and try again.';
      return;
    }
    const scale = Math.min(1, 1600 / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const context = canvas.getContext('2d');
    if (!context) {
      message.textContent = 'Could not prepare the selfie. Please capture it again.';
      return;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    captureButton.disabled = true;
    canvas.toBlob((blob) => {
      if (!blob || blob.size > 5 * 1024 * 1024) {
        message.textContent = 'Could not prepare the selfie. Please capture it again.';
        captureButton.disabled = false;
        return;
      }
      selfieFile = new File([blob], `live-selfie-${Date.now()}.jpg`, { type: 'image/jpeg' });
      previewUrl = URL.createObjectURL(blob);
      photo.src = previewUrl;
      photo.hidden = false;
      video.hidden = true;
      stopStream();
      captureButton.hidden = true;
      retakeCaptureButton.hidden = false;
      useButton.hidden = false;
      message.textContent = 'Review the photo before using it. Retake if needed.';
    }, 'image/jpeg', 0.88);
  });

  retakeCaptureButton.addEventListener('click', () => {
    selfieFile = null;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = null;
    photo.removeAttribute('src');
    startStream();
  });
  useButton.addEventListener('click', () => {
    if (!selfieFile || !previewUrl) return;
    previewImage.src = previewUrl;
    previewImage.hidden = false;
    retakeButton.hidden = false;
    submitButton.hidden = false;
    statusMessage.textContent = 'Selfie captured. Click the photo to view it larger.';
    stopStream();
    dialog.close();
    submitButton.focus();
  });

  retakeButton.addEventListener('click', open);

  return {
    getFile: () => selfieFile,
    clear: () => {
      stopStream();
      if (dialog.open) dialog.close();
      clearCapturedPhoto();
    }
  };
}