import { ensureAdminSidebarStyles, renderAdminSidebar } from './sidebarAdmin.js';
import { buildActivityFeed, buildDashboardMetrics } from './analytics.js';
import { createModal, openModal } from '../../components/modal.js';
import { showToast } from '../../components/toast.js';
import { applyAdminPrivacy } from './privacy.js';
import { resolveUserAvatarUrl } from './avatar.js';

const API = window.DORMHIVE_API_URL ?? 'http://localhost:5000/api/v1';
const auth = () => ({ Authorization: `Bearer ${localStorage.getItem('dormhive.accessToken') ?? ''}` });
const clearAdminSession = () => {
  localStorage.removeItem('dormhive.accessToken');
  localStorage.removeItem('dormhive.user');
};
const esc = (v = '') => {
  const e = document.createElement('span');
  e.textContent = v;
  return e.innerHTML;
};
const validRoles = ['tenant', 'owner', 'admin'];

const demoUsers = [
  { id: 1, name: 'Miguel cruz', email: 'tenant@tenant2.com', role: 'tenant', status: 'active', avatar_url: '' },
  { id: 2, name: 'robin wall', email: 'tenant@tenant.com', role: 'tenant', status: 'active', avatar_url: '' },
  { id: 3, name: 'Jose cayetano', email: 'owner@owner.com', role: 'owner', status: 'active', avatar_url: '' },
  { id: 4, name: 'juan luna', email: 'admin@admin.com', role: 'admin', status: 'active', avatar_url: '' }
];

const demoActivity = [
  { icon: 'user', title: 'User profile updated', detail: '[Miguel cruz]', time: '2 mins ago' },
  { icon: 'user', title: 'User profile updated', detail: '[juan luna]', time: '1 day ago' },
  { icon: 'alert', title: 'Property rejected', detail: '[432432]', time: '1 day ago' },
  { icon: 'sync', title: 'Property approved', detail: '[10]', time: '1 day ago' },
  { icon: 'sync', title: 'Property approved', detail: '[hotels]', time: '2 days ago' },
  { icon: 'user', title: 'User profile updated', detail: '[robin wall]', time: '5 days ago' },
  { icon: 'user', title: 'User profile updated', detail: '[Jose cayetano]', time: '5 days ago' }
];

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function css() {
  if (!document.querySelector('[data-admin-style="dashboard"]')) {
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = new URL('./style/dashboardAdmin.css', import.meta.url);
    l.dataset.adminStyle = 'dashboard';
    document.head.append(l);
  }
}

function resetDashboardState(root) {
  if (!root) return;
  root.querySelector('[data-metric="users"]') && (root.querySelector('[data-metric="users"]').textContent = '0');
  root.querySelector('[data-metric="listings"]') && (root.querySelector('[data-metric="listings"]').textContent = '0');
  root.querySelector('[data-metric="pending"]') && (root.querySelector('[data-metric="pending"]').textContent = '0');
  root.querySelector('[data-metric="bookings"]') && (root.querySelector('[data-metric="bookings"]').textContent = '0');
  const userGrid = root.querySelector('.user-grid');
  if (userGrid) userGrid.innerHTML = '';
  const activityList = root.querySelector('.activity-list');
  if (activityList) activityList.innerHTML = '';
}

function isExpiredSessionError(error) {
  const message = error?.message ?? '';
  return /session expired|unauthorized|forbidden/i.test(message) || /401|403/.test(String(error?.status ?? ''));
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      ...(options.headers ?? {}),
      ...auth()
    }
  });

  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      clearAdminSession();
      window.location.hash = '#/login';
      throw new Error('Session expired. Please sign in again.');
    }
    throw new Error(payload?.message ?? 'Request failed.');
  }

  return payload;
}

function statIcon(type) {
  const icons = {
    users: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 19v-1a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v1"/><circle cx="10" cy="7" r="3"/><path d="M20 19v-1a4 4 0 0 0-3-3.87"/><path d="M16 4.13a4 4 0 0 1 0 7.75"/></svg>',
    listings: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V19h14V9.5"/><path d="M9 19v-6h6v6"/></svg>',
    moderation: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 5 6v5c0 4.4 2.8 8.4 7 10 4.2-1.6 7-5.6 7-10V6l-7-3Z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>',
    booking: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="17" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>'
  };

  return icons[type] ?? icons.users;
}

