import { ensureOwnerSidebarStyles, loadOwnerStylesheet, renderOwnerSidebar, updateListingCountsInSidebar } from './sidebarOwner.js';
import { createModal, openModal } from '../../components/modal.js';
import { withMediaAccessToken } from '../../services/mediaAccess.js';

const API = window.DORMHIVE_API_URL ?? 'http://localhost:5000/api/v1';
const API_ORIGIN = API.replace(/\/api\/v1\/?$/, '');
const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('dormhive.accessToken') ?? ''}` });
const esc = (value = '') => { const span = document.createElement('span'); span.textContent = value; return span.innerHTML; };
const user = () => { try { return JSON.parse(localStorage.getItem('dormhive.user') ?? '{}'); } catch { return {}; } };
const initials = (value = '') => value.split(' ').filter(Boolean).map((part) => part[0]).slice(0, 2).join('').toUpperCase() || 'U';
const dayTime = (value) => new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(value));
const shortDate = (value) => new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(value));
const isImageDataUrl = (value = '') => typeof value === 'string' && /^data:image\//i.test(value.trim());
const messagePhotoUrl = (message = {}) => {
  const body = String(message.body ?? '').trim();
  if (message.attachment_url) {
    const attachment = String(message.attachment_url).trim();
    const url = /^(data:|blob:|https?:\/\/)/i.test(attachment)
      ? attachment
      : `${API_ORIGIN}${attachment.startsWith('/') ? '' : '/'}${attachment}`;
    return withMediaAccessToken(url);
  }
  return isImageDataUrl(body) ? body : '';
};
const isPhotoOnlyMessage = (message = {}) => {
  const body = String(message.body ?? '').trim();
  return Boolean(messagePhotoUrl(message)) && (!body || isImageDataUrl(body));
};
const renderPhotoMessageGroup = (photoMessages, isMine, otherName) => {
  const photoUrls = photoMessages.map(messagePhotoUrl).filter(Boolean);
  const senderName = isMine ? 'You' : otherName || 'Tenant';
  const visiblePhotos = photoUrls.slice(0, 4);
  const additionalCount = photoUrls.length - visiblePhotos.length;
  const stacked = photoUrls.length >= 2;
  const moreBadgeIndex = stacked ? 0 : 3;
  return `
    <div class="message-photo-group${stacked ? ' message-photo-group--stack' : ''}">
      <div class="message-photo-group__label">${esc(`${senderName} sent ${photoUrls.length} photos`)}</div>
      <div class="message-photo-group__grid">
        ${visiblePhotos.map((photo, index) => `
          <button type="button" class="message-photo-group__tile${additionalCount && index === moreBadgeIndex ? ' has-more' : ''}" data-photo-index="${index}" aria-label="View photo ${index + 1} of ${photoUrls.length}">
            <img src="${esc(photo)}" alt="Photo ${index + 1}" />
            ${additionalCount && index === moreBadgeIndex ? `<span>+${additionalCount}</span>` : ''}
          </button>`).join('')}
      </div>
    </div>`;
};
const renderMessageBody = (value = '', attachmentUrl = '') => {
  const text = String(value ?? '');
  if (attachmentUrl) {
    return `<div class="message-attachment"><img src="${esc(withMediaAccessToken(`${API_ORIGIN}${attachmentUrl}`))}" alt="Sent image" /></div>${text ? `<p>${esc(text)}</p>` : ''}`;
  }
  if (isImageDataUrl(text)) {
    return `<div class="message-attachment"><img src="${text}" alt="Sent image" /></div>`;
  }
  return esc(text || 'No message text.');
};
const avatarUrl = (value = '') => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^(data:|blob:|https?:\/\/)/i.test(raw)) return raw;
  return withMediaAccessToken(`${API_ORIGIN}${raw.startsWith('/') ? '' : '/'}${raw}`);
};
const renderAvatar = (name = 'User', image = '') => {
  const source = avatarUrl(image);
  return source
    ? `<img src="${esc(source)}" alt="${esc(name)} avatar" onerror="this.replaceWith(document.createTextNode('${esc(initials(name))}'))" />`
    : esc(initials(name));
};
const participantAvatar = (item = {}) => renderAvatar(item.participant_name ?? 'Conversation', item.participant_avatar_url);

function css() {
  return loadOwnerStylesheet('message', new URL('./style/message.css', import.meta.url));
}

export async function renderMessage(root = document.querySelector('#app')) {
  if (!root) throw new Error('Owner messages page requires #app.');
  await Promise.all([css(), ensureOwnerSidebarStyles()]);

  root.innerHTML = `
    <div class="owner-shell">
      ${renderOwnerSidebar('message')}
      <div class="owner-main">
        <main class="owner-inbox-page">
          <section class="inbox-layout">
            <aside class="inbox-sidebar">
              <div class="sidebar-title-row">
                <h1>Chats</h1>
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
                    <div class="attachment-strip hidden"></div>
                    <div class="composer-inline-input">
                      <label class="upload-button" title="Send a photo" aria-label="Send a photo">
                        <input class="image-input" type="file" accept="image/*" multiple hidden>
                        <span>＋</span>
                      </label>
                      <textarea rows="1" maxlength="2000" placeholder="Type your message here..."></textarea>
                    </div>
                  </div>
                  <button type="submit" aria-label="Send message">
                    <i class="bi bi-send"></i>
                  </button>
                </div>
              </form>
            </section>
          </section>
        </main>
      </div>
    </div>`;

  const mobileMenu = root.querySelector('.owner-mobile-menu');
  const chatsTitle = root.querySelector('.sidebar-title-row h1');
  if (mobileMenu && chatsTitle) chatsTitle.before(mobileMenu);

  const state = { conversations: [], selected: null, properties: [], bookings: [], filter: 'all', sending: false };
  const list = root.querySelector('.conversation-list');
  const messages = root.querySelector('.messages');
  const form = root.querySelector('.composer');
  const status = root.querySelector('.status');
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
  const pendingImages = [];

  const renderPendingImages = () => {
    attachmentStrip.innerHTML = pendingImages.map((item, index) => `
      <div class="attachment-item" data-pending-index="${index}">
        <img src="${esc(item.previewUrl)}" alt="Selected photo ${index + 1}">
        <button type="button" class="remove-attachment" data-pending-index="${index}" aria-label="Remove selected photo ${index + 1}">×</button>
      </div>`).join('');
    attachmentStrip.classList.toggle('hidden', pendingImages.length === 0);
  };

  const clearPendingImages = () => {
    pendingImages.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    pendingImages.length = 0;
    imageInput.value = '';
    renderPendingImages();
  };

  attachmentStrip.addEventListener('click', (event) => {
    const removeButton = event.target.closest('.remove-attachment');
    if (!removeButton) return;
    const [removedImage] = pendingImages.splice(Number(removeButton.dataset.pendingIndex), 1);
    if (removedImage) URL.revokeObjectURL(removedImage.previewUrl);
    renderPendingImages();
  });

  imageInput.addEventListener('change', (event) => {
    const files = Array.from(event.target.files ?? []);
    imageInput.value = '';
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const invalidFile = files.find((file) => !validTypes.includes(file.type) || file.size > 2 * 1024 * 1024);
    if (invalidFile) status.textContent = 'Choose image files under 2 MB each.';
    files.filter((file) => validTypes.includes(file.type) && file.size <= 2 * 1024 * 1024).forEach((file) => {
      const duplicate = pendingImages.some((item) => item.file.name === file.name && item.file.size === file.size && item.file.lastModified === file.lastModified);
      if (!duplicate) pendingImages.push({ file, previewUrl: URL.createObjectURL(file) });
    });
    renderPendingImages();
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

  const groupConversationMessages = (items = []) => {
    const groupedMessages = [];
    for (let index = 0; index < items.length;) {
      const message = items[index];
      if (!isPhotoOnlyMessage(message)) {
        groupedMessages.push({ message });
        index += 1;
        continue;
      }
      const photoMessages = [message];
      const photoBatchId = message.photo_batch_id ?? null;
      while (index + photoMessages.length < items.length) {
        const nextMessage = items[index + photoMessages.length];
        const nextBatchId = nextMessage.photo_batch_id ?? null;
        const sameBatch = photoBatchId && nextBatchId
          ? String(photoBatchId) === String(nextBatchId)
          : !photoBatchId && !nextBatchId && String(message.created_at) === String(nextMessage.created_at);
        if (String(nextMessage.sender_id) !== String(message.sender_id) || !isPhotoOnlyMessage(nextMessage) || !sameBatch) break;
        photoMessages.push(nextMessage);
      }
      groupedMessages.push(photoMessages.length > 1 ? { photoMessages } : { message });
      index += photoMessages.length;
    }
    return groupedMessages;
  };

  const renderConversationMessages = (groupedMessages) => {
        return groupedMessages.map((entry) => {
          if (entry.photoMessages) {
            const photoMessages = entry.photoMessages;
            const isMine = String(photoMessages[0].sender_id) === String(user().id);
            const lastMessage = photoMessages[photoMessages.length - 1];
            return `
              <article class="message-bubble message-photo-group-bubble ${isMine ? 'mine' : 'their'}">
                <div class="bubble-body">${renderPhotoMessageGroup(photoMessages, isMine, state.selected.participant_name)}</div>
                <small>${esc(shortDate(lastMessage.created_at))} • ${esc(dayTime(lastMessage.created_at))}</small>
              </article>`;
          }
          const message = entry.message;
          const isMine = String(message.sender_id) === String(user().id);
          return `
            <article class="message-bubble ${isMine ? 'mine' : 'their'}">
              <div class="bubble-body">${isBookingMessage(message.body) ? renderBookingCard(message.body, state.selected) : renderMessageBody(message.body, message.attachment_url)}</div>
              <small>${esc(shortDate(message.created_at))} • ${esc(dayTime(message.created_at))}</small>
            </article>`;
        }).join('');
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
      modal.classList.add('owner-message-modal');
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

      const conversationMessages = Array.isArray(body.data) ? body.data : [];
      const groupedMessages = groupConversationMessages(conversationMessages);
      messages.innerHTML = renderConversationMessages(groupedMessages) || '<p class="empty">Start a conversation.</p>';
      const photoGroupEntries = groupedMessages.filter((entry) => entry.photoMessages);
      messages.querySelectorAll('.message-photo-group').forEach((group, index) => {
        group.photoUrls = photoGroupEntries[index]?.photoMessages.map(messagePhotoUrl).filter(Boolean) ?? [];
        group.addEventListener('click', (event) => {
          if (event.target.closest('.message-photo-group__tile')) return;
          openPhotoViewer(group.photoUrls, 0);
        });
      });

      messages.querySelectorAll('.message-attachment img').forEach((img) => {
        img.style.cursor = 'pointer';
        img.addEventListener('click', () => openPhotoViewer([img.src]));
      });
      messages.querySelectorAll('.message-photo-group__tile').forEach((button) => {
        button.addEventListener('click', () => {
          const group = button.closest('.message-photo-group');
          openPhotoViewer(group?.photoUrls ?? [], Number(button.dataset.photoIndex));
        });
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

  const openPhotoViewer = (imageUrls, startIndex = 0) => {
    const photos = (Array.isArray(imageUrls) ? imageUrls : [imageUrls]).filter(Boolean);
    if (!photos.length) return;
    let photoIndex = (startIndex + photos.length) % photos.length;
    const modal = document.createElement('dialog');
    modal.className = 'photo-viewer-modal';
    modal.setAttribute('aria-label', 'Message photos');
    modal.innerHTML = `
      <div class="photo-viewer-stage">
        <img alt="" class="photo-viewer-image" />
        <button type="button" class="photo-viewer-arrow photo-viewer-previous" aria-label="Previous photo" title="Previous photo"><i class="bi bi-chevron-left" aria-hidden="true"></i></button>
        <button type="button" class="photo-viewer-arrow photo-viewer-next" aria-label="Next photo" title="Next photo"><i class="bi bi-chevron-right" aria-hidden="true"></i></button>
        <div class="photo-viewer-actions">
          <button type="button" class="photo-viewer-action photo-viewer-download" aria-label="Download photo" title="Download photo"><i class="bi bi-download" aria-hidden="true"></i></button>
          <button type="button" class="photo-viewer-action photo-viewer-share" aria-label="Share photo" title="Share photo"><i class="bi bi-share" aria-hidden="true"></i></button>
          <button type="button" class="photo-viewer-action photo-viewer-close" aria-label="Close photo viewer" title="Close viewer"><i class="bi bi-x-lg" aria-hidden="true"></i></button>
        </div>
      </div>
      <nav class="photo-viewer-thumbnails" aria-label="Message photos"></nav>
    `;
    const image = modal.querySelector('.photo-viewer-image');
    const thumbnails = modal.querySelector('.photo-viewer-thumbnails');
    const thumbnailButtons = photos.map((photo, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'photo-viewer-thumbnail';
      button.dataset.photoIndex = String(index);
      button.setAttribute('aria-label', `View photo ${index + 1}`);
      const thumbnail = document.createElement('img');
      thumbnail.src = photo;
      thumbnail.alt = '';
      thumbnail.loading = 'eager';
      button.append(thumbnail);
      thumbnails.append(button);
      return button;
    });
    const previousButton = modal.querySelector('.photo-viewer-previous');
    const nextButton = modal.querySelector('.photo-viewer-next');
    const renderPhoto = (nextIndex = photoIndex) => {
      photoIndex = (nextIndex + photos.length) % photos.length;
      image.src = photos[photoIndex];
      image.alt = `Message photo ${photoIndex + 1} of ${photos.length}`;
      previousButton.hidden = photos.length < 2;
      nextButton.hidden = photos.length < 2;
      thumbnailButtons.forEach((button, index) => {
        const active = index === photoIndex;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-current', String(active));
      });
    };
    thumbnails.addEventListener('click', (event) => {
      const button = event.target.closest('.photo-viewer-thumbnail');
      if (button) renderPhoto(Number(button.dataset.photoIndex));
    });
    previousButton.addEventListener('click', () => renderPhoto(photoIndex - 1));
    nextButton.addEventListener('click', () => renderPhoto(photoIndex + 1));
    modal.querySelector('.photo-viewer-close').addEventListener('click', () => modal.close());
    modal.addEventListener('click', (event) => { if (event.target === modal) modal.close(); });
    modal.addEventListener('close', () => modal.remove(), { once: true });
    modal.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowLeft' && photos.length > 1) { event.preventDefault(); renderPhoto(photoIndex - 1); }
      if (event.key === 'ArrowRight' && photos.length > 1) { event.preventDefault(); renderPhoto(photoIndex + 1); }
    });
    modal.querySelector('.photo-viewer-download').addEventListener('click', async () => {
      try {
        const response = await fetch(photos[photoIndex]);
        if (!response.ok) throw new Error('Download failed');
        const objectUrl = URL.createObjectURL(await response.blob());
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = `message-photo-${photoIndex + 1}`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      } catch { window.open(photos[photoIndex], '_blank', 'noopener,noreferrer'); }
    });
    modal.querySelector('.photo-viewer-share').addEventListener('click', async () => {
      try {
        if (navigator.share) await navigator.share({ title: 'Message photo', url: photos[photoIndex] });
        else if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(photos[photoIndex]);
        else window.open(photos[photoIndex], '_blank', 'noopener,noreferrer');
      } catch (error) {
        if (error.name !== 'AbortError') window.open(photos[photoIndex], '_blank', 'noopener,noreferrer');
      }
    });
    document.body.appendChild(modal);
    renderPhoto();
    modal.showModal();
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const textarea = form.querySelector('textarea');
    if (!state.selected) return;

    const textMessage = textarea.value.trim();
    const hasImages = pendingImages.length > 0;
    const hasText = !!textMessage;

    if (!hasImages && !hasText) return;
    const photoBatchId = hasImages ? window.crypto.randomUUID() : null;

    try {
      state.sending = true;
      form.classList.add('is-sending');
      form.querySelector('button[type="submit"]').disabled = true;
      while (pendingImages.length) {
        const pendingImage = pendingImages[0];
        const imageForm = new FormData();
        imageForm.append('conversationId', state.selected.id);
        imageForm.append('photoBatchId', photoBatchId);
        imageForm.append('attachment', pendingImage.file);
        const response = await fetch(`${API}/messages`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${localStorage.getItem('dormhive.accessToken') ?? ''}` },
          body: imageForm
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.message ?? 'Image could not be sent.');
        URL.revokeObjectURL(pendingImage.previewUrl);
        pendingImages.shift();
        renderPendingImages();
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
      clearPendingImages();
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
    modal.classList.add('owner-message-modal');
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

  load();
}
