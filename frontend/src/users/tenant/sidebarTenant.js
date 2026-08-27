const glyph = {
  grid: '&#9638;',
  chat: '&#9993;',
  calendar: '&#9783;',
  gear: '&#9881;',
  menu: '&#9776;',
  search: '&#9906;',
  bell: '&#9679;',
  pin: '&#9679;',
  heart: '&#9825;',
  home: '&#8962;',
  walk: '&#10148;',
  target: '&#8857;',
  layers: '&#9638;',
  arrow: '&#8594;',
  chevron: '&#8964;',
  wifi: '&#8976;',
  snow: '&#10052;',
  kitchen: '&#9832;',
  laundry: '&#8635;',
  car: '&#9670;'
};

const icon = (name) => `<span class="icon">${glyph[name] ?? ''}</span>`;

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
    <a class="dh-logo" href="#/tenant/dashboardTenant"><b>D</b>DormHive</a>
    <small>TENANT PORTAL</small>
    <nav>
      ${links.map(([page, label, iconName]) => `<a class="${page === activePage ? 'active' : ''}" href="#/tenant/${page}">${icon(iconName)}${label}</a>`).join('')}
    </nav>
    <div class="help">
      <strong>Need help?</strong>
      <span>Our support team is here.</span>
      <a href="#/tenant/message">Contact support</a>
    </div>
    <button class="logout">Sign out</button>
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
