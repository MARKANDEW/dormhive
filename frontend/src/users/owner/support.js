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
  ticketForm?.addEventListener('submit', async (event) => { event.preventDefault(); const form = event.currentTarget; try { const data = new FormData(form); const response = await fetch(`${API}/support-tickets`, { method: 'POST', headers: headers(), body: JSON.stringify({ subject: data.get('subject'), priority: data.get('priority'), description: data.get('description') }) }); const body = await response.json(); if (!response.ok) throw new Error(body.message || 'Unable to create support ticket.'); form.reset(); formCard.hidden = true; showToast({ message: 'Support ticket submitted successfully.', type: 'success' }); } catch (error) { showToast({ message: error.message, type: 'error' }); } });
}
