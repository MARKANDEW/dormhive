import { createModal, openModal } from '../../components/modal.js';
import { ensureOwnerSidebarStyles, renderOwnerSidebar } from './sidebarOwner.js';

const API = window.DORMHIVE_API_URL ?? 'http://localhost:5000/api/v1';
const session = () => { try { return JSON.parse(localStorage.getItem('dormhive.user')) ?? {}; } catch { return {}; } };
const auth = () => {
  const token = localStorage.getItem('dormhive.accessToken') ?? '';
  return token ? { Authorization: `Bearer ${token}` } : {};
};
const esc = (v = '') => { const e = document.createElement('span'); e.textContent = v; return e.innerHTML; };
const initials = (name = '') => name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || 'O';

function css() {
  if (!document.querySelector('[data-owner-style="tenants"]')) {
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = new URL('./style/activeTenant.css', import.meta.url);
    l.dataset.ownerStyle = 'tenants';
    document.head.append(l);
  }
}

function tenantStatus(entry) {
  const status = String(entry.status || 'approved').toLowerCase();
  if (status === 'approved') return { label: 'Paid', className: 'status-paid' };
  if (status === 'pending') return { label: 'Partial', className: 'status-partial' };
  return { label: 'Overdue', className: 'status-overdue' };
}

function unitLabel(entry) {
  return entry.unit || entry.property_title || 'Unit Unassigned';
}

function formatLeaseEnd(entry) {
  const raw = entry.move_out_date ?? entry.move_in_date ?? null;
  if (!raw) return '—';
  return new Date(raw).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
}

