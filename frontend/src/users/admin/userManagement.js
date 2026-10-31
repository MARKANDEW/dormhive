import { ensureAdminSidebarStyles, loadAdminStylesheet, renderAdminDateMeta, renderAdminSidebar } from './sidebarAdmin.js';
import { applyAdminPrivacy } from './privacy.js';
import { resolveUserAvatarUrl } from './avatar.js';
import { showToast } from '../../components/toast.js';
import { confirmDialog, createModal, openModal, successDialog, warningDialog } from '../../components/modal.js';

const API = window.DORMHIVE_API_URL ?? 'http://localhost:5000/api/v1';
const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('dormhive.accessToken') ?? ''}` });
const esc = (value = '') => { const element = document.createElement('span'); element.textContent = value; return element.innerHTML; };

function css() {
  const stylesheet = new URL('./style/userManagement.css', import.meta.url);
  stylesheet.searchParams.set('v', 'user-table-actions-16-2');
  return loadAdminStylesheet('users', stylesheet);
}

export async function renderUserManagement(root = document.querySelector('#app')) {
  if (!root) throw new Error('User management requires #app.');
  await Promise.all([css(), ensureAdminSidebarStyles()]);
  root.innerHTML = `
    <div class="admin-shell">
      ${renderAdminSidebar('userManagement')}
      <div class="admin-main">
        <main class="users-page">
          <header class="users-header">
            <div>
              <div class="users-kicker">Users</div>
              <h1>User management</h1>
              <p>Search and administer platform accounts.</p>
            </div>
            ${renderAdminDateMeta()}
          </header>
          <section class="users-content">
            <label class="users-search"><span aria-hidden="true">⌕</span><input type="search" placeholder="Search name or email" /></label>
            <div class="verification-tabs" role="tablist" aria-label="Filter users by verification status">
              <button class="verification-tab is-active" type="button" role="tab" aria-selected="true" data-verification-filter="pending">Pending review <span data-verification-count="pending">0</span></button>
              <button class="verification-tab" type="button" role="tab" aria-selected="false" data-verification-filter="approved">Approved <span data-verification-count="approved">0</span></button>
              <button class="verification-tab" type="button" role="tab" aria-selected="false" data-verification-filter="rejected">Rejected <span data-verification-count="rejected">0</span></button>
              <button class="verification-tab" type="button" role="tab" aria-selected="false" data-verification-filter="all">All users <span data-verification-count="all">0</span></button>
            </div>
            <p class="status" role="status">Loading users...</p>
            <section class="users-card">
              <div class="users-card-heading"><div class="users-card-title"><span class="users-card-icon" aria-hidden="true"><i class="bi bi-person"></i></span><div><h2>Platform Users</h2><p>Manage and view all registered users.</p></div></div><span class="users-total" data-total>0 total</span></div>
              <div class="table-wrap"><table><thead><tr><th>User</th><th class="role-sort-header" aria-sort="none"><button type="button" class="role-sort-button" aria-label="Sort users by role">Role <span class="role-sort-indicator" aria-hidden="true">↕</span></button></th><th>Status</th><th>Action</th></tr></thead><tbody></tbody></table></div>
              <nav class="users-pagination" aria-label="User list pagination"><span data-page-info>No users</span><div><button type="button" data-page-previous aria-label="Previous page">Previous</button><button type="button" data-page-next aria-label="Next page">Next</button></div></nav>
            </section>
          </section>
        </main>
      </div>
    </div>`;

  const mobileMenu = root.querySelector('.admin-mobile-menu');
  const usersKicker = root.querySelector('.users-kicker');
  if (mobileMenu && usersKicker) {
    const kickerRow = document.createElement('div');
    kickerRow.className = 'users-kicker-row';
    usersKicker.before(kickerRow);
    kickerRow.append(mobileMenu, usersKicker);
  }

  const input = root.querySelector('.users-search input');
  const body = root.querySelector('tbody');
  const status = root.querySelector('.status');
  const total = root.querySelector('[data-total]');
  const roleSortHeader = root.querySelector('.role-sort-header');
  const roleSortButton = root.querySelector('.role-sort-button');
  const roleSortIndicator = root.querySelector('.role-sort-indicator');
  const pageInfo = root.querySelector('[data-page-info]');
  const previousPageButton = root.querySelector('[data-page-previous]');
  const nextPageButton = root.querySelector('[data-page-next]');
  const pageSize = 10;
  let page = 1;
  let verificationFilter = 'pending';
  let roleSortDirection = 0;

  const updateVerificationStatus = async (user, decision, modal, button) => {
    button.disabled = true;
    try {
      const response = await fetch(`${API}/users/${encodeURIComponent(user.id)}/verification`, {
        method: 'PATCH',
        headers: headers(),
        body: JSON.stringify({ status: decision })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || 'Unable to update verification status.');
      modal.querySelector('.ui-modal__header [data-modal-close]')?.click();
      if (result.documentDeleted && result.emailNotification?.sent) {
        showToast({ message: result.message, type: 'success' });
      } else if (decision === 'approved' && result.documentDeleted) {
        await successDialog('The applicant can now sign in.', 'Account approved');
      } else if (decision === 'approved') {
        await warningDialog('Account approved', 'The applicant can sign in, but the uploaded ID could not be deleted. Contact support to remove it.');
      } else {
        await warningDialog('Account rejected', result.message);
      }
      await load();
    } catch (error) {
      showToast({ message: error.message, type: 'error' });
      button.disabled = false;
    }
  };

  const openVerificationDocument = async (user) => {
    const detailsResponse = await fetch(`${API}/users/${encodeURIComponent(user.id)}/verification-document`, { headers: headers() });
    const details = await detailsResponse.json().catch(() => ({}));
    if (!detailsResponse.ok) throw new Error(details.message || 'Unable to load the verification document.');
    const fileResponse = await fetch(`${API}/media/${encodeURIComponent(details.data.id)}`, {
      headers: { Authorization: headers().Authorization }
    });
    if (!fileResponse.ok) throw new Error('Unable to open the verification document.');

    const fileUrl = URL.createObjectURL(await fileResponse.blob());
    const documentPreview = document.createElement('div');
    documentPreview.className = 'verification-document-preview';
    if (details.data.mimeType.startsWith('image/')) {
      const image = document.createElement('img');
      image.src = fileUrl;
      image.alt = 'Uploaded identity document';
      documentPreview.append(image);
    } else {
      const frame = document.createElement('iframe');
      frame.src = fileUrl;
      frame.title = 'Uploaded identity document';
      frame.setAttribute('sandbox', '');
      documentPreview.append(frame);
    }
    const applicantFacts = document.createElement('dl');
    applicantFacts.className = 'verification-review-facts';
    applicantFacts.innerHTML = `<div><dt>Applicant</dt><dd>${esc(user.name || 'Unknown user')}</dd></div><div><dt>Email</dt><dd>${esc(user.email || 'Not provided')}</dd></div><div><dt>Account type</dt><dd>${esc(user.role || 'User')}</dd></div>`;
    const content = document.createElement('div');
    content.className = 'verification-review-content';
    content.append(applicantFacts, documentPreview);
    const modal = createModal({
      title: 'Review applicant verification',
      content,
      closeLabel: 'Cancel',
      footerMarkup: '<button type="button" class="verification-review-reject">Reject applicant</button><button type="button" class="verification-review-approve">Approve applicant</button>'
    });
    modal.classList.add('verification-review-modal');
    modal.addEventListener('close', () => URL.revokeObjectURL(fileUrl), { once: true });
    modal.querySelector('.verification-review-approve').addEventListener('click', (event) => updateVerificationStatus(user, 'approved', modal, event.currentTarget));
    modal.querySelector('.verification-review-reject').addEventListener('click', (event) => updateVerificationStatus(user, 'rejected', modal, event.currentTarget));
    await openModal(modal);
  };

  const load = async () => {
    try {
      const query = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
        search: input.value,
        verificationStatus: verificationFilter
      });
      const response = await fetch(`${API}/users?${query}`, { headers: headers() });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || 'Unable to load users.');
      const users = Array.isArray(payload.data) ? [...payload.data] : [];
      const totalUsers = Number(payload.pagination?.total ?? users.length);
      const totalPages = Math.max(1, Math.ceil(totalUsers / pageSize));
      if (page > totalPages) {
        page = totalPages;
        return load();
      }
      const counts = payload.counts ?? {};
      root.querySelectorAll('[data-verification-count]').forEach((count) => {
        const filter = count.dataset.verificationCount;
        const value = filter === 'all'
          ? Number(counts.pending ?? 0) + Number(counts.approved ?? 0) + Number(counts.rejected ?? 0)
          : Number(counts[filter] ?? 0);
        count.textContent = String(value);
      });
      if (roleSortDirection) {
        const roleOrder = { tenant: 0, owner: 1, admin: 2 };
        users.sort((left, right) => {
          const leftRank = roleOrder[String(left.role).toLowerCase()] ?? 3;
          const rightRank = roleOrder[String(right.role).toLowerCase()] ?? 3;
          return (leftRank - rightRank) * roleSortDirection;
        });
      }
      total.textContent = `${totalUsers} users`;
      pageInfo.textContent = totalUsers ? `Page ${page} of ${totalPages}` : 'No users';
      previousPageButton.disabled = page <= 1;
      nextPageButton.disabled = page >= totalPages || totalUsers === 0;
      status.hidden = true;
      const currentUser = JSON.parse(localStorage.getItem('dormhive.user') ?? '{}');
      body.innerHTML = users.map((user) => {
        const name = user.name || 'User';
        const avatar = resolveUserAvatarUrl(user.avatar_url || '', name);
        const fallbackAvatar = resolveUserAvatarUrl('', name);
        const verification = user.verification_status || 'approved';
        const active = user.status === 'active';
        const isCurrentUser = Number(currentUser.id) === Number(user.id);
        const isAdminUser = String(user.role).toLowerCase() === 'admin';
        const disableAction = isCurrentUser || isAdminUser;
        const canArchive = ['tenant', 'owner'].includes(String(user.role).toLowerCase()) && verification === 'approved';
        const accountStatus = verification === 'pending' ? 'Pending review' : verification === 'rejected' ? 'Rejected' : active ? 'Active' : 'Suspended';
        const statusClass = verification === 'pending' ? 'pending' : verification === 'rejected' || !active ? 'suspended' : 'active';
        const accountActions = verification === 'approved'
          ? `<div class="user-actions"><button class="user-status-button" data-id="${esc(user.id)}" data-status="${active ? 'suspended' : 'active'}" ${disableAction ? 'disabled title="Admin accounts cannot be suspended from this panel."' : ''}>${disableAction ? 'Locked' : (active ? 'Suspend' : 'Activate')}</button>${canArchive ? `<button class="user-status-button user-archive-button" data-archive-id="${esc(user.id)}" ${disableAction ? 'disabled title="You cannot archive your own account."' : ''}>Archive</button>` : ''}</div>`
          : verification === 'pending'
            ? `<div class="user-actions"><button class="verification-review-button" data-verification-review-id="${esc(user.id)}"><i class="bi bi-card-checklist" aria-hidden="true"></i>Review</button></div>`
            : '—';
        return `<tr><td data-label="User"><div class="user-table-cell"><img class="user-row-avatar" src="${esc(avatar)}" alt="${esc(name)} avatar" onerror="this.onerror=null;this.src='${esc(fallbackAvatar)}'" /><div><strong data-privacy-mask="name">${esc(name)}</strong><small data-privacy-mask="email">${esc(user.email)}</small></div></div></td><td data-label="Role">${esc(user.role)}</td><td data-label="Status"><span class="pill ${statusClass}"><i aria-hidden="true"></i>${esc(accountStatus)}</span></td><td data-label="Action">${accountActions}</td></tr>`;
      }).join('') || '<tr><td colspan="4" class="empty-row">No users found.</td></tr>';
      applyAdminPrivacy(root);
      body.querySelectorAll('.verification-review-button').forEach((button) => button.addEventListener('click', async () => {
        button.disabled = true;
        try {
          const user = users.find((item) => String(item.id) === button.dataset.verificationReviewId);
          if (user) await openVerificationDocument(user);
        } catch (error) {
          showToast({ message: error.message, type: 'error' });
        } finally {
          button.disabled = false;
        }
      }));
      body.querySelectorAll('.user-status-button').forEach((button) => button.addEventListener('click', async () => {
        if (button.disabled) return;
        if (button.dataset.archiveId) {
          const confirmed = await confirmDialog({
            title: 'Archive account?',
            message: 'This account will no longer be able to sign in. You can restore it later from the Archive page.',
            confirmLabel: 'Archive account'
          });
          if (!confirmed) return;
          button.disabled = true;
          try {
            const response = await fetch(`${API}/users/${button.dataset.archiveId}`, { method: 'DELETE', headers: headers() });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.message || 'Unable to archive account.');
            showToast({ message: 'Account archived successfully.', type: 'success' });
            await load();
          } catch (error) {
            status.textContent = error.message;
            status.hidden = false;
            button.disabled = false;
          }
          return;
        }
        button.disabled = true;
        const response = await fetch(`${API}/users/${button.dataset.id}`, { method: 'PATCH', headers: headers(), body: JSON.stringify({ status: button.dataset.status }) });
        if (!response.ok) { const error = await response.json(); status.textContent = error.message || 'Unable to update user.'; status.hidden = false; }
        await load();
      }));
    } catch (error) {
      status.textContent = error.message;
      status.hidden = false;
    }
  };

  roleSortButton.addEventListener('click', () => {
    roleSortDirection = roleSortDirection === 1 ? -1 : 1;
    roleSortHeader.setAttribute('aria-sort', roleSortDirection === 1 ? 'ascending' : 'descending');
    roleSortIndicator.textContent = roleSortDirection === 1 ? '↑' : '↓';
    roleSortButton.setAttribute('aria-label', `Sort users by role ${roleSortDirection === 1 ? 'ascending' : 'descending'}`);
    load();
  });

  root.querySelectorAll('[data-verification-filter]').forEach((button) => button.addEventListener('click', () => {
    verificationFilter = button.dataset.verificationFilter;
    page = 1;
    root.querySelectorAll('[data-verification-filter]').forEach((tab) => {
      const selected = tab === button;
      tab.classList.toggle('is-active', selected);
      tab.setAttribute('aria-selected', String(selected));
    });
    load();
  }));
  previousPageButton.addEventListener('click', () => { if (page > 1) { page -= 1; load(); } });
  nextPageButton.addEventListener('click', () => { page += 1; load(); });
  input.addEventListener('input', () => { clearTimeout(input.timer); page = 1; input.timer = setTimeout(load, 250); });
  load();
}
