import { ensureAdminSidebarStyles, renderAdminSidebar } from './sidebarAdmin.js';
import { buildDashboardMetrics } from './analyticsUtils.js';
import { createModal, openModal } from '../../components/modal.js';
import { showToast } from '../../components/toast.js';
import { applyAdminPrivacy } from './privacy.js';
import { resolveUserAvatarUrl } from './avatar.js';

const API = window.DORMHIVE_API_URL ?? 'http://localhost:5000/api/v1';
const auth = () => ({ Authorization: `Bearer ${localStorage.getItem('dormhive.accessToken') ?? ''}` });
const esc = (v = '') => {
  const e = document.createElement('span');
  e.textContent = v;
  return e.innerHTML;
};
const validRoles = ['tenant', 'owner', 'admin'];

function formatTimeAgo(timestamp) {
  if (!timestamp) return 'unknown';
  const now = new Date();
  const date = new Date(timestamp);
  const seconds = Math.floor((now - date) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min${minutes > 1 ? 's' : ''} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function buildActivityFeed(users = [], properties = [], bookings = []) {
  const activities = [];
  properties.forEach((prop) => {
    if (prop.status === 'approved') {
      activities.push({
        icon: 'shield',
        title: 'Property approved',
        detail: `[${prop.title || 'Property'}]`,
        time: formatTimeAgo(prop.updated_at),
        timestamp: new Date(prop.updated_at || prop.created_at).getTime()
      });
    }
    if (prop.status === 'rejected') {
      activities.push({
        icon: 'alert',
        title: 'Property rejected',
        detail: `[${prop.title || 'Property'}]`,
        time: formatTimeAgo(prop.updated_at),
        timestamp: new Date(prop.updated_at || prop.created_at).getTime()
      });
    }
  });
  bookings.forEach((booking) => {
    if (booking.status === 'approved') {
      activities.push({
        icon: 'user',
        title: 'Booking approved',
        detail: `[${booking.tenant_name || 'Tenant'}]`,
        time: formatTimeAgo(booking.updated_at),
        timestamp: new Date(booking.updated_at || booking.created_at).getTime()
      });
    }
    if (booking.status === 'rejected') {
      activities.push({
        icon: 'alert',
        title: 'Booking rejected',
        detail: `[${booking.tenant_name || 'Tenant'}]`,
        time: formatTimeAgo(booking.updated_at),
        timestamp: new Date(booking.updated_at || booking.created_at).getTime()
      });
    }
  });
  users.forEach((user) => {
    if (user.status === 'active' || user.status === 'suspended') {
      activities.push({
        icon: user.status === 'suspended' ? 'alert' : 'user',
        title: user.status === 'suspended' ? 'User suspended' : 'New user registered',
        detail: `[${user.name || user.email}]`,
        time: formatTimeAgo(user.created_at),
        timestamp: new Date(user.created_at).getTime()
      });
    }
  });
  return activities.sort((a, b) => b.timestamp - a.timestamp).slice(0, 10);
}

const fallbackUsers = [
  { name: 'Jaker', email: 'jaker@owner2.com', role: 'landlord', status: 'active' },
  { name: 'Landlord', email: 'owner@owner2.com', role: 'landlord', status: 'active' },
  { name: 'Jamie Dive', email: 'owner@owner2.com', role: 'moderator', status: 'active' },
  { name: 'Kenji Santes', email: 'owner@owner2.com', role: 'moderator', status: 'active' },
  { name: 'Tenant', email: 'owner@owner2.com', role: 'moderator', status: 'active' },
  { name: 'Hamo Demir', email: 'owner@owner2.com', role: 'moderator', status: 'active' }
];

function css() {
  if (!document.querySelector('[data-admin-style="dashboard"]')) {
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = new URL('./style/dashboardAdmin.css', import.meta.url);
    l.dataset.adminStyle = 'dashboard';
    document.head.append(l);
  }
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
    throw new Error(payload?.message ?? 'Request failed.');
  }

  return payload;
}

function renderUserCard(user) {
  const status = (user.status || 'active').toString();
  const avatarUrl = resolveUserAvatarUrl(user.avatar_url || '', user.name || 'User');
  return `
    <article class="user-card" data-user-id="${user.id ?? ''}">
      <div class="user-avatar" aria-hidden="true">
        <img src="${esc(avatarUrl)}" alt="${esc(user.name || 'User')} avatar" onerror="this.onerror=null;this.src='data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" rx="60" fill="#efe6d6"/><circle cx="60" cy="42" r="22" fill="#4a3d2f"/><path d="M28 96c6-16 18-25 32-25s26 9 32 25" fill="#8d6435"/><text x="50%" y="67%" text-anchor="middle" font-size="34" font-family="Inter, Arial, sans-serif" font-weight="700" fill="#ffffff">${(user.name || 'U').split(/\s+/).filter(Boolean).slice(0,2).map((part) => part[0]?.toUpperCase() ?? '').join('') || 'U'}</text></svg>`)}'" />
      </div>
      <div class="user-copy">
        <div class="user-name-row">
          <span class="user-name" data-privacy-mask="name">${esc(user.name || 'Unknown user')}</span>
          <span class="card-actions">Actions</span>
        </div>
        <div class="user-meta" data-privacy-mask="email">Email: ${esc(user.email || '—')}</div>
        <div class="user-role-line">
          <span>Role:</span>
          <strong>${esc(user.role || 'user')}</strong>
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
    shield: 'icon shield',
    alert: 'icon alert',
    user: 'icon user',
    sync: 'icon sync'
  };

  return `
    <li class="activity-item">
      <span class="${iconClasses[item.icon] ?? 'icon default'}" aria-hidden="true"></span>
      <span class="activity-text">${esc(item.title)}${item.detail ? ` ${esc(item.detail)}` : ''}</span>
      <time>${esc(item.time)}</time>
    </li>
  `;
}

