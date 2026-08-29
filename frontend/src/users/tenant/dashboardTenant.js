import { renderMapPanelShell, initLeafletMap, updateLeafletMarkers } from '../../components/mapPanel.js';
import { ensureTenantSidebarStyles, renderTenantSidebar } from './sidebarTenant.js';
import { getUserAvatarUrl, refreshTenantUserSession } from './setting.js';
import { createModal, openModal } from '../../components/modal.js';
import { api as apiClient, getApiErrorMessage, readApiResponse } from '../../services/api.js';
import { markNotificationRead } from '../../services/notificationSystem.js';

const API_URL = window.DORMHIVE_API_URL ?? 'http://localhost:5000/api/v1';
const apiBase = API_URL.replace(/\/api\/v1\/?$/, '');
const DEFAULT_IMAGE_PLACEHOLDER = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 300"><rect width="500" height="300" fill="#ecf5ef"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#4a7160" font-family="Inter,Arial,sans-serif" font-size="28">No image available</text></svg>');
const resolveImageUrl = (value = '') => {
  const url = String(value || '').trim();
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  return `${apiBase}${url.startsWith('/') ? '' : '/'}${url}`;
};
const normalizePropertyImage = (property) => {
  const source = property.image_url || property.cover_image || (Array.isArray(property.images) && property.images[0]) || '';
  return resolveImageUrl(source);
};
const normalizePropertyImages = (property = {}) => {
  let uploadedImages = property.images;
  if (typeof uploadedImages === 'string') {
    try { uploadedImages = JSON.parse(uploadedImages); } catch { uploadedImages = []; }
  }
  if (!Array.isArray(uploadedImages)) uploadedImages = [];
  const images = (uploadedImages.length ? uploadedImages : [property.image_url, property.cover_image])
    .filter(Boolean)
    .map((image) => resolveImageUrl(image))
    .filter(Boolean);
  return [...new Set(images)];
};
const esc = (value = '') => {
  const node = document.createElement('span');
  node.textContent = value;
  return node.innerHTML;
};
function tenantFullName(user = {}) {
  const firstName = String(user.first_name ?? user.firstName ?? '').trim();
  const lastName = String(user.last_name ?? user.lastName ?? '').trim();
  const combined = [firstName, lastName].filter(Boolean).join(' ');
  return combined || String(user.name ?? 'Tenant').trim() || 'Tenant';
}
const money = (value = 0) => `PHP ${Number(value || 0).toLocaleString('en-PH')}`;
const glyph = { grid: '&#9638;', calendar: '&#9783;', gear: '&#9881;', menu: '&#9776;', search: '&#9906;', pin: '&#9679;', heart: '&#9825;', home: '&#8962;', walk: '&#10148;', target: '&#8857;', layers: '&#9638;', arrow: '&#8594;', wifi: '&#8976;', snow: '&#10052;', kitchen: '&#9832;', laundry: '&#8635;', car: '&#9670;' };
const icon = (name) => `<span class="icon">${glyph[name] ?? ''}</span>`;
const formatNotificationDate = (value) => new Date(value ?? Date.now()).toLocaleDateString([], { month: 'short', day: 'numeric' });

