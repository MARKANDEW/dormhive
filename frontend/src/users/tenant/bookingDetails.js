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
const formatDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};
const formatDateTime = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
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
  if (!document.querySelector('[data-tenant-style="booking-details"]')) {
    const tag = document.createElement('link');
    tag.rel = 'stylesheet';
    tag.href = new URL('./style/bookingDetails.css', import.meta.url);
    tag.dataset.tenantStyle = 'booking-details';
    document.head.append(tag);
  }
}

export function renderBookingDetails(root = document.querySelector('#app')) {
  if (!root) throw new Error('Booking details page requires #app.');
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
        <section class="booking-details-page">
          <div class="page-title-row">
            <button class="back-btn" id="back-btn">← Back to Bookings</button>
            <div class="page-header-copy">
              <h1>Booking Details</h1>
            </div>
          </div>
          <div class="booking-details-container" id="booking-details-container">
            <p class="loading">Loading booking details...</p>
          </div>
        </section>
      </main>
    </div>`;

  syncBookingProfile();
  window.addEventListener('dormhive-user-updated', syncBookingProfile);

  const backBtn = root.querySelector('#back-btn');
  const container = root.querySelector('#booking-details-container');

  backBtn?.addEventListener('click', () => {
    location.hash = '#/tenant/booking';
  });

  root.querySelector('.logout')?.addEventListener('click', () => {
    localStorage.clear();
    location.assign('#/login');
  });

  const bookingId = (() => {
    const raw = getSearchParam('bookingId');
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : null;
  })();

  const loadBookingDetails = async () => {
    if (!bookingId) {
      container.innerHTML = '<p class="error">Booking ID is missing.</p>';
      return;
    }

    try {
      const [bookingResponse, propertiesResponse] = await Promise.all([
        fetch(`${API_URL}/bookings/${encodeURIComponent(bookingId)}`, { headers: auth() }),
        fetch(`${API_URL}/properties?limit=100`, { headers: auth() })
      ]);

      const bookingBody = await bookingResponse.json();
      const propertiesBody = await propertiesResponse.json();

      if (!bookingResponse.ok) {
        container.innerHTML = `<p class="error">${escape(bookingBody.message || 'Unable to load booking.')}</p>`;
        return;
      }

      const booking = bookingBody.data || null;
      if (!booking) {
        container.innerHTML = '<p class="error">Booking not found.</p>';
        return;
      }

      const properties = Array.isArray(propertiesBody.data) ? propertiesBody.data : [];
      const property = properties.find((item) => String(item.id) === String(booking.property_id)) || null;

      const statusPill = booking.status === 'approved' ? { label: 'Confirmed', cls: 'pill--green' } :
                         booking.status === 'pending' ? { label: 'Pending Approval', cls: 'pill--amber' } :
                         { label: 'Archived', cls: 'pill--grey' };

      const bookingIdFormat = `DHB${String(booking.id).padStart(6, '0')}`;
      const image = getPropertyImageUrl(property || {});
      const dateRange = [booking.move_in_date, booking.move_out_date].filter(Boolean).map(formatDate).join(' to ');
      const price = booking.monthly_rent ? `P${Number(booking.monthly_rent).toLocaleString('en-PH')}` : 'N/A';

      container.innerHTML = `
        <div class="booking-details-card">
          <div class="details-header">
            <div class="details-title-section">
              <h2>${escape(property?.title || booking.property_title || 'Property')}</h2>
              <span class="pill ${statusPill.cls}">${escape(statusPill.label)}</span>
            </div>
          </div>

          <div class="details-image">
            ${image ? `<img src="${escape(image)}" alt="${escape(property?.title || 'Property')}" />` : '<div class="no-image">No image available</div>'}
          </div>

          <div class="details-grid">
            <div class="detail-section">
              <h3>Booking Information</h3>
              <div class="detail-row">
                <span class="label">Booking ID:</span>
                <span class="value">${escape(bookingIdFormat)}</span>
              </div>
              <div class="detail-row">
                <span class="label">Status:</span>
                <span class="value">${escape(statusPill.label)}</span>
              </div>
              <div class="detail-row">
                <span class="label">Check-in Date:</span>
                <span class="value">${escape(formatDate(booking.move_in_date) || 'TBA')}</span>
              </div>
              <div class="detail-row">
                <span class="label">Check-out Date:</span>
                <span class="value">${escape(formatDate(booking.move_out_date) || 'TBA')}</span>
              </div>
              <div class="detail-row">
                <span class="label">Date Range:</span>
                <span class="value">${escape(dateRange || 'TBA')}</span>
              </div>
              <div class="detail-row">
                <span class="label">Number of Occupants:</span>
                <span class="value">${escape(String(booking.occupants || 1))}</span>
              </div>
              ${booking.created_at ? `
              <div class="detail-row">
                <span class="label">Booking Placed:</span>
                <span class="value">${escape(formatDateTime(booking.created_at))}</span>
              </div>
              ` : ''}
            </div>

            <div class="detail-section">
              <h3>Property Information</h3>
              <div class="detail-row">
                <span class="label">Property Name:</span>
                <span class="value">${escape(property?.title || booking.property_title || 'N/A')}</span>
              </div>
              ${property?.municipality ? `
              <div class="detail-row">
                <span class="label">Location:</span>
                <span class="value">${escape(property.municipality)}</span>
              </div>
              ` : ''}
              ${property?.room_type ? `
              <div class="detail-row">
                <span class="label">Room Type:</span>
                <span class="value">${escape(property.room_type)}</span>
              </div>
              ` : ''}
              <div class="detail-row">
                <span class="label">Monthly Rent:</span>
                <span class="value">${escape(price)}</span>
              </div>
              ${property?.amenities ? `
              <div class="detail-row">
                <span class="label">Amenities:</span>
                <span class="value">${escape(Array.isArray(property.amenities) ? property.amenities.join(', ') : property.amenities)}</span>
              </div>
              ` : ''}
            </div>
          </div>

          <div class="details-actions">
            ${booking.status === 'approved' ? `<button class="btn" id="view-ticket-btn">View E-Ticket</button>` : ''}
            ${booking.status === 'pending' ? `<button class="btn btn--danger" id="cancel-btn">Cancel Request</button>` : ''}
            <button class="btn btn--secondary" id="contact-btn">Contact Landlord</button>
          </div>
        </div>
      `;

      const viewTicketBtn = container.querySelector('#view-ticket-btn');
      const cancelBtn = container.querySelector('#cancel-btn');
      const contactBtn = container.querySelector('#contact-btn');

      viewTicketBtn?.addEventListener('click', async () => {
        try {
          const response = await fetch(`${API_URL}/bookings/${encodeURIComponent(bookingId)}/ticket`, {
            headers: auth()
          });
          
          if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Unable to fetch e-ticket.' }));
            alert(error.message || 'Unable to fetch e-ticket. Please try again.');
            return;
          }
          
          const html = await response.text();
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
      });

      cancelBtn?.addEventListener('click', async () => {
        if (!confirm('Cancel this booking request?')) return;
        try {
          const response = await fetch(`${API_URL}/bookings/${encodeURIComponent(bookingId)}/status`, {
            method: 'PATCH',
            headers: auth(),
            body: JSON.stringify({ status: 'cancelled' })
          });
          const body = await response.json();
          if (!response.ok) throw new Error(body.message || 'Unable to cancel booking.');
          alert('Booking cancelled successfully.');
          location.hash = '#/tenant/booking';
        } catch (error) {
          alert(error.message);
        }
      });

      contactBtn?.addEventListener('click', () => {
        const propertyId = property?.id ?? booking.property_id;
        location.hash = `#/tenant/message?propertyId=${propertyId}`;
      });

    } catch (error) {
      container.innerHTML = `<p class="error">${escape(error.message || 'Unable to load booking details.')}</p>`;
    }
  };

  loadBookingDetails();
}
