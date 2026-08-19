const API_BASE_URL = window.DORMHIVE_API_URL ?? 'http://localhost:5000/api/v1';

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

export async function renderLogin(root = document.querySelector('#app')) {
  if (!root) throw new Error('Login page requires an element with id "app".');
  await loadStylesheet();
  root.innerHTML = `
    <div class="container">
      <a class="auth-brand" href="../index.html">DormHive</a>
      <div class="form-box login">
        <form aria-labelledby="login-title">
          <div class="form-inner">
            <h1 id="login-title">Login</h1>
            <p>Sign in to continue</p>
            <p class="auth-message" role="alert" hidden></p>
            <div class="input-box"><input id="email" name="email" type="email" placeholder="Email" required><i class='bx bxs-envelope'></i></div>
            <div class="input-box"><input id="password" name="password" type="password" placeholder="Password" required minlength="8"><i class='bx bxs-lock-alt'></i></div>
            <div class="forgot-link"><a href="#">Forgot Password?</a></div>
            <button class="btn auth-submit" type="submit">Login</button>
            <p>or login with social platforms</p>
            <div class="social-icons"><a href="#"><i class='bx bxl-google'></i></a><a href="#"><i class='bx bxl-facebook'></i></a></div>
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
            <div class="input-box"><input id="password_r" name="password" type="password" placeholder="Password" required minlength="8"><i class='bx bxs-lock-alt'></i></div>
            <div class="input-box"><input id="confirm_password" name="confirmPassword" type="password" placeholder="Confirm password" required minlength="8"><i class='bx bxs-lock-alt'></i></div>
            <label class="checkbox-label"><input name="terms" type="checkbox" required> I agree to the terms of service.</label>
            <button class="btn auth-submit" type="submit">Register</button>
          </div>
        </form>
      </div>

      <div class="toggle-box">
        <div class="toggle-panel toggle-left">
          <h1>Hello, Welcome!</h1>
          <p>Don't have an account?</p>
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
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? 'Unable to sign in.');
      localStorage.setItem('dormhive.accessToken', body.accessToken);
      localStorage.setItem('dormhive.user', JSON.stringify(body.user));
      redirectForRole(body.user.role);
    } catch (error) {
      showMessage(message, error.message);
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
        const body = await response.json();
        if (!response.ok) throw new Error(body.message ?? 'Unable to create your account.');
        localStorage.setItem('dormhive.accessToken', body.accessToken);
        localStorage.setItem('dormhive.user', JSON.stringify(body.user));
        redirectForRole(body.user.role);
      } catch (error) {
        showMessage(message, error.message);
        registerSubmitButton.disabled = false;
        registerSubmitButton.textContent = 'Register';
      }
    });
  }
}