function loadStyle() {
  if (!document.querySelector('[data-tenant-style="dashboard"]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = new URL('./style/dashboardTenant.css', import.meta.url);
    link.dataset.tenantStyle = 'dashboard';
    document.head.append(link);
  }
  if (!document.querySelector('[data-tenant-style="dashboard-font"]')) {
    const style = document.createElement('style');
    style.dataset.tenantStyle = 'dashboard-font';
    style.textContent = '.dh-dashboard{font-family:Inter,ui-sans-serif,system-ui,sans-serif}.dh-dashboard .intro small,.dh-dashboard .intro h1,.dh-dashboard .intro p{color:#000}';
    document.head.append(style);
  }
  if (!document.querySelector('[data-tenant-style="amenities"]')) {
    const aLink = document.createElement('link');
    aLink.rel = 'stylesheet';
    aLink.href = new URL('./style/amenities.css', import.meta.url);
    aLink.dataset.tenantStyle = 'amenities';
    document.head.append(aLink);
  }
  if (!document.querySelector('[data-tenant-style="notifications"]')) {
    const style = document.createElement('style');
    style.dataset.tenantStyle = 'notifications';
    style.textContent = `
      .dh-dashboard .notification-menu { position: relative; }
      .dh-dashboard .notification-trigger { position: relative; display: grid; place-items: center; width: 37px; height: 37px; border: 0; border-radius: 8px; background: transparent; color: #3d554e; cursor: pointer; }
      .dh-dashboard .notification-trigger:hover { background: #eef6f3; }
      .dh-dashboard .notification-trigger > span:first-child { font-size: 1.25rem; line-height: 1; filter: grayscale(1) brightness(.35); }
      .dh-dashboard .notification-badge { position: absolute; top: 2px; right: 1px; min-width: 16px; height: 16px; display: grid; place-items: center; padding: 0 4px; border-radius: 999px; background: #ef4444; color: #fff; font-size: 10px; font-weight: 800; }
      .dh-dashboard .notification-dropdown { position: absolute; top: calc(100% + .65rem); right: 0; z-index: 30; width: min(21rem, calc(100vw - 2rem)); overflow: hidden; border: 1px solid #dce6e2; border-radius: .8rem; background: #fff; box-shadow: 0 12px 30px rgba(20, 70, 55, .14); }
      .dh-dashboard .notification-dropdown-header { display: flex; justify-content: space-between; gap: 1rem; padding: .85rem 1rem; border-bottom: 1px solid #dce6e2; }
      .dh-dashboard .notification-dropdown-header span, .dh-dashboard .notification-empty, .dh-dashboard .notification-item time { color: #6d8179; font-size: .75rem; }
      .dh-dashboard .notification-list { max-height: 20rem; overflow-y: auto; }
      .dh-dashboard .notification-item { display: flex; align-items: flex-start; justify-content: space-between; gap: .8rem; width: 100%; padding: .85rem 1rem; border: 0; border-bottom: 1px solid #edf2ef; background: #fff; color: #1f3530; text-align: left; cursor: pointer; }
      .dh-dashboard .notification-item:hover, .dh-dashboard .notification-item.is-unread { background: #f7fcf9; }
      .dh-dashboard .notification-item-copy { display: grid; gap: .25rem; min-width: 0; }
      .dh-dashboard .notification-item-copy span { overflow: hidden; color: #6a7c75; font-size: .78rem; line-height: 1.35; text-overflow: ellipsis; }
      .dh-dashboard .notification-empty { margin: 0; padding: 1.1rem 1rem; text-align: center; }
    `;
    document.head.append(style);
  }
  if (!document.querySelector('[data-tenant-style="listing-carousel"]')) {
    const style = document.createElement('style');
    style.dataset.tenantStyle = 'listing-carousel';
    style.textContent = `
      .dh-dashboard .listing .photo { position: relative; }
      .dh-dashboard .listing .listing-photo { cursor: zoom-in; }
      .photo-only-modal { width: min(92vw, 1000px); max-height: 92vh; padding: 0; overflow: hidden; background: transparent; }
      .photo-only-modal .ui-modal__header, .photo-only-modal .ui-modal__footer { display: none; }
      .photo-only-modal .ui-modal__body { position: relative; display: grid; place-items: center; padding: 0; background: transparent; }
      .photo-only-modal .listing-photo-viewer { display: block; width: 100%; max-height: 92vh; object-fit: contain; border-radius: .65rem; }
      .photo-only-modal .photo-viewer-arrow { position: absolute; top: 50%; z-index: 1; width: 2.5rem; height: 2.5rem; padding: 0; border: 0; border-radius: 50%; background: rgba(255,255,255,.9); color: #39574e; font-size: 1.7rem; line-height: 1; cursor: pointer; transform: translateY(-50%); }
      .photo-only-modal .photo-viewer-arrow:hover { background: #fff; }
      .photo-only-modal .photo-viewer-previous { left: .75rem; }
      .photo-only-modal .photo-viewer-next { right: .75rem; }
      .dh-dashboard .listing-carousel-dots { position: absolute; right: 0; bottom: .65rem; left: 0; z-index: 2; display: flex; justify-content: center; gap: .35rem; }
      .dh-dashboard .listing-carousel-dots .listing-carousel-dot { position: static; top: auto; right: auto; width: .45rem; height: .45rem; padding: 0; border: 1px solid rgba(255,255,255,.95); border-radius: 50%; background: rgba(255,255,255,.7); box-shadow: 0 1px 3px rgba(0,0,0,.35); cursor: pointer; }
      .dh-dashboard .listing-carousel-dot.is-active { background: #b48421; transform: scale(1.2); }
    `;
    document.head.append(style);
  }
  // Add CSS for full-map-container modal
  if (!document.querySelector('style[data-tenant-modal-css]')) {
    const style = document.createElement('style');
    style.dataset.tenantModalCss = '1';
    style.textContent = `
      .full-map-container {
        width: 100%;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        min-height: 0;
      }
      .full-map-container .leaflet-map {
        width: 100% !important;
        height: 500px !important;
        min-height: 500px !important;
        border-radius: 0.8rem;
        border: 1px solid #dce7e2;
        box-sizing: border-box !important;
        display: block !important;
      }
      #nearby-map-status {
        margin: 0;
        padding: 0.5rem;
        font-size: 0.85rem;
        color: #6d8179;
        text-align: center;
      }
      .ui-modal:has(.full-map-container) {
        position: fixed;
        inset: 0;
        margin: auto;
        width: min(95vw, 900px);
        max-height: 90vh;
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }
      .ui-modal:has(.full-map-container) .ui-modal__header {
        flex-shrink: 0;
      }
      .ui-modal:has(.full-map-container) .ui-modal__body {
        overflow: visible;
        padding: 0.8rem;
        max-height: calc(90vh - 110px);
        flex: 1;
        min-height: 500px;
      }
      .ui-modal:has(.full-map-container) .ui-modal__footer {
        flex-shrink: 0;
      }
    `;
    document.head.append(style);
  }
}

function session() {
  try {
    return JSON.parse(localStorage.getItem('dormhive.user')) ?? {};
  } catch {
    return {};
  }
}

async function api(path) {
  const token = localStorage.getItem('dormhive.accessToken') ?? '';
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_URL}${path}`, { headers });
  const body = await readApiResponse(response);
  if (!response.ok) throw new Error(getApiErrorMessage(body, 'Unable to load listings.'));
  return body;
}

function normalizeRoomType(value = '') {
  const roomType = String(value ?? '').trim().toLowerCase();
  const typeMap = {
    private_room: 'Solo Room',
    entire_unit: 'Studio Unit',
    bedspace: 'Bed Space',
    bed_space: 'Bed Space',
    shared_room: 'Bed Space'
  };
  return typeMap[roomType] ?? roomType.replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeGenderPreference(value = '') {
  const gender = String(value ?? '').trim().toLowerCase();
  if (!gender) return 'Co-ed';
  const labels = {
    male: 'Male',
    female: 'Female',
    'co-ed': 'Co-ed',
    'coed': 'Co-ed',
    coed: 'Co-ed'
  };
  return labels[gender] ?? gender.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

const AMENITY_LABELS = {
  wifi: 'Wi-Fi',
  laundry: 'Laundry',
  kitchen: 'Kitchen',
  aircon: 'Aircon',
  pets_allowed: 'Pets allowed',
  dishwasher: 'Dishwasher',
  balcony: 'Balcony',
  parking: 'Parking',
  utilities_included: 'Utilities included',
  cable_ready: 'Cable ready'
};

function normalizeAmenities(item = {}) {
  const raw = item.amenities;
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((value) => String(value).toLowerCase());
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map((value) => String(value).toLowerCase());
  } catch {}
  return String(raw).split(',').map((value) => value.trim().toLowerCase()).filter(Boolean);
}

function renderAmenitiesChips(item = {}) {
  return normalizeAmenities(item)
    .slice(0, 4)
    .map((amenity) => `<span class="amenity-chip">${esc(AMENITY_LABELS[amenity] ?? amenity.replace(/_/g, ' '))}</span>`)
    .join('');
}

function propertyDetailsMarkup(property) {
  const address = [property.address, property.barangay, property.municipality].filter(Boolean).join(', ');
  const amenities = normalizeAmenities(property);
  const maxOccupants = Number(property.max_occupants);
  const images = normalizePropertyImages(property);
  const galleryImages = images.length ? images : [DEFAULT_IMAGE_PLACEHOLDER];
  const galleryDots = galleryImages.length > 1 ? `<div class="property-detail-gallery-dots" role="tablist" aria-label="Property photos">${galleryImages.map((_, index) => `<button type="button" class="property-detail-gallery-dot${index === 0 ? ' is-active' : ''}" data-gallery-index="${index}" role="tab" aria-label="View photo ${index + 1}" aria-selected="${index === 0}"></button>`).join('')}</div>` : '';
  return `
    <div class="property-detail-modal-content">
      <div class="property-detail-gallery" data-gallery-images='${esc(JSON.stringify(galleryImages))}'>
        <img class="property-detail-modal-image" src="${esc(galleryImages[0])}" alt="${esc(property.title || 'Property')} photo 1" />
        ${galleryDots}
      </div>
      <div class="property-detail-modal-info">
        <div class="property-detail-modal-heading">
          <h3>${esc(property.title || 'Property')}</h3>
          <strong>${money(property.monthly_rent)} / month</strong>
        </div>
        <div class="property-detail-modal-grid">
          <p><span>Location</span><strong>${esc(address || 'Not specified')}</strong></p>
          <p><span>Room type</span><strong>${esc(normalizeRoomType(property.room_type) || 'Not specified')}</strong></p>
          <p><span>Occupancy</span><strong>${esc(maxOccupants ? `Up to ${maxOccupants} tenant${maxOccupants === 1 ? '' : 's'}` : 'Not specified')}</strong></p>
          <p><span>Available slots</span><strong>${esc(property.available_slots ?? 'Not specified')}</strong></p>
          <p><span>Gender preference</span><strong>${esc(normalizeGenderPreference(property.gender_preference) || 'Not specified')}</strong></p>
          <p><span>Owner</span><strong>${esc(property.owner_name || 'Not specified')}</strong></p>
        </div>
        <p class="property-detail-modal-description">${esc(property.description || 'No description provided.')}</p>
        <p class="property-detail-modal-amenities"><span>Amenities</span><strong>${esc(amenities.length ? amenities.map((item) => AMENITY_LABELS[item] ?? item.replace(/_/g, ' ')).join(', ') : 'None listed')}</strong></p>
      </div>
    </div>
    <form class="dashboard-request-form">
      <div class="dashboard-request-fields">
        <label>Move-in Date<input type="date" name="moveInDate" required /></label>
        <label>Move-out Date<input type="date" name="moveOutDate" /></label>
        <label>Occupants<input type="number" name="occupants" min="1" value="1" required /></label>
        <button type="button" class="dashboard-chat-owner">💬 Chat Owner</button>
        <button type="submit" class="dashboard-send-request">📨 Send Request</button>
      </div>
      <p class="dashboard-request-status" role="status"></p>
    </form>
  `;
}

function locationText(item) {
  return [item.barangay, item.municipality, item.address].filter(Boolean).join(', ') || 'Manila';
}

function loadPropertyDetailsStyle() {
  if (document.querySelector('[data-tenant-style="property-details"]')) return;
  const style = document.createElement('style');
  style.dataset.tenantStyle = 'property-details';
  style.textContent = `
    .ui-modal:has(.property-detail-modal-content) { position: fixed; inset: 0; margin: auto; width: min(94vw, 920px); max-height: calc(100vh - 2rem); }
    .property-detail-modal-content { display: grid; grid-template-columns: minmax(220px, 38%) 1fr; gap: 1.25rem; }
    .property-detail-gallery { position: relative; align-self: start; width: 100%; height: 230px; min-width: 0; touch-action: pan-y; }
    .property-detail-modal-image { display: block; width: 100%; height: 230px; object-fit: cover; border-radius: .65rem; }
    .property-detail-gallery-dots { position: absolute; right: 0; bottom: .65rem; left: 0; display: flex; justify-content: center; gap: .35rem; }
    .property-detail-gallery-dot { width: .45rem; height: .45rem; padding: 0; border: 1px solid rgba(255,255,255,.9); border-radius: 50%; background: rgba(255,255,255,.65); box-shadow: 0 1px 3px rgba(0,0,0,.35); cursor: pointer; }
    .property-detail-gallery-dot.is-active { background: #b48421; transform: scale(1.2); }
    .property-detail-modal-heading { display: flex; justify-content: space-between; align-items: baseline; gap: .75rem; }
    .property-detail-modal-heading h3 { margin: 0; font-size: 1.35rem; }
    .property-detail-modal-heading strong { color: #9a6a24; white-space: nowrap; }
    .property-detail-modal-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .65rem 1rem; margin-top: .9rem; }
    .property-detail-modal-grid p, .property-detail-modal-amenities { display: grid; gap: .1rem; margin: 0; }
    .property-detail-modal-grid span, .property-detail-modal-amenities span { color: #847871; font-size: .7rem; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; }
    .property-detail-modal-description { margin: .9rem 0 .55rem; }
    .dashboard-request-form { margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #e6d6b6; }
    .dashboard-request-fields { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)) auto auto; gap: .65rem; align-items: end; }
    .dashboard-request-fields label { display: grid; gap: .3rem; color: #443d39; font-size: .8rem; font-weight: 700; }
    .dashboard-request-fields input { width: 100%; height: 42px; padding: 0 .65rem; border: 1px solid #d8d0c9; border-radius: .55rem; font: inherit; }
    .dashboard-request-fields button { height: 42px; padding: 0 .8rem; border: 0; border-radius: .55rem; background: #b48421; color: #fff; font-weight: 700; cursor: pointer; white-space: nowrap; }
    .dashboard-request-status { min-height: 1.2rem; margin: .55rem 0 0; color: #7b4b2d; font-size: .82rem; }
    @media (max-width: 700px) { .property-detail-modal-content, .dashboard-request-fields { grid-template-columns: 1fr; } .property-detail-gallery { height: 180px; } .property-detail-modal-image { height: 180px; } }
  `;
  document.head.append(style);
}

function mapQueryFor(item) {
  return [item.address, item.barangay, item.municipality, 'Manila, Philippines'].filter(Boolean).join(', ');
}

function listingCard(item, index) {
  const place = esc(locationText(item));
  const roomType = esc(normalizeRoomType(item.room_type));
  const maxOccupants = Number(item.max_occupants || 1);
  const badge = item.status === 'approved' ? 'Verified' : (item.status || 'Active');
  const walkDistance = (0.6 + index * 0.25).toFixed(1);
  const image = normalizePropertyImage(item);
  const photoMarkup = `<img src="${esc(image || DEFAULT_IMAGE_PLACEHOLDER)}" alt="${esc(item.title || 'Listing photo')}" class="listing-photo" /><em>${esc(badge)}</em><button aria-label="Save listing">${icon('heart')}</button>`;

  return `
    <article class="listing" data-id="${item.id}">
      <div class="photo p${index % 4}">${photoMarkup}</div>
      <div class="listing-body">
        <p class="place">${icon('pin')}${place}</p>
        <h3>${esc(item.title || 'Available dorm space')}</h3>
        <p class="meta">${roomType} &bull; Up to ${maxOccupants} tenants</p>
        <div class="amenity-summary">${renderAmenitiesChips(item) || '<span class="empty-amenity">No amenities listed</span>'}</div>
        <div class="price"><strong>${money(item.monthly_rent)}</strong><small>/ month</small><span>${icon('walk')}${walkDistance} km</span></div>
        <div class="listing-actions">
          <button class="focus" data-id="${item.id}">View map</button>
          <button type="button" class="action-btn view-details" data-id="${item.id}">View Details</button>
          <a href="#/tenant/message?propertyId=${item.id}" class="action-btn secondary">Chat</a>
        </div>
      </div>
    </article>
  `;
}

function syncTenantProfileUi(root, user = {}) {
  const nextUser = user && Object.keys(user).length ? user : JSON.parse(localStorage.getItem('dormhive.user') ?? '{}');
  const avatarEl = root.querySelector('.profile-avatar');
  const nameEl = root.querySelector('.profile-name');
  if (!avatarEl || !nameEl) return;

  const fullName = tenantFullName(nextUser);
  const avatarUrl = nextUser.avatar_url ? getUserAvatarUrl(nextUser, fullName) : '';
  avatarEl.innerHTML = avatarUrl ? `<img src="${esc(avatarUrl)}" alt="${esc(fullName)} avatar" />` : `<b>${esc((fullName || 'T').split(' ').map((part) => part[0]).join('').slice(0,2).toUpperCase() || 'T')}</b>`;
  nameEl.textContent = fullName;
}

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

// Show full-screen map modal with nearby listings
async function showNearbyListingsModal(properties = []) {
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
      <div id="tenant-nearby-map" class="leaflet-map"></div>
      <p id="nearby-map-status"></p>
    </div>
  `;
  const modal = createModal({ title: 'Nearby Verified Listings', content: mapHtml, closeLabel: 'Close' });
  
  // Store map reference for cleanup
  let mapInstance = null;
  
  // Add cleanup handler
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
  
  // Listen for close event and backdrop clicks
  modal.addEventListener('close', cleanupMap);
  modal.addEventListener('mousedown', (e) => {
    if (e.target === modal) {
      setTimeout(cleanupMap, 300);
    }
  });
  
  openModal(modal);
  
  // Wait for modal to render and initialize map
  setTimeout(async () => {
    try {
      const mapContainer = modal.querySelector('#tenant-nearby-map');
      const statusEl = modal.querySelector('#nearby-map-status');
      
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
      
      console.log('Initializing Leaflet map for nearby listings...');
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
            lat = 14.5995 + (markerCount * 0.001);
            lng = 120.9842 + (markerCount * 0.001);
          }
          
          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            markerCoords.push([lat, lng]);
            const title = esc(prop.title || 'Property');
            const rent = esc(`₱${Number(prop.monthly_rent ?? 0).toLocaleString()}`);
            const location = esc([prop.barangay, prop.municipality].filter(Boolean).join(', ') || 'Manila');
            
            window.L.marker([lat, lng]).addTo(mapInstance)
              .bindPopup(`<strong>${title}</strong><br>${location}<br>${rent}/mo`);
            markerCount++;
          }
        });
        
        console.log(`Added ${markerCount} markers to map`);
        if (statusEl) statusEl.textContent = `Map loaded with ${markerCount} nearby verified listings`;
        
        // Fit map to bounds if we have markers
        if (markerCoords.length > 1) {
          try {
            const bounds = window.L.latLngBounds(markerCoords);
            mapInstance.fitBounds(bounds, { padding: [50, 50] });
          } catch (e) {
            console.log('Error fitting bounds:', e);
          }
        }
      } else {
        if (statusEl) statusEl.textContent = 'No verified listings to display';
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
      const statusEl = modal.querySelector('#nearby-map-status');
      if (statusEl) statusEl.textContent = 'Error: ' + error.message;
      cleanupMap();
    }
  }, 300);
}

export async function renderDashboardTenant(root = document.querySelector('#app')) {
  if (!root) throw new Error('Tenant dashboard requires #app.');
  loadStyle();
  loadPropertyDetailsStyle();
  ensureTenantSidebarStyles();

  const user = await refreshTenantUserSession();
  const displayName = tenantFullName(user);
  root.innerHTML = `
    <div class="dh-app dh-dashboard">
      ${renderTenantSidebar('dashboardTenant')}
      <main>
        <header class="topbar">
          <button class="hamburger" type="button">${icon('menu')}</button>
          <a class="mobile-brand" href="#/tenant/dashboardTenant">DormHive</a>
          <label class="search" aria-label="Search by location, university, or landmark...">
            ${icon('search')}
            <input id="search" type="search" placeholder="Search by location, university, or landmark...">
          </label>
          <div class="top-actions">
            <div class="notification-menu">
              <button class="notification-trigger" type="button" aria-label="Notifications" aria-expanded="false">
                <span aria-hidden="true">&#128276;</span>
                <span class="notification-badge" hidden>0</span>
              </button>
              <div class="notification-dropdown" hidden>
                <div class="notification-dropdown-header"><strong>Notifications</strong><span>Recent updates</span></div>
                <div class="notification-list"><p class="notification-empty">No notifications yet.</p></div>
              </div>
            </div>
            <a class="profile" href="#/tenant/setting">
              <span class="profile-avatar">${user.avatar_url ? `<img src="${esc(getUserAvatarUrl(user, displayName))}" alt="${esc(displayName)} avatar" />` : `<b>${esc((displayName || 'T').split(' ').map((part) => part[0]).join('').slice(0,2).toUpperCase() || 'T')}</b>`}</span>
              <span class="profile-name">${esc(displayName)}</span>
            </a>
          </div>
        </header>

        <section class="intro">
          <div>
            <small>FIND YOUR NEXT HOME</small>
            <h1>Discover places near campus.</h1>
            <p>Explore approved dorms and apartments that fit your lifestyle.</p>
          </div>
          <button class="near" type="button">${icon('target')} Nearby verified listings</button>
        </section>

        <section class="layout">
          <div class="map-column">
            <div class="map-stack">
              ${renderMapPanelShell({
                title: 'Campus map overview',
                buttonLabel: 'View nearby listings',
                statusText: 'Loading real listings from the database...',
                query: 'DLSU, Manila, Philippines'
              })}
            </div>

            <section class="featured">
              <div class="section-title">
                <h2>Featured Listings</h2>
              </div>
              <div class="cards" id="featured-cards"></div>
            </section>
          </div>

          <aside class="filters">
            <div class="filter-title">
              <h2>Filters</h2>
              <button id="clear" type="button">Clear all</button>
            </div>

            <fieldset>
              <legend>Price range</legend>
              <input id="range" type="range" min="3000" max="15000" step="500" value="15000">
              <div class="price-input">
                <label>Min<input id="min-price" value="3000" readonly></label>
                <span>to</span>
                <label>Max<input id="max-price" value="15000"></label>
              </div>
              <p id="range-note">PHP 3,000 to PHP 15,000+</p>
            </fieldset>

            <fieldset>
              <legend>Room type</legend>
              <label><input type="checkbox" name="room" value="private_room"> Solo Room</label>
              <label><input type="checkbox" name="room" value="entire_unit"> Studio Unit</label>
              <label><input type="checkbox" name="room" value="bedspace"> Bed Space</label>
            </fieldset>

            <fieldset>
              <legend>Gender preference</legend>
              <div class="chips">
                <label><input type="checkbox" name="gender" value="male"> Male</label>
                <label><input type="checkbox" name="gender" value="female"> Female</label>
                <label><input type="checkbox" name="gender" value="co-ed"> Co-Ed</label>
              </div>
            </fieldset>

            <fieldset>
              <legend>Amenities</legend>
              <div class="amenities">
                <label><input type="checkbox" name="amenity" value="wifi"> Wi-Fi</label>
                <label><input type="checkbox" name="amenity" value="laundry"> Laundry</label>
                <label><input type="checkbox" name="amenity" value="kitchen"> Kitchen</label>
                <label><input type="checkbox" name="amenity" value="aircon">  Aircon</label>
                <label><input type="checkbox" name="amenity" value="pets_allowed"> Pets allowed</label>
                <label><input type="checkbox" name="amenity" value="dishwasher"> Dishwasher</label>
                <label><input type="checkbox" name="amenity" value="balcony"> Balcony</label>
                <label><input type="checkbox" name="amenity" value="parking"> Parking</label>
                <label><input type="checkbox" name="amenity" value="utilities_included"> Utilities included</label>
                <label><input type="checkbox" name="amenity" value="cable_ready"> Cable ready</label>
              </div>
            </fieldset>

            <button class="apply" type="button" id="apply-filters">Apply Filters</button>
          </aside>
        </section>
      </main>
    </div>
  `;

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
            <span class="notification-item-copy"><strong>${esc(item.title || 'Notification')}</strong><span>${esc(item.message || '')}</span></span>
            <time>${esc(formatNotificationDate(item.created_at))}</time>
          </button>`).join('')
      : '<p class="notification-empty">No notifications yet.</p>';
  };

  const loadNotifications = async () => {
    try {
      const response = await apiClient.notifications.list();
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

  const state = { all: [] };
  const search = root.querySelector('#search');
  const maxPrice = root.querySelector('#max-price');
  const range = root.querySelector('#range');
  const rangeNote = root.querySelector('#range-note');
  const cards = root.querySelector('#featured-cards');
  const clearButton = root.querySelector('#clear');
  const applyButton = root.querySelector('#apply-filters');
  const mapStatus = root.querySelector('#map-status');
  const mapFrame = root.querySelector('#tenant-map');
  const renderSkeletonState = () => {
    if (!cards) return;
    const skeleton = document.createElement('div');
    skeleton.className = 'dh-dashboard-skeleton';
    skeleton.innerHTML = `
      <div class="dh-dashboard-skeleton-card">
        <span class="ui-skeleton-line" style="width:38%;height:0.8rem"></span>
        <span class="ui-skeleton-line" style="width:100%;height:10.5rem"></span>
        <span class="ui-skeleton-line" style="width:100%;height:0.8rem"></span>
        <span class="ui-skeleton-line" style="width:70%;height:0.8rem"></span>
      </div>
      <div class="dh-dashboard-skeleton-card">
        <span class="ui-skeleton-line" style="width:38%;height:0.8rem"></span>
        <span class="ui-skeleton-line" style="width:100%;height:10.5rem"></span>
        <span class="ui-skeleton-line" style="width:100%;height:0.8rem"></span>
        <span class="ui-skeleton-line" style="width:70%;height:0.8rem"></span>
      </div>
    `;
    cards.innerHTML = '';
    cards.appendChild(skeleton);
    if (mapStatus) mapStatus.textContent = 'Loading nearby listings...';
  };

  const updateRangeNote = () => {
    maxPrice.value = String(range.value || 15000);
    rangeNote.textContent = `PHP 3,000 to PHP ${Number(range.value || 15000).toLocaleString('en-PH')}+`;
  };

  const handleUserRefresh = async () => {
    const latestUser = await refreshTenantUserSession();
    syncTenantProfileUi(root, latestUser);
  };
  window.addEventListener('dormhive-user-updated', handleUserRefresh);

  const syncMapLocation = (items = []) => {
    if (!mapFrame) return;
    const focusItem = items.find((item) => item.municipality || item.barangay || item.address) ?? state.all[0];
    const safeQuery = focusItem ? mapQueryFor(focusItem) : 'Manila, Philippines';
    mapFrame.src = `https://www.google.com/maps?q=${encodeURIComponent(safeQuery)}&z=12&output=embed`;

    const nearButton = root.querySelector('.near');
    if (nearButton && focusItem?.municipality) {
      nearButton.innerHTML = `${icon('target')} Nearby verified listings in ${esc(focusItem.municipality)}`;
    }
  };

  const selectedRoomFilters = () => Array.from(root.querySelectorAll('input[name="room"]:checked')).map((input) => input.value.toLowerCase());
  const selectedGenderFilters = () => Array.from(root.querySelectorAll('input[name="gender"]:checked')).map((input) => input.value.toLowerCase());
  const selectedAmenityFilters = () => Array.from(root.querySelectorAll('input[name="amenity"]:checked')).map((input) => input.value.toLowerCase());

  const openPropertyDetails = async (listing) => {
    let property = listing;
    try {
      const response = await api(`/properties/${encodeURIComponent(listing.id)}`);
      property = response.data || listing;
    } catch (error) {
      console.warn('Unable to refresh property details:', error);
    }

    const modal = createModal({ title: property.title || 'Property Details', content: '', closeLabel: 'Close' });
    modal.querySelector('.ui-modal__body').innerHTML = propertyDetailsMarkup(property);
    const gallery = modal.querySelector('.property-detail-gallery');
    if (gallery) {
      const galleryImage = gallery.querySelector('.property-detail-modal-image');
      const galleryDots = Array.from(gallery.querySelectorAll('.property-detail-gallery-dot'));
      let galleryImages = [];
      try { galleryImages = JSON.parse(gallery.dataset.galleryImages || '[]'); } catch {}
      let galleryIndex = 0;
      const showGalleryImage = (nextIndex) => {
        if (!galleryImages.length) return;
        galleryIndex = (nextIndex + galleryImages.length) % galleryImages.length;
        galleryImage.src = galleryImages[galleryIndex];
        galleryImage.alt = `${property.title || 'Property'} photo ${galleryIndex + 1}`;
        galleryDots.forEach((dot, index) => {
          const isActive = index === galleryIndex;
          dot.classList.toggle('is-active', isActive);
          dot.setAttribute('aria-selected', String(isActive));
        });
      };
      galleryDots.forEach((dot) => dot.addEventListener('click', () => showGalleryImage(Number(dot.dataset.galleryIndex))));
      let swipeStartX = null;
      gallery.addEventListener('pointerdown', (event) => { swipeStartX = event.clientX; });
      gallery.addEventListener('pointerup', (event) => {
        if (swipeStartX === null || Math.abs(event.clientX - swipeStartX) < 35) {
          swipeStartX = null;
          return;
        }
        showGalleryImage(galleryIndex + (event.clientX < swipeStartX ? 1 : -1));
        swipeStartX = null;
      });
      gallery.addEventListener('pointercancel', () => { swipeStartX = null; });
    }
    const form = modal.querySelector('.dashboard-request-form');
    const status = modal.querySelector('.dashboard-request-status');
    const moveIn = form.querySelector('[name="moveInDate"]');
    const moveOut = form.querySelector('[name="moveOutDate"]');
    moveIn.min = new Date().toISOString().split('T')[0];
    moveIn.addEventListener('change', () => { moveOut.min = moveIn.value; });
    modal.querySelector('.dashboard-chat-owner').addEventListener('click', () => {
      if (modal.open) modal.close();
      modal.remove();
      location.hash = `#/tenant/message?propertyId=${encodeURIComponent(property.id)}`;
    });
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      if (moveOut.value && moveIn.value && moveOut.value < moveIn.value) {
        status.textContent = 'Move-out date must be on or after the move-in date.';
        return;
      }
      const formData = new FormData(form);
      try {
        const response = await fetch(`${API_URL}/bookings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('dormhive.accessToken') ?? ''}` },
          body: JSON.stringify({ propertyId: Number(property.id), moveInDate: formData.get('moveInDate'), moveOutDate: formData.get('moveOutDate') || null, occupants: Number(formData.get('occupants') || 1), message: '' })
        });
        const body = await readApiResponse(response);
        if (!response.ok) throw new Error(getApiErrorMessage(body, 'Unable to submit booking request.'));
        status.textContent = 'Booking request sent successfully.';
        form.reset();
      } catch (error) {
        status.textContent = error.message;
      }
    });
    openModal(modal);
  };

  const renderFeaturedCards = (items = []) => {
    if (!cards) return;
    if (!items.length) {
      cards.innerHTML = '<div class="empty">No approved listings match the current filters.</div>';
      return;
    }

    cards.innerHTML = items.map((item, index) => {
      const location = locationText(item);
      const roomType = normalizeRoomType(item.room_type);
      const gender = normalizeGenderPreference(item.gender_preference);
      const maxOccupants = Number(item.max_occupants || 1);
      const images = normalizePropertyImages(item);
      const galleryImages = images.length ? images : [DEFAULT_IMAGE_PLACEHOLDER];
      const walkDistance = (0.6 + index * 0.25).toFixed(1);
      const amenitySummary = renderAmenitiesChips(item) || '<span class="empty-amenity">No amenities listed</span>';
      const dots = galleryImages.length > 1
        ? `<div class="listing-carousel-dots" role="tablist" aria-label="Photos for ${esc(item.title || 'listing')}">${galleryImages.map((_, photoIndex) => `<button type="button" class="listing-carousel-dot${photoIndex === 0 ? ' is-active' : ''}" data-carousel-index="${photoIndex}" role="tab" aria-label="View photo ${photoIndex + 1}" aria-selected="${photoIndex === 0}"></button>`).join('')}</div>`
        : '';

      return `
        <article class="listing" data-id="${item.id}">
          <div class="photo p${index % 4}">
            <img src="${esc(galleryImages[0])}" alt="${esc(item.title || 'Listing photo')}" class="listing-photo" />
            <em>${esc(item.status === 'approved' ? 'Verified' : (item.status || 'Approved'))}</em>
            <button aria-label="Save listing">${icon('heart')}</button>
            ${dots}
          </div>
          <div class="listing-body">
            <p class="place">${icon('pin')}${esc(location)}</p>
            <h3>${esc(item.title || 'Available dorm space')}</h3>
            <p class="meta">${esc(roomType)} &bull; Up to ${maxOccupants} tenants</p>
            <p class="meta"><strong>Gender:</strong> ${esc(gender)}</p>
            <div class="amenity-summary">${amenitySummary}</div>
            <div class="price"><strong>${money(item.monthly_rent)}</strong><small>/ month</small><span>${icon('walk')}${walkDistance} km</span></div>
            <div class="listing-actions">
              <button type="button" class="action-btn view-details" data-id="${item.id}">View Details</button>
            </div>
          </div>
        </article>
      `;
    }).join('');

    cards.querySelectorAll('.listing-carousel-dots').forEach((dotsElement) => {
      const gallery = dotsElement.closest('.photo');
      const item = items.find((entry) => String(entry.id) === String(gallery.closest('.listing').dataset.id));
      const images = normalizePropertyImages(item);
      const galleryImages = images.length ? images : [DEFAULT_IMAGE_PLACEHOLDER];
      const imageElement = gallery.querySelector('.listing-photo');
      const dotButtons = Array.from(dotsElement.querySelectorAll('.listing-carousel-dot'));
      let activeIndex = 0;
      const showImage = (nextIndex) => {
        activeIndex = (nextIndex + galleryImages.length) % galleryImages.length;
        imageElement.src = galleryImages[activeIndex];
        imageElement.alt = `${item.title || 'Listing photo'} photo ${activeIndex + 1}`;
        dotButtons.forEach((dot, dotIndex) => {
          const isActive = dotIndex === activeIndex;
          dot.classList.toggle('is-active', isActive);
          dot.setAttribute('aria-selected', String(isActive));
        });
      };
      dotButtons.forEach((dot) => dot.addEventListener('click', (event) => {
        event.stopPropagation();
        showImage(Number(dot.dataset.carouselIndex));
      }));
    });

    cards.querySelectorAll('.listing-photo').forEach((imageElement) => {
      const openPhotoViewer = () => {
        const property = state.all.find((item) => String(item.id) === String(imageElement.closest('.listing').dataset.id));
        if (!property) return;
        const clickedImage = imageElement.currentSrc || imageElement.src;
        const galleryImages = normalizePropertyImages(property).length
          ? normalizePropertyImages(property)
          : [clickedImage];
        const startingIndex = Math.max(0, galleryImages.findIndex((image) => image === clickedImage));
        const viewer = createModal({
          title: property.title || 'Property Photo',
          content: `<img class="listing-photo-viewer" src="${esc(clickedImage)}" alt="${esc(property.title || 'Property')} photo ${startingIndex + 1}" />`,
          closeLabel: 'Close'
        });
        viewer.classList.add('photo-only-modal');
        const viewerBody = viewer.querySelector('.ui-modal__body');
        viewerBody.insertAdjacentHTML('beforeend', '<button type="button" class="photo-viewer-arrow photo-viewer-previous" aria-label="Previous photo">&#8249;</button><button type="button" class="photo-viewer-arrow photo-viewer-next" aria-label="Next photo">&#8250;</button>');
        const viewerImage = viewerBody.querySelector('.listing-photo-viewer');
        let viewerIndex = startingIndex;
        const showViewerImage = (nextIndex) => {
          viewerIndex = (nextIndex + galleryImages.length) % galleryImages.length;
          viewerImage.src = galleryImages[viewerIndex];
          viewerImage.alt = `${property.title || 'Property'} photo ${viewerIndex + 1}`;
        };
        viewerBody.querySelector('.photo-viewer-previous').addEventListener('click', () => showViewerImage(viewerIndex - 1));
        viewerBody.querySelector('.photo-viewer-next').addEventListener('click', () => showViewerImage(viewerIndex + 1));
        openModal(viewer);
      };
      imageElement.addEventListener('click', openPhotoViewer);
      imageElement.tabIndex = 0;
      imageElement.setAttribute('role', 'button');
      imageElement.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openPhotoViewer();
        }
      });
    });

    cards.querySelectorAll('.view-details').forEach((button) => {
      button.addEventListener('click', () => {
        const property = state.all.find((item) => String(item.id) === String(button.dataset.id));
        if (property) openPropertyDetails(property);
      });
    });
  };

  const renderCards = () => {
    const query = (search?.value ?? '').trim().toLowerCase();
    const maxValue = Number(range.value || 15000);
    const rooms = selectedRoomFilters();
    const genders = selectedGenderFilters();
    const amenities = selectedAmenityFilters();

    const filtered = state.all.filter((item) => {
      const text = `${item.title ?? ''} ${item.municipality ?? ''} ${item.barangay ?? ''} ${normalizeRoomType(item.room_type)} ${item.address ?? ''}`.toLowerCase();
      const matchesSearch = !query || text.includes(query);
      const matchesBudget = Number(item.monthly_rent ?? 0) <= maxValue;
      const matchesRoom = !rooms.length || rooms.includes(String(item.room_type ?? '').toLowerCase());
      const matchesGender = !genders.length || genders.length === 0 || genders.includes(String(item.gender_preference ?? 'co-ed').toLowerCase());
      const itemAmenities = normalizeAmenities(item);
      const matchesAmenities = !amenities.length || amenities.every((amenity) => itemAmenities.includes(amenity));
      return matchesSearch && matchesBudget && matchesRoom && matchesGender && matchesAmenities;
    });

    syncMapLocation(filtered);
    renderFeaturedCards(filtered);

    if (mapStatus) {
      mapStatus.textContent = filtered.length
        ? `Showing ${filtered.length} real campus-ready listings from the DormHive database.`
        : 'No campus-ready listings match the current search.';
    }
  };

  range.addEventListener('input', updateRangeNote);
  clearButton.addEventListener('click', () => {
    root.querySelectorAll('input[type="checkbox"]').forEach((input) => { input.checked = false; });
    range.value = 15000;
    updateRangeNote();
    renderCards();
  });

  applyButton.addEventListener('click', renderCards);
  search.addEventListener('input', renderCards);

  // Add event listener for View nearby listings button
  const nearButton = root.querySelector('.near');
  if (nearButton) {
    nearButton.addEventListener('click', async () => {
      try {
        await showNearbyListingsModal(state.all);
      } catch (error) {
        console.error('Nearby listings modal error:', error);
        alert('Could not open nearby listings map.');
      }
    });
  }

  // Add event listener for View nearby listings button in map panel
  const mapPanelButton = root.querySelector('.map-panel .panel-button');
  if (mapPanelButton) {
    mapPanelButton.addEventListener('click', async () => {
      try {
        await showNearbyListingsModal(state.all);
      } catch (error) {
        console.error('Nearby listings modal error:', error);
        alert('Could not open nearby listings map.');
      }
    });
  }

  root.addEventListener('click', (event) => {
    const detailsButton = event.target.closest('.map-property-details');
    if (!detailsButton || !root.contains(detailsButton)) return;
    const property = state.all.find((item) => String(item.id) === String(detailsButton.dataset.propertyId));
    if (property) openPropertyDetails(property);
  });

  const load = async () => {
    renderSkeletonState();
    try {
      // Only load approved properties for tenants (Featured Listings and map markers)
      const response = await api('/properties?limit=100&status=approved');
      state.all = Array.isArray(response.data) ? response.data : [];
      syncMapLocation(state.all);
      // Initialize Leaflet map and render approved property markers
      await initLeafletMap(root.querySelector('.map'), state.all);
      renderCards();
    } catch (error) {
      cards.innerHTML = `<div class="empty">${esc(error.message)}</div>`;
      if (mapStatus) mapStatus.textContent = 'Unable to load validated listings from the database.';
    }
  };

  syncTenantProfileUi(root, user);
  updateRangeNote();
  load();

  // Periodically refresh approved listings so admin status changes propagate to tenants.
  // This keeps Featured Listings and map markers in sync when an admin approves/rejects properties.
  const POLL_INTERVAL = 15000; // 15 seconds
  setInterval(load, POLL_INTERVAL);
}
