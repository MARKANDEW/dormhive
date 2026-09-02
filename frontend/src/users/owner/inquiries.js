import { ensureOwnerSidebarStyles, renderOwnerSidebar, updateListingCountsInSidebar } from './sidebarOwner.js';

const API = window.DORMHIVE_API_URL ?? 'http://localhost:5000/api/v1';
const API_ORIGIN = API.replace(/\/api\/v1\/?$/, '');
const auth = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('dormhive.accessToken') ?? ''}` });
const esc = (v = '') => { const e = document.createElement('span'); e.textContent = v; return e.innerHTML; };
const currentUser = () => { try { return JSON.parse(localStorage.getItem('dormhive.user') ?? '{}'); } catch { return {}; } };
const initials = (value = '') => String(value ?? '').split(/\s+/).filter(Boolean).map((part) => part[0]).slice(0, 2).join('').toUpperCase() || 'T';
const avatarUrl = (value = '') => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^(data:|blob:|https?:\/\/)/i.test(raw)) return raw;
  return `${API_ORIGIN}${raw.startsWith('/') ? '' : '/'}${raw}`;
};
const renderTenantAvatar = (name = 'Tenant', image = '') => {
  const source = avatarUrl(image);
  if (!source) {
    return `<span class="fallback-avatar" aria-label="${esc(name)} avatar">${esc(initials(name))}</span>`;
  }
  return `<img src="${esc(source)}" alt="${esc(name)} profile" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline-flex';" /><span class="fallback-avatar" style="display:none;">${esc(initials(name))}</span>`;
};
const renderAvatarMarkup = () => '';

function css() {
  document.querySelectorAll('link[data-owner-style], style[data-owner-style]').forEach((node) => node.remove());
  if (!document.querySelector('[data-owner-style="inquiries"]')) {
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = new URL('./style/inquiries.css', import.meta.url);
    l.dataset.ownerStyle = 'inquiries';
    document.head.append(l);
  }
}

