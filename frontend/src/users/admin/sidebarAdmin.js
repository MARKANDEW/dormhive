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
        <b class="admin-logo-mark" aria-hidden="true"><svg class="admin-logo-icon" viewBox="0 0 180 180" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" role="img"><defs><linearGradient id="admin-brand-navy" x1="20" y1="10" x2="160" y2="170" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#203E69"/><stop offset="0.55" stop-color="#102B4F"/><stop offset="1" stop-color="#071B35"/></linearGradient><linearGradient id="admin-brand-gold" x1="70" y1="30" x2="120" y2="145" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#FFE08A"/><stop offset="0.35" stop-color="#F5BE42"/><stop offset="1" stop-color="#C98213"/></linearGradient><filter id="admin-brand-shadow" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="12" stdDeviation="10" flood-opacity="0.20"/></filter><filter id="admin-brand-glow"><feGaussianBlur stdDeviation="2.5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><path d="M90 8 C126 8 157 36 162 71 C167 106 148 139 119 157 C108 164 98 169 90 172 C82 169 72 164 61 157 C32 139 13 106 18 71 C23 36 54 8 90 8Z" fill="url(#admin-brand-navy)" filter="url(#admin-brand-shadow)"/><path d="M90 20 C120 20 146 43 150 72 C154 101 139 128 114 144 C105 150 97 154 90 157 C83 154 75 150 66 144 C41 128 26 101 30 72 C34 43 60 20 90 20Z" fill="none" stroke="url(#admin-brand-gold)" stroke-width="2" opacity=".75"/><path d="M90 31 L105 40 L105 57 L90 66 L75 57 L75 40Z" fill="none" stroke="url(#admin-brand-gold)" stroke-width="3" opacity=".9"/><path d="M55 55 L70 64 L70 81 L55 90 L40 81 L40 64Z" fill="none" stroke="url(#admin-brand-gold)" stroke-width="3" opacity=".55"/><path d="M125 55 L140 64 L140 81 L125 90 L110 81 L110 64Z" fill="none" stroke="url(#admin-brand-gold)" stroke-width="3" opacity=".55"/><path d="M59 54 L59 122 C59 133 67 139 78 139 L91 139 C119 139 137 121 137 96 C137 71 119 54 91 54 Z M78 71 L91 71 C108 71 119 81 119 96 C119 111 108 122 91 122 L78 122 Z" fill="white" fill-rule="evenodd"/><path d="M69 88 L89 69 L109 88" fill="none" stroke="url(#admin-brand-gold)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" filter="url(#admin-brand-glow)"/><path d="M82 119 L82 99 C82 94 85 91 90 91 C95 91 98 94 98 99 L98 119" fill="url(#admin-brand-gold)"/><circle cx="94" cy="105" r="2" fill="#102B4F"/><circle cx="90" cy="42" r="3" fill="#FFE08A"/><circle cx="48" cy="72" r="2.5" fill="#F5BE42" opacity=".8"/><circle cx="132" cy="72" r="2.5" fill="#F5BE42" opacity=".8"/><path d="M68 148 C75 152 83 155 90 158 C97 155 105 152 112 148" fill="none" stroke="url(#admin-brand-gold)" stroke-width="3" stroke-linecap="round"/></svg></b>
        <span><strong><span class="brand-dorm">Dorm</span><span class="brand-hive">Hive</span></strong><small>Admin Portal</small></span>
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
