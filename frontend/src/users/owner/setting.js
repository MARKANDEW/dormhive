import { ensureOwnerSidebarStyles, loadOwnerStylesheet, renderOwnerSidebar, updateListingCountsInSidebar } from './sidebarOwner.js';
import { withMediaAccessToken } from '../../services/mediaAccess.js';
import { buildInitialsAvatarSvg } from '../../services/avatar.js';
import { openAvatarEditor, uploadAvatarPhoto } from '../../services/avatarEditor.js';

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
  const normalized = url.replace(/^\.\//, '').replace(/^\/+/, '');
  return withMediaAccessToken(/^https?:\/\//i.test(url) ? url : `${API_BASE}/${normalized}`);
}

function css() {
  const stylesheet = new URL('./style/setting.css', import.meta.url);
  stylesheet.searchParams.set('v', 'mobile-header-inline-4');
  return loadOwnerStylesheet('setting', stylesheet);
}

function buildAvatarSvg(name = 'Owner') {
  return buildInitialsAvatarSvg(name, 'O');
}

export async function renderSetting(root = document.querySelector('#app')) {
  if (!root) throw new Error('Owner settings page requires #app.');
  await Promise.all([css(), ensureOwnerSidebarStyles()]);
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
                  <img src="${resolveImageUrl(user.avatar_url) || buildAvatarSvg(displayName)}" alt="${displayName} avatar" />
                  <button type="button" class="avatar-edit" aria-label="Edit profile photo">✎</button>
                  <input class="avatar-input" type="file" accept="image/jpeg,image/png,image/webp" hidden>
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

  const menuButton = root.querySelector('.owner-mobile-menu');
  const settingsHeader = root.querySelector('.settings-header');
  if (menuButton && settingsHeader) settingsHeader.prepend(menuButton);

  const profileForm = root.querySelector('form[data-form="profile"]');
  const securityForm = root.querySelector('form[data-form="security"]');
  const profileView = root.querySelector('.profile-view');
  const securityView = root.querySelector('.security-view');
  const tabs = root.querySelectorAll('.tab');
  const editProfileButton = root.querySelector('.edit-profile');
  const discardProfileButton = root.querySelector('.discard-profile');
  const avatarEditButton = root.querySelector('.avatar-edit');
  const avatarImage = root.querySelector('.avatar-wrap img');
  const avatarInput = root.querySelector('.avatar-input');
  const notice = root.querySelector('.notice');
  let isEditMode = false;
  let profileSnapshot = {
    first_name: user.first_name ?? '',
    last_name: user.last_name ?? '',
    phone: user.phone ?? '',
    avatar_url: user.avatar_url ?? '',
    name: user.name ?? ''
  };
  
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
      : buildAvatarSvg(displayName);
    avatarImage.src = src;
    avatarImage.alt = `Portrait of ${displayName}`;
    avatarImage.onerror = () => {
      avatarImage.onerror = null;
      avatarImage.src = buildAvatarSvg(displayName);
    };
  }

  function restoreProfileSnapshot(snapshot = profileSnapshot) {
    profileForm.querySelector('#owner-profile-first').value = snapshot.first_name ?? '';
    profileForm.querySelector('#owner-profile-last').value = snapshot.last_name ?? '';
    profileForm.querySelector('#owner-profile-phone').value = snapshot.phone ?? '';
    document.querySelector('.user-name').textContent = (snapshot.first_name || snapshot.last_name)
      ? `${snapshot.first_name || ''} ${snapshot.last_name || ''}`.trim()
      : snapshot.name || 'Alexander J. Reyes';
    syncAvatarDisplay(snapshot.avatar_url || user.avatar_url || '');
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

  avatarInput.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await openAvatarEditor(file, async (optimizedFile) => {
        const updatedUser = await uploadAvatarPhoto(user.id, optimizedFile);
        user = saveUser({ ...user, ...updatedUser });
        syncAvatarDisplay(user.avatar_url);
        profileSnapshot.avatar_url = user.avatar_url;
        displayNotice(notice, 'Profile photo saved.', 'success');
      });
    } catch (error) {
      displayNotice(notice, error.message || 'Unable to upload profile picture.', 'error');
    } finally {
      avatarInput.value = '';
    }
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
