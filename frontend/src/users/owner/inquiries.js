import { ensureOwnerSidebarStyles, renderOwnerSidebar, updateListingCountsInSidebar } from './sidebarOwner.js';

const API = window.DORMHIVE_API_URL ?? 'http://localhost:5000/api/v1';
const auth = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('dormhive.accessToken') ?? ''}` });
const esc = (v = '') => { const e = document.createElement('span'); e.textContent = v; return e.innerHTML; };
const currentUser = () => { try { return JSON.parse(localStorage.getItem('dormhive.user') ?? '{}'); } catch { return {}; } };

function css() {
  if (!document.querySelector('[data-owner-style="inquiries"]')) {
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = new URL('./style/inquiries.css', import.meta.url);
    l.dataset.ownerStyle = 'inquiries';
    document.head.append(l);
  }
}

const statusInfo = (status) => {
  if (status === 'approved') return { label: 'Replied', className: 'status-replied' };
  if (status === 'rejected' || status === 'cancelled') return { label: 'Archived', className: 'status-archived' };
  return { label: 'New Inquiry', className: 'status-new' };
};

const formatDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export function renderInquiries(root = document.querySelector('#app')) {
  if (!root) throw new Error('Inquiries page requires #app.');
  css();
  ensureOwnerSidebarStyles();

  root.innerHTML = `
    <div class="owner-shell">
      ${renderOwnerSidebar('inquiries')}
      <div class="owner-main">
        <main class="inquiries-page">
          <header>
            <a class="brand" href="#/owner/dashboardOwner">DormHive</a>
          </header>

          <section class="inquiries-board">
            <div class="inquiries-toolbar">
              <label class="search-box">
                <span>⌕</span>
                <input id="inquiry-search" type="search" placeholder="Search tenants or properties..." />
              </label>

              <div class="filters-row">
                <div class="filter-pills" data-filter-status>
                  <button class="pill active" data-status="all" type="button">All</button>
                  <button class="pill" data-status="new" type="button">New</button>
                  <button class="pill" data-status="pending" type="button">Pending</button>
                  <button class="pill" data-status="replied" type="button">Replied</button>
                </div>

                <label class="property-filter">
                  <span>Property</span>
                  <select id="property-filter">
                    <option value="all">All Properties</option>
                  </select>
                </label>
              </div>
            </div>

            <div class="inquiries-layout">
              <section class="table-shell">
                <div class="table-wrap">
                  <table class="inquiries-table">
                    <thead>
                      <tr>
                        <th>Tenant Name</th>
                        <th>Property</th>
                        <th>Date</th>
                        <th>Status</th>
                        <th>Latest Message</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody id="inquiries-rows"></tbody>
                  </table>
                </div>
                <div class="pagination">
                  <button type="button" data-page="prev" aria-label="Previous page">‹</button>
                  <button type="button" data-page="1" class="active">1</button>
                  <button type="button" data-page="2">2</button>
                  <button type="button" data-page="3">3</button>
                  <button type="button" data-page="next" aria-label="Next page">›</button>
                </div>
              </section>

              <aside class="detail-shell">
                <div id="tenant-detail-panel" class="tenant-detail-panel">
                  <div class="detail-placeholder">Select a tenant row to view inquiry details.</div>
                </div>
              </aside>
            </div>
          </section>
        </main>
      </div>
    </div>
    
    <div id="schedule-modal" class="schedule-modal" hidden>
      <div class="schedule-modal-overlay"></div>
      <div class="schedule-modal-content">
        <div class="schedule-modal-header">
          <h2>Schedule a Viewing</h2>
          <button type="button" class="close-button" aria-label="Close">✕</button>
        </div>
        <div class="schedule-modal-body">
          <div class="detail-row">
            <label>Tenant</label>
            <p id="schedule-tenant-name">—</p>
          </div>
          <div class="detail-row">
            <label>Property</label>
            <p id="schedule-property-name">—</p>
          </div>
          <div class="detail-row">
            <label for="schedule-date">Date</label>
            <input type="date" id="schedule-date" />
          </div>
          <div class="detail-row">
            <label for="schedule-time">Time</label>
            <input type="time" id="schedule-time" />
          </div>
        </div>
        <div class="schedule-modal-footer">
          <button type="button" class="secondary-btn cancel-btn">Cancel</button>
          <button type="button" class="primary-btn save-btn">Schedule Viewing</button>
        </div>
      </div>
    </div>`;

  const state = {
    bookings: [],
    properties: [],
    conversations: [],
    selected: null,
    search: '',
    statusFilter: 'all',
    propertyFilter: 'all',
    page: 1,
    pageSize: 8
  };

  const tbody = root.querySelector('#inquiries-rows');
  const searchInput = root.querySelector('#inquiry-search');
  const propertyFilter = root.querySelector('#property-filter');
  const detailPanel = root.querySelector('#tenant-detail-panel');
  const paginationButtons = root.querySelectorAll('.pagination button[data-page]');

  const scheduleModal = root.querySelector('#schedule-modal');
  const scheduleCloseBtn = scheduleModal.querySelector('.close-button');
  const scheduleCancelBtn = scheduleModal.querySelector('.cancel-btn');
  const scheduleSaveBtn = scheduleModal.querySelector('.save-btn');
  const scheduleTenantName = scheduleModal.querySelector('#schedule-tenant-name');
  const schedulePropertyName = scheduleModal.querySelector('#schedule-property-name');
  const scheduleDate = scheduleModal.querySelector('#schedule-date');
  const scheduleTime = scheduleModal.querySelector('#schedule-time');
  
  let schedulingBooking = null;

  const getCurrentUser = () => { try { return JSON.parse(localStorage.getItem('dormhive.user') ?? '{}'); } catch { return {}; } };

  const getVisibleBookings = () => {
    const query = state.search.trim().toLowerCase();
    return state.bookings.filter((booking) => {
      const matchesSearch = !query || `${booking.tenant_name ?? ''} ${booking.property_title ?? ''} ${booking.message ?? ''}`.toLowerCase().includes(query);
      const matchesStatus = state.statusFilter === 'all'
        || (state.statusFilter === 'new' && String(booking.status ?? '').toLowerCase() === 'pending')
        || (state.statusFilter === 'pending' && String(booking.status ?? '').toLowerCase() === 'pending')
        || (state.statusFilter === 'replied' && String(booking.status ?? '').toLowerCase() === 'approved');
      const matchesProperty = state.propertyFilter === 'all' || String(booking.property_id) === String(state.propertyFilter);
      return matchesSearch && matchesStatus && matchesProperty;
    });
  };

  const renderPropertyOptions = () => {
    const options = ['<option value="all">All Properties</option>'];
    for (const property of state.properties) {
      options.push(`<option value="${property.id}">${esc(property.title || 'Untitled property')}</option>`);
    }
    propertyFilter.innerHTML = options.join('');
    propertyFilter.value = state.propertyFilter;
  };

  const renderPagination = (visible = getVisibleBookings()) => {
    const totalPages = Math.max(1, Math.ceil(visible.length / state.pageSize));
    if (state.page > totalPages) state.page = totalPages;

    const pageNumbers = [1, 2, 3].map((n) => (n <= totalPages ? n : null)).filter((n) => n !== null);
    paginationButtons.forEach((button) => {
      const pageValue = button.dataset.page;
      if (pageValue === 'prev') button.disabled = state.page <= 1;
      else if (pageValue === 'next') button.disabled = state.page >= totalPages;
      else {
        const pageNumber = Number(pageValue);
        button.hidden = !pageNumbers.includes(pageNumber);
        button.textContent = String(pageNumber);
        button.classList.toggle('active', state.page === pageNumber);
      }
    });
  };

  const renderDetailPanel = () => {
    if (!detailPanel) return;
    if (!state.selected) {
      detailPanel.innerHTML = '<div class="detail-placeholder">Select a tenant row to view inquiry details.</div>';
      return;
    }

    const booking = state.selected;
    const latestMessage = booking.message || 'No additional message yet.';
    const info = statusInfo(booking.status);

    detailPanel.innerHTML = `
      <div class="detail-header">
        <div>
          <p class="detail-kicker">Inquiry Details</p>
          <h3>${esc(booking.tenant_name || 'Unknown tenant')}</h3>
        </div>
        <span class="badge ${info.className}">${esc(info.label)}</span>
      </div>

      <div class="detail-grid">
        <div class="detail-item">
          <span class="detail-label">Tenant</span>
          <strong>${esc(booking.tenant_name || 'Unknown tenant')}</strong>
        </div>
        <div class="detail-item">
          <span class="detail-label">Property</span>
          <strong>${esc(booking.property_title || 'Unknown property')}</strong>
        </div>
        <div class="detail-item">
          <span class="detail-label">Move-in Date</span>
          <strong>${esc(formatDate(booking.move_in_date || booking.created_at))}</strong>
        </div>
        <div class="detail-item">
          <span class="detail-label">Inquiry Date</span>
          <strong>${esc(formatDate(booking.created_at))}</strong>
        </div>
      </div>

      <div class="detail-actions">
        <button type="button" class="primary-btn schedule-panel-action">Schedule Viewing</button>
        <button type="button" class="accept-action">Accept Tenant</button>
        <button type="button" class="danger-btn archive-panel-action">Archive</button>
      </div>
    `;

    const schedulePanelAction = detailPanel.querySelector('.schedule-panel-action');
    const acceptPanelAction = detailPanel.querySelector('.accept-action');
    const archivePanelAction = detailPanel.querySelector('.archive-panel-action');

    schedulePanelAction?.addEventListener('click', () => openScheduleModal(booking));
    acceptPanelAction?.addEventListener('click', () => acceptTenant());
    archivePanelAction?.addEventListener('click', () => archiveBooking(booking));
  };

  const renderRows = () => {
    const visible = getVisibleBookings();
    const totalPages = Math.max(1, Math.ceil(visible.length / state.pageSize));
    if (state.page > totalPages) state.page = totalPages;

    const offset = (state.page - 1) * state.pageSize;
    const pageItems = visible.slice(offset, offset + state.pageSize);

    tbody.innerHTML = pageItems.map((booking) => {
      const info = statusInfo(booking.status);
      const selectedClass = state.selected?.id === booking.id ? 'selected' : '';
      return `
        <tr class="${selectedClass}" data-booking-id="${booking.id}">
          <td>${esc(booking.tenant_name || 'Unknown tenant')}</td>
          <td>${esc(booking.property_title || 'Unknown property')}</td>
          <td>${esc(formatDate(booking.move_in_date || booking.created_at))}</td>
          <td><span class="badge ${info.className}">${esc(info.label)}</span></td>
          <td>${esc(booking.message || 'No message provided.')}</td>
          <td>
            <div class="actions-group">
              <button type="button" class="table-action reply-action" data-booking-id="${booking.id}" data-action="reply" title="Reply">Reply</button>
            </div>
          </td>
        </tr>`;
    }).join('') || '<tr><td colspan="6" class="empty-row">No inquiries found.</td></tr>';

    renderPagination(visible);

    tbody.querySelectorAll('tr[data-booking-id]').forEach((row) => {
      row.addEventListener('click', (event) => {
        if (event.target.closest('.table-action')) return;
        const id = Number(row.dataset.bookingId);
        const booking = state.bookings.find((item) => item.id === id);
        if (booking) selectBooking(booking);
      });
    });

    tbody.querySelectorAll('.reply-action').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        const id = Number(button.dataset.bookingId);
        const booking = state.bookings.find((item) => item.id === id);
        if (booking) openReplyThread(booking);
      });
    });
  };

  const getConversationForBooking = (booking) => {
    const current = getCurrentUser();
    return state.conversations.find((conversation) =>
      Number(conversation.tenant_id) === Number(booking.tenant_id) &&
      Number(conversation.owner_id) === Number(current.id) &&
      Number(conversation.property_id) === Number(booking.property_id)
    ) || null;
  };

  const focusBooking = (booking) => {
    if (!booking) return null;
    state.selected = booking;
    renderRows();
    renderDetailPanel();
    return booking;
  };

  const selectBooking = async (booking) => {
    state.selected = booking;
    renderRows();
    renderDetailPanel();
  };

  const acceptTenant = async () => {
    if (!state.selected) return;
    try {
      const response = await fetch(`${API}/bookings/${state.selected.id}/status`, {
        method: 'PATCH',
        headers: auth(),
        body: JSON.stringify({ status: 'approved' })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || 'Unable to accept tenant.');
      state.bookings = state.bookings.map((booking) => booking.id === state.selected.id ? { ...booking, status: 'approved' } : booking);
      state.selected = state.bookings.find((booking) => booking.id === state.selected.id) || null;
      renderRows();
      renderDetailPanel();
      if (state.selected) await renderThread(state.selected);
      await updateListingCountsInSidebar();
      alert('Tenant accepted successfully! They will now appear in Active Tenants.');
    } catch (error) {
      alert(error.message);
    }
  };

  const archiveBooking = async (booking) => {
    if (!booking) return;
    try {
      const response = await fetch(`${API}/bookings/${booking.id}/status`, {
        method: 'PATCH',
        headers: auth(),
        body: JSON.stringify({ status: 'rejected' })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || 'Unable to archive inquiry.');
      state.bookings = state.bookings.map((b) => b.id === booking.id ? { ...b, status: 'rejected' } : b);
      renderRows();
      renderDetailPanel();
    } catch (error) {
      alert(error.message);
    }
  };

  const openReplyThread = (booking) => {
    const activeBooking = focusBooking(booking) || booking;
    if (!activeBooking) return;

    localStorage.setItem('dormhive.activeTenantSelection', JSON.stringify({
      tenantId: activeBooking.tenant_id,
      propertyId: activeBooking.property_id,
      tenantName: activeBooking.tenant_name || 'Tenant',
      propertyTitle: activeBooking.property_title || 'Property'
    }));

    location.hash = '#/owner/message';
  };

  const openScheduleModal = (booking) => {
    const activeBooking = focusBooking(booking) || state.bookings.find((item) => Number(item.id) === Number(booking?.id)) || booking;
    if (!activeBooking) return;

    schedulingBooking = activeBooking;
    state.selected = activeBooking;
    scheduleTenantName.textContent = activeBooking.tenant_name || 'Unknown tenant';
    schedulePropertyName.textContent = activeBooking.property_title || 'Unknown property';

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    scheduleDate.value = tomorrow.toISOString().split('T')[0];
    scheduleTime.value = '10:00';

    scheduleModal.hidden = false;
    document.body.classList.add('schedule-modal-open');
  };
  
  const closeScheduleModal = () => {
    scheduleModal.hidden = true;
    schedulingBooking = null;
    scheduleDate.value = '';
    scheduleTime.value = '';
    document.body.classList.remove('schedule-modal-open');
  };



  const scheduleViewing = async () => {
    const targetBooking = schedulingBooking || state.selected;
    if (!targetBooking) return;

    const dateValue = scheduleDate.value.trim();
    const timeValue = scheduleTime.value.trim();

    if (!dateValue || !timeValue) {
      alert('Please select both date and time.');
      return;
    }

    const scheduledDateTime = new Date(`${dateValue}T${timeValue}`);
    const message = `Viewing scheduled for ${scheduledDateTime.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}.`;

    try {
      let conversation = getConversationForBooking(targetBooking);
      if (!conversation) {
        const createResponse = await fetch(`${API}/messages/conversations`, {
          method: 'POST',
          headers: auth(),
          body: JSON.stringify({
            bookingId: targetBooking.id,
            tenantId: targetBooking.tenant_id,
            ownerId: getCurrentUser().id,
            propertyId: targetBooking.property_id
          })
        });
        const createBody = await createResponse.json();
        if (!createResponse.ok) throw new Error(createBody.message || 'Unable to start a conversation.');
        conversation = createBody.data;
        state.conversations.push(conversation);
      }

      const response = await fetch(`${API}/messages`, {
        method: 'POST',
        headers: auth(),
        body: JSON.stringify({ conversationId: conversation.id, body: message })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Unable to schedule viewing.');

      alert('Viewing scheduled successfully! Tenant has been notified.');
      closeScheduleModal();
      renderRows();
    } catch (error) {
      alert(error.message);
    }
  };

  const load = async () => {
    try {
      const [bookingResponse, propertyResponse, conversationResponse] = await Promise.all([
        fetch(`${API}/bookings`, { headers: auth() }),
        fetch(`${API}/properties?limit=100`, { headers: auth() }),
        fetch(`${API}/messages/conversations`, { headers: auth() })
      ]);

      const bookingBody = await bookingResponse.json();
      const propertyBody = await propertyResponse.json();
      const conversationBody = await conversationResponse.json();

      if (!bookingResponse.ok) throw new Error(bookingBody.message || 'Unable to load inquiries.');
      if (!propertyResponse.ok) throw new Error(propertyBody.message || 'Unable to load properties.');
      if (!conversationResponse.ok) throw new Error(conversationBody.message || 'Unable to load conversations.');

      const currentUserId = Number(getCurrentUser().id);
      state.bookings = (Array.isArray(bookingBody.data) ? bookingBody.data : [])
        .filter((booking) => Number(booking.owner_id) === currentUserId || Number(booking.property_owner_id) === currentUserId)
        .map((booking) => ({
          ...booking,
          tenant_name: booking.tenant_name || [booking.first_name, booking.last_name].filter(Boolean).join(' ') || 'Unknown tenant',
          property_title: booking.property_title || 'Unknown property'
        }));
      state.properties = Array.isArray(propertyBody.data) ? propertyBody.data : [];
      state.conversations = Array.isArray(conversationBody.data) ? conversationBody.data : [];

      renderPropertyOptions();
      renderRows();
      renderDetailPanel();
      if (state.bookings[0]) selectBooking(state.bookings[0]);
      await updateListingCountsInSidebar();
    } catch (error) {
      const msgArea = root.querySelector('.inquiries-table tbody');
      if (msgArea) msgArea.innerHTML = `<tr><td colspan="6" class="empty-row">Error: ${esc(error.message)}</td></tr>`;
    }
  };

  searchInput.addEventListener('input', (event) => {
    state.search = event.target.value;
    state.page = 1;
    renderRows();
  });

  root.querySelectorAll('[data-filter-status] .pill').forEach((button) => {
    button.addEventListener('click', () => {
      root.querySelectorAll('[data-filter-status] .pill').forEach((pill) => pill.classList.remove('active'));
      button.classList.add('active');
      state.statusFilter = button.dataset.status;
      state.page = 1;
      renderRows();
    });
  });

  propertyFilter.addEventListener('change', (event) => {
    state.propertyFilter = event.target.value;
    state.page = 1;
    renderRows();
  });

  paginationButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const pageValue = button.dataset.page;
      if (pageValue === 'prev') {
        if (state.page > 1) {
          state.page -= 1; renderRows();
        }
      } else if (pageValue === 'next') {
        const totalPages = Math.max(1, Math.ceil(getVisibleBookings().length / state.pageSize));
        if (state.page < totalPages) {
          state.page += 1; renderRows();
        }
      } else {
        const nextPage = Number(pageValue);
        if (Number.isFinite(nextPage) && nextPage >= 1) {
          state.page = nextPage; renderRows();
        }
      }
    });
  });

  scheduleCloseBtn.addEventListener('click', closeScheduleModal);
  scheduleCancelBtn.addEventListener('click', closeScheduleModal);
  scheduleSaveBtn.addEventListener('click', scheduleViewing);
  
  scheduleModal.querySelector('.schedule-modal-overlay')?.addEventListener('click', closeScheduleModal);

  detailPanel.addEventListener('click', (event) => {
    const actionButton = event.target.closest('.accept-action');
    if (actionButton && state.selected) {
      acceptTenant();
    }

    const archiveButton = event.target.closest('.archive-panel-action');
    if (archiveButton && state.selected) {
      archiveBooking(state.selected);
    }

    const scheduleButton = event.target.closest('.schedule-panel-action');
    if (scheduleButton && state.selected) {
      openScheduleModal(state.selected);
    }
  });

  root.querySelector('.logout')?.addEventListener('click', () => {
    localStorage.clear();
    location.assign('#/login');
  });

  load();
}


