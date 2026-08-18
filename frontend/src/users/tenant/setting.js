import { ensureTenantSidebarStyles, renderTenantSidebar } from './sidebarTenant.js';

// Avatar helper functions
const API_BASE = (window.DORMHIVE_API_URL ?? 'http://localhost:5000/api/v1').replace(/\/api\/v1\/?$/, '');

function normalizeAvatarPath(value = '') {
  const url = String(value || '').trim();
  if (!url) return '';
  if (url.startsWith('data:')) return url;
  if (/^https?:\/\//i.test(url)) return url;
  const normalized = url.replace(/^\.\//, '').replace(/^\/+/, '');
  return normalized.startsWith('uploads/') ? `/${normalized}` : `/${normalized}`;
}

function resolveImageUrl(value = '') {
  const url = normalizeAvatarPath(value);
  if (!url) return '';
  if (url.startsWith('data:')) return url;
  if (/^https?:\/\//i.test(url)) return url;
  return `${API_BASE}${url.startsWith('/') ? '' : '/'}${url}`;
}

function buildDefaultUserAvatarSvg(name = 'Tenant User') {
  const initials = String(name).trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('') || 'T';
  const svg = `
    <svg viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${name} portrait">
      <rect width="240" height="240" rx="120" fill="#f2efe9"/>
      <circle cx="120" cy="94" r="46" fill="#223547"/>
      <path d="M67 198c8-37 32-57 53-57s45 20 53 57" fill="#2b4963"/>
      <path d="M85 106c9-27 24-43 36-43 26 0 40 20 40 44 0 18-7 29-20 37-13 7-29 8-42 2-13-6-20-17-24-40z" fill="#1d2d3c"/>
      <path d="M75 175c15-14 31-22 45-22 16 0 31 8 45 22" fill="#11212d"/>
      <rect x="72" y="164" width="96" height="24" rx="12" fill="#0f2b3f"/>
      <rect x="86" y="171" width="68" height="10" rx="5" fill="#4b6781"/>
      <text x="50%" y="86%" text-anchor="middle" font-size="42" font-family="Inter, Arial, sans-serif" fill="#ffffff" font-weight="700">${initials}</text>
    </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

async function refreshTenantUserSession() {
  try {
    const currentUser = JSON.parse(localStorage.getItem('dormhive.user') ?? '{}');
    if (!currentUser?.id) return currentUser || {};
    const token = localStorage.getItem('dormhive.accessToken') ?? '';
    const response = await fetch(`${(window.DORMHIVE_API_URL ?? 'http://localhost:5000/api/v1').replace(/\/api\/v1\/?$/, '')}/api/v1/users/${currentUser.id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body?.data) return currentUser;
    const latestUser = { ...currentUser, ...body.data };
    localStorage.setItem('dormhive.user', JSON.stringify(latestUser));
    return latestUser;
  } catch {
    return JSON.parse(localStorage.getItem('dormhive.user') ?? '{}');
  }
}

function getUserAvatarUrl(user = {}, name = 'Tenant User') {
  const profileName = String(user?.name || name || 'Tenant User').trim();
  if (!user || !user.avatar_url) return buildDefaultUserAvatarSvg(profileName);
  return resolveImageUrl(user.avatar_url);
}

// Export avatar functions for use in other tenant pages
export { resolveImageUrl, getUserAvatarUrl, refreshTenantUserSession };

function normalizeApiBase(baseUrl = 'http://localhost:5000/api/v1') {
  const normalized = String(baseUrl || 'http://localhost:5000/api/v1').trim().replace(/\/+$/, '');
  if (normalized.endsWith('/api/v1')) return normalized;
  if (normalized.endsWith('/api')) return `${normalized}/v1`;
  return `${normalized.replace(/\/$/, '')}/api/v1`;
}

const API = normalizeApiBase(window.DORMHIVE_API_URL ?? 'http://localhost:5000/api/v1');
const getUser = () => JSON.parse(localStorage.getItem('dormhive.user') ?? '{}');
const saveUser = (nextUser = {}) => {
  const currentUser = getUser();
  const mergedUser = { ...currentUser, ...nextUser };
  if (nextUser.avatar_url !== undefined) mergedUser.avatar_url = nextUser.avatar_url;
  localStorage.setItem('dormhive.user', JSON.stringify(mergedUser));
  window.dispatchEvent(new CustomEvent('dormhive-user-updated', { detail: mergedUser }));
  return mergedUser;
};

async function refreshTenantUserFromServer(userId) {
  if (!userId) return getUser();
  try {
    const response = await fetch(`${API}/users/${userId}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('dormhive.accessToken') ?? ''}` }
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body?.data) return getUser();
    const latestUser = { ...getUser(), ...body.data };
    localStorage.setItem('dormhive.user', JSON.stringify(latestUser));
    window.dispatchEvent(new CustomEvent('dormhive-user-updated', { detail: latestUser }));
    return latestUser;
  } catch {
    return getUser();
  }
}

function displayNotice(element, text, state = 'error') {
  if (!element) return;
  element.hidden = false;
  element.textContent = text;
  element.className = `notice ${state}`;
}

function css() {
  if (!document.querySelector('[data-tenant-style="setting"]')) {
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = new URL('./style/setting.css', import.meta.url);
    l.dataset.tenantStyle = 'setting';
    document.head.append(l);
  }
}

export async function renderSetting(root = document.querySelector('#app')) {
  if (!root) throw new Error('Tenant settings page requires #app.');
  css();
  ensureTenantSidebarStyles();
  let user = getUser();
  if (!user || !user.id || user.role !== 'tenant') {
    return location.assign('#/login');
  }
  user = await refreshTenantUserSession();
  if (!user || !user.id || user.role !== 'tenant') {
    return location.assign('#/login');
  }
  let displayName = (user.first_name || user.last_name) ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : user.name || 'Tenant User';
  const displayEmail = user.email || 'tenant@dormhive.com';

  root.innerHTML = `
    <div class="dh-app">
      ${renderTenantSidebar('setting')}
      <main class="tenant-page-main tenant-settings">
        <div class="settings-card">
          <div class="settings-header">
            <h1>Account Settings</h1>
          </div>

          <div class="settings-body">
            <aside class="profile-side">
              <div class="segmented-tabs" aria-label="Profile settings tabs">
                <button type="button" class="tab active" data-tab="profile" aria-selected="true">Profile</button>
                <button type="button" class="tab" data-tab="security" aria-selected="false">Security</button>
              </div>

              <div class="avatar-panel">
                <div class="avatar-wrap" aria-label="User avatar">
                  <img class="avatar-image" src="${getUserAvatarUrl(user, displayName)}" alt="User avatar" ${user.avatar_url ? '' : 'hidden'}>
                  <svg class="avatar-svg" viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${displayName} portrait" ${user.avatar_url ? 'style="display:none;"' : ''}>
                    <rect width="240" height="240" rx="120" fill="#f2efe9"/>
                    <circle cx="120" cy="94" r="46" fill="#223547"/>
                    <path d="M67 198c8-37 32-57 53-57s45 20 53 57" fill="#2b4963"/>
                    <path d="M85 106c9-27 24-43 36-43 26 0 40 20 40 44 0 18-7 29-20 37-13 7-29 8-42 2-13-6-20-17-24-40z" fill="#1d2d3c"/>
                    <path d="M75 175c15-14 31-22 45-22 16 0 31 8 45 22" fill="#11212d"/>
                    <rect x="72" y="164" width="96" height="24" rx="12" fill="#0f2b3f"/>
                    <rect x="86" y="171" width="68" height="10" rx="5" fill="#4b6781"/>
                  </svg>
                  <button type="button" class="avatar-edit" aria-label="Upload profile picture">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm14.71-9.04a.996.996 0 0 0 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" fill="currentColor"/>
                    </svg>
                  </button>
                  <input class="avatar-input" type="file" accept="image/*" hidden>
                </div>
                <div class="user-name">${displayName}</div>
                <div class="profile-actions">
                  <button type="button" class="discard-profile" hidden>Discard</button>
                  <button type="button" class="edit-profile">Edit Profile</button>
                </div>
              </div>
            </aside>

            <section class="details-panel">
              <div class="settings-view profile-view">
                <form class="account-form" data-form="profile">
                  <div class="field-row">
                    <label>
                      <span>First Name</span>
                      <input id="tenant-profile-first" name="first_name" type="text" value="${user.first_name ?? ''}" required readonly>
                    </label>
                    <label>
                      <span>Last Name</span>
                      <input id="tenant-profile-last" name="last_name" type="text" value="${user.last_name ?? ''}" required readonly>
                    </label>
                  </div>

                  <label>
                    <span>Email Address</span>
                    <input name="email" type="email" value="${displayEmail}" readonly>
                  </label>

                  <label>
                    <span>Phone Number</span>
                    <input id="tenant-profile-phone" name="phone" type="tel" value="${user.phone ?? ''}" maxlength="20" readonly>
                  </label>

                  <p class="notice" data-notice="profile" hidden role="alert"></p>
                </form>
              </div>

              <div class="settings-view security-view" hidden>
                <form class="account-form security-form" data-form="security">
                  <label>
                    <span>Current Password</span>
                    <input name="currentPassword" type="password" placeholder="Enter current password" required>
                  </label>

                  <label>
                    <span>New Password</span>
                    <input name="newPassword" type="password" placeholder="Enter new password" required minlength="8">
                  </label>

                  <label>
                    <span>Confirm New Password</span>
                    <input name="confirmPassword" type="password" placeholder="Confirm new password" required minlength="8">
                  </label>

                  <button type="submit" class="save-btn">Save password</button>
                  <p class="notice" data-notice="security" hidden role="alert"></p>
                </form>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>`;

  const tabs = [...root.querySelectorAll('.tab')];
  const profileView = root.querySelector('.profile-view');
  const securityView = root.querySelector('.security-view');
  const profileForm = root.querySelector('[data-form="profile"]');
  const securityForm = root.querySelector('[data-form="security"]');
  const firstInput = profileForm.querySelector('#tenant-profile-first');
  const lastInput = profileForm.querySelector('#tenant-profile-last');
  const phoneInput = profileForm.querySelector('#tenant-profile-phone');
  const editProfileButton = root.querySelector('.edit-profile');
  const discardProfileButton = root.querySelector('.discard-profile');
  const profileNotice = root.querySelector('[data-notice="profile"]');
  const securityNotice = root.querySelector('[data-notice="security"]');
  const avatarInput = root.querySelector('.avatar-input');
  const avatarEditButton = root.querySelector('.avatar-edit');
  const avatarImage = root.querySelector('.avatar-image');
  const avatarSvg = root.querySelector('.avatar-svg');
  const profileCaption = root.querySelector('.user-name');
  let isEditMode = false;
  let pendingAvatarFile = null;
  let profileSnapshot = {
    first_name: user.first_name ?? '',
    last_name: user.last_name ?? '',
    phone: user.phone ?? '',
    avatar_url: user.avatar_url ?? '',
    name: user.name ?? ''
  };

  function syncAvatarDisplay(avatarValue = user.avatar_url || '') {
    const nextValue = String(avatarValue || '').trim();
    const resolved = nextValue ? resolveImageUrl(nextValue) : '';
    avatarImage.src = resolved || getUserAvatarUrl({ avatar_url: nextValue }, displayName);
    avatarImage.hidden = !nextValue;
    avatarSvg.style.display = nextValue ? 'none' : '';
  }

  syncAvatarDisplay(user.avatar_url || '');

  const legacyParts = (user.name || '').trim().split(/\s+/).filter(Boolean);
  firstInput.value = user.first_name ?? (legacyParts[0] ?? '');
  lastInput.value = user.last_name ?? (legacyParts.slice(1).join(' ') || legacyParts[legacyParts.length - 1] || '');
  phoneInput.value = user.phone ?? '';

  function setProfileEditable(enabled) {
    [firstInput, lastInput, phoneInput].forEach((input) => {
      input.readOnly = !enabled;
      input.disabled = !enabled;
    });
  }

  function restoreProfileSnapshot(snapshot = profileSnapshot) {
    firstInput.value = snapshot.first_name ?? '';
    lastInput.value = snapshot.last_name ?? '';
    phoneInput.value = snapshot.phone ?? '';
    profileCaption.textContent = (snapshot.first_name || snapshot.last_name)
      ? `${snapshot.first_name || ''} ${snapshot.last_name || ''}`.trim()
      : snapshot.name || 'Tenant User';
    syncAvatarDisplay(snapshot.avatar_url || '');
    pendingAvatarFile = null;
    avatarInput.value = '';
  }

  function setEditState(enabled) {
    isEditMode = enabled;
    editProfileButton.textContent = enabled ? 'Save Profile' : 'Edit Profile';
    discardProfileButton.hidden = !enabled;
    avatarEditButton.hidden = !enabled;
    setProfileEditable(enabled);
    if (enabled) {
      profileSnapshot = {
        first_name: firstInput.value || user.first_name || '',
        last_name: lastInput.value || user.last_name || '',
        phone: phoneInput.value || user.phone || '',
        avatar_url: user.avatar_url || '',
        name: user.name || ''
      };
      firstInput.focus();
    } else {
      profileSnapshot = {
        first_name: user.first_name ?? '',
        last_name: user.last_name ?? '',
        phone: user.phone ?? '',
        avatar_url: user.avatar_url ?? '',
        name: user.name ?? ''
      };
    }
  }

  setEditState(false);

  function setActiveTab(tabName) {
    const isProfile = tabName === 'profile';
    tabs.forEach((tab) => {
      const active = tab.dataset.tab === tabName;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', String(active));
    });
    profileView.hidden = !isProfile;
    securityView.hidden = isProfile;
    editProfileButton.hidden = !isProfile;
    discardProfileButton.hidden = !isProfile || !isEditMode;
  }

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => setActiveTab(tab.dataset.tab));
  });

  discardProfileButton.addEventListener('click', () => {
    restoreProfileSnapshot(profileSnapshot);
    setEditState(false);
    displayNotice(profileNotice, 'Changes discarded.', 'error');
    setTimeout(() => {
      profileNotice.hidden = true;
      profileNotice.textContent = '';
    }, 1800);
  });

  editProfileButton.addEventListener('click', async () => {
    if (!isEditMode) {
      setEditState(true);
      return;
    }

    const payload = {
      first_name: firstInput.value.trim(),
      last_name: lastInput.value.trim(),
      phone: phoneInput.value.trim(),
      name: [firstInput.value.trim(), lastInput.value.trim()].filter(Boolean).join(' ')
    };

    if (!payload.first_name || !payload.last_name) {
      displayNotice(profileNotice, 'First name and last name are required.', 'error');
      return;
    }

    if (payload.phone && !/^\+?[0-9\s().-]{7,20}$/.test(payload.phone.trim())) {
      displayNotice(profileNotice, 'Please provide a valid phone number.', 'error');
      return;
    }

    try {
      let currentAvatarUrl = user.avatar_url || '';

      if (pendingAvatarFile) {
        console.debug('Tenant setting: uploading avatar', pendingAvatarFile && { name: pendingAvatarFile.name, type: pendingAvatarFile.type, size: pendingAvatarFile.size });
        const uploadFormData = new FormData();
        uploadFormData.append('avatar', pendingAvatarFile);
        const uploadResponse = await fetch(`${API}/users/${user.id}/avatar`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${localStorage.getItem('dormhive.accessToken') ?? ''}` },
          body: uploadFormData
        });
        const uploadBody = await uploadResponse.json().catch(() => ({}));
        console.debug('Tenant setting: upload response', uploadResponse.status, uploadBody);
        if (!uploadResponse.ok) throw new Error(uploadBody.message ?? 'Unable to upload profile picture.');

        currentAvatarUrl = uploadBody.data?.avatar_url || uploadBody.avatar_url || user.avatar_url || '';
        const avatarUpdatedUser = { ...user, ...uploadBody.data, avatar_url: currentAvatarUrl };
        user = avatarUpdatedUser;
        saveUser(avatarUpdatedUser);
        syncAvatarDisplay(currentAvatarUrl);
        pendingAvatarFile = null;
        avatarInput.value = '';
      }

      const response = await fetch(`${API}/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('dormhive.accessToken') ?? ''}` },
        body: JSON.stringify({ ...payload, avatar_url: currentAvatarUrl })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? 'Unable to update profile.');

      const serverUser = await refreshTenantUserSession();
      const refreshedUser = {
        ...(user || {}),
        ...serverUser,
        ...body.data,
        ...payload,
        avatar_url: currentAvatarUrl || serverUser.avatar_url || body.data?.avatar_url || user.avatar_url || '',
        email: user.email ?? displayEmail
      };
      localStorage.setItem('dormhive.user', JSON.stringify(refreshedUser));
      user = refreshedUser;
      syncAvatarDisplay(refreshedUser.avatar_url || currentAvatarUrl || '');
      displayNotice(profileNotice, 'Profile saved.', 'success');
      profileSnapshot = {
        first_name: refreshedUser.first_name ?? '',
        last_name: refreshedUser.last_name ?? '',
        phone: refreshedUser.phone ?? '',
        avatar_url: refreshedUser.avatar_url ?? '',
        name: refreshedUser.name ?? ''
      };
      setEditState(false);
      profileCaption.textContent = payload.name || 'Tenant User';
    } catch (error) {
      displayNotice(profileNotice, error.message, 'error');
    }
  });

  profileForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!isEditMode) return;
    editProfileButton.click();
  });

  securityForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(securityForm);
    const currentPassword = String(formData.get('currentPassword') ?? '').trim();
    const newPassword = String(formData.get('newPassword') ?? '').trim();
    const confirmPassword = String(formData.get('confirmPassword') ?? '').trim();

    if (!currentPassword || !newPassword || !confirmPassword) {
      displayNotice(securityNotice, 'Please complete all password fields.', 'error');
      return;
    }

    if (newPassword.length < 8) {
      displayNotice(securityNotice, 'New password must be at least 8 characters long.', 'error');
      return;
    }

    if (newPassword !== confirmPassword) {
      displayNotice(securityNotice, 'New password and confirm password must match.', 'error');
      return;
    }

    try {
      const response = await fetch(`${API}/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('dormhive.accessToken') ?? ''}` },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? 'Unable to update password.');

      securityForm.reset();
      displayNotice(securityNotice, 'Password updated successfully.', 'success');
    } catch (error) {
      displayNotice(securityNotice, error.message, 'error');
    }
  });

  avatarEditButton.addEventListener('click', () => avatarInput.click());
  avatarInput.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    console.debug('Tenant setting: avatar selected', { name: file.name, type: file.type, size: file.size });

    pendingAvatarFile = file;
    const previewUrl = URL.createObjectURL(file);
    avatarImage.src = previewUrl;
    avatarImage.hidden = false;
    avatarSvg.style.display = 'none';
  });
}
