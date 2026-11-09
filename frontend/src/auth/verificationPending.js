import { currentUser, navigate, redirectForRole } from '../../router.js';

async function loadStylesheet() {
  const existing = document.querySelector('link[data-dormhive-auth="split"]');
  if (existing) return existing.sheet ? Promise.resolve() : new Promise((resolve) => existing.addEventListener('load', resolve, { once: true }));
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('./style/split-auth.css', import.meta.url).href;
  link.dataset.dormhiveAuth = 'split';
  document.head.append(link);
  return new Promise((resolve) => {
    link.addEventListener('load', resolve, { once: true });
    link.addEventListener('error', resolve, { once: true });
  });
}

export async function renderVerificationPending(root = document.querySelector('#app')) {
  if (!root) throw new Error('Verification status requires #app.');
  await loadStylesheet();
  const user = currentUser();
  if (!user || user.verification_status !== 'pending') {
    return navigate(redirectForRole(user?.role, user?.verification_status), true);
  }

  const escapedName = document.createElement('span');
  escapedName.textContent = user.name || 'there';
  root.innerHTML = `
    <main class="verification-pending-page">
      <section class="verification-pending-panel" aria-labelledby="verification-pending-title">
        <p class="verification-pending-kicker">ACCOUNT VERIFICATION</p>
        <h1 id="verification-pending-title">Your account is under review</h1>
        <p>Hello, ${escapedName.innerHTML}. You can browse properties while an admin reviews your ID and live selfie.</p>
        <p>Property inquiries and owner listings unlock after your account is approved. Sign in again to check your review status.</p>
        <div class="verification-pending-actions">
          <a href="#/">Browse DormHive</a>
          <button type="button" class="verification-pending-signout">Sign out</button>
        </div>
      </section>
    </main>`;

  root.querySelector('.verification-pending-signout').addEventListener('click', () => {
    localStorage.removeItem('dormhive.accessToken');
    localStorage.removeItem('dormhive.user');
    navigate('/login', true);
  });
}
