import { applyAdminPrivacy } from './src/users/admin/privacy.js';

const ROOT = () => document.querySelector('#app') || document.body;
const home = { tenant: '/tenant/dashboardTenant', owner: '/owner/dashboardOwner', admin: '/admin/dashboardAdmin' };
const routes = [
  ['/', 'public', './src/auth/home.js', 'renderHomePage'],
  ['/login', 'public', './src/auth/login.js', 'renderLogin'], ['/register', 'public', './src/auth/register.js', 'renderRegister'], ['/terms', 'public', './src/auth/legal.js', 'renderTermsPage'], ['/privacy', 'public', './src/auth/legal.js', 'renderPrivacyPage'], ['/forgot-password', 'public', './src/auth/passwordReset.js', 'renderForgotPassword'], ['/reset-password', 'public', './src/auth/passwordReset.js', 'renderResetPassword'],
  ['/oauth/callback', 'public', './src/auth/oauthCallback.js', 'renderOAuthCallback'],
  ['/tenant/dashboardTenant', 'tenant', './src/users/tenant/dashboardTenant.js', 'renderDashboardTenant'], ['/tenant/featuredListings', 'tenant', './src/users/tenant/featuredListings.js', 'renderFeaturedListings'], ['/tenant/booking', 'tenant', './src/users/tenant/booking.js', 'renderBooking'], ['/tenant/message', 'tenant', './src/users/tenant/message.js', 'renderMessage'], ['/tenant/support', 'tenant', './src/users/tenant/support.js', 'renderSupport'], ['/tenant/setting', 'tenant', './src/users/tenant/setting.js', 'renderSetting'],
  ['/owner/dashboardOwner', 'owner', './src/users/owner/dashboardOwner.js', 'renderDashboardOwner'], ['/owner/myListing', 'owner', './src/users/owner/myListing.js', 'renderMyListing'], ['/owner/inquiries', 'owner', './src/users/owner/inquiries.js', 'renderInquiries'], ['/owner/activeTenant', 'owner', './src/users/owner/activeTenant.js', 'renderActiveTenant'], ['/owner/analytics', 'owner', './src/users/owner/analytics.js', 'renderAnalytics'], ['/owner/message', 'owner', './src/users/owner/message.js', 'renderMessage'], ['/owner/support', 'owner', './src/users/owner/support.js', 'renderSupport'], ['/owner/setting', 'owner', './src/users/owner/setting.js', 'renderSetting'],
  ['/admin/dashboardAdmin', 'admin', './src/users/admin/dashboardAdmin.js', 'renderDashboardAdmin'], ['/admin/userManagement', 'admin', './src/users/admin/userManagement.js', 'renderUserManagement'], ['/admin/listingModeration', 'admin', './src/users/admin/listingModeration.js', 'renderListingModeration'], ['/admin/analytics', 'admin', './src/users/admin/analytics.js', 'renderAnalytics'], ['/admin/supportTickets', 'admin', './src/users/admin/supportTickets.js', 'renderSupportTickets'], ['/admin/archive', 'admin', './src/users/admin/archive.js', 'renderArchive'], ['/admin/setting', 'admin', './src/users/admin/setting.js', 'renderSetting'],
];
const authStyledRoutes = new Set(['/login', '/register', '/terms', '/privacy', '/forgot-password', '/reset-password']);
const ownerStylesByPath = {
  '/owner/dashboardOwner': ['dashboard'],
  '/owner/myListing': ['listings'],
  '/owner/inquiries': ['inquiries'],
  '/owner/activeTenant': ['tenants'],
  '/owner/analytics': ['analytics'],
  '/owner/message': ['message'],
  '/owner/support': ['owner-support'],
  '/owner/setting': ['setting'],
};
export function currentUser() { try { return JSON.parse(localStorage.getItem('dormhive.user')); } catch { return null; } }
export function redirectForRole(role) { return home[role] || '/'; }
export function navigate(path, replace = false) { const target = `#${path.startsWith('/') ? path : `/${path}`}`; history[replace ? 'replaceState' : 'pushState']({}, '', target); return renderRoute(); }
function routeLocation() { const hash = location.hash.replace(/^#/, ''); const [path, search = ''] = (hash || '/').split('?'); return { path: path || '/', search: search ? `?${search}` : '' }; }
let routeRenderId = 0;
let realtimeRefreshTimer;
const routeIntervals = new Set();
const nativeSetInterval = window.setInterval.bind(window);
window.setInterval = (...args) => {
  const intervalId = nativeSetInterval(...args);
  routeIntervals.add(intervalId);
  return intervalId;
};
function clearRouteIntervals() {
  routeIntervals.forEach((intervalId) => window.clearInterval(intervalId));
  routeIntervals.clear();
}
function syncOwnerStyles(path) {
  const activeStyles = new Set(path.startsWith('/owner/') ? ['shared', ...(ownerStylesByPath[path] ?? [])] : []);
  document.querySelectorAll('link[data-owner-style]').forEach((link) => {
    if (!activeStyles.has(link.dataset.ownerStyle)) link.remove();
  });
}
function syncAuthStyles(path) {
  if (authStyledRoutes.has(path)) return;
  document.querySelectorAll('link[data-dormhive-auth], link[data-dormhive-legal], link[data-password-reset-style]').forEach((link) => link.remove());
}
function resetAdminScroll() {
  window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  const adminMain = ROOT().querySelector('.admin-main');
  adminMain?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  return adminMain;
}
function captureRouteUi() {
  const root = ROOT();
  const fields = [...root.querySelectorAll('input, textarea, select')]
    .filter((field) => field.type !== 'file')
    .map((field) => ({
      value: field.value,
      checked: 'checked' in field ? field.checked : undefined,
      start: typeof field.selectionStart === 'number' ? field.selectionStart : undefined,
      end: typeof field.selectionEnd === 'number' ? field.selectionEnd : undefined,
    }));
  return {
    fields,
    windowX: window.scrollX,
    windowY: window.scrollY,
    mainScroll: root.querySelector('main')?.scrollTop ?? 0,
    adminScroll: root.querySelector('.admin-main')?.scrollTop ?? 0,
  };
}
function restoreRouteUi(state) {
  const root = ROOT();
  [...root.querySelectorAll('input, textarea, select')]
    .filter((field) => field.type !== 'file')
    .forEach((field, index) => {
      const saved = state.fields[index];
      if (!saved) return;
      field.value = saved.value;
      if (saved.checked !== undefined) field.checked = saved.checked;
      if (saved.start !== undefined) field.setSelectionRange(saved.start, saved.end);
      field.dispatchEvent(new Event(field instanceof HTMLSelectElement || field.type === 'checkbox' ? 'change' : 'input', { bubbles: true }));
    });
  window.scrollTo({ left: state.windowX, top: state.windowY, behavior: 'auto' });
  const main = root.querySelector('main');
  if (main) main.scrollTop = state.mainScroll;
  const adminMain = root.querySelector('.admin-main');
  if (adminMain) adminMain.scrollTop = state.adminScroll;
  window.setTimeout(() => {
    const currentAdminMain = root.querySelector('.admin-main');
    if (currentAdminMain) currentAdminMain.scrollTop = state.adminScroll;
  }, 150);
}
let pendingDataRefreshObserver;
const hasOpenOwnerWorkflowModal = () => Boolean(ROOT().querySelector(
  '#property-modal:not([hidden]), #listing-success-modal:not([hidden]), #property-action-confirm:not([hidden]), .property-details-modal'
));
async function refreshRouteForDataChange() {
  if (hasOpenOwnerWorkflowModal()) {
    if (!pendingDataRefreshObserver) {
      pendingDataRefreshObserver = new MutationObserver(() => {
        if (hasOpenOwnerWorkflowModal()) return;
        pendingDataRefreshObserver.disconnect();
        pendingDataRefreshObserver = undefined;
        refreshRouteForDataChange();
      });
      pendingDataRefreshObserver.observe(ROOT(), { attributes: true, attributeFilter: ['hidden'], childList: true, subtree: true });
    }
    return;
  }
  const currentPath = routeLocation().path;
  const state = captureRouteUi();
  await renderRoute({ showSkeleton: false });
  if (routeLocation().path === currentPath) restoreRouteUi(state);
}
export async function renderRoute({ showSkeleton = true } = {}) {
  if (location.hash && !location.hash.startsWith('#/')) return;
  clearRouteIntervals();
  const renderId = ++routeRenderId; const { path, search } = routeLocation(); const user = currentUser(); const publicRoutes = ['/', '/login', '/register', '/terms', '/privacy', '/forgot-password', '/reset-password', '/oauth/callback']; if (path === '/login' && user) return navigate(redirectForRole(user.role), true);
  const route = routes.find(([url]) => url === path);
  if (!route) return navigate(redirectForRole(user?.role), true);
  if (!user && !publicRoutes.includes(path)) return navigate('/login', true);
  if (user && publicRoutes.includes(path) && path !== '/' && !['/terms', '/privacy'].includes(path)) return navigate(redirectForRole(user.role), true);
  syncOwnerStyles(path);
  if (path.startsWith('/admin/')) resetAdminScroll();
  window.DORMHIVE_ROUTE_SEARCH = search;
  const authRouteSkeletonDisabled = ['/login', '/register', '/terms', '/privacy', '/forgot-password', '/reset-password', '/oauth/callback'].includes(path);
  if (showSkeleton && !authRouteSkeletonDisabled) {
    const { renderRouteSkeleton } = await import('./src/components/pageSkeleton.js');
    renderRouteSkeleton(ROOT(), path);
  }
  syncAuthStyles(path);
  try {
    const module = await import(`${route[2]}?routeRender=${renderId}`);
    await module[route[3]](ROOT());
    syncOwnerStyles(routeLocation().path);
    if (renderId !== routeRenderId) return;
    if (path.startsWith('/admin/')) {
      const adminMain = resetAdminScroll();
      requestAnimationFrame(() => resetAdminScroll());
      setTimeout(() => adminMain?.scrollTo({ top: 0, left: 0, behavior: 'auto' }), 100);
    }
    if (path.startsWith('/admin/')) applyAdminPrivacy(ROOT());
  } catch (error) {
    ROOT().textContent = `Unable to load this page: ${error.message}`;
  }
}
export function installRouter() { if ('scrollRestoration' in history) history.scrollRestoration = 'manual'; addEventListener('hashchange', () => { if (location.hash.startsWith('#/')) renderRoute(); }); window.addEventListener('dormhive:data-changed', () => { clearTimeout(realtimeRefreshTimer); realtimeRefreshTimer = window.setTimeout(() => refreshRouteForDataChange(), 200); }); document.addEventListener('click', (event) => { const link = event.target.closest('a[href]'); if (!link || link.target || link.origin !== location.origin) return; const url = new URL(link.href); if (!url.hash.startsWith('#/')) return; event.preventDefault(); navigate(url.hash.slice(1)); }); }
export { routes };