import { renderMapPanelShell, initLeafletMap, updateLeafletMarkers } from '../../components/mapPanel.js';
import { ensureTenantSidebarStyles, loadTenantStylesheet, renderTenantSidebar } from './sidebarTenant.js';
import { getUserAvatarUrl, refreshTenantUserSession } from './setting.js';
import { createModal, openModal, successDialog } from '../../components/modal.js';
import { api as apiClient, getApiErrorMessage, readApiResponse } from '../../services/api.js';
import { markNotificationRead } from '../../services/notificationSystem.js';
import { withMediaAccessToken } from '../../services/mediaAccess.js';
import { buildInitialsAvatarSvg, getAvatarInitials } from '../../services/avatar.js';

const API_URL = window.DORMHIVE_API_URL ?? 'http://localhost:5000/api/v1';
const apiBase = API_URL.replace(/\/api\/v1\/?$/, '');
const MAX_LISTING_PRICE = 1000000;
const TENANT_SEARCH_RADIUS_KM = 1;
const DEFAULT_IMAGE_PLACEHOLDER = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 300"><rect width="500" height="300" fill="#ecf5ef"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#4a7160" font-family="Inter,Arial,sans-serif" font-size="28">No image available</text></svg>');
const resolveImageUrl = (value = '') => {
  const url = String(value || '').trim();
  if (!url) return '';
  return withMediaAccessToken(/^https?:\/\//i.test(url) ? url : `${apiBase}${url.startsWith('/') ? '' : '/'}${url}`);
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
function openTenantPhotoViewer(property, clickedImage = null) {
  if (!property) return;
  const photos = normalizePropertyImages(property);
  const clickedPhoto = clickedImage ? resolveImageUrl(clickedImage) : '';
  if (clickedPhoto && !photos.includes(clickedPhoto)) photos.unshift(clickedPhoto);
  if (!photos.length) photos.push(DEFAULT_IMAGE_PLACEHOLDER);

  const initialIndex = Math.max(0, photos.indexOf(clickedPhoto));
  let photoIndex = initialIndex;
  const title = property.title || 'Property';
  const viewer = document.createElement('dialog');
  viewer.className = 'ui-modal photo-only-modal';
  viewer.setAttribute('aria-label', `${title} photos`);
  viewer.innerHTML = `
    <div class="ui-modal__body photo-viewer-stage">
      <img class="listing-photo-viewer" alt="">
      <button type="button" class="photo-viewer-arrow photo-viewer-previous" aria-label="Previous photo" title="Previous photo"><i class="bi bi-chevron-left" aria-hidden="true"></i></button>
      <button type="button" class="photo-viewer-arrow photo-viewer-next" aria-label="Next photo" title="Next photo"><i class="bi bi-chevron-right" aria-hidden="true"></i></button>
      <div class="photo-viewer-actions">
        <button type="button" class="photo-viewer-action photo-viewer-download" aria-label="Download photo" title="Download photo"><i class="bi bi-download" aria-hidden="true"></i></button>
        <button type="button" class="photo-viewer-action photo-viewer-share" aria-label="Share photo" title="Share photo"><i class="bi bi-share" aria-hidden="true"></i></button>
        <button type="button" class="photo-viewer-action photo-viewer-dismiss" aria-label="Close photo viewer" title="Close viewer"><i class="bi bi-x-lg" aria-hidden="true"></i></button>
      </div>
    </div>
    <nav class="photo-viewer-thumbnails" aria-label="Property photos"></nav>`;

  const viewerImage = viewer.querySelector('.listing-photo-viewer');
  const thumbnails = viewer.querySelector('.photo-viewer-thumbnails');
  const thumbnailButtons = photos.map((photo, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'photo-viewer-thumbnail';
    button.dataset.photoIndex = String(index);
    button.setAttribute('aria-label', `View photo ${index + 1}`);
    button.setAttribute('aria-current', String(index === initialIndex));
    const image = document.createElement('img');
    image.src = photo;
    image.alt = '';
    image.loading = 'lazy';
    button.append(image);
    thumbnails.append(button);
    return button;
  });
  const previousButton = viewer.querySelector('.photo-viewer-previous');
  const nextButton = viewer.querySelector('.photo-viewer-next');
  const renderPhoto = (nextIndex = photoIndex) => {
    photoIndex = (nextIndex + photos.length) % photos.length;
    previousButton.hidden = photos.length < 2;
    nextButton.hidden = photos.length < 2;
    thumbnailButtons.forEach((button, index) => {
      const active = index === photoIndex;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-current', String(active));
    });
  };
  thumbnails.addEventListener('click', (event) => {
    const button = event.target.closest('.photo-viewer-thumbnail');
    if (button) renderPhoto(Number(button.dataset.photoIndex));
  });
  previousButton.addEventListener('click', () => renderPhoto(photoIndex - 1));
  nextButton.addEventListener('click', () => renderPhoto(photoIndex + 1));
  viewer.querySelector('.photo-viewer-dismiss').addEventListener('click', () => viewer.close());
  viewer.addEventListener('click', (event) => { if (event.target === viewer) viewer.close(); });
  viewer.addEventListener('close', () => viewer.remove(), { once: true });
  viewer.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') previousButton.click();
    if (event.key === 'ArrowRight') nextButton.click();
  });
  viewer.querySelector('.photo-viewer-download').addEventListener('click', async () => {
    try {
      const response = await fetch(photos[photoIndex]);
      if (!response.ok) throw new Error('Download failed');
      const objectUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `${String(title).replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')}-photo-${photoIndex + 1}`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch {
      window.open(photos[photoIndex], '_blank', 'noopener,noreferrer');
    }
  });
  viewer.querySelector('.photo-viewer-share').addEventListener('click', async () => {
    try {
      if (navigator.share) await navigator.share({ title, url: photos[photoIndex] });
      else if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(photos[photoIndex]);
      else window.open(photos[photoIndex], '_blank', 'noopener,noreferrer');
    } catch (error) {
      if (error.name !== 'AbortError') window.open(photos[photoIndex], '_blank', 'noopener,noreferrer');
    }
  });
  renderPhoto();
  document.body.append(viewer);
  viewer.showModal();
}
const resolveEffectiveOccupancy = (property = {}) => {
  const toFiniteNumber = (value) => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value))
    ? Number(value)
    : null;
  const rawAvailableSlots = toFiniteNumber(property.available_slots ?? property.total_slots);
  const availableSlots = Math.max(0, rawAvailableSlots ?? 0);
  const totalSlots = Math.max(0, toFiniteNumber(property.total_slots) ?? availableSlots);
  const occupiedSlots = Math.max(0, totalSlots - availableSlots);
  return {
    availableSlots,
    totalSlots,
    occupiedSlots
  };
};
const isPropertyVisibleToTenant = (property = {}) => {
  const { availableSlots } = resolveEffectiveOccupancy(property);
  const hasNoAvailableSlots = Number.isFinite(availableSlots) && availableSlots <= 0;
  return !hasNoAvailableSlots;
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
const formatScheduleDate = (value) => {
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });
};

