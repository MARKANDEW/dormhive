const API_BASE_URL = window.DORMHIVE_API_URL ?? 'http://localhost:5000/api/v1';

export function oauthButtonsMarkup() {
  return `<div class="social-icons" aria-label="Social sign-in options">
    <button class="oauth-button" type="button" data-oauth-provider="google" aria-label="Continue with Google" title="Continue with Google"><i class="bx bxl-google" aria-hidden="true"></i><span class="oauth-spinner" aria-hidden="true"></span></button>
    <button class="oauth-button" type="button" data-oauth-provider="facebook" aria-label="Continue with Facebook" title="Continue with Facebook"><i class="bx bxl-facebook" aria-hidden="true"></i><span class="oauth-spinner" aria-hidden="true"></span></button>
  </div>`;
}

export function bindOAuthButtons(root) {
  root.querySelectorAll('[data-oauth-provider]').forEach((button) => {
    button.addEventListener('click', () => {
      const provider = button.dataset.oauthProvider;
      const role = root.querySelector('#role')?.value ?? 'tenant';
      const mode = root.querySelector('.container')?.classList.contains('active') ? 'register' : 'login';
      button.disabled = true;
      button.classList.add('is-loading');
      button.setAttribute('aria-busy', 'true');
      button.setAttribute('aria-label', `Connecting to ${provider}...`);
      const params = new URLSearchParams({ mode, role });
      window.location.assign(`${API_BASE_URL}/auth/${provider}/start?${params}`);
    });
  });
}
