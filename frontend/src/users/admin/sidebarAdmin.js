import { getAdminPrivacyMode, setAdminPrivacyMode } from './privacy.js';

const glyphs = {
  dashboardAdmin: '⌂',
  userManagement: '☉',
  listingModeration: '☐',
  systemHealth: '<i class="bi bi-lightning-fill" aria-hidden="true"></i>',
  analytics: '∑',
  supportTickets: '✉',
  setting: '⚙'
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
    <aside class="admin-nav">
      <a class="admin-logo" href="#/admin/dashboardAdmin">
        <b class="admin-logo-mark" aria-hidden="true"><svg class="admin-logo-icon" viewBox="0 0 24 24"><path d="m4 10 8-6 8 6v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9Z"/><path d="M9 20v-6h6v6"/></svg></b>
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
