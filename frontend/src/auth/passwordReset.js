const API_BASE_URL = (window.DORMHIVE_API_URL ?? 'http://localhost:5000/api/v1').replace(/\/$/, '');
import { navigate } from '../../router.js';
import { showToast } from '../components/toast.js';
import { getApiErrorMessage, readApiResponse } from '../services/api.js';

function loadStyles() {
  if (document.querySelector('[data-password-reset-style]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('./style/authSplit.css', import.meta.url);
  link.dataset.passwordResetStyle = 'true';
  document.head.append(link);
}

function page(content) {
  return `<main class="password-reset-page"><section class="password-reset-card">${content}</section></main>`;
}

function showMessage(container, text, type = 'error') {
  let message = container.querySelector('.password-reset-message');
  if (!message) {
    message = document.createElement('p');
    message.className = 'password-reset-message';
    message.setAttribute('role', 'status');
    container.prepend(message);
  }
  message.className = `password-reset-message password-reset-${type}`;
  message.textContent = text;
  message.hidden = false;
}

async function post(path, payload) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const body = await readApiResponse(response);
  if (!response.ok) {
    const error = new Error(getApiErrorMessage(body, 'Unable to complete your request. Please try again.'));
    error.status = response.status;
    error.data = body;
    throw error;
  }
  return body;
}

function normalizedMobile(value) {
  let digits = String(value).replace(/\D/g, '');
  if (digits.startsWith('63')) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = digits.slice(1);
  return /^9\d{9}$/.test(digits) ? digits : null;
}

function phonePage(root) {
  root.innerHTML = page(`
    <a class="password-reset-back" href="#/login">Back to login</a>
    <p class="password-reset-eyebrow">ACCOUNT RECOVERY</p>
    <h1>Forgot password?</h1>
    <p class="password-reset-intro">Enter the mobile number linked to your DormHive account. We’ll text you a verification code.</p>
    <form class="password-reset-form" novalidate>
      <label class="password-reset-label" for="reset-mobile">Philippine mobile number</label>
      <div class="password-reset-phone">
        <span aria-hidden="true">+63</span>
        <input id="reset-mobile" name="phone" type="tel" inputmode="numeric" autocomplete="tel-national" placeholder="9XX XXX XXXX" maxlength="10" required>
      </div>
      <button class="btn auth-submit" type="submit">Send OTP</button>
    </form>
  `);
  const form = root.querySelector('.password-reset-form');
  const input = form.elements.phone;
  input.addEventListener('input', () => {
    let digits = input.value.replace(/\D/g, '');
    if (digits.startsWith('63')) digits = digits.slice(2);
    if (digits.startsWith('0')) digits = digits.slice(1);
    input.value = digits.slice(0, 10);
    input.setCustomValidity(/^9\d{9}$/.test(input.value) ? '' : 'Enter a valid 10-digit mobile number beginning with 9.');
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const digits = normalizedMobile(input.value);
    if (!digits) {
      input.setCustomValidity('Enter a valid 10-digit mobile number beginning with 9.');
      form.reportValidity();
      return;
    }
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = 'Sending OTP…';
    try {
      await post('/auth/password-reset/request-otp', { phone: `+63${digits}` });
      otpPage(root, digits);
    } catch (error) {
      showMessage(form, error.message);
      button.disabled = false;
      button.textContent = 'Send OTP';
    }
  });
}

function formatTime(seconds) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function otpPage(root, mobile) {
  const maskedMobile = `+63 ${mobile.slice(0, 3)} ••• •${mobile.slice(-3)}`;
  root.innerHTML = page(`
    <a class="password-reset-back" href="#/forgot-password" data-change-number>Change mobile number</a>
    <p class="password-reset-eyebrow">VERIFY YOUR NUMBER</p>
    <h1>Enter your code</h1>
    <p class="password-reset-intro">Enter the 6-digit code sent to <strong>${maskedMobile}</strong>.</p>
    <form class="password-reset-form password-reset-otp-form" novalidate>
      <div class="password-reset-otp-inputs" role="group" aria-label="6-digit verification code">
        ${Array.from({ length: 6 }, (_, index) => `<input class="password-reset-otp-input" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="${index === 0 ? '6' : '1'}" autocomplete="${index === 0 ? 'one-time-code' : 'off'}" aria-label="Digit ${index + 1}" required>`).join('')}
      </div>
      <p class="password-reset-timer" aria-live="polite">Code expires in <strong data-expiry-timer>5:00</strong></p>
      <button class="btn auth-submit" type="submit">Verify code</button>
      <button class="password-reset-resend" type="button" data-resend disabled>Resend OTP in <span data-resend-timer>1:00</span></button>
    </form>
  `);

  const form = root.querySelector('.password-reset-otp-form');
  const fields = [...form.querySelectorAll('.password-reset-otp-input')];
  const verifyButton = form.querySelector('button[type="submit"]');
  const resendButton = form.querySelector('[data-resend]');
  let expiresIn = 300;
  let resendIn = 60;
  let busy = false;
  let locked = false;

  const updateTimers = () => {
    const expiry = form.querySelector('[data-expiry-timer]');
    const resend = form.querySelector('[data-resend-timer]');
    if (!expiry || !resend) return false;
    expiry.textContent = formatTime(expiresIn);
    resend.textContent = formatTime(resendIn);
    resendButton.disabled = resendIn > 0 || busy;
    resendButton.textContent = resendIn > 0 ? `Resend OTP in ${formatTime(resendIn)}` : 'Resend OTP';
    verifyButton.disabled = expiresIn <= 0 || busy || locked;
    if (expiresIn <= 0) showMessage(form, 'This code has expired. Request a new OTP to continue.');
    return true;
  };

  const timer = setInterval(() => {
    if (!form.querySelector('[data-expiry-timer]')) {
      clearInterval(timer);
      return;
    }
    if (expiresIn > 0) expiresIn -= 1;
    if (resendIn > 0) resendIn -= 1;
    updateTimers();
  }, 1000);
  updateTimers();

  fields.forEach((field, index) => {
    field.addEventListener('input', () => {
      const digits = field.value.replace(/\D/g, '');
      if (index === 0 && digits.length > 1) {
        [...digits.slice(0, 6)].forEach((digit, digitIndex) => { fields[digitIndex].value = digit; });
        fields[Math.min(digits.length, 6) - 1].focus();
      } else {
        field.value = digits.slice(-1);
        if (field.value && index < fields.length - 1) fields[index + 1].focus();
      }
      form.querySelector('.password-reset-message')?.remove();
    });
    field.addEventListener('keydown', (event) => {
      if (event.key === 'Backspace' && !field.value && index > 0) fields[index - 1].focus();
      if (event.key === 'ArrowLeft' && index > 0) fields[index - 1].focus();
      if (event.key === 'ArrowRight' && index < fields.length - 1) fields[index + 1].focus();
    });
    field.addEventListener('paste', (event) => {
      const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
      if (!pasted) return;
      event.preventDefault();
      [...pasted].forEach((digit, digitIndex) => { fields[digitIndex].value = digit; });
      fields[Math.min(pasted.length, fields.length) - 1].focus();
    });
  });
  fields[0].focus();

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const code = fields.map((field) => field.value).join('');
    if (!/^\d{6}$/.test(code)) {
      showMessage(form, 'Enter all 6 digits from your SMS.');
      fields.find((field) => !field.value)?.focus();
      return;
    }
    if (expiresIn <= 0) return showMessage(form, 'This code has expired. Request a new OTP to continue.');
    busy = true;
    verifyButton.textContent = 'Verifying…';
    updateTimers();
    try {
      const result = await post('/auth/password-reset/verify-otp', { phone: `+63${mobile}`, code });
      clearInterval(timer);
      navigate(`/reset-password?token=${encodeURIComponent(result.resetToken)}`);
    } catch (error) {
      showMessage(form, error.message);
      if (error.status === 429 && /too many incorrect codes/i.test(error.message)) locked = true;
    } finally {
      busy = false;
      verifyButton.textContent = 'Verify code';
      updateTimers();
    }
  });

  resendButton.addEventListener('click', async () => {
    if (resendIn > 0 || busy) return;
    busy = true;
    updateTimers();
    try {
      await post('/auth/password-reset/request-otp', { phone: `+63${mobile}` });
      expiresIn = 300;
      resendIn = 60;
      locked = false;
      fields.forEach((field) => { field.value = ''; });
      fields[0].focus();
      const message = form.querySelector('.password-reset-message');
      message?.remove();
    } catch (error) {
      const retryAfter = Number(error.data?.resendAfterSeconds);
      if (retryAfter > 0) resendIn = retryAfter;
      showMessage(form, error.message);
    } finally {
      busy = false;
      updateTimers();
    }
  });
}

