const API_BASE_URL = window.DORMHIVE_API_URL ?? 'http://localhost:5000/api/v1';

function loadStylesheet() {
  // Remove all auth stylesheets first to ensure clean state
  document.querySelectorAll('link[data-dormhive-auth]').forEach((link) => link.remove());
  document.querySelectorAll('link[id^="dormhive-"]').forEach((link) => link.remove());
  
  // Load fresh stylesheet with cache busting
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('./style/split-auth.css', import.meta.url).href + '?t=' + Date.now();
  link.dataset.dormhiveAuth = 'split';
  document.head.append(link);
  
  // Load boxicons
  if (!document.querySelector('link[href*="boxicons"]')) {
    const icons = document.createElement('link');
    icons.rel = 'stylesheet';
    icons.href = "https://unpkg.com/boxicons@2.1.4/css/boxicons.min.css";
    icons.dataset.dormhiveAuth = 'boxicons';
    document.head.append(icons);
  }
}

function showMessage(element, message) {
  element.textContent = message;
  element.className = 'auth-message auth-message--error';
  element.hidden = false;
}

export function renderRegister(root = document.querySelector('#app')) {
  if (!root) throw new Error('Register page requires an element with id "app".');
  loadStylesheet();
  root.className = '';
  root.innerHTML = `
    <div class="container active">
      <a class="auth-brand" href="../index.html">DormHive</a>
      <div class="form-box login">
        <form aria-labelledby="login-title">
          <div class="form-inner">
            <h1 id="login-title">Login</h1>
            <p>Sign in to continue</p>
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
            <div class="input-box">
              <label for="firstName" class="field-label">First name</label>
              <input id="firstName" name="firstName" type="text" required maxlength="60">
              <i class='bx bxs-user'></i>
            </div>
            <div class="input-box">
              <label for="lastName" class="field-label">Last name</label>
              <input id="lastName" name="lastName" type="text" required maxlength="60">
              <i class='bx bxs-user'></i>
            </div>
            <div class="input-box">
              <label for="email_r" class="field-label">Email address</label>
              <input id="email_r" name="email" type="email" required>
              <i class='bx bxs-envelope'></i>
            </div>
            <div class="input-box">
              <label for="phone" class="field-label">Phone Number (+63)</label>
              <input id="phone" name="phone" type="tel" placeholder="9xxxxxxxxx" required maxlength="10" inputmode="numeric" pattern="[0-9]*">
              <i class='bx bxs-phone'></i>
            </div>
            <div id="phone-hint" class="field-hint" style="display: none; color: #e53e3e; font-weight: 600; margin: -10px 0 10px 0;">Phone number must be exactly 10 digits</div>
            <div class="input-box">
              <label for="role" class="field-label">I want to</label>
              <select id="role" name="role" required>
                <option value="tenant">Find a rental</option>
                <option value="owner">List a property</option>
              </select>
            </div>
            <div class="input-box">
              <label for="password_r" class="field-label">Password</label>
              <input id="password_r" name="password" type="password" required minlength="8">
              <i class='bx bxs-lock-alt'></i>
            </div>
            <div class="field-hint">Use at least 8 characters.</div>
            <div class="input-box">
              <label for="confirmPassword" class="field-label">Confirm password</label>
              <input id="confirmPassword" name="confirmPassword" type="password" required minlength="8">
              <i class='bx bxs-lock-alt'></i>
            </div>
            <label class="checkbox-label"><input name="terms" type="checkbox" required> Agree to the terms of service</label>
            <button class="btn auth-submit" type="submit">Register</button>
            <p>or register with social platforms</p>
            <div class="social-icons"><a href="#"><i class='bx bxl-google'></i></a><a href="#"><i class='bx bxl-facebook'></i></a></div>
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
  const form = root.querySelector('.form-box.register form');
  const message = root.querySelector('.auth-message');
  const submitButton = root.querySelector('.auth-submit');
  const phoneInput = root.querySelector('#phone');
  const phoneHint = root.querySelector('#phone-hint');

  container.classList.add('active');

  // Phone number validation
  if (phoneInput && phoneHint) {
    const validatePhone = () => {
      const phoneValue = phoneInput.value.replace(/\D/g, '');
      const isValid = phoneValue.length === 10;
      phoneInput.style.borderColor = isValid || phoneValue.length === 0 ? '' : '#e53e3e';
      phoneHint.style.display = isValid || phoneValue.length === 0 ? 'none' : 'block';
      return isValid || phoneValue.length === 0;
    };

    phoneInput.addEventListener('input', () => {
      phoneInput.value = phoneInput.value.replace(/\D/g, '');
      validatePhone();
    });

    phoneInput.addEventListener('blur', validatePhone);
  }

  container.classList.add('active');

  registerBtn.addEventListener('click', (event) => {
    event.preventDefault();
    container.classList.add('active');
    window.setTimeout(() => {
      window.location.hash = '#/register';
    }, 1200);
  });
  loginBtn.addEventListener('click', (event) => {
    event.preventDefault();
    container.classList.remove('active');
    window.setTimeout(() => {
      window.location.hash = '#/login';
    }, 1200);
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const formData = Object.fromEntries(new FormData(form));
    const { terms, firstName, lastName, confirmPassword, phone, ...rest } = formData;

    // Validate phone number
    const phoneValue = String(phone ?? '').replace(/\D/g, '');
    if (phoneValue.length !== 10) {
      showMessage(message, 'Phone number must be exactly 10 digits.');
      return;
    }

    // Validate password confirmation
    if (formData.password !== confirmPassword) {
      showMessage(message, 'Passwords do not match.');
      return;
    }

    const payload = {
      first_name: String(firstName ?? '').trim(),
      last_name: String(lastName ?? '').trim(),
      name: `${String(firstName ?? '').trim()} ${String(lastName ?? '').trim()}`.trim(),
      email: String(rest.email ?? '').trim(),
      phone: '+63' + phoneValue,
      password: String(rest.password ?? ''),
      role: String(rest.role ?? 'tenant')
    };

    submitButton.disabled = true;
    submitButton.textContent = 'Registering…';
    if (message) message.hidden = true;
    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? 'Unable to create your account.');
      localStorage.setItem('dormhive.accessToken', body.accessToken);
      localStorage.setItem('dormhive.user', JSON.stringify(body.user));
      window.location.assign('#' + (body.user.role === 'owner' ? '/owner/dashboardOwner' : '/tenant/dashboardTenant'));
    } catch (error) {
      showMessage(message, error.message);
      submitButton.disabled = false;
      submitButton.textContent = 'Register';
    }
  });
}

