const icons = {
  grid: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>',
  chat: '<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H9l-5 4v-14.5Z"/>',
  calendar: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/>',
  gear: '<path d="m9.4 3.5.6-1h4l.6 1 .3 1.5 1.3.8 1.5-.2 2 3.5-1 1.2.1 1.5 1 1.1-2 3.5-1.5-.2-1.3.8-.3 1.5-.6 1h-4l-.6-1-.3-1.5-1.3-.8-1.5.2-2-3.5 1-1.1-.1-1.5-1-1.2 2-3.5 1.5.2 1.3-.8.3-1.5Z"/><circle cx="12" cy="12" r="3"/>',
  home: '<path d="m4 10 8-6 8 6v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9Z"/><path d="M9 20v-6h6v6"/>',
  logout: '<path d="M10 4H5.5A1.5 1.5 0 0 0 4 5.5v13A1.5 1.5 0 0 0 5.5 20H10M15 8l4 4-4 4M19 12H9"/>'
};

const icon = (name) => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${icons[name] ?? ''}</svg>`;

export function ensureTenantSidebarStyles() {
  const existing = document.querySelector('[data-tenant-sidebar-style="shared"]');
  if (existing) return existing.sheet ? Promise.resolve() : new Promise((resolve) => existing.addEventListener('load', resolve, { once: true }));
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('./style/sidebarTenant.css', import.meta.url);
  link.dataset.tenantSidebarStyle = 'shared';
  document.head.append(link);
  return new Promise((resolve) => {
    link.addEventListener('load', resolve, { once: true });
    link.addEventListener('error', resolve, { once: true });
  });
}

export function renderTenantSidebar(activePage = 'dashboardTenant') {
  const links = [
    ['dashboardTenant', 'Dashboard', 'grid'],
    ['message', 'Messages', 'chat'],
    ['booking', 'Bookings', 'calendar'],
    ['setting', 'Settings', 'gear']
  ];

  return `<aside class="dh-sidebar">
    <a class="dh-logo" href="#/tenant/dashboardTenant">
      <b aria-hidden="true">${icon('home')}</b>
      <span><strong>DormHive</strong><small>Tenant Portal</small></span>
    </a>
    <div class="dh-sidebar-rule" aria-hidden="true"></div>
    <nav>
      ${links.map(([page, label, iconName]) => `<a class="${page === activePage ? 'active' : ''}" href="#/tenant/${page}">${icon(iconName)}<span>${label}</span></a>`).join('')}
    </nav>
    <div class="dh-sidebar-footer">
      <button class="logout" type="button">${icon('logout')}<span>Sign Out</span></button>
    </div>
  </aside>`;
}

document.addEventListener('click', (event) => {
  const link = event.target.closest('.dh-sidebar a[href^="#/tenant/"]');
  if (!link) return;
  event.preventDefault();
  event.stopPropagation();
  const target = link.getAttribute('href');
  if (window.location.hash === target) {
    window.dispatchEvent(new Event('hashchange'));
    return;
  }
  window.location.hash = target;
}, true);
