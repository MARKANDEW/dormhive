import { redirectForRole, navigate } from '../../router.js';
import { renderLogin } from './login.js';

const API_BASE_URL = window.DORMHIVE_API_URL ?? 'http://localhost:5000/api/v1';

function callbackData() {
  const hash = location.hash.replace(/^#\/oauth\/callback\??/, '');
  const [query = '', fragment = ''] = hash.split('#');
  const params = new URLSearchParams(query);
  return { mode: params.get('mode') === 'register' ? 'register' : 'login', error: params.get('error'), accessToken: new URLSearchParams(fragment).get('accessToken') };
}

function tokenPayload(token) {
  try {
    const encoded = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '=')));
  } catch {
    return null;
  }
}

export async function renderOAuthCallback(root = document.querySelector('#app')) {
  const data = callbackData();
  if (data.accessToken) {
    const user = tokenPayload(data.accessToken);
    if (user?.role) {
      let profile = { id: user.sub, role: user.role };
      try {
        const response = await fetch(`${API_BASE_URL}/users/${encodeURIComponent(user.sub)}`, { headers: { Authorization: `Bearer ${data.accessToken}` } });
        if (response.ok) profile = await response.json();
      } catch {
        // The JWT still contains enough information to complete the redirect.
      }
      localStorage.setItem('dormhive.accessToken', data.accessToken);
      localStorage.setItem('dormhive.user', JSON.stringify(profile));
      return navigate(redirectForRole(user.role), true);
    }
  }

  await renderLogin(root);
  if (data.mode === 'register') root.querySelector('.container')?.classList.add('active');
  if (data.error) {
    const message = root.querySelector(data.mode === 'register' ? '.form-box.register .auth-message' : '.form-box.login .auth-message');
    if (message) {
      message.textContent = data.error;
      message.className = 'auth-message auth-message--error';
      message.hidden = false;
    }
  }
}
