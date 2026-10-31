import { installRouter, renderRoute, navigate, redirectForRole } from './router.js';
import { installAvatarPreview } from './src/components/avatarPreview.js';
import { connectRealtime, installRealtimeFetchHeader } from './src/services/realtime.js';

export { navigate, redirectForRole };
function clearSession() {
  localStorage.removeItem('dormhive.accessToken');
  localStorage.removeItem('dormhive.user');
}

function installGlobalAuthHandlers() {
  document.addEventListener('click', (event) => {
    const button = event.target.closest('button.logout, button.signout');
    if (!button) return;
    event.preventDefault();
    clearSession();
    document.querySelector('#app')?.replaceChildren();
    navigate('/login', true);
  });
}

export function startApp() {
  installAvatarPreview();
  installGlobalAuthHandlers();
  installRouter();
  installRealtimeFetchHeader();
  connectRealtime(() => window.dispatchEvent(new Event('dormhive:data-changed')));
  return renderRoute();
}

export function redirectAfterLogin(user) {
  localStorage.setItem('dormhive.user', JSON.stringify(user));
  return navigate(redirectForRole(user.role), true);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startApp);
else startApp();
