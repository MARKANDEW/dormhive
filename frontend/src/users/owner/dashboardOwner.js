import { ensureOwnerSidebarStyles, renderOwnerProfileCard, renderOwnerSidebar, updateListingCountsInSidebar } from './sidebarOwner.js';
import { initLeafletMap, updateLeafletMarkers } from '../../components/mapPanel.js';
import { createModal, openModal } from '../../components/modal.js';
import { showToast } from '../../components/toast.js';
import { api, getApiErrorMessage, readApiResponse } from '../../services/api.js';
import { markNotificationRead } from '../../services/notificationSystem.js';

const API = window.DORMHIVE_API_URL ?? 'http://localhost:5000/api/v1';
const apiBase = API.replace(/\/api\/v1\/?$/, '');
const session = () => { try { return JSON.parse(localStorage.getItem('dormhive.user')) ?? {}; } catch { return {}; } };
const auth = () => ({ Authorization: `Bearer ${localStorage.getItem('dormhive.accessToken') ?? ''}` });
const escape = (value = '') => { const el = document.createElement('span'); el.textContent = value; return el.innerHTML; };
const resolveAvatarUrl = (value = '') => {
  const url = String(value || '').trim();
  if (!url) return '';
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;
  if (/^https?:\/\//i.test(url)) return url;
  return `${apiBase}${url.startsWith('/') ? '' : '/'}${url}`;
};
const statusClass = {
  new: 'status-new',
  'new-inquiry': 'status-new',
  replied: 'status-replied',
  pending: 'status-pending'
};
const formatNotificationDate = (value) => new Date(value ?? Date.now()).toLocaleDateString([], { month: 'short', day: 'numeric' });

// Ensure Leaflet is loaded
async function ensureLeafletLoaded() {
  // Load Leaflet CSS if not already present
  if (!document.querySelector('link[href*="leaflet.css"]')) {
    const leafletCss = document.createElement('link');
    leafletCss.rel = 'stylesheet';
    leafletCss.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.append(leafletCss);
  }
  
  // Load Leaflet JS if not already loaded
  if (!window.L) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = (err) => reject(err);
      document.head.append(script);
    });
  }
  return Promise.resolve();
}
function css() { if (!document.querySelector('[data-owner-style="dashboard"]')) { const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = new URL('./style/dashboardOwner.css', import.meta.url); link.dataset.ownerStyle = 'dashboard'; document.head.append(link); } }
async function get(path) { const response = await fetch(`${API}${path}`, { headers: auth() }); const body = await readApiResponse(response); if (!response.ok) throw new Error(getApiErrorMessage(body, 'Unable to load this information.')); return body; }
function metricCard(label, value, note, icon, trend = false) {
  return `<article class="metric-card"><div class="metric-icon">${icon}</div><div><p>${label}</p><strong>${value}</strong><span>${note}${trend ? ' ↗' : ''}</span></div></article>`;
}
function mapUrl(query) { return `https://www.google.com/maps?q=${encodeURIComponent(query)}&z=12&output=embed`; }

