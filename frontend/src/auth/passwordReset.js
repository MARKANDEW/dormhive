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

function contactSupportPage(root) {
  root.innerHTML = page(`
    <a class="password-reset-back" href="#/login">Back to login</a>
    <p class="password-reset-eyebrow">ACCOUNT RECOVERY</p>
    <h1>Password recovery unavailable</h1>
    <p class="password-reset-intro">Email recovery is not configured right now. Contact our support team for help accessing your account.</p>
    <a class="btn auth-submit password-reset-support-link" href="https://mail.google.com/mail/?view=cm&amp;fs=1&amp;to=supportdormhive%40gmail.com" target="_blank" rel="noopener noreferrer">Contact support</a>
  `);
}

function emailPage(root) {
  root.innerHTML = page(`
    <a class="password-reset-back" href="#/login">Back to login</a>
    <p class="password-reset-eyebrow">ACCOUNT RECOVERY</p>
    <h1>Forgot password?</h1>
    <p class="password-reset-intro">Enter the email address linked to your DormHive account. We’ll send you a one-time password reset link.</p>
    <form class="password-reset-form">
      <label class="password-reset-label" for="reset-email">Email address</label>
      <input id="reset-email" name="email" type="email" autocomplete="email" placeholder="you@example.com" required>
      <button class="btn auth-submit" type="submit">Send reset link</button>
    </form>
  `);
  const form = root.querySelector('.password-reset-form');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = 'Sending link…';
    try {
      const result = await post('/auth/password-reset/request', { email: form.elements.email.value.trim() });
      root.innerHTML = page(`
        <a class="password-reset-back" href="#/login">Back to login</a>
        <p class="password-reset-eyebrow">CHECK YOUR EMAIL</p>
        <h1>Reset link requested</h1>
        <p class="password-reset-intro">${result.message} Check your inbox and spam folder. The link expires in 10 minutes and can only be used once.</p>
      `);
    } catch (error) {
      if (error.status === 503) return contactSupportPage(root);
      showMessage(form, error.message);
      button.disabled = false;
      button.textContent = 'Send reset link';
    }
  });
}

export async function renderForgotPassword(root = document.querySelector('#app')) {
  loadStyles();
  try {
    const response = await fetch(`${API_BASE_URL}/auth/password-reset/status`, { cache: 'no-store' });
    const status = await readApiResponse(response);
    if (!response.ok || !status.available) return contactSupportPage(root);
    emailPage(root);
  } catch {
    contactSupportPage(root);
  }
}

export async function renderResetPassword(root = document.querySelector('#app')) {
  loadStyles();
  const token = new URLSearchParams(window.DORMHIVE_ROUTE_SEARCH ?? location.hash.split('?')[1] ?? '').get('token') ?? '';
  if (!token) {
    root.innerHTML = page('<a class="password-reset-back" href="#/forgot-password">Start password recovery</a><p class="password-reset-eyebrow">ACCOUNT RECOVERY</p><h1>Reset link unavailable</h1><p class="password-reset-intro">Use the password reset link sent to your email. You can request another link if it has expired.</p>');
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