import { ensureAdminSidebarStyles, renderAdminSidebar } from './sidebarAdmin.js';
import { applyAdminPrivacy } from './privacy.js';

const API = window.DORMHIVE_API_URL ?? 'http://localhost:5000/api/v1';
const auth = () => ({ Authorization: `Bearer ${localStorage.getItem('dormhive.accessToken') ?? ''}` });

export function totalCount(rows = []) {
  return rows.reduce((sum, item) => sum + (Number(item?.count) || 0), 0);
}

export function countByRole(rows = [], role) {
  return rows
    .filter((item) => item?.role === role)
    .reduce((sum, item) => sum + (Number(item?.count) || 0), 0);
}

export function countByStatus(rows = [], status) {
  return rows
    .filter((item) => item?.status === status)
    .reduce((sum, item) => sum + (Number(item?.count) || 0), 0);
}

export function buildDashboardMetrics({ users = [], properties = [], bookings = [] }) {
  const totalUsers = totalCount(users);
  const totalProperties = totalCount(properties);
  const totalBookings = totalCount(bookings);
  const pendingModeration = countByStatus(properties, 'pending');
  const approvedBookings = countByStatus(bookings, 'approved');

  return {
    totalUsers,
    totalProperties,
    totalBookings,
    pendingModeration,
    approvalRate: totalBookings ? Math.round((approvedBookings / totalBookings) * 100) : 0,
  };
}

export function buildAnalyticsCsv({ metrics, users = [], properties = [], bookings = [] }) {
  const rows = [
    ['Metric', 'Value'],
    ['Total Users', metrics.totalUsers],
    ['Active Listings', countByStatus(properties, 'approved')],
    ['Booking Requests', metrics.totalBookings],
    ['Pending Moderation', metrics.pendingModeration],
    ['Booking Approval Rate', `${metrics.approvalRate}%`],
    [],
    ['User Role', 'Count'],
    ['Tenants', countByRole(users, 'tenant')],
    ['Landlords', countByRole(users, 'owner')],
    ['Administrators', countByRole(users, 'admin')],
    [],
    ['Property Status', 'Count'],
    ['Published Listings', countByStatus(properties, 'approved')],
    ['Pending Listings', countByStatus(properties, 'pending')],
    ['Rejected Listings', countByStatus(properties, 'rejected')],
    [],
    ['Booking Status', 'Count'],
    ['Approved Bookings', countByStatus(bookings, 'approved')],
    ['Pending Bookings', countByStatus(bookings, 'pending')],
    ['Rejected Bookings', countByStatus(bookings, 'rejected')]
  ];
  return rows.map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
}