function sparkline(type) {
  const palettes = {
    green: '<svg viewBox="0 0 120 36" preserveAspectRatio="none" aria-hidden="true"><path d="M0 28C18 30 22 16 35 18C45 20 56 8 68 10C82 12 89 26 101 24C108 22 113 16 120 12V36H0Z" fill="rgba(18,164,112,0.12)"/><path d="M0 28C18 30 22 16 35 18C45 20 56 8 68 10C82 12 89 26 101 24C108 22 113 16 120 12" fill="none" stroke="rgba(18,164,112,0.9)" stroke-width="2" stroke-linecap="round"/></svg>',
    blue: '<svg viewBox="0 0 120 36" preserveAspectRatio="none" aria-hidden="true"><path d="M0 24C15 22 24 16 35 16C50 17 59 9 70 9C82 9 91 20 101 18C109 17 114 14 120 10V36H0Z" fill="rgba(47,126,199,0.12)"/><path d="M0 24C15 22 24 16 35 16C50 17 59 9 70 9C82 9 91 20 101 18C109 17 114 14 120 10" fill="none" stroke="rgba(47,126,199,0.9)" stroke-width="2" stroke-linecap="round"/></svg>',
    purple: '<svg viewBox="0 0 120 36" preserveAspectRatio="none" aria-hidden="true"><path d="M0 30C16 27 23 18 35 19C47 19 58 12 69 12C81 12 92 21 102 21C110 20 115 17 120 14V36H0Z" fill="rgba(120,97,232,0.12)"/><path d="M0 30C16 27 23 18 35 19C47 19 58 12 69 12C81 12 92 21 102 21C110 20 115 17 120 14" fill="none" stroke="rgba(120,97,232,0.9)" stroke-width="2" stroke-linecap="round"/></svg>',
    orange: '<svg viewBox="0 0 120 36" preserveAspectRatio="none" aria-hidden="true"><path d="M0 22C18 25 28 10 36 12C48 16 53 24 68 20C80 16 91 5 103 6C109 7 116 10 120 12V36H0Z" fill="rgba(245,149,55,0.12)"/><path d="M0 22C18 25 28 10 36 12C48 16 53 24 68 20C80 16 91 5 103 6C109 7 116 10 120 12" fill="none" stroke="rgba(245,149,55,0.9)" stroke-width="2" stroke-linecap="round"/></svg>'
  };

  return palettes[type] ?? palettes.green;
}

function renderUserCard(user) {
  const status = (user.status || 'active').toString();
  const avatarUrl = resolveUserAvatarUrl(user.avatar_url || '', user.name || 'User');
  const initials = (user.name || 'U').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || 'U';

  return `
    <article class="user-card" data-user-id="${user.id ?? ''}">
      <div class="user-avatar" aria-hidden="true">
        <img src="${esc(avatarUrl)}" alt="${esc(user.name || 'User')} avatar" onerror="this.onerror=null;this.src='data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" rx="60" fill="#efe6d6"/><circle cx="60" cy="42" r="22" fill="#4a3d2f"/><path d="M28 96c6-16 18-25 32-25s26 9 32 25" fill="#8d6435"/><text x="50%" y="68%" text-anchor="middle" font-size="30" font-family="Inter, Arial, sans-serif" font-weight="700" fill="#ffffff">${initials}</text></svg>`)}'" />
      </div>
      <div class="user-info">
        <div class="user-name-row">
          <strong class="user-name" data-privacy-mask="name">${esc(user.name || 'Unknown user')}</strong>
        </div>
        <div class="user-meta" data-privacy-mask="email">Email: ${esc(user.email || '—')}</div>
        <div class="user-role-line">
          <span>Role: <strong>${esc((user.role || 'user').replace(/_/g, ' '))}</strong></span>
          <span class="mini-pill ${status}">${esc(status)}</span>
        </div>
      </div>
      <div class="user-actions">
        <button type="button" data-action="profile" data-user-id="${user.id ?? ''}">View Profile</button>
        <button type="button" data-action="role" data-user-id="${user.id ?? ''}">Edit Role</button>
        <button type="button" data-action="delete" data-user-id="${user.id ?? ''}">Delete</button>
      </div>
    </article>
  `;
}

function renderActivityItem(item) {
  const iconClasses = {
    shield: 'activity-icon alert',
    alert: 'activity-icon alert',
    user: 'activity-icon success',
    sync: 'activity-icon neutral'
  };

  return `
    <div class="activity-row">
      <span class="${iconClasses[item.icon] ?? 'activity-icon neutral'}" aria-hidden="true"></span>
      <div class="activity-main">
        <span class="activity-text">${esc(item.title)} ${esc(item.detail ?? '')}</span>
      </div>
      <time>${esc(item.time)}</time>
    </div>
  `;
}

function showUserProfileModal(user) {
  const profileMarkup = `
    <div class="user-profile-detail">
      <div class="profile-avatar-wrap">
        <img src="${resolveUserAvatarUrl(user.avatar_url || '', user.name || 'User')}" alt="${esc(user.name || 'User')} avatar" onerror="this.onerror=null;this.src='data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" rx="60" fill="#efe6d6"/><circle cx="60" cy="42" r="22" fill="#4a3d2f"/><path d="M28 96c6-16 18-25 32-25s26 9 32 25" fill="#8d6435"/><text x="50%" y="68%" text-anchor="middle" font-size="30" font-family="Inter, Arial, sans-serif" font-weight="700" fill="#ffffff">${(user.name || 'U').split(/\s+/).filter(Boolean).slice(0,2).map((part) => part[0]?.toUpperCase() ?? '').join('') || 'U'}</text></svg>`)}'" />
      </div>
      <div class="profile-row"><span>Name</span><strong>${esc(user.name || 'Unknown user')}</strong></div>
      <div class="profile-row"><span>Email</span><strong>${esc(user.email || '—')}</strong></div>
      <div class="profile-row"><span>Role</span><strong>${esc((user.role || 'user').replace(/_/g, ' '))}</strong></div>
      <div class="profile-row"><span>Status</span><strong>${esc(user.status || 'active')}</strong></div>
      <div class="profile-row"><span>Phone</span><strong>${esc(user.phone || '—')}</strong></div>
      <div class="profile-row"><span>Joined</span><strong>${esc(formatDate(user.created_at))}</strong></div>
    </div>
  `;

  const modal = createModal({ title: 'User Profile', content: profileMarkup, closeLabel: 'Close' });
  openModal(modal);
}

