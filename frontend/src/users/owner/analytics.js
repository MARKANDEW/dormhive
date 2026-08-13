import { ensureOwnerSidebarStyles, renderOwnerSidebar } from './sidebarOwner.js';

const API = window.DORMHIVE_API_URL ?? 'http://localhost:5000/api/v1';
const auth = () => ({ Authorization: `Bearer ${localStorage.getItem('dormhive.accessToken') ?? ''}` });
const current = () => JSON.parse(localStorage.getItem('dormhive.user') ?? '{}');

function css() {
  if (!document.querySelector('[data-owner-style="analytics"]')) {
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = new URL('./style/analytics.css', import.meta.url);
    l.dataset.ownerStyle = 'analytics';
    document.head.append(l);
  }
}

export function renderAnalytics(root = document.querySelector('#app')) {
  if (!root) throw new Error('Analytics page requires #app.');
  css();
  ensureOwnerSidebarStyles();
  root.innerHTML = `
    <div class="owner-shell">
      ${renderOwnerSidebar('analytics')}
      <div class="owner-main">
        <main class="analytics-page">
          <header>
            <a class="brand" href="#/owner/dashboardOwner">DormHive</a>
          </header>
          <section>
            <p class="eyebrow">OWNER ANALYTICS</p>
            <h1>Rental performance</h1>
            <p class="status" role="status">Calculating analytics…</p>
            <div class="analytics-grid"></div>
            <section class="chart">
              <h2>Booking status</h2>
              <div class="bar-chart"></div>
            </section>
          </section>
        </main>
      </div>
    </div>`;

  Promise.all([
    fetch(`${API}/properties?limit=100`, { headers: auth() }),
    fetch(`${API}/bookings`, { headers: auth() })
  ]).then(async ([p, b]) => {
    const pp = await p.json();
    const bb = await b.json();
    if (!p.ok) throw new Error(pp.message);
    if (!b.ok) throw new Error(bb.message);

    const listings = pp.data.filter((x) => Number(x.owner_id) === Number(current().id));
    const approved = bb.data.filter((x) => x.status === 'approved');
    const pending = bb.data.filter((x) => x.status === 'pending');
    const rejected = bb.data.filter((x) => x.status === 'rejected');
    const max = Math.max(approved.length, pending.length, rejected.length, 1);

    root.querySelector('.analytics-grid').innerHTML = `
      <article><span>Total listings</span><strong>${listings.length}</strong></article>
      <article><span>Approved bookings</span><strong>${approved.length}</strong></article>
      <article><span>Pending requests</span><strong>${pending.length}</strong></article>`;

    root.querySelector('.bar-chart').innerHTML = [['Approved', approved.length, 'approved'], ['Pending', pending.length, 'pending'], ['Declined', rejected.length, 'declined']]
      .map(([n, v, c]) => `<div><span>${n}</span><i><b class="${c}" data-progress="${Math.round((v / max) * 100)}"></b></i><strong>${v}</strong></div>`)
      .join('');

    root.querySelectorAll('.bar-chart b').forEach((bar) => {
      bar.style.setProperty('--progress', `${bar.dataset.progress}%`);
    });

    root.querySelector('.status').hidden = true;
  }).catch((e) => {
    root.querySelector('.status').textContent = e.message;
  });

  root.querySelector('.logout')?.addEventListener('click', () => {
    localStorage.clear();
    location.assign('#/login');
  });
}


