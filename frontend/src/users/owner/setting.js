import { ensureOwnerSidebarStyles, renderOwnerSidebar } from './sidebarOwner.js';

const API = window.DORMHIVE_API_URL ?? 'http://localhost:5000/api/v1';
const getUser = () => JSON.parse(localStorage.getItem('dormhive.user') ?? '{}');

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

export function renderSetting(root = document.querySelector('#app')) {
  if (!root) throw new Error('Owner settings page requires #app.');
  css();
  ensureOwnerSidebarStyles();
  const user = getUser();
  const displayName = (user.first_name || user.last_name) ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : user.name || 'Alexander J. Reyes';
  const displayEmail = user.email || 'mr.reyes@dormhive.com';

  root.innerHTML = `
    <div class="owner-shell">
      ${renderOwnerSidebar('setting')}
      <div class="owner-main">
        <main class="owner-settings">
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
                    <img src="${buildAvatarSvg()}" alt="Portrait of Alexander J. Reyes" />
                    <button class="avatar-edit" type="button" aria-label="Edit profile photo">✎</button>
                  </div>
                  <p class="profile-caption">${displayName}</p>
                </div>

                <form class="settings-form">
                  <div class="field-group two-col">
                    <label for="profile-first">First Name</label>
                    <input id="profile-first" name="first_name" required value="${user.first_name ?? ''}" />
                    <label for="profile-last">Last Name</label>
                    <input id="profile-last" name="last_name" required value="${user.last_name ?? ''}" />
                  </div>
                  <div class="field-group">
                    <label for="profile-email">Email Address</label>
                    <input id="profile-email" name="email" readonly value="${displayEmail}" />
                  </div>
                  <div class="field-group">
                    <label for="profile-phone">Phone Number</label>
                    <input id="profile-phone" name="phone" type="tel" maxlength="20" pattern="\\+?[0-9\\s().-]{7,20}" value="${user.phone ?? ''}" />
                  </div>
                  <button class="save-profile" type="submit">Save Profile</button>
                </form>
              </div>

              <div class="tab-panel security-panel hidden" data-panel="security">
                <div class="security-card">
                  <h2>Password Management</h2>
                  <form class="security-form">
                    <div class="field-group">
                      <label for="current-password">Current Password</label>
                      <input id="current-password" name="currentPassword" type="password" required />
                    </div>
                    <div class="field-group">
                      <label for="new-password">New Password</label>
                      <input id="new-password" name="newPassword" type="password" required />
                    </div>
                    <div class="field-group">
                      <label for="confirm-password">Confirm New Password</label>
                      <input id="confirm-password" name="confirmPassword" type="password" required />
                    </div>
                    <button class="save-profile" type="submit">Update Password</button>
                  </form>
                </div>
              </div>
            </div>

            <p class="notice" role="alert" hidden></p>
          </section>
        </main>
      </div>
    </div>`;

  const form = root.querySelector('.settings-form');
  const legacyParts = (user.name || '').trim().split(/\s+/).filter(Boolean);
  form.querySelector('#profile-first').value = user.first_name ?? (legacyParts[0] ?? '');
  form.querySelector('#profile-last').value = user.last_name ?? (legacyParts.slice(1).join(' ') || legacyParts[legacyParts.length - 1] || '');
  form.email.value = displayEmail;
  form.phone.value = user.phone ?? '';

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
    const currentPassword = securityForm.currentPassword.value.trim();
    const newPassword = securityForm.newPassword.value.trim();
    const confirmPassword = securityForm.confirmPassword.value.trim();

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
    const r = await fetch(`${API}/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('dormhive.accessToken') ?? ''}` },
      body: JSON.stringify({ first_name: form.querySelector('#profile-first').value.trim(), last_name: form.querySelector('#profile-last').value.trim(), name: [form.querySelector('#profile-first').value.trim(), form.querySelector('#profile-last').value.trim()].filter(Boolean).join(' '), phone: form.phone.value.trim() })
    });
    const b = await r.json();
    const n = root.querySelector('.notice');
    n.hidden = false;
    if (!r.ok) {
      n.textContent = b.message;
      n.className = 'notice error';
      return;
    }
    localStorage.setItem('dormhive.user', JSON.stringify(b.data));
    n.textContent = 'Profile updated.';
    n.className = 'notice success';
  });
}


