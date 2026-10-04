import { renderMapPanelShell, initLeafletMap, updateLeafletMarkers } from '../../components/mapPanel.js';
import { ensureTenantSidebarStyles, loadTenantStylesheet, renderTenantSidebar } from './sidebarTenant.js';
import { getUserAvatarUrl, refreshTenantUserSession } from './setting.js';
import { createModal, openModal } from '../../components/modal.js';
import { showToast } from '../../components/toast.js';
import { api as apiClient, getApiErrorMessage, readApiResponse } from '../../services/api.js';
import { markNotificationRead } from '../../services/notificationSystem.js';

const API_URL = window.DORMHIVE_API_URL ?? 'http://localhost:5000/api/v1';
const apiBase = API_URL.replace(/\/api\/v1\/?$/, '');
const MAX_LISTING_PRICE = 1000000;
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
const resolveEffectiveOccupancy = (property = {}) => {
  const toFiniteNumber = (value) => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value))
    ? Number(value)
    : null;
  const maxOccupants = toFiniteNumber(property.max_occupants) ?? 0;
  const rawAvailableSlots = toFiniteNumber(property.available_slots);
  const reportedOccupied = toFiniteNumber(property.occupied_units ?? property.occupied ?? property.occupied_count);
  const occupiedUnits = reportedOccupied !== null
    ? Math.max(0, reportedOccupied)
    : (maxOccupants > 0 && rawAvailableSlots !== null
      ? Math.max(0, maxOccupants - rawAvailableSlots)
      : 0);
  const availableSlots = maxOccupants > 0
    ? Math.max(0, maxOccupants - occupiedUnits)
    : Math.max(0, rawAvailableSlots ?? 0);
  return {
    maxOccupants,
    occupiedUnits,
    availableSlots
  };
};
const isPropertyVisibleToTenant = (property = {}) => {
  const { maxOccupants, occupiedUnits, availableSlots } = resolveEffectiveOccupancy(property);
  const hasCapacityReached = Number.isFinite(maxOccupants) && maxOccupants > 0 && occupiedUnits >= maxOccupants;
  const hasNoAvailableSlots = Number.isFinite(availableSlots) && availableSlots <= 0;
  return !(hasCapacityReached || hasNoAvailableSlots);
};
function tenantFullName(user = {}) {
  const firstName = String(user.first_name ?? user.firstName ?? '').trim();
  const lastName = String(user.last_name ?? user.lastName ?? '').trim();
  const combined = [firstName, lastName].filter(Boolean).join(' ');
  return combined || String(user.name ?? 'Tenant').trim() || 'Tenant';
}
const money = (value = 0) => `PHP ${Number(value || 0).toLocaleString('en-PH')}`;
const glyph = { grid: '&#9638;', calendar: '&#9783;', gear: '&#9881;', menu: '&#9776;', search: '&#9906;', pin: '&#9679;', heart: '&#9825;', heartFilled: '&#9829;', home: '&#8962;', walk: '&#10148;', target: '&#8857;', layers: '&#9638;', arrow: '&#8594;', wifi: '&#8976;', snow: '&#10052;', kitchen: '&#9832;', laundry: '&#8635;', car: '&#9670;' };
const icon = (name) => `<span class="icon">${glyph[name] ?? ''}</span>`;
const heartIcon = (filled = false) => `<span class="icon">${filled ? glyph.heartFilled : glyph.heart}</span>`;
const formatNotificationDate = (value) => new Date(value ?? Date.now()).toLocaleDateString([], { month: 'short', day: 'numeric' });

function loadStyle() {
  const stylePromises = [];

  stylePromises.push(loadTenantStylesheet('dashboard', new URL('./style/dashboardTenant.css', import.meta.url)));

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

  return Promise.all(stylePromises);
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
    bedspace: 'Bedspace',
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

const FAVORITES_KEY = 'dormhive.favoriteListings';

function getFavoriteListingIds() {
  try {
    const raw = JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]');
    return Array.isArray(raw) ? raw.map((value) => String(value)) : [];
  } catch {
    return [];
  }
}

