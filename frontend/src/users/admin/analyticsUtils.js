export function totalCount(rows = []) {
  return rows.reduce((sum, item) => sum + (Number(item?.count) || 0), 0);
}

export function countByRole(rows = [], role) {
  return Number(rows.find((item) => item?.role === role)?.count || 0);
}

export function countByStatus(rows = [], status) {
  return Number(rows.find((item) => item?.status === status)?.count || 0);
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
