import { createModal, openModal } from '../../components/modal.js';
import { ensureOwnerSidebarStyles, renderOwnerSidebar, updateListingCountsInSidebar } from './sidebarOwner.js';

const API = window.DORMHIVE_API_URL ?? 'http://localhost:5000/api/v1';
const apiBase = API.replace(/\/api\/v1\/?$/, '');
const session = () => { try { return JSON.parse(localStorage.getItem('dormhive.user')) ?? {}; } catch { return {}; } };
const auth = () => {
  const token = localStorage.getItem('dormhive.accessToken') ?? '';
  return token ? { Authorization: `Bearer ${token}` } : {};
};
const esc = (v = '') => { const e = document.createElement('span'); e.textContent = v; return e.innerHTML; };
const initials = (name = '') => name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || 'O';
const resolveAvatarUrl = (value = '') => {
  const url = String(value || '').trim();
  if (!url) return '';
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;
  if (/^https?:\/\//i.test(url)) return url;
  return `${apiBase}${url.startsWith('/') ? '' : '/'}${url}`;
};

function css() {
  document.querySelectorAll('[data-owner-style="tenants"]').forEach((node) => node.remove());
  const existing = document.querySelector('[data-owner-style="tenants"]');
  if (!existing) {
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = new URL('./style/activeTenant.css', import.meta.url);
    l.dataset.ownerStyle = 'tenants';
    document.head.append(l);
  }
}

function tenantStatus(entry) {
  const status = String(entry.status || 'approved').toLowerCase();
  if (status === 'approved') return { label: 'Active', className: 'status-paid' };
  if (status === 'pending') return { label: 'Partial', className: 'status-partial' };
  return { label: 'Overdue', className: 'status-overdue' };
}

function isActiveTenant(entry) {
  const status = String(entry?.status ?? '').toLowerCase();
  return status === 'approved';
}

function unitLabel(entry) {
  return entry.unit || entry.property_title || 'Unit Unassigned';
}

function formatLeaseEnd(entry) {
  const raw = entry.move_out_date ?? entry.move_in_date ?? null;
  if (!raw) return '—';
  const date = new Date(raw); if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
}

function normalizeTenantEntry(entry = {}) {
  const tenantName = entry.tenant_name || [entry.first_name, entry.last_name].filter(Boolean).join(' ') || 'Tenant';
  return {
    ...entry,
    tenant_name: tenantName,
    property_title: entry.property_title || entry.title || 'Property',
    unit: entry.unit || entry.property_title || 'Unit Unassigned'
  };
}

export function renderActiveTenant(root = document.querySelector('#app')) {
  if (!root) throw new Error('Active tenants page requires #app.');
  root.replaceChildren();
  css();
  ensureOwnerSidebarStyles();

  root.innerHTML = `
    <div class="owner-shell">
      ${renderOwnerSidebar('activeTenant')}
      <div class="owner-main">
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

  const tbody = root.querySelector('.tenant-table-body');
  const searchInput = root.querySelector('#tenant-search');
  const countBadge = root.querySelector('#tenant-count');
  let allRows = [];
  let isLoading = false;

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
      localStorage.setItem('dormhive.activeTenantSelection', JSON.stringify({
        tenantId: entry.tenant_id,
        propertyId: entry.property_id,
        tenantName: entry.tenant_name || 'Tenant',
        propertyTitle: entry.property_title || 'Property'
      }));
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
          <p class="tenant-action-note">This payment record is linked to the current active booking and can be extended once a payment endpoint is wired.</p>
        </div>
      `
    });
    openModal(paymentModal);
  });

  const loadTenants = async () => {
    if (isLoading || !root.isConnected) return;
    isLoading = true;
    try {
      const r = await fetch(`${API}/bookings`, { headers: auth() });
      const b = await r.json();
      if (!r.ok) throw new Error(b.message ?? 'Unable to load active tenants.');
      allRows = Array.isArray(b.data)
        ? b.data
            .filter((item) => isActiveTenant(item))
            .map((item) => normalizeTenantEntry(item))
        : [];
      renderRows();
      const loadingCell = tbody.querySelector('.status');
      if (loadingCell) loadingCell.remove();
      await updateListingCountsInSidebar();
    } catch (error) {
      tbody.innerHTML = `<tr><td colspan="5" class="empty">${esc(error.message)}</td></tr>`;
    } finally {
      isLoading = false;
    }
  };

  loadTenants();
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) loadTenants();
  });

  searchInput?.addEventListener('input', (event) => renderRows(event.target.value));

  root.querySelector('.logout')?.addEventListener('click', () => {
    localStorage.clear();
    location.assign('#/login');
  });
}


