import { ensureAdminSidebarStyles, loadAdminStylesheet, renderAdminSidebar } from './sidebarAdmin.js';
import { applyAdminPrivacy } from './privacy.js';
import { successDialog } from '../../components/modal.js';

const API = (window.DORMHIVE_API_URL ?? 'http://localhost:5000/api/v1').replace(/\/$/, '');
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('dormhive.accessToken') ?? ''}` });
const esc = (value = '') => {
  const element = document.createElement('span');
  element.textContent = value;
  return element.innerHTML;
};

function loadStyles() {
  const stylesheet = new URL('./style/userManagement.css', import.meta.url);
  stylesheet.searchParams.set('v', 'archive-page-3');
  return loadAdminStylesheet('users', stylesheet);
}

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    cache: 'no-store',
    headers: { ...headers(), ...(options.headers ?? {}) }
  });
  const text = await response.text();
  let payload = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = null; }
  if (!response.ok) throw new Error(payload?.message || 'Unable to complete the archive request.');
  return payload;
}

export async function renderArchive(root = document.querySelector('#app')) {
  if (!root) throw new Error('Archive page requires #app.');
  await Promise.all([loadStyles(), ensureAdminSidebarStyles()]);

  root.innerHTML = `
    <div class="admin-shell">
      ${renderAdminSidebar('archive')}
      <div class="admin-main">
        <main class="users-page">
          <header class="users-header">
            <div>
              <div class="users-kicker">Records</div>
              <h1>Archive</h1>
              <p>Restore archived tenant and owner accounts or property listings.</p>
            </div>
          </header>
          <section class="users-content">
            <div class="archive-tabs" role="group" aria-label="Archived record type">
              <button type="button" class="user-status-button active" data-archive-kind="accounts" aria-pressed="true">Accounts</button>
              <button type="button" class="user-status-button" data-archive-kind="properties" aria-pressed="false">Properties</button>
            </div>
            <p class="status" role="status">Loading archived records...</p>
            <section class="users-card">
              <div class="users-card-heading">
                <div class="users-card-title"><span class="users-card-icon" aria-hidden="true"><i class="bi bi-archive"></i></span><div><h2 data-archive-title>Archived accounts</h2><p>Records remain stored until restored.</p></div></div>
                <span class="users-total" data-total>0 total</span>
              </div>
              <div class="table-wrap archive-table-wrap"><table class="archive-records-table"><thead><tr data-archive-head></tr></thead><tbody></tbody></table></div>
            </section>
          </section>
        </main>
      </div>
    </div>`;

  const mobileMenu = root.querySelector('.admin-mobile-menu');
  const kicker = root.querySelector('.users-kicker');
  if (mobileMenu && kicker) {
    const row = document.createElement('div');
    row.className = 'users-kicker-row';
    kicker.before(row);
    row.append(mobileMenu, kicker);
  }

  const status = root.querySelector('.status');
  const total = root.querySelector('[data-total]');
  const title = root.querySelector('[data-archive-title]');
  const head = root.querySelector('[data-archive-head]');
  const body = root.querySelector('tbody');
  let kind = 'accounts';

  const load = async () => {
    status.textContent = 'Loading archived records...';
    status.hidden = false;
    title.textContent = kind === 'accounts' ? 'Archived accounts' : 'Archived properties';
    head.innerHTML = kind === 'accounts'
      ? '<th>User</th><th>Role</th><th>Last date active</th><th>Archived</th><th>Action</th>'
      : '<th>Property</th><th>Owner</th><th>Previous status</th><th>Archived</th><th>Action</th>';

    try {
      const path = kind === 'accounts'
        ? '/users?archived=true&limit=100'
        : '/properties?status=archived&limit=100';
      const payload = await request(path);
      const records = Array.isArray(payload?.data) ? payload.data : [];
      total.textContent = `${records.length} total`;
      status.hidden = true;

      body.innerHTML = records.map((record) => {
        const previousStatus = record.archived_status || 'active';
        const archivedDate = record.archived_at ? new Date(record.archived_at).toLocaleDateString() : '—';
        const lastActive = record.last_login_at
          ? new Date(record.last_login_at).toLocaleString()
          : record.last_active_at
              ? new Date(record.last_active_at).toLocaleString()
              : 'Not recorded';
        if (kind === 'accounts') {
          const label = record.name || record.email || 'User';
          return `<tr>
            <td data-label="User"><div><strong data-privacy-mask="name">${esc(label)}</strong><small data-privacy-mask="email">${esc(record.email || '')}</small></div></td>
            <td data-label="Role">${esc(record.role || '')}</td>
            <td data-label="Last date active">${esc(lastActive)}</td>
            <td data-label="Archived">${esc(archivedDate)}</td>
            <td data-label="Action"><button type="button" class="user-status-button archive-restore-button" data-record-id="${esc(record.id)}">Restore</button></td>
          </tr>`;
        }
        return `<tr>
          <td data-label="Property"><strong>${esc(record.title || 'Untitled property')}</strong><small>${esc([record.address, record.municipality].filter(Boolean).join(', '))}</small></td>
          <td data-label="Owner">${esc(record.owner_name || record.owner_email || '—')}</td>
          <td data-label="Previous status">${esc(previousStatus)}</td>
          <td data-label="Archived">${esc(archivedDate)}</td>
          <td data-label="Action"><button type="button" class="user-status-button archive-restore-button" data-record-id="${esc(record.id)}">Restore</button></td>
        </tr>`;
      }).join('') || `<tr><td colspan="5" class="empty-row">No archived ${kind} found.</td></tr>`;

      applyAdminPrivacy(root);
      body.querySelectorAll('.archive-restore-button').forEach((button) => {
        button.addEventListener('click', async () => {
          button.disabled = true;
          try {
            const endpoint = kind === 'accounts' ? 'users' : 'properties';
            await request(`/${endpoint}/${encodeURIComponent(button.dataset.recordId)}/restore`, { method: 'PATCH' });
            if (kind === 'accounts') {
              await successDialog('Account restored successfully.');
            } else {
              await successDialog('Property restored successfully.');
            }
            await load();
          } catch (error) {
            button.disabled = false;
            status.textContent = error.message;
            status.hidden = false;
          }
        });
      });
    } catch (error) {
      total.textContent = '0 total';
      body.innerHTML = '';
      status.textContent = error.message;
      status.hidden = false;
    }
  };

  root.querySelectorAll('[data-archive-kind]').forEach((button) => button.addEventListener('click', () => {
    kind = button.dataset.archiveKind;
    root.querySelectorAll('[data-archive-kind]').forEach((tab) => {
      const selected = tab === button;
      tab.classList.toggle('active', selected);
      tab.setAttribute('aria-pressed', String(selected));
    });
    load();
  }));

  load();
}
