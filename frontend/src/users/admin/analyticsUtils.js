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

export function buildActivityFeed(users = [], properties = [], bookings = []) {
  const activities = [];

  properties.forEach((property) => {
    const status = property.status || 'pending';
    if (['pending', 'approved', 'rejected'].includes(status)) {
      activities.push({
        title: status === 'pending' ? 'Property submitted' : `Property ${status}`,
        time: relativeTime(property.updated_at ?? property.created_at),
        detail: `[${property.title || 'Property'}]`,
        timestamp: Date.parse(property.updated_at ?? property.created_at ?? new Date().toISOString())
      });
    }
  });

  bookings.forEach((booking) => {
    if (['approved', 'rejected'].includes(booking.status)) {
      activities.push({
        title: `Booking ${booking.status}`,
        time: relativeTime(booking.updated_at ?? booking.created_at),
        detail: `[${booking.tenant_name || 'Tenant'}]`,
        timestamp: Date.parse(booking.updated_at ?? booking.created_at ?? new Date().toISOString())
      });
    }
  });

  users.forEach((user) => {
    activities.push({
      title: user.updated_at && user.updated_at !== user.created_at ? 'User profile updated' : 'New user registered',
      time: relativeTime(user.updated_at ?? user.created_at),
      detail: `[${user.name || user.email}]`,
      timestamp: Date.parse(user.updated_at ?? user.created_at ?? new Date().toISOString()),
      user
    });
  });

  return activities
    .sort((first, second) => Number(second.timestamp ?? 0) - Number(first.timestamp ?? 0));
}

function relativeTime(value) {
  const minutes = Math.max(0, Math.round((Date.now() - Date.parse(value)) / 60000));
  if (minutes < 60) return `${minutes} min${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}
