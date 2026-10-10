import { ensureAdminSidebarStyles, loadAdminStylesheet, renderAdminSidebar } from './sidebarAdmin.js';
import { buildActivityFeed, buildDashboardMetrics } from './analytics.js';
import { createModal, openModal } from '../../components/modal.js';
import { showToast } from '../../components/toast.js';
import { applyAdminPrivacy } from './privacy.js';
import { resolveUserAvatarUrl } from './avatar.js';
import { buildInitialsAvatarSvg } from '../../services/avatar.js';

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

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function css() {
  const stylesheet = new URL('./style/dashboardAdmin.css', import.meta.url);
  stylesheet.searchParams.set('v', 'mobile-stat-cards-two-columns-12');
  return loadAdminStylesheet('dashboard', stylesheet);
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

function renderUserCard(user) {
  const status = (user.status || 'active').toString();
  const userName = user.name || 'User';
  const avatarUrl = resolveUserAvatarUrl(user.avatar_url || '', userName);
  const fallbackAvatar = buildInitialsAvatarSvg(userName);

  return `
    <article class="user-card" data-user-id="${user.id ?? ''}">
      <div class="user-avatar" aria-hidden="true">
        <img src="${esc(avatarUrl)}" alt="${esc(userName)} avatar" onerror="this.onerror=null;this.src='${fallbackAvatar}'" />
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
  const status = String(user.status || 'active').toLowerCase();
  const statusLabel = status === 'active' ? 'Active' : status.charAt(0).toUpperCase() + status.slice(1);
  const profileRows = [
    ['Name', user.name || 'Unknown user', '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12a4 4 0 1 0-4-4a4 4 0 0 0 4 4Zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5Z"/></svg>'],
    ['Email', user.email || '—', '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6.75A2.75 2.75 0 0 1 5.75 4h12.5A2.75 2.75 0 0 1 21 6.75v10.5A2.75 2.75 0 0 1 18.25 20H5.75A2.75 2.75 0 0 1 3 17.25Zm1.5.54 7.5 5.9 7.5-5.9v-.54a1.25 1.25 0 0 0-1.25-1.25H6.25A1.25 1.25 0 0 0 5 6.75Z"/></svg>'],
    ['Role', (user.role || 'user').replace(/_/g, ' '), '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 5 5v6.5c0 4.2 2.8 8.12 7 9.5 4.2-1.38 7-5.3 7-9.5V5Zm0 3.2 4.5 1.8V11c0 3.18-2.05 6.2-4.5 7.2-2.45-1-4.5-4.02-4.5-7.2V7Z"/></svg>'],
    ['Status', statusLabel, '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm0 2a8 8 0 0 1 5.86 13.64l-8.5-8.5A7.97 7.97 0 0 1 12 4Zm0 16a8 8 0 0 1-5.86-13.64l8.5 8.5A7.97 7.97 0 0 1 12 20Z"/></svg>'],
    ['Phone', user.phone || '—', '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.6 10.8a15.46 15.46 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.24 11.4 11.4 0 0 0 3.6.58a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1A17 17 0 0 1 3 5a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1 11.4 11.4 0 0 0 .58 3.6 1 1 0 0 1-.24 1Z"/></svg>'],
    ['Joined', formatDate(user.created_at), '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 2h2v2h6V2h2v2h2.5A2.5 2.5 0 0 1 22 6.5v12A2.5 2.5 0 0 1 19.5 21h-15A2.5 2.5 0 0 1 2 18.5v-12A2.5 2.5 0 0 1 4.5 4H7Zm12.5 7H4.5v9.5h15ZM4.5 9h15V6.5h-15Z"/></svg>']
  ];

  const profileMarkup = `
    <div class="user-profile-detail">
      <div class="profile-summary">
        <div class="profile-avatar-wrap">
          <img src="${resolveUserAvatarUrl(user.avatar_url || '', user.name || 'User')}" alt="${esc(user.name || 'User')} avatar" onerror="this.onerror=null;this.src='${buildInitialsAvatarSvg(user.name || 'User')}'" />
        </div>
        <div class="profile-identity">
          <h3>${esc(user.name || 'Unknown user')}</h3>
        </div>
      </div>

      <div class="profile-info-panel">
        ${profileRows
          .map(
            ([label, value, icon]) => `
          <div class="profile-row">
            <div class="profile-field">
              <span class="profile-field-icon" aria-hidden="true">${icon}</span>
              <span>${label}</span>
            </div>
            <strong>${esc(value)}</strong>
          </div>
        `
          )
          .join('')}
      </div>
    </div>
  `;

  const modal = createModal({ title: 'User Profile', content: profileMarkup, closeLabel: 'Close' });
  modal.classList.add('user-profile-modal');
  const headerTitle = modal.querySelector('.ui-modal__header h2');
  if (headerTitle) {
    headerTitle.innerHTML = `
      <span class="profile-modal-title-wrap">
        <span class="profile-modal-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M12 12a4 4 0 1 0-4-4a4 4 0 0 0 4 4Zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5Z"/></svg>
        </span>
        <span class="profile-modal-title-copy">
          <span class="profile-modal-title">User Profile</span>
          <span class="profile-modal-subtitle">View and manage user details</span>
        </span>
      </span>
    `;
  }
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

    const userData = Array.isArray(users.data) ? users.data.slice(0, 4) : [];
    root.querySelector('.user-grid').innerHTML = userData.length
      ? userData.map(renderUserCard).join('')
      : '<p class="dashboard-empty-state">No users found.</p>';
    bindUserActions(root, userData);

    const liveActivity = buildActivityFeed(
      Array.isArray(u.activity) ? u.activity : [],
      Array.isArray(p.activity) ? p.activity : [],
      Array.isArray(b.activity) ? b.activity : []
    );

    root.querySelector('.activity-list').innerHTML = liveActivity.length
      ? liveActivity.slice(0, 7).map(renderActivityItem).join('')
      : '<div class="activity-row"><div class="activity-main"><span class="activity-text">No recent activity yet.</span></div></div>';
    applyAdminPrivacy(root);
  } catch (error) {
    if (isExpiredSessionError(error)) {
      resetDashboardState(root);
      return;
    }

    root.querySelector('.user-grid').innerHTML = `<p class="dashboard-empty-state">${esc(error.message || 'Unable to load users.')}</p>`;
    root.querySelector('.activity-list').innerHTML = `<div class="activity-row"><div class="activity-main"><span class="activity-text">${esc(error.message || 'Unable to load recent activity.')}</span></div></div>`;
    showToast({ message: error.message || 'Unable to load admin dashboard data.', type: 'error' });
  }
}

export async function renderDashboardAdmin(root = document.querySelector('#app')) {
  if (!root) throw new Error('Admin dashboard requires #app.');
  await Promise.all([css(), ensureAdminSidebarStyles()]);

  root.innerHTML = `
    <div class="admin-shell">
      ${renderAdminSidebar('dashboardAdmin')}
      <div class="admin-main">
        <main class="admin-dashboard">
          <header class="overview-header">
            <div class="overview-title-wrap">
              <span class="overview-pill">Overview</span>
              <h1>Platform Overview</h1>
              <p>Quick insights into your platform activity and recent user actions.</p>
            </div>
            <div class="header-date-wrap">
              <div class="date-card"><i class="bi bi-calendar3" aria-hidden="true"></i> ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
              <div class="date-status"><span class="status-dot"></span> Updated just now</div>
            </div>
          </header>

          <section class="stats-grid" aria-label="Platform statistics">
            <article class="stat-card stat-card--green">
              <div class="stat-head">
                <div class="stat-icon">${statIcon('users')}</div>
              </div>
              <div class="stat-body">
                <span class="stat-label">Registered Users</span>
                <strong data-metric="users">0</strong>
                <small>Total platform accounts</small>
              </div>
            </article>

            <article class="stat-card stat-card--blue">
              <div class="stat-head">
                <div class="stat-icon">${statIcon('listings')}</div>
              </div>
              <div class="stat-body">
                <span class="stat-label">Published Listings</span>
                <strong data-metric="listings">0</strong>
                <small>Active property listings</small>
              </div>
            </article>

            <article class="stat-card stat-card--purple">
              <div class="stat-head">
                <div class="stat-icon">${statIcon('moderation')}</div>
              </div>
              <div class="stat-body">
                <span class="stat-label">Pending Moderation</span>
                <strong data-metric="pending">0</strong>
                <small>Awaiting review</small>
              </div>
            </article>

            <article class="stat-card stat-card--orange">
              <div class="stat-head">
                <div class="stat-icon">${statIcon('booking')}</div>
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

  const mobileMenu = root.querySelector('.admin-mobile-menu');
  const overviewPill = root.querySelector('.overview-pill');
  const overviewTitle = root.querySelector('.overview-title-wrap h1');
  if (mobileMenu && overviewPill && overviewTitle) {
    const overviewKicker = document.createElement('div');
    overviewKicker.className = 'overview-kicker-row';
    overviewTitle.before(overviewKicker);
    overviewKicker.append(mobileMenu, overviewPill);
  }

  root.querySelector('.users-panel .panel-button')?.addEventListener('click', () => {
    window.location.hash = '#/admin/userManagement';
  });

  refreshDashboardData(root);
}
