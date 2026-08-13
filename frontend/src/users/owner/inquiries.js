import { ensureOwnerSidebarStyles, renderOwnerSidebar } from './sidebarOwner.js';

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
                  <button type="button">‹</button>
                  <button type="button" class="active">1</button>
                  <button type="button">›</button>
                </div>
              </section>

              <aside class="detail-shell">
                <div class="detail-actions">
                  <button type="button" class="reply-action">View / Reply</button>
                  <button type="button" class="secondary-action">Schedule Viewing</button>
                  <button type="button" class="danger-action">Archive</button>
                </div>

                <div class="message-thread">
                  <div class="thread-header">
                    <div>
                      <h2 id="thread-title">Select an inquiry</h2>
                      <p id="thread-property">Property details will appear here.</p>
                    </div>
                  </div>
                  <div id="thread-messages" class="thread-messages"></div>
                  <form id="reply-form" class="reply-form">
                    <input id="reply-input" type="text" placeholder="Reply" autocomplete="off" />
                    <button type="submit" aria-label="Send reply">➤</button>
                  </form>
                </div>
              </aside>
            </div>
          </section>
        </main>
      </div>
    </div>`;

  const state = {
    bookings: [],
    properties: [],
    conversations: [],
    selected: null,
    search: '',
    statusFilter: 'all',
    propertyFilter: 'all'
  };

  const tbody = root.querySelector('#inquiries-rows');
  const searchInput = root.querySelector('#inquiry-search');
  const propertyFilter = root.querySelector('#property-filter');
  const threadTitle = root.querySelector('#thread-title');
  const threadProperty = root.querySelector('#thread-property');
  const threadMessages = root.querySelector('#thread-messages');
  const replyForm = root.querySelector('#reply-form');
  const replyInput = root.querySelector('#reply-input');

  const renderPropertyOptions = () => {
    const options = ['<option value="all">All Properties</option>'];
    for (const property of state.properties) {
      options.push(`<option value="${property.id}">${esc(property.title || 'Untitled property')}</option>`);
    }
    propertyFilter.innerHTML = options.join('');
  };

  const renderRows = () => {
    const query = state.search.trim().toLowerCase();

    const visible = state.bookings.filter((booking) => {
      const info = statusInfo(booking.status);
      const matchesSearch = !query || `${booking.tenant_name ?? ''} ${booking.property_title ?? ''} ${booking.message ?? ''}`.toLowerCase().includes(query);
      const matchesStatus = state.statusFilter === 'all'
        || (state.statusFilter === 'new' && info.label === 'New Inquiry')
        || (state.statusFilter === 'pending' && booking.status === 'pending')
        || (state.statusFilter === 'replied' && booking.status === 'approved');
      const matchesProperty = state.propertyFilter === 'all' || String(booking.property_id) === state.propertyFilter;
      return matchesSearch && matchesStatus && matchesProperty;
    });

    tbody.innerHTML = visible.map((booking) => {
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
            <button type="button" class="table-action" data-booking-id="${booking.id}">Reply</button>
          </td>
        </tr>
      `;
    }).join('') || '<tr><td colspan="6" class="empty-row">No inquiries found.</td></tr>';

    tbody.querySelectorAll('tr[data-booking-id]').forEach((row) => {
      row.addEventListener('click', (event) => {
        if (event.target.closest('.table-action')) return;
        const id = Number(row.dataset.bookingId);
        const booking = state.bookings.find((item) => item.id === id);
        if (booking) selectBooking(booking);
      });
    });

    tbody.querySelectorAll('.table-action').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        const id = Number(button.dataset.bookingId);
        const booking = state.bookings.find((item) => item.id === id);
        if (booking) selectBooking(booking);
      });
    });
  };

  const selectBooking = async (booking) => {
    state.selected = booking;
    renderRows();

    threadTitle.textContent = booking.tenant_name || 'Unknown tenant';
    threadProperty.textContent = booking.property_title || 'Unknown property';

    const conversation = state.conversations.find((item) =>
      Number(item.tenant_id) === Number(booking.tenant_id) &&
      Number(item.owner_id) === Number(currentUser().id) &&
      Number(item.property_id) === Number(booking.property_id)
    );

    if (conversation) {
      try {
        const response = await fetch(`${API}/messages/conversations/${conversation.id}`, { headers: auth() });
        const body = await response.json();
        if (!response.ok) throw new Error(body.message || 'Unable to load conversation history.');
        const items = Array.isArray(body.data) ? body.data : [];
        threadMessages.innerHTML = items.length
          ? items.map((message) => `
              <div class="bubble ${message.sender_id === currentUser().id ? 'mine' : 'their'}">
                <div class="bubble-head"><strong>${message.sender_id === currentUser().id ? 'You' : 'Tenant'}</strong><span>${formatDate(message.created_at)}</span></div>
                <p>${esc(message.body || 'No message text.')}</p>
              </div>
            `).join('')
          : '<p class="empty-message">No message thread available for this inquiry yet.</p>';
      } catch (error) {
        threadMessages.innerHTML = `<p class="empty-message">${esc(error.message)}</p>`;
      }
    } else {
      threadMessages.innerHTML = `
        <div class="bubble their">
          <div class="bubble-head"><strong>Owner note</strong><span>${formatDate(booking.created_at)}</span></div>
          <p>${esc(booking.message || 'No message provided.')}</p>
        </div>`;
    }
  };

  const sendReply = async (event) => {
    event.preventDefault();
    if (!state.selected) return;
    const body = replyInput.value.trim();
    if (!body) return;

    try {
      let conversation = state.conversations.find((item) =>
        Number(item.tenant_id) === Number(state.selected.tenant_id) &&
        Number(item.owner_id) === Number(currentUser().id) &&
        Number(item.property_id) === Number(state.selected.property_id)
      );
      if (!conversation) {
        const createResponse = await fetch(`${API}/messages/conversations`, {
          method: 'POST',
          headers: auth(),
          body: JSON.stringify({
            bookingId: state.selected.id,
            tenantId: state.selected.tenant_id,
            ownerId: currentUser().id,
            propertyId: state.selected.property_id
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
        body: JSON.stringify({ conversationId: conversation.id, body })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Unable to send the message.');

      replyInput.value = '';
      await selectBooking(state.selected);
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

      state.bookings = Array.isArray(bookingBody.data) ? bookingBody.data : [];
      state.properties = Array.isArray(propertyBody.data) ? propertyBody.data : [];
      state.conversations = Array.isArray(conversationBody.data) ? conversationBody.data : [];

      renderPropertyOptions();
      renderRows();
      if (state.bookings[0]) selectBooking(state.bookings[0]);
    } catch (error) {
      threadTitle.textContent = 'Unable to load inquiries';
      threadProperty.textContent = error.message;
      threadMessages.innerHTML = '<p class="empty-message">Please sign in again with a valid owner session.</p>';
    }
  };

  searchInput.addEventListener('input', (event) => {
    state.search = event.target.value;
    renderRows();
  });

  root.querySelectorAll('[data-filter-status] .pill').forEach((button) => {
    button.addEventListener('click', () => {
      root.querySelectorAll('[data-filter-status] .pill').forEach((pill) => pill.classList.remove('active'));
      button.classList.add('active');
      state.statusFilter = button.dataset.status;
      renderRows();
    });
  });

  propertyFilter.addEventListener('change', (event) => {
    state.propertyFilter = event.target.value;
    renderRows();
  });

  replyForm.addEventListener('submit', sendReply);

  root.querySelector('.logout')?.addEventListener('click', () => {
    localStorage.clear();
    location.assign('#/login');
  });

  load();
}


