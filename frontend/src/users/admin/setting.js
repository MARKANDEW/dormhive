import { ensureAdminSidebarStyles, renderAdminSidebar } from './sidebarAdmin.js';

const API = window.DORMHIVE_API_URL ?? 'http://localhost:5000/api/v1';
function css() {
  if (!document.querySelector('[data-admin-style="settings"]')) {
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = new URL('./style/setting.css', import.meta.url);
    l.dataset.adminStyle = 'settings';
    document.head.append(l);
  }
}

export function renderSetting(root = document.querySelector('#app')) {
  if (!root) throw new Error('Admin settings page requires #app.');
  css();
  ensureAdminSidebarStyles();
  const user = JSON.parse(localStorage.getItem('dormhive.user') ?? '{}');
  root.innerHTML = `
    <div class="admin-shell">
      ${renderAdminSidebar('setting')}
      <div class="admin-main">
        <main class="admin-settings">
          <header>
            <a class="brand" href="#/admin/dashboardAdmin">DormHive <small>ADMIN</small></a>
            <a href="#/admin/dashboardAdmin">← Overview</a>
          </header>

          <section class="card">
            <p class="eyebrow">ADMIN ACCOUNT</p>
            <h1>Settings</h1>
            <p class="notice" hidden role="alert"></p>

            <form>
              <div class="two-col">
                <label>First Name<input id="admin-first" name="first_name" required></label>
                <label>Last Name<input id="admin-last" name="last_name" required></label>
              </div>
              <label>Email<input name="email" readonly></label>
              <button>Save profile</button>
            </form>

            <hr>
            <button class="logout">Sign out</button>
          </section>
        </main>
      </div>
    </div>`;

  const form = root.querySelector('form');
  const legacyParts = (user.name || '').trim().split(/\s+/).filter(Boolean);
  form.querySelector('#admin-first').value = user.first_name ?? (legacyParts[0] ?? '');
  form.querySelector('#admin-last').value = user.last_name ?? (legacyParts.slice(1).join(' ') || legacyParts[legacyParts.length - 1] || '');
  form.email.value = user.email ?? '';

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const r = await fetch(`${API}/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('dormhive.accessToken') ?? ''}` },
      body: JSON.stringify({
        first_name: form.querySelector('#admin-first').value.trim(),
        last_name: form.querySelector('#admin-last').value.trim(),
        name: [form.querySelector('#admin-first').value.trim(), form.querySelector('#admin-last').value.trim()].filter(Boolean).join(' ')
      })
    });
    const b = await r.json();
    const n = root.querySelector('.notice');
    n.hidden = false;
    if (!r.ok) {
      n.textContent = b.message;
      return;
    }
    localStorage.setItem('dormhive.user', JSON.stringify(b.data));
    n.textContent = 'Profile saved.';
    n.className = 'notice success';
  });

  root.querySelector('.logout').addEventListener('click', () => {
    localStorage.clear();
    location.assign('#/login');
  });
}
