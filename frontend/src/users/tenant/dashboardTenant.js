import { renderMapPanelShell, initLeafletMap, updateLeafletMarkers } from '../../components/mapPanel.js';
import { ensureTenantSidebarStyles, renderTenantSidebar } from './sidebarTenant.js';
import { getUserAvatarUrl } from './avatar.js';

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
const esc = (value = '') => {
  const node = document.createElement('span');
  node.textContent = value;
  return node.innerHTML;
};
const money = (value = 0) => `PHP ${Number(value || 0).toLocaleString('en-PH')}`;
const glyph = { grid: '&#9638;', chat: '&#9993;', calendar: '&#9783;', gear: '&#9881;', menu: '&#9776;', search: '&#9906;', bell: '&#9679;', pin: '&#9679;', heart: '&#9825;', home: '&#8962;', walk: '&#10148;', target: '&#8857;', layers: '&#9638;', arrow: '&#8594;', chevron: '&#8964;', wifi: '&#8976;', snow: '&#10052;', kitchen: '&#9832;', laundry: '&#8635;', car: '&#9670;' };
const icon = (name) => `<span class="icon">${glyph[name] ?? ''}</span>`;

function loadStyle() {
  if (!document.querySelector('[data-tenant-style="dashboard"]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = new URL('./style/dashboardTenant.css', import.meta.url);
    link.dataset.tenantStyle = 'dashboard';
    document.head.append(link);
  }
  if (!document.querySelector('[data-tenant-style="amenities"]')) {
    const aLink = document.createElement('link');
    aLink.rel = 'stylesheet';
    aLink.href = new URL('./style/amenities.css', import.meta.url);
    aLink.dataset.tenantStyle = 'amenities';
    document.head.append(aLink);
  }
}

function cleanupDuplicateTenantSidebarStyles() {
  document.querySelectorAll('link[data-tenant-sidebar-style], link[data-tenant-style="sidebar"], link[data-tenant-style="tenant-sidebar"]').forEach((link) => {
    if (link.dataset.tenantSidebarStyle !== 'shared') {
      link.remove();
    }
  });
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
  const body = await response.json();
  if (!response.ok) throw new Error(body.message ?? 'Unable to load listings.');
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

function locationText(item) {
  return [item.barangay, item.municipality, item.address].filter(Boolean).join(', ') || 'Manila';
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
          <a href="#/tenant/booking?propertyId=${item.id}" class="action-btn">Request</a>
          <a href="#/tenant/message?propertyId=${item.id}" class="action-btn secondary">Chat</a>
        </div>
      </div>
    </article>
  `;
}

export function renderDashboardTenant(root = document.querySelector('#app')) {
  if (!root) throw new Error('Tenant dashboard requires #app.');
  cleanupDuplicateTenantSidebarStyles();
  loadStyle();
  ensureTenantSidebarStyles();

  const user = session();
  const displayName = user.name || 'Tenant';
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
            <button type="button">${icon('bell')}<i></i></button>
            <button class="message-link" type="button">${icon('chat')}</button>
            <a class="profile" href="#/tenant/setting">
              <span class="profile-avatar">${user.avatar_url ? `<img src="${esc(getUserAvatarUrl(user))}" alt="${esc(displayName)} avatar" />` : `<b>${esc((user.name || 'T')[0].toUpperCase())}</b>`}</span>
              <span>${esc((user.role || 'tenant').toLowerCase())}</span>
              ${icon('chevron')}
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
                <label><input type="checkbox" name="amenity" value="wifi"> ${icon('wifi')} Wi-Fi</label>
                <label><input type="checkbox" name="amenity" value="laundry"> ${icon('laundry')} Laundry</label>
                <label><input type="checkbox" name="amenity" value="kitchen"> ${icon('kitchen')} Kitchen</label>
                <label><input type="checkbox" name="amenity" value="aircon"> ${icon('snow')} Aircon</label>
                <label><input type="checkbox" name="amenity" value="pets_allowed"> Pets allowed</label>
                <label><input type="checkbox" name="amenity" value="dishwasher"> Dishwasher</label>
                <label><input type="checkbox" name="amenity" value="balcony"> Balcony</label>
                <label><input type="checkbox" name="amenity" value="parking"> ${icon('car')} Parking</label>
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

  const updateRangeNote = () => {
    maxPrice.value = String(range.value || 15000);
    rangeNote.textContent = `PHP 3,000 to PHP ${Number(range.value || 15000).toLocaleString('en-PH')}+`;
  };

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
      const image = normalizePropertyImage(item) || DEFAULT_IMAGE_PLACEHOLDER;
      const walkDistance = (0.6 + index * 0.25).toFixed(1);
      const amenitySummary = renderAmenitiesChips(item) || '<span class="empty-amenity">No amenities listed</span>';

      return `
        <article class="listing" data-id="${item.id}">
          <div class="photo p${index % 4}">
            <img src="${esc(image)}" alt="${esc(item.title || 'Listing photo')}" class="listing-photo" />
            <em>${esc(item.status === 'approved' ? 'Verified' : (item.status || 'Approved'))}</em>
            <button aria-label="Save listing">${icon('heart')}</button>
          </div>
          <div class="listing-body">
            <p class="place">${icon('pin')}${esc(location)}</p>
            <h3>${esc(item.title || 'Available dorm space')}</h3>
            <p class="meta">${esc(roomType)} &bull; Up to ${maxOccupants} tenants</p>
            <p class="meta"><strong>Gender:</strong> ${esc(gender)}</p>
            <div class="amenity-summary">${amenitySummary}</div>
            <div class="price"><strong>${money(item.monthly_rent)}</strong><small>/ month</small><span>${icon('walk')}${walkDistance} km</span></div>
            <div class="listing-actions">
              <a href="#/tenant/booking?propertyId=${item.id}" class="action-btn">View Details</a>
            </div>
          </div>
        </article>
      `;
    }).join('');
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

  const load = async () => {
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

  updateRangeNote();
  load();

  // Periodically refresh approved listings so admin status changes propagate to tenants.
  // This keeps Featured Listings and map markers in sync when an admin approves/rejects properties.
  const POLL_INTERVAL = 15000; // 15 seconds
  setInterval(load, POLL_INTERVAL);
}
