const API_BASE_URL = (window.DORMHIVE_API_URL ?? 'http://localhost:5000/api/v1').replace(/\/$/, '');
import { navigate } from '../../router.js';
import { getApiErrorMessage, readApiResponse } from '../services/api.js';

function page(title, intro, fields, button, message = '') {
  return `<main class="password-reset-page"><section class="password-reset-card"><a class="password-reset-back" href="#/login">Back to login</a><h1>${title}</h1><p class="password-reset-intro">${intro}</p>${message ? `<p class="password-reset-message">${message}</p>` : ''}<form class="password-reset-form">${fields}<button class="btn auth-submit" type="submit">${button}</button></form></section></main>`;
}

function loadStyles() {
  if (document.querySelector('[data-password-reset-style]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('./style/authSplit.css', import.meta.url);
  link.dataset.passwordResetStyle = 'true';
  document.head.append(link);
}

export async function renderForgotPassword(root = document.querySelector('#app')) {
  loadStyles();
  root.innerHTML = page('Forgot password?', 'Enter your email and we will prepare a secure reset link.', '<input name="email" type="email" placeholder="Email address" autocomplete="email" required>', 'Send reset link');
  const form = root.querySelector('form');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = form.querySelector('button');
    button.disabled = true;
    button.textContent = 'Preparing...';
    try {
      const response = await fetch(`${API_BASE_URL}/auth/password-reset/request`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: form.email.value }) });
      const body = await readApiResponse(response);
      if (!response.ok) throw new Error(getApiErrorMessage(body, 'Unable to prepare the reset link.'));
      const link = body.developmentResetUrl ? `<a href="${body.developmentResetUrl}">Open reset page</a>` : 'Check your email for the reset link.';
      form.outerHTML = `<p class="password-reset-message password-reset-success">${body.message} ${link}</p>`;
    } catch (error) {
      const message = document.createElement('p');
      message.className = 'password-reset-message password-reset-error';
      message.textContent = error.message;
      form.prepend(message);
      button.disabled = false;
      button.textContent = 'Send reset link';
    }
  });
}

export async function renderResetPassword(root = document.querySelector('#app')) {
  loadStyles();
  const token = new URLSearchParams(window.DORMHIVE_ROUTE_SEARCH ?? location.hash.split('?')[1] ?? '').get('token') ?? '';
  root.innerHTML = page('Create a new password', 'Choose a new password for your DormHive account.', '<input name="password" type="password" placeholder="New password" minlength="8" required><input name="confirmPassword" type="password" placeholder="Confirm new password" minlength="8" required>', 'Update password');
  const form = root.querySelector('form');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (form.password.value !== form.confirmPassword.value) return showFormError(form, 'Passwords do not match.');
    const button = form.querySelector('button');
    button.disabled = true;
    button.textContent = 'Updating...';
    try {
      const response = await fetch(`${API_BASE_URL}/auth/password-reset/confirm`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, password: form.password.value }) });
      const body = await readApiResponse(response);
      if (!response.ok) throw new Error(getApiErrorMessage(body, 'Unable to update your password.'));
      form.outerHTML = `<p class="password-reset-message password-reset-success">${body.message} <a href="#/login">Go to login</a></p>`;
    } catch (error) {
      showFormError(form, error.message);
      button.disabled = false;
      button.textContent = 'Update password';
    }
  });
}

function showFormError(form, text) {
  let message = form.querySelector('.password-reset-message');
  if (!message) { message = document.createElement('p'); message.className = 'password-reset-message password-reset-error'; form.prepend(message); }
  message.textContent = text;
}
