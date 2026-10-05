import { ensureTenantSidebarStyles, loadTenantStylesheet, renderTenantSidebar } from './sidebarTenant.js';
import { getUserAvatarUrl, refreshTenantUserSession } from './setting.js';
import { createModal, openModal } from '../../components/modal.js';

const API_URL = window.DORMHIVE_API_URL ?? 'http://localhost:5000/api/v1';
const apiBase = API_URL.replace(/\/api\/v1\/?$/, '');
const headers = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('dormhive.accessToken') ?? ''}`
});

const resolveImageUrl = (value = '') => {
  const url = String(value || '').trim();
  if (!url) return '';
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  return `${apiBase}${url.startsWith('/') ? '' : '/'}${url}`;
};

function style() {
  return loadTenantStylesheet('message', new URL('./style/message.css', import.meta.url));
}

const escape = (value = '') => {
  const node = document.createElement('span');
  node.textContent = value;
  return node.innerHTML;
};

const isImageDataUrl = (value = '') => typeof value === 'string' && /^data:image\//i.test(value.trim());

const getSearchParam = (name) => {
  const search = typeof window.DORMHIVE_ROUTE_SEARCH === 'string' ? window.DORMHIVE_ROUTE_SEARCH : window.location.search;
  return new URLSearchParams(search).get(name);
};

const tenantFullName = (user = {}) => {
  const firstName = String(user.first_name ?? user.firstName ?? '').trim();
  const lastName = String(user.last_name ?? user.lastName ?? '').trim();
  const combined = [firstName, lastName].filter(Boolean).join(' ');
  return combined || String(user.name ?? 'Tenant').trim() || 'Tenant';
};

const currentUser = () => {
  try {
    return JSON.parse(localStorage.getItem('dormhive.user') ?? '{}');
  } catch {
    return {};
  }
};

const participantAvatar = (item = {}) => {
  if (item.participant_avatar_url) {
    return `<img src="${escape(getUserAvatarUrl({ avatar_url: item.participant_avatar_url }, item.participant_name ?? 'Conversation'))}" alt="${escape(item.participant_name ?? 'Conversation')} avatar" />`;
  }
  return escape((item.participant_name ?? 'C').split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase());
};

const formatMessageTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(date);
};

const formatTimeOnly = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date);
};

const formatConversationTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const hours = (Date.now() - date.getTime()) / (1000 * 60 * 60);
  if (hours < 24) return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date);
  if (hours < 168) return new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(date);
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
};

const isBookingSystemMessage = (value = '') => /viewing scheduled|scheduled for/i.test(String(value ?? ''));

const renderBookingCard = (value = '') => {
  const text = String(value ?? '');
  const match = text.match(/Viewing scheduled for\s*(.+?\.\s*)(\d{1,2}:\d{2}\s*[AP]M)/i);
  const dateLabel = match ? match[1].replace(/\.$/, '') : 'Viewing scheduled';
  const timeLabel = match ? match[2] : 'Please review';

  return `
    <div class="booking-card">
      <div class="booking-card-head">
        <span class="booking-icon">📅</span>
        <strong>Viewing scheduled</strong>
      </div>
      <div class="booking-card-body">
        <div>${escape(dateLabel)}</div>
        <div>${escape(timeLabel)}</div>
      </div>
      <button type="button" class="booking-card-link" data-action="view-booking">View booking</button>
    </div>
  `;
};

const renderMessageBody = (value = '') => {
  const text = String(value ?? '');
  if (isImageDataUrl(text)) {
    return `<div class="message-attachment"><img src="${text}" alt="Sent image" /></div>`;
  }
  if (isBookingSystemMessage(text)) {
    return renderBookingCard(text);
  }
  return escape(text || 'No message text.');
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

const openPropertyDetails = (property) => {
  if (!property) return;
  let propertyImages = property.images;
  if (typeof propertyImages === 'string') {
    try { propertyImages = JSON.parse(propertyImages); } catch { propertyImages = []; }
  }
  const galleryImages = [...new Set([
    property.image_url,
    property.cover_image,
    ...(Array.isArray(propertyImages) ? propertyImages : [])
  ].map(resolveImageUrl).filter(Boolean))];
  const location = [property.address, property.barangay, property.municipality, property.city].filter(Boolean).join(', ') || 'Not specified';
  const amenities = Array.isArray(property.amenities)
    ? property.amenities.join(', ')
    : String(property.amenities ?? '').replace(/[\[\]"']/g, '').replace(/,/g, ', ');
  const modal = createModal({ title: 'Property Details', content: '', closeLabel: 'Close' });
  modal.classList.add('tenant-message-modal');
  modal.classList.add('tenant-property-details-modal');
  modal.querySelector('.ui-modal__header h2').innerHTML = '<span class="message-property-header-icon"><i class="bi bi-house-door-fill" aria-hidden="true"></i></span>Property Details';
  modal.querySelector('.ui-modal__body').innerHTML = `
    <div class="message-property-details">
      <div class="message-property-gallery">
        <div class="message-property-gallery-stage">
          ${galleryImages.length ? `<img class="message-property-image" src="${escape(galleryImages[0])}" alt="${escape(property.title || 'Property')} photo 1" />` : '<div class="message-property-image-empty">No property photo</div>'}
          ${galleryImages.length ? `<span class="message-property-image-counter" aria-live="polite">1 / ${galleryImages.length}</span>` : ''}
          ${galleryImages.length > 1 ? '<button type="button" class="message-property-gallery-nav previous" aria-label="Previous photo">&#8249;</button><button type="button" class="message-property-gallery-nav next" aria-label="Next photo">&#8250;</button>' : ''}
        </div>
        ${galleryImages.length ? `<div class="message-property-thumbnails" role="group" aria-label="Property photo thumbnails">${galleryImages.map((src, index) => `<button type="button" class="message-property-thumbnail${index === 0 ? ' active' : ''}" data-gallery-index="${index}" aria-label="View photo ${index + 1}" aria-current="${index === 0 ? 'true' : 'false'}"><img src="${escape(src)}" alt="" /></button>`).join('')}</div>` : ''}
      </div>
      <div class="message-property-copy">
        <div class="message-property-heading">
          <h3>${escape(property.title || 'Property')}</h3>
          <strong>${Number(property.monthly_rent ?? 0) ? `PHP ${Number(property.monthly_rent).toLocaleString('en-PH')}` : 'Rent not specified'} / month</strong>
        </div>
        <div class="message-property-grid">
          <p><span class="message-property-fact-icon"><i class="bi bi-geo-alt-fill" aria-hidden="true"></i></span><span class="message-property-fact-copy"><small>Location</small><strong>${escape(location)}</strong></span></p>
          <p><span class="message-property-fact-icon"><i class="bi bi-house-fill" aria-hidden="true"></i></span><span class="message-property-fact-copy"><small>Room Type</small><strong>${escape(property.room_type || 'Not specified')}</strong></span></p>
          <p><span class="message-property-fact-icon"><i class="bi bi-people-fill" aria-hidden="true"></i></span><span class="message-property-fact-copy"><small>Occupancy</small><strong>${escape(property.max_occupants ? `Up to ${property.max_occupants} tenants` : 'Not specified')}</strong></span></p>
          <p><span class="message-property-fact-icon"><i class="bi bi-door-open-fill" aria-hidden="true"></i></span><span class="message-property-fact-copy"><small>Available Slots</small><strong>${escape(property.available_slots ?? 'Not specified')}</strong></span></p>
          <p><span class="message-property-fact-icon"><i class="bi bi-gender-ambiguous" aria-hidden="true"></i></span><span class="message-property-fact-copy"><small>Gender Preference</small><strong>${escape(property.gender_preference || 'Not specified')}</strong></span></p>
          <p><span class="message-property-fact-icon"><i class="bi bi-person-fill" aria-hidden="true"></i></span><span class="message-property-fact-copy"><small>Owner</small><strong>${escape(property.owner_name || 'Not specified')}</strong></span></p>
        </div>
        <p class="message-property-amenities"><span class="message-property-fact-icon"><i class="bi bi-stars" aria-hidden="true"></i></span><span class="message-property-fact-copy"><small>Amenities</small><strong>${escape(amenities || 'None listed')}</strong></span></p>
        <div class="message-property-description"><span class="message-property-fact-icon"><i class="bi bi-card-text" aria-hidden="true"></i></span><div><small>Description</small><p>${escape(property.description || 'No description provided.')}</p></div></div>
      </div>
    </div>
  `;
  const mainImage = modal.querySelector('.message-property-image');
  if (mainImage && galleryImages.length > 1) {
    const counter = modal.querySelector('.message-property-image-counter');
    const thumbnails = Array.from(modal.querySelectorAll('.message-property-thumbnail'));
    let imageIndex = 0;
    const showImage = (nextIndex) => {
      imageIndex = (nextIndex + galleryImages.length) % galleryImages.length;
      mainImage.src = galleryImages[imageIndex];
      mainImage.alt = `${property.title || 'Property'} photo ${imageIndex + 1}`;
      counter.textContent = `${imageIndex + 1} / ${galleryImages.length}`;
      thumbnails.forEach((thumbnail, index) => {
        const active = index === imageIndex;
        thumbnail.classList.toggle('active', active);
        thumbnail.setAttribute('aria-current', String(active));
      });
    };
    modal.querySelector('.message-property-gallery-nav.previous').addEventListener('click', () => showImage(imageIndex - 1));
    modal.querySelector('.message-property-gallery-nav.next').addEventListener('click', () => showImage(imageIndex + 1));
    thumbnails.forEach((thumbnail) => thumbnail.addEventListener('click', () => showImage(Number(thumbnail.dataset.galleryIndex))));
  }
  openModal(modal);
};

const openParticipantProfile = (conversation, property) => {
  if (!conversation) return;
  const name = conversation.participant_name || 'Conversation participant';
  const modal = createModal({ title: name, content: '', closeLabel: 'Close' });
  modal.classList.add('tenant-message-modal');
  modal.querySelector('.ui-modal__body').innerHTML = `
    <div class="message-participant-profile">
      <div class="message-participant-avatar">${participantAvatar(conversation)}</div>
      <h3>${escape(name)}</h3>
      <p>${escape(property ? `Owner of ${property.title || 'this property'}` : 'Property conversation participant')}</p>
      <button type="button" class="message-profile-property" data-profile-property>View Property Details</button>
    </div>
  `;
  modal.querySelector('[data-profile-property]')?.addEventListener('click', () => {
    modal.close();
    modal.remove();
    openPropertyDetails(property);
  });
  openModal(modal);
};

export async function renderMessage(root = document.querySelector('#app')) {
  if (!root) throw new Error('Messages page requires #app.');
  await Promise.all([
    loadTenantStylesheet('dashboard', new URL('./style/dashboardTenant.css', import.meta.url)),
    style(),
    ensureTenantSidebarStyles()
  ]);

  root.innerHTML = `
    <div class="dh-app">
      ${renderTenantSidebar('message')}
      <main class="tenant-page-main">
        <section class="messages-page">
          <section class="messages-layout inbox-layout">
            <aside class="conversation-list inbox-sidebar">
              <div class="sidebar-title-row">
                <button type="button" class="tenant-mobile-menu" aria-label="Open tenant menu" aria-expanded="false">
                  <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path></svg>
                </button>
                <h1>Chats</h1>
              </div>
              <label class="messages-search" aria-label="Search conversations">
                <span>⌕</span>
                <input type="search" placeholder="Search conversations..." />
              </label>
              <div class="conversation-filters" role="group" aria-label="Conversation filters">
                <button type="button" class="filter-button active" data-filter="all">All</button>
                <button type="button" class="filter-button" data-filter="unread">Unread</button>
              </div>
              <div class="conversations conversation-list"></div>
            </aside>

            <section class="thread chat-pane">
              <div class="thread-header chat-header">
                <button class="mobile-back" type="button" aria-label="Back to conversations">←</button>
                <div class="contact-meta">
                  <div id="conversation-avatar" class="avatar-chip large">T</div>
                  <div class="header-copy">
                    <h2>Select a conversation</h2>
                    <span class="property-tag">Property details will appear here.</span>
                  </div>
                </div>
                <div class="chat-actions">
                  <button class="icon-button video-call-button" type="button" aria-label="Start video call" title="Start video call">📹</button>
                  <button class="icon-button profile-button" type="button" aria-label="View participant profile" title="View participant profile">👤</button>
                </div>
              </div>

              <div id="property-context-card" class="property-context-card hidden"></div>

              <div class="message-list messages">
                <p class="empty-state">Choose a conversation to view messages.</p>
              </div>

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
                      <label class="sr-only" for="message-text">Message</label>
                      <textarea id="message-text" maxlength="2000" placeholder="Type a message..." rows="1"></textarea>
                    </div>
                  </div>

                  <button type="submit" aria-label="Send message">
                    <i class="bi bi-send"></i>
                  </button>
                </div>
              </form>
            </section>
          </section>
        </section>
      </main>
    </div>
  `;

  const state = { selected: null, conversations: [], propertyDetails: {}, filter: 'all' };
  const status = root.querySelector('.status');
  const conversations = root.querySelector('.conversations');
  const list = root.querySelector('.message-list');
  const form = root.querySelector('.composer');
  const heading = root.querySelector('.thread-header h2');
  const propertyTag = root.querySelector('.property-tag');
  const conversationAvatar = root.querySelector('#conversation-avatar');
  const propertyContextCard = root.querySelector('#property-context-card');
  const searchInput = root.querySelector('.messages-search input');
  const imageInput = form.querySelector('.image-input');
  const attachmentStrip = form.querySelector('.attachment-strip');
  const attachmentPreview = form.querySelector('.attachment-preview');
  const removeAttachmentButton = form.querySelector('.remove-attachment');
  const mobileBackButton = root.querySelector('.mobile-back');
  const videoCallButton = root.querySelector('.video-call-button');
  const profileButton = root.querySelector('.profile-button');
  const propertyId = getSearchParam('propertyId');
  let pendingImage = '';

  const propertyFor = (conversation = {}) => {
    const key = String(conversation.property_id ?? '');
    return key ? state.propertyDetails[key] : null;
  };

  const fetchPropertyDetails = async (propertyIdValue) => {
    if (!propertyIdValue || state.propertyDetails[String(propertyIdValue)]) {
      return state.propertyDetails[String(propertyIdValue)] ?? null;
    }

    try {
      const response = await fetch(`${API_URL}/properties/${encodeURIComponent(propertyIdValue)}`, { headers: headers() });
      const body = await response.json();
      if (!response.ok || !body.data) return null;
      state.propertyDetails[String(propertyIdValue)] = body.data;
      return body.data;
    } catch {
      return null;
    }
  };

  const renderPropertyContextCard = () => {
    const conversation = state.selected;
    if (!conversation) {
      propertyContextCard.classList.add('hidden');
      propertyContextCard.innerHTML = '';
      return;
    }

    const property = propertyFor(conversation);
    if (!property) {
      propertyContextCard.classList.add('hidden');
      propertyContextCard.innerHTML = '';
      return;
    }

    const locationText = [property.city, property.barangay, property.address].filter(Boolean).join(' • ') || 'Location available';
    const rentText = Number(property.monthly_rent ?? 0) ? `PHP ${Number(property.monthly_rent).toLocaleString('en-PH')} / month` : 'Rent details available';

    propertyContextCard.classList.remove('hidden');
    propertyContextCard.innerHTML = `
      <div class="property-context-identity">
        <span class="property-context-icon">🏠</span>
        <div>
          <strong>${escape(property.title || 'Property')}</strong>
          <small>${escape(locationText)}</small>
        </div>
      </div>
      <div class="property-context-meta">
        <span>${escape(rentText)}</span>
        <button type="button" class="property-context-link" data-property-action="view">View Property</button>
      </div>
    `;
    propertyContextCard.querySelector('[data-property-action="view"]')?.addEventListener('click', () => openPropertyDetails(property));
  };

  const renderThreadHeader = () => {
    if (!state.selected) {
      heading.textContent = 'Select a conversation';
      propertyTag.textContent = 'Property details will appear here.';
      if (conversationAvatar) conversationAvatar.innerHTML = 'T';
      propertyContextCard.classList.add('hidden');
      propertyContextCard.innerHTML = '';
      return;
    }

    const conversationName = state.selected.participant_name ?? 'Conversation';
    const property = propertyFor(state.selected);
    heading.textContent = conversationName;
    propertyTag.textContent = property ? `Property inquiry • ${property.title || 'Property'}` : 'Property inquiry';
    if (conversationAvatar) conversationAvatar.innerHTML = participantAvatar(state.selected);
    renderPropertyContextCard();
  };

  const renderThreads = () => {
    const filterMode = state.filter ?? 'all';
    const filtered = state.conversations.filter((item) => {
      const matchesFilter = filterMode === 'all' || Number(item.unread_count ?? 0) > 0;
      if (!matchesFilter) return false;

      const searchTerm = searchInput?.value?.trim().toLowerCase() ?? '';
      if (!searchTerm) return true;

      const propertyTitle = propertyFor(item)?.title ?? '';
      const haystack = `${item.participant_name ?? ''} ${propertyTitle} ${item.last_message ?? ''}`.toLowerCase();
      return haystack.includes(searchTerm);
    });

    root.querySelectorAll('.filter-button').forEach((button) => {
      const isActive = (button.dataset.filter ?? 'all') === filterMode;
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });

    conversations.innerHTML = filtered.length
      ? filtered.map((item) => {
          const property = propertyFor(item);
          const unreadCount = Number(item.unread_count ?? 0);
          return `
            <button class="conversation-item ${state.selected?.id === item.id ? 'active' : ''} ${unreadCount ? 'is-unread' : ''}" data-id="${item.id}" type="button">
              <div class="avatar-chip">${participantAvatar(item)}</div>
              <div class="conversation-main">
                <div class="conversation-head">
                  <strong>${escape(item.participant_name ?? 'Conversation')}</strong>
                  <time>${escape(formatConversationTime(item.updated_at))}</time>
                </div>
                <div class="conversation-meta">
                  <span class="conversation-subtitle">${escape(property?.title || 'Property inquiry')}</span>
                  <span class="preview">${escape(item.last_message ?? 'No messages yet')}</span>
                </div>
              </div>
              ${unreadCount ? `<span class="unread-pill">${unreadCount > 9 ? '9+' : unreadCount}</span>` : ''}
            </button>
          `;
        }).join('')
      : '<p class="empty-state">No conversations found.</p>';

    conversations.querySelectorAll('.conversation-item').forEach((button) => {
      button.addEventListener('click', () => {
        const conversationId = button.dataset.id;
        if (!conversationId) return;
        state.selected = state.conversations.find((item) => String(item.id) === String(conversationId)) ?? null;
        renderThreads();
        select(conversationId);
      });
    });
  };

  const syncMobileView = () => {
    const page = root.querySelector('.messages-page');
    if (!page) return;
    const shouldOpenThread = window.innerWidth <= 650 && !!state.selected;
    page.classList.toggle('thread-open', shouldOpenThread);
  };

  const select = async (id) => {
    if (!id) {
      if (!state.selected) return;
      await fetchPropertyDetails(state.selected.property_id);
      renderThreadHeader();
      list.innerHTML = '<p class="empty-state">Send a message to start the conversation.</p>';
      form.hidden = false;
      syncMobileView();
      return;
    }

    try {
      const response = await fetch(`${API_URL}/messages/conversations/${id}`, { headers: headers() });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || 'Unable to load conversation history.');

      state.selected = state.conversations.find((item) => String(item.id) === String(id)) ?? null;
      if (!state.selected) return;

      await fetchPropertyDetails(state.selected.property_id);
      renderThreadHeader();

      list.innerHTML = (Array.isArray(body.data) ? body.data : []).map((item) => {
        const isMine = item.sender_id === currentUser().id;
        return `
          <article class="message ${isMine ? 'is-mine' : ''}">
            <div class="bubble-body">${renderMessageBody(item.body)}</div>
            <time>${escape(formatMessageTime(item.created_at))}</time>
          </article>
        `;
      }).join('') || '<p class="empty-state">Start the conversation.</p>';

      list.querySelectorAll('.message-attachment img').forEach((img) => {
        img.style.cursor = 'pointer';
        img.addEventListener('click', () => openPhotoViewer(img.src));
      });

      list.querySelectorAll('.booking-card-link').forEach((button) => {
        button.addEventListener('click', () => {
          window.location.hash = '#/tenant/booking';
        });
      });

      form.hidden = false;
      renderThreads();
      syncMobileView();
      requestAnimationFrame(() => {
        list.scrollTop = list.scrollHeight;
      });
    } catch (error) {
      list.innerHTML = `<p class="empty-state">${escape(error.message)}</p>`;
    }
  };

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

  const createOrSelectConversationForProperty = async (propertyIdValue) => {
    if (!propertyIdValue) return null;
    const matching = state.conversations.find((item) => String(item.property_id) === String(propertyIdValue));
    if (matching) return matching;

    const property = await fetchPropertyDetails(propertyIdValue);
    return {
      id: null,
      property_id: propertyIdValue,
      participant_name: property?.owner_name || 'Property Owner',
      participant_avatar_url: property?.owner_avatar_url || property?.owner_avatar || ''
    };
  };

  const openConversation = async (conversation) => {
    if (!conversation) return;
    state.selected = conversation;
    renderThreads();
    await select(conversation.id);
  };

  const refreshConversationList = async (selectedId) => {
    const response = await fetch(`${API_URL}/messages/conversations`, { headers: headers() });
    const body = await response.json();
    if (!response.ok) throw new Error(body.message || 'Unable to refresh conversations.');

    state.conversations = Array.isArray(body.data) ? body.data : [];
    await Promise.all(state.conversations.map(async (item) => {
      if (item.property_id) await fetchPropertyDetails(item.property_id);
    }));
    state.selected = state.conversations.find((item) => String(item.id) === String(selectedId)) ?? null;
    renderThreads();
    renderThreadHeader();
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
      if (!state.selected.id) {
        const response = await fetch(`${API_URL}/messages/conversations`, {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify({ propertyId: state.selected.property_id })
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.message ?? 'Unable to start a chat with the property owner.');
        state.selected = { ...state.selected, ...body.data };
        state.conversations.unshift(body.data);
        renderThreads();
        renderThreadHeader();
      }

      if (hasImage) {
        const response = await fetch(`${API_URL}/messages`, {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify({ conversationId: state.selected.id, body: pendingImage })
        });
        if (!response.ok) {
          const body = await response.json();
          throw new Error(body.message ?? 'Image could not be sent.');
        }
      }

      if (hasText) {
        const response = await fetch(`${API_URL}/messages`, {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify({ conversationId: state.selected.id, body: textMessage })
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.message ?? 'Message could not be sent.');
      }

      textarea.value = '';
      clearPendingImage();
      await refreshConversationList(state.selected.id);
      await select(state.selected.id);
    } catch (error) {
      status.textContent = error.message;
    }
  });

  form.querySelector('textarea').addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      form.dispatchEvent(new Event('submit'));
    }
  });

  root.querySelector('.logout')?.addEventListener('click', () => {
    localStorage.clear();
    location.assign('#/login');
  });

  root.querySelectorAll('.filter-button').forEach((button) => {
    button.addEventListener('click', () => {
      const nextFilter = button.dataset.filter ?? 'all';
      state.filter = nextFilter;
      renderThreads();
    });
  });

  const syncTenantProfileChip = async () => {
    const user = await refreshTenantUserSession();
    const fullName = tenantFullName(user);
    const avatarWrap = root.querySelector('.tenant-avatar');
    const nameEl = root.querySelector('.tenant-name');
    if (!avatarWrap || !nameEl) return;

    const avatarUrl = getUserAvatarUrl(user, fullName);
    const initials = (fullName || 'T').split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'T';
    avatarWrap.innerHTML = user.avatar_url ? `<img src="${escape(avatarUrl)}" alt="${escape(fullName)} avatar" />` : `<span class="tenant-initials">${escape(initials)}</span>`;
    nameEl.textContent = fullName;
  };

  syncTenantProfileChip();
  window.addEventListener('dormhive-user-updated', syncTenantProfileChip);
  const syncConversationSearch = (source) => {
    renderThreads();
  };
  searchInput?.addEventListener('input', () => syncConversationSearch(searchInput));

  mobileBackButton?.addEventListener('click', () => {
    state.selected = null;
    renderThreadHeader();
    renderThreads();
    syncMobileView();
  });

  videoCallButton?.addEventListener('click', () => {
    if (!state.selected) {
      status.textContent = 'Select a conversation first.';
      return;
    }
    const roomName = `DormHive-conversation-${encodeURIComponent(String(state.selected.id))}`;
    const callWindow = window.open(`https://meet.jit.si/${roomName}`, '_blank', 'noopener,noreferrer');
    if (!callWindow) status.textContent = 'Allow pop-ups to open the video call in a new tab.';
  });

  profileButton?.addEventListener('click', () => {
    if (!state.selected) {
      status.textContent = 'Select a conversation first.';
      return;
    }
    openParticipantProfile(state.selected, propertyFor(state.selected));
  });

  window.addEventListener('resize', syncMobileView);

  fetch(`${API_URL}/messages/conversations`, { headers: headers() })
    .then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.message);

      state.conversations = Array.isArray(body.data) ? body.data : [];
      await Promise.all(state.conversations.map(async (item) => {
        if (item.property_id) await fetchPropertyDetails(item.property_id);
      }));

      renderThreads();
      renderThreadHeader();

      if (propertyId) {
        createOrSelectConversationForProperty(propertyId)
          .then(openConversation)
          .catch((error) => { status.textContent = error.message; });
      } else if (state.conversations[0]) {
        select(state.conversations[0].id);
      }

      syncMobileView();
    })
    .catch((error) => { status.textContent = error.message; });
}
