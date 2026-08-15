import { ensureTenantSidebarStyles, renderTenantSidebar } from './sidebarTenant.js';
import { getUserAvatarUrl } from './setting.js';

const API_URL = window.DORMHIVE_API_URL ?? 'http://localhost:5000/api/v1';
const auth = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('dormhive.accessToken') ?? ''}` });
const escape = (value = '') => { const node = document.createElement('span'); node.textContent = value; return node.innerHTML; };
const session = () => { try { return JSON.parse(localStorage.getItem('dormhive.user') ?? '{}'); } catch { return {}; } };
const getSearchParam = (name) => {
  const search = typeof window.DORMHIVE_ROUTE_SEARCH === 'string' ? window.DORMHIVE_ROUTE_SEARCH : window.location.search;
  return new URLSearchParams(search).get(name);
};
const statusLabel = (status) => {
  if (status === 'approved') return { label: 'Confirmed', className: 'status-confirmed' };
  if (status === 'pending') return { label: 'Upcoming', className: 'status-upcoming' };
  if (status === 'cancelled' || status === 'rejected') return { label: 'Archived', className: 'status-archived' };
  return { label: 'Pending', className: 'status-pending' };
};
const formatDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

function dashboardStyle() {
  if (!document.querySelector('[data-tenant-style="dashboard"]')) {
    const tag = document.createElement('link');
    tag.rel = 'stylesheet';
    tag.href = new URL('./style/dashboardTenant.css', import.meta.url);
    tag.dataset.tenantStyle = 'dashboard';
    document.head.append(tag);
  }
}

function style() {
  if (!document.querySelector('[data-tenant-style="booking"]')) {
    const tag = document.createElement('link');
    tag.rel = 'stylesheet';
    tag.href = new URL('./style/booking.css', import.meta.url);
    tag.dataset.tenantStyle = 'booking';
    document.head.append(tag);
    const extra = document.createElement('link');
    extra.rel = 'stylesheet';
    extra.href = new URL('./style/booking-cards.css', import.meta.url);
    extra.dataset.tenantStyle = 'booking-cards';
    document.head.append(extra);
  }
}

export function renderBooking(root = document.querySelector('#app')) {
  if (!root) throw new Error('Booking page requires #app.');
  dashboardStyle();
  ensureTenantSidebarStyles();
  style();

  root.innerHTML = `
    <div class="dh-app">
      ${renderTenantSidebar('booking')}
      <main class="tenant-page-main">
        <section class="booking-overview-page">
          <header class="tenant-topbar">
            <button class="hamburger" type="button" aria-label="Menu">☰</button>
            <label class="search-bar" aria-label="Search by location, university, or landmark...">
              <span>⌕</span>
              <input type="search" placeholder="Search by location, university, or landmark..." />
            </label>
            <div class="top-actions">
              <button type="button" aria-label="Notifications">🔔</button>
              <div class="profile-avatar">${session().avatar_url ? `<img src="${escape(getUserAvatarUrl(session()))}" alt="${escape(session().name || 'Tenant')} avatar" />` : escape((session().name || 'A').split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase())}</div>
              <div class="profile-meta">
                <strong>${escape(session().name || 'Alex Reyes')}</strong>
                <span>Renter</span>
              </div>
            </div>
          </header>

          <section class="booking-overview-content">
            <div class="page-title-row">
              <div>
                <h1>My Bookings</h1>
                <p class="subtitle">Manage your confirmed, pending, and past stays.</p>
              </div>
              <div class="tab-row">
                <button class="tab active" type="button" data-view="all">All Bookings</button>
                <button class="tab" type="button" data-view="upcoming">Upcoming</button>
                <button class="tab" type="button" data-view="past">Past</button>
                <button class="tab" type="button" data-view="pending">Pending Requests</button>
              </div>
            </div>

            <section class="property-request-panel hidden" id="property-request-panel">
              <div class="property-request-card">
                <div class="property-banner" id="property-banner"></div>
                <div class="property-request-body">
                  <div class="request-panel-heading">
                    <div>
                      <h2>Request this property</h2>
                      <div class="property-summary" id="property-summary"></div>
                    </div>
                  </div>

                  <form id="request-form" class="request-form">
                    <div class="request-grid-row">
                      <label class="field-group">
                        <span>Move-in date</span>
                        <input type="date" name="moveInDate" required />
                        <span class="field-icon">📅</span>
                      </label>
                      <label class="field-group">
                        <span>Move-out date</span>
                        <input type="date" name="moveOutDate" />
                        <span class="field-icon">📅</span>
                      </label>
                      <label class="field-group">
                        <span>Occupants</span>
                        <input type="number" name="occupants" min="1" value="1" required />
                        <span class="field-icon">👤</span>
                      </label>
                      <div class="message-block">
                        <label class="field-group message-field">
                          <span>Message for the Owner</span>
                          <input type="text" name="message" placeholder="Write a message for the owner" />
                        </label>
                        <button type="submit" class="submit-request-btn">
                          <span class="btn-icon">📨</span>
                          Send Request
                        </button>
                      </div>
                    </div>
                  </form>
                  <p class="request-status" id="request-status" aria-live="polite"></p>
                </div>
              </div>
            </section>

            <div class="booking-grid" id="booking-grid"></div>
          </section>
        </section>
      </main>
    </div>`;

  const grid = root.querySelector('#booking-grid');
  const requestPanel = root.querySelector('#property-request-panel');
  const requestSummary = root.querySelector('#property-summary');
  const requestForm = root.querySelector('#request-form');
  const requestStatus = root.querySelector('#request-status');
  const tabs = root.querySelectorAll('.tab');
  const state = { bookings: [], properties: [], selectedProperty: null, filter: 'all' };
  const propertyId = getSearchParam('propertyId');

  const getProperty = (booking) => state.properties.find((item) => String(item.id) === String(booking.property_id)) || null;
  const statusPill = (status) => {
    if (status === 'approved') return { label: 'Confirmed', cls: 'pill--green' };
    if (status === 'pending') return { label: 'Pending Approval', cls: 'pill--amber' };
    return { label: 'Past', cls: 'pill--grey' };
  };

  const bookingIdFormat = (id) => `DHB${String(id).padStart(6, '0')}`;

  const isPast = (booking) => {
    try {
      if (!booking.move_out_date) return booking.status !== 'approved';
      return new Date(booking.move_out_date) < new Date();
    } catch { return false; }
  };

  const renderCards = () => {
    const today = new Date();
    const filtered = state.bookings.filter((booking) => {
      if (state.filter === 'all') return true;
      if (state.filter === 'upcoming') return booking.status === 'approved' && (new Date(booking.move_in_date) >= today || !booking.move_in_date);
      if (state.filter === 'past') return isPast(booking) || booking.status === 'cancelled' || booking.status === 'rejected';
      if (state.filter === 'pending') return booking.status === 'pending';
      return true;
    });

    grid.innerHTML = filtered.length ? filtered.map((booking) => {
      const property = getProperty(booking);
      const pill = statusPill(isPast(booking) ? 'past' : booking.status);
      const dateRange = [booking.move_in_date, booking.move_out_date].filter(Boolean).map(formatDate).join(' - ');
      const price = booking.monthly_rent ? `P${Number(booking.monthly_rent).toLocaleString('en-PH')}` : '';
      return `
        <article class="booking-card--row">
          <div class="booking-thumb">
            <img src="${escape((property && (property.image_url || property.cover_image)) || '')}" alt="${escape(property?.title || booking.property_title || 'Property')}">
          </div>
          <div class="booking-info">
            <div class="booking-title-row">
              <h3>${escape(property?.title || booking.property_title || 'Property')}</h3>
              <span class="pill ${pill.cls}">${escape(pill.label)}</span>
            </div>
            <div class="booking-meta">
              <div>Booking ID: <strong>${escape(bookingIdFormat(booking.id))}</strong></div>
              <div>Dates: <strong>${escape(dateRange || 'TBA')}</strong></div>
              <div>Price: <strong>${escape(price || '—')}</strong></div>
            </div>
          </div>
          <div class="booking-actions">
            ${booking.status === 'approved' ? `<button class="btn" data-action="e-ticket" data-id="${booking.id}">View E-Ticket</button><button class="btn btn--secondary" data-action="contact" data-property="${property?.id ?? booking.property_id}">Contact Landlord</button>` : ''}
            ${booking.status === 'pending' ? `<button class="btn" data-action="details" data-id="${booking.id}">View Details</button><button class="btn btn--danger" data-action="cancel" data-id="${booking.id}">Cancel Request</button>` : ''}
            ${isPast(booking) && booking.status !== 'pending' ? `<button class="btn" data-action="details" data-id="${booking.id}">View Details</button>` : ''}
          </div>
        </article>
      `;
    }).join('') : '<p class="empty-state">No bookings found for this view.</p>';

    // wire up actions
    grid.querySelectorAll('[data-action]').forEach((el) => {
      el.addEventListener('click', async (ev) => {
        const action = el.dataset.action;
        const id = el.dataset.id;
        if (action === 'e-ticket') {
          // Open e-ticket (placeholder) — route can be implemented server-side
          window.open(`${API_URL}/bookings/${encodeURIComponent(id)}/ticket`, '_blank');
        } else if (action === 'contact') {
          const propertyId = el.dataset.property;
          location.hash = `#/tenant/message?propertyId=${propertyId}`;
        } else if (action === 'cancel') {
          if (!confirm('Cancel this booking request?')) return;
          try {
            const r = await fetch(`${API_URL}/bookings/${encodeURIComponent(id)}/status`, { method: 'PATCH', headers: auth(), body: JSON.stringify({ status: 'cancelled' }) });
            const b = await r.json();
            if (!r.ok) throw new Error(b.message || 'Unable to cancel request.');
            state.bookings = state.bookings.map((bk) => (bk.id === Number(id) ? b.data : bk));
            renderCards();
          } catch (error) {
            alert(error.message);
          }
        } else if (action === 'details') {
          // navigate to booking details page (if exists)
          location.hash = `#/tenant/bookingDetails?bookingId=${id}`;
        }
      });
    });
  };

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((item) => item.classList.remove('active'));
      tab.classList.add('active');
      state.filter = tab.dataset.view;
      renderCards();
    });
  });

  const load = async () => {
    try {
      const [bookingsResponse, propertiesResponse] = await Promise.all([
        fetch(`${API_URL}/bookings`, { headers: auth() }),
        fetch(`${API_URL}/properties?limit=100`, { headers: auth() })
      ]);
      const bookingBody = await bookingsResponse.json();
      const propertyBody = await propertiesResponse.json();
      if (!bookingsResponse.ok) throw new Error(bookingBody.message || 'Unable to load bookings.');
      if (!propertiesResponse.ok) throw new Error(propertyBody.message || 'Unable to load properties.');

      state.bookings = Array.isArray(bookingBody.data) ? bookingBody.data : [];
      state.properties = Array.isArray(propertyBody.data) ? propertyBody.data : [];
      renderCards();
      if (propertyId) {
        const response = await fetch(`${API_URL}/properties/${encodeURIComponent(propertyId)}`, { headers: auth() });
        const body = await response.json();
        if (response.ok) {
          state.selectedProperty = body.data;
          requestSummary.innerHTML = `
            <p><strong>${escape(state.selectedProperty.title || 'Property')}</strong></p>
            <p>${escape(state.selectedProperty.municipality || 'Location unavailable')}</p>
            <p>${escape(state.selectedProperty.room_type || 'Room type not specified')}</p>
            <p>${escape(`PHP ${Number(state.selectedProperty.monthly_rent || 0).toLocaleString('en-PH')} / month`)}</p>
          `;
          const banner = root.querySelector('#property-banner');
          if (banner) {
            const imageUrl = state.selectedProperty.image_url || state.selectedProperty.cover_image || (Array.isArray(state.selectedProperty.images) && state.selectedProperty.images[0]) || '';
            banner.style.backgroundImage = imageUrl ? `url(${imageUrl})` : '';
          }
          requestPanel.classList.remove('hidden');
        } else {
          requestStatus.textContent = body.message || 'Unable to load property details.';
          requestPanel.classList.remove('hidden');
        }
      }
    } catch (error) {
      grid.innerHTML = `<p class="empty-state">${escape(error.message)}</p>`;
    }
  };

  root.querySelector('.logout')?.addEventListener('click', () => {
    localStorage.clear();
    location.assign('#/login');
  });

  requestForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!state.selectedProperty) {
      requestStatus.textContent = 'Property not loaded.';
      return;
    }

    const formData = new FormData(requestForm);
    const payload = {
      propertyId: Number(propertyId),
      moveInDate: formData.get('moveInDate'),
      moveOutDate: formData.get('moveOutDate') || null,
      occupants: Number(formData.get('occupants') || 1),
      message: formData.get('message')?.toString().trim() || ''
    };

    try {
      const response = await fetch(`${API_URL}/bookings`, { method: 'POST', headers: auth(), body: JSON.stringify(payload) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || 'Unable to submit booking request.');
      state.bookings.unshift(body.data);
      renderCards();
      requestStatus.textContent = 'Booking request sent. You can follow it in your bookings list.';
      requestForm.reset();
    } catch (error) {
      requestStatus.textContent = error.message;
    }
  });

  load();
}