async function updateUserRole(root, user) {
  const currentRole = String(user.role || 'tenant');
  const modal = createModal({
    title: `Edit Role: ${user.name || user.email || 'User'}`,
    content: `
      <label class="role-select-label" for="admin-role-select">Account role</label>
      <select id="admin-role-select" class="role-select">
        ${validRoles.map((role) => `<option value="${role}"${role === currentRole ? ' selected' : ''}>${role[0].toUpperCase()}${role.slice(1)}</option>`).join('')}
      </select>
    `,
    closeLabel: 'Cancel'
  });
  const saveButton = modal.querySelector('.ui-modal__footer button');
  if (!saveButton) return;
  saveButton.textContent = 'Save Role';
  saveButton.addEventListener('click', async () => {
    const normalized = modal.querySelector('#admin-role-select')?.value;
    if (!validRoles.includes(normalized)) return;

    try {
      await apiRequest(`/users/${encodeURIComponent(user.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: normalized })
      });

      showToast({ message: `${user.name || 'User'} updated to ${normalized}.`, type: 'success' });
      await refreshDashboardData(root);
    } catch (error) {
      showToast({ message: error.message || 'Could not update user role.', type: 'error' });
    }
  });
  openModal(modal);
}

async function deleteUser(root, user) {
  const userLabel = user.name || user.email || 'this user';
  const confirmed = window.confirm(`Delete ${userLabel}? This action cannot be undone.`);
  if (!confirmed) return;

  try {
    await apiRequest(`/users/${encodeURIComponent(user.id)}`, { method: 'DELETE' });
    showToast({ message: `${userLabel} was deleted.`, type: 'success' });
    await refreshDashboardData(root);
  } catch (error) {
    showToast({ message: error.message || 'Could not delete user.', type: 'error' });
  }
}

function bindUserActions(root, users = []) {
  const userMap = new Map(users.map((user) => [String(user.id), user]));

  root.querySelectorAll('[data-action]').forEach((button) => {
    const action = button.dataset.action;
    const userId = button.dataset.userId;
    const user = userMap.get(String(userId));
    if (!user) return;

    button.addEventListener('click', () => {
      if (action === 'profile') showUserProfileModal(user);
      if (action === 'role') updateUserRole(root, user);
      if (action === 'delete') deleteUser(root, user);
    });
  });
}

async function refreshDashboardData(root) {
  resetDashboardState(root);
  try {
    const [u, p, b, users] = await Promise.all([
      apiRequest('/analytics/users'),
      apiRequest('/analytics/properties'),
      apiRequest('/analytics/bookings'),
      apiRequest('/users?limit=6')
    ]);

    const metrics = buildDashboardMetrics({
      users: u.data ?? [],
      properties: p.data ?? [],
      bookings: b.data ?? []
    });

    root.querySelector('[data-metric="users"]').textContent = metrics.totalUsers;
    root.querySelector('[data-metric="listings"]').textContent = metrics.totalProperties;
    root.querySelector('[data-metric="pending"]').textContent = metrics.pendingModeration;
    root.querySelector('[data-metric="bookings"]').textContent = metrics.totalBookings;

    const userData = Array.isArray(users.data) && users.data.length ? users.data.slice(0, 4) : demoUsers;
    root.querySelector('.user-grid').innerHTML = userData.map(renderUserCard).join('');
    bindUserActions(root, userData);

    root.querySelector('.activity-list').innerHTML = demoActivity.map(renderActivityItem).join('');
    applyAdminPrivacy(root);
  } catch (error) {
    if (isExpiredSessionError(error)) {
      resetDashboardState(root);
      return;
    }

    root.querySelector('[data-metric="users"]').textContent = '4';
    root.querySelector('[data-metric="listings"]').textContent = '5';
    root.querySelector('[data-metric="pending"]').textContent = '2';
    root.querySelector('[data-metric="bookings"]').textContent = '0';
    root.querySelector('.user-grid').innerHTML = demoUsers.map(renderUserCard).join('');
    bindUserActions(root, demoUsers);
    root.querySelector('.activity-list').innerHTML = demoActivity.map(renderActivityItem).join('');
    showToast({ message: error.message || 'Unable to load admin dashboard data.', type: 'error' });
  }
}

export function renderDashboardAdmin(root = document.querySelector('#app')) {
  if (!root) throw new Error('Admin dashboard requires #app.');
  css();
  ensureAdminSidebarStyles();

  root.innerHTML = `
    <div class="admin-shell">
      ${renderAdminSidebar('dashboardAdmin')}
      <div class="admin-main">
        <main class="admin-dashboard">
          <header class="overview-header">
            <div class="overview-title-wrap">
              <span class="overview-pill"><span class="overview-pill-icon">⌂</span> Overview</span>
              <h1>Platform Overview</h1>
              <p>Quick insights into your platform activity and recent user actions.</p>
            </div>
            <div class="header-date-wrap">
              <div class="date-card"><span class="date-card-icon">◫</span><span>${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span></div>
              <div class="date-status"><span class="status-dot"></span> Updated just now</div>
            </div>
          </header>

          <section class="stats-grid" aria-label="Platform statistics">
            <article class="stat-card stat-card--green">
              <div class="stat-head">
                <div class="stat-icon">${statIcon('users')}</div>
                <div class="sparkline">${sparkline('green')}</div>
              </div>
              <div class="stat-body">
                <span class="stat-label">Registered Users</span>
                <strong data-metric="users">4</strong>
                <small>Total platform accounts</small>
              </div>
            </article>

            <article class="stat-card stat-card--blue">
              <div class="stat-head">
                <div class="stat-icon">${statIcon('listings')}</div>
                <div class="sparkline">${sparkline('blue')}</div>
              </div>
              <div class="stat-body">
                <span class="stat-label">Published Listings</span>
                <strong data-metric="listings">5</strong>
                <small>Active property listings</small>
              </div>
            </article>

            <article class="stat-card stat-card--purple">
              <div class="stat-head">
                <div class="stat-icon">${statIcon('moderation')}</div>
                <div class="sparkline">${sparkline('purple')}</div>
              </div>
              <div class="stat-body">
                <span class="stat-label">Pending Moderation</span>
                <strong data-metric="pending">2</strong>
                <small>Awaiting review</small>
              </div>
            </article>

            <article class="stat-card stat-card--orange">
              <div class="stat-head">
                <div class="stat-icon">${statIcon('booking')}</div>
                <div class="sparkline">${sparkline('orange')}</div>
              </div>
              <div class="stat-body">
                <span class="stat-label">Booking Requests</span>
                <strong data-metric="bookings">0</strong>
                <small>Total booking requests</small>
              </div>
            </article>
          </section>

          <section class="panel users-panel">
            <header class="panel-header">
              <div class="panel-title-wrap">
                <span class="panel-icon users-panel-icon">${statIcon('users')}</span>
                <div>
                  <h2>Recent Users</h2>
                  <p>Recently registered or active platform users.</p>
                </div>
              </div>
              <button type="button" class="panel-button">View all users</button>
            </header>
            <div class="user-grid"></div>
          </section>

          <section class="panel activity-panel">
            <header class="panel-header">
              <div class="panel-title-wrap">
                <span class="panel-icon activity-panel-icon">${statIcon('moderation')}</span>
                <div>
                  <h2>Recent Activity Feed</h2>
                  <p>Latest actions and changes in the platform.</p>
                </div>
              </div>
            </header>
            <div class="activity-list"></div>
          </section>
        </main>
      </div>
    </div>
  `;

  root.querySelector('.users-panel .panel-button')?.addEventListener('click', () => {
    window.location.hash = '#/admin/userManagement';
  });

  refreshDashboardData(root);
}


