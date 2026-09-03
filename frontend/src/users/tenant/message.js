import { ensureTenantSidebarStyles, renderTenantSidebar } from './sidebarTenant.js';
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

function dashboardStyle() {
  if (!document.querySelector('[data-tenant-style="dashboard"]')) {
    const tag = document.createElement('link');
    tag.rel = 'stylesheet';
    tag.href = new URL('./style/dashboardTenant.css', import.meta.url);
    tag.dataset.tenantStyle = 'dashboard';
    document.head.append(tag);
  }
}

function style() {
  const existing = document.querySelector('[data-tenant-style="message"]');
  const stylesheetUrl = new URL('./style/message.css', import.meta.url);
  stylesheetUrl.searchParams.set('routeRefresh', String(Date.now()));

  if (existing) {
    existing.href = stylesheetUrl.href;
    return;
  }

  {
    const tag = document.createElement('link');
    tag.rel = 'stylesheet';
    tag.href = stylesheetUrl.href;
    tag.dataset.tenantStyle = 'message';
    document.head.append(tag);
  }
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
  const image = resolveImageUrl(property.image_url || property.cover_image || (Array.isArray(propertyImages) ? propertyImages[0] : ''));
  const location = [property.address, property.barangay, property.municipality, property.city].filter(Boolean).join(', ') || 'Not specified';
  const amenities = Array.isArray(property.amenities)
    ? property.amenities.join(', ')
    : String(property.amenities ?? '').replace(/[\[\]"']/g, '').replace(/,/g, ', ');
  const modal = createModal({ title: property.title || 'Property Details', content: '', closeLabel: 'Close' });
  modal.querySelector('.ui-modal__body').innerHTML = `
    <div class="message-property-details">
      ${image ? `<img class="message-property-image" src="${escape(image)}" alt="${escape(property.title || 'Property')} photo" />` : ''}
      <div class="message-property-copy">
        <div class="message-property-heading">
          <h3>${escape(property.title || 'Property')}</h3>
          <strong>${Number(property.monthly_rent ?? 0) ? `PHP ${Number(property.monthly_rent).toLocaleString('en-PH')}` : 'Rent not specified'} / month</strong>
        </div>
        <div class="message-property-grid">
          <p><span>Location</span><strong>${escape(location)}</strong></p>
          <p><span>Room type</span><strong>${escape(property.room_type || 'Not specified')}</strong></p>
          <p><span>Occupancy</span><strong>${escape(property.max_occupants ? `Up to ${property.max_occupants} tenants` : 'Not specified')}</strong></p>
          <p><span>Available slots</span><strong>${escape(property.available_slots ?? 'Not specified')}</strong></p>
          <p><span>Gender preference</span><strong>${escape(property.gender_preference || 'Not specified')}</strong></p>
          <p><span>Owner</span><strong>${escape(property.owner_name || 'Not specified')}</strong></p>
        </div>
        <p class="message-property-description">${escape(property.description || 'No description provided.')}</p>
        <p class="message-property-amenities"><span>Amenities</span><strong>${escape(amenities || 'None listed')}</strong></p>
      </div>
    </div>
  `;
  openModal(modal);
};

const openParticipantProfile = (conversation, property) => {
  if (!conversation) return;
  const name = conversation.participant_name || 'Conversation participant';
  const modal = createModal({ title: name, content: '', closeLabel: 'Close' });
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
  dashboardStyle();
  await ensureTenantSidebarStyles();
  style();

  root.innerHTML = `
    <div class="dh-app">
      ${renderTenantSidebar('message')}
      <main class="tenant-page-main">
        <section class="messages-page">
          <section class="messages-layout inbox-layout">
            <aside class="conversation-list inbox-sidebar">
              <div class="sidebar-title-row">
                <h1>Messages</h1>
                <span class="unread-banner">0 unread</span>
              </div>
              <label class="messages-search" aria-label="Search conversations">
                <span>⌕</span>
                <input type="search" placeholder="Search conversations..." />
              </label>
              <p class="status" role="status">Loading conversations…</p>
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
                  <label class="upload-button" title="Send a photo" aria-label="Send a photo">
                    <input class="image-input" type="file" accept="image/*" hidden>
                    <span>＋</span>
                  </label>

                  <div class="composer-input-wrapper">
                    <div class="attachment-strip hidden">
                      <div class="attachment-item">
                        <img class="attachment-preview" src="" alt="Selected attachment preview">
                        <button type="button" class="remove-attachment" aria-label="Remove selected photo">×</button>
                      </div>
                    </div>
                    <label class="sr-only" for="message-text">Message</label>
                    <textarea id="message-text" maxlength="2000" placeholder="Type a message..." rows="1"></textarea>
                  </div>

                  <button type="submit">Send</button>
                </div>
              </form>
            </section>
          </section>
        </section>
      </main>
    </div>
  `;

  const state = { selected: null, conversations: [], propertyDetails: {} };
  const status = root.querySelector('.status');
  const unreadBanner = root.querySelector('.unread-banner');
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
    const filtered = state.conversations.filter((item) => {
      const searchTerm = searchInput?.value?.trim().toLowerCase() ?? '';
      if (!searchTerm) return true;

      const propertyTitle = propertyFor(item)?.title ?? '';
      const haystack = `${item.participant_name ?? ''} ${propertyTitle} ${item.last_message ?? ''}`.toLowerCase();
      return haystack.includes(searchTerm);
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

    const totalUnread = state.conversations.reduce((sum, item) => sum + Number(item.unread_count ?? 0), 0);
    unreadBanner.textContent = `${totalUnread} unread`;
    unreadBanner.classList.toggle('is-empty', totalUnread === 0);

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
      status.textContent = `${state.conversations.length} conversation${state.conversations.length === 1 ? '' : 's'}`;

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
