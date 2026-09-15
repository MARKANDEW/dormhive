const glyphs = {
  dashboardOwner: '<i class="bi bi-grid-1x2-fill" aria-hidden="true"></i>',
  myListing: '<i class="bi bi-buildings" aria-hidden="true"></i>',
  inquiries: '<i class="bi bi-envelope" aria-hidden="true"></i>',
  activeTenant: '<i class="bi bi-people" aria-hidden="true"></i>',
  analytics: '<i class="bi bi-bar-chart-line-fill" aria-hidden="true"></i>',
  message: '<i class="bi bi-chat-fill" aria-hidden="true"></i>',
  setting: '<i class="bi bi-gear-fill" aria-hidden="true"></i>'
};

const sidebarLinks = [
  ['dashboardOwner', 'Dashboard', 'Active', ''],
  ['myListing', 'My Listings', '0 Active', '0 Pending'],
  ['inquiries', 'Inquiries', '0 New', '0 Total'],
  ['activeTenant', 'Active Tenants', '0', ''],
  ['analytics', 'Analytics', 'Performance', ' & Demand'],
  ['message', 'Messages', '0 Unread', ''],
  ['setting', 'Settings', '', '']
];

// Get API configuration
const getAPI = () => window.DORMHIVE_API_URL ?? 'http://localhost:5000/api/v1';

