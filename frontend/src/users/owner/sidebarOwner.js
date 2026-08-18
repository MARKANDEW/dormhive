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
    const counts = await getListingCounts();
    const myListingLink = document.querySelector('.owner-sidebar .nav-item[href="#/owner/myListing"] .nav-copy small');
    if (myListingLink) {
      myListingLink.textContent = `${counts.active} Active · ${counts.pending} Pending`;
    }
  } catch (error) {
    console.error('Error updating listing counts in sidebar:', error);
  }
}
  
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

document.addEventListener('click', (event) => {
  const logoutButton = event.target.closest('.logout');
  if (logoutButton) {
    localStorage.clear();
    location.assign('#/login');
  }
});
