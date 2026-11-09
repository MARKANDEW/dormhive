const API_BASE_URL = window.DORMHIVE_API_URL ?? 'http://localhost:5000/api/v1';
import { showToast } from '../components/toast.js';
import { openLegalModal } from './legal.js';
import { navigate } from '../../router.js';
import { getApiErrorMessage, readApiResponse } from '../services/api.js';
import { installSelfiePreview } from './selfiePreview.js';
import { installLiveSelfieCapture } from './liveSelfieCapture.js';

function loadStylesheet() {
  const existing = document.querySelector('link[data-dormhive-auth="split"]');
  if (existing) return existing.sheet ? Promise.resolve() : new Promise((resolve) => existing.addEventListener('load', resolve, { once: true }));
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('./style/split-auth.css', import.meta.url).href;
  link.dataset.dormhiveAuth = 'split';
  document.head.append(link);
  if (!document.querySelector('link[data-dormhive-auth="boxicons"]')) {
    const icons = document.createElement('link');
    icons.rel = 'stylesheet';
    icons.href = "https://unpkg.com/boxicons@2.1.4/css/boxicons.min.css";
    icons.dataset.dormhiveAuth = 'boxicons';
    document.head.append(icons);
  }
  return new Promise((resolve) => {
    link.addEventListener('load', resolve, { once: true });
    link.addEventListener('error', resolve, { once: true });
  });
}

function showMessage(element, message) {
  element.textContent = message;
  element.className = 'auth-message auth-message--error';
  element.hidden = false;
}

