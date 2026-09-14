const icons = {
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  grid: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>',
  chat: '<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H9l-5 4v-14.5Z"/>',
  calendar: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/>',
  gear: '<path d="M5 7h14M5 12h14M5 17h14"/><circle cx="9" cy="7" r="1.8"/><circle cx="15" cy="12" r="1.8"/><circle cx="10" cy="17" r="1.8"/>',
  brand: '<path d="m12 3 7.8 4.5v9L12 21l-7.8-4.5v-9L12 3Z"/><path d="m8 10 4-2.3 4 2.3v6.2H8V10Z"/><path d="M10.5 16.2v-3.5h3v3.5M8.2 10.2h7.6"/>',
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

  return `<button type="button" class="tenant-mobile-menu" aria-label="Open tenant menu" aria-expanded="false">${icon('menu')}</button>
  <button type="button" class="tenant-nav-backdrop" aria-label="Close tenant menu"></button>
  <aside class="dh-sidebar">
    <a class="dh-logo" href="#/tenant/dashboardTenant">
      <b aria-hidden="true">${icon('brand')}</b>
      <span><strong>DormHive</strong><small>Tenant Portal</small></span>
    </a>
    <div class="dh-sidebar-rule" aria-hidden="true"></div>
    <nav>
      ${links.map(([page, label, iconName]) => `<a class="${page === activePage ? 'active' : ''}" href="#/tenant/${page}">${icon(iconName)}<span>${label}</span></a>`).join('')}
    </nav>
    <div class="dh-sidebar-footer">
      <div class="dh-support-notice"><strong>Need help?</strong><span>Our support team is here.</span><a href="#/tenant/support">Contact support</a></div>
      <button class="logout" type="button"><span>Sign Out</span></button>
    </div>
  </aside>`;
}

document.addEventListener('click', (event) => {
  const menuButton = event.target.closest('.tenant-mobile-menu');
  if (menuButton) {
    const app = menuButton.closest('.dh-app');
    const isOpen = app?.classList.toggle('open');
    menuButton.setAttribute('aria-expanded', String(Boolean(isOpen)));
    return;
  }

  const backdrop = event.target.closest('.tenant-nav-backdrop');
  if (backdrop) {
    const app = backdrop.closest('.dh-app');
    app?.classList.remove('open');
    app?.querySelector('.tenant-mobile-menu')?.setAttribute('aria-expanded', 'false');
    return;
  }

  const link = event.target.closest('.dh-sidebar a[href^="#/tenant/"]');
  if (!link) return;
  event.preventDefault();
  event.stopPropagation();
  link.closest('.dh-app')?.classList.remove('open');
  link.closest('.dh-app')?.querySelector('.tenant-mobile-menu')?.setAttribute('aria-expanded', 'false');
  const target = link.getAttribute('href');
  if (window.location.hash === target) {
    window.dispatchEvent(new Event('hashchange'));
    return;
  }
  window.location.hash = target;
}, true);
