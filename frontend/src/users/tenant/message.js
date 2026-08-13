import { ensureTenantSidebarStyles, renderTenantSidebar } from './sidebarTenant.js';

const API_URL = window.DORMHIVE_API_URL ?? 'http://localhost:5000/api/v1';
const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('dormhive.accessToken') ?? ''}` });
function dashboardStyle() { if (!document.querySelector('[data-tenant-style="dashboard"]')) { const tag = document.createElement('link'); tag.rel = 'stylesheet'; tag.href = new URL('./style/dashboardTenant.css', import.meta.url); tag.dataset.tenantStyle = 'dashboard'; document.head.append(tag); } }
function style() { if (!document.querySelector('[data-tenant-style="message"]')) { const tag = document.createElement('link'); tag.rel = 'stylesheet'; tag.href = new URL('./style/message.css', import.meta.url); tag.dataset.tenantStyle = 'message'; document.head.append(tag); } }
const escape = (value = '') => { const node = document.createElement('span'); node.textContent = value; return node.innerHTML; };
const getSearchParam = (name) => {
  const search = typeof window.DORMHIVE_ROUTE_SEARCH === 'string' ? window.DORMHIVE_ROUTE_SEARCH : window.location.search;
  return new URLSearchParams(search).get(name);
};
const currentUser = () => { try { return JSON.parse(localStorage.getItem('dormhive.user') ?? '{}'); } catch { return {}; } };

export function renderMessage(root = document.querySelector('#app')) {
  if (!root) throw new Error('Messages page requires #app.');
  dashboardStyle();
  ensureTenantSidebarStyles();
  style();
  root.innerHTML = `<div class="dh-app">${renderTenantSidebar('message')}<main class="tenant-page-main"><section class="messages-page"><header><a class="brand" href="#/tenant/dashboardTenant">DormHive</a></header><section class="messages-layout"><aside class="conversation-list"><h1>Messages</h1><p class="status" role="status">Loading conversations…</p><div class="conversations"></div></aside><section class="thread"><div class="thread-header"><h2>Select a conversation</h2></div><div class="message-list"><p class="empty-state">Choose a conversation to view messages.</p></div><form class="composer" hidden><label class="sr-only" for="message-text">Message</label><textarea id="message-text" placeholder="Write a message" maxlength="2000" required></textarea><button type="submit">Send</button></form></section></section></section></main></div>`;
  root.querySelector('.logout').addEventListener('click', () => { localStorage.clear(); location.assign('#/login'); });
  const state = { selected: null, conversations: [] };
  const status = root.querySelector('.status');
  const conversations = root.querySelector('.conversations');
  const list = root.querySelector('.message-list');
  const form = root.querySelector('.composer');
  const heading = root.querySelector('.thread-header h2');
  const propertyId = getSearchParam('propertyId');

  const renderThreads = () => {
    conversations.innerHTML = state.conversations.length
      ? state.conversations.map((item) => `<button class="conversation ${state.selected?.id === item.id ? 'is-active' : ''}" data-id="${item.id}"><strong>${escape(item.participant_name ?? 'Conversation')}</strong><span>${escape(item.last_message ?? 'No messages yet')}</span></button>`).join('')
      : '<p class="empty-state">No conversations yet.</p>';
    conversations.querySelectorAll('button').forEach((button) => button.addEventListener('click', () => select(button.dataset.id)));
  };

  const select = async (id) => {
    try {
      const response = await fetch(`${API_URL}/messages/conversations/${id}`, { headers: headers() });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message);
      state.selected = state.conversations.find((item) => String(item.id) === String(id));
      heading.textContent = state.selected?.participant_name ?? 'Conversation';
      list.innerHTML = body.data.map((item) => `<article class="message ${item.sender_id === currentUser().id ? 'is-mine' : ''}"><p>${escape(item.body)}</p><time>${new Date(item.created_at).toLocaleString()}</time></article>`).join('') || '<p class="empty-state">Start the conversation.</p>';
      form.hidden = false;
      renderThreads();
    } catch (error) {
      list.innerHTML = `<p class="empty-state">${escape(error.message)}</p>`;
    }
  };

  const createOrSelectConversationForProperty = async (propertyIdValue) => {
    if (!propertyIdValue) return null;
    const matching = state.conversations.find((item) => String(item.property_id) === String(propertyIdValue));
    if (matching) return matching;
    const response = await fetch(`${API_URL}/messages/conversations`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ propertyId: propertyIdValue })
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.message || 'Unable to start a chat with the property owner.');
    state.conversations.unshift(body.data);
    return body.data;
  };

  const openConversation = async (conversation) => {
    if (!conversation) return;
    renderThreads();
    await select(conversation.id);
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const textarea = form.querySelector('textarea');
    if (!textarea.reportValidity() || !state.selected) return;
    const response = await fetch(`${API_URL}/messages`, { method: 'POST', headers: headers(), body: JSON.stringify({ conversationId: state.selected.id, body: textarea.value.trim() }) });
    const body = await response.json();
    if (!response.ok) { status.textContent = body.message ?? 'Message could not be sent.'; return; }
    textarea.value = '';
    select(state.selected.id);
  });

  fetch(`${API_URL}/messages/conversations`, { headers: headers() }).then(async (response) => {
    const body = await response.json();
    if (!response.ok) throw new Error(body.message);
    state.conversations = body.data;
    status.textContent = `${body.data.length} conversation${body.data.length === 1 ? '' : 's'}`;
    renderThreads();
    if (propertyId) {
      createOrSelectConversationForProperty(propertyId).then(openConversation).catch((error) => { status.textContent = error.message; });
    }
  }).catch((error) => { status.textContent = error.message; });
}