function toggleFavoriteListing(id) {
  const list = getFavoriteListingIds();
  const next = new Set(list);
  const normalizedId = String(id);
  if (next.has(normalizedId)) next.delete(normalizedId); else next.add(normalizedId);
  localStorage.setItem(FAVORITES_KEY, JSON.stringify([...next]));
  return next.has(normalizedId);
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
  const { maxOccupants, occupiedUnits, availableSlots } = resolveEffectiveOccupancy(property);
  const resolvedAvailable = Math.max(0, availableSlots);
  const resolvedOccupied = Math.max(0, occupiedUnits);
  const images = normalizePropertyImages(property);
  const galleryImages = images.length ? images : [DEFAULT_IMAGE_PLACEHOLDER];
  const galleryThumbnails = galleryImages.map((image, index) => `
    <button type="button" class="property-detail-thumbnail${index === 0 ? ' is-active' : ''}" data-gallery-index="${index}" aria-label="View photo ${index + 1}" aria-current="${index === 0 ? 'true' : 'false'}">
      <img src="${esc(image)}" alt="" />
    </button>
  `).join('');
  return `
    <div class="property-detail-modal-content">
      <div class="property-detail-gallery" data-gallery-images='${esc(JSON.stringify(galleryImages))}'>
        <div class="property-detail-gallery-stage">
          <img class="property-detail-modal-image" src="${esc(galleryImages[0])}" alt="${esc(property.title || 'Property')} photo 1" />
          <span class="property-detail-image-counter" aria-live="polite">1 / ${galleryImages.length}</span>
          <button type="button" class="property-detail-gallery-nav property-detail-gallery-previous" aria-label="Previous photo">&#8249;</button>
          <button type="button" class="property-detail-gallery-nav property-detail-gallery-next" aria-label="Next photo">&#8250;</button>
        </div>
        <div class="property-detail-thumbnails" role="group" aria-label="Property photo thumbnails">${galleryThumbnails}</div>
      </div>
      <div class="property-detail-modal-info">
        <div class="property-detail-modal-heading">
          <h3>${esc(property.title || 'Property')}</h3>
          <strong>${money(property.monthly_rent)} / month</strong>
        </div>
        <div class="property-detail-group property-detail-location">
          <span class="property-detail-label">Location</span>
          <strong>${esc(address || 'Not specified')}</strong>
        </div>
        <div class="property-detail-group property-detail-facts">
          <p><span>Room type</span><strong>${esc(normalizeRoomType(property.room_type) || 'Not specified')}</strong></p>
          <p><span>Occupancy</span><strong>${esc(maxOccupants ? `${resolvedOccupied} / ${maxOccupants} occupied` : 'Not specified')}</strong></p>
          <p><span>Available slots</span><strong>${esc(maxOccupants ? String(resolvedAvailable) : 'Not specified')}</strong></p>
          <p><span>Gender preference</span><strong>${esc(normalizeGenderPreference(property.gender_preference) || 'Not specified')}</strong></p>
          <p><span>Owner</span><strong>${esc(property.owner_name || 'Not specified')}</strong></p>
          <p><span>Amenities</span><strong>${esc(amenities.length ? amenities.map((item) => AMENITY_LABELS[item] ?? item.replace(/_/g, ' ')).join(', ') : 'None listed')}</strong></p>
        </div>
        <div class="property-detail-group property-detail-description">
          <span class="property-detail-label">Description</span>
          <p>${esc(property.description || 'No description provided.')}</p>
        </div>
      </div>
    </div>
    <form class="dashboard-request-form">
      <div class="dashboard-request-heading"><h3>Book a Viewing / Send a Request</h3></div>
      <div class="dashboard-request-fields">
        <label>Move-in Date<input type="date" name="moveInDate" required /></label>
        <label>Move-out Date
          <input type="date" name="moveOutDate" />
          <span class="dashboard-indefinite-move-out"><input type="checkbox" name="isIndefiniteMoveOut" /><span>Indefinite / No planned move-out date</span></span>
        </label>
        <label>Occupants<input type="number" name="occupants" min="1" value="1" required /></label>
        <label>Viewing Date<input type="date" name="viewingDate" /></label>
        <label>Viewing Time<input type="time" name="viewingTime" /></label>
      </div>
      <div class="dashboard-request-actions">
        <button type="button" class="dashboard-chat-owner">Chat Owner</button>
        <button type="submit" class="dashboard-send-request">Send Request</button>
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
    .ui-modal:has(.property-detail-modal-content) { position: fixed; inset: 0; margin: auto; width: min(94vw, 1120px); max-height: calc(100vh - 2rem); }
    .ui-modal:has(.property-detail-modal-content) .ui-modal__header { padding: 1rem 1.5rem; border-color: #e2ece8; }
    .ui-modal:has(.property-detail-modal-content) .ui-modal__header h2 { color: #173b35; font-size: 1.05rem; font-weight: 750; }
    .ui-modal:has(.property-detail-modal-content) .ui-modal__header button { display: grid; place-items: center; width: 2.25rem; height: 2.25rem; border-radius: 50%; color: #365d54; font-size: 1.5rem; }
    .ui-modal:has(.property-detail-modal-content) .ui-modal__header button:hover { background: #edf6f2; }
    .ui-modal:has(.property-detail-modal-content) .ui-modal__body { padding: 1.4rem 1.5rem; }
    .ui-modal:has(.property-detail-modal-content) .ui-modal__footer { padding: .85rem 1.5rem; border-color: #e2ece8; }
    .tenant-property-detail-modal .ui-modal__footer button { min-width: 5.25rem; background: #edf3f1; color: #31554c; }
    .tenant-property-detail-modal .ui-modal__footer button:hover { background: #e0ebe7; }
    .property-detail-modal-content { display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, .95fr); gap: 1.75rem; align-items: start; }
    .property-detail-gallery { min-width: 0; touch-action: pan-y; }
    .property-detail-gallery-stage { position: relative; height: 300px; overflow: hidden; border-radius: .75rem; background: #eaf1ee; }
    .property-detail-modal-image { display: block; width: 100%; height: 100%; object-fit: cover; cursor: zoom-in; }
    .property-detail-image-counter { position: absolute; bottom: .75rem; left: .75rem; padding: .25rem .55rem; border-radius: 999px; background: rgb(18 36 32 / 76%); color: #fff; font-size: .72rem; font-weight: 700; }
    .property-detail-gallery-nav { position: absolute; top: 50%; display: grid; place-items: center; width: 2.4rem; height: 2.4rem; padding: 0 0 .15rem; transform: translateY(-50%); border: 0; border-radius: 50%; background: rgb(18 36 32 / 65%); color: #fff; font: inherit; font-size: 1.8rem; line-height: 1; cursor: pointer; }
    .property-detail-gallery-nav:hover { background: rgb(18 36 32 / 88%); }
    .property-detail-gallery-previous { left: .7rem; }
    .property-detail-gallery-next { right: .7rem; }
    .property-detail-thumbnails { display: grid; grid-auto-columns: minmax(3.5rem, 1fr); grid-auto-flow: column; gap: .55rem; margin-top: .65rem; overflow-x: auto; }
    .property-detail-thumbnail { min-width: 0; height: 64px; padding: 0; overflow: hidden; border: 2px solid transparent; border-radius: .45rem; background: #eaf1ee; cursor: pointer; }
    .property-detail-thumbnail img { display: block; width: 100%; height: 100%; object-fit: cover; }
    .property-detail-thumbnail.is-active { border-color: #159879; }
    .property-detail-thumbnail:focus-visible, .property-detail-gallery-nav:focus-visible { outline: 2px solid #159879; outline-offset: 2px; }
    .property-detail-modal-info { display: grid; gap: .8rem; min-width: 0; color: #193a34; }
    .property-detail-modal-heading { display: flex; justify-content: space-between; align-items: flex-start; gap: .85rem; }
    .property-detail-modal-heading h3 { margin: 0; color: #173b35; font-size: 1.3rem; line-height: 1.25; overflow-wrap: anywhere; }
    .property-detail-modal-heading strong { flex: 0 0 auto; padding: .4rem .65rem; border-radius: 999px; background: #e7f5ef; color: #087f63; font-size: .9rem; white-space: nowrap; }
    .property-detail-group { min-width: 0; padding: .8rem .9rem; border: 1px solid #e4ede9; border-radius: .55rem; background: #fbfdfc; }
    .property-detail-label, .property-detail-facts span { display: block; margin-bottom: .25rem; color: #71847d; font-size: .67rem; font-weight: 750; text-transform: uppercase; }
    .property-detail-location strong { display: block; color: #24483f; font-size: .88rem; line-height: 1.45; overflow-wrap: anywhere; }
    .property-detail-facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .75rem 1rem; }
    .property-detail-facts p { min-width: 0; margin: 0; }
    .property-detail-facts strong { display: block; color: #24483f; font-size: .82rem; line-height: 1.4; overflow-wrap: anywhere; }
    .property-detail-description p { margin: 0; color: #4d655d; font-size: .84rem; line-height: 1.5; white-space: pre-line; }
    .property-photo-viewer { position: fixed; inset: 0; margin: auto; display: grid; place-items: center; width: min(94vw, 1100px); max-width: none; max-height: 88vh; padding: 0; border: 0; background: transparent; overflow: visible; }
    .property-photo-viewer::backdrop { background: rgb(15 23 42 / 82%); backdrop-filter: blur(4px); }
    .property-photo-viewer__image { display: block; width: 100%; max-height: 88vh; object-fit: contain; border-radius: .65rem; user-select: none; -webkit-user-drag: none; }
    .property-photo-viewer__close { position: absolute; top: .75rem; right: .75rem; display: grid; place-items: center; width: 2.25rem; height: 2.25rem; border: 0; border-radius: 50%; background: rgb(15 23 42 / 75%); color: #fff; font-size: 1.5rem; line-height: 1; cursor: pointer; user-select: none; }
    .property-photo-viewer__nav { position: absolute; top: 50%; display: grid; place-items: center; width: 2.75rem; height: 2.75rem; padding: 0; border: 0; border-radius: 50%; transform: translateY(-50%); background: rgb(15 23 42 / 75%); color: #fff; font-size: 2rem; line-height: 1; cursor: pointer; user-select: none; }
    .property-photo-viewer__nav--previous { left: .75rem; }
    .property-photo-viewer__nav--next { right: .75rem; }
    .dashboard-request-form { margin-top: 1.35rem; padding-top: 1.15rem; border-top: 1px solid #dce8e3; }
    .dashboard-request-heading { margin-bottom: .9rem; }
    .dashboard-request-heading h3 { margin: 0; color: #173b35; font-size: 1rem; font-weight: 750; }
    .dashboard-request-fields { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: .75rem; align-items: start; }
    .dashboard-request-fields label { display: grid; gap: .35rem; min-width: 0; color: #526b63; font-size: .73rem; font-weight: 700; }
    .dashboard-request-fields input:not([type="checkbox"]) { width: 100%; min-width: 0; height: 42px; padding: 0 .65rem; border: 1px solid #d4e0db; border-radius: .45rem; background: #fff; color: #183a33; font: inherit; font-size: .82rem; }
    .dashboard-request-fields input:focus-visible { outline: 2px solid #1aa87a; outline-offset: 2px; }
    .dashboard-request-fields .dashboard-indefinite-move-out { display: flex; align-items: flex-start; gap: .4rem; margin-top: .15rem; color: #61756e; font-size: .68rem; font-weight: 500; line-height: 1.3; }
    .dashboard-request-fields .dashboard-indefinite-move-out input[type="checkbox"] { flex: 0 0 15px; width: 15px; height: 15px; margin: .05rem 0 0; padding: 0; accent-color: #13856a; }
    .dashboard-request-actions { display: flex; flex-wrap: wrap; gap: .6rem; margin-top: .9rem; }
    .dashboard-request-actions button { min-height: 42px; padding: .6rem 1rem; border: 1px solid #13856a; border-radius: .45rem; font: inherit; font-size: .82rem; font-weight: 700; cursor: pointer; }
    .dashboard-chat-owner { background: #fff; color: #11765f; }
    .dashboard-chat-owner:hover { background: #edf7f3; }
    .dashboard-send-request { background: #159879; color: #fff; }
    .dashboard-send-request:hover { background: #107e65; }
    .dashboard-request-status { min-height: 1.2rem; margin: .55rem 0 0; color: #7b4b2d; font-size: .82rem; }
    @media (max-width: 860px) {
      .property-detail-modal-content { grid-template-columns: minmax(0, 1fr); gap: 1.1rem; }
      .property-detail-gallery-stage { height: 280px; }
      .dashboard-request-fields { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    }
    @media (max-width: 560px) {
      .ui-modal:has(.property-detail-modal-content) { width: calc(100vw - 1rem); max-height: calc(100vh - 1rem); }
      .ui-modal:has(.property-detail-modal-content) .ui-modal__header { padding: .8rem 1rem; }
      .ui-modal:has(.property-detail-modal-content) .ui-modal__body { padding: 1rem; }
      .ui-modal:has(.property-detail-modal-content) .ui-modal__footer { padding: .7rem 1rem; }
      .property-detail-modal-heading { flex-direction: column; gap: .45rem; }
      .property-detail-modal-heading strong { white-space: normal; }
      .property-detail-gallery-stage { height: 220px; }
      .property-detail-thumbnail { height: 54px; }
      .property-detail-facts { gap: .65rem; }
      .dashboard-request-fields { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .dashboard-request-actions button { flex: 1 1 9rem; }
    }
    @media (max-width: 360px) {
      .dashboard-request-fields { grid-template-columns: minmax(0, 1fr); }
    }
  `;
  document.head.append(style);
}

