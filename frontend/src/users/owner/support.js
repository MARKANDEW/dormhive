import { ensureOwnerSidebarStyles, loadOwnerStylesheet, renderOwnerSidebar } from './sidebarOwner.js';
import { showToast } from '../../components/toast.js';
import { withMediaAccessToken } from '../../services/mediaAccess.js';

const API = window.DORMHIVE_API_URL ?? 'http://localhost:5000/api/v1';
const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('dormhive.accessToken') ?? ''}` });

function css() {
  const stylesheet = new URL('./style/support.css', import.meta.url);
  stylesheet.searchParams.set('v', 'owner-support-workspace-1');
  return loadOwnerStylesheet('owner-support', stylesheet);
}

const faqs = [
  ['How do I submit a property listing?', 'Open My Listings, choose New Listing, complete the property details, and submit it for review.'],
  ['How do I update a property listing?', 'Open My Listings, select the property, choose Edit, update the details, and save your changes.'],
  ['How do I review a tenant inquiry?', 'Open Inquiries to view the tenant, property, message, and current inquiry status.'],
  ['How do I respond to an inquiry?', 'Select an inquiry, reply to the tenant, then approve or reject it when you have made a decision.'],
  ['How do I schedule a property viewing?', 'Open an inquiry, select Schedule Viewing, choose a date and time, and save it to notify the tenant.'],
];

const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
const attachmentHref = (value) => value ? withMediaAccessToken(`${API.replace(/\/api\/v1\/?$/, '')}${value}`) : '';
const renderTickets = (tickets) => tickets.length ? tickets.map((ticket) => `<article class="support-ticket-row" data-ticket-id="${escapeHtml(ticket.id)}" tabindex="0"><div><strong>${escapeHtml(ticket.subject)}</strong><small>${escapeHtml(ticket.description)}</small></div><span class="support-ticket-meta"><b class="support-ticket-status ${escapeHtml(ticket.status)}">${escapeHtml(ticket.status)}</b><span>${escapeHtml(ticket.priority)} priority</span><time>${ticket.created_at ? new Date(ticket.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'No date'}</time></span></article>`).join('') : '<p class="support-ticket-empty">You have not submitted any support tickets yet.</p>';
const renderMessages = (messages) => messages.filter((message) => !message.is_internal).map((message) => {
  const attachment = attachmentHref(message.attachment_url);
  const isImageAttachment = attachment && String(message.attachment_mime_type || '').startsWith('image/');
  const imagePreview = isImageAttachment
    ? `<img class="support-message-attachment-preview" src="${escapeHtml(attachment)}" alt="${escapeHtml(message.attachment_name || 'Ticket attachment')}" />`
    : '';
  const fileLink = attachment && !isImageAttachment
    ? `<a class="support-message-attachment" href="${escapeHtml(attachment)}" target="_blank" rel="noopener"><i class="bi bi-paperclip"></i> ${escapeHtml(message.attachment_name || 'Open attachment')}</a>`
    : '';
  const isMine = String(message.sender_role || '').toLowerCase() === 'owner';
  const messageDateTime = message.created_at ? new Date(message.created_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '';
  return `<div class="support-message-wrap${isMine ? ' support-message-wrap--self' : ''}"><article class="support-message" title="${escapeHtml(messageDateTime)}">${message.body ? `<p>${escapeHtml(message.body)}</p>` : ''}${imagePreview}${fileLink}</article></div>`;
}).join('') || '<p class="support-ticket-empty">No replies yet.</p>';
async function loadTickets(root) {
  const list = root.querySelector('[data-support-ticket-list]');
  if (!list) return;
  const workspace = root.querySelector('[data-support-ticket-workspace]');
  const conversation = root.querySelector('[data-support-conversation]');
  const currentPage = root.querySelector('[data-support-ticket-page]');
  const previousPage = root.querySelector('[data-support-ticket-previous]');
  const nextPage = root.querySelector('[data-support-ticket-next]');
  const pageSize = 7;
  let tickets = [];
  let page = 1;
  const renderConversationHeader = (ticket) => {
    const status = String(ticket?.status || 'open').toLowerCase();
    const priority = String(ticket?.priority || 'medium').toLowerCase();
    return `<header class="support-conversation-header"><button type="button" class="support-mobile-back" data-support-back aria-label="Back to tickets"><i class="bi bi-arrow-left"></i></button><div class="support-conversation-heading"><h3>${escapeHtml(ticket?.subject || 'Support request')}</h3><div class="support-conversation-badges"><span class="support-ticket-status ${escapeHtml(status)}">${escapeHtml(status)}</span><span class="support-conversation-priority">${escapeHtml(priority)} priority</span></div></div></header>`;
  };
  const renderPage = () => {
    const pageCount = Math.max(1, Math.ceil(tickets.length / pageSize));
    page = Math.min(page, pageCount);
    const start = (page - 1) * pageSize;
    list.innerHTML = renderTickets(tickets.slice(start, start + pageSize));
    currentPage.textContent = `${page} / ${pageCount}`;
    previousPage.disabled = page === 1;
    nextPage.disabled = page === pageCount;
  };
  try {
    const response = await fetch(`${API}/support-tickets`, { headers: headers() });
    const body = await response.json();
    if (!response.ok) throw new Error(body.message || 'Unable to load support tickets.');
    tickets = Array.isArray(body.data) ? body.data : [];
    renderPage();
    previousPage.addEventListener('click', () => { if (page > 1) { page -= 1; renderPage(); } });
    nextPage.addEventListener('click', () => { if (page < Math.ceil(tickets.length / pageSize)) { page += 1; renderPage(); } });
    list.onclick = async (event) => {
      const row = event.target.closest('[data-ticket-id]');
      if (!row || !conversation) return;
      const ticket = tickets.find((item) => String(item.id) === String(row.dataset.ticketId));
      const conversationHeader = renderConversationHeader(ticket);
      workspace.classList.add('is-conversation-open');
      conversation.innerHTML = `${conversationHeader}<p class="support-ticket-empty">Loading conversation...</p>`;
      const messagesResponse = await fetch(`${API}/support-tickets/${row.dataset.ticketId}/messages`, { headers: headers() });
      const messagesBody = await messagesResponse.json();
      conversation.innerHTML = messagesResponse.ok ? `${conversationHeader}<div class="support-message-list">${renderMessages(messagesBody.data || [])}</div><form class="support-reply-form" data-ticket-id="${escapeHtml(row.dataset.ticketId)}"><div class="support-reply-input-wrapper"><div class="support-reply-inline-input"><label class="support-attachment-picker" title="Send a photo" aria-label="Send a photo"><input type="file" name="attachment" accept="image/jpeg,image/png,image/gif,image/webp,application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"><span>＋</span></label><textarea name="body" rows="1" required placeholder="Write a reply..."></textarea></div></div><button type="submit" aria-label="Send reply"><i class="bi bi-send"></i></button></form>` : `${conversationHeader}<p class="support-ticket-empty">${escapeHtml(messagesBody.message || 'Unable to load conversation.')}</p>`;
      conversation.querySelector('[data-support-back]')?.addEventListener('click', () => workspace.classList.remove('is-conversation-open'));
      conversation.querySelectorAll('.support-message-attachment-preview').forEach((image) => {
        image.classList.add('is-avatar-previewable');
        image.tabIndex = 0;
        image.setAttribute('role', 'button');
        image.setAttribute('aria-label', `View ${image.alt} photo`);
        image.addEventListener('click', () => {
          const viewer = document.createElement('dialog');
          viewer.className = 'support-photo-viewer';
          const fullImage = document.createElement('img');
          fullImage.src = image.src;
          fullImage.alt = image.alt;
          viewer.addEventListener('click', () => viewer.close());
          viewer.addEventListener('close', () => viewer.remove(), { once: true });
          viewer.append(fullImage);
          document.body.append(viewer);
          viewer.showModal();
        });
      });
      const messageList = conversation.querySelector('.support-message-list');
      if (messageList) messageList.scrollTop = messageList.scrollHeight;
      const replyForm = conversation.querySelector('.support-reply-form');
      const replyTextarea = replyForm?.querySelector('textarea');
      const sendButton = replyForm?.querySelector('button[type="submit"]');
      replyTextarea?.addEventListener('input', () => {
        if (!replyTextarea.value) {
          replyTextarea.style.height = '32px';
          replyTextarea.style.overflowY = 'hidden';
          return;
        }
        replyTextarea.style.height = 'auto';
        replyTextarea.style.height = `${Math.min(replyTextarea.scrollHeight, 120)}px`;
        replyTextarea.style.overflowY = replyTextarea.scrollHeight > 120 ? 'auto' : 'hidden';
      });
      replyTextarea?.addEventListener('keydown', (keyEvent) => {
        if (keyEvent.key !== 'Enter' || keyEvent.shiftKey || keyEvent.isComposing) return;
        keyEvent.preventDefault();
        if (!sendButton?.disabled) replyForm.requestSubmit();
      });
      replyForm?.addEventListener('submit', async (replyEvent) => {
        replyEvent.preventDefault();
        if (sendButton?.disabled) return;
        if (sendButton) sendButton.disabled = true;
        const form = replyEvent.currentTarget;
        const formData = new FormData(form);
        const replyBody = new FormData();
        replyBody.append('body', String(formData.get('body') || ''));
        if (formData.get('attachment')?.size) replyBody.append('attachment', formData.get('attachment'));
        try {
          const replyResponse = await fetch(`${API}/support-tickets/${row.dataset.ticketId}/messages`, { method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('dormhive.accessToken') ?? ''}` }, body: replyBody });
          if (!replyResponse.ok) { const result = await replyResponse.json().catch(() => ({})); throw new Error(result.message || 'Unable to send reply.'); }
          row.click();
        } catch (error) {
          showToast({ message: error.message || 'Unable to send reply.', type: 'error' });
          if (sendButton?.isConnected) sendButton.disabled = false;
        }
      });
    };
  } catch (error) {
    list.innerHTML = `<p class="support-ticket-empty">${escapeHtml(error.message)}</p>`;
  }
}
export async function renderSupport(root = document.querySelector('#app')) {
  if (!root) throw new Error('Support requires #app.');
  await Promise.all([css(), ensureOwnerSidebarStyles()]);
  const faqMarkup = faqs.map(([question, answer], index) => `<div class="support-faq-item"><button type="button" class="support-faq-question" aria-expanded="false"><span>${question}</span><i class="bi bi-chevron-down"></i></button><p class="support-faq-answer" hidden>${answer}</p></div>`).join('');
  root.innerHTML = `<div class="owner-shell">${renderOwnerSidebar('support')}<main class="user-support-main"><header class="support-page-header"><div><span class="user-support-kicker"><i class="bi bi-headset"></i> Support</span><h1>Support</h1><p>Get help, find answers, or contact our support team.</p></div></header><section class="support-hero"><div><h2>We're here to help!</h2><p>Have a question, need assistance, or facing an issue? Our support team is ready to help you with anything related to your DormHive account.</p><button type="button" class="support-contact"><i class="bi bi-envelope"></i> Contact support</button></div><div class="support-illustration" aria-hidden="true"><span class="support-person-head"></span><span class="support-headset"></span><span class="support-laptop"></span><span class="support-chat-bubble">•••</span></div></section><section class="support-content-grid"><article class="support-faq-card"><header><h2>Frequently Asked Questions</h2><p>Find quick answers to common questions.</p></header><div class="support-faq-list">${faqMarkup}</div></article><aside class="support-contact-card"><header><h2>Need more help?</h2><p>If you can't find what you're looking for, reach out to our support team.</p></header><div class="support-contact-list"><a href="mailto:support@dormhive.com"><i class="bi bi-envelope"></i><span><strong>Email Support</strong><small>support@dormhive.com</small></span><i class="bi bi-chevron-right"></i></a><a href="mailto:support@dormhive.com?subject=Live%20chat"><i class="bi bi-chat-square-text"></i><span><strong>Live Chat</strong><small>Available 9AM - 6PM</small></span><i class="bi bi-chevron-right"></i></a><a href="tel:+639123456789"><i class="bi bi-telephone"></i><span><strong>Phone Support</strong><small>+63 912 345 6789</small></span><i class="bi bi-chevron-right"></i></a></div><div class="support-urgent"><i class="bi bi-lightbulb"></i><span>For urgent issues, please contact us via phone for faster assistance.</span></div></section><article class="user-ticket-form" hidden><div class="user-support-card-head"><div><h2>Create Support Ticket</h2><p>Tell us what you need help with.</p></div><button type="button" class="support-close" aria-label="Close form"><i class="bi bi-x-lg"></i></button></div><form><label>Subject<input name="subject" required placeholder="What do you need help with?" /></label><label>Priority<select name="priority"><option value="low">Low</option><option value="medium" selected>Medium</option><option value="high">High</option></select></label><label>Message<textarea name="description" rows="7" required placeholder="Describe the issue"></textarea></label><label>Attachment (optional)<input name="attachment" type="file" accept="image/jpeg,image/png,image/gif,image/webp,application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"></label><div><button type="button" class="support-cancel">Cancel</button><button type="submit" class="support-submit">Submit Ticket</button></div></form></article></main></div>`;
  root.querySelector('.owner-sidebar')?.remove();
  root.querySelector('.owner-mobile-menu')?.remove();
  root.querySelector('.owner-nav-backdrop')?.remove();
  root.querySelector('.owner-shell')?.classList.add('support-standalone');
  const formCard = root.querySelector('.user-ticket-form');
  const ticketForm = formCard?.querySelector('form');
  root.querySelector('.user-ticket-form')?.insertAdjacentHTML('beforebegin', '<section class="support-tickets-card"><header><h2>My Support Tickets</h2><p>View the support requests you have submitted.</p></header><div class="support-ticket-workspace" data-support-ticket-workspace><section class="support-ticket-list-panel" aria-label="My support tickets"><div data-support-ticket-list><p class="support-ticket-empty">Loading tickets...</p></div><footer class="support-ticket-pagination"><div><button type="button" data-support-ticket-previous disabled aria-label="Previous page">‹</button><span data-support-ticket-page>1 / 1</span><button type="button" data-support-ticket-next disabled aria-label="Next page">›</button></div></footer></section><section class="support-conversation" data-support-conversation><div class="support-conversation-empty"><i class="bi bi-chat-square-text"></i><strong>Select a ticket</strong><span>The conversation will appear here.</span></div></section></div></section>');
  const dashboardLink = document.createElement('a');
  dashboardLink.className = 'support-dashboard-link';
  dashboardLink.href = '#/owner/dashboardOwner';
  dashboardLink.textContent = 'Back to Dashboard';
  root.querySelector('.support-page-header').append(dashboardLink);
  const supportActions = [['Create Support Ticket', 'Open the support request form.'], ['Support Requests', 'Send an issue to the admin team.'], ['Ticket Status', 'Track your request in the support system.']];
  root.querySelectorAll('.support-contact-list a').forEach((link, index) => {
    const [title, description] = supportActions[index];
    link.href = '#support-ticket';
    link.querySelector('strong').textContent = title;
    link.querySelector('small').textContent = description;
    link.addEventListener('click', (event) => { event.preventDefault(); root.querySelector('.support-contact').click(); });
  });
  root.querySelectorAll('.support-faq-question').forEach((button) => button.addEventListener('click', () => { const answer = button.nextElementSibling; const expanded = button.getAttribute('aria-expanded') === 'true'; button.setAttribute('aria-expanded', String(!expanded)); answer.hidden = expanded; button.querySelector('i').classList.toggle('bi-chevron-up', !expanded); button.querySelector('i').classList.toggle('bi-chevron-down', expanded); }));
  root.querySelector('.support-contact').addEventListener('click', () => { formCard.hidden = false; formCard.scrollIntoView({ behavior: 'smooth', block: 'center' }); });
  root.querySelector('.support-close').addEventListener('click', () => { formCard.hidden = true; });
  root.querySelector('.support-cancel').addEventListener('click', () => { formCard.hidden = true; ticketForm?.reset(); });
  ticketForm?.addEventListener('submit', () => setTimeout(() => loadTickets(root), 500));
  loadTickets(root);
  ticketForm?.addEventListener('submit', async (event) => { event.preventDefault(); const form = event.currentTarget; try { const data = new FormData(form); const response = await fetch(`${API}/support-tickets`, { method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('dormhive.accessToken') ?? ''}` }, body: data }); const body = await response.json(); if (!response.ok) throw new Error(body.message || 'Unable to create support ticket.'); form.reset(); formCard.hidden = true; showToast({ message: 'Support ticket submitted successfully.', type: 'success' }); } catch (error) { showToast({ message: error.message, type: 'error' }); } });
}
