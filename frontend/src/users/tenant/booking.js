import { ensureTenantSidebarStyles, renderTenantSidebar } from './sidebarTenant.js';
import { getUserAvatarUrl } from './setting.js';
import { createModal, openModal } from '../../components/modal.js';

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
const getPropertyImageUrl = (property = {}, booking = {}) => {
  let images = property.images ?? booking.images;
  if (typeof images === 'string') {
    try { images = JSON.parse(images); } catch { images = [images]; }
  }
  const source = property.image_url || property.cover_image || property.imageUrl || booking.image_url || booking.cover_image || booking.imageUrl || (Array.isArray(images) && images[0]) || '';
  return resolveImageUrl(source);
};
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
const formatViewingSchedule = (booking) => {
  if (!(booking.viewing_schedule_tenant_submitted === true || Number(booking.viewing_schedule_tenant_submitted) === 1)) return 'Not scheduled';
  if (!booking.viewing_date || !booking.viewing_time) return 'Not scheduled';
  const [year, month, day] = String(booking.viewing_date).slice(0, 10).split('-').map(Number);
  const [hours, minutes] = String(booking.viewing_time).slice(0, 5).split(':').map(Number);
  if (!year || !month || !day || !Number.isFinite(hours) || !Number.isFinite(minutes)) return 'Not scheduled';
  const date = new Date(year, month - 1, day).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const time = new Date(2000, 0, 1, hours, minutes).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${date} at ${time}`;
};
const propertyAmenities = (value) => {
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter(Boolean).map(String) : [value];
  } catch { return value.split(',').map((item) => item.trim()).filter(Boolean); }
};

function style() {
  const existing = document.querySelector('[data-tenant-style="booking"]');
  if (existing) return existing.sheet ? Promise.resolve() : new Promise((resolve) => existing.addEventListener('load', resolve, { once: true }));

  const tag = document.createElement('link');
  tag.rel = 'stylesheet';
  tag.href = new URL('./style/booking.css', import.meta.url);
  tag.dataset.tenantStyle = 'booking';
  document.head.append(tag);
  return new Promise((resolve) => {
    tag.addEventListener('load', resolve, { once: true });
    tag.addEventListener('error', resolve, { once: true });
  });
}

export async function renderBooking(root = document.querySelector('#app')) {
  if (!root) throw new Error('Booking page requires #app.');
  await Promise.all([ensureTenantSidebarStyles(), style()]);

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
      <main class="tenant-page-main tenant-bookings">
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

          <div class="booking-grid" id="booking-grid"></div>
        </section>
      </main>
    </div>`;

  syncBookingProfile();
  window.addEventListener('dormhive-user-updated', syncBookingProfile);

  const grid = root.querySelector('#booking-grid');
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
      if (booking.is_indefinite_move_out === true || Number(booking.is_indefinite_move_out) === 1) return false;
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
      const hasIndefiniteMoveOut = booking.is_indefinite_move_out === true || Number(booking.is_indefinite_move_out) === 1;
      const dateRange = [
        booking.move_in_date ? formatDate(booking.move_in_date) : null,
        hasIndefiniteMoveOut ? 'Indefinite' : booking.move_out_date ? formatDate(booking.move_out_date) : null
      ].filter(Boolean).join(' - ');
      const viewingSchedule = formatViewingSchedule(booking);
      const price = booking.monthly_rent ? `P${Number(booking.monthly_rent).toLocaleString('en-PH')}` : '';
      const image = getPropertyImageUrl(property || {}, booking);
      return `
        <article class="booking-card">
          <div class="booking-card-image-wrapper">
            <img src="${escape(image || '')}" alt="${escape(property?.title || booking.property_title || 'Property')}" class="booking-card-image">
            <span class="pill pill-overlay ${pill.cls}">${escape(pill.label)}</span>
          </div>
          <div class="booking-card-content">
            <div class="booking-card-header">
              <div class="booking-card-title">
                <div class="title-icon-badge">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" class="icon">
                    <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
                  </svg>
                </div>
                <h3>${escape(property?.title || booking.property_title || 'Property')}</h3>
              </div>
              <span class="pill ${pill.cls}">${escape(pill.label)}</span>
            </div>
            <div class="booking-card-details">
              <div class="detail-item">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon">
                  <circle cx="12" cy="12" r="1"></circle>
                  <path d="M19 12a7 7 0 1 0-14 0 7 7 0 0 0 14 0z"></path>
                </svg>
                <span class="detail-label">Booking ID:</span>
                <strong>${escape(bookingIdFormat(booking.id))}</strong>
              </div>
              <div class="detail-item">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                <span class="detail-label">Dates:</span>
                <strong>${escape(dateRange || 'TBA')}</strong>
              </div>
              <div class="detail-item">
                <span class="detail-label">Viewing Schedule:</span>
                <strong>${escape(viewingSchedule)}</strong>
              </div>
              <div class="detail-item">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon">
                  <line x1="12" y1="1" x2="12" y2="23"></line>
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                </svg>
                <span class="detail-label">Price:</span>
                <strong>${escape(price || '—')}</strong>
              </div>
            </div>
            <div class="booking-card-actions">
              ${booking.status === 'pending' ? `<button class="btn" data-action="viewing-schedule" data-id="${booking.id}">${formatViewingSchedule(booking) !== 'Not scheduled' ? 'Change' : 'Set'} Viewing Schedule</button>` : ''}
              ${hasIndefiniteMoveOut && ['approved', 'pending'].includes(booking.status) ? `<button class="btn" data-action="set-move-out" data-id="${booking.id}">Set Move-out Date</button>` : ''}
              ${booking.status === 'approved' ? `<button class="btn" data-action="e-ticket" data-id="${booking.id}">View E-Ticket</button><button class="btn btn--primary" data-action="contact" data-property="${property?.id ?? booking.property_id}">Contact Landlord</button>` : ''}
              ${booking.status === 'pending' ? `<button class="btn" data-action="cancel" data-id="${booking.id}">Cancel Request</button>` : ''}
            </div>
          </div>
        </article>
      `;
    }).join('') : '<p class="empty-state">No bookings found for this view.</p>';

    // wire up actions
    grid.querySelectorAll('[data-action]').forEach((el) => {
      el.addEventListener('click', async (ev) => {
        const action = el.dataset.action;
        const id = el.dataset.id;
        if (action === 'viewing-schedule') {
          const booking = state.bookings.find((item) => String(item.id) === String(id));
          if (!booking || booking.status !== 'pending') return;
          const hasTenantSchedule = booking.viewing_schedule_tenant_submitted === true || Number(booking.viewing_schedule_tenant_submitted) === 1;
          const dateValue = hasTenantSchedule ? String(booking.viewing_date ?? '').slice(0, 10) : '';
          const timeValue = hasTenantSchedule ? String(booking.viewing_time ?? '').slice(0, 5) : '';
          const modal = createModal({
            title: dateValue && timeValue ? 'Change Viewing Schedule' : 'Set Viewing Schedule',
            content: `<form class="tenant-viewing-schedule-form"><label for="tenant-viewing-date">Viewing Date</label><input id="tenant-viewing-date" type="date" required value="${escape(dateValue)}"><label for="tenant-viewing-time">Viewing Time</label><input id="tenant-viewing-time" type="time" required value="${escape(timeValue)}"><p role="status"></p></form>`,
            closeLabel: 'Cancel',
            footerMarkup: '<button type="button" class="btn btn--primary" data-save-viewing-schedule>Save Schedule</button>'
          });
          const dateInput = modal.querySelector('#tenant-viewing-date');
          const timeInput = modal.querySelector('#tenant-viewing-time');
          const scheduleStatus = modal.querySelector('[role="status"]');
          const saveButton = modal.querySelector('[data-save-viewing-schedule]');
          dateInput.min = new Date().toISOString().split('T')[0];
          saveButton.addEventListener('click', async () => {
            if (!dateInput.value || !timeInput.value) {
              scheduleStatus.textContent = 'Select both a viewing date and time.';
              return;
            }
            saveButton.disabled = true;
            try {
              const response = await fetch(`${API_URL}/bookings/${encodeURIComponent(id)}/viewing-schedule`, {
                method: 'PATCH',
                headers: auth(),
                body: JSON.stringify({ viewingDate: dateInput.value, viewingTime: timeInput.value })
              });
              const body = await response.json();
              if (!response.ok) throw new Error(body.message || 'Unable to update viewing schedule.');
              state.bookings = state.bookings.map((item) => String(item.id) === String(id) ? body.data : item);
              modal.close();
              renderCards();
            } catch (error) {
              scheduleStatus.textContent = error.message;
              saveButton.disabled = false;
            }
          });
          openModal(modal);
        } else if (action === 'set-move-out') {
          const booking = state.bookings.find((item) => String(item.id) === String(id));
          if (!booking) return;
          const moveInDate = String(booking.move_in_date ?? '').slice(0, 10);
          const firstValidMoveOut = new Date(`${moveInDate}T00:00:00`);
          firstValidMoveOut.setDate(firstValidMoveOut.getDate() + 1);
          const minimumMoveOutDate = `${firstValidMoveOut.getFullYear()}-${String(firstValidMoveOut.getMonth() + 1).padStart(2, '0')}-${String(firstValidMoveOut.getDate()).padStart(2, '0')}`;
          const modal = createModal({
            title: 'Set Move-out Date',
            content: `<form class="tenant-move-out-update"><label for="tenant-move-out-date">Move-out Date</label><input id="tenant-move-out-date" type="date" required min="${escape(minimumMoveOutDate)}"><p role="status"></p></form>`,
            closeLabel: 'Cancel',
            footerMarkup: '<button type="button" class="btn btn--primary" data-save-move-out>Save Date</button>'
          });
          const moveOutInput = modal.querySelector('#tenant-move-out-date');
          const moveOutStatus = modal.querySelector('[role="status"]');
          const saveButton = modal.querySelector('[data-save-move-out]');
          saveButton.addEventListener('click', async () => {
            if (!moveOutInput.value || moveOutInput.value <= moveInDate) {
              moveOutStatus.textContent = 'Move-out date must be after the move-in date.';
              return;
            }
            saveButton.disabled = true;
            try {
              const response = await fetch(`${API_URL}/bookings/${encodeURIComponent(id)}/move-out`, {
                method: 'PATCH',
                headers: auth(),
                body: JSON.stringify({ moveOutDate: moveOutInput.value, isIndefiniteMoveOut: false })
              });
              const body = await response.json();
              if (!response.ok) throw new Error(body.message || 'Unable to update move-out date.');
              state.bookings = state.bookings.map((item) => String(item.id) === String(id) ? body.data : item);
              modal.close();
              renderCards();
            } catch (error) {
              moveOutStatus.textContent = error.message;
              saveButton.disabled = false;
            }
          });
          openModal(modal);
        } else if (action === 'e-ticket') {
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

    } catch (error) {
      state.bookings = [];
      state.properties = [];
      renderCards();
    }
  };

  root.querySelector('.logout')?.addEventListener('click', () => {
    localStorage.clear();
    location.assign('#/login');
  });


  load();
}



