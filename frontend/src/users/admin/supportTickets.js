import { ensureAdminSidebarStyles, renderAdminSidebar } from './sidebarAdmin.js';
import { applyAdminPrivacy } from './privacy.js';

const API = window.DORMHIVE_API_URL ?? 'http://localhost:5000/api/v1';
const headers = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('dormhive.accessToken') ?? ''}`
});
const escape = (value = '') => {
  const node = document.createElement('span');
  node.textContent = String(value ?? '');
  return node.innerHTML;
};

const normalizeStatus = (status = 'open') => {
  const value = String(status ?? 'open').trim().toLowerCase();
  if (['in_progress', 'in-progress', 'pending'].includes(value)) return 'pending';
  if (['resolved', 'done'].includes(value)) return 'resolved';
  if (['closed'].includes(value)) return 'closed';
  return 'open';
};

const statusMeta = {
  open: { label: 'Open', className: 'status-open' },
  pending: { label: 'Pending', className: 'status-pending' },
  resolved: { label: 'Resolved', className: 'status-resolved' },
  closed: { label: 'Closed', className: 'status-closed' }
};

const normalizePriority = (priority = 'medium') => {
  const value = String(priority ?? 'medium').trim().toLowerCase();
  if (['high', 'medium', 'low'].includes(value)) return value;
  return 'medium';
};

const priorityMeta = {
  high: { label: 'High', className: 'priority-high' },
  medium: { label: 'Medium', className: 'priority-medium' },
  low: { label: 'Low', className: 'priority-low' }
};

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
};

const filterByDateRange = (dateString, range) => {
  if (!dateString || range === 'all') return true;
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = (now - date) / (1000 * 60 * 60 * 24);
  if (range === 'today') return diffDays <= 1;
  if (range === '7') return diffDays <= 7;
  if (range === '30') return diffDays <= 30;
  if (range === '90') return diffDays <= 90;
  return true;
};

function css() {
  if (!document.querySelector('[data-admin-style="tickets"]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = new URL('./style/supportTickets.css', import.meta.url);
    link.dataset.adminStyle = 'tickets';
    document.head.append(link);
  }
}

async function apiGet(path) {
  const response = await fetch(`${API}${path}`, { headers: headers() });
  const body = await response.json();
  if (!response.ok) throw new Error(body.message || 'Request failed.');
  return body;
}

export function renderSupportTickets(root = document.querySelector('#app')) {
  if (!root) throw new Error('Support tickets requires #app.');
  css();
  ensureAdminSidebarStyles();

  const state = {
    tickets: [],
    search: '',
    statuses: new Set(['open', 'pending', 'resolved', 'closed']),
    priorities: new Set(['high', 'medium', 'low']),
    dateRange: 'all'
  };

  root.innerHTML = `
    <div class="admin-shell">
      ${renderAdminSidebar('supportTickets')}
      <div class="admin-main">
        <main class="support-hub-page">
          <header class="support-header">
            <div class="support-header-left">
              <h1>Support Hub</h1>
            </div>
            <div class="support-header-actions">
              <button type="button" class="support-btn ghost" id="new-ticket-btn">Create New Ticket</button>
              <button type="button" class="support-btn ghost" id="faq-btn">View FAQs</button>
              <button type="button" class="support-btn" id="export-btn">Export Ticket Data</button>
            </div>
          </header>

          <div class="support-content">
            <section class="support-filters" aria-label="Ticket filters">
              <div class="search-wrap">
                <span class="search-icon">⌕</span>
                <input id="ticket-search" type="text" placeholder="Search tickets, users, or FAQs..." />
              </div>

              <div class="filter-group">
                <h3>Status</h3>
                <label class="filter-option"><input class="status-filter" type="checkbox" value="open" checked /> Open</label>
                <label class="filter-option"><input class="status-filter" type="checkbox" value="pending" checked /> Pending</label>
                <label class="filter-option"><input class="status-filter" type="checkbox" value="resolved" checked /> Resolved</label>
                <label class="filter-option"><input class="status-filter" type="checkbox" value="closed" checked /> Closed</label>
              </div>

              <div class="filter-group">
                <h3>Priority</h3>
                <label class="filter-option"><input class="priority-filter" type="checkbox" value="high" checked /> High</label>
                <label class="filter-option"><input class="priority-filter" type="checkbox" value="medium" checked /> Medium</label>
                <label class="filter-option"><input class="priority-filter" type="checkbox" value="low" checked /> Low</label>
              </div>

              <div class="filter-group">
                <h3>Date Range</h3>
                <select id="date-range-filter">
                  <option value="all">All time</option>
                  <option value="today">Today</option>
                  <option value="7">Last 7 days</option>
                  <option value="30">Last 30 days</option>
                  <option value="90">Last 90 days</option>
                </select>
              </div>
            </section>

            <section class="support-main-panel">
              <div class="support-table-head">
                <span class="head-status">Status</span>
                <span class="head-user">User</span>
                <span class="head-priority">Priority</span>
                <span class="head-subject">Subject</span>
                <span class="head-date">Date/Time Opened</span>
                <span class="head-admin">Admin</span>
              </div>
              <div class="support-tickets-list" id="support-tickets-list"></div>
            </section>
          </div>
        </main>
      </div>
    </div>
  `;

  const listEl = root.querySelector('#support-tickets-list');
  const searchInput = root.querySelector('#ticket-search');
  const statusCheckboxes = root.querySelectorAll('.status-filter');
  const priorityCheckboxes = root.querySelectorAll('.priority-filter');
  const dateRangeFilter = root.querySelector('#date-range-filter');

  const getFilteredTickets = () => {
    const query = state.search.trim().toLowerCase();
    return state.tickets.filter((ticket) => {
      const normalizedStatus = normalizeStatus(ticket.status);
      const normalizedPriority = normalizePriority(ticket.priority);
      const matchesStatus = state.statuses.has(normalizedStatus);
      const matchesPriority = state.priorities.has(normalizedPriority);
      const matchesDate = filterByDateRange(ticket.created_at, state.dateRange);

      if (!matchesStatus || !matchesPriority || !matchesDate) return false;

      if (!query) return true;

      const haystack = [
        ticket.id,
        ticket.requester_name,
        ticket.requester_email,
        ticket.email,
        ticket.subject,
        ticket.description,
        ticket.message,
        ticket.status,
        ticket.priority,
        ticket.assigned_admin_name
      ].filter(Boolean).join(' ').toLowerCase();

      return haystack.includes(query);
    });
  };

  const renderTicketRows = () => {
    const filtered = getFilteredTickets();
    if (!filtered.length) {
      listEl.innerHTML = '<div class="empty-state">No tickets match the current filters.</div>';
      return;
    }

    listEl.innerHTML = filtered.map((ticket) => {
      const status = statusMeta[normalizeStatus(ticket.status)] || statusMeta.open;
      const priority = priorityMeta[normalizePriority(ticket.priority)] || priorityMeta.medium;
      const userName = ticket.requester_name || ticket.name || 'Unknown user';
      const userEmail = ticket.requester_email || ticket.email || 'No email provided';
      const assignedAdmin = ticket.assigned_admin_name || ticket.assignedAdminName || 'Unassigned';

      return `
        <article class="ticket-row" data-id="${ticket.id}" tabindex="0">
          <div class="row-status">
            <span class="status-badge ${status.className}">${status.label}</span>
            <span class="row-ticket-id">Ticket #${ticket.id}</span>
          </div>

          <div class="row-user">
            <div class="user-name" data-privacy-mask="name">${escape(userName)}</div>
            <div class="user-email" data-privacy-mask="email">${escape(userEmail)}</div>
          </div>

          <div class="row-priority">
            <span class="priority-badge ${priority.className}">${priority.label}</span>
          </div>

          <div class="row-subject"><strong data-privacy-mask="detail">${escape(ticket.subject || 'Support request')}</strong></div>

          <div class="row-date">${escape(formatDate(ticket.created_at))}</div>

          <div class="row-admin" data-privacy-mask="name">${escape(assignedAdmin)}</div>
        </article>
      `;
    }).join('');

    listEl.querySelectorAll('.ticket-row').forEach((row) => {
      row.addEventListener('click', () => openTicketDetails(Number(row.dataset.id)));
      row.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openTicketDetails(Number(row.dataset.id));
        }
      });
    });
    applyAdminPrivacy(root);
  };

  const openTicketDetails = async (ticketId) => {
    const ticket = state.tickets.find((item) => Number(item.id) === Number(ticketId));
    if (!ticket) return;

    const overlay = document.createElement('div');
    overlay.className = 'support-modal-backdrop';
    overlay.innerHTML = `
      <div class="support-modal">
        <button type="button" class="support-modal-close" data-close="true">×</button>
        <div class="support-modal-header">
          <div>
            <div class="modal-kicker">Ticket #${ticket.id}</div>
            <h2>${escape(ticket.subject || 'Support request')}</h2>
          </div>
          <span class="status-badge ${statusMeta[normalizeStatus(ticket.status)]?.className || 'status-open'}">${statusMeta[normalizeStatus(ticket.status)]?.label || 'Open'}</span>
        </div>

        <div class="support-modal-grid">
          <div class="detail-block">
            <label>User</label>
            <div data-privacy-mask="name">${escape(ticket.requester_name || ticket.name || 'Unknown user')}</div>
          </div>
          <div class="detail-block">
            <label>Email</label>
            <div data-privacy-mask="email">${escape(ticket.requester_email || ticket.email || 'No email')}</div>
          </div>
          <div class="detail-block">
            <label>Priority</label>
            <div>${escape(priorityMeta[normalizePriority(ticket.priority)]?.label || 'Medium')}</div>
          </div>
          <div class="detail-block">
            <label>Status</label>
            <div>${escape(statusMeta[normalizeStatus(ticket.status)]?.label || 'Open')}</div>
          </div>
          <div class="detail-block full">
            <label>Message</label>
            <div data-privacy-mask="detail">${escape(ticket.description || ticket.message || 'No message provided.')}</div>
          </div>
          <div class="detail-block">
            <label>Date opened</label>
            <div>${escape(formatDate(ticket.created_at))}</div>
          </div>
          <div class="detail-block">
            <label>Assigned admin</label>
            <div data-privacy-mask="name">${escape(ticket.assigned_admin_name || ticket.assignedAdminName || 'Unassigned')}</div>
          </div>
        </div>

        <div class="support-modal-actions">
          <button type="button" class="support-btn" data-action="resolve">Mark Resolved</button>
          <button type="button" class="support-btn ghost" data-action="close">Close</button>
        </div>
      </div>
    `;

    const closeModal = () => overlay.remove();
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay || event.target.dataset.close === 'true') closeModal();
    });

    overlay.querySelector('[data-action="resolve"]').addEventListener('click', async () => {
      try {
        const response = await fetch(`${API}/support-tickets/${encodeURIComponent(ticket.id)}`, {
          method: 'PATCH',
          headers: headers(),
          body: JSON.stringify({ status: 'resolved' })
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.message || 'Unable to update ticket.');
        const updated = body.data || { ...ticket, status: 'resolved' };
        const index = state.tickets.findIndex((item) => Number(item.id) === Number(ticket.id));
        if (index >= 0) state.tickets[index] = { ...state.tickets[index], ...updated };
        renderTicketRows();
        closeModal();
      } catch (error) {
        alert(error.message);
      }
    });

    overlay.querySelector('[data-action="close"]').addEventListener('click', closeModal);
    document.body.append(overlay);
  };

  const openCreateTicketModal = () => {
    const overlay = document.createElement('div');
    overlay.className = 'support-modal-backdrop';
    overlay.innerHTML = `
      <div class="support-modal form-modal">
        <button type="button" class="support-modal-close" data-close="true">×</button>
        <h2>Create New Ticket</h2>
        <form id="new-ticket-form">
          <label>
            <span>Subject</span>
            <input name="subject" type="text" required placeholder="Describe the issue" />
          </label>
          <label>
            <span>Priority</span>
            <select name="priority">
              <option value="high">High</option>
              <option value="medium" selected>Medium</option>
              <option value="low">Low</option>
            </select>
          </label>
          <label>
            <span>Message</span>
            <textarea name="description" rows="6" required placeholder="Provide details"></textarea>
          </label>
          <div class="support-modal-actions">
            <button type="submit" class="support-btn">Save Ticket</button>
            <button type="button" class="support-btn ghost" data-close="true">Cancel</button>
          </div>
        </form>
      </div>
    `;

    const closeModal = () => overlay.remove();
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay || event.target.dataset.close === 'true') closeModal();
    });

    overlay.querySelector('#new-ticket-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      const payload = {
        subject: formData.get('subject')?.toString().trim(),
        description: formData.get('description')?.toString().trim(),
        priority: formData.get('priority')?.toString() || 'medium'
      };

      if (!payload.subject || !payload.description) return;

      try {
        const currentUser = JSON.parse(localStorage.getItem('dormhive.user') ?? '{}');
        const response = await fetch(`${API}/support-tickets`, {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify({ ...payload, requesterId: currentUser.id || undefined })
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.message || 'Unable to create ticket.');
        await loadTickets();
        closeModal();
      } catch (error) {
        alert(error.message);
      }
    });

    applyAdminPrivacy(overlay);
    document.body.append(overlay);
  };

  const openFaqModal = async () => {
    const overlay = document.createElement('div');
    overlay.className = 'support-modal-backdrop';
    const faqModal = document.createElement('div');
    faqModal.className = 'support-modal faq-modal';
    faqModal.innerHTML = '<button type="button" class="support-modal-close" data-close="true">×</button><h2>FAQs</h2><div class="faq-list">Loading FAQs…</div>';
    overlay.append(faqModal);

    const closeModal = () => overlay.remove();
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay || event.target.dataset.close === 'true') closeModal();
    });

    try {
      const response = await fetch(`${API}/faqs`, { headers: headers() });
      const body = await response.json();
      if (!response.ok) {
        if (response.status === 404) {
          faqModal.querySelector('.faq-list').innerHTML = '<div class="empty-state compact">No FAQs are currently saved in the database.</div>';
        } else {
          throw new Error(body.message || 'Unable to load FAQs.');
        }
      } else if (!Array.isArray(body.data) || !body.data.length) {
        faqModal.querySelector('.faq-list').innerHTML = '<div class="empty-state compact">No FAQs are currently saved in the database.</div>';
      } else {
        faqModal.querySelector('.faq-list').innerHTML = body.data.map((item) => `
          <div class="faq-item">
            <h3>${escape(item.question || 'FAQ')}</h3>
            <p>${escape(item.answer || 'No answer available.')}</p>
          </div>
        `).join('');
      }
    } catch (error) {
      faqModal.querySelector('.faq-list').innerHTML = `<div class="empty-state compact">${escape(error.message || 'Unable to load FAQs.')}</div>`;
    }

    applyAdminPrivacy(overlay);
    document.body.append(overlay);
  };

  const exportTickets = () => {
    const filtered = getFilteredTickets();
    const rows = [
      ['Ticket ID', 'Status', 'User', 'Email', 'Priority', 'Subject', 'Date Opened', 'Assigned Admin']
    ];
    filtered.forEach((ticket) => {
      rows.push([
        ticket.id,
        statusMeta[normalizeStatus(ticket.status)]?.label || 'Open',
        ticket.requester_name || ticket.name || 'Unknown user',
        ticket.requester_email || ticket.email || '',
        priorityMeta[normalizePriority(ticket.priority)]?.label || 'Medium',
        ticket.subject || '',
        formatDate(ticket.created_at),
        ticket.assigned_admin_name || ticket.assignedAdminName || 'Unassigned'
      ]);
    });

    const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'support_tickets.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const loadTickets = async () => {
    try {
      const response = await apiGet('/support-tickets');
      state.tickets = Array.isArray(response.data) ? response.data : [];
      renderTicketRows();
    } catch (error) {
      listEl.innerHTML = `<div class="empty-state">${escape(error.message || 'Unable to load support tickets.')}</div>`;
    }
  };

  searchInput.addEventListener('input', (event) => {
    state.search = event.target.value;
    renderTicketRows();
  });

  statusCheckboxes.forEach((input) => {
    input.addEventListener('change', () => {
      const value = input.value;
      if (input.checked) {
        state.statuses.add(value);
      } else {
        state.statuses.delete(value);
      }
      renderTicketRows();
    });
  });

  priorityCheckboxes.forEach((input) => {
    input.addEventListener('change', () => {
      const value = input.value;
      if (input.checked) {
        state.priorities.add(value);
      } else {
        state.priorities.delete(value);
      }
      renderTicketRows();
    });
  });

  dateRangeFilter.addEventListener('change', (event) => {
    state.dateRange = event.target.value || 'all';
    renderTicketRows();
  });

  root.querySelector('#new-ticket-btn').addEventListener('click', openCreateTicketModal);
  root.querySelector('#faq-btn').addEventListener('click', openFaqModal);
  root.querySelector('#export-btn').addEventListener('click', exportTickets);

  loadTickets();
}



