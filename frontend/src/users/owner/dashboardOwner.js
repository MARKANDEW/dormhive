import { ensureOwnerSidebarStyles, renderOwnerSidebar } from './sidebarOwner.js';
import { initLeafletMap, updateLeafletMarkers } from '../../components/mapPanel.js';

const API = window.DORMHIVE_API_URL ?? 'http://localhost:5000/api/v1';
const session = () => { try { return JSON.parse(localStorage.getItem('dormhive.user')) ?? {}; } catch { return {}; } };
const auth = () => ({ Authorization: `Bearer ${localStorage.getItem('dormhive.accessToken') ?? ''}` });
const escape = (value = '') => { const el = document.createElement('span'); el.textContent = value; return el.innerHTML; };
const statusClass = {
  new: 'status-new',
  'new-inquiry': 'status-new',
  replied: 'status-replied',
  pending: 'status-pending'
};
function css() { if (!document.querySelector('[data-owner-style="dashboard"]')) { const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = new URL('./style/dashboardOwner.css', import.meta.url); link.dataset.ownerStyle = 'dashboard'; document.head.append(link); } }
async function get(path) { const response = await fetch(`${API}${path}`, { headers: auth() }); const body = await response.json(); if (!response.ok) throw new Error(body.message ?? 'Request failed.'); return body; }
function metricCard(label, value, note, icon, trend = false) {
  return `<article class="metric-card"><div class="metric-icon">${icon}</div><div><p>${label}</p><strong>${value}</strong><span>${note}${trend ? ' ↗' : ''}</span></div></article>`;
}
function mapUrl(query) { return `https://www.google.com/maps?q=${encodeURIComponent(query)}&z=12&output=embed`; }
export function renderDashboardOwner(root = document.querySelector('#app')) {
  if (!root) throw new Error('Owner dashboard requires #app.'); css(); ensureOwnerSidebarStyles(); const user = session();
  const profileName = user.name || 'Owner';
  const profileInitials = profileName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'O';
  root.innerHTML = `
    <div class="owner-shell">
      ${renderOwnerSidebar('dashboardOwner')}
      <div class="owner-main">
        <header class="owner-topbar">
          <div class="topbar-left">
            <button class="menu" aria-label="Toggle menu">☰</button>
            <div class="brand-lockup">
              <span class="brand-badge">DormHive</span>
            </div>
          </div>
          <label class="search-bar" aria-label="Search my listings, inquiries, tenants">
            <span>⌕</span>
            <input type="search" placeholder="Search my listings, inquiries, tenants..." />
          </label>
          <div class="topbar-right">
            <button class="top-icon" aria-label="Notifications">🔔<span class="notification-badge">3</span></button>
            <div class="profile-identity">
              <div class="avatar">${escape(profileInitials)}</div>
              <div>
                <strong>${escape(profileName)}</strong>
                <span>Property Owner</span>
              </div>
            </div>
          </div>
        </header>
        <main class="owner-dashboard">
          <section class="metrics-grid">
            <article class="metric-card metric-card--highlight">
              <div class="metric-icon">🏠</div>
              <div><p>Total Listings</p><strong data-metric="listings">24 Active</strong><span>+8% from last month ↗</span></div>
            </article>
            <article class="metric-card">
              <div class="metric-icon">📣</div>
              <div><p>Total Inquiries</p><strong data-metric="inquiries">48 Total</strong><span>12 this week ⚠</span></div>
            </article>
            <article class="metric-card">
              <div class="metric-icon">◔</div>
              <div><p>Occupancy Rate</p><strong data-metric="occupancy">16</strong><span>80% Occupancy</span></div>
            </article>
            <article class="metric-card">
              <div class="metric-icon">₱</div>
              <div><p>Monthly Earnings</p><strong data-metric="revenue">₱72,450</strong><span>Projected</span></div>
            </article>
          </section>
          <section class="overview-grid">
            <article class="panel map-panel">
              <div class="panel-title-row"><h2>Map Overview</h2><button class="panel-button">View Full Map & Heatmap</button></div>
              <div class="map-frame-wrap"><div id="tenant-map" class="leaflet-map" style="height:20rem;border-radius:0.5rem"></div></div>
            </article>
            <aside class="panel action-panel">
              <div class="panel-title-row"><h2>Action Center</h2></div>
              <div class="action-stack">
                <button class="action-button" type="button" data-route="#/owner/myListing">+ List a New Property</button>
                <button class="action-button secondary">Generate Performance Report</button>
              </div>
            </aside>
          </section>
          <section class="interactions-grid">
            <article class="panel table-panel">
              <div class="panel-title-row"><h2>Inquiries Overview</h2><a href="#/owner/inquiries">View all</a></div>
              <div class="table-wrap"><table><thead><tr><th>Tenant Name</th><th>Property</th><th>Date</th><th>Status</th></tr></thead><tbody></tbody></table></div>
            </article>
            <article class="panel listings-panel">
              <div class="panel-title-row"><h2>My Top Listings</h2><a href="#/owner/myListing">Manage</a></div>
              <div class="listings-card-grid"></div>
            </article>
          </section>
        </main>
      </div>
    </div>`;
  const shell = root.querySelector('.owner-shell');
  root.querySelector('.menu').addEventListener('click', () => shell.classList.toggle('nav-open'));
  root.querySelector('[data-route="#/owner/myListing"]').addEventListener('click', () => location.hash = '#/owner/myListing');
  root.querySelector('.logout').addEventListener('click', () => { localStorage.clear(); location.assign('#/login'); });
  Promise.all([get('/properties?limit=100').catch(() => ({ data: [] })), get('/bookings').catch(() => ({ data: [] }))]).then(async ([properties, bookings]) => {
    const items = (properties.data ?? []).filter((item) => Number(item.owner_id) === Number(user.id));
    const listingGrid = root.querySelector('.listings-card-grid');
    const cards = items.slice(0, 3).map((item) => {
      const roomType = String(item.room_type || 'Property').replaceAll('_', ' ');
      const place = [item.barangay, item.municipality].filter(Boolean).join(', ') || 'Manila';
      const badge = item.status === 'approved' ? 'Active' : String(item.status || 'Available').replaceAll('_', ' ');
      return `
        <article class="listing-card">
          <div class="listing-topline"><span class="property-pill">${escape(badge)}</span><span class="property-rent">₱${Number(item.monthly_rent ?? 0).toLocaleString()}/mo</span></div>
          <h3>${escape(item.title || 'Untitled property')}</h3>
          <p class="listing-subtitle">${escape(place)} • ${escape(roomType)}</p>
          <div class="listing-actions"><button>Manage</button><button class="ghost">Edit Listing</button></div>
        </article>`;
    }).join('');
    listingGrid.innerHTML = cards || '<p class="empty">No property listings yet for this account.</p>';
    const requests = bookings.data.length ? bookings.data : [];
    const approved = requests.filter((item) => item.status === 'approved');
    const activeListings = items.length;
    const inquiryCount = requests.length;
    const occupancy = Math.min(100, Math.max(0, Math.round((activeListings / Math.max(items.length || 1, 1)) * 100)));
    const projectedRevenue = approved.reduce((total, item) => total + Number(item.monthly_rent ?? 0), 0);
    root.querySelector('[data-metric="listings"]').textContent = `${activeListings} Active`;
    root.querySelector('[data-metric="inquiries"]').textContent = `${inquiryCount} Total`;
    root.querySelector('[data-metric="occupancy"]').textContent = `${occupancy}%`;
    root.querySelector('[data-metric="revenue"]').textContent = `₱${projectedRevenue.toLocaleString()}`;
    root.querySelector('tbody').innerHTML = requests.slice(0, 5).map((item) => {
      const normalized = (item.status ?? 'Pending').toLowerCase().replace(/\s+/g, '-');
      const badgeClass = statusClass[normalized] ?? 'status-pending';
      return `
        <tr>
          <td>${escape(item.tenant_name ?? item.user_name ?? 'Tenant')}</td>
          <td>${escape(item.property_title ?? item.property_name ?? 'DormHive Listing')}</td>
          <td>${new Date(item.move_in_date ?? item.created_at ?? Date.now()).toLocaleDateString()}</td>
          <td><span class="status-tag ${badgeClass}">${escape(item.status ?? 'Pending')}</span></td>
        </tr>`;
    }).join('') || '<tr><td colspan="4">No inquiries yet.</td></tr>';
    // Initialize Leaflet map with the owner's properties (pixel-accurate markers)
    try {
      await initLeafletMap(root.querySelector('.map-panel'), items);
    } catch (err) {
      // ignore map init errors but surface a console warning
      // eslint-disable-next-line no-console
      console.warn('Failed to initialize owner map', err);
    }
  }).catch((error) => {
    root.querySelector('.table-wrap').innerHTML = `<p class="status-message">${escape(error.message)}</p>`;
  });
}




