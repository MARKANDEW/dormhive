import { ensureOwnerSidebarStyles, loadOwnerStylesheet, renderOwnerSidebar, updateListingCountsInSidebar } from './sidebarOwner.js';

const API = window.DORMHIVE_API_URL ?? 'http://localhost:5000/api/v1';
const auth = () => ({ Authorization: `Bearer ${localStorage.getItem('dormhive.accessToken') ?? ''}` });
const current = () => JSON.parse(localStorage.getItem('dormhive.user') ?? '{}');
const escapeHtml = (value = '') => { const element = document.createElement('span'); element.textContent = value; return element.innerHTML; };

function css() {
  const stylesheet = new URL('./style/analytics.css', import.meta.url);
  stylesheet.searchParams.set('v', 'owner-analytics-top-listings-1');
  return loadOwnerStylesheet('analytics', stylesheet);
}

export async function renderAnalytics(root = document.querySelector('#app')) {
  if (!root) throw new Error('Analytics page requires #app.');
  await Promise.all([css(), ensureOwnerSidebarStyles()]);
  root.innerHTML = `
    <div class="owner-shell">
      ${renderOwnerSidebar('analytics')}
      <div class="owner-main">
        <main class="analytics-page">
          <section>
            <p class="eyebrow">OWNER ANALYTICS</p>
            <h1>Rental performance</h1>
            <p class="status" role="status">Calculating analytics…</p>
            <div class="analytics-grid"></div>
            <div class="analytics-main-grid">
              <section class="chart booking-overview">
                <div class="section-heading">
                  <h2>Booking overview</h2>
                  <p>Breakdown of booking requests.</p>
                </div>
                <div class="donut-layout">
                  <div class="donut-chart" aria-label="Booking status chart"><span class="donut-total"></span></div>
                  <div class="chart-legend"></div>
                </div>
              </section>
              <section class="chart listing-performance">
                <div class="section-heading listing-heading">
                  <div>
                    <h2>Listing performance</h2>
                    <p>Top 5 by bookings and inquiries.</p>
                  </div>
                  <a class="listing-view-all" href="#/owner/myListing">View all listings</a>
                </div>
                <div class="listing-table"></div>
              </section>
            </div>
            <section class="chart recent-activity">
              <div class="section-heading">
                <h2>Recent activity</h2>
                <p>Latest updates and actions on your account.</p>
              </div>
              <div class="activity-list"></div>
            </section>
          </section>
        </main>
      </div>
    </div>`;

  const menuButton = root.querySelector('.owner-mobile-menu');
  const analyticsSection = root.querySelector('.analytics-page > section');
  if (menuButton && analyticsSection) analyticsSection.prepend(menuButton);

  Promise.all([
    fetch(`${API}/properties?limit=100`, { headers: auth() }),
    fetch(`${API}/bookings`, { headers: auth() })
  ]).then(async ([p, b]) => {
    const pp = await p.json();
    const bb = await b.json();
    if (!p.ok) throw new Error(pp.message);
    if (!b.ok) throw new Error(bb.message);

    const ownerId = Number(current().id);
    const listings = (Array.isArray(pp.data) ? pp.data : []).filter((x) => Number(x.owner_id) === ownerId);
    const ownerBookings = (Array.isArray(bb.data) ? bb.data : []).filter((x) => Number(x.owner_id) === ownerId);
    const approved = ownerBookings.filter((x) => x.status === 'approved');
    const pending = ownerBookings.filter((x) => x.status === 'pending');
    const rejected = ownerBookings.filter((x) => x.status === 'rejected' || x.status === 'cancelled');
    const totalBookings = ownerBookings.length;
    const activeTenants = approved.length;

    root.querySelector('.analytics-grid').innerHTML = `
      <article><span>Total listings</span><strong>${listings.length}</strong></article>
      <article><span>Active tenants</span><strong>${activeTenants}</strong></article>
      <article><span>Approved bookings</span><strong>${approved.length}</strong></article>
      <article><span>Pending requests</span><strong>${pending.length}</strong></article>`;

    const chartTotal = Math.max(totalBookings, 1);
    const approvedDegrees = (approved.length / chartTotal) * 360;
    const pendingDegrees = (pending.length / chartTotal) * 360;
    root.querySelector('.donut-chart').style.setProperty('--approved-degrees', `${approvedDegrees}deg`);
    root.querySelector('.donut-chart').style.setProperty('--pending-degrees', `${approvedDegrees + pendingDegrees}deg`);
    root.querySelector('.donut-total').innerHTML = `<strong>${totalBookings}</strong><span>Total</span>`;
    root.querySelector('.chart-legend').innerHTML = [['Approved', approved.length, 'approved'], ['Pending', pending.length, 'pending'], ['Declined', rejected.length, 'declined']]
      .map(([name, value, className]) => `<div class="legend-row"><span><i class="legend-dot ${className}"></i>${name}</span><strong>${value}</strong><small>${Math.round((value / chartTotal) * 100)}%</small></div>`)
      .join('');

    const listingMetrics = listings.map((property) => {
      const propertyBookings = ownerBookings.filter((booking) => Number(booking.property_id) === Number(property.id));
      return {
        property,
        inquiries: propertyBookings.filter((booking) => booking.status === 'pending').length,
        bookings: propertyBookings.filter((booking) => booking.status === 'approved').length
      };
    }).sort((left, right) =>
      (right.inquiries + right.bookings) - (left.inquiries + left.bookings)
      || right.bookings - left.bookings
      || right.inquiries - left.inquiries
      || String(left.property.title || '').localeCompare(String(right.property.title || ''))
    );
    root.querySelector('.listing-table').innerHTML = `
      <div class="listing-table-head"><span>Property</span><span>Inquiries</span><span>Bookings</span></div>
      ${listingMetrics.slice(0, 5).map(({ property, inquiries, bookings }) => {
        return `<div class="listing-table-row"><strong>${escapeHtml(property.title || 'Untitled property')}</strong><span>${inquiries}</span><span>${bookings}</span></div>`;
      }).join('') || '<div class="listing-empty">No listings yet.</div>'}`;

    const activity = [
      ...approved.map((booking) => ({ icon: '✓', type: 'approved', text: `Booking approved for ${booking.property_title || 'your property'}.`, date: booking.updated_at || booking.created_at })),
      ...rejected.map((booking) => ({ icon: '!', type: 'declined', text: `Booking request declined for ${booking.property_title || 'your property'}.`, date: booking.updated_at || booking.created_at })),
      ...listings.filter((property) => ['approved', 'rejected', 'pending', 'archived'].includes(property.status)).map((property) => {
        const status = property.status;
        const activityByStatus = {
          approved: { icon: '⌂', type: 'published', label: 'approved' },
          rejected: { icon: '!', type: 'declined', label: 'rejected' },
          pending: { icon: '•', type: 'inquiry', label: 'submitted for review' },
          archived: { icon: '!', type: 'declined', label: 'archived' }
        }[status];
        return {
          ...activityByStatus,
          text: `Listing ${activityByStatus.label}: ${property.title || 'Untitled property'}.`,
          date: property.updated_at || property.created_at
        };
      }),
      ...pending.map((booking) => ({ icon: '•', type: 'inquiry', text: `New booking request for ${booking.property_title || 'your property'}.`, date: booking.created_at }))
    ].sort((a, b) => Date.parse(b.date || 0) - Date.parse(a.date || 0)).slice(0, 4);
    root.querySelector('.activity-list').innerHTML = activity.map((item) => {
      const icon = item.type === 'published'
        ? '<i class="bi bi-house-check-fill" aria-hidden="true"></i>'
        : escapeHtml(item.icon);
      return `<div class="activity-row"><span class="activity-icon ${item.type}" aria-hidden="true">${icon}</span><span>${escapeHtml(item.text)}</span><time>${item.date ? new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recently'}</time></div>`;
    }).join('') || '<div class="listing-empty">No recent activity.</div>';

    root.querySelector('.status').hidden = true;
    await updateListingCountsInSidebar();
  }).catch((e) => {
    root.querySelector('.status').textContent = e.message;
  });

}