function loadStyle() {
  const stylePromises = [];

  const dashboardStylesheet = new URL('./style/dashboardTenant.css', import.meta.url);
  dashboardStylesheet.searchParams.set('v', 'tenant-listings-lazy-scroll-1');
  stylePromises.push(loadTenantStylesheet('dashboard', dashboardStylesheet));

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
      .dh-dashboard .notification-dropdown-header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: .85rem 1rem; border-bottom: 1px solid #dce6e2; }
      .dh-dashboard .notification-dropdown-actions { position: relative; display: flex; align-items: center; }
      .dh-dashboard .notification-more-button { display: grid; place-items: center; width: 2rem; height: 2rem; padding: 0; border: 0; border-radius: .5rem; background: transparent; color: #6d8179; cursor: pointer; }
      .dh-dashboard .notification-more-button:hover { background: #f4f8f6; color: #1f3530; }
      .dh-dashboard .notification-more-icon { width: 1.15rem; height: 1.15rem; fill: currentColor; }
      .dh-dashboard .notification-actions-menu { position: absolute; top: calc(100% + .35rem); right: 0; z-index: 2; min-width: 11rem; padding: .3rem; border: 1px solid #dce6e2; border-radius: .55rem; background: #fff; box-shadow: 0 8px 20px rgba(20, 70, 55, .14); }
      .dh-dashboard .notification-actions-menu[hidden] { display: none; }
      .dh-dashboard .notification-mark-all-read { display: flex; align-items: center; gap: .65rem; width: 100%; padding: .6rem .65rem; border: 0; border-radius: .35rem; background: transparent; color: #1f3530; font: inherit; font-size: .8rem; text-align: left; cursor: pointer; }
      .dh-dashboard .notification-mark-all-read svg { width: 1.1rem; height: 1.1rem; flex: 0 0 auto; }
      .dh-dashboard .notification-mark-all-read:hover:not(:disabled) { background: #f4f8f6; }
      .dh-dashboard .notification-mark-all-read:disabled { color: #9aa9a2; cursor: default; }
      .dh-dashboard .notification-filters { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .35rem; padding: .55rem .75rem; border-bottom: 1px solid #edf2ef; }
      .dh-dashboard .notification-filter { padding: .45rem .65rem; border: 0; border-radius: .5rem; background: transparent; color: #6d8179; font: inherit; font-size: .8rem; font-weight: 600; cursor: pointer; }
      .dh-dashboard .notification-filter:hover { background: #f4f8f6; }
      .dh-dashboard .notification-filter.is-active { background: #e8f4ef; color: #15734e; }
      .dh-dashboard .notification-empty, .dh-dashboard .notification-item time { color: #6d8179; font-size: .75rem; }
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
      .ui-modal.photo-only-modal { position: fixed; inset: 0; display: grid; grid-template-rows: minmax(0, 1fr) 64px; width: 100vw; height: 100vh; height: 100dvh; max-width: none; max-height: none; margin: 0; padding: 0; overflow: hidden; border: 0; border-radius: 0; background: #34363b; }
      .ui-modal.photo-only-modal { box-shadow: none; }
      .photo-only-modal::backdrop { background: #25272b; }
      .photo-only-modal .ui-modal__header, .photo-only-modal .ui-modal__footer { display: none; }
      .photo-only-modal .ui-modal__body { position: relative; display: grid; place-items: center; min-height: 0; padding: .75rem 4.5rem 0; overflow: hidden; background: #37393e; }
      .photo-only-modal .listing-photo-viewer { display: block; width: auto; height: auto; max-width: calc(100vw - 9rem); max-height: calc(100dvh - 64px - .75rem); object-fit: contain; border-radius: 0; }
      .photo-viewer-actions { position: absolute; top: 1rem; right: 1rem; z-index: 2; display: flex; align-items: center; gap: .55rem; }
      .photo-viewer-action, .photo-viewer-arrow { display: grid; place-items: center; padding: 0; border: 0; border-radius: 50%; background: rgba(18,20,24,.66); color: #fff; cursor: pointer; }
      .photo-viewer-action { width: 38px; height: 38px; font-size: 1rem; }
      .photo-viewer-arrow { position: absolute; top: 50%; z-index: 1; width: 42px; height: 42px; font-size: 1.15rem; transform: translateY(-50%); }
      .photo-viewer-action:hover, .photo-viewer-arrow:hover { background: rgba(5,7,10,.9); }
      .photo-viewer-previous { left: 1rem; }
      .photo-viewer-next { right: 1rem; }
      .photo-viewer-thumbnails { display: flex; align-items: center; justify-content: center; gap: .55rem; min-width: 0; padding: .4rem 1rem; overflow-x: auto; background: #303238; }
      .photo-viewer-thumbnail { flex: 0 0 56px; width: 56px; height: 40px; padding: 0; overflow: hidden; border: 2px solid transparent; border-radius: 4px; background: #45474c; cursor: pointer; opacity: .68; }
      .photo-viewer-thumbnail:hover { opacity: .92; }
      .photo-viewer-thumbnail.is-active { border-color: #d5a51b; opacity: 1; }
      .photo-viewer-thumbnail img { display: block; width: 100%; height: 100%; object-fit: cover; }
      .photo-viewer-action:focus-visible, .photo-viewer-arrow:focus-visible, .photo-viewer-thumbnail:focus-visible { outline: 2px solid #e0b329; outline-offset: 2px; }
      @media (max-width: 600px) { .ui-modal.photo-only-modal { grid-template-rows: minmax(0, 1fr) 58px; } .photo-only-modal .ui-modal__body { padding: .75rem 3rem 0; } .photo-only-modal .listing-photo-viewer { max-width: calc(100vw - 6rem); max-height: calc(100dvh - 58px - .75rem); } .photo-viewer-actions { gap: .3rem; } .photo-viewer-action { width: 34px; height: 34px; } .photo-viewer-arrow { width: 36px; height: 36px; } .photo-viewer-previous { left: .5rem; } .photo-viewer-next { right: .5rem; } .photo-viewer-thumbnail { flex-basis: 54px; width: 54px; height: 36px; } }
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
      .nearby-map-controls {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
      }
      .nearby-map-controls button,
      .nearby-map-controls label,
      .nearby-map-controls select {
        min-height: 40px;
        border: 1px solid #d6e3dc;
        border-radius: 0.5rem;
        background: #fff;
        color: #24483f;
        font: inherit;
        font-size: 0.82rem;
      }
      .nearby-map-controls button {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0 0.8rem;
        color: #11765f;
        font-weight: 700;
        cursor: pointer;
      }
      .nearby-map-controls button:disabled { opacity: 0.65; cursor: wait; }
      .nearby-map-controls label {
        display: inline-flex;
        align-items: center;
        gap: 0.55rem;
        padding-left: 0.75rem;
        color: #526b63;
        font-weight: 700;
      }
      .nearby-map-controls select {
        min-height: 38px;
        padding: 0 0.6rem;
        border: 0;
        color: #183a33;
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
      @media (max-width: 600px) {
        .nearby-map-controls { align-items: stretch; }
        .nearby-map-controls button, .nearby-map-controls label { flex: 1 1 auto; justify-content: center; }
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
      .ui-modal.tenant-nearby-listings-modal {
        width: min(96vw, 1200px);
        height: 94vh;
        height: 94dvh;
        max-height: 94vh;
        max-height: 94dvh;
      }
      .ui-modal.tenant-nearby-listings-modal .ui-modal__body {
        display: flex;
        flex: 1;
        min-height: 0;
        max-height: none;
        overflow: hidden;
      }
      .tenant-nearby-listings-modal .full-map-container {
        flex: 1;
        min-height: 0;
      }
      .tenant-nearby-listings-modal .full-map-container .leaflet-map {
        flex: 1;
        height: 100% !important;
        min-height: 0 !important;
      }
      .ui-modal.tenant-nearby-listings-modal .ui-modal__footer {
        display: none;
      }
      @media (max-width: 600px) {
        .ui-modal.tenant-nearby-listings-modal {
          width: calc(100vw - 0.5rem);
          height: calc(100vh - 0.5rem);
          height: calc(100dvh - 0.5rem);
          max-height: calc(100vh - 0.5rem);
          max-height: calc(100dvh - 0.5rem);
        }
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
  const { availableSlots } = resolveEffectiveOccupancy(property);
  const resolvedAvailable = Math.max(0, availableSlots);
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
        <div class="property-detail-price"><strong>${money(property.monthly_rent)}</strong><span>/ month</span></div>
        <p class="property-detail-location"><i class="bi bi-geo-alt" aria-hidden="true"></i>${esc(address || 'Not specified')}</p>
        <dl class="property-detail-facts">
          <div><dt>Room type</dt><dd>${esc(normalizeRoomType(property.room_type) || 'Not specified')}</dd></div>
          <div><dt>Availability</dt><dd>${esc(property.total_slots != null ? (resolvedAvailable ? `${resolvedAvailable} slot${resolvedAvailable === 1 ? '' : 's'} available` : 'No slots available') : 'Not specified')}</dd></div>
          <div><dt>Gender preference</dt><dd>${esc(normalizeGenderPreference(property.gender_preference) || 'Co-ed')}</dd></div>
          <div><dt>Owner</dt><dd>${esc(property.owner_name || 'Not specified')}</dd></div>
        </dl>
        <div class="property-detail-amenities"><h3>Amenities</h3>${amenities.length ? `<ul>${renderAmenitiesChips(property)}</ul>` : '<p>None listed.</p>'}</div>
        <div class="property-detail-description"><h3>About this property</h3><p>${esc(property.description || 'No description provided.')}</p></div>
      </div>
    </div>
    <form class="dashboard-request-form">
      <div class="dashboard-request-heading"><h3>Rental Request Details</h3></div>
      <input type="hidden" name="moveInDate" />
      <input type="hidden" name="moveOutDate" />
      <div class="dashboard-request-layout">
        <div class="dashboard-request-date-column">
          <section class="dashboard-date-picker" aria-label="Choose move-in and move-out dates">
            <div class="dashboard-date-picker__header">
              <div>
                <h4>Stay dates</h4>
                <p class="dashboard-date-picker__hint" aria-live="polite">Choose a move-in date</p>
              </div>
              <div class="dashboard-date-picker__navigation">
                <button type="button" class="dashboard-calendar-previous" aria-label="Previous month">&#8249;</button>
                <strong class="dashboard-calendar-month" aria-live="polite"></strong>
                <button type="button" class="dashboard-calendar-next" aria-label="Next month">&#8250;</button>
              </div>
            </div>
            <div class="dashboard-calendar-weekdays" aria-hidden="true">
              <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
            </div>
            <div class="dashboard-calendar-days" role="group" aria-label="Calendar dates"></div>
            <div class="dashboard-date-picker__summary" aria-live="polite">
              <span>Move-in <strong data-move-in-label>Not selected</strong></span>
              <span>Move-out <strong data-move-out-label>Not selected</strong></span>
            </div>
          </section>
          <label class="dashboard-indefinite-move-out">
            <input type="checkbox" name="isIndefiniteMoveOut" />
            <span><strong>Indefinite / No planned move-out date</strong></span>
          </label>
        </div>
        <section class="dashboard-guest-picker" aria-labelledby="dashboard-guest-heading">
          <div class="dashboard-guest-picker__heading">
            <h4 id="dashboard-guest-heading">Guests</h4>
            <p>Choose everyone who will stay</p>
          </div>
          <input type="hidden" name="occupants" value="1" />
          <div class="dashboard-guest-list">
            <div class="dashboard-guest-row" data-guest-row="adults">
              <span class="dashboard-guest-label"><strong>Adults</strong><small>Age 13+</small></span>
              <div class="dashboard-guest-controls">
                <button type="button" data-guest-action="decrease" aria-label="Remove an adult" disabled>−</button>
                <output data-guest-count="adults" aria-live="polite">1</output>
                <button type="button" data-guest-action="increase" aria-label="Add an adult">+</button>
              </div>
            </div>
            <div class="dashboard-guest-row" data-guest-row="children">
              <span class="dashboard-guest-label"><strong>Children</strong><small>Ages 2–12</small></span>
              <div class="dashboard-guest-controls">
                <button type="button" data-guest-action="decrease" aria-label="Remove a child" disabled>−</button>
                <output data-guest-count="children" aria-live="polite">0</output>
                <button type="button" data-guest-action="increase" aria-label="Add a child">+</button>
              </div>
            </div>
            <div class="dashboard-guest-row" data-guest-row="infants">
              <span class="dashboard-guest-label"><strong>Infants</strong><small>Under 2</small></span>
              <div class="dashboard-guest-controls">
                <button type="button" data-guest-action="decrease" aria-label="Remove an infant" disabled>−</button>
                <output data-guest-count="infants" aria-live="polite">0</output>
                <button type="button" data-guest-action="increase" aria-label="Add an infant">+</button>
              </div>
            </div>
            <div class="dashboard-guest-row" data-guest-row="pets">
              <span class="dashboard-guest-label"><strong>Pets</strong><small>Number of pets</small></span>
              <div class="dashboard-guest-controls">
                <button type="button" data-guest-action="decrease" aria-label="Remove a pet" disabled>−</button>
                <output data-guest-count="pets" aria-live="polite">0</output>
                <button type="button" data-guest-action="increase" aria-label="Add a pet">+</button>
              </div>
            </div>
          </div>
        </section>
      </div>
      <section class="dashboard-request-review" aria-labelledby="dashboard-review-heading" aria-live="polite" hidden>
        <h4 id="dashboard-review-heading">Review your request</h4>
        <p>Check your dates and guest details before sending this request.</p>
        <dl>
          <div><dt>Property</dt><dd data-review-property></dd></div>
          <div><dt>Move-in</dt><dd data-review-move-in></dd></div>
          <div><dt>Move-out</dt><dd data-review-move-out></dd></div>
          <div><dt>Adults</dt><dd data-review-adults></dd></div>
          <div><dt>Children</dt><dd data-review-children></dd></div>
          <div><dt>Infants</dt><dd data-review-infants></dd></div>
          <div><dt>Pets</dt><dd data-review-pets></dd></div>
        </dl>
        <button type="button" class="dashboard-edit-request">Edit request</button>
      </section>
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
    .tenant-property-detail-modal {
      background: #fff;
    }
    .tenant-property-detail-modal::backdrop {
      background: rgb(15 23 42 / 48%);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
    }
    body.tenant-property-details-open #app {
      filter: blur(5px);
    }
    .ui-modal:has(.property-detail-modal-content) { position: fixed; inset: 0; margin: auto; width: min(94vw, 1120px); max-height: calc(100vh - 2rem); }
    .ui-modal:has(.property-detail-modal-content) .ui-modal__header { padding: 1rem 1.25rem; border-color: #e2ece8; }
    .ui-modal:has(.property-detail-modal-content) .ui-modal__header h2 { color: #173b35; font-size: 1.05rem; font-weight: 750; }
    .ui-modal:has(.property-detail-modal-content) .ui-modal__header button { display: grid; place-items: center; width: 2.25rem; height: 2.25rem; border-radius: 50%; color: #365d54; font-size: 1.5rem; }
    .ui-modal:has(.property-detail-modal-content) .ui-modal__header button:hover { background: #edf6f2; }
    .ui-modal:has(.property-detail-modal-content) .ui-modal__body { padding: 20px; }
    .ui-modal:has(.property-detail-modal-content) .ui-modal__footer { padding: 1rem 1.25rem; border-color: #e2ece8; }
    .tenant-property-detail-modal .ui-modal__footer button { min-width: 5.25rem; background: #159879; color: #fff; }
    .tenant-property-detail-modal .ui-modal__footer button:hover { background: #107e65; }
    .property-detail-modal-content { display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, .95fr); gap: 24px; align-items: start; }
    .property-detail-gallery { min-width: 0; touch-action: pan-y; }
    .property-detail-gallery-stage { position: relative; height: 300px; overflow: hidden; border-radius: .75rem; background: #eaf1ee; }
    .property-detail-modal-image { display: block; width: 100%; height: 100%; object-fit: cover; cursor: zoom-in; }
    .property-detail-image-counter { position: absolute; bottom: .75rem; left: .75rem; padding: .25rem .55rem; border-radius: 999px; background: rgb(18 36 32 / 76%); color: #fff; font-size: .72rem; font-weight: 700; }
    .property-detail-gallery-nav { position: absolute; top: 50%; display: grid; place-items: center; width: 2.4rem; height: 2.4rem; padding: 0 0 .15rem; transform: translateY(-50%); border: 0; border-radius: 50%; background: rgb(18 36 32 / 65%); color: #fff; font: inherit; font-size: 1.8rem; line-height: 1; cursor: pointer; }
    .property-detail-gallery-nav:hover { background: rgb(18 36 32 / 88%); }
    .property-detail-gallery-previous { left: .7rem; }
    .property-detail-gallery-next { right: .7rem; }
    .property-detail-thumbnails { display: flex; height: 64px; gap: 8px; margin-top: 8px; padding: 0 1px 6px; overflow-x: auto; overflow-y: hidden; }
    .property-detail-thumbnail { flex: 0 0 64px; width: 64px; height: 48px; padding: 0; overflow: hidden; border: 2px solid transparent; border-radius: 4px; background: #e8f0ed; cursor: pointer; }
    .property-detail-thumbnail img { display: block; width: 100%; height: 100%; object-fit: cover; }
    .property-detail-thumbnail.is-active { border-color: #159879; }
    .property-detail-thumbnail:focus-visible, .property-detail-gallery-nav:focus-visible { outline: 2px solid #159879; outline-offset: 2px; }
    .property-detail-modal-info { min-width: 0; color: #193a34; }
    .property-detail-price { display: flex; align-items: baseline; gap: 6px; padding-bottom: 14px; border-bottom: 1px solid #e6eeea; }
    .property-detail-price strong { color: #153d32; font-size: 24px; }
    .property-detail-price span { color: #74837d; font-size: 13px; }
    .property-detail-location { display: flex; align-items: flex-start; gap: 7px; margin: 14px 0; color: #53675f; font-size: 13px; line-height: 1.5; }
    .property-detail-location i { color: #168365; }
    .property-detail-facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin: 0; padding: 14px 0; border-top: 1px solid #e6eeea; border-bottom: 1px solid #e6eeea; }
    .property-detail-facts div { min-width: 0; }
    .property-detail-facts dt { margin-bottom: 4px; color: #74837d; font-size: 11px; }
    .property-detail-facts dd { margin: 0; color: #203b33; font-size: 13px; font-weight: 700; overflow-wrap: anywhere; }
    .property-detail-amenities, .property-detail-description { margin-top: 15px; }
    .property-detail-amenities h3, .property-detail-description h3 { margin: 0 0 7px; color: #24473d; font-size: 13px; font-weight: 750; }
    .property-detail-amenities ul { display: flex; flex-wrap: wrap; gap: 6px; margin: 0; padding: 0; list-style: none; }
    .property-detail-amenities .amenity-chip { padding: 5px 8px; border-radius: 4px; background: #eef6f2; color: #28654f; font-size: 11px; text-transform: capitalize; }
    .property-detail-amenities p, .property-detail-description p { margin: 0; color: #64756e; font-size: 12px; line-height: 1.55; white-space: pre-line; }
    .property-photo-viewer { position: fixed; inset: 0; display: grid; grid-template-rows: minmax(0, 1fr) 64px; width: 100vw; height: 100vh; height: 100dvh; max-width: none; max-height: none; margin: 0; padding: 0; overflow: hidden; border: 0; background: #34363b; }
    .property-photo-viewer::backdrop { background: #25272b; }
    .property-photo-viewer__stage { position: relative; display: grid; place-items: center; min-height: 0; padding: .75rem 4.5rem 0; overflow: hidden; background: #37393e; }
    .property-photo-viewer__image { display: block; width: auto; height: auto; max-width: calc(100vw - 9rem); max-height: calc(100dvh - 64px - .75rem); object-fit: contain; border-radius: 0; user-select: none; -webkit-user-drag: none; }
    .property-photo-viewer .photo-viewer-actions { top: 1rem; right: 1rem; }
    .property-photo-viewer .photo-viewer-previous { left: 1rem; }
    .property-photo-viewer .photo-viewer-next { right: 1rem; }
    .property-photo-viewer .photo-viewer-thumbnails { height: 64px; }
    @media (max-width: 600px) {
      .property-photo-viewer__stage { padding: .75rem 3rem 0; }
      .property-photo-viewer__image { max-width: calc(100vw - 6rem); max-height: calc(100dvh - 64px - .75rem); }
      .property-photo-viewer .photo-viewer-previous { left: .5rem; }
      .property-photo-viewer .photo-viewer-next { right: .5rem; }
    }
    .dashboard-request-form { margin-top: 1.35rem; padding-top: 1.15rem; border-top: 1px solid #dce8e3; }
    .dashboard-request-heading { margin-bottom: .9rem; }
    .dashboard-request-heading h3 { margin: 0; color: #173b35; font-size: 1rem; font-weight: 750; }
    .dashboard-date-picker { margin-bottom: 1rem; padding: 1rem; border: 1px solid #dce8e3; border-radius: .7rem; background: #fff; color: #173b35; }
    .dashboard-date-picker__header { display: grid; grid-template-columns: minmax(0, 1fr); justify-items: center; gap: .5rem; margin-bottom: .85rem; text-align: center; }
    .dashboard-date-picker__header h4 { margin: 0; font-size: .95rem; font-weight: 750; }
    .dashboard-date-picker__hint { margin: .2rem 0 0; color: #61756e; font-size: .76rem; }
    .dashboard-date-picker__navigation { grid-column: 1; grid-row: 1; display: flex; align-items: center; justify-content: center; gap: .6rem; }
    .dashboard-date-picker__navigation strong { min-width: 9.5rem; text-align: center; font-size: .83rem; }
    .dashboard-date-picker__navigation button { display: grid; place-items: center; width: 2rem; height: 2rem; padding: 0; border: 1px solid #dce8e3; border-radius: 50%; background: #fff; color: #28654f; font: inherit; font-size: 1.2rem; cursor: pointer; }
    .dashboard-date-picker__navigation button:hover:not(:disabled) { background: #edf6f1; }
    .dashboard-date-picker__navigation button:disabled { opacity: .4; cursor: not-allowed; }
    .dashboard-calendar-weekdays, .dashboard-calendar-days { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: .3rem; }
    .dashboard-calendar-weekdays { margin-bottom: .3rem; }
    .dashboard-calendar-weekdays span { padding: .3rem 0; color: #71847b; font-size: .68rem; font-weight: 700; text-align: center; text-transform: uppercase; }
    .dashboard-calendar-day, .dashboard-calendar-empty { min-width: 0; min-height: 2.65rem; }
    .dashboard-calendar-day { border: 1px solid #e4ece8; border-radius: .4rem; background: #fff; color: #23483c; font: inherit; font-size: .8rem; cursor: pointer; }
    .dashboard-calendar-day:hover:not(:disabled):not(.is-selected) { border-color: #3b8f5b; background: #e6f1e8; }
    .dashboard-calendar-day:disabled { border-color: transparent; background: #fff; color: #bec9c3; cursor: not-allowed; }
    .dashboard-calendar-day.is-in-range { border-color: #c1dfca; background: #d8eadc; color: #244e34; }
    .dashboard-calendar-day.is-selected { border-color: #216b3a; background: #216b3a; color: #fff; font-weight: 750; }
    .dashboard-calendar-day:focus-visible, .dashboard-date-picker__navigation button:focus-visible { outline: 2px solid #216b3a; outline-offset: 2px; }
    .dashboard-date-picker__summary { display: flex; flex-wrap: wrap; gap: .5rem 1.25rem; margin-top: .8rem; padding: .65rem .75rem; border-radius: .45rem; background: #edf5ef; color: #496458; font-size: .75rem; }
    .dashboard-date-picker__summary strong { margin-left: .25rem; color: #1f4d32; }
    .dashboard-request-layout { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; align-items: start; }
    .dashboard-request-date-column { min-width: 0; }
    .dashboard-date-picker { margin-bottom: .75rem; }
    .dashboard-indefinite-move-out { display: flex; align-items: center; gap: .7rem; min-height: 3.75rem; padding: .7rem .8rem; border: 1px solid #8bb99a; border-radius: .55rem; background: #eaf4ec; color: #214f31; cursor: pointer; }
    .dashboard-indefinite-move-out:has(input:checked) { border-color: #216b3a; background: #d7eadb; box-shadow: 0 0 0 1px #216b3a; }
    .dashboard-indefinite-move-out input[type="checkbox"] { flex: 0 0 1.2rem; width: 1.2rem; height: 1.2rem; margin: 0; accent-color: #216b3a; }
    .dashboard-indefinite-move-out span { display: grid; gap: .15rem; }
    .dashboard-indefinite-move-out strong { font-size: .8rem; }
    .dashboard-indefinite-move-out small { color: #55705d; font-size: .72rem; font-weight: 500; }
    .dashboard-guest-picker { min-width: 0; padding: .85rem 1rem; border: 1px solid #dce8e3; border-radius: .65rem; }
    .dashboard-guest-picker__heading { margin-bottom: .35rem; }
    .dashboard-guest-picker__heading h4 { margin: 0; color: #173b35; font-size: .95rem; font-weight: 750; }
    .dashboard-guest-picker__heading p { margin: .2rem 0 0; color: #718078; font-size: .74rem; }
    .dashboard-guest-row { display: flex; align-items: center; justify-content: space-between; gap: .5rem; min-height: 4.1rem; border-bottom: 1px solid #e6eeea; }
    .dashboard-guest-row:last-child { border-bottom: 0; }
    .dashboard-guest-label { display: grid; gap: .15rem; color: #263c32; }
    .dashboard-guest-label strong { font-size: .82rem; font-weight: 650; }
    .dashboard-guest-label small { color: #78877f; font-size: .7rem; }
    .dashboard-guest-controls { display: flex; align-items: center; gap: .45rem; }
    .dashboard-guest-controls button { display: grid; place-items: center; width: 2rem; height: 2rem; padding: 0; border: 1px solid #d6e2db; border-radius: .35rem; background: #fff; color: #285d3b; font: inherit; font-size: 1.1rem; line-height: 1; cursor: pointer; }
    .dashboard-guest-controls button:hover:not(:disabled) { border-color: #6da57b; background: #edf5ef; }
    .dashboard-guest-controls button:disabled { color: #adb9b1; background: #f5f7f5; cursor: not-allowed; }
    .dashboard-guest-controls output { min-width: 1.4rem; color: #263c32; font-size: .85rem; text-align: center; }
    .dashboard-guest-controls button:focus-visible { outline: 2px solid #216b3a; outline-offset: 2px; }
    .dashboard-request-actions { display: flex; flex-wrap: wrap; gap: .6rem; margin-top: .9rem; }
    .dashboard-request-actions button { min-height: 42px; padding: .6rem 1rem; border: 1px solid #13856a; border-radius: .45rem; font: inherit; font-size: .82rem; font-weight: 700; cursor: pointer; }
    .dashboard-chat-owner { background: #fff; color: #11765f; }
    .dashboard-chat-owner:hover { background: #edf7f3; }
    .dashboard-send-request { background: #159879; color: #fff; }
    .dashboard-send-request:hover { background: #107e65; }
    .dashboard-request-review { margin-top: .9rem; padding: 1rem; border: 1px solid #c9ded0; border-radius: .55rem; background: #f3f8f4; color: #24483a; }
    .dashboard-request-review[hidden] { display: none; }
    .dashboard-request-review h4 { margin: 0; color: #173b35; font-size: .95rem; }
    .dashboard-request-review > p { margin: .25rem 0 .75rem; color: #687b70; font-size: .78rem; }
    .dashboard-request-review dl { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .55rem .9rem; margin: 0 0 .85rem; }
    .dashboard-request-review dl div { display: flex; justify-content: space-between; gap: .5rem; padding-bottom: .35rem; border-bottom: 1px solid #e0ebe3; font-size: .78rem; }
    .dashboard-request-review dt { color: #687b70; }
    .dashboard-request-review dd { margin: 0; color: #214f31; font-weight: 700; text-align: right; }
    .dashboard-edit-request { min-height: 36px; padding: .45rem .8rem; border: 1px solid #8bb99a; border-radius: .4rem; background: #fff; color: #285d3b; font: inherit; font-size: .78rem; font-weight: 700; cursor: pointer; }
    .dashboard-edit-request:hover { background: #eaf4ec; }
    .dashboard-request-status { min-height: 1.2rem; margin: .55rem 0 0; color: #7b4b2d; font-size: .82rem; }
    @media (max-width: 860px) {
      .property-detail-modal-content { grid-template-columns: minmax(0, 1fr); gap: 1.1rem; }
      .property-detail-gallery-stage { height: 280px; }
      .dashboard-request-layout { grid-template-columns: minmax(0, 1fr); }
    }
    @media (max-width: 560px) {
      .ui-modal:has(.property-detail-modal-content) { width: calc(100vw - 1rem); max-height: calc(100vh - 1rem); }
      .ui-modal:has(.property-detail-modal-content) .ui-modal__header { padding: .8rem 1rem; }
      .ui-modal:has(.property-detail-modal-content) .ui-modal__body { padding: 1rem; }
      .ui-modal:has(.property-detail-modal-content) .ui-modal__footer { padding: .7rem 1rem; }
      .property-detail-gallery-stage { height: 220px; }
      .property-detail-thumbnail { height: 54px; }
      .property-detail-facts { gap: .65rem; }
      .dashboard-date-picker { padding: .75rem; }
      .dashboard-calendar-days, .dashboard-calendar-weekdays { gap: .2rem; }
      .dashboard-calendar-day, .dashboard-calendar-empty { min-height: 2.35rem; }
      .dashboard-date-picker__navigation { gap: .3rem; }
      .dashboard-date-picker__navigation strong { min-width: 7rem; }
      .dashboard-request-actions button { flex: 1 1 9rem; }
    }
    @media (max-width: 360px) {
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
  const { totalSlots, occupiedSlots } = resolveEffectiveOccupancy(item);
  const occupancyLabel = totalSlots > 0
    ? `${occupiedSlots} / ${totalSlots} slots occupied`
    : 'Availability info unavailable';
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
          <a href="#/tenant/message?propertyId=${encodeURIComponent(item.id)}" class="action-btn secondary" target="_blank" rel="noopener noreferrer">Chat</a>
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
  const initials = getAvatarInitials(fullName, 'T');
  avatarEl.innerHTML = avatarUrl ? `<img src="${esc(avatarUrl)}" alt="${esc(fullName)} avatar" />` : `<b>${esc(initials)}</b>`;
  avatarEl.querySelector('img')?.addEventListener('error', () => {
    avatarEl.innerHTML = `<b>${esc(initials)}</b>`;
  }, { once: true });
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
async function showNearbyListingsModal(properties = [], { onViewDetails } = {}) {
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
      <div class="nearby-map-controls">
        <button id="nearby-map-locate" type="button"><i class="bi bi-crosshair" aria-hidden="true"></i><span>Use my location</span></button>
        <label>Radius<select id="nearby-map-radius" aria-label="Nearby search radius"><option value="1">1 km</option><option value="3">3 km</option><option value="5" selected>5 km</option><option value="10">10 km</option></select></label>
      </div>
      <div id="tenant-nearby-map" class="leaflet-map"></div>
      <p id="nearby-map-status" role="status" aria-live="polite"></p>
    </div>
  `;
  const modal = createModal({ title: 'Nearby Verified Listings', content: mapHtml, closeLabel: 'Close', closeOnBackdrop: false });
  modal.classList.add('tenant-nearby-listings-modal');
  
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
  
  // Clean up the map when the dialog is closed with its close controls.
  modal.addEventListener('close', cleanupMap);
  modal.addEventListener('click', (event) => {
    const photo = event.target.closest('.map-property-photo');
    const detailsButton = event.target.closest('.map-property-details');
    const directionsButton = event.target.closest('.map-property-directions');
    const propertyId = photo?.dataset.propertyId || detailsButton?.dataset.propertyId || directionsButton?.dataset.propertyId;
    if (!propertyId) return;
    const property = properties.find((item) => String(item.id) === String(propertyId));
    if (!property) return;

    if (photo) {
      const clickedImage = photo.currentSrc || photo.src;
      cleanupMap();
      modal.close();
      openTenantPhotoViewer(property, clickedImage);
    } else if (detailsButton) {
      cleanupMap();
      modal.close();
      onViewDetails?.(property);
    } else if (directionsButton) {
      const latitude = Number(property.latitude ?? property.lat);
      const longitude = Number(property.longitude ?? property.lng);
      const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
      window.open(mapsUrl, '_blank', 'noopener,noreferrer');
    }
  });
  
  openModal(modal);
  
  // Wait for modal to render and initialize map
  setTimeout(async () => {
    try {
      const mapContainer = modal.querySelector('#tenant-nearby-map');
      const statusEl = modal.querySelector('#nearby-map-status');
      const locateButton = modal.querySelector('#nearby-map-locate');
      const radiusSelect = modal.querySelector('#nearby-map-radius');
      
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
      mapContainer.style.height = '100%';
      mapContainer.style.display = 'block';
      
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

      const listingMarkers = [];
      let userLocation = null;
      let userMarker = null;
      let radiusCircle = null;
      const distanceInKm = (first, second) => {
        const radians = (degrees) => degrees * Math.PI / 180;
        const latitudeDelta = radians(second.latitude - first.latitude);
        const longitudeDelta = radians(second.longitude - first.longitude);
        const firstLatitude = radians(first.latitude);
        const secondLatitude = radians(second.latitude);
        const arc = Math.sin(latitudeDelta / 2) ** 2
          + Math.cos(firstLatitude) * Math.cos(secondLatitude) * Math.sin(longitudeDelta / 2) ** 2;
        return 6371 * 2 * Math.atan2(Math.sqrt(arc), Math.sqrt(1 - arc));
      };

      (properties || []).forEach((property) => {
        const latitudeValue = property.latitude ?? property.lat;
        const longitudeValue = property.longitude ?? property.lng;
        if (latitudeValue === '' || latitudeValue === null || latitudeValue === undefined
          || longitudeValue === '' || longitudeValue === null || longitudeValue === undefined) return;
        const latitude = Number(latitudeValue);
        const longitude = Number(longitudeValue);
        if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90
          || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) return;

        const title = esc(property.title || 'Property');
        const location = esc([property.barangay, property.city, property.municipality, property.province].filter(Boolean).join(', ') || 'Location not specified');
        const images = normalizePropertyImages(property);
        const image = images[0] || DEFAULT_IMAGE_PLACEHOLDER;
        const totalPhotos = Math.max(images.length, 1);
        const popupContent = `
          <div class="map-property-popup">
            <div class="map-property-card">
              <div class="map-property-image">
                <img class="map-property-photo" data-property-id="${esc(property.id ?? '')}" src="${esc(image)}" alt="${title}" />
                <span class="map-property-image-badge">1/${totalPhotos}</span>
              </div>
              <div class="map-property-body">
                <h3>${title}</h3>
                <div class="map-property-location"><span aria-hidden="true">📍</span> ${location}</div>
                <div class="map-property-price">${money(property.monthly_rent)} <span>/ month</span></div>
                <div class="map-property-actions">
                  <button type="button" class="map-property-details" data-property-id="${esc(property.id ?? '')}">View Details</button>
                  <button type="button" class="map-property-directions" data-property-id="${esc(property.id ?? '')}">Get Directions</button>
                </div>
              </div>
            </div>
          </div>`;
        const marker = window.L.marker([latitude, longitude]).addTo(mapInstance)
          .bindPopup(popupContent);
        listingMarkers.push({ marker, latitude, longitude });
      });

      if (listingMarkers.length > 1) {
        mapInstance.fitBounds(window.L.latLngBounds(listingMarkers.map(({ latitude, longitude }) => [latitude, longitude])), { padding: [40, 40] });
      } else if (listingMarkers.length === 1) {
        mapInstance.setView([listingMarkers[0].latitude, listingMarkers[0].longitude], 13);
      }

      const updateNearbyRadius = () => {
        if (!userLocation || !radiusSelect) return;
        const radiusInKm = Number(radiusSelect.value);
        if (radiusCircle) radiusCircle.remove();
        radiusCircle = window.L.circle([userLocation.latitude, userLocation.longitude], {
          radius: radiusInKm * 1000,
          color: '#1976d2',
          weight: 2,
          fillColor: '#58a9e8',
          fillOpacity: 0.16
        }).addTo(mapInstance);
        const nearbyCount = listingMarkers.filter(({ latitude, longitude }) =>
          distanceInKm(userLocation, { latitude, longitude }) <= radiusInKm
        ).length;
        listingMarkers.forEach(({ marker, latitude, longitude }) => {
          const isNearby = distanceInKm(userLocation, { latitude, longitude }) <= radiusInKm;
          marker.setOpacity(isNearby ? 1 : 0.3);
        });
        mapInstance.fitBounds(radiusCircle.getBounds(), { padding: [32, 32], maxZoom: 15 });
        if (statusEl) {
          const listingLabel = listingMarkers.length === 1 ? 'listing' : 'listings';
          statusEl.textContent = `${nearbyCount} of ${listingMarkers.length} mapped ${listingLabel} within ${radiusInKm} km of your location.`;
        }
      };

      radiusSelect?.addEventListener('change', updateNearbyRadius);
      locateButton?.addEventListener('click', () => {
        if (!navigator.geolocation) {
          if (statusEl) statusEl.textContent = 'Location services are not available in this browser.';
          return;
        }
        locateButton.disabled = true;
        locateButton.querySelector('span').textContent = 'Finding your location...';
        if (statusEl) statusEl.textContent = 'Waiting for location permission...';
        navigator.geolocation.getCurrentPosition((position) => {
          userLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          };
          userMarker?.remove();
          userMarker = window.L.circleMarker([userLocation.latitude, userLocation.longitude], {
            radius: 9,
            color: '#fff',
            weight: 3,
            fillColor: '#126fc1',
            fillOpacity: 1
          }).addTo(mapInstance).bindPopup('<strong>Your location</strong>');
          updateNearbyRadius();
          locateButton.disabled = false;
          locateButton.querySelector('span').textContent = 'Update my location';
        }, (error) => {
          const message = error.code === 1
            ? 'Location permission denied. Allow access in your browser to show your location.'
            : error.code === 3
              ? 'Location request timed out. Try again.'
              : 'Could not determine your location. Try again.';
          if (statusEl) statusEl.textContent = message;
          locateButton.disabled = false;
          locateButton.querySelector('span').textContent = 'Use my location';
        }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
      });

      if (statusEl) {
        statusEl.textContent = listingMarkers.length
          ? `${listingMarkers.length} listings have map coordinates. Use “Use my location” to see what is nearby.`
          : 'No listing coordinates are available. Use “Use my location” to center the map on you.';
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
                <div class="notification-dropdown-header">
                  <strong>Notifications</strong>
                  <div class="notification-dropdown-actions">
                    <button class="notification-more-button" type="button" aria-label="Notification actions" aria-expanded="false">
                      <svg class="notification-more-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.8"></circle><circle cx="12" cy="12" r="1.8"></circle><circle cx="19" cy="12" r="1.8"></circle></svg>
                    </button>
                    <div class="notification-actions-menu" hidden>
                      <button class="notification-mark-all-read" type="button"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"></path></svg><span>Mark all as read</span></button>
                    </div>
                  </div>
                </div>
                <div class="notification-filters" role="group" aria-label="Filter notifications">
                  <button class="notification-filter is-active" type="button" data-notification-filter="all" aria-pressed="true">All</button>
                  <button class="notification-filter" type="button" data-notification-filter="unread" aria-pressed="false">Unread</button>
                </div>
                <div class="notification-list"><p class="notification-empty">No notifications yet.</p></div>
              </div>
            </div>
            <a class="profile" href="#/tenant/setting">
              <span class="profile-avatar">${user.avatar_url ? `<img src="${esc(getUserAvatarUrl(user, displayName))}" alt="${esc(displayName)} avatar" onerror="this.onerror=null;this.src='${buildInitialsAvatarSvg(displayName, 'T')}'" />` : `<b>${esc(getAvatarInitials(displayName, 'T'))}</b>`}</span>
              <span class="profile-name">${esc(displayName)}</span>
            </a>
          </div>
        </header>

        ${user.verification_status === 'pending' ? `<section class="account-verification-notice" role="status" aria-live="polite"><strong>Account verification pending</strong><p>You can browse properties, but you cannot send inquiries or rental requests until an admin approves your account.</p></section>` : ''}

        <div id="tenant-schedule-notice" class="tenant-schedule-notice" role="status" hidden>
          <span class="tenant-schedule-notice-icon" aria-hidden="true"><i class="bi bi-calendar-check-fill"></i></span>
          <p id="tenant-schedule-notice-message"></p>
        </div>

        <section class="intro">
          <div>
            <small>FIND YOUR NEXT HOME</small>
            <h1>Discover places near campus.</h1>
            <p>Explore approved dorms and apartments that fit your lifestyle.</p>
          </div>
          <div class="near" role="status" aria-live="polite">${icon('target')} Nearby verified listings</div>
        </section>

        <section class="layout">
          <div class="map-column">
            <div class="map-stack">
              ${renderMapPanelShell({
                title: 'Map Overview',
                buttonLabel: 'View nearby listings',
                statusText: 'Loading real listings from the database...',
                query: 'DLSU, Manila, Philippines'
              })}
            </div>

            <section class="featured">
              <div class="section-title">
                <h2>Featured Listings</h2>
                <button class="mobile-filter-inline" type="button" aria-controls="tenant-filters" aria-expanded="false">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16l-6.5 7.5v5l-3 1.5v-7L4 5z"></path></svg>
                  <span>Filters</span>
                </button>
              </div>
              <div class="cards" id="featured-cards"></div>
            </section>
          </div>

          <aside class="filters" id="tenant-filters">
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
        <button class="mobile-filter-backdrop" type="button" aria-label="Close filters"></button>
      </main>
    </div>
  `;

  const tenantApp = root.querySelector('.dh-app');
  const hamburger = root.querySelector('.hamburger');
  hamburger?.addEventListener('click', () => {
    tenantApp?.classList.toggle('open');
  });
  const mobileFilterTriggers = Array.from(root.querySelectorAll('.mobile-filter-inline'));
  const mobileFilterBackdrop = root.querySelector('.mobile-filter-backdrop');
  const setMobileFiltersOpen = (isOpen) => {
    tenantApp?.querySelector('main')?.classList.toggle('mobile-filters-open', isOpen);
    mobileFilterTriggers.forEach((trigger) => trigger.setAttribute('aria-expanded', String(isOpen)));
  };
  mobileFilterTriggers.forEach((trigger) => {
    trigger.addEventListener('click', () => {
      const isOpen = tenantApp?.querySelector('main')?.classList.contains('mobile-filters-open') ?? false;
      setMobileFiltersOpen(!isOpen);
    });
  });
  mobileFilterBackdrop?.addEventListener('click', () => setMobileFiltersOpen(false));

  const notificationMenu = root.querySelector('.notification-menu');
  const notificationTrigger = root.querySelector('.notification-trigger');
  const notificationBadge = root.querySelector('.notification-badge');
  const notificationDropdown = root.querySelector('.notification-dropdown');
  const notificationList = root.querySelector('.notification-list');
  const notificationMoreButton = root.querySelector('.notification-more-button');
  const notificationActionsMenu = root.querySelector('.notification-actions-menu');
  const markAllNotificationsReadButton = root.querySelector('.notification-mark-all-read');
  const notificationFilterButtons = Array.from(notificationDropdown.querySelectorAll('[data-notification-filter]'));
  let notifications = [];
  let notificationFilter = 'all';

  const renderNotifications = () => {
    const unreadCount = notifications.filter((item) => !item.read_at).length;
    notificationBadge.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
    notificationBadge.hidden = unreadCount === 0;
    markAllNotificationsReadButton.disabled = unreadCount === 0;
    notificationFilterButtons.forEach((button) => {
      const isActive = button.dataset.notificationFilter === notificationFilter;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
    });
    const visibleNotifications = (notificationFilter === 'unread'
      ? notifications.filter((item) => !item.read_at)
      : notifications).slice(0, 6);
    notificationList.innerHTML = visibleNotifications.length
      ? visibleNotifications.map((item) => `
          <button class="notification-item${item.read_at ? '' : ' is-unread'}" type="button" data-notification-id="${item.id}">
            <span class="notification-item-copy"><strong>${esc(item.title || 'Notification')}</strong><span>${esc(item.message || '')}</span></span>
            <time>${esc(formatNotificationDate(item.created_at))}</time>
          </button>`).join('')
      : `<p class="notification-empty">${notificationFilter === 'unread' && notifications.length ? 'No unread notifications.' : 'No notifications yet.'}</p>`;
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
  notificationMoreButton.addEventListener('click', () => {
    const isOpen = !notificationActionsMenu.hidden;
    notificationActionsMenu.hidden = isOpen;
    notificationMoreButton.setAttribute('aria-expanded', String(!isOpen));
  });
  markAllNotificationsReadButton.addEventListener('click', async () => {
    const unreadNotifications = notifications.filter((item) => !item.read_at);
    if (!unreadNotifications.length) return;
    markAllNotificationsReadButton.disabled = true;
    const results = await Promise.allSettled(unreadNotifications.map((item) => markNotificationRead(item.id)));
    const readAt = new Date().toISOString();
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') unreadNotifications[index].read_at = readAt;
    });
    notificationActionsMenu.hidden = true;
    notificationMoreButton.setAttribute('aria-expanded', 'false');
    renderNotifications();
  });
  notificationDropdown.querySelector('.notification-filters').addEventListener('click', (event) => {
    const button = event.target.closest('[data-notification-filter]');
    if (!button) return;
    notificationFilter = button.dataset.notificationFilter;
    renderNotifications();
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
  const listingPageSize = 12;
  let listingPage = 0;
  let hasMoreListings = true;
  let isLoadingListings = false;
  let listingLoadError = '';
  let cardsObserver;
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
  const listingScrollContainer = root.querySelector('main');
  const clearButton = root.querySelector('#clear');
  const applyButton = root.querySelector('#apply-filters');
  const mapStatus = root.querySelector('#map-status');
  const mapPanel = root.querySelector('#shared-map');
  const mapFrame = root.querySelector('#tenant-map');
  const scheduleNotice = root.querySelector('#tenant-schedule-notice');
  const scheduleNoticeMessage = root.querySelector('#tenant-schedule-notice-message');
  const mapInitialization = initLeafletMap(root.querySelector('.map'), [], {
    viewStorageKey: 'dormhive.tenant.mapView',
    nearbyPlaces: true
  }).catch((error) => {
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

  const loadNextListingPage = async () => {
    if (isLoadingListings || !hasMoreListings) return;
    isLoadingListings = true;
    listingLoadError = '';
    const loadingButton = cards?.querySelector('.listing-load-more button');
    if (loadingButton) {
      loadingButton.disabled = true;
      loadingButton.textContent = 'Loading more listings...';
    }
    try {
      const nextPage = listingPage + 1;
      const response = await api(`/properties?page=${nextPage}&limit=${listingPageSize}&status=approved`);
      const pageItems = Array.isArray(response.data) ? response.data.filter((item) => isPropertyVisibleToTenant(item)) : [];
      const knownIds = new Set(state.all.map((item) => String(item.id)));
      state.all.push(...pageItems.filter((item) => !knownIds.has(String(item.id))));
      listingPage = nextPage;
      const total = Number(response.pagination?.total);
      hasMoreListings = Number.isFinite(total)
        ? listingPage * listingPageSize < total
        : pageItems.length === listingPageSize;
      state.visible = state.all;
      syncMapLocation(state.all);
    } catch (error) {
      listingLoadError = error.message || 'Unable to load more listings.';
    } finally {
      isLoadingListings = false;
      renderCards();
    }
  };

  if ('IntersectionObserver' in window) {
    cardsObserver = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) loadNextListingPage();
    }, { root: listingScrollContainer, rootMargin: '320px 0px', threshold: 0 });
  }

  const updateRangeNote = () => {
    maxPrice.value = String(range.value || MAX_LISTING_PRICE);
    rangeNote.textContent = `PHP 3,000 to PHP ${Number(range.value || MAX_LISTING_PRICE).toLocaleString('en-PH')}+`;
  };

  const renderScheduleNotice = (bookings = []) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const upcoming = bookings.flatMap((booking) => {
      if (String(booking.status).toLowerCase() !== 'approved') return [];
      const viewingDate = String(booking.viewing_date ?? '').slice(0, 10);
      const moveInDate = String(booking.move_in_date ?? '').slice(0, 10);
      const event = [
        ...(viewingDate >= todayKey ? [{ date: viewingDate, type: 'viewing' }] : []),
        ...(moveInDate >= todayKey ? [{ date: moveInDate, type: 'move-in' }] : [])
      ].sort((first, second) => first.date.localeCompare(second.date))[0];
      return event ? [{ ...event, property: booking.property_title || 'your selected property' }] : [];
    }).sort((first, second) => first.date.localeCompare(second.date));

    const nextSchedule = upcoming[0];
    if (!nextSchedule) {
      scheduleNotice.hidden = true;
      return;
    }
    const date = formatScheduleDate(nextSchedule.date);
    const message = nextSchedule.type === 'viewing'
      ? `You are now scheduled for a viewing at ${nextSchedule.property} on ${date}.`
      : `You are now scheduled to move in at ${nextSchedule.property} on ${date}.`;
    scheduleNoticeMessage.textContent = message;
    scheduleNotice.hidden = false;
  };

  const handleUserRefresh = async () => {
    const latestUser = await refreshTenantUserSession();
    syncTenantProfileUi(root, latestUser);
  };
  window.addEventListener('dormhive-user-updated', handleUserRefresh);

  const syncMapLocation = (items = []) => {
    if (!mapPanel) return;
    if (mapPanel.__leafletMapManager) updateLeafletMarkers(mapPanel, items);

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

    const modal = createModal({ title: property.title || 'Property Details', content: '', closeLabel: 'Close', closeOnBackdrop: false });
    modal.classList.add('tenant-property-detail-modal');
    document.body.classList.add('tenant-property-details-open');
    const clearPageBlur = () => document.body.classList.remove('tenant-property-details-open');
    modal.addEventListener('close', clearPageBlur, { once: true });
    window.addEventListener('hashchange', clearPageBlur, { once: true });
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
        const viewerPhotos = galleryImages.length ? galleryImages : [galleryImage.src];
        let viewerIndex = Math.min(galleryIndex, viewerPhotos.length - 1);
        const previousButton = document.createElement('button');
        previousButton.type = 'button';
        previousButton.className = 'photo-viewer-arrow photo-viewer-previous';
        previousButton.setAttribute('aria-label', 'View previous photo');
        previousButton.title = 'Previous photo';
        previousButton.innerHTML = '<i class="bi bi-chevron-left" aria-hidden="true"></i>';
        const nextButton = document.createElement('button');
        nextButton.type = 'button';
        nextButton.className = 'photo-viewer-arrow photo-viewer-next';
        nextButton.setAttribute('aria-label', 'View next photo');
        nextButton.title = 'Next photo';
        nextButton.innerHTML = '<i class="bi bi-chevron-right" aria-hidden="true"></i>';
        const closeButton = document.createElement('button');
        closeButton.type = 'button';
        closeButton.className = 'photo-viewer-action photo-viewer-dismiss';
        closeButton.setAttribute('aria-label', 'Close photo viewer');
        closeButton.title = 'Close viewer';
        closeButton.innerHTML = '<i class="bi bi-x-lg" aria-hidden="true"></i>';
        const downloadButton = document.createElement('button');
        downloadButton.type = 'button';
        downloadButton.className = 'photo-viewer-action photo-viewer-download';
        downloadButton.setAttribute('aria-label', 'Download photo');
        downloadButton.title = 'Download photo';
        downloadButton.innerHTML = '<i class="bi bi-download" aria-hidden="true"></i>';
        const shareButton = document.createElement('button');
        shareButton.type = 'button';
        shareButton.className = 'photo-viewer-action photo-viewer-share';
        shareButton.setAttribute('aria-label', 'Share photo');
        shareButton.title = 'Share photo';
        shareButton.innerHTML = '<i class="bi bi-share" aria-hidden="true"></i>';
        const actions = document.createElement('div');
        actions.className = 'photo-viewer-actions';
        actions.append(downloadButton, shareButton, closeButton);
        const stage = document.createElement('div');
        stage.className = 'property-photo-viewer__stage';
        stage.append(viewerImage, previousButton, nextButton, actions);
        const thumbnails = document.createElement('nav');
        thumbnails.className = 'photo-viewer-thumbnails';
        thumbnails.setAttribute('aria-label', 'Property photos');
        const thumbnailButtons = viewerPhotos.map((photo, index) => {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'photo-viewer-thumbnail';
          button.dataset.photoIndex = String(index);
          button.setAttribute('aria-label', `View photo ${index + 1}`);
          const thumbnail = document.createElement('img');
          thumbnail.src = photo;
          thumbnail.alt = '';
          thumbnail.loading = 'lazy';
          button.append(thumbnail);
          thumbnails.append(button);
          return button;
        });
        const renderViewerImage = (nextIndex) => {
          viewerIndex = (nextIndex + viewerPhotos.length) % viewerPhotos.length;
          if (galleryImages.length) showGalleryImage(viewerIndex);
          viewerImage.src = viewerPhotos[viewerIndex];
          viewerImage.alt = `${property.title || 'Property'} photo ${viewerIndex + 1}`;
          previousButton.hidden = viewerPhotos.length < 2;
          nextButton.hidden = viewerPhotos.length < 2;
          thumbnailButtons.forEach((button, index) => {
            const active = index === viewerIndex;
            button.classList.toggle('is-active', active);
            button.setAttribute('aria-current', String(active));
          });
        };
        previousButton.addEventListener('click', () => renderViewerImage(viewerIndex - 1));
        nextButton.addEventListener('click', () => renderViewerImage(viewerIndex + 1));
        thumbnails.addEventListener('click', (event) => {
          const button = event.target.closest('.photo-viewer-thumbnail');
          if (button) renderViewerImage(Number(button.dataset.photoIndex));
        });
        const removeViewer = () => viewer.remove();
        closeButton.addEventListener('click', () => viewer.close());
        viewer.addEventListener('click', (event) => { if (event.target === viewer) viewer.close(); });
        viewer.addEventListener('close', removeViewer, { once: true });
        viewer.addEventListener('keydown', (event) => {
          if (event.key === 'ArrowLeft' && viewerPhotos.length > 1) { event.preventDefault(); renderViewerImage(viewerIndex - 1); }
          if (event.key === 'ArrowRight' && viewerPhotos.length > 1) { event.preventDefault(); renderViewerImage(viewerIndex + 1); }
        });
        downloadButton.addEventListener('click', async () => {
          try {
            const response = await fetch(viewerPhotos[viewerIndex]);
            if (!response.ok) throw new Error('Download failed');
            const objectUrl = URL.createObjectURL(await response.blob());
            const link = document.createElement('a');
            link.href = objectUrl;
            link.download = `${String(property.title || 'property').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')}-photo-${viewerIndex + 1}`;
            link.click();
            setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
          } catch { window.open(viewerPhotos[viewerIndex], '_blank', 'noopener,noreferrer'); }
        });
        shareButton.addEventListener('click', async () => {
          try {
            if (navigator.share) await navigator.share({ title: property.title || 'Property photo', url: viewerPhotos[viewerIndex] });
            else if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(viewerPhotos[viewerIndex]);
            else window.open(viewerPhotos[viewerIndex], '_blank', 'noopener,noreferrer');
          } catch (error) {
            if (error.name !== 'AbortError') window.open(viewerPhotos[viewerIndex], '_blank', 'noopener,noreferrer');
          }
        });
        viewer.append(stage, thumbnails);
        renderViewerImage(viewerIndex);
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
    const calendarDays = form.querySelector('.dashboard-calendar-days');
    const calendarMonth = form.querySelector('.dashboard-calendar-month');
    const calendarHint = form.querySelector('.dashboard-date-picker__hint');
    const moveInLabel = form.querySelector('[data-move-in-label]');
    const moveOutLabel = form.querySelector('[data-move-out-label]');
    const previousMonthButton = form.querySelector('.dashboard-calendar-previous');
    const nextMonthButton = form.querySelector('.dashboard-calendar-next');
    const occupantsInput = form.querySelector('[name="occupants"]');
    const reviewPanel = form.querySelector('.dashboard-request-review');
    const submitButton = form.querySelector('.dashboard-send-request');
    const guestCounts = { adults: 1, children: 0, infants: 0, pets: 0 };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const todayKey = dateKey(today);
    let displayedMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const formatCalendarDate = (dateValue) => new Intl.DateTimeFormat(undefined, { month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(`${dateValue}T00:00:00`));
    const reviewDate = (dateValue) => dateValue ? formatCalendarDate(dateValue) : 'Not selected';
    const updateReview = () => {
      reviewPanel.querySelector('[data-review-property]').textContent = property.title || 'Property';
      reviewPanel.querySelector('[data-review-move-in]').textContent = reviewDate(moveIn.value);
      reviewPanel.querySelector('[data-review-move-out]').textContent = indefiniteMoveOut.checked ? 'Indefinite / No planned move-out date' : reviewDate(moveOut.value);
      for (const [guestType, count] of Object.entries(guestCounts)) {
        reviewPanel.querySelector(`[data-review-${guestType}]`).textContent = String(count);
      }
    };
    let isReviewingRequest = false;
    const renderCalendar = () => {
      calendarMonth.textContent = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(displayedMonth);
      previousMonthButton.disabled = displayedMonth.getFullYear() === today.getFullYear() && displayedMonth.getMonth() === today.getMonth();
      const monthStart = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth(), 1);
      const daysInMonth = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() + 1, 0).getDate();
      const cells = [];
      for (let blank = 0; blank < monthStart.getDay(); blank += 1) cells.push('<span class="dashboard-calendar-empty" aria-hidden="true"></span>');
      for (let day = 1; day <= daysInMonth; day += 1) {
        const date = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth(), day);
        const value = dateKey(date);
        const isSelected = value === moveIn.value || value === moveOut.value;
        const isInRange = moveIn.value && moveOut.value && value > moveIn.value && value < moveOut.value;
        const classes = ['dashboard-calendar-day', isSelected ? 'is-selected' : '', isInRange ? 'is-in-range' : ''].filter(Boolean).join(' ');
        const disabled = value < todayKey;
        const dateLabel = formatCalendarDate(value);
        cells.push(`<button type="button" class="${classes}" data-calendar-date="${value}" aria-label="${dateLabel}" aria-pressed="${isSelected}"${disabled ? ' disabled' : ''}>${day}</button>`);
      }
      calendarDays.innerHTML = cells.join('');
      moveInLabel.textContent = moveIn.value ? formatCalendarDate(moveIn.value) : 'Not selected';
      moveOutLabel.textContent = indefiniteMoveOut.checked ? 'Indefinite' : (moveOut.value ? formatCalendarDate(moveOut.value) : 'Not selected');
      calendarHint.textContent = indefiniteMoveOut.checked
        ? 'Choose or update a move-in date'
        : moveIn.value && moveOut.value
          ? 'Select another date to start a new stay'
          : moveIn.value
            ? 'Now choose a move-out date, or select another date to change move-in'
            : 'Choose a move-in date';
    };
    calendarDays.addEventListener('click', (event) => {
      const dayButton = event.target.closest('[data-calendar-date]');
      if (!dayButton || dayButton.disabled) return;
      const selectedDate = dayButton.dataset.calendarDate;
      indefiniteMoveOut.checked = false;
      if (!moveIn.value || moveOut.value || selectedDate <= moveIn.value) {
        moveIn.value = selectedDate;
        moveOut.value = '';
      } else {
        moveOut.value = selectedDate;
      }
      status.textContent = '';
      renderCalendar();
      if (isReviewingRequest) updateReview();
    });
    previousMonthButton.addEventListener('click', () => {
      displayedMonth = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() - 1, 1);
      renderCalendar();
    });
    nextMonthButton.addEventListener('click', () => {
      displayedMonth = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() + 1, 1);
      renderCalendar();
    });
    renderCalendar();
    form.querySelector('.dashboard-guest-list').addEventListener('click', (event) => {
      const actionButton = event.target.closest('[data-guest-action]');
      if (!actionButton) return;
      const guestRow = actionButton.closest('[data-guest-row]');
      const guestType = guestRow.dataset.guestRow;
      const minimum = guestType === 'adults' ? 1 : 0;
      guestCounts[guestType] = Math.max(minimum, guestCounts[guestType] + (actionButton.dataset.guestAction === 'increase' ? 1 : -1));
      guestRow.querySelector('[data-guest-count]').textContent = String(guestCounts[guestType]);
      guestRow.querySelector('[data-guest-action="decrease"]').disabled = guestCounts[guestType] === minimum;
      occupantsInput.value = String(guestCounts.adults + guestCounts.children + guestCounts.infants);
      status.textContent = '';
      if (isReviewingRequest) updateReview();
    });
    indefiniteMoveOut.addEventListener('change', () => {
      if (indefiniteMoveOut.checked) moveOut.value = '';
      renderCalendar();
      if (isReviewingRequest) updateReview();
    });
    form.querySelector('.dashboard-edit-request').addEventListener('click', () => {
      isReviewingRequest = false;
      reviewPanel.hidden = true;
      submitButton.textContent = 'Send Request';
      status.textContent = '';
    });
    modal.querySelector('.dashboard-chat-owner').addEventListener('click', () => {
      const chatUrl = new URL(window.location.href);
      chatUrl.hash = `/tenant/message?propertyId=${encodeURIComponent(property.id)}`;
      const chatWindow = window.open(chatUrl.href, '_blank', 'noopener,noreferrer');
      if (chatWindow) chatWindow.opener = null;
    });
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (user.verification_status === 'pending') {
        status.textContent = 'Your account is pending review. Inquiries unlock after admin approval.';
        return;
      }
      if (!form.reportValidity()) return;
      if (!moveIn.value) {
        status.textContent = 'Choose a move-in date.';
        return;
      }
      if (!indefiniteMoveOut.checked && moveOut.value && moveIn.value && moveOut.value <= moveIn.value) {
        status.textContent = 'Move-out date must be after the move-in date.';
        return;
      }
      if (!isReviewingRequest) {
        updateReview();
        reviewPanel.hidden = false;
        reviewPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        isReviewingRequest = true;
        submitButton.textContent = 'Confirm & Send Request';
        status.textContent = 'Review your request details, then confirm to send.';
        return;
      }
      const formData = new FormData(form);
      submitButton.disabled = true;
      try {
        const response = await fetch(`${API_URL}/bookings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('dormhive.accessToken') ?? ''}` },
          body: JSON.stringify({ propertyId: Number(property.id), moveInDate: formData.get('moveInDate'), moveOutDate: indefiniteMoveOut.checked ? null : formData.get('moveOutDate') || null, isIndefiniteMoveOut: indefiniteMoveOut.checked, occupants: Number(formData.get('occupants') || 1), message: `Adults: ${guestCounts.adults}; Children: ${guestCounts.children}; Infants: ${guestCounts.infants}; Pets: ${guestCounts.pets}.` })
        });
        const body = await readApiResponse(response);
        if (!response.ok) throw new Error(getApiErrorMessage(body, 'Unable to submit booking request.'));
        modal.close();
        await successDialog('Booking request sent successfully.');
      } catch (error) {
        status.textContent = error.message;
        submitButton.disabled = false;
      }
    });
    if (user.verification_status === 'pending') {
      form.querySelectorAll('input, button, select, textarea').forEach((control) => { control.disabled = true; });
      status.textContent = 'Your account is pending review. Inquiries unlock after admin approval.';
    }
    openModal(modal);
  };

  const renderFeaturedCards = (items = []) => {
    if (!cards) return;
    if (!items.length) {
      cards.innerHTML = `<div class="empty">${hasMoreListings ? 'No listings match yet. Scroll to load more.' : 'No properties found'}</div>`;
      if (hasMoreListings || listingLoadError) {
        const loadMore = document.createElement('div');
        loadMore.className = 'listing-load-more';
        loadMore.setAttribute('aria-live', 'polite');
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = listingLoadError ? 'Could not load more listings. Try again' : 'Load more listings';
        button.disabled = isLoadingListings;
        button.addEventListener('click', loadNextListingPage);
        loadMore.append(button);
        cards.append(loadMore);
        if (cardsObserver && !isLoadingListings && !listingLoadError) cardsObserver.observe(loadMore);
      }
      return;
    }

    const favoriteIds = new Set(getFavoriteListingIds());
    cards.innerHTML = items.map((item, index) => {
      const location = locationText(item);
      const roomType = normalizeRoomType(item.room_type);
      const gender = normalizeGenderPreference(item.gender_preference);
      const availableSlots = Number(item.available_slots ?? item.total_slots ?? 0);
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
            <img src="${esc(galleryImages[0])}" alt="${esc(item.title || 'Listing photo')}" class="listing-photo" loading="lazy" decoding="async" />
            <em>${esc(item.status === 'approved' ? 'Verified' : (item.status || 'Approved'))}</em>
            <button type="button" class="favorite-toggle${isFavorite ? ' is-favorited' : ''}" data-property-id="${item.id}" aria-label="${isFavorite ? 'Remove from favorites' : 'Save listing'}" aria-pressed="${isFavorite}">${heartIcon(isFavorite)}</button>
            <button type="button" class="favorite-toggle${isFavorite ? ' is-favorited' : ''}" data-property-id="${item.id}" aria-label="${isFavorite ? 'Remove from favorites' : 'Save listing'}" aria-pressed="${isFavorite}">${heartIcon(isFavorite)}</button>
            ${dots}
          </div>
          <div class="listing-body">
            <p class="place">${icon('pin')}${esc(location)}</p>
            <h3>${esc(item.title || 'Available dorm space')}</h3>
            <p class="meta">${esc(roomType)} &bull; ${availableSlots} slot${availableSlots === 1 ? '' : 's'} available</p>
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
        openTenantPhotoViewer(property, clickedImage);
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

    if (hasMoreListings || isLoadingListings || listingLoadError) {
      const loadMore = document.createElement('div');
      loadMore.className = 'listing-load-more';
      loadMore.setAttribute('aria-live', 'polite');
      const loadMoreButton = document.createElement('button');
      loadMoreButton.type = 'button';
      loadMoreButton.textContent = listingLoadError
        ? 'Could not load more listings. Try again'
        : isLoadingListings ? 'Loading more listings...' : 'Load more listings';
      loadMoreButton.disabled = isLoadingListings;
      loadMoreButton.addEventListener('click', loadNextListingPage);
      loadMore.append(loadMoreButton);
      cards.append(loadMore);
      if (cardsObserver && !isLoadingListings && !listingLoadError) cardsObserver.observe(loadMore);
    }
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

  applyButton.addEventListener('click', () => {
    renderCards();
    setMobileFiltersOpen(false);
  });
  search.addEventListener('input', renderCards);
  let searchRequestId = 0;
  const focusSearchedLocation = async (requestId = searchRequestId) => {
    const query = search.value.trim();
    if (!query || !mapPanel?.__leafletMapManager) return;
    if (mapStatus) mapStatus.textContent = `Finding ${query}...`;
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`, {
        headers: { Accept: 'application/json' }
      });
      if (!response.ok) throw new Error('Location search failed.');
      const results = await response.json();
      if (requestId !== searchRequestId || search.value.trim() !== query) return;
      const result = results[0];
      if (!result) {
        if (mapStatus) mapStatus.textContent = `No map location found for ${query}.`;
        return;
      }
      mapPanel.__leafletMapManager.setSearchLocation({
        latitude: Number(result.lat),
        longitude: Number(result.lon),
        label: query,
        radiusInKm: TENANT_SEARCH_RADIUS_KM
      });
      if (mapStatus) {
        const nearbyCount = mapPanel.__leafletMapManager.countNearbyItems(TENANT_SEARCH_RADIUS_KM);
        const propertyLabel = nearbyCount === 1 ? 'property' : 'properties';
        mapStatus.textContent = `${nearbyCount} ${propertyLabel} within ${TENANT_SEARCH_RADIUS_KM} km of ${query}.`;
      }
    } catch (error) {
      if (requestId === searchRequestId && mapStatus) mapStatus.textContent = error.message;
    }
  };
  let searchTimer;
  search.addEventListener('input', () => {
    renderCards();
    clearTimeout(searchTimer);
    const query = search.value.trim();
    const requestId = ++searchRequestId;
    if (!query) {
      mapPanel?.__leafletMapManager?.clearSearchLocation();
      return;
    }
    searchTimer = setTimeout(() => focusSearchedLocation(requestId), 600);
  });
  search.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    clearTimeout(searchTimer);
    renderCards();
    focusSearchedLocation(++searchRequestId);
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
  // Add event listener for View nearby listings button in map panel
  const mapPanelButton = root.querySelector('.map-panel .panel-button');
  if (mapPanelButton) {
    mapPanelButton.addEventListener('click', async () => {
      try {
        await showNearbyListingsModal(getNearbySearchResults(), { onViewDetails: openPropertyDetails });
      } catch (error) {
        console.error('Nearby listings modal error:', error);
        alert('Could not open nearby listings map.');
      }
    });
  }

  const openMapPropertyPhotoViewer = (property, clickedImage = null) => {
    openTenantPhotoViewer(property, clickedImage);
  };

  root.addEventListener('click', (event) => {
    const propertyPhoto = event.target.closest('.map-property-photo');
    if (propertyPhoto && root.contains(propertyPhoto)) {
      const property = state.all.find((item) => String(item.id) === String(propertyPhoto.dataset.propertyId));
      if (property) {
        const clickedImage = propertyPhoto.currentSrc || propertyPhoto.src;
        openMapPropertyPhotoViewer(property, clickedImage);
      }
      return;
    }

    const detailsButton = event.target.closest('.map-property-details');
    if (detailsButton && root.contains(detailsButton)) {
      const property = state.all.find((item) => String(item.id) === String(detailsButton.dataset.propertyId));
      if (property) openPropertyDetails(property);
      return;
    }

    const directionsButton = event.target.closest('.map-property-directions');
    if (directionsButton && root.contains(directionsButton)) {
      const property = state.all.find((item) => String(item.id) === String(directionsButton.dataset.propertyId));
      if (!property) return;
      const latitude = Number(property.latitude ?? property.lat ?? NaN);
      const longitude = Number(property.longitude ?? property.lng ?? NaN);
      const destination = Number.isFinite(latitude) && Number.isFinite(longitude)
        ? `${latitude},${longitude}`
        : encodeURIComponent(property.address || property.municipality || property.title || 'property');
      const mapsUrl = Number.isFinite(latitude) && Number.isFinite(longitude)
        ? `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`
        : `https://www.google.com/maps/search/?api=1&query=${destination}`;
      window.open(mapsUrl, '_blank', 'noopener,noreferrer');
    }
  });

  const load = async () => {
    renderSkeletonState();
    try {
      const [response, bookingsResponse] = await Promise.all([
        api(`/properties?page=1&limit=${listingPageSize}&status=approved`),
        api('/bookings').catch((error) => {
          console.warn('Unable to load approved booking schedules:', error);
          return { data: [] };
        })
      ]);
      state.all = Array.isArray(response.data) ? response.data.filter((item) => isPropertyVisibleToTenant(item)) : [];
      listingPage = 1;
      const total = Number(response.pagination?.total);
      hasMoreListings = Number.isFinite(total) ? listingPage * listingPageSize < total : state.all.length === listingPageSize;
      state.visible = state.all;
      renderScheduleNotice(Array.isArray(bookingsResponse.data) ? bookingsResponse.data : []);
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

  const refreshLoadedListingPages = async () => {
    if (!root.isConnected || isLoadingListings || listingPage < 1) return;
    try {
      const pages = Array.from({ length: listingPage }, (_, index) => index + 1);
      const responses = await Promise.all(pages.map((page) => api(`/properties?page=${page}&limit=${listingPageSize}&status=approved`)));
      state.all = responses.flatMap((response) => Array.isArray(response.data)
        ? response.data.filter((item) => isPropertyVisibleToTenant(item))
        : []);
      const total = Number(responses[0]?.pagination?.total);
      hasMoreListings = Number.isFinite(total) ? listingPage * listingPageSize < total : state.all.length >= listingPage * listingPageSize;
      state.visible = state.all;
      syncMapLocation(state.all);
      renderCards();
    } catch (error) {
      console.warn('Unable to refresh approved listings:', error);
    }
  };

  syncTenantProfileUi(root, user);
  updateRangeNote();
  load();

  // Periodically refresh approved listings so admin status changes propagate to tenants.
  // This keeps Featured Listings and map markers in sync when an admin approves/rejects properties.
  const POLL_INTERVAL = 15000; // 15 seconds
  const listingPoll = setInterval(() => {
    if (!tenantApp.isConnected) {
      clearInterval(listingPoll);
      return;
    }
    refreshLoadedListingPages();
  }, POLL_INTERVAL);
}