// Get authentication headers
const getAuthHeaders = () => {
  const token = localStorage.getItem('dormhive.accessToken') ?? '';
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// Get current user from localStorage
const getCurrentUser = () => {
  try {
    return JSON.parse(localStorage.getItem('dormhive.user') ?? '{}');
  } catch {
    return {};
  }
};

const escapeHtml = (value = '') => {
  const text = String(value ?? '');
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const getOwnerAvatarUrl = (value = '') => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw.startsWith('data:') || raw.startsWith('blob:')) return raw;
  if (/^https?:\/\//i.test(raw)) return raw;
  const API = getAPI();
  const apiBase = API.replace(/\/api\/v1\/?$/, '');
  return `${apiBase}${raw.startsWith('/') ? '' : '/'}${raw}`;
};

export function renderOwnerProfileCard() {
  const user = getCurrentUser();
  const profileName = user.name || 'Property Owner';
  const initials = profileName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'PO';
  const avatarUrl = getOwnerAvatarUrl(user.avatar_url || '');

  return `
    <div class="profile-identity">
      <div class="avatar">
        ${avatarUrl ? `<img src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(profileName)} avatar" onerror="this.parentElement.innerHTML='${escapeHtml(initials)}'" />` : `<span>${escapeHtml(initials)}</span>`}
      </div>
      <div>
        <strong>${escapeHtml(profileName)}</strong>
        <span>Property Owner</span>
      </div>
    </div>
  `;
}

// Fetch and calculate listing counts
export async function getListingCounts() {
  try {
    const user = getCurrentUser();
    if (!user?.id) return { active: 0, pending: 0 };

    const API = getAPI();
    const response = await fetch(`${API}/properties?limit=100`, {
      headers: getAuthHeaders()
    });
    const body = await response.json();
    if (!response.ok) return { active: 0, pending: 0 };

    const items = (body.data ?? []).filter((item) => Number(item.owner_id) === Number(user.id));
    
    // Count by approval_status or status field
    const active = items.filter((item) => {
      const status = String(item.approval_status || item.status || 'pending').toLowerCase();
      return status === 'approved' || status === 'active';
    }).length;
    
    const pending = items.filter((item) => {
      const status = String(item.approval_status || item.status || 'pending').toLowerCase();
      return status === 'pending';
    }).length;

    return { active, pending };
  } catch (error) {
    console.error('Error fetching listing counts:', error);
    return { active: 0, pending: 0 };
  }
}

// Update sidebar listing counts in the DOM
export async function updateListingCountsInSidebar() {
  try {
    const [counts, bookingResponse] = await Promise.all([
      getListingCounts(),
      fetch(`${getAPI()}/bookings`, { headers: getAuthHeaders() })
    ]);
    const myListingLink = document.querySelector('.owner-sidebar .nav-item[href="#/owner/myListing"] .nav-copy small');
    if (myListingLink) {
      myListingLink.textContent = `${counts.active} Active · ${counts.pending} Pending`;
    }

    const bookingBody = await bookingResponse.json();
    const user = getCurrentUser();
    const activeTenants = bookingResponse.ok && Array.isArray(bookingBody.data)
      ? bookingBody.data.filter((booking) => Number(booking.owner_id) === Number(user.id) && String(booking.status).toLowerCase() === 'approved').length
      : 0;
    const ownerBookings = bookingResponse.ok && Array.isArray(bookingBody.data)
      ? bookingBody.data.filter((booking) => Number(booking.owner_id) === Number(user.id))
      : [];
    const inquiryBookings = ownerBookings.filter((booking) => String(booking.status).toLowerCase() !== 'approved');
    const newInquiries = inquiryBookings.filter((booking) => String(booking.status).toLowerCase() === 'pending').length;
    const activeTenantLink = document.querySelector('.owner-sidebar .nav-item[href="#/owner/activeTenant"] .nav-copy small');
    if (activeTenantLink) activeTenantLink.textContent = String(activeTenants);
    const inquiryLink = document.querySelector('.owner-sidebar .nav-item[href="#/owner/inquiries"] .nav-copy small');
    if (inquiryLink) inquiryLink.textContent = `${newInquiries} New · ${inquiryBookings.length} Total`;

    const conversationResponse = await fetch(`${getAPI()}/messages/conversations`, { headers: getAuthHeaders() });
    const conversationBody = await conversationResponse.json();
    const unreadMessages = conversationResponse.ok && Array.isArray(conversationBody.data)
      ? conversationBody.data.reduce((total, conversation) => total + Number(conversation.unread_count ?? 0), 0)
      : 0;
    const messageLink = document.querySelector('.owner-sidebar .nav-item[href="#/owner/message"] .nav-copy small');
    if (messageLink) messageLink.textContent = `${unreadMessages} Unread`;
  } catch (error) {
    console.error('Error updating owner sidebar counts:', error);
  }
}
  
export function ensureOwnerSidebarStyles() {
  document.querySelectorAll('link[data-dormhive-auth="split"]').forEach((node) => node.remove());
  if (document.querySelector('[data-owner-sidebar-style="shared"]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('./style/sidebarOwner.css', import.meta.url);
  link.dataset.ownerSidebarStyle = 'shared';
  document.head.append(link);
}

export function renderOwnerSidebar(active = 'dashboardOwner') {
  return `<button type="button" class="owner-mobile-menu" aria-label="Open owner menu" aria-expanded="false"><i class="bi bi-list" aria-hidden="true"></i></button>
  <button type="button" class="owner-nav-backdrop" aria-label="Close owner menu"></button>
  <aside class="owner-sidebar">
    <a class="owner-brand" href="#/owner/dashboardOwner">
      <b class="owner-brand-mark" aria-hidden="true"><svg class="owner-brand-icon" viewBox="0 0 180 180" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" role="img"><defs><linearGradient id="owner-brand-navy" x1="20" y1="10" x2="160" y2="170" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#203E69"/><stop offset="0.55" stop-color="#102B4F"/><stop offset="1" stop-color="#071B35"/></linearGradient><linearGradient id="owner-brand-gold" x1="70" y1="30" x2="120" y2="145" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#FFE08A"/><stop offset="0.35" stop-color="#F5BE42"/><stop offset="1" stop-color="#C98213"/></linearGradient><filter id="owner-brand-shadow" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="12" stdDeviation="10" flood-opacity="0.20"/></filter><filter id="owner-brand-glow"><feGaussianBlur stdDeviation="2.5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><path d="M90 8 C126 8 157 36 162 71 C167 106 148 139 119 157 C108 164 98 169 90 172 C82 169 72 164 61 157 C32 139 13 106 18 71 C23 36 54 8 90 8Z" fill="url(#owner-brand-navy)" filter="url(#owner-brand-shadow)"/><path d="M90 20 C120 20 146 43 150 72 C154 101 139 128 114 144 C105 150 97 154 90 157 C83 154 75 150 66 144 C41 128 26 101 30 72 C34 43 60 20 90 20Z" fill="none" stroke="url(#owner-brand-gold)" stroke-width="2" opacity=".75"/><path d="M90 31 L105 40 L105 57 L90 66 L75 57 L75 40Z" fill="none" stroke="url(#owner-brand-gold)" stroke-width="3" opacity=".9"/><path d="M55 55 L70 64 L70 81 L55 90 L40 81 L40 64Z" fill="none" stroke="url(#owner-brand-gold)" stroke-width="3" opacity=".55"/><path d="M125 55 L140 64 L140 81 L125 90 L110 81 L110 64Z" fill="none" stroke="url(#owner-brand-gold)" stroke-width="3" opacity=".55"/><path d="M59 54 L59 122 C59 133 67 139 78 139 L91 139 C119 139 137 121 137 96 C137 71 119 54 91 54 Z M78 71 L91 71 C108 71 119 81 119 96 C119 111 108 122 91 122 L78 122 Z" fill="white" fill-rule="evenodd"/><path d="M69 88 L89 69 L109 88" fill="none" stroke="url(#owner-brand-gold)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" filter="url(#owner-brand-glow)"/><path d="M82 119 L82 99 C82 94 85 91 90 91 C95 91 98 94 98 99 L98 119" fill="url(#owner-brand-gold)"/><circle cx="94" cy="105" r="2" fill="#102B4F"/><circle cx="90" cy="42" r="3" fill="#FFE08A"/><circle cx="48" cy="72" r="2.5" fill="#F5BE42" opacity=".8"/><circle cx="132" cy="72" r="2.5" fill="#F5BE42" opacity=".8"/><path d="M68 148 C75 152 83 155 90 158 C97 155 105 152 112 148" fill="none" stroke="url(#owner-brand-gold)" stroke-width="3" stroke-linecap="round"/></svg></b>
      <span><strong><span class="brand-dorm">Dorm</span><span class="brand-hive">Hive</span></strong><small>Owner Portal</small></span>
    </a>
    <div class="owner-sidebar-rule" aria-hidden="true"></div>
    ${sidebarLinks.map(([page, label, countA, countB]) => `<a class="nav-item ${active === page ? 'active' : ''}" href="#/owner/${page}"><span class="nav-icon">${glyphs[page] ?? ''}</span><span class="nav-copy"><strong>${label}</strong>${countA || countB ? `<small>${[countA, countB].filter(Boolean).join(' · ')}</small>` : ''}</span></a>`).join('')}
    <div class="owner-support-notice"><strong>Need help?</strong><span>Our support team is here.</span><a href="#/owner/support">Contact support</a></div>
    <button class="logout">Sign out</button>
  </aside>`;
}

document.addEventListener('click', (event) => {
  const menuButton = event.target.closest('.owner-mobile-menu');
  if (menuButton) {
    const shell = menuButton.closest('.owner-shell');
    const isOpen = shell?.classList.toggle('nav-open');
    menuButton.setAttribute('aria-expanded', String(Boolean(isOpen)));
    return;
  }

  const backdrop = event.target.closest('.owner-nav-backdrop');
  if (backdrop) {
    const shell = backdrop.closest('.owner-shell');
    shell?.classList.remove('nav-open');
    shell?.querySelector('.owner-mobile-menu')?.setAttribute('aria-expanded', 'false');
    return;
  }

  const navLink = event.target.closest('.owner-sidebar a[href^="#/owner/"]');
  if (navLink) {
    const shell = navLink.closest('.owner-shell');
    shell?.classList.remove('nav-open');
    shell?.querySelector('.owner-mobile-menu')?.setAttribute('aria-expanded', 'false');
  }

  const logoutButton = event.target.closest('.logout');
  if (logoutButton) {
    localStorage.clear();
    location.assign('#/login');
  }
});