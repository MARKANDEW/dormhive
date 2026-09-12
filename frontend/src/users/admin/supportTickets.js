import { ensureAdminSidebarStyles, renderAdminSidebar } from './sidebarAdmin.js';
import { applyAdminPrivacy } from './privacy.js';

const API = window.DORMHIVE_API_URL ?? 'http://localhost:5000/api/v1';
const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('dormhive.accessToken') ?? ''}` });
const escape = (value = '') => { const node = document.createElement('span'); node.textContent = String(value ?? ''); return node.innerHTML; };
const normalizeStatus = (value) => ['pending', 'in-progress', 'in_progress'].includes(String(value).toLowerCase()) ? 'pending' : String(value || 'open').toLowerCase();
const normalizePriority = (value) => ['high', 'low', 'medium'].includes(String(value).toLowerCase()) ? String(value).toLowerCase() : 'medium';
const formatDate = (value) => value ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
const formatTime = (value) => value ? new Date(value).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '';
const attachmentHref = (value) => value ? `${API.replace(/\/api\/v1\/?$/, '')}${value}` : '';

function css() {
  if (document.querySelector('[data-admin-style="tickets"]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('./style/supportTickets.css', import.meta.url);
  link.dataset.adminStyle = 'tickets';
  document.head.append(link);
}

export function renderSupportTickets(root = document.querySelector('#app')) {
  if (!root) throw new Error('Support tickets requires #app.');
  css();
  ensureAdminSidebarStyles();
  root.innerHTML = `<div class="admin-shell">${renderAdminSidebar('supportTickets')}<div class="admin-main"><main class="support-page">
    <header class="support-header"><div><span class="support-kicker"><i class="bi bi-headset" aria-hidden="true"></i> Support</span><h1>Support</h1><p>Manage user requests, questions, and support tickets.</p></div></header>
    <section class="support-content">
      <section class="support-summary"><article class="support-summary-card support-blue"><i class="bi bi-ticket-perforated"></i><div><span>Open Tickets</span><strong data-summary="open">0</strong><small>Currently open</small></div></article><article class="support-summary-card support-orange"><i class="bi bi-clock"></i><div><span>Pending</span><strong data-summary="pending">0</strong><small>Waiting for response</small></div></article><article class="support-summary-card support-red"><i class="bi bi-exclamation-triangle"></i><div><span>High Priority</span><strong data-summary="high">0</strong><small>Needs attention</small></div></article><article class="support-summary-card support-green"><i class="bi bi-check-circle"></i><div><span>Resolved</span><strong data-summary="resolved">0</strong><small>Resolved tickets</small></div></article></section>
      <section class="support-filter-bar"><label class="support-search"><i class="bi bi-search"></i><input id="ticket-search" type="search" placeholder="Search tickets, users, or subjects..." /></label><select id="status-filter"><option value="all">All Statuses</option><option value="open">Open</option><option value="pending">Pending</option><option value="resolved">Resolved</option></select><select id="priority-filter"><option value="all">All Priorities</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select><select id="category-filter"><option value="all">All Categories</option></select><button type="button" class="reset-filters"><i class="bi bi-arrow-clockwise"></i> Reset</button></section>
      <div class="support-tabs" role="tablist"><button class="active" data-tab="all">All Tickets <strong data-count="all">0</strong></button><button data-tab="open">Open <strong data-count="open">0</strong></button><button data-tab="pending">Pending <strong data-count="pending">0</strong></button><button data-tab="resolved">Resolved <strong data-count="resolved">0</strong></button></div>
      <section class="support-workspace"><article class="ticket-table-card"><div class="ticket-table-head"><span><input type="checkbox" aria-label="Select all tickets" /></span><span>TICKET</span><span>USER</span><span>CATEGORY</span><span>PRIORITY</span><span>STATUS</span><span>LAST UPDATED</span><span>ACTIONS</span></div><div id="ticket-list" class="ticket-list"></div><footer class="ticket-footer"><span data-ticket-range>Showing 0–0 of 0 tickets</span><div><button disabled aria-label="Previous page">‹</button><button class="current-page">1</button><button disabled aria-label="Next page">›</button></div></footer></article><aside class="ticket-details" id="ticket-details"></aside></section>
    </section>
  </main></div></div>`;
  root.querySelector('.ticket-footer')?.remove();

  const state = { tickets: [], tab: 'all', search: '', status: 'all', priority: 'all', category: 'all', selected: null, internalNotes: {} };
  try { const saved = localStorage.getItem('dormhive.supportTickets.internalNotes'); if (saved) state.internalNotes = JSON.parse(saved); } catch (e) { /* ignore */ }
  const saveInternalNotes = () => localStorage.setItem('dormhive.supportTickets.internalNotes', JSON.stringify(state.internalNotes));
  const list = root.querySelector('#ticket-list');
  const details = root.querySelector('#ticket-details');
  const search = root.querySelector('#ticket-search');
  const statusFilter = root.querySelector('#status-filter');
  const priorityFilter = root.querySelector('#priority-filter');
  const categoryFilter = root.querySelector('#category-filter');

  const filteredTickets = () => state.tickets.filter((ticket) => {
    const status = normalizeStatus(ticket.status);
    const priority = normalizePriority(ticket.priority);
    const query = `${ticket.id} ${ticket.subject || ''} ${ticket.requester_name || ''} ${ticket.requester_email || ''}`.toLowerCase();
    return (state.tab === 'all' || status === state.tab) && (state.status === 'all' || status === state.status) && (state.priority === 'all' || priority === state.priority) && (state.category === 'all' || String(ticket.category || 'Support') === state.category) && (!state.search || query.includes(state.search));
  });

  const renderSummary = () => {
    const counts = state.tickets.reduce((result, ticket) => { const status = normalizeStatus(ticket.status); const priority = normalizePriority(ticket.priority); result[status] = (result[status] || 0) + 1; if (priority === 'high') result.high += 1; return result; }, { open: 0, pending: 0, resolved: 0, high: 0 });
    root.querySelectorAll('[data-summary]').forEach((item) => { item.textContent = counts[item.dataset.summary] ?? 0; });
    root.querySelectorAll('[data-count]').forEach((item) => { item.textContent = item.dataset.count === 'all' ? state.tickets.length : counts[item.dataset.count] ?? 0; });
  };

  const renderConversation = (ticket) => {
    const user = ticket.requester_name || ticket.name || 'Unknown user';
    const messages = Array.isArray(ticket.messages) ? ticket.messages : [];
    const initialMessage = ticket.description || ticket.message;
    const cards = initialMessage ? [`<div class="message-card user-message"><i class="bi bi-person-circle"></i><div><strong>${escape(user)}</strong><time>${formatDate(ticket.created_at)} ${formatTime(ticket.created_at)}</time><p>${escape(initialMessage)}</p></div></div>`] : [];
    messages.forEach((message) => {
      const internalClass = Number(message.is_internal) ? ' internal-message' : '';
      const attachment = message.attachment_url ? `<a class="message-attachment" href="${escape(attachmentHref(message.attachment_url))}" target="_blank" rel="noopener"><i class="bi bi-paperclip"></i> ${escape(message.attachment_name || 'Open attachment')}</a>` : '';
      cards.push(`<div class="message-card${internalClass}"><i class="bi ${Number(message.is_internal) ? 'bi-lock' : 'bi-person-circle'}"></i><div><strong>${escape(message.sender_name || 'Support')}</strong><time>${formatDate(message.created_at)} ${formatTime(message.created_at)}</time><p>${escape(message.body)}</p>${attachment}</div></div>`);
    });
    return cards.length ? cards.join('') : '<p class="conversation-empty">No messages yet.</p>';
  };

  const loadMessages = async (ticket) => {
    try {
      const response = await fetch(`${API}/support-tickets/${encodeURIComponent(ticket.id)}/messages`, { headers: headers() });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || 'Unable to load conversation.');
      ticket.messages = Array.isArray(body.data) ? body.data : [];
      if (state.selected?.id === ticket.id) {
        const conversation = details.querySelector('.conversation');
        if (conversation) conversation.innerHTML = `<h3>Conversation</h3>${renderConversation(ticket)}`;
        applyAdminPrivacy(details);
      }
    } catch (error) {
      const conversation = details.querySelector('.conversation');
      if (conversation && state.selected?.id === ticket.id) conversation.innerHTML = `<h3>Conversation</h3><p class="conversation-empty">${escape(error.message)}</p>`;
    }
  };

  const sendReply = async (ticket) => {
    const textarea = details.querySelector('.reply-area textarea');
    const internal = details.querySelector('.reply-area input[type="checkbox"]')?.checked === true;
    const body = String(textarea?.value ?? '').trim();
    const fileInput = details.querySelector('.ticket-file-input');
    const attachment = fileInput?.files?.[0];
    if (!body && !attachment) return;
    const messageBody = body || '[Attachment]';
    const sendButton = details.querySelector('.send-reply');
    if (sendButton) sendButton.disabled = true;
    try {
      const formData = new FormData();
      formData.set('body', messageBody);
      formData.append('isInternal', String(internal));
      if (attachment) formData.append('attachment', attachment);
      const response = await fetch(`${API}/support-tickets/${encodeURIComponent(ticket.id)}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('dormhive.accessToken') ?? ''}` },
        body: formData
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Unable to send message.');
      ticket.messages = [...(ticket.messages || []), result.data];
      textarea.value = '';
      if (fileInput) fileInput.value = '';
      if (details.querySelector('.reply-area input[type="checkbox"]')) details.querySelector('.reply-area input[type="checkbox"]').checked = false;
      const conversation = details.querySelector('.conversation');
      if (conversation) conversation.innerHTML = `<h3>Conversation</h3>${renderConversation(ticket)}`;
      applyAdminPrivacy(details);
    } catch (error) {
      window.alert(error.message);
    } finally {
      if (sendButton) sendButton.disabled = false;
    }
  };

  const renderDetails = (ticket) => {
    if (!ticket) { details.innerHTML = '<div class="ticket-detail-empty"><i class="bi bi-headset"></i><strong>Select a ticket</strong><span>Ticket details and conversation will appear here.</span></div>'; return; }
    const status = normalizeStatus(ticket.status);
    const priority = normalizePriority(ticket.priority);
    const user = ticket.requester_name || ticket.name || 'Unknown user';
    const email = ticket.requester_email || ticket.email || 'No email provided';
    details.innerHTML = `<div class="ticket-detail-header"><div><h2>Ticket #${escape(ticket.id)}</h2><div class="ticket-badges"><span class="ticket-status ${status}">${status[0].toUpperCase() + status.slice(1)}</span><span class="ticket-priority ${priority}">${priority[0].toUpperCase() + priority.slice(1)}</span></div></div><div class="ticket-actions"><button>Assign</button><button data-status="pending">Mark Pending</button><button class="resolve-ticket" data-status="resolved">Resolve Ticket</button></div></div><div class="ticket-info-grid"><div><i class="bi bi-pencil"></i><small>SUBJECT</small><strong>${escape(ticket.subject || 'Support request')}</strong></div><div><i class="bi bi-person"></i><small>USER</small><strong>${escape(user)}</strong><span>${escape(email)}</span></div><div><i class="bi bi-folder"></i><small>CATEGORY</small><strong>${escape(ticket.category || 'Support')}</strong></div><div><i class="bi bi-calendar3"></i><small>CREATED</small><strong>${formatDate(ticket.created_at)}</strong></div></div><div class="conversation"><h3>Conversation</h3>${renderConversation(ticket)}</div><div class="reply-area"><textarea placeholder="Write a reply..."></textarea><div><button type="button" class="attach-file"><i class="bi bi-paperclip"></i> Attach</button><input class="ticket-file-input" type="file" hidden /><label><input type="checkbox" /> Internal note</label><button type="button" class="send-reply"><i class="bi bi-send"></i> Send</button></div><small class="attachment-name"></small></div>`;
    const internalNoteCheckbox = details.querySelector('.reply-area input[type="checkbox"]');
    internalNoteCheckbox.checked = state.internalNotes[String(ticket.id)] === true;
    internalNoteCheckbox.addEventListener('change', () => { state.internalNotes[String(ticket.id)] = internalNoteCheckbox.checked; saveInternalNotes(); });
    details.querySelector('.ticket-actions button:first-child')?.addEventListener('click', () => assignTicket(ticket));
    details.querySelector('.resolve-ticket')?.addEventListener('click', () => updateStatus(ticket, 'resolved'));
    details.querySelector('[data-status="pending"]')?.addEventListener('click', () => updateStatus(ticket, 'pending'));
    details.querySelector('.send-reply')?.addEventListener('click', () => sendReply(ticket));
    const fileInput = details.querySelector('.ticket-file-input');
    details.querySelector('.attach-file')?.addEventListener('click', () => fileInput?.click());
    fileInput?.addEventListener('change', () => {
      details.querySelector('.attachment-name').textContent = fileInput.files?.[0]?.name || '';
      textarea?.focus();
    });
    applyAdminPrivacy(details);
    loadMessages(ticket);
  };

  const renderList = () => {
    const tickets = filteredTickets();
    list.innerHTML = tickets.length ? tickets.map((ticket) => { const status = normalizeStatus(ticket.status); const priority = normalizePriority(ticket.priority); return `<div class="ticket-row ${state.selected?.id === ticket.id ? 'selected' : ''}" data-id="${ticket.id}"><input type="checkbox" aria-label="Select ticket ${ticket.id}" /><strong>#${ticket.id}</strong><span>${escape(ticket.requester_name || 'Unknown user')}</span><span>${escape(ticket.category || 'Support')}</span><span class="ticket-priority ${priority}">${priority[0].toUpperCase() + priority.slice(1)}</span><span class="ticket-status ${status}">${status[0].toUpperCase() + status.slice(1)}</span><span>${formatDate(ticket.updated_at || ticket.created_at)}</span><button class="ticket-view" aria-label="View ticket"><i class="bi bi-eye"></i></button></div>`; }).join('') : '<div class="support-empty-state"><span><i class="bi bi-headset"></i></span><strong>No support tickets yet</strong><p>User support requests will appear here when they are submitted.</p></div>';
    list.querySelectorAll('.ticket-row').forEach((row) => row.addEventListener('click', (event) => { if (event.target.closest('input, button')) return; state.selected = state.tickets.find((ticket) => Number(ticket.id) === Number(row.dataset.id)); renderList(); renderDetails(state.selected); }));
    list.querySelectorAll('.ticket-view').forEach((button) => button.addEventListener('click', (event) => { const row = event.currentTarget.closest('.ticket-row'); state.selected = state.tickets.find((ticket) => Number(ticket.id) === Number(row.dataset.id)); renderList(); renderDetails(state.selected); }));
    applyAdminPrivacy(root);
  };

  const updateStatus = async (ticket, status) => {
    try {
      const response = await fetch(`${API}/support-tickets/${encodeURIComponent(ticket.id)}`, { method: 'PATCH', headers: headers(), body: JSON.stringify({ status }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || 'Unable to update ticket.');
      ticket.status = status;
      renderSummary(); renderList(); renderDetails(ticket);
    } catch (error) { window.alert(error.message); }
  };

  const loadTickets = async () => {
    try {
      const response = await fetch(`${API}/support-tickets`, { headers: headers() });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || 'Unable to load support tickets.');
      state.tickets = Array.isArray(body.data) ? body.data : [];
      const categories = [...new Set(state.tickets.map((ticket) => ticket.category || 'Support'))].sort();
      categoryFilter.innerHTML = '<option value="all">All Categories</option>' + categories.map((category) => `<option value="${escape(category)}">${escape(category)}</option>`).join('');
      renderSummary(); renderList(); renderDetails(state.tickets[0] || null);
    } catch (error) { list.innerHTML = `<div class="support-empty-state"><strong>${escape(error.message)}</strong></div>`; renderDetails(null); }
  };

  const assignTicket = async (ticket) => {
    try {
      const currentUser = JSON.parse(localStorage.getItem('dormhive.user') ?? '{}');
      if (!currentUser.id) throw new Error('No admin session is available.');
      const response = await fetch(`${API}/support-tickets/${encodeURIComponent(ticket.id)}`, { method: 'PATCH', headers: headers(), body: JSON.stringify({ assignedAdminId: currentUser.id }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || 'Unable to assign ticket.');
      Object.assign(ticket, body.data || {}, { assigned_admin_name: currentUser.name || currentUser.email || 'Assigned admin' });
      renderDetails(ticket);
    } catch (error) { window.alert(error.message); }
  };

  search.addEventListener('input', () => { state.search = search.value.toLowerCase().trim(); renderList(); });
  statusFilter.addEventListener('change', () => { state.status = statusFilter.value; renderList(); });
  priorityFilter.addEventListener('change', () => { state.priority = priorityFilter.value; renderList(); });
  categoryFilter.addEventListener('change', () => { state.category = categoryFilter.value; renderList(); });
  root.querySelector('.reset-filters').addEventListener('click', () => { search.value = ''; statusFilter.value = 'all'; priorityFilter.value = 'all'; categoryFilter.value = 'all'; state.search = ''; state.status = 'all'; state.priority = 'all'; state.category = 'all'; state.tab = 'all'; root.querySelectorAll('.support-tabs button').forEach((button) => button.classList.toggle('active', button.dataset.tab === 'all')); renderList(); });
  root.querySelectorAll('.support-tabs button').forEach((button) => button.addEventListener('click', () => { state.tab = button.dataset.tab; root.querySelectorAll('.support-tabs button').forEach((item) => item.classList.toggle('active', item === button)); renderList(); }));
  loadTickets();
}