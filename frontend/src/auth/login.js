const API_BASE_URL = (window.DORMHIVE_API_URL ?? 'http://localhost:5000/api/v1').replace(/\/$/, '');
import { bindOAuthButtons, oauthButtonsMarkup } from './oauth.js';
import { showToast } from '../components/toast.js';
import { navigate } from '../../router.js';
import { getApiErrorMessage, readApiResponse } from '../services/api.js';

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

function redirectForRole(role) {
  const destinations = { tenant: '/tenant/dashboardTenant', owner: '/owner/dashboardOwner', admin: '/admin/dashboardAdmin' };
  window.location.assign('#' + (destinations[role] ?? '/'));
}

function showMessage(element, message) {
  element.textContent = message;
  element.className = 'auth-message auth-message--error';
  element.hidden = false;
}

function loginErrorMessage(response, body) {
  if (response.status === 429) return 'Too many sign-in attempts. Please wait a few minutes and try again.';
  if (!body && response.status >= 500) return 'The sign-in service is temporarily unavailable. Please try again.';
  if (!body) return `Unable to sign in (request failed with status ${response.status}).`;
  return getApiErrorMessage(body, 'Unable to sign in.');
}

export async function renderLogin(root = document.querySelector('#app')) {
  if (!root) throw new Error('Login page requires an element with id "app".');
  await loadStylesheet();
  root.innerHTML = `
    <div class="container">
      <a class="auth-brand" href="../index.html"><span class="auth-brand-mark" aria-hidden="true"><svg class="auth-brand-icon" viewBox="0 0 180 180" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" role="img"><defs><linearGradient id="auth-brand-navy" x1="20" y1="10" x2="160" y2="170" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#203E69"/><stop offset="0.55" stop-color="#102B4F"/><stop offset="1" stop-color="#071B35"/></linearGradient><linearGradient id="auth-brand-gold" x1="70" y1="30" x2="120" y2="145" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#FFE08A"/><stop offset="0.35" stop-color="#F5BE42"/><stop offset="1" stop-color="#C98213"/></linearGradient><filter id="auth-brand-shadow" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="12" stdDeviation="10" flood-opacity="0.20"/></filter><filter id="auth-brand-glow"><feGaussianBlur stdDeviation="2.5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><path d="M90 8 C126 8 157 36 162 71 C167 106 148 139 119 157 C108 164 98 169 90 172 C82 169 72 164 61 157 C32 139 13 106 18 71 C23 36 54 8 90 8Z" fill="url(#auth-brand-navy)" filter="url(#auth-brand-shadow)"/><path d="M90 20 C120 20 146 43 150 72 C154 101 139 128 114 144 C105 150 97 154 90 157 C83 154 75 150 66 144 C41 128 26 101 30 72 C34 43 60 20 90 20Z" fill="none" stroke="url(#auth-brand-gold)" stroke-width="2" opacity=".75"/><path d="M90 31 L105 40 L105 57 L90 66 L75 57 L75 40Z" fill="none" stroke="url(#auth-brand-gold)" stroke-width="3" opacity=".9"/><path d="M55 55 L70 64 L70 81 L55 90 L40 81 L40 64Z" fill="none" stroke="url(#auth-brand-gold)" stroke-width="3" opacity=".55"/><path d="M125 55 L140 64 L140 81 L125 90 L110 81 L110 64Z" fill="none" stroke="url(#auth-brand-gold)" stroke-width="3" opacity=".55"/><path d="M59 54 L59 122 C59 133 67 139 78 139 L91 139 C119 139 137 121 137 96 C137 71 119 54 91 54 Z M78 71 L91 71 C108 71 119 81 119 96 C119 111 108 122 91 122 L78 122 Z" fill="white" fill-rule="evenodd"/><path d="M69 88 L89 69 L109 88" fill="none" stroke="url(#auth-brand-gold)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" filter="url(#auth-brand-glow)"/><path d="M82 119 L82 99 C82 94 85 91 90 91 C95 91 98 94 98 99 L98 119" fill="url(#auth-brand-gold)"/><circle cx="94" cy="105" r="2" fill="#102B4F"/><circle cx="90" cy="42" r="3" fill="#FFE08A"/><circle cx="48" cy="72" r="2.5" fill="#F5BE42" opacity=".8"/><circle cx="132" cy="72" r="2.5" fill="#F5BE42" opacity=".8"/><path d="M68 148 C75 152 83 155 90 158 C97 155 105 152 112 148" fill="none" stroke="url(#auth-brand-gold)" stroke-width="3" stroke-linecap="round"/></svg></span><span class="auth-brand-name"><span>Dorm</span><span class="auth-brand-name-accent">Hive</span></span></a>
      <div class="form-box login">
        <form aria-labelledby="login-title" autocomplete="off">
          <div class="form-inner">
            <div class="auth-form-brand" aria-label="DormHive"><span class="auth-form-brand-mark" aria-hidden="true"><svg class="auth-form-brand-icon" viewBox="0 0 180 180" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" role="img"><defs><linearGradient id="auth-form-navy" x1="20" y1="10" x2="160" y2="170" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#203E69"/><stop offset="0.55" stop-color="#102B4F"/><stop offset="1" stop-color="#071B35"/></linearGradient><linearGradient id="auth-form-gold" x1="70" y1="30" x2="120" y2="145" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#FFE08A"/><stop offset="0.35" stop-color="#F5BE42"/><stop offset="1" stop-color="#C98213"/></linearGradient><filter id="auth-form-shadow" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="12" stdDeviation="10" flood-opacity="0.20"/></filter><filter id="auth-form-glow"><feGaussianBlur stdDeviation="2.5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><path d="M90 8 C126 8 157 36 162 71 C167 106 148 139 119 157 C108 164 98 169 90 172 C82 169 72 164 61 157 C32 139 13 106 18 71 C23 36 54 8 90 8Z" fill="url(#auth-form-navy)" filter="url(#auth-form-shadow)"/><path d="M90 20 C120 20 146 43 150 72 C154 101 139 128 114 144 C105 150 97 154 90 157 C83 154 75 150 66 144 C41 128 26 101 30 72 C34 43 60 20 90 20Z" fill="none" stroke="url(#auth-form-gold)" stroke-width="2" opacity=".75"/><path d="M90 31 L105 40 L105 57 L90 66 L75 57 L75 40Z" fill="none" stroke="url(#auth-form-gold)" stroke-width="3" opacity=".9"/><path d="M55 55 L70 64 L70 81 L55 90 L40 81 L40 64Z" fill="none" stroke="url(#auth-form-gold)" stroke-width="3" opacity=".55"/><path d="M125 55 L140 64 L140 81 L125 90 L110 81 L110 64Z" fill="none" stroke="url(#auth-form-gold)" stroke-width="3" opacity=".55"/><path d="M59 54 L59 122 C59 133 67 139 78 139 L91 139 C119 139 137 121 137 96 C137 71 119 54 91 54 Z M78 71 L91 71 C108 71 119 81 119 96 C119 111 108 122 91 122 L78 122 Z" fill="white" fill-rule="evenodd"/><path d="M69 88 L89 69 L109 88" fill="none" stroke="url(#auth-form-gold)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" filter="url(#auth-form-glow)"/><path d="M82 119 L82 99 C82 94 85 91 90 91 C95 91 98 94 98 99 L98 119" fill="url(#auth-form-gold)"/><circle cx="94" cy="105" r="2" fill="#102B4F"/><circle cx="90" cy="42" r="3" fill="#FFE08A"/><circle cx="48" cy="72" r="2.5" fill="#F5BE42" opacity=".8"/><circle cx="132" cy="72" r="2.5" fill="#F5BE42" opacity=".8"/><path d="M68 148 C75 152 83 155 90 158 C97 155 105 152 112 148" fill="none" stroke="url(#auth-form-gold)" stroke-width="3" stroke-linecap="round"/></svg></span><span>Dorm<span class="auth-form-brand-accent">Hive</span></span></div>
            <h1 id="login-title">Login</h1>
            <p>Sign in to continue</p>
            <p class="auth-message" role="alert" hidden></p>
            <div class="input-box"><input id="email" name="email" type="email" placeholder="Email" autocomplete="off" required><i class='bx bxs-envelope'></i></div>
            <div class="input-box"><input id="password" name="password" type="password" placeholder="Password" autocomplete="new-password" required minlength="8"><button class="password-toggle" type="button" aria-label="Show password" aria-pressed="false"><i class='bx bx-show' aria-hidden="true"></i></button></div>
            <div class="forgot-link"><a href="#">Forgot Password?</a></div>
            <button class="btn auth-submit" type="submit">Login</button>
            <p>or login with social platforms</p>
            ${oauthButtonsMarkup()}
          </div>
        </form>
      </div>

      <div class="form-box register">
        <form aria-labelledby="register-title">
          <div class="form-inner">
            <h1 id="register-title">Registration</h1>
            <p>Create your account</p>
            <p class="auth-message" role="alert" hidden></p>
            <div class="input-box"><input id="first_name" name="first_name" type="text" placeholder="First name" required maxlength="120"><i class='bx bxs-user'></i></div>
            <div class="input-box"><input id="last_name" name="last_name" type="text" placeholder="Last name" required maxlength="120"><i class='bx bxs-user'></i></div>
            <div class="input-box"><input id="email_r" name="email" type="email" placeholder="Email address" required><i class='bx bxs-envelope'></i></div>
            <div class="input-box phone-input-box">
              <span class="phone-prefix" aria-hidden="true">+63</span>
              <input id="phone_r" name="phone" type="tel" inputmode="numeric" placeholder="9XXXXXXXXX" required maxlength="10" autocomplete="tel">
              <i class='bx bxs-phone'></i>
            </div>
            <div class="input-box"><select id="role" name="role" required><option value="tenant">I want to</option><option value="tenant">Find a rental</option><option value="owner">List a property</option></select></div>
            <div class="input-box"><input id="password_r" name="password" type="password" placeholder="Password" required minlength="8"><button class="password-toggle" type="button" aria-label="Show password" aria-pressed="false"><i class='bx bx-show' aria-hidden="true"></i></button></div>
            <div class="input-box"><input id="confirm_password" name="confirmPassword" type="password" placeholder="Confirm password" required minlength="8"><button class="password-toggle" type="button" aria-label="Show password" aria-pressed="false"><i class='bx bx-show' aria-hidden="true"></i></button></div>
            <label class="checkbox-label"><input name="terms" type="checkbox" required> I agree to the terms of service.</label>
            <button class="btn auth-submit" type="submit">Register</button>
          </div>
        </form>
      </div>

      <div class="toggle-box">
        <div class="toggle-panel toggle-left">
          <p class="welcome-kicker">WELCOME TO DORMHIVE</p>
          <h1><span>Hello,</span><span>Welcome!</span></h1>
          <p>Your next chapter starts here.<br>Sign in to access your account and<br>manage your stay with ease.</p>
          <button class="btn register-btn">Register</button>
        </div>
        <div class="toggle-panel toggle-right">
          <h1>Welcome Back!</h1>
          <p>Already have an account?</p>
          <button class="btn login-btn">Login</button>
        </div>
      </div>
    </div>
  `;

  const container = root.querySelector('.container');
  const registerBtn = root.querySelector('.register-btn');
  const loginBtn = root.querySelector('.login-btn');
  const form = root.querySelector('.form-box.login form');
  const registerForm = root.querySelector('.form-box.register form');
  const message = root.querySelector('.auth-message');
  const loginSubmitButton = root.querySelector('.form-box.login .auth-submit');
  const registerSubmitButton = root.querySelector('.form-box.register .auth-submit');
  const phoneInput = root.querySelector('#phone_r');
  bindOAuthButtons(root);

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
  const normalizePhoneValue = (value = '') => getPhoneDigits(value);
  const toServerPhoneValue = (value = '') => {
    const digits = getPhoneDigits(value);
    return digits ? `+63${digits}` : '';
  };
  const isValidPhoneValue = (value = '') => /^9\d{9}$/.test(getPhoneDigits(value));

  const validatePhoneField = (showError = true) => {
    const digits = getPhoneDigits(phoneInput.value);
    phoneInput.value = digits;
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

  registerBtn.addEventListener('click', () => container.classList.add('active'));
  loginBtn.addEventListener('click', () => container.classList.remove('active'));

  if (phoneInput) {
    phoneInput.addEventListener('input', () => {
      phoneInput.value = normalizePhoneValue(phoneInput.value);
      validatePhoneField(false);
    });
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    loginSubmitButton.disabled = true;
    loginSubmitButton.textContent = 'Signing in…';
    if (message) message.hidden = true;
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(new FormData(form))) });
      const body = await readApiResponse(response);
      if (!response.ok) throw new Error(loginErrorMessage(response, body));
      localStorage.setItem('dormhive.accessToken', body.accessToken);
      localStorage.setItem('dormhive.user', JSON.stringify(body.user));
      redirectForRole(body.user.role);
    } catch (error) {
      showMessage(message, error instanceof TypeError ? 'Unable to reach the sign-in service. Please check that the backend is running.' : error.message);
      loginSubmitButton.disabled = false;
      loginSubmitButton.textContent = 'Login';
    }
  });

  if (registerForm) {
    registerForm.addEventListener('submit', async (event) => {
      event.preventDefault();

      const formData = Object.fromEntries(new FormData(registerForm));
      const password = String(formData.password ?? '');
      const confirmPassword = String(formData.confirmPassword ?? '');

      if (password !== confirmPassword) {
        showMessage(message, 'Passwords do not match.');
        return;
      }

      if (!registerForm.reportValidity()) return;
      if (!validatePhoneField(true)) {
        phoneInput.focus();
        return;
      }

      const { terms, confirmPassword: _confirmPassword, ...payload } = formData;
      payload.phone = toServerPhoneValue(payload.phone);
      registerSubmitButton.disabled = true;
      registerSubmitButton.textContent = 'Creating account…';
      if (message) message.hidden = true;
      try {
        const response = await fetch(`${API_BASE_URL}/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const body = await readApiResponse(response);
        if (!response.ok) throw new Error(getApiErrorMessage(body, 'Unable to create your account.'));
        showToast({ message: 'Account created successfully!', type: 'success' });
        navigate('/login', true);
      } catch (error) {
        showMessage(message, error.message);
        registerSubmitButton.disabled = false;
        registerSubmitButton.textContent = 'Register';
      }
    });
  }
}
