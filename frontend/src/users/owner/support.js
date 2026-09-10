import { ensureOwnerSidebarStyles, renderOwnerSidebar } from './sidebarOwner.js';
import { showToast } from '../../components/toast.js';

const API = window.DORMHIVE_API_URL ?? 'http://localhost:5000/api/v1';
const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('dormhive.accessToken') ?? ''}` });

function css() {
  const existing = document.querySelector('[data-user-style="owner-support"]');
  if (existing) return existing.sheet ? Promise.resolve() : new Promise((resolve) => existing.addEventListener('load', resolve, { once: true }));
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('./style/support.css', import.meta.url);
  link.dataset.userStyle = 'owner-support';
  document.head.append(link);
  return new Promise((resolve) => link.addEventListener('load', resolve, { once: true }));
}

const faqs = [
  ['How do I submit a property listing?', 'Open My Listings, choose New Listing, complete the property details, and submit it for review.'],
  ['How do I update a property listing?', 'Open My Listings, select the property, choose Edit, update the details, and save your changes.'],
  ['How do I review a tenant inquiry?', 'Open Inquiries to view the tenant, property, message, and current inquiry status.'],
  ['How do I respond to an inquiry?', 'Select an inquiry, reply to the tenant, then approve or reject it when you have made a decision.'],
  ['How do I schedule a property viewing?', 'Open an inquiry, select Schedule Viewing, choose a date and time, and save it to notify the tenant.'],
];

const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
const attachmentHref = (value) => value ? `${API.replace(/\/api\/v1\/?$/, '')}${value}` : '';
const renderTickets = (tickets) => tickets.length ? tickets.map((ticket) => `<article class="support-ticket-row" data-ticket-id="${escapeHtml(ticket.id)}" tabindex="0"><div><strong>${escapeHtml(ticket.subject)}</strong><small>${escapeHtml(ticket.description)}</small></div><span class="support-ticket-meta"><b class="support-ticket-status ${escapeHtml(ticket.status)}">${escapeHtml(ticket.status)}</b><span>${escapeHtml(ticket.priority)} priority</span><time>${ticket.created_at ? new Date(ticket.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'No date'}</time></span></article>`).join('') : '<p class="support-ticket-empty">You have not submitted any support tickets yet.</p>';
const renderMessages = (messages) => messages.filter((message) => !message.is_internal).map((message) => `<div class="support-message-wrap${message.sender_role === 'admin' ? '' : ' support-message-wrap--self'}"><article class="support-message"><strong>${escapeHtml(message.sender_name || 'Support')}</strong><p>${escapeHtml(message.body)}</p>${message.attachment_url ? `<a class="support-message-attachment" href="${escapeHtml(attachmentHref(message.attachment_url))}" target="_blank" rel="noopener"><i class="bi bi-paperclip"></i> ${escapeHtml(message.attachment_name || 'Open attachment')}</a>` : ''}</article><time>${message.created_at ? new Date(message.created_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : ''}</time></div>`).join('') || '<p class="support-ticket-empty">No replies yet.</p>';
async function loadTickets(root) {
  const list = root.querySelector('[data-support-ticket-list]');
  if (!list) return;
  try {
    const response = await fetch(`${API}/support-tickets`, { headers: headers() });
    const body = await response.json();
    if (!response.ok) throw new Error(body.message || 'Unable to load support tickets.');
    list.innerHTML = renderTickets(body.data || []);
    list.onclick = async (event) => {
      const row = event.target.closest('[data-ticket-id]');
      const conversation = root.querySelector('[data-support-conversation]');
      if (!row || !conversation) return;
      conversation.hidden = false;
      conversation.innerHTML = '<p class="support-ticket-empty">Loading conversation...</p>';
      const messagesResponse = await fetch(`${API}/support-tickets/${row.dataset.ticketId}/messages`, { headers: headers() });
      const messagesBody = await messagesResponse.json();
      conversation.innerHTML = messagesResponse.ok ? `<h3>Conversation</h3>${renderMessages(messagesBody.data || [])}<form class="support-reply-form" data-ticket-id="${escapeHtml(row.dataset.ticketId)}"><textarea name="body" rows="3" required placeholder="Write a reply..."></textarea><button type="submit">Send</button></form>` : `<p class="support-ticket-empty">${escapeHtml(messagesBody.message || 'Unable to load conversation.')}</p>`;
      conversation.querySelector('.support-reply-form')?.addEventListener('submit', async (replyEvent) => {
        replyEvent.preventDefault();
        const form = replyEvent.currentTarget;
        const body = new FormData(form).get('body');
        const replyResponse = await fetch(`${API}/support-tickets/${row.dataset.ticketId}/messages`, { method: 'POST', headers: headers(), body: JSON.stringify({ body }) });
        if (!replyResponse.ok) { showToast({ message: 'Unable to send reply.', type: 'error' }); return; }
        row.click();
      });
    };
  } catch (error) {
    list.innerHTML = `<p class="support-ticket-empty">${escapeHtml(error.message)}</p>`;
  }
}
export async function renderSupport(root = document.querySelector('#app')) {
  if (!root) throw new Error('Support requires #app.');
  await css();
  ensureOwnerSidebarStyles();
  const faqMarkup = faqs.map(([question, answer], index) => `<div class="support-faq-item"><button type="button" class="support-faq-question" aria-expanded="false"><span>${question}</span><i class="bi bi-chevron-down"></i></button><p class="support-faq-answer" hidden>${answer}</p></div>`).join('');
  root.innerHTML = `<div class="owner-shell">${renderOwnerSidebar('support')}<main class="user-support-main"><header class="support-page-header"><div><span class="user-support-kicker"><i class="bi bi-headset"></i> Support</span><h1>Support</h1><p>Get help, find answers, or contact our support team.</p></div></header><section class="support-hero"><div><h2>We're here to help!</h2><p>Have a question, need assistance, or facing an issue? Our support team is ready to help you with anything related to your DormHive account.</p><button type="button" class="support-contact"><i class="bi bi-envelope"></i> Contact support</button></div><div class="support-illustration" aria-hidden="true"><span class="support-person-head"></span><span class="support-headset"></span><span class="support-laptop"></span><span class="support-chat-bubble">•••</span></div></section><section class="support-content-grid"><article class="support-faq-card"><header><h2>Frequently Asked Questions</h2><p>Find quick answers to common questions.</p></header><div class="support-faq-list">${faqMarkup}</div></article><aside class="support-contact-card"><header><h2>Need more help?</h2><p>If you can't find what you're looking for, reach out to our support team.</p></header><div class="support-contact-list"><a href="mailto:support@dormhive.com"><i class="bi bi-envelope"></i><span><strong>Email Support</strong><small>support@dormhive.com</small></span><i class="bi bi-chevron-right"></i></a><a href="mailto:support@dormhive.com?subject=Live%20chat"><i class="bi bi-chat-square-text"></i><span><strong>Live Chat</strong><small>Available 9AM - 6PM</small></span><i class="bi bi-chevron-right"></i></a><a href="tel:+639123456789"><i class="bi bi-telephone"></i><span><strong>Phone Support</strong><small>+63 912 345 6789</small></span><i class="bi bi-chevron-right"></i></a></div><div class="support-urgent"><i class="bi bi-lightbulb"></i><span>For urgent issues, please contact us via phone for faster assistance.</span></div></aside></section><article class="user-ticket-form" hidden><div class="user-support-card-head"><div><h2>Create Support Ticket</h2><p>Tell us what you need help with.</p></div><button type="button" class="support-close" aria-label="Close form"><i class="bi bi-x-lg"></i></button></div><form><label>Subject<input name="subject" required placeholder="What do you need help with?" /></label><label>Priority<select name="priority"><option value="low">Low</option><option value="medium" selected>Medium</option><option value="high">High</option></select></label><label>Message<textarea name="description" rows="7" required placeholder="Describe the issue"></textarea></label><div><button type="button" class="support-cancel">Cancel</button><button type="submit" class="support-submit">Submit Ticket</button></div></form></article></main></div>`;
  root.querySelector('.owner-sidebar')?.remove();
  root.querySelector('.owner-shell')?.classList.add('support-standalone');
  const formCard = root.querySelector('.user-ticket-form');
  const ticketForm = formCard?.querySelector('form');
  root.querySelector('.user-ticket-form')?.insertAdjacentHTML('beforebegin', '<section class="support-tickets-card"><header><h2>My Support Tickets</h2><p>View the support requests you have submitted.</p></header><div data-support-ticket-list><p class="support-ticket-empty">Loading tickets...</p></div><div class="support-conversation" data-support-conversation hidden></div></section>');
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
  ticketForm?.addEventListener('submit', async (event) => { event.preventDefault(); const form = event.currentTarget; try { const data = new FormData(form); const response = await fetch(`${API}/support-tickets`, { method: 'POST', headers: headers(), body: JSON.stringify({ subject: data.get('subject'), priority: data.get('priority'), description: data.get('description') }) }); const body = await response.json(); if (!response.ok) throw new Error(body.message || 'Unable to create support ticket.'); form.reset(); formCard.hidden = true; showToast({ message: 'Support ticket submitted successfully.', type: 'success' }); } catch (error) { showToast({ message: error.message, type: 'error' }); } });
}
