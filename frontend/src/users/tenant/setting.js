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
const refreshUserFromServer = async (userId, authToken) => {
  const response = await fetch(`${API}/users/${encodeURIComponent(String(userId))}`, {
    headers: { Authorization: `Bearer ${authToken}` }
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.message || 'Unable to refresh your profile.');
  return saveUser(body.data ?? {});
};

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
          <header class="settings-header">
            <div>
              <p class="eyebrow">ACCOUNT SETTINGS</p>
              <h1>Account Settings</h1>
            </div>
          </header>

          <section class="settings-card">
            <nav class="settings-tabs" aria-label="Settings tabs">
              <a class="tab active" href="#" data-tab="profile">Profile</a>
              <a class="tab" href="#" data-tab="security">Security</a>
            </nav>

            <div class="settings-body">
              <div class="tab-panel profile-panel" data-panel="profile">
                <div class="profile-photo-card">
                  <div class="avatar-shell">
                    <img src="${getUserAvatarUrl(user, displayName)}" alt="Portrait of ${displayName}" />
                    <button class="avatar-edit" type="button" aria-label="Change profile photo">✎</button>
                  </div>
                  <p class="profile-caption">${displayName}</p>
                  <div class="avatar-actions">
                    <input id="tenant-avatar-input" class="avatar-input" type="file" accept="image/*" hidden />
                    <button class="save-profile avatar-action" type="button">Edit Profile</button>
                    <button class="save-profile cancel-profile" type="button" hidden>Cancel</button>
                  </div>
                </div>

                <form class="settings-form">
                  <div class="field-group two-col">
                    <label for="tenant-profile-first">First Name</label>
                    <input id="tenant-profile-first" name="first_name" required value="${user.first_name ?? ''}" />
                    <label for="tenant-profile-last">Last Name</label>
                    <input id="tenant-profile-last" name="last_name" required value="${user.last_name ?? ''}" />
                  </div>
                  <div class="field-group">
                    <label for="tenant-profile-email">Email Address</label>
                    <input id="tenant-profile-email" name="email" readonly value="${displayEmail}" />
                  </div>
                  <div class="field-group">
                    <label for="tenant-profile-phone">Phone Number</label>
                    <input id="tenant-profile-phone" name="phone" type="tel" maxlength="20" pattern="\\+?[0-9\\s().-]{7,20}" value="${user.phone ?? ''}" />
                  </div>
                </form>
              </div>

              <div class="tab-panel security-panel hidden" data-panel="security">
                <div class="security-card">
                  <h2>Password Management</h2>
                  <form class="security-form">
                    <div class="field-group">
                      <label for="tenant-current-password">Current Password</label>
                      <input id="tenant-current-password" name="currentPassword" type="password" required />
                    </div>
                    <div class="field-group">
                      <label for="tenant-new-password">New Password</label>
                      <input id="tenant-new-password" name="newPassword" type="password" required />
                    </div>
                    <div class="field-group">
                      <label for="tenant-confirm-password">Confirm New Password</label>
                      <input id="tenant-confirm-password" name="confirmPassword" type="password" required />
                    </div>
                    <button class="save-profile" type="submit">Update Password</button>
                  </form>
                </div>
              </div>
            </div>

            <p class="notice" role="alert" hidden></p>
          </section>
      </main>
    </div>`;

  const form = root.querySelector('.settings-form');
  const firstInput = root.querySelector('#tenant-profile-first');
  const lastInput = root.querySelector('#tenant-profile-last');
  const phoneInput = root.querySelector('#tenant-profile-phone');
  const avatarInput = root.querySelector('#tenant-avatar-input');
  const avatarImage = root.querySelector('.profile-photo-card img');
  const avatarActionButton = root.querySelector('.avatar-action');
  const cancelButton = root.querySelector('.cancel-profile');
  const avatarEditButton = root.querySelector('.avatar-edit');
  const profileCaption = root.querySelector('.profile-caption');
  let selectedAvatarFile = null;
  let currentPreviewUrl = null;
  let isEditing = false;

  // If separate name parts are not yet set, attempt to split legacy `name` into parts
  const legacyParts = (user.name || '').trim().split(/\s+/).filter(Boolean);
  form.querySelector('#tenant-profile-first').value = user.first_name ?? (legacyParts[0] ?? '');
  form.querySelector('#tenant-profile-last').value = user.last_name ?? (legacyParts.slice(1).join(' ') || legacyParts[legacyParts.length - 1] || '');
  form.querySelector('#tenant-profile-email').value = displayEmail;
  form.querySelector('#tenant-profile-phone').value = user.phone ?? '';

  const setEditMode = (active) => {
    isEditing = active;
    firstInput.readOnly = !active;
    lastInput.readOnly = !active;
    phoneInput.readOnly = !active;
    avatarEditButton.hidden = !active;
    avatarActionButton.textContent = active ? 'Save Changes' : 'Edit Profile';
    cancelButton.hidden = !active;
  };

  const resetFormState = () => {
    selectedAvatarFile = null;
    if (currentPreviewUrl) {
      URL.revokeObjectURL(currentPreviewUrl);
      currentPreviewUrl = null;
    }
    avatarInput.value = '';
    firstInput.value = user.first_name ?? '';
    lastInput.value = user.last_name ?? '';
    phoneInput.value = user.phone ?? '';
    avatarImage.src = getUserAvatarUrl(user, displayName);
  };

  const updateAvatarPreview = (file) => {
    if (currentPreviewUrl) {
      URL.revokeObjectURL(currentPreviewUrl);
      currentPreviewUrl = null;
    }
    if (!file) {
      avatarImage.src = getUserAvatarUrl(user, displayName);
      return;
    }
    currentPreviewUrl = URL.createObjectURL(file);
    avatarImage.src = currentPreviewUrl;
  };

  avatarEditButton.addEventListener('click', () => {
    if (!isEditing) setEditMode(true);
    avatarInput.click();
  });

  avatarInput.addEventListener('change', () => {
    selectedAvatarFile = avatarInput.files?.[0] ?? null;
    if (selectedAvatarFile && !isEditing) setEditMode(true);
    updateAvatarPreview(selectedAvatarFile);
  });

  avatarActionButton.addEventListener('click', () => {
    if (!isEditing) {
      setEditMode(true);
      return;
    }
    form.requestSubmit();
  });

  cancelButton.addEventListener('click', () => {
    resetFormState();
    setEditMode(false);
    const notice = root.querySelector('.notice');
    notice.hidden = true;
  });

  setEditMode(false);
  updateAvatarPreview(null);

  const tabs = root.querySelectorAll('.tab');
  const panels = root.querySelectorAll('.tab-panel');

  tabs.forEach((tab) => {
    tab.addEventListener('click', (event) => {
      event.preventDefault();
      const target = tab.dataset.tab;
      tabs.forEach((item) => item.classList.toggle('active', item === tab));
      panels.forEach((panel) => panel.classList.toggle('hidden', panel.dataset.panel !== target));
      root.querySelector('.notice').hidden = true;
    });
  });

  const securityForm = root.querySelector('.security-form');
  securityForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const notice = root.querySelector('.notice');
    const currentPassword = securityForm.querySelector('#tenant-current-password').value.trim();
    const newPassword = securityForm.querySelector('#tenant-new-password').value.trim();
    const confirmPassword = securityForm.querySelector('#tenant-confirm-password').value.trim();

    notice.hidden = false;
    if (!currentPassword || !newPassword || !confirmPassword) {
      notice.textContent = 'Please complete all password fields.';
      notice.className = 'notice error';
      return;
    }

    if (newPassword.length < 8) {
      notice.textContent = 'New password must be at least 8 characters.';
      notice.className = 'notice error';
      return;
    }

    if (newPassword !== confirmPassword) {
      notice.textContent = 'New passwords do not match.';
      notice.className = 'notice error';
      return;
    }

    notice.textContent = 'Password updated.';
    notice.className = 'notice success';
    securityForm.reset();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    const notice = root.querySelector('.notice');
    notice.hidden = false;
    notice.textContent = 'Saving changes...';
    notice.className = 'notice';

    const authToken = localStorage.getItem('dormhive.accessToken') ?? '';
    let updatedUser = user;

    try {
      if (selectedAvatarFile) {
        const avatarForm = new FormData();
        avatarForm.append('avatar', selectedAvatarFile);
        const avatarUrl = `${API}/users/${encodeURIComponent(String(user.id))}/avatar`;
        const avatarResponse = await fetch(avatarUrl, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${authToken}` },
          body: avatarForm
        });
        const avatarBody = await avatarResponse.json();
        if (!avatarResponse.ok) {
          throw new Error(avatarBody.message || 'Unable to upload avatar.');
        }
        updatedUser = await refreshUserFromServer(user.id, authToken);
        user = updatedUser;
        displayName = user.name || displayName;
        profileCaption.textContent = displayName;
        avatarImage.src = getUserAvatarUrl(user, displayName);
      }

      const profileResponse = await fetch(`${API}/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ first_name: form.querySelector('#tenant-profile-first').value.trim(), last_name: form.querySelector('#tenant-profile-last').value.trim(), name: [form.querySelector('#tenant-profile-first').value.trim(), form.querySelector('#tenant-profile-last').value.trim()].filter(Boolean).join(' '), phone: form.querySelector('#tenant-profile-phone').value.trim() })
      });
      const profileBody = await profileResponse.json();
      if (!profileResponse.ok) {
        throw new Error(profileBody.message || 'Unable to update profile.');
      }
      updatedUser = await refreshUserFromServer(user.id, authToken);
      user = updatedUser;
      displayName = user.name || displayName;
      notice.textContent = 'Profile updated.';
      notice.className = 'notice success';
      selectedAvatarFile = null;
      if (currentPreviewUrl) {
        URL.revokeObjectURL(currentPreviewUrl);
        currentPreviewUrl = null;
      }
      avatarInput.value = '';
      avatarImage.src = getUserAvatarUrl(user, displayName);
      profileCaption.textContent = displayName;
      setEditMode(false);
    } catch (error) {
      notice.textContent = error.message;
      notice.className = 'notice error';
    }
  });
}


