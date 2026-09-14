import { getAdminPrivacyMode, setAdminPrivacyMode } from './privacy.js';

const glyphs = {
  dashboardAdmin: '<i class="bi bi-grid-1x2-fill" aria-hidden="true"></i>',
  userManagement: '<i class="bi bi-people-fill" aria-hidden="true"></i>',
  listingModeration: '<i class="bi bi-clipboard-check-fill" aria-hidden="true"></i>',
  systemHealth: '<i class="bi bi-activity" aria-hidden="true"></i>',
  analytics: '<i class="bi bi-bar-chart-line" aria-hidden="true"></i>',
  supportTickets: '<i class="bi bi-headset" aria-hidden="true"></i>',
  setting: '<i class="bi bi-gear-fill" aria-hidden="true"></i>'
};

const sidebarLinks = [
  ['dashboardAdmin', 'Overview'],
  ['userManagement', 'Users'],
  ['listingModeration', 'Moderation'],
  ['systemHealth', 'System health'],
  ['analytics', 'Analytics'],
  ['supportTickets', 'Support'],
  ['setting', 'Settings']
];

export function ensureAdminSidebarStyles() {
  if (document.querySelector('[data-admin-sidebar-style="shared"]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('./style/sidebarAdmin.css', import.meta.url);
  link.dataset.adminSidebarStyle = 'shared';
  document.head.append(link);
}

export function renderAdminSidebar(active = 'dashboardAdmin') {
  const privacyOn = getAdminPrivacyMode();
  const privacyLabel = privacyOn ? 'Privacy: ON' : 'Privacy: OFF';

  return `
    <button type="button" class="admin-mobile-menu" aria-label="Open admin menu" aria-expanded="false"><i class="bi bi-list" aria-hidden="true"></i></button>
    <button type="button" class="admin-nav-backdrop" aria-label="Close admin menu"></button>
    <aside class="admin-nav">
      <a class="admin-logo" href="#/admin/dashboardAdmin">
        <b class="admin-logo-mark" aria-hidden="true"><svg class="admin-logo-icon" viewBox="0 0 24 24"><path d="m12 3 7.8 4.5v9L12 21l-7.8-4.5v-9L12 3Z"/><path d="m8 10 4-2.3 4 2.3v6.2H8V10Z"/><path d="M10.5 16.2v-3.5h3v3.5M8.2 10.2h7.6"/></svg></b>
        <span><strong>DormHive</strong><small>Admin Portal</small></span>
      </a>
      ${sidebarLinks.map(([page, label]) => `
        <a class="nav-item ${active === page ? 'active' : ''}" href="#/admin/${page}">
          <span class="nav-icon">${glyphs[page] ?? ''}</span>
          <span>${label}</span>
        </a>
      `).join('')}
      <button type="button" class="privacy-toggle ${privacyOn ? 'active' : ''}" data-privacy-toggle>
        ${privacyLabel}
      </button>
      <button type="button" class="logout">Sign out</button>
    </aside>`;
}

document.addEventListener('click', (event) => {
  const menuButton = event.target.closest('.menu');
  if (menuButton) {
    const shell = menuButton.closest('.admin-shell');
    if (shell) shell.classList.toggle('nav-open');
    return;
  }

  const adminMenuButton = event.target.closest('.admin-mobile-menu');
  if (adminMenuButton) {
    const shell = adminMenuButton.closest('.admin-shell');
    if (shell) {
      const isOpen = shell.classList.toggle('nav-open');
      adminMenuButton.setAttribute('aria-expanded', String(isOpen));
    }
    return;
  }

  const adminBackdrop = event.target.closest('.admin-nav-backdrop');
  if (adminBackdrop) {
    const shell = adminBackdrop.closest('.admin-shell');
    shell?.classList.remove('nav-open');
    shell?.querySelector('.admin-mobile-menu')?.setAttribute('aria-expanded', 'false');
    return;
  }

  const privacyToggleButton = event.target.closest('[data-privacy-toggle]');
  if (privacyToggleButton) {
    const nextValue = !getAdminPrivacyMode();
    setAdminPrivacyMode(nextValue);
    privacyToggleButton.textContent = nextValue ? 'Privacy: ON' : 'Privacy: OFF';
    privacyToggleButton.classList.toggle('active', nextValue);
    return;
  }

  const logoutButton = event.target.closest('.logout');
  if (logoutButton) {
    localStorage.clear();
    location.assign('#/login');
  }
});