async function showFullMapModal(properties = []) {
  // Load Leaflet libraries first
  try {
    await ensureLeafletLoaded();
  } catch (e) {
    console.error('Failed to load Leaflet:', e);
    alert('Could not load map library. Check browser console.');
    return;
  }
  
  await new Promise(resolve => setTimeout(resolve, 500));
  
  const mapHtml = `
    <div class="full-map-container">
      <div id="tenant-map" class="leaflet-map"></div>
      <p id="map-status"></p>
    </div>
  `;
  const modal = createModal({ title: 'Full Map & Heatmap', content: mapHtml, closeLabel: 'Close' });
  
  // Store map reference for cleanup
  let mapInstance = null;
  
  // Add cleanup handler - try multiple approaches for better compatibility
  const cleanupMap = () => {
    if (mapInstance) {
      try {
        mapInstance.remove();
        mapInstance = null;
        console.log('Map cleaned up');
      } catch (e) {
        console.log('Error cleaning up map:', e);
      }
    }
    // Remove modal from DOM after closing
    setTimeout(() => {
      if (modal && modal.parentElement) {
        modal.remove();
      }
    }, 100);
  };
  
  // Listen for both close event and transition end
  modal.addEventListener('close', cleanupMap);
  modal.addEventListener('mousedown', (e) => {
    // If clicking backdrop (on the dialog itself), also cleanup
    if (e.target === modal) {
      setTimeout(cleanupMap, 300);
    }
  });
  
  openModal(modal);
  
  // Wait for modal to render and initialize map
  setTimeout(async () => {
    try {
      const mapContainer = modal.querySelector('#tenant-map');
      const statusEl = modal.querySelector('#map-status');
      
      if (!mapContainer) {
        console.error('Map container not found in modal');
        if (statusEl) statusEl.textContent = 'Map container not found';
        return;
      }
      
      if (!window.L) {
        console.error('Leaflet library not available');
        if (statusEl) statusEl.textContent = 'Leaflet library not loaded';
        return;
      }
      
      console.log('Initializing Leaflet map...');
      if (statusEl) statusEl.textContent = 'Initializing map...';
      
      // Force dimensions
      mapContainer.style.width = '100%';
      mapContainer.style.height = '500px';
      mapContainer.style.display = 'block';
      
      // Initialize map
      mapInstance = window.L.map(mapContainer, { 
        attributionControl: true,
        zoomControl: true 
      }).setView([14.5995, 120.9842], 12);
      
      console.log('Map created, adding tile layer...');
      
      // Add tile layer
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
      }).addTo(mapInstance);
      
      // Add markers for properties
      let markerCount = 0;
      if (properties && properties.length > 0) {
        const markerCoords = [];
        
        properties.forEach(prop => {
          let lat = Number(prop.latitude ?? prop.lat ?? NaN);
          let lng = Number(prop.longitude ?? prop.lng ?? NaN);
          
          // If coordinates are missing, use default Manila coordinates with small offset
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            // Use default Manila location with random small offset for clustering
            const offset = (markerCount * 0.001);
            lat = 14.5995 + offset;
            lng = 120.9842 + offset;
          }
          
          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            const marker = window.L.marker([lat, lng]).addTo(mapInstance);
            const title = String(prop.title || 'Property');
            const rent = Number(prop.monthly_rent ?? 0).toLocaleString();
            marker.bindPopup(`<strong>${escape(title)}</strong><br>₱${rent}/mo`);
            markerCoords.push([lat, lng]);
            markerCount++;
          }
        });
        
        console.log(`Added ${markerCount} markers to map`);
        if (statusEl) statusEl.textContent = `Map loaded with ${markerCount} properties`;
        
        // Fit map to bounds if we have markers
        if (markerCoords.length > 1) {
          try {
            const bounds = window.L.latLngBounds(markerCoords);
            mapInstance.fitBounds(bounds.pad(0.1));
          } catch (e) {
            console.log('Could not fit bounds:', e);
          }
        }
      } else {
        if (statusEl) statusEl.textContent = 'No properties to display';
      }
      
      // Trigger map resize to ensure it displays properly
      setTimeout(() => {
        if (mapInstance) {
          mapInstance.invalidateSize();
          console.log('Map size invalidated');
        }
      }, 100);
      
    } catch (error) {
      console.error('Map initialization error:', error);
      const statusEl = modal.querySelector('#map-status');
      if (statusEl) statusEl.textContent = 'Error: ' + error.message;
      cleanupMap();
    }
  }, 300);
}