export async function renderForgotPassword(root = document.querySelector('#app')) {
  loadStyles();
  phonePage(root);
}

export async function renderResetPassword(root = document.querySelector('#app')) {
  loadStyles();
  const token = new URLSearchParams(window.DORMHIVE_ROUTE_SEARCH ?? location.hash.split('?')[1] ?? '').get('token') ?? '';
  if (!token) {
    root.innerHTML = page('<a class="password-reset-back" href="#/forgot-password">Start password recovery</a><p class="password-reset-eyebrow">ACCOUNT RECOVERY</p><h1>Reset link unavailable</h1><p class="password-reset-intro">Verify your mobile number first to create a secure password reset link.</p>');
    return;
  }
  root.innerHTML = page(`
    <a class="password-reset-back" href="#/login">Back to login</a>
    <p class="password-reset-eyebrow">NEW PASSWORD</p>
    <h1>Create a new password</h1>
    <p class="password-reset-intro">Choose a new password for your DormHive account.</p>
    <form class="password-reset-form" novalidate>
      <label class="password-reset-label" for="reset-password">New password</label>
      <input id="reset-password" name="password" type="password" placeholder="At least 8 characters" minlength="8" autocomplete="new-password" required>
      <label class="password-reset-label" for="reset-confirm-password">Confirm password</label>
      <input id="reset-confirm-password" name="confirmPassword" type="password" placeholder="Re-enter your password" minlength="8" autocomplete="new-password" required>
      <button class="btn auth-submit" type="submit">Update password</button>
    </form>
  `);
  const form = root.querySelector('.password-reset-form');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    if (form.elements.password.value !== form.elements.confirmPassword.value) {
      showMessage(form, 'Passwords do not match.');
      form.elements.confirmPassword.focus();
      return;
    }
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = 'Updating…';
    try {
      const result = await post('/auth/password-reset/confirm', { token, password: form.elements.password.value });
      showToast({ message: result.message || 'Password updated successfully. You can now sign in.', type: 'success' });
      navigate('/login', true);
    } catch (error) {
      showMessage(form, error.message);
      button.disabled = false;
      button.textContent = 'Update password';
    }
  });
}