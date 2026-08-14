import { ensureTenantSidebarStyles, renderTenantSidebar } from './sidebarTenant.js';
import { getUserAvatarUrl } from './avatar.js';

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
  return mergedUser;
};

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

export function renderSetting(root = document.querySelector('#app')) {
  if (!root) throw new Error('Tenant settings page requires #app.');
  css();
  ensureTenantSidebarStyles();
  let user = getUser();
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
                <button type="button" class="edit-profile">Edit Profile</button>
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
  const profileNotice = root.querySelector('[data-notice="profile"]');
  const securityNotice = root.querySelector('[data-notice="security"]');
  const avatarInput = root.querySelector('.avatar-input');
  const avatarEditButton = root.querySelector('.avatar-edit');
  const avatarImage = root.querySelector('.avatar-image');
  const avatarSvg = root.querySelector('.avatar-svg');
  const profileCaption = root.querySelector('.user-name');
  let isEditMode = false;

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

  function setEditState(enabled) {
    isEditMode = enabled;
    editProfileButton.textContent = enabled ? 'Save Profile' : 'Edit Profile';
    avatarEditButton.hidden = !enabled;
    setProfileEditable(enabled);
    if (enabled) {
      firstInput.focus();
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
  }

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => setActiveTab(tab.dataset.tab));
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
      const response = await fetch(`${API}/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('dormhive.accessToken') ?? ''}` },
        body: JSON.stringify(payload)
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? 'Unable to update profile.');

      const updatedUser = { ...(user || {}), ...payload, email: user.email ?? displayEmail };
      localStorage.setItem('dormhive.user', JSON.stringify(updatedUser));
      user = updatedUser;
      displayNotice(profileNotice, 'Profile saved.', 'success');
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

    const formData = new FormData();
    formData.append('avatar', file);

    try {
      const response = await fetch(`${API}/users/${user.id}/avatar`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${localStorage.getItem('dormhive.accessToken') ?? ''}` },
        body: formData
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? 'Unable to upload profile picture.');

      const newSrc = body.data.avatar_url && !body.data.avatar_url.startsWith('http') ? `http://localhost:5000${body.data.avatar_url}` : body.data.avatar_url;
      avatarImage.src = newSrc;
      avatarImage.hidden = false;
      avatarSvg.style.display = 'none';
      user = { ...user, avatar_url: body.data.avatar_url };
      localStorage.setItem('dormhive.user', JSON.stringify(user));
    } catch (error) {
      displayNotice(profileNotice, error.message, 'error');
    }
  });
}


