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
    approvalRate: totalBookings ? Math.round((approvedBookings / totalBookings) * 100) : 0
  };
}

export function buildActivityFeed(users = [], properties = [], bookings = [], notifications = []) {
  const activities = [];

  properties.forEach((property) => {
    const status = String(property.status || 'pending').toLowerCase();
    if (!['pending', 'approved', 'rejected', 'archived'].includes(status)) return;
    const timestamp = Date.parse(property.updated_at ?? property.created_at);
    activities.push({
      icon: status === 'approved' ? 'shield' : status === 'pending' ? 'sync' : 'alert',
      title: status === 'pending' ? 'Property submitted' : `Property ${status}`,
      time: relativeTime(timestamp),
      detail: `[${property.title || 'Property'}]`,
      timestamp
    });
  });

  bookings.forEach((booking) => {
    const status = String(booking.status || 'pending').toLowerCase();
    if (!['pending', 'approved', 'rejected', 'cancelled'].includes(status)) return;
    const timestamp = Date.parse(booking.updated_at ?? booking.created_at);
    activities.push({
      icon: status === 'approved' ? 'user' : status === 'pending' ? 'sync' : 'alert',
      title: status === 'pending' ? 'Booking requested' : `Booking ${status}`,
      time: relativeTime(timestamp),
      detail: `[${booking.tenant_name || 'Tenant'}]`,
      timestamp
    });
  });

  users.forEach((user) => {
    const status = String(user.status || 'active').toLowerCase();
    if (!['active', 'suspended', 'archived'].includes(status)) return;
    const createdTimestamp = Date.parse(user.created_at);
    const updatedTimestamp = Date.parse(user.updated_at ?? user.created_at);
    const lastLoginTimestamp = Date.parse(user.last_login_at);
    const hasLogin = status === 'active' && Number.isFinite(lastLoginTimestamp);
    const timestamp = status === 'active' ? hasLogin ? lastLoginTimestamp : createdTimestamp : updatedTimestamp;
    activities.push({
      icon: status === 'active' ? (hasLogin ? 'sync' : 'user') : 'alert',
      title: status === 'suspended' ? 'User suspended' : status === 'archived' ? 'User archived' : hasLogin ? 'User logged in' : 'New user registered',
      time: relativeTime(timestamp),
      detail: `[${user.name || user.email || 'User'}]`,
      timestamp,
      user
    });
  });

  notifications.forEach((notification) => {
    const timestamp = Date.parse(notification.created_at);
    activities.push({
      icon: 'sync',
      title: notification.title || 'Notification sent',
      time: relativeTime(timestamp),
      detail: `[${notification.message || notification.recipient_name || 'Platform update'}]`,
      timestamp
    });
  });

  return activities
    .filter((activity) => Number.isFinite(activity.timestamp))
    .sort((first, second) => second.timestamp - first.timestamp);
}

function relativeTime(value) {
  if (!Number.isFinite(value)) return 'unknown';
  const minutes = Math.max(0, Math.round((Date.now() - value) / 60000));
  if (minutes < 60) return `${minutes} min${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}
