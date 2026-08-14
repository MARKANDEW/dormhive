const glyphs = {
  dashboardAdmin: '⌂',
  userManagement: '☉',
  listingModeration: '☐',
  systemHealth: '⚡',
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
  return `
    <aside class="admin-nav">
      <a class="admin-logo" href="#/admin/dashboardAdmin">DormHive <small>ADMIN</small></a>
      ${sidebarLinks.map(([page, label]) => `
        <a class="nav-item ${active === page ? 'active' : ''}" href="#/admin/${page}">
          <span class="nav-icon">${glyphs[page] ?? ''}</span>
          <span>${label}</span>
        </a>
      `).join('')}
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

  const logoutButton = event.target.closest('.logout');
  if (logoutButton) {
    localStorage.clear();
    location.assign('#/login');
  }
});
