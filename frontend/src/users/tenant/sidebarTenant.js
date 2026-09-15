const icons = {
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  grid: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>',
  chat: '<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H9l-5 4v-14.5Z"/>',
  calendar: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/>',
  gear: '<path d="M5 7h14M5 12h14M5 17h14"/><circle cx="9" cy="7" r="1.8"/><circle cx="15" cy="12" r="1.8"/><circle cx="10" cy="17" r="1.8"/>',
  brand: '<path d="M3.5 10.5 12 3.5l8.5 7"/><path d="M5.5 9.5V21h13V9.5"/><path d="M9 21v-5.5h6V21"/><path d="M8 12h2.5v2H8zM13.5 12H16v2h-2.5z"/><path d="M17 7V4.5h2v4"/>',
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
      <b aria-hidden="true"><svg class="icon" viewBox="0 0 180 180" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" role="img"><defs><linearGradient id="tenant-brand-navy" x1="20" y1="10" x2="160" y2="170" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#203E69"/><stop offset="0.55" stop-color="#102B4F"/><stop offset="1" stop-color="#071B35"/></linearGradient><linearGradient id="tenant-brand-gold" x1="70" y1="30" x2="120" y2="145" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#FFE08A"/><stop offset="0.35" stop-color="#F5BE42"/><stop offset="1" stop-color="#C98213"/></linearGradient><filter id="tenant-brand-shadow" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="12" stdDeviation="10" flood-opacity="0.20"/></filter><filter id="tenant-brand-glow"><feGaussianBlur stdDeviation="2.5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><path d="M90 8 C126 8 157 36 162 71 C167 106 148 139 119 157 C108 164 98 169 90 172 C82 169 72 164 61 157 C32 139 13 106 18 71 C23 36 54 8 90 8Z" fill="url(#tenant-brand-navy)" filter="url(#tenant-brand-shadow)"/><path d="M90 20 C120 20 146 43 150 72 C154 101 139 128 114 144 C105 150 97 154 90 157 C83 154 75 150 66 144 C41 128 26 101 30 72 C34 43 60 20 90 20Z" fill="none" stroke="url(#tenant-brand-gold)" stroke-width="2" opacity=".75"/><path d="M90 31 L105 40 L105 57 L90 66 L75 57 L75 40Z" fill="none" stroke="url(#tenant-brand-gold)" stroke-width="3" opacity=".9"/><path d="M55 55 L70 64 L70 81 L55 90 L40 81 L40 64Z" fill="none" stroke="url(#tenant-brand-gold)" stroke-width="3" opacity=".55"/><path d="M125 55 L140 64 L140 81 L125 90 L110 81 L110 64Z" fill="none" stroke="url(#tenant-brand-gold)" stroke-width="3" opacity=".55"/><path d="M59 54 L59 122 C59 133 67 139 78 139 L91 139 C119 139 137 121 137 96 C137 71 119 54 91 54 Z M78 71 L91 71 C108 71 119 81 119 96 C119 111 108 122 91 122 L78 122 Z" fill="white" fill-rule="evenodd"/><path d="M69 88 L89 69 L109 88" fill="none" stroke="url(#tenant-brand-gold)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" filter="url(#tenant-brand-glow)"/><path d="M82 119 L82 99 C82 94 85 91 90 91 C95 91 98 94 98 99 L98 119" fill="url(#tenant-brand-gold)"/><circle cx="94" cy="105" r="2" fill="#102B4F"/><circle cx="90" cy="42" r="3" fill="#FFE08A"/><circle cx="48" cy="72" r="2.5" fill="#F5BE42" opacity=".8"/><circle cx="132" cy="72" r="2.5" fill="#F5BE42" opacity=".8"/><path d="M68 148 C75 152 83 155 90 158 C97 155 105 152 112 148" fill="none" stroke="url(#tenant-brand-gold)" stroke-width="3" stroke-linecap="round"/></svg></b>
      <span><strong><span class="brand-dorm">Dorm</span><span class="brand-hive">Hive</span></strong><small>Tenant Portal</small></span>
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
