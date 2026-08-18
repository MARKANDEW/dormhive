import { ensureTenantSidebarStyles, renderTenantSidebar } from './sidebarTenant.js';
import { getUserAvatarUrl } from './setting.js';

const API_URL = window.DORMHIVE_API_URL ?? 'http://localhost:5000/api/v1';
const apiBase = API_URL.replace(/\/api\/v1\/?$/, '');
const auth = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('dormhive.accessToken') ?? ''}` });
const escape = (value = '') => { const node = document.createElement('span'); node.textContent = value; return node.innerHTML; };
const session = () => { try { return JSON.parse(localStorage.getItem('dormhive.user') ?? '{}'); } catch { return {}; } };
const resolveImageUrl = (value = '') => {
  const url = String(value || '').trim();
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  return `${apiBase}${url.startsWith('/') ? '' : '/'}${url}`;
};
const getPropertyImageUrl = (property = {}) => resolveImageUrl(property.image_url || property.cover_image || property.imageUrl || (Array.isArray(property.images) && property.images[0]) || '');
const tenantFullName = (user = {}) => {
  const firstName = String(user.first_name ?? user.firstName ?? '').trim();
  const lastName = String(user.last_name ?? user.lastName ?? '').trim();
  const combined = [firstName, lastName].filter(Boolean).join(' ');
  return combined || String(user.name ?? 'Tenant').trim() || 'Tenant';
};
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

  const syncBookingProfile = () => {
    const user = session();
    const fullName = tenantFullName(user);
    const avatarEl = root.querySelector('.profile-avatar');
    const nameEl = root.querySelector('.profile-meta strong');
    if (!avatarEl || !nameEl) return;
    const avatarUrl = user.avatar_url ? getUserAvatarUrl(user, fullName) : '';
    avatarEl.innerHTML = avatarUrl ? `<img src="${escape(avatarUrl)}" alt="${escape(fullName)} avatar" />` : `<span class="profile-initials">${escape((fullName || 'T').split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'T')}</span>`;
    nameEl.textContent = fullName;
  };

  root.innerHTML = `
    <div class="dh-app">
      ${renderTenantSidebar('booking')}
      <main class="tenant-page-main">
        <section class="booking-overview-page">
          <div class="page-title-row">
            <div class="page-header-copy">
              <h1>My Bookings</h1>
              <p class="subtitle">Manage your confirmed, pending, and past stays</p>
            </div>
          </div>

          <div class="tab-row" aria-label="Booking filters">
            <button class="tab active" type="button" data-view="all">All Bookings</button>
            <button class="tab" type="button" data-view="upcoming">Upcoming</button>
            <button class="tab" type="button" data-view="past">Past</button>
            <button class="tab" type="button" data-view="pending">Pending Requests</button>
          </div>

          <section class="property-request-panel" id="property-request-panel">
            <div class="property-request-card">
              <div class="property-banner" id="property-banner" aria-label="Property preview"></div>
              <div class="property-request-body">
                <div class="request-panel-heading">
                  <h2>Request this property</h2>
                  <div class="property-summary" id="property-summary"></div>
                </div>

                <form id="request-form" class="request-form">
                  <div class="request-grid-row">
                    <label class="field-group">
                      <span>Move-in</span>
                      <input id="moveInDate" type="date" name="moveInDate" required />
                    </label>
                    <label class="field-group">
                      <span>Move-out</span>
                      <input id="moveOutDate" type="date" name="moveOutDate" />
                    </label>
                    <label class="field-group small-field">
                      <span>Occupants</span>
                      <input type="number" name="occupants" min="1" value="1" required />
                    </label>
                    <button type="button" class="chat-owner-btn" id="chat-owner-btn">
                      <span class="btn-icon">💬</span>
                      Chat Owner
                    </button>
                  </div>
                  <button type="submit" class="submit-request-btn">
                    <span class="btn-icon">📨</span>
                    Send Request
                  </button>
                </form>
                <p class="request-status" id="request-status" aria-live="polite"></p>
              </div>
            </div>
          </section>

          <div class="booking-grid" id="booking-grid"></div>
        </section>
      </main>
    </div>`;

  syncBookingProfile();
  window.addEventListener('dormhive-user-updated', syncBookingProfile);

  const grid = root.querySelector('#booking-grid');
  const requestPanel = root.querySelector('#property-request-panel');
  const requestSummary = root.querySelector('#property-summary');
  const requestForm = root.querySelector('#request-form');
  const requestStatus = root.querySelector('#request-status');
  const moveInInput = root.querySelector('#moveInDate');
  const moveOutInput = root.querySelector('#moveOutDate');
  const chatOwnerBtn = root.querySelector('#chat-owner-btn');
  const tabs = root.querySelectorAll('.tab');
  const demoProperty = {
    id: 101,
    title: 'Hotel 101',
    municipality: 'BGC, Taguig',
    room_type: 'Private room',
    monthly_rent: 5000,
    image_url: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80'
  };
  const demoBookings = [
    {
      id: 8000007,
      property_id: 101,
      property_title: 'Hotel 101',
      monthly_rent: 5000,
      move_in_date: '2026-08-12',
      move_out_date: '2026-08-19',
      status: 'approved'
    },
    {
      id: 8000006,
      property_id: 102,
      property_title: 'home sweet home',
      monthly_rent: 6001,
      move_in_date: '2026-08-15',
      move_out_date: '2026-08-21',
      status: 'pending'
    }
  ];
  const demoProperties = [
    { ...demoProperty },
    {
      id: 102,
      title: 'home sweet home',
      municipality: 'Quezon City',
      room_type: 'Studio Unit',
      monthly_rent: 6001,
      image_url: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80'
    }
  ];

  const state = { bookings: demoBookings, properties: demoProperties, selectedProperty: demoProperty, filter: 'all' };
  const propertyId = (() => {
    const raw = getSearchParam('propertyId');
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : null;
  })();

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
      const image = getPropertyImageUrl(property || {});
      return `
        <article class="booking-card--row">
          <div class="booking-thumb">
            <img src="${escape(image || '')}" alt="${escape(property?.title || booking.property_title || 'Property')}">
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
          // Fetch e-ticket with authentication
          try {
            const response = await fetch(`${API_URL}/bookings/${encodeURIComponent(id)}/ticket`, {
              headers: auth()
            });
            
            if (!response.ok) {
              const error = await response.json().catch(() => ({ message: 'Unable to fetch e-ticket.' }));
              alert(error.message || 'Unable to fetch e-ticket. Please try again.');
              return;
            }
            
            // Get the HTML content
            const html = await response.text();
            
            // Open in new window and write the HTML
            const ticketWindow = window.open('', '_blank');
            if (ticketWindow) {
              ticketWindow.document.write(html);
              ticketWindow.document.close();
            } else {
              alert('Please allow popups to view the e-ticket.');
            }
          } catch (error) {
            console.error('Error fetching e-ticket:', error);
            alert('Unable to fetch e-ticket. Please try again.');
          }
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
    const applyPropertyPreview = (property) => {
      if (!property) return;
      state.selectedProperty = property;
      requestSummary.innerHTML = `
        <p><strong>${escape(property.title || 'Property')}</strong></p>
        <p>${escape(property.municipality || 'Location unavailable')}</p>
        <p>${escape(property.room_type || 'Room type not specified')}</p>
        <p>${escape(`PHP ${Number(property.monthly_rent || 0).toLocaleString('en-PH')} / month`)}</p>
      `;
      const banner = root.querySelector('#property-banner');
      if (banner) {
        const imageUrl = getPropertyImageUrl(property);
        banner.innerHTML = imageUrl ? `<img src="${escape(imageUrl)}" alt="${escape(property.title || 'Property')}" />` : '';
      }
      requestPanel.classList.remove('hidden');
    };

    const loadPropertyPreview = async (targetId) => {
      if (!targetId) {
        applyPropertyPreview(demoProperty);
        return;
      }

      try {
        const response = await fetch(`${API_URL}/properties/${encodeURIComponent(targetId)}`, { headers: auth() });
        const body = await response.json();
        if (!response.ok) {
          if (response.status === 401) {
            requestStatus.textContent = 'Please sign in to view property details.';
          } else {
            requestStatus.textContent = body.message || 'Unable to load property details.';
          }
          applyPropertyPreview(demoProperty);
          return;
        }

        const property = body.data || null;
        applyPropertyPreview(property || demoProperty);
      } catch (error) {
        requestStatus.textContent = error.message || 'Unable to load property details.';
        applyPropertyPreview(demoProperty);
      }
    };

    try {
      const [bookingsResponse, propertiesResponse] = await Promise.all([
        fetch(`${API_URL}/bookings`, { headers: auth() }),
        fetch(`${API_URL}/properties?limit=100`, { headers: auth() })
      ]);
      const bookingBody = await bookingsResponse.json();
      const propertyBody = await propertiesResponse.json();
      if (!bookingsResponse.ok) throw new Error(bookingBody.message || 'Unable to load bookings.');
      if (!propertiesResponse.ok) throw new Error(propertyBody.message || 'Unable to load properties.');

      state.bookings = Array.isArray(bookingBody.data) ? bookingBody.data : demoBookings;
      state.properties = Array.isArray(propertyBody.data) ? propertyBody.data : demoProperties;
      renderCards();

      const targetProperty = state.properties.find((item) => String(item.id) === String(propertyId)) || (propertyId ? null : demoProperty);
      if (targetProperty) {
        applyPropertyPreview(targetProperty);
      } else {
        await loadPropertyPreview(propertyId);
      }
    } catch (error) {
      state.bookings = demoBookings;
      state.properties = demoProperties;
      renderCards();
      requestStatus.textContent = error.message || 'Unable to load booking data.';
      await loadPropertyPreview(propertyId);
    }
  };

  const updateMoveOutMin = () => {
    if (!moveInInput || !moveOutInput) return;
    if (moveInInput.value) {
      moveOutInput.min = moveInInput.value;
      if (moveOutInput.value && moveOutInput.value < moveInInput.value) {
        moveOutInput.value = moveInInput.value;
      }
    } else {
      moveOutInput.min = '';
    }
  };

  moveInInput?.addEventListener('change', updateMoveOutMin);
  moveOutInput?.addEventListener('change', () => {
    if (moveInInput?.value && moveOutInput?.value && moveOutInput.value < moveInInput.value) {
      moveOutInput.setCustomValidity('Move-out date must be on or after the move-in date.');
      moveOutInput.reportValidity();
    } else {
      moveOutInput.setCustomValidity('');
    }
  });

  chatOwnerBtn?.addEventListener('click', () => {
    const propertyTarget = state.selectedProperty?.id ?? propertyId;
    const target = propertyTarget ? `#/tenant/message?propertyId=${encodeURIComponent(propertyTarget)}` : '#/tenant/message';
    location.hash = target;
  });

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

    if (moveInInput?.value && moveOutInput?.value && moveOutInput.value < moveInInput.value) {
      moveOutInput.setCustomValidity('Move-out date must be on or after the move-in date.');
      moveOutInput.reportValidity();
      return;
    }

    const formData = new FormData(requestForm);
    const selectedPropertyId = Number(state.selectedProperty?.id ?? propertyId ?? 0);
    if (!selectedPropertyId) {
      requestStatus.textContent = 'Property information is missing.';
      return;
    }

    const payload = {
      propertyId: selectedPropertyId,
      moveInDate: formData.get('moveInDate'),
      moveOutDate: formData.get('moveOutDate') || null,
      occupants: Number(formData.get('occupants') || 1),
      message: ''
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



