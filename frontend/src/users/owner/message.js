import { ensureOwnerSidebarStyles, renderOwnerSidebar } from './sidebarOwner.js';

const API = window.DORMHIVE_API_URL ?? 'http://localhost:5000/api/v1';
const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('dormhive.accessToken') ?? ''}` });
const esc = (value = '') => { const span = document.createElement('span'); span.textContent = value; return span.innerHTML; };
const user = () => { try { return JSON.parse(localStorage.getItem('dormhive.user') ?? '{}'); } catch { return {}; } };
const initials = (value = '') => value.split(' ').filter(Boolean).map((part) => part[0]).slice(0, 2).join('').toUpperCase() || 'U';
const dayTime = (value) => new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(value));
const shortDate = (value) => new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(value));

function css() {
  if (!document.querySelector('[data-owner-style="message"]')) {
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = new URL('./style/message.css', import.meta.url);
    l.dataset.ownerStyle = 'message';
    document.head.append(l);
  }
}

export function renderMessage(root = document.querySelector('#app')) {
  if (!root) throw new Error('Owner messages page requires #app.');
  css();
  ensureOwnerSidebarStyles();

  root.innerHTML = `
    <div class="owner-shell">
      ${renderOwnerSidebar('message')}
      <div class="owner-main">
        <main class="owner-inbox-page">
          <header class="topbar">
            <label class="top-search" aria-label="Search">
              <span>⌕</span>
              <input type="search" placeholder="Search my listings, inquiries, tenants..." />
            </label>
            <div class="profile-area">
              <button class="icon-button" type="button" aria-label="Notifications">🔔</button>
              <div class="avatar-chip">${esc(initials(user().name))}</div>
              <div class="profile-meta">
                <strong>${esc(user().name || 'Property Owner')}</strong>
                <span>${esc((user().role || 'owner').replace(/\b\w/g, (char) => char.toUpperCase()))}</span>
              </div>
            </div>
          </header>

          <section class="inbox-layout">
            <aside class="inbox-sidebar">
              <div class="sidebar-title-row">
                <h1>Inbox</h1>
              </div>
              <p class="status" role="status">Loading conversations…</p>
              <div class="conversation-list"></div>
            </aside>

            <section class="chat-pane">
              <div class="chat-header">
                <div class="contact-meta">
                  <div id="chat-avatar" class="avatar-chip large">U</div>
                  <div>
                    <h2 id="chat-contact">Select a conversation</h2>
                    <span id="chat-property" class="property-tag">Property details will appear here.</span>
                  </div>
                </div>
                <div class="chat-actions">
                  <button class="icon-button" type="button" aria-label="Video call">📹</button>
                  <button class="icon-button" type="button" aria-label="Profile">👤</button>
                </div>
              </div>
              <div class="messages"></div>
              <form class="composer" hidden>
                <textarea required maxlength="2000" placeholder="Type your message here..."></textarea>
                <button type="submit">Send</button>
              </form>
            </section>
          </section>
        </main>
      </div>
    </div>`;

  const state = { conversations: [], selected: null, properties: [] };
  const list = root.querySelector('.conversation-list');
  const messages = root.querySelector('.messages');
  const form = root.querySelector('.composer');
  const status = root.querySelector('.status');
  const chatTitle = root.querySelector('#chat-contact');
  const chatProperty = root.querySelector('#chat-property');
  const chatAvatar = root.querySelector('#chat-avatar');
  const searchInput = root.querySelector('.top-search input');

  const getPropertyTitle = (propertyId) => {
    const property = state.properties.find((item) => String(item.id) === String(propertyId));
    return property?.title || 'Property';
  };

  const renderConversations = (query = '') => {
    const filtered = state.conversations.filter((item) => {
      const text = `${item.participant_name ?? ''} ${getPropertyTitle(item.property_id)} ${item.last_message ?? ''}`.toLowerCase();
      return !query || text.includes(query.toLowerCase());
    });

    list.innerHTML = filtered.length
      ? filtered.map((item) => `
        <button class="conversation-item ${state.selected?.id === item.id ? 'active' : ''}" data-id="${item.id}" type="button">
          <div class="avatar-chip">${esc((item.participant_name ?? 'U').split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase())}</div>
          <div class="conversation-main">
            <div class="conversation-head">
              <strong>${esc(item.participant_name ?? 'Conversation')}</strong>
              <time>${esc(item.updated_at ? dayTime(item.updated_at) : '')}</time>
            </div>
            <div class="conversation-meta">
              <span>${esc(getPropertyTitle(item.property_id))}</span>
              <span class="preview">${esc(item.last_message ?? 'No messages yet')}</span>
            </div>
          </div>
          ${Number(item.unread_count ?? 0) > 0 ? '<span class="unread-dot"></span>' : ''}
        </button>
      `).join('')
      : '<p class="empty">No conversations found.</p>';

    list.querySelectorAll('.conversation-item').forEach((button) => {
      button.addEventListener('click', () => select(button.dataset.id));
    });
  };

  const select = async (id) => {
    try {
      const response = await fetch(`${API}/messages/conversations/${id}`, { headers: headers() });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || 'Unable to load conversation history.');

      state.selected = state.conversations.find((item) => String(item.id) === String(id));
      if (!state.selected) return;

      chatTitle.textContent = state.selected.participant_name ?? 'Conversation';
      chatProperty.textContent = getPropertyTitle(state.selected.property_id);
      chatAvatar.textContent = initials(state.selected.participant_name ?? 'Conversation');

      messages.innerHTML = (Array.isArray(body.data) ? body.data : []).map((message) => `
        <article class="message-bubble ${message.sender_id === Number(user().id) ? 'mine' : 'their'}">
          <div class="bubble-meta">
            <div class="avatar-chip tiny">${message.sender_id === Number(user().id) ? initials(user().name || 'You') : initials(state.selected.participant_name ?? 'Tenant')}</div>
            <span>${esc(message.sender_id === Number(user().id) ? 'You' : state.selected.participant_name ?? 'Tenant')}</span>
          </div>
          <div class="bubble-body">${esc(message.body || 'No message text.')}</div>
          <small>${esc(shortDate(message.created_at))} • ${esc(dayTime(message.created_at))}</small>
        </article>
      `).join('') || '<p class="empty">Start the conversation.</p>';

      form.hidden = false;
      renderConversations(searchInput.value);
    } catch (error) {
      messages.innerHTML = `<p class="empty">${esc(error.message)}</p>`;
    }
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const textarea = form.querySelector('textarea');
    if (!textarea.reportValidity() || !state.selected) return;

    const response = await fetch(`${API}/messages`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ conversationId: state.selected.id, body: textarea.value.trim() })
    });

    const body = await response.json();
    if (!response.ok) {
      status.textContent = body.message ?? 'Message could not be sent.';
      return;
    }

    textarea.value = '';
    await select(state.selected.id);
  });

  searchInput.addEventListener('input', (event) => renderConversations(event.target.value));

  const load = async () => {
    try {
      const [conversationResponse, propertyResponse] = await Promise.all([
        fetch(`${API}/messages/conversations`, { headers: headers() }),
        fetch(`${API}/properties?limit=100`, { headers: headers() })
      ]);

      const conversationBody = await conversationResponse.json();
      const propertyBody = await propertyResponse.json();

      if (!conversationResponse.ok) throw new Error(conversationBody.message || 'Unable to load messages.');
      if (!propertyResponse.ok) throw new Error(propertyBody.message || 'Unable to load properties.');

      state.conversations = Array.isArray(conversationBody.data) ? conversationBody.data : [];
      state.properties = Array.isArray(propertyBody.data) ? propertyBody.data : [];
      status.hidden = true;
      renderConversations();

      if (state.conversations[0]) {
        await select(state.conversations[0].id);
      }
    } catch (error) {
      status.textContent = error.message;
      messages.innerHTML = `<p class="empty">${esc(error.message)}</p>`;
    }
  };

  root.querySelector('.logout')?.addEventListener('click', () => {
    localStorage.clear();
    location.assign('#/login');
  });

  load();
}


