const glyphs = {
  dashboardOwner: '▣',
  myListing: '⌂',
  inquiries: '✉',
  activeTenant: '👥',
  analytics: '◔',
  message: '💬',
  setting: '⚙'
};

const sidebarLinks = [
  ['dashboardOwner', 'Dashboard', 'Active', ''],
  ['myListing', 'My Listings', '4 Active', '1 Pending'],
  ['inquiries', 'Inquiries', '12 New', '56 Total'],
  ['activeTenant', 'Active Tenants', '16', ''],
  ['analytics', 'Analytics', 'Performance', ' & Demand'],
  ['message', 'Messages', '3 Unread', ''],
  ['setting', 'Settings', '', '']
];
  
export function ensureOwnerSidebarStyles() {
  if (document.querySelector('[data-owner-sidebar-style="shared"]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('./style/sidebarOwner.css', import.meta.url);
  link.dataset.ownerSidebarStyle = 'shared';
  document.head.append(link);
}

export function renderOwnerSidebar(active = 'dashboardOwner') {
  return `<aside class="owner-sidebar">${sidebarLinks.map(([page, label, countA, countB]) => `<a class="nav-item ${active === page ? 'active' : ''}" href="#/owner/${page}"><span class="nav-icon">${glyphs[page] ?? ''}</span><span class="nav-copy"><strong>${label}</strong>${countA || countB ? `<small>${[countA, countB].filter(Boolean).join(' · ')}</small>` : ''}</span></a>`).join('')}<button class="logout">Sign out</button></aside>`;
}
