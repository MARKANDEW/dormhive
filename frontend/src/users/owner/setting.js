import { ensureOwnerSidebarStyles, renderOwnerSidebar, updateListingCountsInSidebar } from './sidebarOwner.js';

const API = window.DORMHIVE_API_URL ?? 'http://localhost:5000/api/v1';
const API_BASE = API.replace(/\/api\/v1\/?$/, '');
const getUser = () => JSON.parse(localStorage.getItem('dormhive.user') ?? '{}');
const saveUser = (nextUser = {}) => {
  const currentUser = getUser();
  const mergedUser = { ...currentUser, ...nextUser };
  if (nextUser.avatar_url !== undefined) mergedUser.avatar_url = nextUser.avatar_url;
  localStorage.setItem('dormhive.user', JSON.stringify(mergedUser));
  return mergedUser;
};

function resolveImageUrl(value = '') {
  const url = String(value || '').trim();
  if (!url) return '';
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;
  if (/^https?:\/\//i.test(url)) return url;
  const normalized = url.replace(/^\.\//, '').replace(/^\/+/, '');
  return `${API_BASE}/${normalized}`;
}

function css() {
  if (!document.querySelector('[data-owner-style="setting"]')) {
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = new URL('./style/setting.css', import.meta.url);
    l.dataset.ownerStyle = 'setting';
    document.head.append(l);
  }
}

function buildAvatarSvg() {
  const svg = `
    <svg viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Alexander J. Reyes portrait">
      <rect width="240" height="240" rx="120" fill="#f2efe9"/>
      <circle cx="120" cy="94" r="46" fill="#223547"/>
      <path d="M67 198c8-37 32-57 53-57s45 20 53 57" fill="#2b4963"/>
      <path d="M85 106c9-27 24-43 36-43 26 0 40 20 40 44 0 18-7 29-20 37-13 7-29 8-42 2-13-6-20-17-24-40z" fill="#1d2d3c"/>
      <path d="M75 175c15-14 31-22 45-22 16 0 31 8 45 22" fill="#11212d"/>
      <rect x="72" y="164" width="96" height="24" rx="12" fill="#0f2b3f"/>
      <rect x="86" y="171" width="68" height="10" rx="5" fill="#4b6781"/>
    </svg>`;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export async function renderSetting(root = document.querySelector('#app')) {
  if (!root) throw new Error('Owner settings page requires #app.');
  css();
  ensureOwnerSidebarStyles();
  let user = getUser();
  const displayName = (user.first_name || user.last_name) ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : user.name || 'Alexander J. Reyes';
  const displayEmail = user.email || 'mr.reyes@dormhive.com';

  root.innerHTML = `
    <div class="owner-shell">
      ${renderOwnerSidebar('setting')}
      <main class="owner-main owner-settings">
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
                  <img src="${buildAvatarSvg()}" alt="Portrait of ${displayName}" />
                  <button type="button" class="avatar-edit" aria-label="Edit profile photo">✎</button>
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
                      <input id="owner-profile-first" name="first_name" type="text" value="${user.first_name ?? ''}" required readonly>
                    </label>
                    <label>
                      <span>Last Name</span>
                      <input id="owner-profile-last" name="last_name" type="text" value="${user.last_name ?? ''}" required readonly>
                    </label>
                  </div>
                  <label>
                    <span>Email Address</span>
                    <input id="owner-profile-email" name="email" type="email" value="${displayEmail}" readonly>
                  </label>
                  <label>
                    <span>Phone Number</span>
                    <input id="owner-profile-phone" name="phone" type="tel" maxlength="20" value="${user.phone ?? ''}" readonly>
                  </label>
                </form>
              </div>

              <div class="settings-view security-view" hidden>
                <form class="security-form" data-form="security">
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
                </form>
              </div>
            </section>
          </div>

          <p class="notice" role="alert" hidden></p>
        </div>
      </main>
    </div>`;

  const profileForm = root.querySelector('form[data-form="profile"]');
  const securityForm = root.querySelector('form[data-form="security"]');
  const profileView = root.querySelector('.profile-view');
  const securityView = root.querySelector('.security-view');
  const tabs = root.querySelectorAll('.tab');
  const editProfileButton = root.querySelector('.edit-profile');
  const discardProfileButton = root.querySelector('.discard-profile');
  const avatarEditButton = root.querySelector('.avatar-edit');
  const avatarImage = root.querySelector('.avatar-wrap img');
  let avatarInput = root.querySelector('input[type="file"]');
  const notice = root.querySelector('.notice');
  let isEditMode = false;
  let pendingAvatarFile = null;
  let profileSnapshot = {
    first_name: user.first_name ?? '',
    last_name: user.last_name ?? '',
    phone: user.phone ?? '',
    avatar_url: user.avatar_url ?? '',
    name: user.name ?? ''
  };
  
  if (!avatarInput) {
    avatarInput = document.createElement('input');
    avatarInput.type = 'file';
    avatarInput.accept = 'image/*';
    avatarInput.hidden = true;
    avatarInput.className = 'avatar-input';
    root.querySelector('.avatar-wrap').appendChild(avatarInput);
  }
  const legacyParts = (user.name || '').trim().split(/\s+/).filter(Boolean);
  profileForm.querySelector('#owner-profile-first').value = user.first_name ?? (legacyParts[0] ?? '');
  profileForm.querySelector('#owner-profile-last').value = user.last_name ?? (legacyParts.slice(1).join(' ') || legacyParts[legacyParts.length - 1] || '');
  profileForm.querySelector('#owner-profile-email').value = displayEmail;
  profileForm.querySelector('#owner-profile-phone').value = user.phone ?? '';

  function displayNotice(element, text, state = 'error') {
    if (!element) return;
    element.hidden = false;
    element.textContent = text;
    element.className = `notice ${state}`;
  }

  function syncAvatarDisplay(avatarValue = user.avatar_url || '') {
    const nextValue = String(avatarValue || '').trim();
    const src = nextValue
      ? (nextValue.startsWith('blob:') || nextValue.startsWith('data:') || /^https?:\/\//i.test(nextValue)
        ? nextValue
        : resolveImageUrl(nextValue))
      : buildAvatarSvg();
    avatarImage.src = src;
    avatarImage.alt = `Portrait of ${displayName}`;
  }

  function restoreProfileSnapshot(snapshot = profileSnapshot) {
    profileForm.querySelector('#owner-profile-first').value = snapshot.first_name ?? '';
    profileForm.querySelector('#owner-profile-last').value = snapshot.last_name ?? '';
    profileForm.querySelector('#owner-profile-phone').value = snapshot.phone ?? '';
    document.querySelector('.user-name').textContent = (snapshot.first_name || snapshot.last_name)
      ? `${snapshot.first_name || ''} ${snapshot.last_name || ''}`.trim()
      : snapshot.name || 'Alexander J. Reyes';
    syncAvatarDisplay(snapshot.avatar_url || user.avatar_url || '');
    pendingAvatarFile = null;
    if (avatarInput) avatarInput.value = '';
  }

  function setEditState(enabled) {
    isEditMode = enabled;
    const inputs = profileForm.querySelectorAll('input');
    inputs.forEach((el) => {
      if (el.id !== 'owner-profile-email') el.readOnly = !enabled;
    });
    editProfileButton.textContent = enabled ? 'Save Profile' : 'Edit Profile';
    discardProfileButton.hidden = !enabled;
    avatarEditButton.hidden = !enabled;
    if (enabled) {
      profileSnapshot = {
        first_name: profileForm.querySelector('#owner-profile-first').value || user.first_name || '',
        last_name: profileForm.querySelector('#owner-profile-last').value || user.last_name || '',
        phone: profileForm.querySelector('#owner-profile-phone').value || user.phone || '',
        avatar_url: user.avatar_url ?? '',
        name: user.name || ''
      };
      profileForm.querySelector('#owner-profile-first').focus();
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

  avatarEditButton.hidden = true;

  function setActiveTab(tabName) {
    const isProfile = tabName === 'profile';
    tabs.forEach((t) => t.classList.toggle('active', t.dataset.tab === tabName));
    profileView.hidden = !isProfile;
    securityView.hidden = isProfile;
    editProfileButton.hidden = !isProfile;
    discardProfileButton.hidden = !isProfile || !isEditMode;
    notice.hidden = true;
  }

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => setActiveTab(tab.dataset.tab));
  });

  discardProfileButton.addEventListener('click', () => {
    restoreProfileSnapshot(profileSnapshot);
    setEditState(false);
    displayNotice(notice, 'Changes discarded.', 'error');
    setTimeout(() => {
      notice.hidden = true;
      notice.textContent = '';
    }, 1800);
  });

  editProfileButton.addEventListener('click', async () => {
    if (!isEditMode) {
      setEditState(true);
      return;
    }

    const payload = {
      first_name: profileForm.querySelector('#owner-profile-first').value.trim(),
      last_name: profileForm.querySelector('#owner-profile-last').value.trim(),
      phone: profileForm.querySelector('#owner-profile-phone').value.trim(),
      name: [profileForm.querySelector('#owner-profile-first').value.trim(), profileForm.querySelector('#owner-profile-last').value.trim()].filter(Boolean).join(' ')
    };

    if (!payload.first_name || !payload.last_name) {
      displayNotice(notice, 'First name and last name are required.', 'error');
      return;
    }

    if (payload.phone && !/^\+?[0-9\s().-]{7,20}$/.test(payload.phone.trim())) {
      displayNotice(notice, 'Please provide a valid phone number.', 'error');
      return;
    }

    try {
      let currentAvatarUrl = user.avatar_url ?? '';

      if (pendingAvatarFile) {
        const formData = new FormData();
        formData.append('avatar', pendingAvatarFile);
        const avatarRes = await fetch(`${API}/users/${user.id}/avatar`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${localStorage.getItem('dormhive.accessToken') ?? ''}` },
          body: formData
        });
        const avatarData = await avatarRes.json().catch(() => ({}));
        if (!avatarRes.ok) throw new Error(avatarData.message || 'Upload failed');

        currentAvatarUrl = avatarData.data?.avatar_url || avatarData.avatar_url || currentAvatarUrl;
        user = saveUser({ ...user, ...avatarData.data, avatar_url: currentAvatarUrl });
        syncAvatarDisplay(currentAvatarUrl);
        pendingAvatarFile = null;
        if (avatarInput) avatarInput.value = '';
      }

      const res = await fetch(`${API}/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('dormhive.accessToken') ?? ''}` },
        body: JSON.stringify({ ...payload, avatar_url: currentAvatarUrl })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Profile update failed');

      user = saveUser({ ...user, ...data.data, ...payload, avatar_url: currentAvatarUrl || data.data?.avatar_url || user.avatar_url || '' });
      displayNotice(notice, 'Profile saved.', 'success');
      setEditState(false);
      document.querySelector('.user-name').textContent = payload.name || 'Alexander J. Reyes';
      syncAvatarDisplay(user.avatar_url || currentAvatarUrl || '');
    } catch (err) {
      displayNotice(notice, err.message || 'Failed to update profile.', 'error');
    }
  });

  avatarEditButton.addEventListener('click', () => avatarInput.click());

  avatarInput.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    pendingAvatarFile = file;
    const previewUrl = URL.createObjectURL(file);
    syncAvatarDisplay(previewUrl);
  });

  securityForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const cp = securityForm.currentPassword.value.trim();
    const np = securityForm.newPassword.value.trim();
    const cnp = securityForm.confirmPassword.value.trim();
    notice.hidden = false;
    if (!cp || !np || !cnp) {
      displayNotice(notice, 'Please complete all password fields.', 'error');
      return;
    }
    if (np.length < 8) {
      displayNotice(notice, 'New password must be at least 8 characters.', 'error');
      return;
    }
    if (np !== cnp) {
      displayNotice(notice, 'New passwords do not match.', 'error');
      return;
    }
    try {
      const res = await fetch(`${API}/users/${user.id}/password`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('dormhive.accessToken') ?? ''}` },
        body: JSON.stringify({ currentPassword: cp, newPassword: np })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Password update failed');
      displayNotice(notice, 'Password updated successfully.', 'success');
      securityForm.reset();
    } catch (err) {
      displayNotice(notice, err.message || 'Failed to update password.', 'error');
    }
  });

  profileForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!profileForm.reportValidity()) return;
    const first = profileForm.querySelector('#owner-profile-first').value.trim();
    const last = profileForm.querySelector('#owner-profile-last').value.trim();
    const phone = profileForm.querySelector('#owner-profile-phone').value.trim();
    try {
      const res = await fetch(`${API}/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('dormhive.accessToken') ?? ''}` },
        body: JSON.stringify({ first_name: first, last_name: last, name: [first, last].filter(Boolean).join(' '), phone, avatar_url: user.avatar_url || '' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Profile update failed');
      user = saveUser({ ...user, ...data.data, avatar_url: user.avatar_url || data.data?.avatar_url || '' });
      displayNotice(notice, 'Profile updated successfully.', 'success');
      setEditState(false);
    } catch (err) {
      displayNotice(notice, err.message || 'Failed to update profile.', 'error');
    }
  });

  syncAvatarDisplay(user.avatar_url || '');
  await updateListingCountsInSidebar();
}