export function renderActiveTenant(root = document.querySelector('#app')) {
  if (!root) throw new Error('Active tenants page requires #app.');
  css();
  ensureOwnerSidebarStyles();
  const user = session();
  const profileName = user.name || 'Mr. Reyes';
  const profileRole = user.role === 'owner' ? 'Property Owner' : 'Tenant';

  root.innerHTML = `
    <div class="owner-shell">
      ${renderOwnerSidebar('activeTenant')}
      <div class="owner-main">
        <header class="owner-topbar">
          <div class="topbar-left">
            <button class="menu" aria-label="Toggle menu">☰</button>
            <div class="brand-lockup">
              <span class="brand-badge">DormHive</span>
            </div>
          </div>
          <label class="search-bar" aria-label="Global search">
            <span>⌕</span>
            <input type="search" placeholder="Global Search" />
          </label>
          <div class="topbar-right">
            <button class="top-icon" aria-label="Notifications">🔔<span class="notification-badge">3</span></button>
            <button class="top-icon" aria-label="Language">🌐</button>
            <div class="profile-identity">
              <div class="avatar">${esc(initials(profileName))}</div>
              <div>
                <strong>${esc(profileName)}</strong>
                <span>${esc(profileRole)}</span>
              </div>
            </div>
          </div>
        </header>

        <main class="tenants-page">
          <section class="page-head">
            <div>
              <p class="eyebrow">Property management</p>
              <h1>Active Tenants</h1>
            </div>
            <article class="summary-card">
              <span>Total Active Tenants</span>
              <strong id="tenant-count">0</strong>
            </article>
          </section>

          <section class="toolbar">
            <label class="local-search" aria-label="Search tenants">
              <span>⌕</span>
              <input id="tenant-search" type="search" placeholder="Search tenant, unit, or property..." />
            </label>
          </section>

          <section class="table-card">
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Tenant Name</th>
                    <th>Unit / Property</th>
                    <th>Rent Status</th>
                    <th>Lease End Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody class="tenant-table-body">
                  <tr><td colspan="5" class="status" role="status">Loading tenants…</td></tr>
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </div>
    </div>`;

  const shell = root.querySelector('.owner-shell');
  root.querySelector('.menu').addEventListener('click', () => shell.classList.toggle('nav-open'));

  const tbody = root.querySelector('.tenant-table-body');
  const searchInput = root.querySelector('#tenant-search');
  const countBadge = root.querySelector('#tenant-count');
  let allRows = [];

  const renderRows = (query = '') => {
    const term = query.trim().toLowerCase();
    const rows = allRows.filter((entry) => {
      const haystack = [entry.tenant_name, unitLabel(entry), entry.property_title, entry.status].filter(Boolean).join(' ').toLowerCase();
      return !term || haystack.includes(term);
    });

    tbody.innerHTML = rows.map((entry) => {
      const { label, className } = tenantStatus(entry);
      return `
        <tr data-booking-id="${esc(String(entry.id ?? ''))}">
          <td>
            <div class="tenant-cell">
              <span class="tenant-avatar">${esc(initials(entry.tenant_name || 'Tenant'))}</span>
              <span>${esc(entry.tenant_name || 'Tenant')}</span>
            </div>
          </td>
          <td>${esc(unitLabel(entry))}</td>
          <td><span class="status-pill ${className}">${esc(label)}</span></td>
          <td>${esc(formatLeaseEnd(entry))}</td>
          <td>
            <div class="action-group">
              <button type="button" data-action="message" data-booking-id="${esc(String(entry.id ?? ''))}">Message</button>
              <button type="button" data-action="lease" data-booking-id="${esc(String(entry.id ?? ''))}">View Lease</button>
              <button type="button" data-action="payments" data-booking-id="${esc(String(entry.id ?? ''))}">Payment History</button>
            </div>
          </td>
        </tr>`;
    }).join('') || '<tr><td colspan="5" class="empty">No active tenants matched your search.</td></tr>';
    if (countBadge) countBadge.textContent = String(rows.length);
  };

  tbody.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;

    const bookingId = button.dataset.bookingId;
    const entry = allRows.find((item) => String(item.id) === String(bookingId));
    if (!entry) return;

    if (button.dataset.action === 'message') {
      location.hash = '#/owner/message';
      return;
    }

    if (button.dataset.action === 'lease') {
      const leaseModal = createModal({
        title: 'Lease Details',
        content: `
          <div class="tenant-action-modal">
            <p><strong>Tenant:</strong> ${esc(entry.tenant_name || 'Tenant')}</p>
            <p><strong>Property:</strong> ${esc(unitLabel(entry))}</p>
            <p><strong>Move-in:</strong> ${esc(new Date(entry.move_in_date ?? Date.now()).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }))}</p>
            <p><strong>Move-out:</strong> ${esc(new Date(entry.move_out_date ?? entry.move_in_date ?? Date.now()).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }))}</p>
            <p><strong>Occupants:</strong> ${esc(String(entry.occupants ?? 1))}</p>
            <p><strong>Rent:</strong> ${esc(entry.monthly_rent ? `₱${Number(entry.monthly_rent).toLocaleString('en-US')}` : '—')}</p>
          </div>
        `
      });
      openModal(leaseModal);
      return;
    }

    const paymentModal = createModal({
      title: 'Payment History',
      content: `
        <div class="tenant-action-modal">
          <p><strong>Tenant:</strong> ${esc(entry.tenant_name || 'Tenant')}</p>
          <p><strong>Property:</strong> ${esc(unitLabel(entry))}</p>
          <p><strong>Current status:</strong> ${esc(tenantStatus(entry).label)}</p>
          <p><strong>Monthly rent:</strong> ${esc(entry.monthly_rent ? `₱${Number(entry.monthly_rent).toLocaleString('en-US')}` : '—')}</p>
          <p><strong>Last update:</strong> ${esc(new Date(entry.updated_at ?? entry.created_at ?? Date.now()).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }))}</p>
          <p class="tenant-action-note">This payment record is linked to the current approved booking and can be extended once a payment endpoint is wired.</p>
        </div>
      `
    });
    openModal(paymentModal);
  });

  fetch(`${API}/bookings`, { headers: auth() })
    .then(async (r) => {
      const b = await r.json();
      if (!r.ok) throw new Error(b.message ?? 'Unable to load active tenants.');
      allRows = Array.isArray(b.data) ? b.data.filter((item) => item.status === 'approved') : [];
      renderRows();
      const loadingCell = tbody.querySelector('.status');
      if (loadingCell) loadingCell.remove();
    })
    .catch((error) => {
      tbody.innerHTML = `<tr><td colspan="5" class="empty">${esc(error.message)}</td></tr>`;
    });

  searchInput?.addEventListener('input', (event) => renderRows(event.target.value));

  root.querySelector('.logout')?.addEventListener('click', () => {
    localStorage.clear();
    location.assign('#/login');
  });
}


