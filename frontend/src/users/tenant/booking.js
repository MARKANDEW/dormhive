import { ensureTenantSidebarStyles, loadTenantStylesheet, renderTenantSidebar } from './sidebarTenant.js';
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
const getPropertyImageUrls = (property = {}, booking = {}) => {
  let images = property.images ?? booking.images;
  if (typeof images === 'string') {
    try { images = JSON.parse(images); } catch { images = [images]; }
  }
  const sources = [
    property.image_url,
    property.cover_image,
    property.imageUrl,
    booking.image_url,
    booking.cover_image,
    booking.imageUrl,
    ...(Array.isArray(images) ? images.map((image) => typeof image === 'string' ? image : image?.url || image?.image_url || '') : [])
  ];
  return [...new Set(sources.map(resolveImageUrl).filter(Boolean))];
};
const openBookingPhotoViewer = (photos, alt) => {
  if (!photos.length) return;
  let photoIndex = 0;
  const viewer = document.createElement('dialog');
  viewer.className = 'booking-photo-viewer';

  const image = document.createElement('img');
  image.className = 'booking-photo-viewer__image';

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'booking-photo-viewer__close';
  closeButton.setAttribute('aria-label', 'Close photo viewer');
  closeButton.textContent = '×';

  const previousButton = document.createElement('button');
  previousButton.type = 'button';
  previousButton.className = 'booking-photo-viewer__nav booking-photo-viewer__nav--previous';
  previousButton.setAttribute('aria-label', 'View previous photo');
  previousButton.textContent = '‹';

  const nextButton = document.createElement('button');
  nextButton.type = 'button';
  nextButton.className = 'booking-photo-viewer__nav booking-photo-viewer__nav--next';
  nextButton.setAttribute('aria-label', 'View next photo');
  nextButton.textContent = '›';

  const counter = document.createElement('span');
  counter.className = 'booking-photo-viewer__counter';
  counter.setAttribute('aria-live', 'polite');

  const renderPhoto = () => {
    image.src = photos[photoIndex];
    image.alt = `${alt}, photo ${photoIndex + 1} of ${photos.length}`;
    counter.textContent = `${photoIndex + 1} / ${photos.length}`;
    previousButton.hidden = photos.length < 2;
    nextButton.hidden = photos.length < 2;
    counter.hidden = photos.length < 2;
  };

  previousButton.addEventListener('click', () => {
    photoIndex = (photoIndex - 1 + photos.length) % photos.length;
    renderPhoto();
  });
  nextButton.addEventListener('click', () => {
    photoIndex = (photoIndex + 1) % photos.length;
    renderPhoto();
  });
  closeButton.addEventListener('click', () => viewer.close());
  viewer.addEventListener('click', (event) => {
    if (event.target === viewer) viewer.close();
  });
  viewer.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowRight' && photos.length > 1) nextButton.click();
    if (event.key === 'ArrowLeft' && photos.length > 1) previousButton.click();
  });
  viewer.addEventListener('close', () => viewer.remove(), { once: true });
  viewer.append(image, previousButton, nextButton, counter, closeButton);
  document.body.append(viewer);
  renderPhoto();
  viewer.showModal();
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
  return loadTenantStylesheet('booking', new URL('./style/booking.css', import.meta.url));
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
      const image = getPropertyImageUrls(property || {}, booking)[0] || '';
      const imageCount = getPropertyImageUrls(property || {}, booking).length || 1;
      return `
        <article class="booking-card">
          <button class="booking-card-image-wrapper" type="button" aria-label="View ${escape(property?.title || booking.property_title || 'Property')} photo">
            <img src="${escape(image || '')}" alt="${escape(property?.title || booking.property_title || 'Property')}" class="booking-card-image">
            <span class="pill pill-overlay ${pill.cls}">
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path></svg>
              ${escape(pill.label)}
            </span>
            <span class="booking-image-count">
              <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"></rect><circle cx="12" cy="12" r="3"></circle><path d="m7 5 1-2h8l1 2"></path></svg>
              1 / ${imageCount}
            </span>
          </button>
          <div class="booking-card-content">
            <div class="booking-card-header">
              <div class="booking-card-title">
                <div class="title-icon-badge">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" class="icon">
                    <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
                  </svg>
                </div>
                <div class="booking-card-title-copy">
                  <h3>${escape(property?.title || booking.property_title || 'Property')}</h3>
                  <span class="booking-reference">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"></path><circle cx="12" cy="10" r="2.5"></circle></svg>
                    ${escape(bookingIdFormat(booking.id))}
                  </span>
                </div>
              </div>
            </div>
            <div class="booking-card-details">
              <div class="detail-item">
                <div class="detail-heading">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"></rect><path d="M16 2v4M8 2v4M3 10h18"></path></svg>
                  <span class="detail-label">Dates</span>
                </div>
                <strong>${escape(dateRange || 'TBA')}</strong>
              </div>
              <div class="detail-item">
                <div class="detail-heading">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M2.5 12h19M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"></path></svg>
                  <span class="detail-label">Viewing Schedule</span>
                </div>
                <strong>${escape(viewingSchedule)}</strong>
              </div>
              <div class="detail-item">
                <div class="detail-heading">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h5a6 6 0 0 1 0 12H5m0-8h10M5 12h10M8 4v16"></path></svg>
                  <span class="detail-label">Price</span>
                </div>
                <strong>${escape(price || '—')}</strong>
              </div>
            </div>
            <div class="booking-card-actions${booking.status === 'approved' ? ' booking-card-actions--two' : ''}">
              ${booking.status === 'pending' ? `<button class="btn btn--schedule" data-action="viewing-schedule" data-id="${booking.id}"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M16 3v4M8 3v4M3 10h18"></path></svg><span>${formatViewingSchedule(booking) !== 'Not scheduled' ? 'Change' : 'Set'} Viewing Schedule</span></button>` : ''}
              ${['approved', 'pending'].includes(booking.status) ? `<button class="btn btn--message" data-action="contact" data-property="${property?.id ?? booking.property_id}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 11.5a8.5 8.5 0 0 1-12.8 7.3L3 20l1.2-4.2A8.5 8.5 0 1 1 21 11.5Z"></path><path d="M8 11.5h.01M12 11.5h.01M16 11.5h.01"></path></svg><span>Message Owner</span></button>` : ''}
              ${booking.status === 'approved' ? `<button class="btn btn--ticket" data-action="e-ticket" data-id="${booking.id}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16v5a3 3 0 0 0 0 6v5H4v-5a3 3 0 0 0 0-6V4Z"></path><path d="M12 8v2m0 4v2"></path></svg><span>View E-Ticket</span></button>` : ''}
              ${booking.status === 'pending' ? `<button class="btn btn--cancel" data-action="cancel" data-id="${booking.id}"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="m9 9 6 6m0-6-6 6"></path></svg><span>Cancel Request</span></button>` : ''}
            </div>
          </div>
        </article>
      `;
    }).join('') : '<p class="empty-state">No bookings found for this view.</p>';

    grid.querySelectorAll('.booking-card-image-wrapper').forEach((button, index) => {
      button.addEventListener('click', () => {
        const image = button.querySelector('.booking-card-image');
        const booking = filtered[index];
        const property = getProperty(booking);
        if (image) openBookingPhotoViewer(getPropertyImageUrls(property || {}, booking), image.alt);
      });
    });

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
