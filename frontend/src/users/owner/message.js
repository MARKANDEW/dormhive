import { ensureOwnerSidebarStyles, renderOwnerSidebar, updateListingCountsInSidebar } from './sidebarOwner.js';
import { createModal, openModal } from '../../components/modal.js';

const API = window.DORMHIVE_API_URL ?? 'http://localhost:5000/api/v1';
const API_ORIGIN = API.replace(/\/api\/v1\/?$/, '');
const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('dormhive.accessToken') ?? ''}` });
const esc = (value = '') => { const span = document.createElement('span'); span.textContent = value; return span.innerHTML; };
const user = () => { try { return JSON.parse(localStorage.getItem('dormhive.user') ?? '{}'); } catch { return {}; } };
const initials = (value = '') => value.split(' ').filter(Boolean).map((part) => part[0]).slice(0, 2).join('').toUpperCase() || 'U';
const dayTime = (value) => new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(value));
const shortDate = (value) => new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(value));
const isImageDataUrl = (value = '') => typeof value === 'string' && /^data:image\//i.test(value.trim());
const renderMessageBody = (value = '') => {
  const text = String(value ?? '');
  if (isImageDataUrl(text)) {
    return `<div class="message-attachment"><img src="${text}" alt="Sent image" /></div>`;
  }
  return esc(text || 'No message text.');
};
const avatarUrl = (value = '') => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^(data:|blob:|https?:\/\/)/i.test(raw)) return raw;
  return `${API_ORIGIN}${raw.startsWith('/') ? '' : '/'}${raw}`;
};
const renderAvatar = (name = 'User', image = '') => {
  const source = avatarUrl(image);
  return source
    ? `<img src="${esc(source)}" alt="${esc(name)} avatar" onerror="this.replaceWith(document.createTextNode('${esc(initials(name))}'))" />`
    : esc(initials(name));
};
const participantAvatar = (item = {}) => renderAvatar(item.participant_name ?? 'Conversation', item.participant_avatar_url);

function css() {
  if (!document.querySelector('[data-owner-style="dashboard"]')) {
    const shared = document.createElement('link');
    shared.rel = 'stylesheet';
    shared.href = new URL('./style/dashboardOwner.css', import.meta.url);
    shared.dataset.ownerStyle = 'dashboard';
    document.head.append(shared);
  }

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
          <section class="inbox-layout">
            <aside class="inbox-sidebar">
              <div class="sidebar-title-row">
                <h1>Inbox</h1>
                <span class="inbox-count" aria-live="polite"></span>
              </div>
              <label class="search-bar inbox-search" aria-label="Search my listings, inquiries, tenants">
                <span>⌕</span>
                <input type="search" placeholder="Search conversations..." />
              </label>
              <div class="conversation-filters" role="group" aria-label="Conversation filters">
                <button type="button" class="filter-button active" data-filter="all">All</button>
                <button type="button" class="filter-button" data-filter="unread">Unread</button>
              </div>
              <p class="status" role="status">Loading conversations…</p>
              <div class="conversation-list"></div>
            </aside>

            <section class="chat-pane">
              <div class="chat-header">
                <button class="mobile-back" type="button" aria-label="Back to conversations">←</button>
                <div class="contact-meta">
                  <div id="chat-avatar" class="avatar-chip large">U</div>
                  <div>
                    <h2 id="chat-contact">Select a conversation</h2>
                    <span id="chat-property" class="property-tag">Property details will appear here.</span>
                  </div>
                </div>
                <div class="chat-actions">
                  <button class="icon-button" type="button" aria-label="Video call" title="Video call">📹</button>
                  <button class="icon-button" type="button" aria-label="Profile" title="Tenant profile">👤</button>
                </div>
              </div>
              <div class="owner-property-context hidden"></div>
              <div class="messages"></div>
              <form class="composer" hidden>
                <div class="composer-tools">
                  <div class="composer-input-wrapper">
                    <div class="attachment-strip hidden">
                      <div class="attachment-item">
                        <img class="attachment-preview" src="" alt="Selected attachment preview">
                        <button type="button" class="remove-attachment" aria-label="Remove selected photo">×</button>
                      </div>
                    </div>
                    <div class="composer-inline-input">
                      <label class="upload-button" title="Send a photo" aria-label="Send a photo">
                        <input class="image-input" type="file" accept="image/*" hidden>
                        <span>＋</span>
                      </label>
                      <textarea rows="1" maxlength="2000" placeholder="Type your message here..."></textarea>
                    </div>
                  </div>
                  <button type="submit">Send</button>
                </div>
              </form>
            </section>
          </section>
        </main>
      </div>
    </div>`;

  const state = { conversations: [], selected: null, properties: [], bookings: [], filter: 'all', sending: false };
  const list = root.querySelector('.conversation-list');
  const messages = root.querySelector('.messages');
  const form = root.querySelector('.composer');
  const status = root.querySelector('.status');
  const inboxCount = root.querySelector('.inbox-count');
  const propertyContext = root.querySelector('.owner-property-context');
  const filterButtons = Array.from(root.querySelectorAll('.filter-button'));
  const chatTitle = root.querySelector('#chat-contact');
  const chatProperty = root.querySelector('#chat-property');
  const chatAvatar = root.querySelector('#chat-avatar');
  const searchInput = root.querySelector('.inbox-search input');
  const videoCallButton = root.querySelector('.chat-actions button[aria-label="Video call"]');
  const profileButton = root.querySelector('.chat-actions button[aria-label="Profile"]');
  const mobileBackButton = root.querySelector('.mobile-back');
  const imageInput = form.querySelector('.image-input');
  const attachmentStrip = form.querySelector('.attachment-strip');
  const attachmentPreview = form.querySelector('.attachment-preview');
  const removeAttachmentButton = form.querySelector('.remove-attachment');
  let pendingImage = '';

  const clearPendingImage = () => {
    pendingImage = '';
    imageInput.value = '';
    attachmentPreview.src = '';
    attachmentStrip.classList.add('hidden');
  };

  removeAttachmentButton.addEventListener('click', clearPendingImage);

  imageInput.addEventListener('change', (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      status.textContent = 'Please choose an image file.';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      pendingImage = String(reader.result ?? '');
      attachmentPreview.src = pendingImage;
      attachmentStrip.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  });
  const getPropertyTitle = (propertyId) => {
    const property = state.properties.find((item) => String(item.id) === String(propertyId));
    return property?.title || 'Property';
  };

  const getProperty = (propertyId) => state.properties.find((item) => String(item.id) === String(propertyId));
  const getBooking = (conversation) => state.bookings
    .filter((item) => Number(item.tenant_id) === Number(conversation?.tenant_id) && Number(item.property_id) === Number(conversation?.property_id))
    .sort((a, b) => new Date(b.updated_at ?? b.created_at ?? 0) - new Date(a.updated_at ?? a.created_at ?? 0))[0];
  const isBookingMessage = (value = '') => /viewing scheduled|scheduled for/i.test(String(value));

  const renderBookingCard = (message, conversation) => {
    const booking = getBooking(conversation);
    const date = booking?.viewing_date || booking?.schedule_date || booking?.move_in_date;
    const time = booking?.viewing_time || booking?.schedule_time;
    const statusLabel = booking?.status ? String(booking.status).replace(/[-_]/g, ' ') : 'Viewing appointment';
    return `
      <div class="owner-booking-card">
        <div class="owner-booking-heading"><span class="booking-icon">📅</span><strong>Property Viewing</strong><span class="booking-status">${esc(statusLabel)}</span></div>
        <div class="owner-booking-details">
          <strong>${esc(date ? new Date(date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : 'Viewing appointment')}</strong>
          <span>${esc(time || message.replace(/.*scheduled for\s*/i, '') || 'Time not specified')}</span>
        </div>
        <div class="owner-booking-actions"><span>${esc(booking ? `Tenant: ${conversation.participant_name || 'Tenant'}` : 'Viewing appointment')}</span>${booking ? '<a href="#/owner/inquiries" class="booking-action">View Booking</a>' : ''}</div>
      </div>`;
  };

  const renderOwnerPropertyContext = () => {
    const property = getProperty(state.selected?.property_id);
    if (!state.selected || !property) {
      propertyContext.classList.add('hidden');
      propertyContext.innerHTML = '';
      return;
    }
    propertyContext.classList.remove('hidden');
    propertyContext.innerHTML = `
      <div class="owner-property-copy"><span class="property-context-icon">🏠</span><div><strong>${esc(property.title || 'Property')}</strong><small>Property inquiry</small><small>Tenant: ${esc(state.selected.participant_name || 'Tenant')}</small></div></div>
      <button type="button" class="property-context-link" data-owner-property>View Property</button>`;
    propertyContext.querySelector('[data-owner-property]')?.addEventListener('click', () => {
      const modal = createModal({ title: property.title || 'Property Details', content: '', closeLabel: 'Close' });
      const location = [property.address, property.barangay, property.municipality, property.city].filter(Boolean).join(', ') || 'Not specified';
      modal.querySelector('.ui-modal__body').innerHTML = `<div class="owner-property-details"><h3>${esc(property.title || 'Property')}</h3><p><strong>Location:</strong> ${esc(location)}</p><p><strong>Room type:</strong> ${esc(property.room_type || 'Not specified')}</p><p><strong>Monthly rent:</strong> ${property.monthly_rent ? `PHP ${Number(property.monthly_rent).toLocaleString('en-PH')}` : 'Not specified'}</p><p><strong>Description:</strong> ${esc(property.description || 'No description provided.')}</p></div>`;
      openModal(modal);
    });
  };

  const renderConversations = (query = '') => {
    const filtered = state.conversations.filter((item) => {
      if (state.filter === 'unread' && Number(item.unread_count ?? 0) < 1) return false;
      const text = `${item.participant_name ?? ''} ${getPropertyTitle(item.property_id)} ${item.last_message ?? ''}`.toLowerCase();
      return !query || text.includes(query.toLowerCase());
    });

    list.innerHTML = filtered.length
      ? filtered.map((item) => `
        <button class="conversation-item ${state.selected?.id === item.id ? 'active' : ''}" data-id="${item.id}" type="button">
          <div class="avatar-chip">${participantAvatar(item)}</div>
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
          ${Number(item.unread_count ?? 0) > 0 ? `<span class="unread-dot" aria-label="${Number(item.unread_count)} unread"></span>` : ''}
        </button>
      `).join('')
      : '<div class="empty-conversations"><span>💬</span><strong>No conversations yet</strong><small>Tenant inquiries and messages will appear here.</small></div>';

    const unread = state.conversations.reduce((total, item) => total + Number(item.unread_count ?? 0), 0);
    inboxCount.textContent = `${state.conversations.length} conversation${state.conversations.length === 1 ? '' : 's'}${unread ? ` • ${unread} unread` : ''}`;

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
      root.querySelector('.owner-inbox-page')?.classList.add('thread-open');

      chatTitle.textContent = state.selected.participant_name ?? 'Conversation';
      chatProperty.textContent = getPropertyTitle(state.selected.property_id);
      chatAvatar.innerHTML = renderAvatar(state.selected.participant_name ?? 'Conversation', state.selected.participant_avatar_url);
      renderOwnerPropertyContext();

      messages.innerHTML = (Array.isArray(body.data) ? body.data : []).map((message) => `
        <article class="message-bubble ${message.sender_id === Number(user().id) ? 'mine' : 'their'}">
          <div class="bubble-meta">
            <div class="avatar-chip tiny">${message.sender_id === Number(user().id)
              ? renderAvatar(user().name || 'You', user().avatar_url)
              : renderAvatar(state.selected.participant_name ?? 'Tenant', state.selected.participant_avatar_url)}</div>
            <span>${esc(message.sender_id === Number(user().id) ? 'You' : state.selected.participant_name ?? 'Tenant')}</span>
          </div>
          <div class="bubble-body">${isBookingMessage(message.body) ? renderBookingCard(message.body, state.selected) : renderMessageBody(message.body)}</div>
          <small>${esc(shortDate(message.created_at))} • ${esc(dayTime(message.created_at))}</small>
        </article>
      `).join('') || '<p class="empty">Start the conversation.</p>';

      messages.querySelectorAll('.message-attachment img').forEach((img) => {
        img.style.cursor = 'pointer';
        img.addEventListener('click', () => openPhotoViewer(img.src));
      });

      form.hidden = false;
      renderConversations(searchInput.value);
      requestAnimationFrame(() => {
        messages.scrollTop = messages.scrollHeight;
      });
    } catch (error) {
      messages.innerHTML = `<p class="empty">${esc(error.message)}</p>`;
    }
  };

  const openPhotoViewer = (imageDataUrl) => {
    const modal = document.createElement('div');
    modal.className = 'photo-viewer-modal';
    modal.innerHTML = `
      <div class="photo-viewer-backdrop"></div>
      <div class="photo-viewer-content">
        <button class="photo-viewer-close" aria-label="Close photo">×</button>
        <img src="${imageDataUrl}" alt="Message photo" class="photo-viewer-image" />
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('.photo-viewer-close').addEventListener('click', () => modal.remove());
    modal.querySelector('.photo-viewer-backdrop').addEventListener('click', () => modal.remove());
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const textarea = form.querySelector('textarea');
    if (!state.selected) return;

    const textMessage = textarea.value.trim();
    const hasImage = !!pendingImage;
    const hasText = !!textMessage;

    if (!hasImage && !hasText) return;

    try {
      state.sending = true;
      form.classList.add('is-sending');
      form.querySelector('button[type="submit"]').disabled = true;
      if (hasImage) {
        await fetch(`${API}/messages`, {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify({ conversationId: state.selected.id, body: pendingImage })
        });
      }

      if (hasText) {
        const response = await fetch(`${API}/messages`, {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify({ conversationId: state.selected.id, body: textMessage })
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.message ?? 'Message could not be sent.');
      }

      textarea.value = '';
      clearPendingImage();
      await select(state.selected.id);
    } catch (error) {
      status.textContent = error.message;
    } finally {
      state.sending = false;
      form.classList.remove('is-sending');
      form.querySelector('button[type="submit"]').disabled = false;
    }
  });

  form.querySelector('textarea').addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      form.dispatchEvent(new Event('submit'));
    }
  });

  searchInput.addEventListener('input', (event) => renderConversations(event.target.value));
  filterButtons.forEach((button) => {
    button.addEventListener('click', () => {
      state.filter = button.dataset.filter || 'all';
      filterButtons.forEach((item) => item.classList.toggle('active', item === button));
      renderConversations(searchInput.value);
    });
  });
  videoCallButton?.addEventListener('click', () => {
    if (!state.selected) return;
    const roomName = `DormHive-owner-conversation-${encodeURIComponent(String(state.selected.id))}`;
    const callWindow = window.open(`https://meet.jit.si/${roomName}`, '_blank', 'noopener,noreferrer');
    if (!callWindow) status.textContent = 'Allow pop-ups to open the video call in a new tab.';
  });
  profileButton?.addEventListener('click', () => {
    if (!state.selected) return;
    const modal = createModal({ title: state.selected.participant_name || 'Tenant profile', content: '', closeLabel: 'Close' });
    modal.querySelector('.ui-modal__body').innerHTML = `
      <div class="owner-tenant-profile">
        <div class="tenant-avatar-section">
          <div class="tenant-avatar-circle">${participantAvatar(state.selected)}</div>
        </div>
        <div class="tenant-info-row">
          <span class="tenant-label">Tenant:</span>
          <span class="tenant-value">${esc(state.selected.participant_name || 'Tenant')}</span>
        </div>
        <div class="tenant-info-row">
          <span class="tenant-label">Property:</span>
          <span class="tenant-value">${esc(getPropertyTitle(state.selected.property_id))}</span>
        </div>
      </div>
    `;
    openModal(modal);
  });
  mobileBackButton?.addEventListener('click', () => {
    state.selected = null;
    root.querySelector('.owner-inbox-page')?.classList.remove('thread-open');
    chatTitle.textContent = 'Select a conversation';
    chatProperty.textContent = 'Property details will appear here.';
    propertyContext.classList.add('hidden');
    renderConversations(searchInput.value);
  });

  const load = async () => {
    try {
      const [conversationResponse, propertyResponse, bookingResponse] = await Promise.all([
        fetch(`${API}/messages/conversations`, { headers: headers() }),
        fetch(`${API}/properties?limit=100`, { headers: headers() }),
        fetch(`${API}/bookings`, { headers: headers() })
      ]);

      const conversationBody = await conversationResponse.json();
      const propertyBody = await propertyResponse.json();
      const bookingBody = await bookingResponse.json();

      if (!conversationResponse.ok) throw new Error(conversationBody.message || 'Unable to load messages.');
      if (!propertyResponse.ok) throw new Error(propertyBody.message || 'Unable to load properties.');
      if (!bookingResponse.ok) throw new Error(bookingBody.message || 'Unable to load bookings.');

      state.conversations = Array.isArray(conversationBody.data) ? conversationBody.data : [];
      state.properties = Array.isArray(propertyBody.data) ? propertyBody.data : [];
      state.bookings = Array.isArray(bookingBody.data) ? bookingBody.data : [];
      status.hidden = true;
      renderConversations();

      const savedSelection = (() => {
        try {
          return JSON.parse(localStorage.getItem('dormhive.activeTenantSelection') ?? 'null');
        } catch {
          return null;
        }
      })();

      const hashMatch = location.hash.match(/#\/owner\/message\/tenant\/(\d+)/);
      const tenantIdFromUrl = hashMatch ? Number(hashMatch[1]) : null;
      const targetTenantId = savedSelection?.tenantId ?? tenantIdFromUrl;

      if (targetTenantId) {
        let targetConversation = state.conversations.find((conv) => Number(conv.tenant_id) === Number(targetTenantId)
          && (!savedSelection?.propertyId || Number(conv.property_id) === Number(savedSelection.propertyId)));
        if (!targetConversation && savedSelection?.propertyId) {
          const createResponse = await fetch(`${API}/messages/conversations`, {
            method: 'POST',
            headers: headers(),
            body: JSON.stringify({
              tenantId: targetTenantId,
              ownerId: user().id,
              propertyId: savedSelection.propertyId
            })
          });
          const createBody = await createResponse.json();
          if (!createResponse.ok) throw new Error(createBody.message || 'Unable to start a conversation.');
          targetConversation = createBody.data;
          state.conversations.push(targetConversation);
          renderConversations(searchInput.value);
        }
        if (targetConversation) {
          await select(targetConversation.id);
          localStorage.removeItem('dormhive.activeTenantSelection');
          if (location.hash.startsWith('#/owner/message/tenant/')) {
            location.hash = '#/owner/message';
          }
        } else if (state.conversations[0]) {
          await select(state.conversations[0].id);
        }
      } else if (state.conversations[0]) {
        await select(state.conversations[0].id);
      }
      await updateListingCountsInSidebar();
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