function showUserProfileModal(user) {
  const profileMarkup = `
    <div class="user-profile-detail">
      <div class="profile-avatar-wrap">
        <img src="${resolveUserAvatarUrl(user.avatar_url || '', user.name || 'User')}" alt="${esc(user.name || 'User')} avatar" onerror="this.onerror=null;this.src='data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" rx="60" fill="#efe6d6"/><circle cx="60" cy="42" r="22" fill="#4a3d2f"/><path d="M28 96c6-16 18-25 32-25s26 9 32 25" fill="#8d6435"/><text x="50%" y="67%" text-anchor="middle" font-size="34" font-family="Inter, Arial, sans-serif" font-weight="700" fill="#ffffff">${(user.name || 'U').split(/\s+/).filter(Boolean).slice(0,2).map((part) => part[0]?.toUpperCase() ?? '').join('') || 'U'}</text></svg>`)}'" />
      </div>
      <div class="profile-row"><span>Name</span><strong>${esc(user.name || 'Unknown user')}</strong></div>
      <div class="profile-row"><span>Email</span><strong>${esc(user.email || '—')}</strong></div>
      <div class="profile-row"><span>Role</span><strong>${esc(user.role || 'user')}</strong></div>
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
  const nextRole = window.prompt(
    `Update role for ${user.name || user.email || 'this user'}:\nChoose one: tenant, owner, admin`,
    currentRole
  );

  if (nextRole === null) return;

  const normalized = String(nextRole).trim().toLowerCase();
  if (!validRoles.includes(normalized)) {
    showToast({ message: 'Choose a valid role: tenant, owner, or admin.', type: 'error' });
    return;
  }

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
  try {
    const [u, p, b, users, allProperties, allBookings] = await Promise.all([
      apiRequest('/analytics/users'),
      apiRequest('/analytics/properties'),
      apiRequest('/analytics/bookings'),
      apiRequest('/users?limit=6'),
      apiRequest('/properties'),
      apiRequest('/bookings')
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

    const userData = Array.isArray(users.data) && users.data.length ? users.data.slice(0, 6) : fallbackUsers;
    const activityUsers = Array.isArray(users.data) ? users.data : [];

    root.querySelector('.user-grid').innerHTML = userData.map(renderUserCard).join('');
    bindUserActions(root, userData);

    const activities = buildActivityFeed(activityUsers, allProperties.data ?? [], allBookings.data ?? []);
    root.querySelector('.activity-feed').innerHTML = activities.map(renderActivityItem).join('');
    applyAdminPrivacy(root);
  } catch (error) {
    root.querySelector('.user-grid').innerHTML = fallbackUsers.map(renderUserCard).join('');
    bindUserActions(root, fallbackUsers);
    root.querySelector('.activity-feed').innerHTML = '<li class="activity-item"><span class="activity-text">No recent activity</span></li>';
    root.querySelector('[data-metric="users"]').textContent = '0';
    root.querySelector('[data-metric="listings"]').textContent = '0';
    root.querySelector('[data-metric="pending"]').textContent = '0';
    root.querySelector('[data-metric="bookings"]').textContent = '0';
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
          <section class="overview-section">
            <h2>Platform Overview</h2>
            <div class="metrics">
              <article><span>Registered Users</span><strong data-metric="users">—</strong></article>
              <article><span>Published Listings</span><strong data-metric="listings">—</strong></article>
              <article><span>Pending Moderation</span><strong data-metric="pending">—</strong></article>
              <article><span>Booking Requests</span><strong data-metric="bookings">—</strong></article>
            </div>
          </section>

          <section class="recent-users-section">
            <h2>Recent Users</h2>
            <div class="user-grid"></div>
          </section>

          <section class="activity-section">
            <h2>Recent Activity Feed</h2>
            <ul class="activity-feed"></ul>
          </section>
        </main>
      </div>
    </div>
  `;

  refreshDashboardData(root);
}