function mapQueryFor(item) {
  return [item.address, item.barangay, item.municipality, 'Manila, Philippines'].filter(Boolean).join(', ');
}

function listingCard(item, index) {
  const place = esc(locationText(item));
  const roomType = esc(normalizeRoomType(item.room_type));
  const { maxOccupants, occupiedUnits, availableSlots } = resolveEffectiveOccupancy(item);
  const occupancyLabel = maxOccupants > 0
    ? (availableSlots <= 0 ? 'Fully Occupied' : `${occupiedUnits} / ${maxOccupants} occupied · ${availableSlots} left`)
    : 'Occupancy info unavailable';
  const badge = item.status === 'approved' ? 'Verified' : (item.status || 'Active');
  const walkDistance = (0.6 + index * 0.25).toFixed(1);
  const image = normalizePropertyImage(item);
  const photoMarkup = `<img src="${esc(image || DEFAULT_IMAGE_PLACEHOLDER)}" alt="${esc(item.title || 'Listing photo')}" class="listing-photo" /><em>${esc(badge)}</em><button aria-label="Save listing">${heartIcon(false)}</button>`;

  return `
    <article class="listing" data-id="${item.id}">
      <div class="photo p${index % 4}">${photoMarkup}</div>
      <div class="listing-body">
        <p class="place">${icon('pin')}${place}</p>
        <h3>${esc(item.title || 'Available dorm space')}</h3>
        <p class="meta">${roomType} &bull; ${esc(occupancyLabel)}</p>
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
  await Promise.all([loadStyle(), ensureTenantSidebarStyles()]);
  loadPropertyDetailsStyle();

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
              <input id="range" type="range" min="3000" max="1000000" step="500" value="1000000">
              <div class="price-input">
                <label>Min<input id="min-price" value="3000" readonly></label>
                <span>to</span>
                <label>Max<input id="max-price" value="1000000"></label>
              </div>
              <p id="range-note">PHP 3,000 to PHP 15,000+</p>
            </fieldset>

            <fieldset>
              <legend>Room type</legend>
              <label><input type="checkbox" name="room" value="private_room"> Solo Room</label>
              <label><input type="checkbox" name="room" value="entire_unit"> Studio Unit</label>
              <label><input type="checkbox" name="room" value="bedspace"> Bedspace</label>
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

  const tenantApp = root.querySelector('.dh-app');
  const hamburger = root.querySelector('.hamburger');
  hamburger?.addEventListener('click', () => {
    tenantApp?.classList.toggle('open');
  });

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

  const state = { all: [], visible: [] };
  const routeSearch = typeof window.DORMHIVE_ROUTE_SEARCH === 'string' ? window.DORMHIVE_ROUTE_SEARCH : window.location.search;
  const routeParams = new URLSearchParams(routeSearch);
  const requestedPropertyId = routeParams.get('propertyId');
  let requestedPropertyOpened = false;
  const search = root.querySelector('#search');
  if (search) search.value = routeParams.get('search') ?? '';
  const maxPrice = root.querySelector('#max-price');
  const range = root.querySelector('#range');
  const rangeNote = root.querySelector('#range-note');
  const cards = root.querySelector('#featured-cards');
  const clearButton = root.querySelector('#clear');
  const applyButton = root.querySelector('#apply-filters');
  const mapStatus = root.querySelector('#map-status');
  const mapPanel = root.querySelector('#shared-map');
  const mapFrame = root.querySelector('#tenant-map');
  const mapInitialization = initLeafletMap(root.querySelector('.map'), []).catch((error) => {
    console.warn('Unable to initialize tenant map:', error);
    return null;
  });
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
    maxPrice.value = String(range.value || MAX_LISTING_PRICE);
    rangeNote.textContent = `PHP 3,000 to PHP ${Number(range.value || MAX_LISTING_PRICE).toLocaleString('en-PH')}+`;
  };

  const handleUserRefresh = async () => {
    const latestUser = await refreshTenantUserSession();
    syncTenantProfileUi(root, latestUser);
  };
  window.addEventListener('dormhive-user-updated', handleUserRefresh);

  const syncMapLocation = (items = []) => {
    if (!mapPanel) return;
    if (mapPanel.__leafletMapManager) updateLeafletMarkers(mapPanel, items);

    const nearButton = root.querySelector('.near');
    const focusItem = items.find((item) => item.municipality || item.barangay || item.address) ?? state.all[0];
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
    modal.classList.add('tenant-property-detail-modal');
    modal.querySelector('.ui-modal__body').innerHTML = propertyDetailsMarkup(property);
    const gallery = modal.querySelector('.property-detail-gallery');
    if (gallery) {
      const galleryImage = gallery.querySelector('.property-detail-modal-image');
      const galleryThumbnails = Array.from(gallery.querySelectorAll('.property-detail-thumbnail'));
      const galleryCounter = gallery.querySelector('.property-detail-image-counter');
      const previousButton = gallery.querySelector('.property-detail-gallery-previous');
      const nextButton = gallery.querySelector('.property-detail-gallery-next');
      let galleryImages = [];
      try { galleryImages = JSON.parse(gallery.dataset.galleryImages || '[]'); } catch {}
      let galleryIndex = 0;
      const showGalleryImage = (nextIndex) => {
        if (!galleryImages.length) return;
        galleryIndex = (nextIndex + galleryImages.length) % galleryImages.length;
        galleryImage.src = galleryImages[galleryIndex];
        galleryImage.alt = `${property.title || 'Property'} photo ${galleryIndex + 1}`;
        if (galleryCounter) galleryCounter.textContent = `${galleryIndex + 1} / ${galleryImages.length}`;
        galleryThumbnails.forEach((thumbnail, index) => {
          const isActive = index === galleryIndex;
          thumbnail.classList.toggle('is-active', isActive);
          thumbnail.setAttribute('aria-current', String(isActive));
        });
      };
      const openImageViewer = () => {
        const viewer = document.createElement('dialog');
        viewer.className = 'property-photo-viewer';
        const viewerImage = document.createElement('img');
        viewerImage.className = 'property-photo-viewer__image';
        viewerImage.src = galleryImage.src;
        viewerImage.alt = galleryImage.alt;
        const previousButton = document.createElement('button');
        previousButton.type = 'button';
        previousButton.className = 'property-photo-viewer__nav property-photo-viewer__nav--previous';
        previousButton.setAttribute('aria-label', 'View previous photo');
        previousButton.textContent = '‹';
        const nextButton = document.createElement('button');
        nextButton.type = 'button';
        nextButton.className = 'property-photo-viewer__nav property-photo-viewer__nav--next';
        nextButton.setAttribute('aria-label', 'View next photo');
        nextButton.textContent = '›';
        const closeButton = document.createElement('button');
        closeButton.type = 'button';
        closeButton.className = 'property-photo-viewer__close';
        closeButton.setAttribute('aria-label', 'Close photo viewer');
        closeButton.textContent = '×';
        const updateViewerImage = () => {
          viewerImage.src = galleryImage.src;
          viewerImage.alt = galleryImage.alt;
        };
        previousButton.addEventListener('click', () => { showGalleryImage(galleryIndex - 1); updateViewerImage(); });
        nextButton.addEventListener('click', () => { showGalleryImage(galleryIndex + 1); updateViewerImage(); });
        viewer.append(viewerImage, previousButton, nextButton, closeButton);
        const removeViewer = () => viewer.remove();
        closeButton.addEventListener('click', () => viewer.close());
        viewer.addEventListener('click', (event) => { if (event.target === viewer) viewer.close(); });
        viewer.addEventListener('close', removeViewer, { once: true });
        document.body.append(viewer);
        viewer.showModal();
      };
      galleryImage.tabIndex = 0;
      galleryImage.setAttribute('role', 'button');
      galleryImage.setAttribute('aria-label', 'View photo larger');
      galleryImage.addEventListener('click', openImageViewer);
      galleryImage.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openImageViewer();
        }
      });
      previousButton.addEventListener('click', () => showGalleryImage(galleryIndex - 1));
      nextButton.addEventListener('click', () => showGalleryImage(galleryIndex + 1));
      galleryThumbnails.forEach((thumbnail) => thumbnail.addEventListener('click', () => showGalleryImage(Number(thumbnail.dataset.galleryIndex))));
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
    const indefiniteMoveOut = form.querySelector('[name="isIndefiniteMoveOut"]');
    moveIn.min = new Date().toISOString().split('T')[0];
    const updateMoveOutMinimum = () => {
      if (!moveIn.value) {
        moveOut.removeAttribute('min');
        return;
      }
      const firstValidMoveOut = new Date(`${moveIn.value}T00:00:00`);
      firstValidMoveOut.setDate(firstValidMoveOut.getDate() + 1);
      moveOut.min = `${firstValidMoveOut.getFullYear()}-${String(firstValidMoveOut.getMonth() + 1).padStart(2, '0')}-${String(firstValidMoveOut.getDate()).padStart(2, '0')}`;
    };
    updateMoveOutMinimum();
    moveIn.addEventListener('change', updateMoveOutMinimum);
    indefiniteMoveOut.addEventListener('change', () => {
      moveOut.disabled = indefiniteMoveOut.checked;
      if (indefiniteMoveOut.checked) moveOut.value = '';
    });
    modal.querySelector('.dashboard-chat-owner').addEventListener('click', () => {
      if (modal.open) modal.close();
      modal.remove();
      location.hash = `#/tenant/message?propertyId=${encodeURIComponent(property.id)}`;
    });
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      if (!indefiniteMoveOut.checked && moveOut.value && moveIn.value && moveOut.value <= moveIn.value) {
        status.textContent = 'Move-out date must be after the move-in date.';
        return;
      }
      const formData = new FormData(form);
      const viewingDate = String(formData.get('viewingDate') ?? '').trim();
      const viewingTime = String(formData.get('viewingTime') ?? '').trim();
      if (Boolean(viewingDate) !== Boolean(viewingTime)) {
        status.textContent = 'Select both a viewing date and time, or leave both blank.';
        return;
      }
      const submitButton = form.querySelector('.dashboard-send-request');
      submitButton.disabled = true;
      try {
        const response = await fetch(`${API_URL}/bookings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('dormhive.accessToken') ?? ''}` },
          body: JSON.stringify({ propertyId: Number(property.id), moveInDate: formData.get('moveInDate'), moveOutDate: indefiniteMoveOut.checked ? null : formData.get('moveOutDate') || null, isIndefiniteMoveOut: indefiniteMoveOut.checked, viewingDate: viewingDate || null, viewingTime: viewingTime || null, occupants: Number(formData.get('occupants') || 1), message: '' })
        });
        const body = await readApiResponse(response);
        if (!response.ok) throw new Error(getApiErrorMessage(body, 'Unable to submit booking request.'));
        modal.close();
        showToast({ message: 'Booking request sent successfully.', type: 'success' });
      } catch (error) {
        status.textContent = error.message;
        submitButton.disabled = false;
      }
    });
    openModal(modal);
  };

  const renderFeaturedCards = (items = []) => {
    if (!cards) return;
    if (!items.length) {
      cards.innerHTML = '<div class="empty">No properties found</div>';
      return;
    }

    const favoriteIds = new Set(getFavoriteListingIds());
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
      const isFavorite = favoriteIds.has(String(item.id));

      return `
        <article class="listing" data-id="${item.id}">
          <div class="photo p${index % 4}">
            <img src="${esc(galleryImages[0])}" alt="${esc(item.title || 'Listing photo')}" class="listing-photo" />
            <em>${esc(item.status === 'approved' ? 'Verified' : (item.status || 'Approved'))}</em>
            <button type="button" class="favorite-toggle${isFavorite ? ' is-favorited' : ''}" data-property-id="${item.id}" aria-label="${isFavorite ? 'Remove from favorites' : 'Save listing'}" aria-pressed="${isFavorite}">${heartIcon(isFavorite)}</button>
            <button type="button" class="favorite-toggle${isFavorite ? ' is-favorited' : ''}" data-property-id="${item.id}" aria-label="${isFavorite ? 'Remove from favorites' : 'Save listing'}" aria-pressed="${isFavorite}">${heartIcon(isFavorite)}</button>
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

    cards.querySelectorAll('.favorite-toggle').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        const propertyId = button.dataset.propertyId;
        const isFavorite = toggleFavoriteListing(propertyId);
        button.classList.toggle('is-favorited', isFavorite);
        button.innerHTML = heartIcon(isFavorite);
        button.setAttribute('aria-pressed', String(isFavorite));
        button.setAttribute('aria-label', isFavorite ? 'Remove from favorites' : 'Save listing');
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
    const maxValue = Number(range.value || MAX_LISTING_PRICE);
    const rooms = selectedRoomFilters();
    const genders = selectedGenderFilters();
    const amenities = selectedAmenityFilters();

    const filtered = state.all.filter((item) => {
      const keywordValues = [
        item.title,
        item.description,
        item.address,
        item.barangay,
        item.municipality,
        item.city,
        item.location,
        item.university,
        item.landmark,
        item.keywords,
        item.tags,
        normalizeRoomType(item.room_type),
        normalizeGenderPreference(item.gender_preference),
        normalizeAmenities(item).join(' ')
      ];
      const text = keywordValues.flatMap((value) => Array.isArray(value) ? value : [value]).filter(Boolean).join(' ').toLowerCase();
      const matchesSearch = !query || text.includes(query);
      const matchesBudget = Number(item.monthly_rent ?? 0) <= maxValue;
      const matchesRoom = !rooms.length || rooms.includes(String(item.room_type ?? '').toLowerCase());
      const matchesGender = !genders.length || genders.length === 0 || genders.includes(String(item.gender_preference ?? 'co-ed').toLowerCase());
      const itemAmenities = normalizeAmenities(item);
      const matchesAmenities = !amenities.length || amenities.every((amenity) => itemAmenities.includes(amenity));
      const isAvailable = isPropertyVisibleToTenant(item);
      return isAvailable && matchesSearch && matchesBudget && matchesRoom && matchesGender && matchesAmenities;
    });

    state.visible = filtered;
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
    range.value = MAX_LISTING_PRICE;
    updateRangeNote();
    renderCards();
  });

  applyButton.addEventListener('click', renderCards);
  search.addEventListener('input', renderCards);
  const focusSearchedLocation = async () => {
    const query = search.value.trim();
    if (!query || !mapPanel?.__leafletMapManager) return;
    if (mapStatus) mapStatus.textContent = `Finding ${query}...`;
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`, {
        headers: { Accept: 'application/json' }
      });
      if (!response.ok) throw new Error('Location search failed.');
      const results = await response.json();
      const result = results[0];
      if (!result) {
        if (mapStatus) mapStatus.textContent = `No map location found for ${query}.`;
        return;
      }
      mapPanel.__leafletMapManager.setSearchLocation({
        latitude: Number(result.lat),
        longitude: Number(result.lon),
        label: result.display_name || query,
        showMarker: false
      });
      if (mapStatus) {
        const nearbyCount = mapPanel.__leafletMapManager.countNearbyItems();
        const propertyLabel = nearbyCount === 1 ? 'property' : 'properties';
        mapStatus.textContent = `${nearbyCount} ${propertyLabel} within 8 km of ${query}.`;
      }
    } catch (error) {
      if (mapStatus) mapStatus.textContent = error.message;
    }
  };
  let searchTimer;
  search.addEventListener('input', () => {
    renderCards();
    clearTimeout(searchTimer);
    if (search.value.trim()) searchTimer = setTimeout(focusSearchedLocation, 600);
  });
  search.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    renderCards();
    focusSearchedLocation();
  });

  // Add event listener for View nearby listings button
  const getNearbySearchResults = () => {
    const query = search.value.trim().toLowerCase();
    if (!query) return state.visible;
    return state.all.filter((item) => [item.municipality, item.city, item.barangay, item.address]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(query));
  };
  const nearButton = root.querySelector('.near');
  if (nearButton) {
    nearButton.addEventListener('click', async () => {
      try {
        await showNearbyListingsModal(getNearbySearchResults());
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
        await showNearbyListingsModal(getNearbySearchResults());
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
      state.all = Array.isArray(response.data) ? response.data.filter((item) => isPropertyVisibleToTenant(item)) : [];
      state.visible = state.all;
      await mapInitialization;
      syncMapLocation(state.all);
      renderCards();
      if (requestedPropertyId && !requestedPropertyOpened) {
        const requestedProperty = state.all.find((item) => String(item.id) === String(requestedPropertyId));
        if (requestedProperty) {
          requestedPropertyOpened = true;
          await openPropertyDetails(requestedProperty);
        }
      }
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
