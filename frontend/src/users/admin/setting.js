import { ensureAdminSidebarStyles, renderAdminSidebar } from './sidebarAdmin.js';
import { applyAdminPrivacy } from './privacy.js';
import { resolveUserAvatarUrl } from './avatar.js';

const API = window.DORMHIVE_API_URL ?? 'http://localhost:5000/api/v1';
const BACKEND_BASE = API.replace(/\/api\/v1$/, '');

function css() {
  if (!document.querySelector('[data-admin-style="settings"]')) {
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = new URL('./style/setting.css', import.meta.url);
    l.dataset.adminStyle = 'settings';
    document.head.append(l);
  }
}

function displayNotice(element, text, state = 'error') {
  if (!element) return;
  element.hidden = false;
  element.textContent = text;
  element.className = `notice ${state}`;
}

export function renderSetting(root = document.querySelector('#app')) {
  if (!root) throw new Error('Admin settings page requires #app.');
  css();
  ensureAdminSidebarStyles();

  const user = JSON.parse(localStorage.getItem('dormhive.user') ?? '{}');
  const legacyParts = (user.name || '').trim().split(/\s+/).filter(Boolean);
  const firstName = user.first_name ?? (legacyParts[0] ?? 'Admin');
  const lastName = user.last_name ?? (legacyParts.slice(1).join(' ') || legacyParts[legacyParts.length - 1] || 'User');
  const email = user.email ?? 'admin@dormhive.com';
  const phone = user.phone ?? 'xxxxxxxxx';
  const userName = [firstName, lastName].filter(Boolean).join(' ') || 'Admin User';

  const getAvatarUrl = (url) => resolveUserAvatarUrl(url || '', userName);

  root.innerHTML = `
    <div class="admin-shell">
      ${renderAdminSidebar('setting')}
      <div class="admin-main">
        <main class="admin-settings">
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
                  <div class="avatar-wrap" aria-label="Admin avatar">
                    <img class="avatar-image" src="${getAvatarUrl(user.avatar_url)}" alt="Admin avatar" ${user.avatar_url ? '' : 'hidden'}>
                    <svg class="avatar-svg" viewBox="0 0 80 80" aria-hidden="true" ${user.avatar_url ? 'style="display:none;"' : ''}>
                      <defs>
                        <linearGradient id="avatarShield" x1="0%" x2="100%" y1="0%" y2="100%">
                          <stop offset="0%" stop-color="#f7d36d"/>
                          <stop offset="100%" stop-color="#c38e21"/>
                        </linearGradient>
                      </defs>
                      <path d="M40 12l22 7v16c0 14-9 25-22 33C27 60 18 49 18 35V19l22-7zm-1 15l-9 9 6 6 3-3 3 3 6-6-9-9zm-13 13h26v6H26v-6zm2 12h22v6H28v-6z" fill="#1d3d41" opacity="0.9"/>
                      <path d="M40 18l16 5v12c0 10-6 18-16 24-10-6-16-14-16-24V23l16-5zm-8 16h16v6H32v-6zm2 12h12v6H34v-6z" fill="url(#avatarShield)"/>
                      <circle cx="56" cy="23" r="8" fill="#1d3d41"/>
                      <path d="M52 23h8M56 19v8" stroke="#f3d57d" stroke-width="2.5" stroke-linecap="round"/>
                    </svg>
                    <button type="button" class="avatar-edit" aria-label="Upload profile picture">
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm14.71-9.04a.996.996 0 0 0 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" fill="currentColor"/>
                      </svg>
                    </button>
                    <input class="avatar-input" type="file" accept="image/*" hidden>
                  </div>
                  <div class="user-name" data-privacy-mask="name">${userName}</div>
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
                        <input id="admin-first" name="first_name" type="text" value="${firstName}" data-privacy-mask="name" required readonly>
                      </label>
                      <label>
                        <span>Last Name</span>
                        <input id="admin-last" name="last_name" type="text" value="${lastName}" data-privacy-mask="name" required readonly>
                      </label>
                    </div>

                    <label>
                      <span>Email Address</span>
                      <input name="email" type="email" value="${email}" data-privacy-mask="email" readonly>
                    </label>

                    <label>
                      <span>phone number</span>
                      <input id="admin-phone" name="phone" type="tel" value="${phone}" data-privacy-mask="phone" maxlength="20" readonly>
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
      </div>
    </div>`;

  const tabs = [...root.querySelectorAll('.tab')];
  const profileView = root.querySelector('.profile-view');
  const securityView = root.querySelector('.security-view');
  const profileForm = root.querySelector('[data-form="profile"]');
  const securityForm = root.querySelector('[data-form="security"]');
  const firstInput = profileForm.querySelector('#admin-first');
  const lastInput = profileForm.querySelector('#admin-last');
  const phoneInput = profileForm.querySelector('#admin-phone');
  const editProfileButton = root.querySelector('.edit-profile');
  const discardProfileButton = root.querySelector('.discard-profile');
  const profileNotice = root.querySelector('[data-notice="profile"]');
  const securityNotice = root.querySelector('[data-notice="security"]');
  const avatarInput = root.querySelector('.avatar-input');
  const avatarEditButton = root.querySelector('.avatar-edit');
  const avatarImage = root.querySelector('.avatar-image');
  const avatarSvg = root.querySelector('.avatar-svg');
  let isEditMode = false;
  let profileSnapshot = {
    first_name: firstName,
    last_name: lastName,
    phone: phone,
    name: userName
  };

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
    root.querySelector('.user-name').textContent = (snapshot.first_name || snapshot.last_name)
      ? `${snapshot.first_name || ''} ${snapshot.last_name || ''}`.trim()
      : snapshot.name || 'Admin User';
  }

  function setEditState(enabled) {
    isEditMode = enabled;
    editProfileButton.textContent = enabled ? 'Save Profile' : 'Edit Profile';
    discardProfileButton.hidden = !enabled;
    avatarEditButton.hidden = !enabled;
    setProfileEditable(enabled);
    if (enabled) {
      profileSnapshot = {
        first_name: firstInput.value || firstName,
        last_name: lastInput.value || lastName,
        phone: phoneInput.value || phone,
        name: userName
      };
      firstInput.focus();
    } else {
      profileSnapshot = {
        first_name: firstName,
        last_name: lastName,
        phone: phone,
        name: userName
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
      const response = await fetch(`${API}/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('dormhive.accessToken') ?? ''}` },
        body: JSON.stringify(payload)
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? 'Unable to update profile.');

      const updatedUser = { ...(user || {}), ...payload, email: user.email ?? email };
      localStorage.setItem('dormhive.user', JSON.stringify(updatedUser));
      displayNotice(profileNotice, 'Profile saved.', 'success');
      setEditState(false);
      root.querySelector('.user-name').textContent = payload.name || 'Admin User';
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

      const newSrc = getAvatarUrl(body.data.avatar_url);
      avatarImage.src = newSrc;
      avatarImage.hidden = false;
      avatarSvg.style.display = 'none';

      const savedUser = { ...(user || {}), avatar_url: body.data.avatar_url };
      localStorage.setItem('dormhive.user', JSON.stringify(savedUser));
      avatarInput.value = '';
    } catch (error) {
      displayNotice(profileNotice, error.message, 'error');
    }
  });

  setProfileEditable(false);
  setActiveTab('profile');
  applyAdminPrivacy(root);
}
