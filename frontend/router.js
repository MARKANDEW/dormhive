import { applyAdminPrivacy } from './src/users/admin/privacy.js';

const ROOT = () => document.querySelector('#app') || document.body;
const home = { tenant: '/tenant/dashboardTenant', owner: '/owner/dashboardOwner', admin: '/admin/dashboardAdmin' };
const routes = [
  ['/', 'public', './src/auth/home.js', 'renderHomePage'],
  ['/login', 'public', './src/auth/login.js', 'renderLogin'], ['/register', 'public', './src/auth/register.js', 'renderRegister'],
  ['/tenant/dashboardTenant', 'tenant', './src/users/tenant/dashboardTenant.js', 'renderDashboardTenant'], ['/tenant/booking', 'tenant', './src/users/tenant/booking.js', 'renderBooking'], ['/tenant/bookingDetails', 'tenant', './src/users/tenant/bookingDetails.js', 'renderBookingDetails'], ['/tenant/message', 'tenant', './src/users/tenant/message.js', 'renderMessage'], ['/tenant/setting', 'tenant', './src/users/tenant/setting.js', 'renderSetting'],
  ['/owner/dashboardOwner', 'owner', './src/users/owner/dashboardOwner.js', 'renderDashboardOwner'], ['/owner/myListing', 'owner', './src/users/owner/myListing.js', 'renderMyListing'], ['/owner/inquiries', 'owner', './src/users/owner/inquiries.js', 'renderInquiries'], ['/owner/activeTenant', 'owner', './src/users/owner/activeTenant.js', 'renderActiveTenant'], ['/owner/analytics', 'owner', './src/users/owner/analytics.js', 'renderAnalytics'], ['/owner/message', 'owner', './src/users/owner/message.js', 'renderMessage'], ['/owner/setting', 'owner', './src/users/owner/setting.js', 'renderSetting'],
  ['/admin/dashboardAdmin', 'admin', './src/users/admin/dashboardAdmin.js', 'renderDashboardAdmin'], ['/admin/userManagement', 'admin', './src/users/admin/userManagement.js', 'renderUserManagement'], ['/admin/listingModeration', 'admin', './src/users/admin/listingModeration.js', 'renderListingModeration'], ['/admin/systemHealth', 'admin', './src/users/admin/systemHealth.js', 'renderSystemHealth'], ['/admin/analytics', 'admin', './src/users/admin/analytics.js', 'renderAnalytics'], ['/admin/supportTickets', 'admin', './src/users/admin/supportTickets.js', 'renderSupportTickets'], ['/admin/setting', 'admin', './src/users/admin/setting.js', 'renderSetting'],
];
export function currentUser() { try { return JSON.parse(localStorage.getItem('dormhive.user')); } catch { return null; } }
export function redirectForRole(role) { return home[role] || '/'; }
export function navigate(path, replace = false) { const target = `#${path.startsWith('/') ? path : `/${path}`}`; history[replace ? 'replaceState' : 'pushState']({}, '', target); return renderRoute(); }
function routeLocation() { const hash = location.hash.replace(/^#/, ''); const [path, search = ''] = (hash || '/').split('?'); return { path: path || '/', search: search ? `?${search}` : '' }; }
export async function renderRoute() { const { path, search } = routeLocation(); const user = currentUser(); const publicRoutes = ['/', '/login', '/register']; if (path === '/' || path === '/login') { if (user) return navigate(redirectForRole(user.role), true); }
  const route = routes.find(([url]) => url === path);
  if (!route) return navigate(redirectForRole(user?.role), true);
  if (!user && !publicRoutes.includes(path)) return navigate('/login', true);
  if (user && publicRoutes.includes(path) && path !== '/') return navigate(redirectForRole(user.role), true);
  window.DORMHIVE_ROUTE_SEARCH = search;
  try {
    const module = await import(route[2]);
    module[route[3]](ROOT());
    if (path.startsWith('/admin/')) applyAdminPrivacy(ROOT());
  } catch (error) {
    ROOT().textContent = `Unable to load this page: ${error.message}`;
  }
}
export function installRouter() { addEventListener('hashchange', renderRoute); document.addEventListener('click', (event) => { const link = event.target.closest('a[href]'); if (!link || link.target || link.origin !== location.origin) return; const url = new URL(link.href); if (!url.hash.startsWith('#/')) return; event.preventDefault(); navigate(url.hash.slice(1)); }); }
export { routes };