import { installRouter, renderRoute, navigate, redirectForRole } from './router.js';

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
    navigate('/login', true);
  });
}

export function startApp() {
  installGlobalAuthHandlers();
  installRouter();
  return renderRoute();
}

export function redirectAfterLogin(user) {
  localStorage.setItem('dormhive.user', JSON.stringify(user));
  return navigate(redirectForRole(user.role), true);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startApp);
else startApp();