function generatePerformanceReportHtml(properties = [], bookings = [], metrics = {}) {
  const approved = bookings.filter((item) => item.status === 'approved');
  const pending = bookings.filter((item) => item.status === 'pending');
  const rejected = bookings.filter((item) => item.status === 'rejected');
  const activeProperties = properties.filter((item) => item.status === 'approved').length;
  const totalRevenue = approved.reduce((total, item) => total + Number(item.monthly_rent ?? 0), 0);
  const occupancyRate = metrics.occupancy ?? 0;
  const reportDate = new Date().toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' });

  return `
    <div class="report-container">
      <div class="report-header">
        <h2>Performance Report</h2>
        <p class="report-date">Generated on ${escape(reportDate)}</p>
      </div>
      <div class="report-section">
        <h3>📊 Key Metrics</h3>
        <div class="metrics-grid">
          <div class="metric-box">
            <span class="metric-label">Active Properties</span>
            <strong class="metric-value">${activeProperties}</strong>
          </div>
          <div class="metric-box">
            <span class="metric-label">Total Bookings</span>
            <strong class="metric-value">${bookings.length}</strong>
          </div>
          <div class="metric-box">
            <span class="metric-label">Occupancy Rate</span>
            <strong class="metric-value">${occupancyRate}%</strong>
          </div>
          <div class="metric-box">
            <span class="metric-label">Monthly Revenue</span>
            <strong class="metric-value">₱${totalRevenue.toLocaleString()}</strong>
          </div>
        </div>
      </div>
      <div class="report-section">
        <h3>✅ Booking Status</h3>
        <div class="status-breakdown">
          <div class="status-item">
            <span class="status-label">Approved</span>
            <strong>${approved.length}</strong>
          </div>
          <div class="status-item">
            <span class="status-label">Pending</span>
            <strong>${pending.length}</strong>
          </div>
          <div class="status-item">
            <span class="status-label">Rejected</span>
            <strong>${rejected.length}</strong>
          </div>
        </div>
      </div>
      <div class="report-section">
        <h3>🏠 Property Overview</h3>
        <div class="property-list">
          ${properties.slice(0, 5).map((prop) => {
            const status = prop.status === 'approved' ? '✓ Active' : `⏳ ${prop.status}`;
            const rent = Number(prop.monthly_rent ?? 0).toLocaleString();
            return `
              <div class="property-item">
                <div class="property-name">${escape(prop.title || 'Untitled')}</div>
                <div class="property-details">
                  <span>${escape(prop.barangay || 'Location')}</span>
                  <span>₱${rent}/mo</span>
                  <span class="status-badge">${status}</span>
                </div>
              </div>
            `;
          }).join('')}
          ${properties.length === 0 ? '<p class="empty">No properties to display</p>' : ''}
        </div>
      </div>
    </div>
  `;
}
export function renderDashboardOwner(root = document.querySelector('#app')) {
  if (!root) throw new Error('Owner dashboard requires #app.'); css(); ensureOwnerSidebarStyles(); const user = session();
  const profileName = user.name || 'Owner';
  const profileInitials = profileName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'O';
  const firstName = profileName.split(/\s+/).filter(Boolean)[0] || 'there';
  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? 'Good morning' : currentHour < 18 ? 'Good afternoon' : 'Good evening';
  root.innerHTML = `
    <div class="owner-shell owner-shell--dashboard">
      ${renderOwnerSidebar('dashboardOwner')}
      <div class="owner-main">
        <header class="owner-topbar">
          <div class="topbar-left">
            <button class="menu" aria-label="Toggle menu">☰</button>
          </div>
          <label class="search-bar" aria-label="Search my listings, inquiries, tenants">
            <span>⌕</span>
            <input type="search" placeholder="Search my listings, inquiries, tenants..." />
          </label>
          <div class="topbar-right">
            <div class="notification-menu">
              <button class="top-icon notification-trigger" type="button" aria-label="Notifications" aria-expanded="false">
                <span aria-hidden="true">&#128276;</span>
                <span class="notification-badge" hidden>0</span>
              </button>
              <div class="notification-dropdown" hidden>
                <div class="notification-dropdown-header"><strong>Notifications</strong><span>Recent updates</span></div>
                <div class="notification-list"><p class="notification-empty">No notifications yet.</p></div>
              </div>
            </div>
            ${renderOwnerProfileCard()}
          </div>
        </header>
        <main class="owner-dashboard">
          <section class="dashboard-greeting">
            <p class="eyebrow">OWNER OVERVIEW</p>
            <h1 data-dashboard-greeting>${greeting}, ${escape(firstName)}</h1>
            <p>Here's what's happening with your properties today.</p>
          </section>
          <section class="metrics-grid">
            <article class="metric-card metric-card--highlight">
              <div class="metric-icon">🏠</div>
              <div><p>Listings</p><strong data-metric="listings">0 Active</strong><span data-metric-note="listings">0 / 0 properties active</span></div>
            </article>
            <article class="metric-card">
              <div class="metric-icon">📣</div>
              <div><p>Inquiries</p><strong data-metric="inquiries">0 Total</strong><span data-metric-note="inquiries">No new inquiries</span></div>
            </article>
            <article class="metric-card">
              <div class="metric-icon">◔</div>
              <div><p>Occupancy Rate</p><strong data-metric="occupancy">0%</strong><span data-metric-note="occupancy">0 / 0 units occupied</span></div>
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
                <div class="pending-actions" data-pending-actions><p class="action-section-label">Pending Actions</p></div>
                <button class="action-button secondary">Generate Performance Report</button>
              </div>
            </aside>
          </section>
          <section class="panel attention-panel">
            <div class="panel-title-row"><h2>Needs Attention</h2><a href="#/owner/inquiries">View all</a></div>
            <div class="attention-list" data-attention-list></div>
          </section>
          <section class="interactions-grid">
            <article class="panel table-panel">
              <div class="panel-title-row"><h2>Inquiries Overview</h2><a href="#/owner/inquiries">View all</a></div>
              <div class="table-wrap"><table><thead><tr><th>Tenant Name</th><th>Property</th><th>Date</th><th>Status</th><th>Action</th></tr></thead><tbody></tbody></table></div>
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

  const notificationMenu = root.querySelector('.notification-menu');
  const notificationTrigger = root.querySelector('.notification-trigger');
  const notificationBadge = root.querySelector('.notification-badge');
  const notificationDropdown = root.querySelector('.notification-dropdown');
  const notificationList = root.querySelector('.notification-list');
  let notifications = [];

  const renderNotifications = () => {
    const unreadCount = notifications.filter((item) => !item.read_at).length;
    notificationBadge.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
    notificationBadge.hidden = unreadCount === 0;
    notificationList.innerHTML = notifications.length
      ? notifications.slice(0, 6).map((item) => `
          <button class="notification-item${item.read_at ? '' : ' is-unread'}" type="button" data-notification-id="${item.id}">
            <span class="notification-item-copy"><strong>${escape(item.title || 'Notification')}</strong><span>${escape(item.message || '')}</span></span>
            <time>${escape(formatNotificationDate(item.created_at))}</time>
          </button>`).join('')
      : '<p class="notification-empty">No notifications yet.</p>';
  };

  const loadNotifications = async () => {
    try {
      const response = await api.notifications.list();
      notifications = Array.isArray(response?.data) ? response.data : [];
      renderNotifications();
    } catch {
      notificationList.innerHTML = '<p class="notification-empty">Notifications unavailable.</p>';
    }
  };

  notificationTrigger.addEventListener('click', () => {
    const isOpen = !notificationDropdown.hidden;
    notificationDropdown.hidden = isOpen;
    notificationTrigger.setAttribute('aria-expanded', String(!isOpen));
  });
  notificationList.addEventListener('click', async (event) => {
    const item = event.target.closest('[data-notification-id]');
    if (!item) return;
    const notification = notifications.find((entry) => String(entry.id) === item.dataset.notificationId);
    if (!notification || notification.read_at) return;
    try {
      await markNotificationRead(notification.id);
      notification.read_at = new Date().toISOString();
      renderNotifications();
    } catch { /* Keep the item unread when the API request fails. */ }
  });
  document.addEventListener('click', (event) => {
    if (!notificationMenu.contains(event.target)) {
      notificationDropdown.hidden = true;
      notificationTrigger.setAttribute('aria-expanded', 'false');
    }
  });
  loadNotifications();
  const notificationPoll = setInterval(() => {
    if (!root.isConnected) return clearInterval(notificationPoll);
    loadNotifications();
  }, 15000);
  
  // Store report and map data for later use
  let reportData = { properties: [], bookings: [], metrics: { occupancy: 0 } };
  
  // Add event listener for View Full Map & Heatmap button
  root.querySelector('.panel-button').addEventListener('click', async () => {
    try {
      // Fetch properties if not already loaded
      let properties = reportData.properties;
      if (properties.length === 0) {
        const response = await get('/properties?limit=100').catch(() => ({ data: [] }));
        properties = (response.data ?? []).filter((item) => Number(item.owner_id) === Number(user.id));
      }
      await showFullMapModal(properties);
    } catch (error) {
      console.error('Map modal error:', error);
      showToast({ message: 'Could not open full map.', type: 'error' });
    }
  });
  
  // Add event listener for Generate Performance Report button
  root.querySelector('.action-button.secondary').addEventListener('click', () => {
    try {
      const reportHtml = generatePerformanceReportHtml(reportData.properties, reportData.bookings, reportData.metrics);
      const modal = createModal({ title: 'Performance Report', content: reportHtml, closeLabel: 'Close' });
      openModal(modal);
    } catch (error) {
      showToast({ message: 'Could not generate performance report.', type: 'error' });
    }
  });
  Promise.all([get('/properties?limit=100').catch(() => ({ data: [] })), get('/bookings').catch(() => ({ data: [] }))]).then(async ([properties, bookings]) => {
    const items = (properties.data ?? []).filter((item) => Number(item.owner_id) === Number(user.id));
    const listingGrid = root.querySelector('.listings-card-grid');
    const approvedListings = items.filter((item) => String(item.status).toLowerCase() === 'approved');
    const cards = items.slice(0, 3).map((item) => {
      const roomType = String(item.room_type || 'Property').replaceAll('_', ' ');
      const place = [item.barangay, item.municipality].filter(Boolean).join(', ') || 'Manila';
      const badge = item.status === 'approved' ? 'Active' : String(item.status || 'Available').replaceAll('_', ' ');
      let listingImages = item.images;
      if (typeof listingImages === 'string') {
        try { listingImages = JSON.parse(listingImages); } catch { listingImages = []; }
      }
      const image = resolveAvatarUrl(item.image_url || item.cover_image || (Array.isArray(listingImages) ? listingImages[0] : ''));
      return `
        <article class="listing-card">
          ${image ? `<img class="listing-card-image" src="${escape(image)}" alt="${escape(item.title || 'Property')}" />` : '<div class="listing-card-image listing-card-image--empty">No image</div>'}
          <div class="listing-topline"><span class="property-pill">${escape(badge)}</span><span class="property-rent">₱${Number(item.monthly_rent ?? 0).toLocaleString()}/mo</span></div>
          <h3>${escape(item.title || 'Untitled property')}</h3>
          <p class="listing-subtitle">${escape(place)} • ${escape(roomType)}</p>
          <div class="listing-actions"><button>Manage</button><button class="ghost">Edit Listing</button></div>
        </article>`;
    }).join('');
    listingGrid.innerHTML = cards || '<p class="empty">No property listings yet for this account.</p>';
    const requests = bookings.data.length ? bookings.data : [];
    const approved = requests.filter((item) => item.status === 'approved');
    const pendingRequests = requests.filter((item) => item.status === 'pending');
    const activeListings = approvedListings.length;
    const inquiryCount = requests.length;
    const totalUnits = approvedListings.reduce((total, item) => total + Math.max(0, Number(item.max_occupants ?? item.available_slots ?? 0)), 0);
    const occupiedUnits = approved.reduce((total, item) => total + Math.max(1, Number(item.occupants ?? 1)), 0);
    const occupancy = totalUnits ? Math.min(100, Math.round((occupiedUnits / totalUnits) * 100)) : 0;
    const projectedRevenue = approved.reduce((total, item) => total + Number(item.monthly_rent ?? 0), 0);
    
    // Update report data for the Generate Performance Report button
    reportData = { properties: items, bookings: requests, metrics: { occupancy } };
    
    root.querySelector('[data-metric="listings"]').textContent = `${activeListings} Active`;
    root.querySelector('[data-metric="inquiries"]').textContent = `${inquiryCount} Total`;
    root.querySelector('[data-metric="occupancy"]').textContent = `${occupancy}%`;
    root.querySelector('[data-metric-note="listings"]').textContent = `${activeListings} / ${items.length} properties active`;
    root.querySelector('[data-metric-note="inquiries"]').textContent = pendingRequests.length ? `${pendingRequests.length} new request${pendingRequests.length === 1 ? '' : 's'}` : 'No new inquiries';
    root.querySelector('[data-metric-note="occupancy"]').textContent = `${occupiedUnits} / ${totalUnits} units occupied`;
    root.querySelector('tbody').innerHTML = requests.slice(0, 5).map((item) => {
      const normalized = (item.status ?? 'Pending').toLowerCase().replace(/\s+/g, '-');
      const badgeClass = statusClass[normalized] ?? 'status-pending';
      return `
        <tr>
          <td>${escape(item.tenant_name ?? item.user_name ?? 'Tenant')}</td>
          <td>${escape(item.property_title ?? item.property_name ?? 'DormHive Listing')}</td>
          <td>${new Date(item.move_in_date ?? item.created_at ?? Date.now()).toLocaleDateString()}</td>
          <td><span class="status-tag ${badgeClass}">${escape(item.status ?? 'Pending')}</span></td>
          <td><a class="table-action" href="#/owner/inquiries">View</a></td>
        </tr>`;
    }).join('') || '<tr><td colspan="5">No inquiries yet.</td></tr>';

    const pendingListings = items.filter((item) => String(item.status).toLowerCase() === 'pending').length;
    root.querySelector('[data-pending-actions]').innerHTML = `
      <p class="action-section-label">Pending Actions</p>
      <a href="#/owner/inquiries" class="pending-action-row"><span>${pendingRequests.length} New ${pendingRequests.length === 1 ? 'inquiry' : 'inquiries'}</span><strong>View</strong></a>
      <a href="#/owner/inquiries" class="pending-action-row"><span>${pendingRequests.length} Pending ${pendingRequests.length === 1 ? 'booking' : 'bookings'}</span><strong>View</strong></a>
      <a href="#/owner/myListing" class="pending-action-row"><span>${pendingListings} Pending ${pendingListings === 1 ? 'listing' : 'listings'}</span><strong>View</strong></a>`;

    const attentionList = root.querySelector('[data-attention-list]');
    const attentionItems = pendingRequests.slice(0, 3).map((item) => `<a class="attention-item attention-item--warning" href="#/owner/inquiries"><span class="attention-icon">!</span><span><strong>New inquiry from ${escape(item.tenant_name ?? item.user_name ?? 'Tenant')}</strong><small>${escape(item.property_title ?? item.property_name ?? 'DormHive Listing')} · Respond to your tenant</small></span></a>`);
    attentionList.innerHTML = attentionItems.length
      ? attentionItems.join('')
      : `<div class="attention-item attention-item--success"><span class="attention-icon">✓</span><span><strong>All listings are active</strong><small>No pending owner actions right now.</small></span></div>`;
    
    // Initialize Leaflet map with the owner's properties (pixel-accurate markers)
    try {
      await ensureLeafletLoaded();
      await new Promise(resolve => setTimeout(resolve, 300)); // Wait for CSS to load
      
      const mapPanel = root.querySelector('.map-panel');
      if (mapPanel && items.length > 0 && window.L) {
        const mapContainer = mapPanel.querySelector('#tenant-map');
        if (mapContainer) {
          // Force dimensions
          mapContainer.style.width = '100%';
          mapContainer.style.height = '20rem';
          mapContainer.style.display = 'block';
          
          // Initialize map directly
          const map = window.L.map(mapContainer).setView([14.5995, 120.9842], 12);
          
          // Add tile layer
          window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap contributors'
          }).addTo(map);
          
          // Add markers
          const markers = [];
          let markerCount = 0;
          items.forEach((prop, index) => {
            let lat = Number(prop.latitude ?? prop.lat ?? NaN);
            let lng = Number(prop.longitude ?? prop.lng ?? NaN);
            
            // If coordinates are missing, use default Manila coordinates with small offset
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
              const offset = (markerCount * 0.001);
              lat = 14.5995 + offset;
              lng = 120.9842 + offset;
            }
            
            if (Number.isFinite(lat) && Number.isFinite(lng)) {
              const marker = window.L.marker([lat, lng]).addTo(map);
              const title = String(prop.title || 'Property');
              const rent = Number(prop.monthly_rent ?? 0).toLocaleString();
              marker.bindPopup(`<strong>${escape(title)}</strong><br>₱${rent}/mo`);
              markers.push([lat, lng]);
              markerCount++;
            }
          });
          
          // Fit bounds if we have markers
          if (markers.length > 1) {
            try {
              const featureGroup = window.L.featureGroup(markers.map(coords => window.L.marker(coords)));
              map.fitBounds(featureGroup.getBounds().pad(0.2));
            } catch (e) {
              console.log('Could not fit bounds:', e);
            }
          }
          
          // Trigger map resize
          setTimeout(() => {
            map.invalidateSize();
          }, 100);
        }
      }
    } catch (err) {
      // ignore map init errors but surface a console warning
      // eslint-disable-next-line no-console
      console.warn('Failed to initialize owner map', err);
    }
    await updateListingCountsInSidebar();
  }).catch((error) => {
    root.querySelector('.table-wrap').innerHTML = `<p class="status-message">${escape(error.message)}</p>`;
  });
}