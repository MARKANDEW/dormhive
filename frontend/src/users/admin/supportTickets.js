import { ensureAdminSidebarStyles, loadAdminStylesheet, renderAdminDateMeta, renderAdminSidebar } from './sidebarAdmin.js';
import { applyAdminPrivacy } from './privacy.js';
import { withMediaAccessToken } from '../../services/mediaAccess.js';

const API = window.DORMHIVE_API_URL ?? 'http://localhost:5000/api/v1';
const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('dormhive.accessToken') ?? ''}` });
const escape = (value = '') => { const node = document.createElement('span'); node.textContent = String(value ?? ''); return node.innerHTML; };
const normalizeStatus = (value) => ['pending', 'in-progress', 'in_progress'].includes(String(value).toLowerCase()) ? 'pending' : String(value || 'open').toLowerCase();
const normalizePriority = (value) => ['high', 'low', 'medium'].includes(String(value).toLowerCase()) ? String(value).toLowerCase() : 'medium';
const formatDate = (value) => value ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
const formatTime = (value) => value ? new Date(value).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '';
const attachmentHref = (value) => value ? withMediaAccessToken(`${API.replace(/\/api\/v1\/?$/, '')}${value}`) : '';

function css() {
  return loadAdminStylesheet('tickets', new URL('./style/supportTickets.css', import.meta.url));
}

export async function renderSupportTickets(root = document.querySelector('#app')) {
  if (!root) throw new Error('Support tickets requires #app.');
  await Promise.all([css(), ensureAdminSidebarStyles()]);
  root.innerHTML = `<div class="admin-shell">${renderAdminSidebar('supportTickets')}<div class="admin-main"><main class="support-page">
    <header class="support-header"><div class="support-heading"><div class="support-kicker-row"><span class="support-kicker">Support</span></div><h1>Support</h1><p>Manage user requests, questions, and support tickets.</p></div>${renderAdminDateMeta()}</header>
    <section class="support-content">
      <section class="support-summary"><article class="support-summary-card support-blue"><i class="bi bi-ticket-perforated"></i><div><span>Open Tickets</span><strong data-summary="open">0</strong><small>Currently open</small></div></article><article class="support-summary-card support-orange"><i class="bi bi-clock"></i><div><span>Pending</span><strong data-summary="pending">0</strong><small>Waiting for response</small></div></article><article class="support-summary-card support-red"><i class="bi bi-exclamation-triangle"></i><div><span>High Priority</span><strong data-summary="high">0</strong><small>Needs attention</small></div></article><article class="support-summary-card support-green"><i class="bi bi-check-circle"></i><div><span>Resolved</span><strong data-summary="resolved">0</strong><small>Resolved tickets</small></div></article></section>
      <section class="support-filter-bar"><label class="support-search"><i class="bi bi-search"></i><input id="ticket-search" type="search" placeholder="Search tickets, users, or subjects..." /></label><select id="status-filter"><option value="all">All Statuses</option><option value="open">Open</option><option value="pending">Pending</option><option value="resolved">Resolved</option></select><select id="priority-filter"><option value="all">All Priorities</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select><select id="requester-filter"><option value="all">All Users</option><option value="tenant">Tenants</option><option value="owner">Owners</option></select><button type="button" class="reset-filters"><i class="bi bi-arrow-clockwise"></i> Reset</button></section>
      <div class="support-tabs" role="tablist"><button class="active" data-tab="all">All Tickets <strong data-count="all">0</strong></button><button data-tab="open">Open <strong data-count="open">0</strong></button><button data-tab="pending">Pending <strong data-count="pending">0</strong></button><button data-tab="resolved">Resolved <strong data-count="resolved">0</strong></button></div>
      <section class="support-workspace"><article class="ticket-table-card"><div class="ticket-table-head"><span>TICKET</span><span>USER</span><span>CATEGORY</span><span>PRIORITY</span><span>STATUS</span><span>LAST UPDATED</span></div><div id="ticket-list" class="ticket-list"></div><footer class="ticket-footer"><span data-ticket-range aria-live="polite">Showing 0–0 of 0 tickets</span><div><button type="button" data-page-previous disabled aria-label="Previous page">‹</button><span class="current-page" data-page-current aria-live="polite">1 / 1</span><button type="button" data-page-next disabled aria-label="Next page">›</button></div></footer></article><aside class="ticket-details" id="ticket-details"></aside></section>
    </section>
  </main></div></div>`;
  const mobileMenu = root.querySelector('.admin-mobile-menu');
  const supportKickerRow = root.querySelector('.support-kicker-row');
  if (mobileMenu && supportKickerRow) supportKickerRow.prepend(mobileMenu);

  const state = { tickets: [], tab: 'all', search: '', status: 'all', priority: 'all', requesterRole: 'all', selected: null, page: 1, internalNotes: {} };
  const pageSize = 7;
  try { const saved = localStorage.getItem('dormhive.supportTickets.internalNotes'); if (saved) state.internalNotes = JSON.parse(saved); } catch (e) { /* ignore */ }
  const saveInternalNotes = () => localStorage.setItem('dormhive.supportTickets.internalNotes', JSON.stringify(state.internalNotes));
  const list = root.querySelector('#ticket-list');
  const ticketRange = root.querySelector('[data-ticket-range]');
  const pageCurrent = root.querySelector('[data-page-current]');
  const previousPage = root.querySelector('[data-page-previous]');
  const nextPage = root.querySelector('[data-page-next]');
  const details = root.querySelector('#ticket-details');
  const search = root.querySelector('#ticket-search');
  const statusFilter = root.querySelector('#status-filter');
  const priorityFilter = root.querySelector('#priority-filter');
  const requesterFilter = root.querySelector('#requester-filter');

  const filteredTickets = () => state.tickets.filter((ticket) => {
    const status = normalizeStatus(ticket.status);
    const priority = normalizePriority(ticket.priority);
    const requesterRole = String(ticket.requester_role || '').toLowerCase();
    const query = `${ticket.id} ${ticket.subject || ''} ${ticket.requester_name || ''} ${ticket.requester_email || ''}`.toLowerCase();
    return (state.tab === 'all' || status === state.tab) && (state.status === 'all' || status === state.status) && (state.priority === 'all' || priority === state.priority) && (state.requesterRole === 'all' || requesterRole === state.requesterRole) && (!state.search || query.includes(state.search));
  });

  const renderSummary = () => {
    const counts = state.tickets.reduce((result, ticket) => { const status = normalizeStatus(ticket.status); const priority = normalizePriority(ticket.priority); result[status] = (result[status] || 0) + 1; if (priority === 'high') result.high += 1; return result; }, { open: 0, pending: 0, resolved: 0, high: 0 });
    root.querySelectorAll('[data-summary]').forEach((item) => { item.textContent = counts[item.dataset.summary] ?? 0; });
    root.querySelectorAll('[data-count]').forEach((item) => { item.textContent = item.dataset.count === 'all' ? state.tickets.length : counts[item.dataset.count] ?? 0; });
  };

  const renderConversation = (ticket) => {
    const user = ticket.requester_name || ticket.name || 'Unknown user';
    let currentUserId = null;
    try { currentUserId = Number(JSON.parse(localStorage.getItem('dormhive.user') ?? '{}').id) || null; } catch { /* ignore invalid session data */ }
    const messages = Array.isArray(ticket.messages) ? ticket.messages : [];
    const initialMessage = ticket.description || ticket.message;
    const authorKey = (id, role, name) => id !== null && id !== undefined && id !== ''
      ? `id:${id}`
      : `${String(role || '').toLowerCase()}:${String(name || '').trim().toLowerCase()}`;
    const initialDateTime = `${formatDate(ticket.created_at)} ${formatTime(ticket.created_at)}`;
    const initialAuthor = authorKey(ticket.requester_id ?? ticket.user_id, ticket.requester_role, user);
    const items = initialMessage ? [{
      author: initialAuthor,
      classes: ' user-message',
      icon: 'bi-person-circle',
      dateTime: initialDateTime,
      body: initialMessage,
      attachmentPreview: '',
      attachment: ''
    }] : [];
    messages.forEach((message) => {
      const internalClass = Number(message.is_internal) ? ' internal-message' : '';
      const senderRole = String(message.sender_role || '').toLowerCase();
      const senderName = String(message.sender_name || '').trim().toLowerCase();
      const isAdminMessage = senderRole === 'admin' || (!senderRole && senderName === 'admin');
      const ownMessageClass = isAdminMessage || (currentUserId && Number(message.sender_id) === currentUserId) ? ' own-message' : '';
      const messageDateTime = `${formatDate(message.created_at)} ${formatTime(message.created_at)}`;
      const attachmentUrl = attachmentHref(message.attachment_url);
      const isImageAttachment = attachmentUrl && String(message.attachment_mime_type || '').startsWith('image/');
      const attachmentPreview = isImageAttachment
        ? `<img class="message-attachment-preview" src="${escape(attachmentUrl)}" alt="${escape(message.attachment_name || 'Ticket attachment')}" />`
        : '';
      const attachment = attachmentUrl && !isImageAttachment ? `<a class="message-attachment" href="${escape(attachmentUrl)}" target="_blank" rel="noopener"><i class="bi bi-paperclip"></i> ${escape(message.attachment_name || 'Open attachment')}</a>` : '';
      items.push({
        author: authorKey(message.sender_id, senderRole, senderName),
        classes: `${internalClass}${ownMessageClass}`,
        icon: Number(message.is_internal) ? 'bi-lock' : 'bi-person-circle',
        dateTime: messageDateTime,
        body: message.body,
        attachmentPreview,
        attachment
      });
    });
    if (!items.length) return '<p class="conversation-empty">No messages yet.</p>';
    return items.map((item, index) => {
      const previousSameAuthor = index > 0 && items[index - 1].author === item.author;
      const nextSameAuthor = index + 1 < items.length && items[index + 1].author === item.author;
      const continuationClass = previousSameAuthor ? ' continuation-message' : '';
      const avatar = nextSameAuthor
        ? '<i class="message-avatar-spacer" aria-hidden="true"></i>'
        : `<i class="bi ${item.icon}"></i>`;
      return `<div class="message-card${item.classes}${continuationClass}">${avatar}<div title="${escape(item.dateTime)}"><p>${escape(item.body)}</p>${item.attachmentPreview}${item.attachment}</div></div>`;
    }).join('');
  };

  const loadMessages = async (ticket) => {
    try {
      const response = await fetch(`${API}/support-tickets/${encodeURIComponent(ticket.id)}/messages`, { headers: headers() });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || 'Unable to load conversation.');
      ticket.messages = Array.isArray(body.data) ? body.data : [];
      if (state.selected?.id === ticket.id) {
        const conversation = details.querySelector('.conversation-messages');
        if (conversation) {
          conversation.innerHTML = renderConversation(ticket);
          conversation.scrollTop = conversation.scrollHeight;
        }
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
    const sendButton = details.querySelector('.send-reply');
    if (sendButton?.disabled || (!body && !attachment)) return;
    const messageBody = body || '[Attachment]';
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
      const conversation = details.querySelector('.conversation-messages');
      if (conversation) {
        conversation.innerHTML = renderConversation(ticket);
        conversation.scrollTop = conversation.scrollHeight;
      }
      applyAdminPrivacy(details);
    } catch (error) {
      window.alert(error.message);
    } finally {
      if (sendButton) sendButton.disabled = false;
    }
  };

  const renderDetails = (ticket) => {
    if (!ticket) { details.classList.add('is-empty'); details.innerHTML = '<div class="ticket-detail-empty"><i class="bi bi-headset"></i><strong>Select a ticket</strong><span>Ticket details and conversation will appear here.</span></div>'; return; }
    details.classList.remove('is-empty');
    const status = normalizeStatus(ticket.status);
    const priority = normalizePriority(ticket.priority);
    const user = ticket.requester_name || ticket.name || 'Unknown user';
    const email = ticket.requester_email || ticket.email || 'No email provided';
    details.innerHTML = `<div class="ticket-detail-header"><div><h2>Ticket #${escape(ticket.id)}</h2><div class="ticket-badges"><span class="ticket-status ${status}">${status[0].toUpperCase() + status.slice(1)}</span><span class="ticket-priority ${priority}">${priority[0].toUpperCase() + priority.slice(1)}</span></div></div><div class="ticket-actions"><button>Assign</button><button data-status="pending">Mark Pending</button><button class="resolve-ticket" data-status="resolved">Resolve Ticket</button></div></div><div class="ticket-info-grid"><div><i class="bi bi-pencil"></i><small>SUBJECT</small><strong>${escape(ticket.subject || 'Support request')}</strong></div><div><i class="bi bi-person"></i><small>USER</small><strong>${escape(user)}</strong><span>${escape(email)}</span></div><div><i class="bi bi-folder"></i><small>CATEGORY</small><strong>${escape(ticket.category || 'Support')}</strong></div><div><i class="bi bi-calendar3"></i><small>CREATED</small><strong>${formatDate(ticket.created_at)}</strong></div></div><div class="conversation"><h3>Conversation</h3><div class="conversation-messages">${renderConversation(ticket)}</div></div>    <div class="reply-area"><textarea placeholder="Write a reply..."></textarea><div><button type="button" class="attach-file"><i class="bi bi-paperclip"></i> Attach</button><input class="ticket-file-input" type="file" accept="image/jpeg,image/png,image/gif,image/webp,application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" hidden /><label><input type="checkbox" /> Internal note</label><button type="button" class="send-reply"><i class="bi bi-send"></i> Send</button></div><small class="attachment-name"></small></div>`;
    const internalNoteCheckbox = details.querySelector('.reply-area input[type="checkbox"]');
    const replyTextarea = details.querySelector('.reply-area textarea');
    internalNoteCheckbox.checked = state.internalNotes[String(ticket.id)] === true;
    internalNoteCheckbox.addEventListener('change', () => { state.internalNotes[String(ticket.id)] = internalNoteCheckbox.checked; saveInternalNotes(); });
    details.querySelector('.ticket-actions button:first-child')?.addEventListener('click', () => assignTicket(ticket));
    details.querySelector('.resolve-ticket')?.addEventListener('click', () => updateStatus(ticket, 'resolved'));
    details.querySelector('[data-status="pending"]')?.addEventListener('click', () => updateStatus(ticket, 'pending'));
    details.querySelector('.send-reply')?.addEventListener('click', () => sendReply(ticket));
    replyTextarea?.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
      event.preventDefault();
      sendReply(ticket);
    });
    const fileInput = details.querySelector('.ticket-file-input');
    details.querySelector('.attach-file')?.addEventListener('click', () => fileInput?.click());
    fileInput?.addEventListener('change', () => {
      details.querySelector('.attachment-name').textContent = fileInput.files?.[0]?.name || '';
      replyTextarea?.focus();
    });
    applyAdminPrivacy(details);
    loadMessages(ticket);
  };

  const renderList = () => {
    const tickets = filteredTickets();
    const pageCount = Math.max(1, Math.ceil(tickets.length / pageSize));
    state.page = Math.min(state.page, pageCount);
    const start = (state.page - 1) * pageSize;
    const pageTickets = tickets.slice(start, start + pageSize);
    list.innerHTML = pageTickets.length ? pageTickets.map((ticket) => { const status = normalizeStatus(ticket.status); const priority = normalizePriority(ticket.priority); const selected = state.selected?.id === ticket.id; return `<div class="ticket-row ${selected ? 'selected' : ''}" data-id="${ticket.id}" role="button" tabindex="0" aria-pressed="${selected}" aria-label="View ticket #${ticket.id} for ${escape(ticket.requester_name || 'Unknown user')}"><strong>#${ticket.id}</strong><span>${escape(ticket.requester_name || 'Unknown user')}</span><span>${escape(ticket.category || 'Support')}</span><span class="ticket-priority ${priority}">${priority[0].toUpperCase() + priority.slice(1)}</span><span class="ticket-status ${status}">${status[0].toUpperCase() + status.slice(1)}</span><span>${formatDate(ticket.updated_at || ticket.created_at)}</span></div>`; }).join('') : '<div class="support-empty-state"><span><i class="bi bi-headset"></i></span><strong>No support tickets yet</strong><p>User support requests will appear here when they are submitted.</p></div>';
    ticketRange.textContent = tickets.length ? `Showing ${start + 1}–${Math.min(start + pageSize, tickets.length)} of ${tickets.length} tickets` : 'Showing 0–0 of 0 tickets';
    pageCurrent.textContent = `${state.page} / ${pageCount}`;
    previousPage.disabled = state.page === 1;
    nextPage.disabled = state.page === pageCount;
    const selectTicket = (row) => {
      state.selected = state.tickets.find((ticket) => Number(ticket.id) === Number(row.dataset.id));
      renderList();
      renderDetails(state.selected);
    };
    list.querySelectorAll('.ticket-row').forEach((row) => {
      row.addEventListener('click', () => selectTicket(row));
      row.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          selectTicket(row);
        }
      });
    });
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

  search.addEventListener('input', () => { state.search = search.value.toLowerCase().trim(); state.page = 1; renderList(); });
  statusFilter.addEventListener('change', () => { state.status = statusFilter.value; state.page = 1; renderList(); });
  priorityFilter.addEventListener('change', () => { state.priority = priorityFilter.value; state.page = 1; renderList(); });
  requesterFilter.addEventListener('change', () => { state.requesterRole = requesterFilter.value; state.page = 1; renderList(); });
  root.querySelector('.reset-filters').addEventListener('click', () => { search.value = ''; statusFilter.value = 'all'; priorityFilter.value = 'all'; requesterFilter.value = 'all'; state.search = ''; state.status = 'all'; state.priority = 'all'; state.requesterRole = 'all'; state.tab = 'all'; state.page = 1; root.querySelectorAll('.support-tabs button').forEach((button) => button.classList.toggle('active', button.dataset.tab === 'all')); renderList(); });
  root.querySelectorAll('.support-tabs button').forEach((button) => button.addEventListener('click', () => { state.tab = button.dataset.tab; state.page = 1; root.querySelectorAll('.support-tabs button').forEach((item) => item.classList.toggle('active', item === button)); renderList(); }));
  previousPage.addEventListener('click', () => { if (state.page > 1) { state.page -= 1; renderList(); } });
  nextPage.addEventListener('click', () => { const pageCount = Math.max(1, Math.ceil(filteredTickets().length / pageSize)); if (state.page < pageCount) { state.page += 1; renderList(); } });
  loadTickets();
}