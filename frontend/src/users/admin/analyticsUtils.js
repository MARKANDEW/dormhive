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

export function buildActivityFeed(users = []) {
  return users
    .map((user) => ({
      title: user.updated_at && user.updated_at !== user.created_at ? 'User profile updated' : 'New user registered',
      time: relativeTime(user.updated_at ?? user.created_at),
      user
    }))
    .sort((first, second) => Date.parse(second.user.updated_at ?? second.user.created_at) - Date.parse(first.user.updated_at ?? first.user.created_at));
}

function relativeTime(value) {
  const minutes = Math.max(0, Math.round((Date.now() - Date.parse(value)) / 60000));
  if (minutes < 60) return `${minutes} min${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}