export async function renderRegister(root = document.querySelector('#app')) {
  if (!root) throw new Error('Register page requires an element with id "app".');
  await loadStylesheet();
  root.innerHTML = `
    <div class="container active">
      <a class="auth-brand" href="../index.html"><span class="auth-brand-mark" aria-hidden="true"><svg class="auth-brand-icon" viewBox="0 0 180 180" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" role="img"><defs><linearGradient id="register-brand-navy" x1="20" y1="10" x2="160" y2="170" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#203E69"/><stop offset="0.55" stop-color="#102B4F"/><stop offset="1" stop-color="#071B35"/></linearGradient><linearGradient id="register-brand-gold" x1="70" y1="30" x2="120" y2="145" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#FFE08A"/><stop offset="0.35" stop-color="#F5BE42"/><stop offset="1" stop-color="#C98213"/></linearGradient><filter id="register-brand-shadow" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="12" stdDeviation="10" flood-opacity="0.20"/></filter><filter id="register-brand-glow"><feGaussianBlur stdDeviation="2.5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><path d="M90 8 C126 8 157 36 162 71 C167 106 148 139 119 157 C108 164 98 169 90 172 C82 169 72 164 61 157 C32 139 13 106 18 71 C23 36 54 8 90 8Z" fill="url(#register-brand-navy)" filter="url(#register-brand-shadow)"/><path d="M90 20 C120 20 146 43 150 72 C154 101 139 128 114 144 C105 150 97 154 90 157 C83 154 75 150 66 144 C41 128 26 101 30 72 C34 43 60 20 90 20Z" fill="none" stroke="url(#register-brand-gold)" stroke-width="2" opacity=".75"/><path d="M90 31 L105 40 L105 57 L90 66 L75 57 L75 40Z" fill="none" stroke="url(#register-brand-gold)" stroke-width="3" opacity=".9"/><path d="M55 55 L70 64 L70 81 L55 90 L40 81 L40 64Z" fill="none" stroke="url(#register-brand-gold)" stroke-width="3" opacity=".55"/><path d="M125 55 L140 64 L140 81 L125 90 L110 81 L110 64Z" fill="none" stroke="url(#register-brand-gold)" stroke-width="3" opacity=".55"/><path d="M59 54 L59 122 C59 133 67 139 78 139 L91 139 C119 139 137 121 137 96 C137 71 119 54 91 54 Z M78 71 L91 71 C108 71 119 81 119 96 C119 111 108 122 91 122 L78 122 Z" fill="white" fill-rule="evenodd"/><path d="M69 88 L89 69 L109 88" fill="none" stroke="url(#register-brand-gold)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" filter="url(#register-brand-glow)"/><path d="M82 119 L82 99 C82 94 85 91 90 91 C95 91 98 94 98 99 L98 119" fill="url(#register-brand-gold)"/><circle cx="94" cy="105" r="2" fill="#102B4F"/><circle cx="90" cy="42" r="3" fill="#FFE08A"/><circle cx="48" cy="72" r="2.5" fill="#F5BE42" opacity=".8"/><circle cx="132" cy="72" r="2.5" fill="#F5BE42" opacity=".8"/><path d="M68 148 C75 152 83 155 90 158 C97 155 105 152 112 148" fill="none" stroke="url(#register-brand-gold)" stroke-width="3" stroke-linecap="round"/></svg></span><span class="auth-brand-name"><span>Dorm</span><span class="auth-brand-name-accent">Hive</span></span></a>
      <div class="form-box login">
        <form aria-labelledby="login-title">
          <div class="form-inner">
            <h1 id="login-title">Login</h1>
            <p>Sign in to continue</p>
            <div class="input-box"><input id="email" name="email" type="email" placeholder="Email" required><i class='bx bxs-envelope'></i></div>
            <div class="input-box"><input id="password" name="password" type="password" placeholder="Password" required minlength="8"><i class='bx bxs-lock-alt'></i></div>
            <div class="forgot-link"><a href="#/forgot-password">Forgot Password?</a></div>
            <button class="btn auth-submit" type="submit">Login</button>
          </div>
        </form>
      </div>

      <div class="auth-corner-brand" aria-hidden="true"><span>DORMHIVE</span><i></i></div>
      <div class="form-box register">
        <form aria-labelledby="register-title">
          <div class="form-inner">
            <div class="auth-form-brand" aria-label="DormHive"><span class="auth-form-brand-mark" aria-hidden="true"><svg class="auth-form-brand-icon" viewBox="0 0 180 180" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" role="img"><defs><linearGradient id="register-form-navy" x1="20" y1="10" x2="160" y2="170" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#203E69"/><stop offset="0.55" stop-color="#102B4F"/><stop offset="1" stop-color="#071B35"/></linearGradient><linearGradient id="register-form-gold" x1="70" y1="30" x2="120" y2="145" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#FFE08A"/><stop offset="0.35" stop-color="#F5BE42"/><stop offset="1" stop-color="#C98213"/></linearGradient><filter id="register-form-shadow" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="12" stdDeviation="10" flood-opacity="0.20"/></filter><filter id="register-form-glow"><feGaussianBlur stdDeviation="2.5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><path d="M90 8 C126 8 157 36 162 71 C167 106 148 139 119 157 C108 164 98 169 90 172 C82 169 72 164 61 157 C32 139 13 106 18 71 C23 36 54 8 90 8Z" fill="url(#register-form-navy)" filter="url(#register-form-shadow)"/><path d="M90 20 C120 20 146 43 150 72 C154 101 139 128 114 144 C105 150 97 154 90 157 C83 154 75 150 66 144 C41 128 26 101 30 72 C34 43 60 20 90 20Z" fill="none" stroke="url(#register-form-gold)" stroke-width="2" opacity=".75"/><path d="M90 31 L105 40 L105 57 L90 66 L75 57 L75 40Z" fill="none" stroke="url(#register-form-gold)" stroke-width="3" opacity=".9"/><path d="M55 55 L70 64 L70 81 L55 90 L40 81 L40 64Z" fill="none" stroke="url(#register-form-gold)" stroke-width="3" opacity=".55"/><path d="M125 55 L140 64 L140 81 L125 90 L110 81 L110 64Z" fill="none" stroke="url(#register-form-gold)" stroke-width="3" opacity=".55"/><path d="M59 54 L59 122 C59 133 67 139 78 139 L91 139 C119 139 137 121 137 96 C137 71 119 54 91 54 Z M78 71 L91 71 C108 71 119 81 119 96 C119 111 108 122 91 122 L78 122 Z" fill="white" fill-rule="evenodd"/><path d="M69 88 L89 69 L109 88" fill="none" stroke="url(#register-form-gold)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" filter="url(#register-form-glow)"/><path d="M82 119 L82 99 C82 94 85 91 90 91 C95 91 98 94 98 99 L98 119" fill="url(#register-form-gold)"/><circle cx="94" cy="105" r="2" fill="#102B4F"/><circle cx="90" cy="42" r="3" fill="#FFE08A"/><circle cx="48" cy="72" r="2.5" fill="#F5BE42" opacity=".8"/><circle cx="132" cy="72" r="2.5" fill="#F5BE42" opacity=".8"/><path d="M68 148 C75 152 83 155 90 158 C97 155 105 152 112 148" fill="none" stroke="url(#register-form-gold)" stroke-width="3" stroke-linecap="round"/></svg></span><span>Dorm<span class="auth-form-brand-accent">Hive</span></span></div>
            <h1 id="register-title">Registration</h1>
            <p>Create your account</p>
            <p class="auth-message" role="alert" hidden></p>
            <div class="register-form-fields">
            <div class="register-name-row">
              <div class="input-box"><input id="first_name" name="first_name" type="text" placeholder="First name" required maxlength="120"></div>
              <div class="input-box"><input id="last_name" name="last_name" type="text" placeholder="Last name" required maxlength="120"></div>
            </div>
            <div class="input-box"><input id="email_r" name="email" type="email" placeholder="Email address" required></div>
            <div class="input-box phone-field">
              <div class="phone-input-box" aria-label="Philippines phone number">
                <span class="phone-country" aria-label="Philippines, country code +63">
                  <span class="phone-flag" aria-hidden="true"></span>
                  <span class="phone-prefix">+63</span>
                </span>
                <input id="phone_r" name="phone" type="tel" inputmode="numeric" placeholder="9XX XXX XXXX" required maxlength="12" autocomplete="tel">
              </div>
            </div>
            <input id="role" name="role" type="hidden" value="tenant">
            <fieldset class="role-choice-group">
              <legend>I want to</legend>
              <label class="role-choice"><input type="checkbox" data-role-choice="tenant" checked><span>Find a rental</span></label>
              <label class="role-choice"><input type="checkbox" data-role-choice="owner"><span>List a property</span></label>
            </fieldset>
            <div class="input-box"><input id="password_r" name="password" type="password" placeholder="Password" required minlength="8"><button class="password-toggle" type="button" aria-label="Show password" aria-pressed="false"><i class='bx bx-show' aria-hidden="true"></i></button></div>
            <div class="input-box"><input id="confirm_password" name="confirmPassword" type="password" placeholder="Confirm password" required minlength="8"><button class="password-toggle" type="button" aria-label="Show password" aria-pressed="false"><i class='bx bx-show' aria-hidden="true"></i></button></div>
            <div class="identity-upload">
              <label for="identity-document">Upload a valid ID <span aria-hidden="true">*</span></label>
              <input id="identity-document" name="identityDocument" type="file" accept="image/jpeg,image/png,image/webp,application/pdf,.jpg,.jpeg,.png,.webp,.pdf" required>
              <small>Government-issued or another valid ID, up to 5 MB. Only admins can view it for account verification.</small>
            </div>
            <label class="checkbox-label"><input name="terms" type="checkbox" required> I agree to the <a href="#/terms">Terms and conditions</a>.</label>
            <button class="btn auth-submit register-continue" type="button">Continue to live selfie</button>
            </div>
            <section class="identity-capture-step" hidden aria-labelledby="identity-capture-title">
              <h2 id="identity-capture-title">Take a live selfie</h2>
              <p>Use your camera now. An admin will compare this image with your ID; this is not automated face recognition.</p>
              <p class="identity-camera-message" role="status" aria-live="polite"></p>
              <div class="identity-camera-frame">
                <img class="identity-camera-preview" alt="Live selfie preview" hidden>
              </div>
              <div class="identity-camera-actions">
                <button class="btn identity-camera-start" type="button">Open camera</button>
                <button class="btn identity-camera-retake" type="button" hidden>Retake</button>
              </div>
              <div class="identity-capture-footer">
                <button class="btn identity-camera-back" type="button">Back</button>
                <button class="btn auth-submit identity-camera-submit" type="submit" hidden>Submit for review</button>
              </div>
            </section>
          </div>
        </form>
      </div>

      <div class="toggle-box">
        <div class="toggle-panel toggle-left">
          <p class="welcome-kicker">WELCOME TO DORMHIVE</p>
          <h1><span>Hello,</span><span>Welcome!</span></h1>
          <p>Your next chapter starts here.<br>Sign in to access your account and<br>manage your stay with ease.</p>
          <button class="btn register-btn">Register</button>
          <div class="welcome-footer" aria-label="DormHive values">
            <span class="welcome-footer-line" aria-hidden="true"></span>
            <span class="welcome-footer-values">SAFE <b aria-hidden="true">•</b> SIMPLE <b aria-hidden="true">•</b> SMART</span>
          </div>
        </div>
        <div class="toggle-panel toggle-right">
          <p class="welcome-kicker">WELCOME TO DORMHIVE</p>
          <span class="welcome-divider-line" aria-hidden="true"></span>
          <h1><span>Join Our</span><span>Community!</span></h1>
          <p>Create your account and be part<br>of a safe, simple, and convenient<br>way to manage your dorm life.</p>
          <button class="btn login-btn">Login</button>
          <div class="welcome-footer" aria-label="DormHive values">
            <span class="welcome-footer-line" aria-hidden="true"></span>
            <span class="welcome-footer-values">SAFE <b aria-hidden="true">•</b> SIMPLE <b aria-hidden="true">•</b> SMART</span>
          </div>
        </div>
      </div>
    </div>
  `;

  const container = root.querySelector('.container');
  const registerBtn = root.querySelector('.register-btn');
  const loginBtn = root.querySelector('.login-btn');
  const form = root.querySelector('.form-box.register form');
  const message = root.querySelector('.auth-message');
  const submitButton = root.querySelector('.identity-camera-submit');
  const continueButton = root.querySelector('.register-continue');
  const formFields = root.querySelector('.register-form-fields');
  const captureStep = root.querySelector('.identity-capture-step');
  const phoneInput = root.querySelector('#phone_r');
  const identityDocumentInput = root.querySelector('#identity-document');
  const roleInput = root.querySelector('#role');
  const cameraMessage = root.querySelector('.identity-camera-message');
  const cameraPreview = root.querySelector('.identity-camera-preview');
  installSelfiePreview(cameraPreview, root);
  const cameraStartButton = root.querySelector('.identity-camera-start');
  const cameraRetakeButton = root.querySelector('.identity-camera-retake');
  const cameraBackButton = root.querySelector('.identity-camera-back');
  const selfieCapture = installLiveSelfieCapture({
    root,
    previewImage: cameraPreview,
    openButton: cameraStartButton,
    retakeButton: cameraRetakeButton,
    submitButton,
    statusMessage: cameraMessage
  });
  root.querySelectorAll('[data-role-choice]').forEach((choice) => {
    choice.addEventListener('change', () => {
      if (!choice.checked) {
        choice.checked = true;
        return;
      }
      root.querySelectorAll('[data-role-choice]').forEach((otherChoice) => {
        if (otherChoice !== choice) otherChoice.checked = false;
      });
      roleInput.value = choice.dataset.roleChoice;
    });
  });
  root.querySelectorAll('.checkbox-label a[href="#/terms"], .checkbox-label a[href="#/privacy"]').forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      openLegalModal(link.getAttribute('href') === '#/terms' ? 'terms' : 'privacy');
    });
  });

  root.querySelectorAll('.password-toggle').forEach((toggle) => {
    toggle.addEventListener('click', () => {
      const passwordInput = toggle.parentElement.querySelector('input');
      const isVisible = passwordInput.type === 'text';
      passwordInput.type = isVisible ? 'password' : 'text';
      toggle.setAttribute('aria-label', isVisible ? 'Show password' : 'Hide password');
      toggle.setAttribute('aria-pressed', String(!isVisible));
      toggle.querySelector('i').className = isVisible ? 'bx bx-show' : 'bx bx-hide';
    });
  });

  const getPhoneDigits = (value = '') => String(value).replace(/\D/g, '').slice(0, 10);

  const formatPhoneValue = (value = '') => {
    const digits = getPhoneDigits(value);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  };
  const normalizePhoneValue = formatPhoneValue;

  const toServerPhoneValue = (value = '') => {
    const digits = getPhoneDigits(value);
    return digits ? `+63${digits}` : '';
  };

  const isValidPhoneValue = (value = '') => {
    const digits = getPhoneDigits(value);
    return /^9\d{9}$/.test(digits) && digits.length === 10;
  };

  const validatePhoneField = (showError = true) => {
    const digits = getPhoneDigits(phoneInput.value);
    const formatted = formatPhoneValue(digits);
    if (phoneInput.value !== formatted) phoneInput.value = formatted;
    const valid = isValidPhoneValue(digits);
    phoneInput.setCustomValidity(valid ? '' : 'Phone number must be exactly 10 digits.');
    if (showError && !valid) {
      showMessage(message, 'Phone number must be exactly 10 digits.');
    } else if (showError && message && !message.hidden && message.textContent === 'Phone number must be exactly 10 digits.') {
      message.hidden = true;
      message.textContent = '';
    }
    return valid;
  };

  phoneInput.addEventListener('input', () => {
    const cursor = phoneInput.selectionStart ?? phoneInput.value.length;
    const digitsBeforeCursor = getPhoneDigits(phoneInput.value.slice(0, cursor)).length;
    const digits = getPhoneDigits(phoneInput.value);
    phoneInput.value = normalizePhoneValue(phoneInput.value);
    let nextCursor = 0;
    let digitsSeen = 0;
    while (nextCursor < phoneInput.value.length && digitsSeen < digitsBeforeCursor) {
      if (/\d/.test(phoneInput.value[nextCursor])) digitsSeen += 1;
      nextCursor += 1;
    }
    if ((digitsBeforeCursor === 3 || digitsBeforeCursor === 6) && digits.length > digitsBeforeCursor) {
      nextCursor += 1;
    }
    phoneInput.setSelectionRange(nextCursor, nextCursor);
    validatePhoneField(false);
  });

  registerBtn.addEventListener('click', () => container.classList.add('active'));
  loginBtn.addEventListener('click', () => container.classList.remove('active'));

  const showCameraStep = () => {
    formFields.querySelectorAll('input, button, select, textarea').forEach((field) => { field.disabled = true; });
    formFields.hidden = true;
    captureStep.hidden = false;
    cameraMessage.textContent = 'Only admins can view your ID and selfie. Both files are deleted after the review decision.';
    cameraStartButton.focus();
  };

  continueButton.addEventListener('click', () => {
    const formValues = Object.fromEntries(new FormData(form));
    if (String(formValues.password ?? '') !== String(formValues.confirmPassword ?? '')) {
      showMessage(message, 'Passwords do not match.');
      return;
    }
    if (!form.reportValidity()) return;
    if (!validatePhoneField(true)) {
      phoneInput.focus();
      return;
    }
    const identityDocument = identityDocumentInput.files[0];
    if (!identityDocument || identityDocument.size > 5 * 1024 * 1024) {
      showMessage(message, 'Choose an ID file that is no larger than 5 MB.');
      identityDocumentInput.focus();
      return;
    }
    if (message) message.hidden = true;
    showCameraStep();
  });

  cameraBackButton.addEventListener('click', () => {
    selfieCapture.clear();
    captureStep.hidden = true;
    formFields.hidden = false;
    formFields.querySelectorAll('input, button, select, textarea').forEach((field) => { field.disabled = false; });
    continueButton.focus();
  });

  window.addEventListener('hashchange', selfieCapture.clear, { once: true });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const selfieFile = selfieCapture.getFile();
    if (!selfieFile) {
      cameraMessage.textContent = 'Capture a live selfie before submitting your account.';
      return;
    }

    formFields.querySelectorAll('input, button, select, textarea').forEach((field) => { field.disabled = false; });
    const requestData = new FormData(form);
    formFields.querySelectorAll('input, button, select, textarea').forEach((field) => { field.disabled = true; });
    requestData.delete('terms');
    requestData.delete('confirmPassword');
    requestData.set('phone', toServerPhoneValue(requestData.get('phone')));
    requestData.append('selfie', selfieFile);

    submitButton.disabled = true;
    submitButton.textContent = 'Submitting…';
    if (message) message.hidden = true;
    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, { method: 'POST', body: requestData });
      const body = await readApiResponse(response);
      if (!response.ok) throw new Error(getApiErrorMessage(body, 'Unable to create your account.'));
      showToast({ message: 'Account created. You can sign in while admin reviews your verification.', type: 'success' });
      selfieCapture.clear();
      navigate('/login', true);
    } catch (error) {
      showMessage(message, error.message);
      submitButton.disabled = false;
      submitButton.textContent = 'Submit for review';
    }
  });
}
