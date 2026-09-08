import { ensureAdminSidebarStyles, renderAdminSidebar } from './sidebarAdmin.js';
import { applyAdminPrivacy } from './privacy.js';
import { resolveUserAvatarUrl } from './avatar.js';

const API = window.DORMHIVE_API_URL ?? 'http://localhost:5000/api/v1';
const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('dormhive.accessToken') ?? ''}` });
const esc = (value = '') => { const element = document.createElement('span'); element.textContent = value; return element.innerHTML; };

function css() {
  if (document.querySelector('[data-admin-style="users"]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('./style/userManagement.css', import.meta.url);
  link.dataset.adminStyle = 'users';
  document.head.append(link);
}

const fallbackAvatar = (name = 'User') => {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || 'U';
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" rx="60" fill="#dff3ee"/><circle cx="60" cy="42" r="22" fill="#17344f"/><path d="M28 96c6-16 18-25 32-25s26 9 32 25" fill="#2b78a8"/><text x="50%" y="68%" text-anchor="middle" font-size="30" font-family="Inter,Arial,sans-serif" font-weight="700" fill="#ffffff">${initials}</text></svg>`)}`;
};

export function renderUserManagement(root = document.querySelector('#app')) {
  if (!root) throw new Error('User management requires #app.');
  css();
  ensureAdminSidebarStyles();
  root.innerHTML = `
    <div class="admin-shell">
      ${renderAdminSidebar('userManagement')}
      <div class="admin-main">
        <main class="users-page">
          <header class="users-header">
            <div>
              <div class="users-kicker"><span aria-hidden="true">♙</span> Users</div>
              <h1>User management</h1>
              <p>Search and administer platform accounts.</p>
            </div>
            <div class="users-header-meta"><span class="users-date">▣ <time>${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</time></span><span class="users-updated">● Updated just now</span></div>
          </header>
          <section class="users-content">
            <label class="users-search"><span aria-hidden="true">⌕</span><input type="search" placeholder="Search name or email" /></label>
            <p class="status" role="status">Loading users...</p>
            <section class="users-card">
              <div class="users-card-heading"><div class="users-card-title"><span class="users-card-icon" aria-hidden="true">♙</span><div><h2>Platform Users</h2><p>Manage and view all registered users.</p></div></div><span class="users-total" data-total>0 total</span></div>
              <div class="table-wrap"><table><thead><tr><th>User</th><th>Role</th><th>Status</th><th>Action</th></tr></thead><tbody></tbody></table></div>
            </section>
          </section>
        </main>
      </div>
    </div>`;

  const input = root.querySelector('.users-search input');
  const body = root.querySelector('tbody');
  const status = root.querySelector('.status');
  const total = root.querySelector('[data-total]');

  const load = async () => {
    try {
      const response = await fetch(`${API}/users?limit=100&search=${encodeURIComponent(input.value)}`, { headers: headers() });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || 'Unable to load users.');
      const users = Array.isArray(payload.data) ? payload.data : [];
      total.textContent = `${users.length} total`;
      status.hidden = true;
      body.innerHTML = users.map((user) => {
        const name = user.name || 'User';
        const avatar = resolveUserAvatarUrl(user.avatar_url || '', name) || fallbackAvatar(name);
        const active = user.status === 'active';
        return `<tr><td><div class="user-table-cell"><img class="user-row-avatar" src="${esc(avatar)}" alt="${esc(name)} avatar" onerror="this.onerror=null;this.src='${fallbackAvatar(name)}'" /><div><strong data-privacy-mask="name">${esc(name)}</strong><small data-privacy-mask="email">${esc(user.email)}</small></div></div></td><td>${esc(user.role)}</td><td><span class="pill ${active ? 'active' : 'suspended'}"><i aria-hidden="true"></i>${esc(active ? 'Active' : 'Suspended')}</span></td><td><button class="user-status-button" data-id="${esc(user.id)}" data-status="${active ? 'suspended' : 'active'}">${active ? 'Suspend' : 'Activate'}</button></td></tr>`;
      }).join('') || '<tr><td colspan="4" class="empty-row">No users found.</td></tr>';
      applyAdminPrivacy(root);
      body.querySelectorAll('.user-status-button').forEach((button) => button.addEventListener('click', async () => {
        button.disabled = true;
        const response = await fetch(`${API}/users/${button.dataset.id}`, { method: 'PATCH', headers: headers(), body: JSON.stringify({ status: button.dataset.status }) });
        if (!response.ok) { const error = await response.json(); status.textContent = error.message || 'Unable to update user.'; status.hidden = false; }
        await load();
      }));
    } catch (error) {
      status.textContent = error.message;
      status.hidden = false;
    }
  };

  input.addEventListener('input', () => { clearTimeout(input.timer); input.timer = setTimeout(load, 250); });
  load();
}
