import { ensureTenantSidebarStyles, renderTenantSidebar } from './sidebarTenant.js';
import { getUserAvatarUrl, refreshTenantUserSession } from './setting.js';

const API_URL = window.DORMHIVE_API_URL ?? 'http://localhost:5000/api/v1';
const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('dormhive.accessToken') ?? ''}` });
function dashboardStyle() { if (!document.querySelector('[data-tenant-style="dashboard"]')) { const tag = document.createElement('link'); tag.rel = 'stylesheet'; tag.href = new URL('./style/dashboardTenant.css', import.meta.url); tag.dataset.tenantStyle = 'dashboard'; document.head.append(tag); } }
function style() { if (!document.querySelector('[data-tenant-style="message"]')) { const tag = document.createElement('link'); tag.rel = 'stylesheet'; tag.href = new URL('./style/message.css', import.meta.url); tag.dataset.tenantStyle = 'message'; document.head.append(tag); } }
const escape = (value = '') => { const node = document.createElement('span'); node.textContent = value; return node.innerHTML; };
const isImageDataUrl = (value = '') => typeof value === 'string' && /^data:image\//i.test(value.trim());
const renderMessageBody = (value = '') => {
  const text = String(value ?? '');
  if (isImageDataUrl(text)) {
    return `<div class="message-attachment"><img src="${text}" alt="Sent image" /></div>`;
  }
  return escape(text || 'No message text.');
};
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
const currentUser = () => { try { return JSON.parse(localStorage.getItem('dormhive.user') ?? '{}'); } catch { return {}; } };
const participantAvatar = (item = {}) => item.participant_avatar_url ? `<img src="${escape(getUserAvatarUrl({ avatar_url: item.participant_avatar_url }, item.participant_name ?? 'Conversation'))}" alt="${escape(item.participant_name ?? 'Conversation')} avatar" />` : escape((item.participant_name ?? 'C').split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase());

export function renderMessage(root = document.querySelector('#app')) {
  if (!root) throw new Error('Messages page requires #app.');
  dashboardStyle();
  ensureTenantSidebarStyles();
  style();
  root.innerHTML = `<div class="dh-app">${renderTenantSidebar('message')}<main class="tenant-page-main"><section class="messages-page"><header class="owner-topbar"><div class="topbar-left"></div><label class="search-bar" aria-label="Search conversations"><span>⌕</span><input type="search" placeholder="Search my listings, inquiries, tenants..." /></label><div class="topbar-right"><a class="brand" href="#/tenant/dashboardTenant">DormHive</a><div class="tenant-profile-chip" aria-label="Tenant profile"><span class="tenant-avatar"></span><span class="tenant-name">Tenant</span></div></div></header><section class="messages-layout inbox-layout"><aside class="conversation-list inbox-sidebar"><div class="sidebar-title-row"><h1>Inbox</h1></div><p class="status" role="status">Loading conversations…</p><div class="conversations conversation-list"></div></aside><section class="thread chat-pane"><div class="thread-header chat-header"><div class="contact-meta"><div id="conversation-avatar" class="avatar-chip large">T</div><div><h2>Select a conversation</h2><span class="property-tag">Property details will appear here.</span></div></div><div class="chat-actions"><button class="icon-button" type="button" aria-label="Video call">📹</button><button class="icon-button" type="button" aria-label="Profile">👤</button></div></div><div class="message-list messages"><p class="empty-state">Choose a conversation to view messages.</p></div><form class="composer" hidden><div class="composer-tools"><label class="upload-button" title="Send a photo" aria-label="Send a photo"><input class="image-input" type="file" accept="image/*" hidden><span>＋</span></label><div class="composer-input-wrapper"><div class="attachment-strip hidden"><div class="attachment-item"><img class="attachment-preview" src="" alt="Selected attachment preview"><button type="button" class="remove-attachment" aria-label="Remove selected photo">×</button></div></div><label class="sr-only" for="message-text">Message</label><textarea id="message-text" placeholder="Type your message here..." maxlength="2000"></textarea></div><button type="submit">Send</button></div></form></section></section></section></main></div>`;
  root.querySelector('.logout').addEventListener('click', () => { localStorage.clear(); location.assign('#/login'); });

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

  const state = { selected: null, conversations: [] };
  const status = root.querySelector('.status');
  const conversations = root.querySelector('.conversations');
  const list = root.querySelector('.message-list');
  const form = root.querySelector('.composer');
  const heading = root.querySelector('.thread-header h2');
  const conversationAvatar = root.querySelector('#conversation-avatar');
  const imageInput = form.querySelector('.image-input');
  const attachmentStrip = form.querySelector('.attachment-strip');
  const attachmentPreview = form.querySelector('.attachment-preview');
  const removeAttachmentButton = form.querySelector('.remove-attachment');
  const propertyId = getSearchParam('propertyId');
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

  const renderThreads = () => {
    conversations.innerHTML = state.conversations.length
      ? state.conversations.map((item) => `<button class="conversation conversation-item ${state.selected?.id === item.id ? 'is-active active' : ''}" data-id="${item.id}"><div class="avatar-chip">${participantAvatar(item)}</div><div class="conversation-main"><div class="conversation-head"><strong>${escape(item.participant_name ?? 'Conversation')}</strong></div><div class="conversation-meta"><span>Conversation</span><span class="preview">${escape(item.last_message ?? 'No messages yet')}</span></div></div></button>`).join('')
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
      if (conversationAvatar && state.selected) conversationAvatar.innerHTML = participantAvatar(state.selected);
      list.innerHTML = body.data.map((item) => `<article class="message ${item.sender_id === currentUser().id ? 'is-mine' : ''}"><div class="bubble-body">${renderMessageBody(item.body)}</div><time>${new Date(item.created_at).toLocaleString()}</time></article>`).join('') || '<p class="empty-state">Start the conversation.</p>';
      list.querySelectorAll('.message-attachment img').forEach((img) => { img.style.cursor = 'pointer'; img.addEventListener('click', () => openPhotoViewer(img.src)); });
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

  const openPhotoViewer = (imageDataUrl) => {
    const modal = document.createElement('div');
    modal.className = 'photo-viewer-modal';
    modal.innerHTML = `<div class="photo-viewer-backdrop"></div><div class="photo-viewer-content"><button class="photo-viewer-close" aria-label="Close photo">×</button><img src="${imageDataUrl}" alt="Message photo" class="photo-viewer-image" /></div>`;
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
      if (hasImage) {
        await fetch(`${API_URL}/messages`, { method: 'POST', headers: headers(), body: JSON.stringify({ conversationId: state.selected.id, body: pendingImage }) });
      }
      if (hasText) {
        const response = await fetch(`${API_URL}/messages`, { method: 'POST', headers: headers(), body: JSON.stringify({ conversationId: state.selected.id, body: textMessage }) });
        const body = await response.json();
        if (!response.ok) throw new Error(body.message ?? 'Message could not be sent.');
      }
      textarea.value = '';
      clearPendingImage();
      select(state.selected.id);
    } catch (error) { status.textContent = error.message; }
  });

  form.querySelector('textarea').addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      form.dispatchEvent(new Event('submit'));
    }
  });

  fetch(`${API_URL}/messages/conversations`, { headers: headers() }).then(async (response) => {
    const body = await response.json();
    if (!response.ok) throw new Error(body.message);
    state.conversations = body.data;
    status.textContent = `${body.data.length} conversation${body.data.length === 1 ? '' : 's'}`;
    renderThreads();
    if (propertyId) {
      createOrSelectConversationForProperty(propertyId).then(openConversation).catch((error) => { status.textContent = error.message; });
    } else if (state.conversations[0]) {
      select(state.conversations[0].id);
    }
  }).catch((error) => { status.textContent = error.message; });
}