const statusInfo = (status) => {
  const normalized = String(status ?? '').toLowerCase();
  if (normalized === 'approved') return { label: 'Replied', className: 'status-replied' };
  if (normalized === 'rejected' || normalized === 'cancelled') return { label: 'Archived', className: 'status-archived' };
  if (normalized === 'pending') return { label: 'Pending', className: 'status-pending' };
  return { label: 'New', className: 'status-new' };
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
          <section class="inquiries-board">
            <div class="inquiries-header">
              <p class="page-kicker">INQUIRIES</p>
              <h1>Inquiries</h1>
              <p class="page-subtitle">Manage tenant inquiries, respond to prospective tenants, and track their status.</p>
            </div>

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
                  <select id="property-filter">
                    <option value="all">All Properties</option>
                  </select>
                </label>
              </div>
            </div>

            <div class="inquiries-layout">
              <section class="list-shell">
                <div class="inquiry-table-header" aria-hidden="true">
                  <div class="cell tenant-header">Tenant</div>
                  <div class="cell property-header">Property</div>
                  <div class="cell date-header">Date</div>
                  <div class="cell status-header">Status</div>
                  <div class="cell message-header">Latest Message</div>
                  <div class="cell action-header">Actions</div>
                </div>
                <div id="inquiries-rows" class="inquiry-list" aria-live="polite"></div>

                <div class="list-footer">
                  <div id="pagination-summary" class="pagination-summary">Showing 0 to 0 of 0 inquiries</div>
                  <div class="pagination">
                    <button type="button" data-page="prev" aria-label="Previous page">‹</button>
                    <button type="button" data-page="1" class="active">1</button>
                    <button type="button" data-page="2">2</button>
                    <button type="button" data-page="3">3</button>
                    <button type="button" data-page="next" aria-label="Next page">›</button>
                  </div>
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

    <div id="reply-modal" class="reply-modal" hidden>
      <div class="reply-modal-overlay"></div>
      <div class="reply-modal-card">
        <div class="reply-modal-header">
          <h2>Reply to <span id="reply-recipient">Tenant</span></h2>
        </div>
        <div class="reply-modal-body">
          <textarea id="reply-message" rows="6" placeholder="Write your message..."></textarea>
        </div>
        <div class="reply-modal-footer">
          <button type="button" class="secondary-btn reply-cancel">Cancel</button>
          <button type="button" class="primary-btn reply-send">Send Reply</button>
        </div>
      </div>
    </div>

    <div id="archive-confirm-modal" class="archive-confirm-modal" hidden>
      <div class="archive-confirm-overlay"></div>
      <div class="archive-confirm-card">
        <div class="archive-confirm-header">
          <h2 id="archive-confirm-title">Archive Inquiry</h2>
        </div>
        <div class="archive-confirm-body">
          <p id="archive-confirm-text">Are you sure you want to archive this inquiry?</p>
        </div>
        <div class="archive-confirm-footer">
          <button type="button" class="secondary-btn archive-cancel-btn">Cancel</button>
          <button type="button" class="primary-btn archive-confirm-btn">Archive Property</button>
        </div>
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
    </div>

    <div id="success-modal" class="success-modal" hidden>
      <div class="success-modal-overlay"></div>
      <div class="success-modal-card" role="dialog" aria-modal="true" aria-labelledby="success-modal-title">
        <div class="success-modal-icon" aria-hidden="true">
          <span class="success-dot dot-one"></span>
          <span class="success-dot dot-two"></span>
          <span class="success-dot dot-three"></span>
          <span class="success-dot dot-four"></span>
          <span class="success-check">✓</span>
        </div>
        <h2 id="success-modal-title">Success!</h2>
        <p class="success-modal-message">Tenant accepted successfully!</p>
        <p class="success-modal-submessage">They will now appear in Active Tenants.</p>
        <button type="button" class="success-ok-btn">OK</button>
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
  const paginationSummary = root.querySelector('#pagination-summary');
  const paginationButtons = root.querySelectorAll('.pagination button[data-page]');

  const replyModal = root.querySelector('#reply-modal');
  const replyRecipient = root.querySelector('#reply-recipient');
  const replyMessageInput = root.querySelector('#reply-message');
  const replyCancelBtn = root.querySelector('.reply-cancel');
  const replySendBtn = root.querySelector('.reply-send');

  const archiveConfirmModal = root.querySelector('#archive-confirm-modal');
  const archiveConfirmTitle = root.querySelector('#archive-confirm-title');
  const archiveConfirmText = root.querySelector('#archive-confirm-text');
  const archiveConfirmCancelBtn = root.querySelector('.archive-cancel-btn');
  const archiveConfirmActionBtn = root.querySelector('.archive-confirm-btn');

  const scheduleModal = root.querySelector('#schedule-modal');
  const scheduleCloseBtn = scheduleModal.querySelector('.close-button');
  const scheduleCancelBtn = scheduleModal.querySelector('.cancel-btn');
  const scheduleSaveBtn = scheduleModal.querySelector('.save-btn');
  const scheduleTenantName = scheduleModal.querySelector('#schedule-tenant-name');
  const schedulePropertyName = scheduleModal.querySelector('#schedule-property-name');
  const scheduleDate = scheduleModal.querySelector('#schedule-date');
  const scheduleTime = scheduleModal.querySelector('#schedule-time');

  const successModal = root.querySelector('#success-modal');
  const successOkBtn = root.querySelector('.success-ok-btn');
  
  let schedulingBooking = null;
  let pendingArchiveBooking = null;

  const getCurrentUser = () => { try { return JSON.parse(localStorage.getItem('dormhive.user') ?? '{}'); } catch { return {}; } };

  const getVisibleBookings = () => {
    const query = state.search.trim().toLowerCase();
    return state.bookings.filter((booking) => {
      const normalizedStatus = String(booking.status ?? '').toLowerCase();
      if (normalizedStatus === 'approved') return false;

      const matchesSearch = !query || `${booking.tenant_name ?? ''} ${booking.property_title ?? ''} ${booking.message ?? ''}`.toLowerCase().includes(query);
      const matchesStatus = state.statusFilter === 'all'
        || (state.statusFilter === 'new' && normalizedStatus === 'pending')
        || (state.statusFilter === 'pending' && normalizedStatus === 'pending')
        || (state.statusFilter === 'replied' && normalizedStatus === 'replied');
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

  const changePage = (nextPage) => {
    const totalPages = Math.max(1, Math.ceil(getVisibleBookings().length / state.pageSize));
    const safePage = Math.min(Math.max(1, Number(nextPage) || 1), totalPages);
    if (safePage !== state.page) {
      state.page = safePage;
      renderRows();
    }
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

    const start = visible.length ? (state.page - 1) * state.pageSize + 1 : 0;
    const end = Math.min(state.page * state.pageSize, visible.length);
    if (paginationSummary) {
      paginationSummary.textContent = `Showing ${start} to ${end} of ${visible.length} inquiries`;
    }
  };

  const renderDetailPanel = () => {
    if (!detailPanel) return;
    if (!state.selected) {
      detailPanel.innerHTML = `
        <div class="empty-detail-state">
          <div class="empty-state-icon">✉</div>
          <h3>No inquiries yet</h3>
          <p>When tenants inquire about your properties, they will appear here.</p>
        </div>`;
      return;
    }

    const booking = state.selected;
    const info = statusInfo(booking.status);
    const latestMessage = booking.message || 'No message provided.';
    const tenantName = booking.tenant_name || 'Unknown tenant';

    detailPanel.innerHTML = `
      <div class="detail-header">
        <div class="detail-title-wrap">
          <p class="detail-kicker">Inquiry Details</p>
        </div>
        <div class="menu-wrap">
          <button type="button" class="more-menu" aria-label="More actions">⋮</button>
          <div class="detail-menu" hidden>
            <button type="button" class="menu-delete">Delete</button>
          </div>
        </div>
      </div>

      <div class="detail-person">
        <div class="tenant-profile-heading">
          <span class="tenant-avatar detail-avatar">${renderTenantAvatar(tenantName, booking.tenant_avatar_url || booking.avatar_url || '')}</span>
          <div class="detail-name-wrap">
            <strong>${esc(tenantName)}</strong>
          </div>
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
        <button type="button" class="primary-btn schedule-panel-action"><span class="button-icon">📅</span> Schedule Viewing</button>
        <button type="button" class="accept-action"><span class="button-icon">✓</span> Accept Tenant</button>
        <button type="button" class="secondary-btn archive-panel-action"><span class="button-icon">🗃</span> Archive</button>
      </div>
    `;

    const schedulePanelAction = detailPanel.querySelector('.schedule-panel-action');
    const acceptPanelAction = detailPanel.querySelector('.accept-action');
    const archivePanelAction = detailPanel.querySelector('.archive-panel-action');
    const moreMenuButton = detailPanel.querySelector('.more-menu');
    const detailMenu = detailPanel.querySelector('.detail-menu');
    const menuDelete = detailPanel.querySelector('.menu-delete');

    detailMenu.hidden = true;

    const closeMenu = (event) => {
      if (!detailMenu) return;
      const target = event?.target;
      if (!target || (!detailPanel.contains(target) && !target.closest?.('.more-menu'))) {
        detailMenu.hidden = true;
        moreMenuButton?.setAttribute('aria-expanded', 'false');
      }
    };

    document.removeEventListener('click', closeMenu);
    document.addEventListener('click', closeMenu);

    moreMenuButton?.setAttribute('aria-expanded', 'false');
    moreMenuButton?.addEventListener('click', (event) => {
      event.stopPropagation();
      if (!detailMenu) return;
      const nextState = detailMenu.hidden;
      detailMenu.hidden = !nextState;
      moreMenuButton.setAttribute('aria-expanded', String(!detailMenu.hidden));
    });

    menuDelete?.addEventListener('click', () => {
      detailMenu.hidden = true;
      deleteBooking(booking);
    });

    schedulePanelAction?.addEventListener('click', () => openScheduleModal(booking));
    acceptPanelAction?.addEventListener('click', () => acceptTenant());
    archivePanelAction?.addEventListener('click', () => openArchiveConfirmation(booking));
  };

  const renderRows = () => {
    const visible = getVisibleBookings();
    const totalPages = Math.max(1, Math.ceil(visible.length / state.pageSize));
    if (state.page > totalPages) state.page = totalPages;

    const offset = (state.page - 1) * state.pageSize;
    const pageItems = visible.slice(offset, offset + state.pageSize);

    if (!tbody) return;

    if (!pageItems.length) {
      tbody.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">✉</div>
          <h3>No inquiries yet</h3>
          <p>When tenants inquire about your properties, they will appear here.</p>
        </div>`;
      renderPagination(visible);
      return;
    }

    tbody.innerHTML = pageItems.map((booking) => {
      const info = statusInfo(booking.status);
      const selectedClass = state.selected?.id === booking.id ? 'selected' : '';
      const tenantName = booking.tenant_name || 'Unknown tenant';
      const dateValue = formatDate(booking.move_in_date || booking.created_at);
      const messageText = booking.message || 'No message provided.';

      return `
        <div class="inquiry-row ${selectedClass}" data-booking-id="${booking.id}">
          <div class="cell tenant-cell">
            <div class="tenant-name-group">
              <span class="tenant-avatar inquiry-avatar">${renderTenantAvatar(tenantName, booking.tenant_avatar_url || booking.avatar_url || '')}</span>
              <span>${esc(tenantName)}</span>
            </div>
          </div>
          <div class="cell property-cell">${esc(booking.property_title || 'Unknown property')}</div>
          <div class="cell date-cell">
            <div class="date-stack">
              <span>${esc(dateValue)}</span>
              <small>${esc(new Date(booking.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }))}</small>
            </div>
          </div>
          <div class="cell status-cell">
            <span class="badge ${info.className}">${esc(info.label)}</span>
          </div>
          <div class="cell message-cell">${esc(messageText)}</div>
          <div class="cell action-cell">
            <button type="button" class="reply-action" data-booking-id="${booking.id}">Reply</button>
          </div>
        </div>`;
    }).join('');

    renderPagination(visible);

    tbody.querySelectorAll('.inquiry-row').forEach((row) => {
      row.addEventListener('click', (event) => {
        if (event.target.closest('.reply-action')) return;
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
        if (booking) openReplyComposer(booking);
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

  const closeSuccessModal = () => {
    if (!successModal) return;
    successModal.hidden = true;
    document.body.classList.remove('success-modal-open');
  };

  const openSuccessModal = () => {
    if (!successModal) return;
    successModal.hidden = false;
    document.body.classList.add('success-modal-open');
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

      const acceptedBookingId = state.selected.id;
      state.bookings = state.bookings.filter((booking) => booking.id !== acceptedBookingId);
      state.selected = state.bookings[0] ?? null;
      renderRows();
      renderDetailPanel();
      await updateListingCountsInSidebar();
      openSuccessModal();
    } catch (error) {
      alert(error.message);
    }
  };

  const closeArchiveConfirmation = () => {
    pendingArchiveBooking = null;
    archiveConfirmModal.hidden = true;
    document.body.classList.remove('archive-confirm-open');
  };

  const openArchiveConfirmation = (booking, action = 'archive') => {
    if (!booking) return;
    pendingArchiveBooking = booking;
    const isDelete = action === 'delete';
    archiveConfirmTitle.textContent = isDelete ? 'Delete Inquiry' : 'Archive Inquiry';
    archiveConfirmText.textContent = isDelete
      ? `Are you sure you want to delete this inquiry from ${booking.tenant_name || 'this tenant'}?`
      : 'Are you sure you want to archive this inquiry?';
    archiveConfirmActionBtn.textContent = isDelete ? 'Delete Property' : 'Archive Property';
    archiveConfirmActionBtn.dataset.action = action;
    archiveConfirmModal.hidden = false;
    document.body.classList.add('archive-confirm-open');
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
      closeArchiveConfirmation();
    } catch (error) {
      alert(error.message);
    }
  };

  const deleteBooking = (booking) => {
    if (!booking) return;
    openArchiveConfirmation(booking, 'delete');
  };

  const openReplyComposer = (booking) => {
    const activeBooking = focusBooking(booking) || booking;
    if (!activeBooking) return;

    replyRecipient.textContent = activeBooking.tenant_name || 'Tenant';
    replyMessageInput.value = '';
    replyModal.hidden = false;
    document.body.classList.add('reply-modal-open');
    setTimeout(() => replyMessageInput.focus(), 50);
  };

  const closeReplyComposer = () => {
    replyModal.hidden = true;
    replyMessageInput.value = '';
    document.body.classList.remove('reply-modal-open');
  };

  const sendReply = async () => {
    const targetBooking = state.selected || null;
    const message = replyMessageInput.value.trim();
    if (!targetBooking || !message) {
      alert('Please enter a reply message before sending.');
      return;
    }

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
      if (!response.ok) throw new Error(result.message || 'Unable to send reply.');

      closeReplyComposer();
      alert('Reply sent successfully.');
    } catch (error) {
      alert(error.message);
    }
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
        .filter((booking) => (Number(booking.owner_id) === currentUserId || Number(booking.property_owner_id) === currentUserId)
          && String(booking.status ?? '').toLowerCase() !== 'approved')
        .map((booking) => ({
          ...booking,
          tenant_name: booking.tenant_name || [booking.first_name, booking.last_name].filter(Boolean).join(' ') || 'Unknown tenant',
          tenant_avatar_url: booking.tenant_avatar_url || booking.avatar_url || booking.tenant_avatar || '',
          property_title: booking.property_title || 'Unknown property'
        }));
      state.properties = (Array.isArray(propertyBody.data) ? propertyBody.data : [])
        .filter((property) => Number(property.owner_id) === currentUserId || Number(property.ownerId) === currentUserId || Number(property.property_owner_id) === currentUserId);
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
        changePage(state.page - 1);
      } else if (pageValue === 'next') {
        changePage(state.page + 1);
      } else {
        const nextPage = Number(pageValue);
        if (Number.isFinite(nextPage) && nextPage >= 1) {
          changePage(nextPage);
        }
      }
    });
  });

  replyCancelBtn.addEventListener('click', closeReplyComposer);
  replySendBtn.addEventListener('click', sendReply);
  replyModal.querySelector('.reply-modal-overlay')?.addEventListener('click', closeReplyComposer);

  archiveConfirmCancelBtn.addEventListener('click', closeArchiveConfirmation);
  archiveConfirmActionBtn.addEventListener('click', () => {
    if (!pendingArchiveBooking) return;
    if (archiveConfirmActionBtn.dataset.action === 'delete') {
      state.bookings = state.bookings.filter((b) => b.id !== pendingArchiveBooking.id);
      if (state.selected?.id === pendingArchiveBooking.id) {
        state.selected = state.bookings[0] ?? null;
      }
      renderRows();
      renderDetailPanel();
      closeArchiveConfirmation();
      return;
    }
    archiveBooking(pendingArchiveBooking);
  });
  archiveConfirmModal.querySelector('.archive-confirm-overlay')?.addEventListener('click', closeArchiveConfirmation);

  scheduleCloseBtn.addEventListener('click', closeScheduleModal);
  scheduleCancelBtn.addEventListener('click', closeScheduleModal);
  scheduleSaveBtn.addEventListener('click', scheduleViewing);
  
  scheduleModal.querySelector('.schedule-modal-overlay')?.addEventListener('click', closeScheduleModal);

  successOkBtn?.addEventListener('click', closeSuccessModal);
  successModal?.querySelector('.success-modal-overlay')?.addEventListener('click', closeSuccessModal);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && successModal && !successModal.hidden) {
      closeSuccessModal();
    }
  });

  detailPanel.addEventListener('click', (event) => {
    const actionButton = event.target.closest('.accept-action');
    if (actionButton && state.selected) {
      acceptTenant();
    }

    const archiveButton = event.target.closest('.archive-panel-action');
    if (archiveButton && state.selected) {
      openArchiveConfirmation(state.selected);
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