export function formatTimeAgo(timestamp) {
  if (!timestamp) return 'unknown';
  const now = new Date();
  const date = new Date(timestamp);
  const seconds = Math.floor((now - date) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min${minutes > 1 ? 's' : ''} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

export function buildActivityFeed(users = [], properties = [], bookings = []) {
  const activities = [];
  properties.forEach((prop) => {
    if (prop.status === 'approved' || prop.status === 'rejected') {
      activities.push({
        icon: prop.status === 'rejected' ? 'alert' : 'shield',
        title: `Property ${prop.status}`,
        detail: `[${prop.title || 'Property'}]`,
        time: formatTimeAgo(prop.updated_at),
        timestamp: new Date(prop.updated_at || prop.created_at).getTime()
      });
    }
  });
  bookings.forEach((booking) => {
    if (booking.status === 'approved' || booking.status === 'rejected') {
      activities.push({
        icon: booking.status === 'rejected' ? 'alert' : 'user',
        title: `Booking ${booking.status}`,
        detail: `[${booking.tenant_name || 'Tenant'}]`,
        time: formatTimeAgo(booking.updated_at),
        timestamp: new Date(booking.updated_at || booking.created_at).getTime()
      });
    }
  });
  users.forEach((user) => {
    if (user.status === 'active' || user.status === 'suspended') {
      const createdTimestamp = new Date(user.created_at).getTime();
      const updatedTimestamp = new Date(user.updated_at || user.created_at).getTime();
      const hasProfileUpdate = Number.isFinite(updatedTimestamp)
        && (!Number.isFinite(createdTimestamp) || updatedTimestamp > createdTimestamp + 1000);
      const activityTimestamp = hasProfileUpdate ? updatedTimestamp : createdTimestamp;
      activities.push({
        icon: user.status === 'suspended' ? 'alert' : hasProfileUpdate ? 'sync' : 'user',
        title: user.status === 'suspended'
          ? 'User suspended'
          : hasProfileUpdate ? 'User profile updated' : 'New user registered',
        detail: `[${user.name || user.email}]`,
        time: formatTimeAgo(activityTimestamp),
        timestamp: activityTimestamp
      });
    }
  });
  return activities.sort((a, b) => b.timestamp - a.timestamp).slice(0, 10);
}

function css() {
  if (document.querySelector('[data-admin-style="analytics"]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('./style/analytics.css', import.meta.url);
  link.dataset.adminStyle = 'analytics';
  document.head.append(link);
}

const icon = (name) => `<i class="bi ${name}" aria-hidden="true"></i>`;
const roleRows = (users) => [['Tenants', countByRole(users, 'tenant'), 'green'], ['Landlords', countByRole(users, 'owner'), 'blue'], ['Administrators', countByRole(users, 'admin'), 'purple']];
const statusCount = (rows, status) => countByStatus(rows, status);
const emptyChart = () => `<div class="empty-chart"><span class="empty-chart-icon">${icon('bi-bar-chart')}</span><strong>No activity data available yet</strong><p>Activity will appear here as your platform grows.</p></div>`;
const activityChart = (users, properties, bookings) => {
  const values = [['Users', totalCount(users), 'green'], ['Listings', totalCount(properties), 'blue'], ['Bookings', totalCount(bookings), 'purple']];
  const maximum = Math.max(...values.map(([, value]) => value), 1);
  return `<div class="activity-bars">${values.map(([label, value, color]) => `<div class="activity-bar"><div class="activity-bar-track"><i class="${color}" style="height:${Math.max(value ? 8 : 0, Math.round((value / maximum) * 100))}%"></i></div><strong>${value}</strong><small>${label}</small></div>`).join('')}</div>`;
};

export async function renderAnalytics(root = document.querySelector('#app')) {
  if (!root) throw new Error('Admin analytics requires #app.');
  css();
  ensureAdminSidebarStyles();
  root.innerHTML = `<div class="admin-shell">${renderAdminSidebar('analytics')}<div class="admin-main"><main class="admin-analytics"><section class="analytics-content">
    <header class="analytics-heading"><div><div class="analytics-kicker">${icon('bi-bar-chart-line')} Analytics</div><h1>Analytics</h1><p>Track platform performance, growth, and activity at a glance.</p></div><div class="analytics-heading-tools"><button type="button" class="date-filter">${icon('bi-calendar3')} Last 30 days</button><small class="updated-now"><i></i>Updated just now</small></div></header>
    <section class="kpi-grid"><article class="kpi-card kpi-green"><div class="kpi-icon">${icon('bi-people')}</div><div><span>Total Users</span><strong data-kpi="users">0</strong><small>Current registered users</small><em>All account types</em></div><span class="kpi-sparkline"></span></article><article class="kpi-card kpi-blue"><div class="kpi-icon">${icon('bi-house')}</div><div><span>Active Listings</span><strong data-kpi="listings">0</strong><small>Approved properties</small><em>Currently published</em></div><span class="kpi-sparkline"></span></article><article class="kpi-card kpi-purple"><div class="kpi-icon">${icon('bi-calendar-event')}</div><div><span>Booking Requests</span><strong data-kpi="bookings">0</strong><small>All booking statuses</small><em>Recorded requests</em></div><span class="kpi-sparkline"></span></article><article class="kpi-card kpi-orange"><div class="kpi-icon">${icon('bi-shield-check')}</div><div><span>Pending Moderation</span><strong data-kpi="pending">0</strong><small>Awaiting review</small><em>Requires attention</em></div><span class="kpi-sparkline"></span></article></section>
    <section class="analytics-top-grid"><article class="analytics-card activity-card"><div class="section-heading"><div class="heading-icon">${icon('bi-bar-chart-line')}</div><div><h2>Platform Totals</h2><p>Current records returned by the platform.</p></div><div class="section-actions"><button type="button" class="export-button">${icon('bi-download')} Export</button></div></div><div class="chart-legend"><span><i class="green"></i>Users</span><span><i class="blue"></i>Listings</span><span><i class="purple"></i>Bookings</span></div><div class="line-chart"><div class="y-axis"><span>100%</span><span>80%</span><span>60%</span><span>40%</span><span>20%</span><span>0%</span></div><div class="chart-area"><div class="grid-lines"></div><div data-activity-chart>${emptyChart()}</div></div></div></article><article class="analytics-card distribution-card"><div class="section-heading"><div class="heading-icon">${icon('bi-people')}</div><div><h2>User Distribution</h2><p>Users by account type.</p></div></div><div class="distribution-donut"><span>No user data yet</span></div><div class="distribution-list"></div></article></section>
    <section class="analytics-bottom-grid"><article class="analytics-card performance-card"><div class="section-heading"><div class="heading-icon">${icon('bi-house-check')}</div><div><h2>Listings Performance</h2><p>Overview of property listings across DormHive.</p></div></div><div class="performance-list"></div></article><article class="analytics-card booking-card"><div class="section-heading"><div class="heading-icon">${icon('bi-calendar-event')}</div><div><h2>Booking Overview</h2><p>Booking request activity and status.</p></div><a href="#/admin/listingModeration">View bookings</a></div><div class="booking-counts"><div><span>Total Requests</span><strong data-booking="total">0</strong></div><div><span>Approved</span><strong data-booking="approved">0</strong></div><div><span>Pending</span><strong data-booking="pending">0</strong></div></div><div class="booking-empty"><div class="small-donut">${icon('bi-pie-chart')}</div><strong>No booking requests yet</strong><div class="mini-legend"><span><i class="green"></i>Approved 0</span><span><i class="orange"></i>Pending 0</span><span><i class="red"></i>Rejected 0</span></div></div></article><article class="analytics-card recent-card"><div class="section-heading"><div class="heading-icon">${icon('bi-activity')}</div><div><h2>Recent Activity</h2><p>Latest platform events.</p></div></div><div class="recent-list"></div></article></section>
    <section class="insights-section"><div class="section-heading"><div class="heading-icon">${icon('bi-lightbulb')}</div><div><h2>Key Insights</h2></div></div><div class="insight-grid"><article class="insight green"><div>${icon('bi-person-plus')}</div><span>Users</span><strong data-insight="users">0</strong><small>Registered accounts</small></article><article class="insight blue"><div>${icon('bi-house')}</div><span>Listing Approval</span><strong data-insight="listings">0%</strong><small>Approved of all listings</small></article><article class="insight purple"><div>${icon('bi-calendar-check')}</div><span>Booking Approval</span><strong data-insight="bookings">0%</strong><small>Approved of all requests</small></article></div></section>
  </section></main></div></div>`;

  try {
    const responses = await Promise.all([
      fetch(`${API}/analytics/users`, { headers: auth() }),
      fetch(`${API}/analytics/bookings`, { headers: auth() }),
      fetch(`${API}/analytics/properties`, { headers: auth() })
    ]);
    const bodies = await Promise.all(responses.map((response) => response.json()));
    if (responses.some((response) => !response.ok)) throw new Error(bodies.find((body, index) => !responses[index].ok)?.message || 'Unable to load analytics.');
    const users = bodies[0].data ?? [];
    const bookings = bodies[1].data ?? [];
    const properties = bodies[2].data ?? [];
    const metrics = buildDashboardMetrics({ users, properties, bookings });
    root.querySelector('.export-button')?.addEventListener('click', () => {
      const blob = new Blob([buildAnalyticsCsv({ metrics, users, properties, bookings })], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `dormhive-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    });
    root.querySelector('[data-kpi="users"]').textContent = metrics.totalUsers;
    root.querySelector('[data-kpi="listings"]').textContent = statusCount(properties, 'approved');
    root.querySelector('[data-kpi="bookings"]').textContent = metrics.totalBookings;
    root.querySelector('[data-kpi="pending"]').textContent = metrics.pendingModeration;
    const totalProperties = totalCount(properties);
    const approvedListings = statusCount(properties, 'approved');
    root.querySelector('[data-insight="users"]').textContent = metrics.totalUsers;
    root.querySelector('[data-insight="listings"]').textContent = `${totalProperties ? Math.round((approvedListings / totalProperties) * 100) : 0}%`;
    root.querySelector('[data-insight="bookings"]').textContent = `${metrics.approvalRate}%`;
    root.querySelector('[data-activity-chart]').innerHTML = activityChart(users, properties, bookings);
    const distributionValues = roleRows(users).map(([, value]) => value);
    const distributionTotal = distributionValues.reduce((sum, value) => sum + value, 0);
    const distributionStops = distributionValues.reduce((stops, value, index) => {
      const start = index ? stops[index - 1].end : 0;
      const end = start + (distributionTotal ? (value / distributionTotal) * 100 : 0);
      stops.push({ end });
      return stops;
    }, []).map((stop, index) => `${['#16b98b', '#277fe7', '#8552e8'][index]} ${index ? '' : '0'} ${stop.end}%`).join(', ');
    root.querySelector('.distribution-donut').style.background = distributionTotal ? `conic-gradient(${distributionStops})` : '';
    root.querySelector('.distribution-donut span').textContent = distributionTotal ? `${metrics.totalUsers} users` : 'No user data yet';

    root.querySelector('.distribution-list').innerHTML = roleRows(users).map(([label, value, color]) => `<div><span><i class="${color}"></i>${label}</span><strong>${value}</strong><small>${metrics.totalUsers ? Math.round((value / metrics.totalUsers) * 100) : 0}%</small></div>`).join('');
    const propertyStatuses = [['Published Listings', 'approved', 'green', 'bi-house-check'], ['Pending Listings', 'pending', 'orange', 'bi-clock'], ['Rejected Listings', 'rejected', 'red', 'bi-x-circle'], ['Archived Listings', 'archived', 'gray', 'bi-archive']];
    root.querySelector('.performance-list').innerHTML = propertyStatuses.map(([label, status, color, iconName]) => { const value = statusCount(properties, status); return `<div class="performance-row"><span class="performance-label"><i class="${color}">${icon(iconName)}</i>${label}</span><strong>${value}</strong><b><i class="${color}" style="width:${totalProperties ? Math.round((value / totalProperties) * 100) : 0}%"></i></b><small>${totalProperties ? Math.round((value / totalProperties) * 100) : 0}%</small></div>`; }).join('');
    const approved = statusCount(bookings, 'approved');
    const pending = statusCount(bookings, 'pending');
    const rejected = statusCount(bookings, 'rejected');
    root.querySelector('[data-booking="total"]').textContent = metrics.totalBookings;
    root.querySelector('[data-booking="approved"]').textContent = approved;
    root.querySelector('[data-booking="pending"]').textContent = pending;
    root.querySelector('.booking-empty strong').textContent = metrics.totalBookings ? 'Booking status breakdown' : 'No booking requests yet';
    root.querySelector('.mini-legend').innerHTML = `<span><i class="green"></i>Approved ${approved}</span><span><i class="orange"></i>Pending ${pending}</span><span><i class="red"></i>Rejected ${rejected}</span>`;
    const activity = buildActivityFeed(bodies[0].activity ?? [], bodies[2].activity ?? [], bodies[1].activity ?? []);
    root.querySelector('.recent-list').innerHTML = activity.length ? activity.slice(0, 4).map((item) => `<div class="recent-row"><i class="recent-icon ${item.icon}">${icon(item.icon === 'alert' ? 'bi-shield-exclamation' : item.icon === 'shield' ? 'bi-shield-check' : item.icon === 'user' ? 'bi-person-plus' : 'bi-arrow-repeat')}</i><div><strong>${item.title}</strong><p>${item.detail.replace(/^\[|\]$/g, '')}</p></div><time>${item.time}</time></div>`).join('') : '<div class="zero-state">No recent activity yet.</div>';
    root.querySelector('.status')?.remove();
    applyAdminPrivacy(root);
  } catch (error) {
    const recent = root.querySelector('.recent-list');
    if (recent) recent.innerHTML = `<div class="zero-state">${error.message}</div>`;
  }
}

