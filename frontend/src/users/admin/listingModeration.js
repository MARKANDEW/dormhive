import { ensureAdminSidebarStyles, renderAdminSidebar } from './sidebarAdmin.js';
import { applyAdminPrivacy } from './privacy.js';

const API = window.DORMHIVE_API_URL ?? 'http://localhost:5000/api/v1';
const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('dormhive.accessToken') ?? ''}` });
const esc = (value = '') => { const e = document.createElement('span'); e.textContent = value; return e.innerHTML; };

function css() {
  if (!document.querySelector('[data-admin-style="moderation"]')) {
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = new URL('./style/listingModeration.css', import.meta.url);
    l.dataset.adminStyle = 'moderation';
    document.head.append(l);
  }
}

export function renderListingModeration(root = document.querySelector('#app')) {
  if (!root) throw new Error('Listing moderation requires #app.');
  css();
  ensureAdminSidebarStyles();

  root.innerHTML = `
    <div class="admin-shell">
      ${renderAdminSidebar('listingModeration')}
      <div class="admin-main">
        <main class="moderation-page">
          <header class="moderation-header">
            <div>
              <h1>Listing Moderation: Pending Approvals</h1>
            </div>
          </header>

          <section class="moderation-content">
            <div class="toolbar">
              <label class="search-field">
                <span>⌕</span>
                <input id="moderation-search" type="search" placeholder="Search" />
              </label>
              <label class="filter-field">
                <span>Filter by Type</span>
                <select id="moderation-filter">
                  <option value="all">All Types</option>
                  <option value="bedspace">Bedspace</option>
                  <option value="private_room">Solo Room</option>
                  <option value="entire_unit">Studio Unit</option>
                </select>
              </label>
              <button class="bulk-actions" type="button">Bulk Actions</button>
            </div>
            <div class="moderation-tabs" role="tablist">
              <button type="button" class="moderation-tab active" data-status="pending">Pending Approvals</button>
              <button type="button" class="moderation-tab" data-status="approved">Approved Listings</button>
              <button type="button" class="moderation-tab" data-status="rejected">Rejected Listings</button>
            </div>
            <div id="moderation-status" class="moderation-status"></div>

            <div class="moderation-layout">
              <section class="table-shell">
                <table class="moderation-table">
                  <thead>
                    <tr>
                      <th><input type="checkbox" aria-label="Select all" /></th>
                      <th>Thumbnail</th>
                      <th>Property Name</th>
                      <th>Owner Name</th>
                      <th>Type</th>
                      <th>Rent (PHP)</th>
                      <th>Submitted Date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody id="moderation-rows"></tbody>
                </table>
                <div class="pagination">
                  <button type="button">‹</button>
                  <button type="button" class="active">1</button>
                  <button type="button">›</button>
                </div>
              </section>

              <aside id="detail-panel" class="detail-panel">
                <div class="photo-grid" id="detail-photos">
                  <div class="thumb"></div>
                  <div class="thumb"></div>
                  <div class="thumb"></div>
                  <div class="thumb"></div>
                  <div class="thumb"></div>
                  <div class="thumb"></div>
                </div>
                <div class="detail-body">
                  <h2 id="detail-name">Select a listing</h2>
                  <p id="detail-address">No property selected.</p>
                  <p class="detail-meta">📍 <span id="detail-location">Waiting for backend data…</span></p>
                  <p class="detail-meta">👤 <span id="detail-owner">Owner details will appear here.</span></p>
                  <p class="detail-meta">🟡 <span id="detail-status">Status pending review</span></p>
                  <div class="detail-extra" id="detail-extra"></div>
                  <div class="detail-actions">
                    <button type="button" class="secondary owner-contact">Owner Contact</button>
                    <button type="button" class="primary approve">Approve</button>
                    <button type="button" class="danger reject">Reject</button>
                    <button type="button" class="primary view-listing hidden">View Listing</button>
                  </div>
                </div>
              </aside>
            </div>
          </section>

          <div id="listing-view-modal" class="listing-view-modal" hidden>
            <div class="listing-view-card">
              <button type="button" class="modal-close" aria-label="Close listing details">×</button>
              <div class="modal-header">
                <div>
                  <p class="eyebrow">Property details</p>
                  <h2 id="modal-title">Listing details</h2>
                </div>
                <p id="modal-status" class="modal-status-text"></p>
              </div>
              <div class="modal-grid">
                <div class="modal-hero" id="modal-hero"></div>
                <div class="modal-info">
                  <p id="modal-address"></p>
                  <p id="modal-location"></p>
                  <p id="modal-owner"></p>
                  <p id="modal-type"></p>
                  <p id="modal-rent"></p>
                  <p id="modal-submitted"></p>
                  <p id="modal-occupants"></p>
                  <p id="modal-gender"></p>
                  <p id="modal-description"></p>
                  <div id="modal-amenities" class="amenity-list"></div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>`;

  const tbody = root.querySelector('#moderation-rows');
  const searchInput = root.querySelector('#moderation-search');
  const typeFilter = root.querySelector('#moderation-filter');
  const tabs = Array.from(root.querySelectorAll('.moderation-tab'));
  const headerTitle = root.querySelector('.moderation-header h1');
  const detailName = root.querySelector('#detail-name');
  const detailAddress = root.querySelector('#detail-address');
  const detailLocation = root.querySelector('#detail-location');
  const detailOwner = root.querySelector('#detail-owner');
  const detailStatus = root.querySelector('#detail-status');
  const detailExtra = root.querySelector('#detail-extra');
  const detailPhotos = root.querySelector('#detail-photos');
  const approveButton = root.querySelector('.detail-actions .approve');
  const rejectButton = root.querySelector('.detail-actions .reject');
  const viewButton = root.querySelector('.detail-actions .view-listing');
  const ownerContactButton = root.querySelector('.detail-actions .owner-contact');
  const statusLabel = root.querySelector('#moderation-status');
  const modal = root.querySelector('#listing-view-modal');
  const modalClose = root.querySelector('.modal-close');
  const modalTitle = root.querySelector('#modal-title');
  const modalStatusText = root.querySelector('#modal-status');
  const modalHero = root.querySelector('#modal-hero');
  const modalAddress = root.querySelector('#modal-address');
  const modalLocation = root.querySelector('#modal-location');
  const modalOwner = root.querySelector('#modal-owner');
  const modalType = root.querySelector('#modal-type');
  const modalRent = root.querySelector('#modal-rent');
  const modalSubmitted = root.querySelector('#modal-submitted');
  const modalOccupants = root.querySelector('#modal-occupants');
  const modalGender = root.querySelector('#modal-gender');
  const modalDescription = root.querySelector('#modal-description');
  const modalAmenities = root.querySelector('#modal-amenities');

  const statusLabels = {
    pending: 'Pending Approvals',
    approved: 'Approved Listings',
    rejected: 'Rejected Listings'
  };
  let currentStatus = 'pending';
  let rows = [];
  let selected = null;

  const apiBase = API.replace(/\/api\/v1\/?$/, '');
  const resolveImageUrl = (value = '') => {
    const url = String(value || '').trim();
    if (!url) return '';
    if (/^https?:\/\//i.test(url)) return url;
    return `${apiBase}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  const getThumbStyles = (row) => {
    const image = resolveImageUrl(row.image_url);
    return image ? `style="background-image:url('${image}')"` : '';
  };

  const formatCurrency = (value = 0) => `₱${Number(value ?? 0).toLocaleString()}`;
  const formatDate = (value) => new Date(value ?? Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const formatMeta = (row) => [row.address, row.municipality, row.barangay].filter(Boolean).join(', ');

  const setActiveTab = (status) => {
    currentStatus = status;
    tabs.forEach((button) => button.classList.toggle('active', button.dataset.status === status));
    headerTitle.textContent = `Listing Moderation: ${statusLabels[status] ?? 'Moderation'}`;
    clearSelection();
    load();
  };

  const updateDetailActions = () => {
    const isPending = selected?.status === 'pending';
    const isApprovedOrRejected = selected?.status === 'approved' || selected?.status === 'rejected';
    approveButton?.toggleAttribute('hidden', !isPending);
    rejectButton?.toggleAttribute('hidden', !isPending);
    viewButton?.classList.toggle('hidden', !isApprovedOrRejected);
    ownerContactButton?.classList.toggle('hidden', !selected);
    if (isApprovedOrRejected && selected) {
      viewButton.textContent = 'View Listing';
    }
  };

  const clearSelection = () => {
    selected = null;
    detailName.textContent = 'Select a listing';
    detailAddress.textContent = 'No property selected.';
    detailLocation.textContent = 'Waiting for backend data…';
    detailOwner.textContent = 'Owner details will appear here.';
    detailStatus.textContent = 'Status pending review';
    detailExtra.innerHTML = '';
    detailPhotos.innerHTML = `
      <div class="thumb"></div>
      <div class="thumb"></div>
      <div class="thumb"></div>
      <div class="thumb"></div>
      <div class="thumb"></div>
      <div class="thumb"></div>`;
    updateDetailActions();
  };

  const syncDetails = (row) => {
    if (!row) return clearSelection();
    selected = row;
    detailName.textContent = row.title || 'Untitled property';
    detailAddress.textContent = formatMeta(row) || 'Address unavailable';
    detailLocation.textContent = [row.municipality, row.barangay].filter(Boolean).join(', ') || 'Location unavailable';
    detailOwner.textContent = `Owner: ${row.owner_name || row.owner_id || 'Unknown owner'}`;
    detailStatus.textContent = String(row.status || 'pending').replaceAll('_', ' ');
    detailExtra.innerHTML = `
      <p data-privacy-mask="detail">Type: ${esc(String(row.room_type || 'Unknown').replaceAll('_', ' '))}</p>
      <p data-privacy-mask="stat">Rent: ${esc(formatCurrency(row.monthly_rent))}</p>
      <p>Submitted: ${esc(formatDate(row.created_at))}</p>`;
    applyAdminPrivacy(root);
    const imageUrl = resolveImageUrl(row.image_url);
    detailPhotos.innerHTML = imageUrl
      ? `<div class="thumb" style="background-image:url('${imageUrl}')"></div>` + Array.from({ length: 5 }, () => '<div class="thumb"></div>').join('')
      : Array.from({ length: 6 }, () => '<div class="thumb"></div>').join('');
    updateDetailActions();
  };

  const renderRows = () => {
    const query = searchInput.value.trim().toLowerCase();
    const filter = typeFilter.value;
    const visibleRows = rows.filter((row) => {
      const matchesQuery = !query || `${row.id} ${row.title} ${row.owner_name || ''} ${row.room_type || ''}`.toLowerCase().includes(query);
      const matchesType = filter === 'all' || String(row.room_type || '').toLowerCase() === filter.toLowerCase();
      return matchesQuery && matchesType;
    });

    tbody.innerHTML = visibleRows.map((row) => `
      <tr class="${selected?.id === row.id ? 'selected' : ''}">
        <td><input type="checkbox" data-id="${row.id}" /></td>
        <td><div class="thumbnail" ${getThumbStyles(row)}></div></td>
        <td data-privacy-mask="detail">${esc(row.title || 'Untitled property')}</td>
        <td data-privacy-mask="name">${esc(row.owner_name || 'Unknown owner')}</td>
        <td data-privacy-mask="detail">${esc(String(row.room_type || 'Unknown').replaceAll('_', ' '))}</td>
        <td data-privacy-mask="stat">${esc(formatCurrency(row.monthly_rent))}</td>
        <td>${esc(formatDate(row.created_at))}</td>
        <td class="action-icons"><button type="button" aria-label="View details">🔎</button></td>
      </tr>`).join('') || '<tr><td colspan="8" class="empty-row">No matching listings found.</td></tr>';

    applyAdminPrivacy(root);

    tbody.querySelectorAll('tr').forEach((rowEl) => {
      rowEl.addEventListener('click', (event) => {
        if (event.target.tagName === 'INPUT') return;
        const id = rowEl.querySelector('input')?.dataset.id;
        const row = rows.find((item) => item.id === Number(id));
        if (row) syncDetails(row);
      });
    });
  };

  const load = async () => {
    try {
      const response = await fetch(`${API}/properties?limit=100&status=${currentStatus}`, { headers: headers() });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? 'Unable to load listings.');
      rows = Array.isArray(body.data) ? body.data : [];
      if (!rows.length) {
        statusLabel.textContent = `No ${statusLabels[currentStatus].toLowerCase()} found.`;
        tbody.innerHTML = '<tr><td colspan="8" class="empty-row">No listings available for this tab.</td></tr>';
        clearSelection();
        return;
      }
      statusLabel.textContent = `Showing ${rows.length} ${statusLabels[currentStatus].toLowerCase()}.`;
      selected = rows[0];
      syncDetails(selected);
      renderRows();
    } catch (error) {
      statusLabel.textContent = error.message;
      clearSelection();
      detailName.textContent = 'Unable to load listing details';
      detailAddress.textContent = error.message;
      detailLocation.textContent = 'Authentication or API response issue.';
      detailOwner.textContent = 'Please sign in again with a valid admin session.';
      detailStatus.textContent = 'Unavailable';
    }
  };

  const updatePropertyStatus = async (status, reason = '') => {
    if (!selected) return;
    try {
      approveButton.disabled = rejectButton.disabled = true;
      const response = await fetch(`${API}/properties/${selected.id}/status`, {
        method: 'PATCH',
        headers: headers(),
        body: JSON.stringify({ status, rejectionReason: reason })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? `Unable to ${status} the property.`);

      // Persisted successfully on backend — update the UI immediately.
      const movedId = selected.id;
      const updatedRow = { ...selected, status };

      // If the property no longer belongs in the current tab, remove it.
      if (currentStatus !== status) {
        rows = rows.filter((r) => r.id !== movedId);
      } else {
        // If we remain on the same tab, replace the row with updated status.
        rows = rows.map((r) => (r.id === movedId ? updatedRow : r));
      }

      // Update the status label and table immediately.
      statusLabel.textContent = rows.length
        ? `Showing ${rows.length} ${statusLabels[currentStatus].toLowerCase()}.`
        : `No ${statusLabels[currentStatus].toLowerCase()} found.`;

      // If the selected row was removed, select the next one; otherwise refresh details.
      if (!rows.length) {
        clearSelection();
        tbody.innerHTML = '<tr><td colspan="8" class="empty-row">No listings available for this tab.</td></tr>';
      } else {
        if (!rows.find((r) => r.id === movedId)) {
          selected = rows[0];
          syncDetails(selected);
        } else {
          selected = rows.find((r) => r.id === movedId) || rows[0];
          syncDetails(selected);
        }
      }

      renderRows();
      statusLabel.textContent = `Listing ${status} successfully.`;
      approveButton.disabled = rejectButton.disabled = false;
    } catch (error) {
      statusLabel.textContent = error.message;
      approveButton.disabled = rejectButton.disabled = false;
    }
  };

  const openModal = () => {
    if (!selected) return;
    modalTitle.textContent = selected.title || 'Untitled property';
    modalStatusText.textContent = String(selected.status || 'pending').replaceAll('_', ' ');
    modalStatusText.className = `modal-status-text status-${selected.status}`;
    modalAddress.textContent = `Address: ${formatMeta(selected) || 'Unavailable'}`;
    modalLocation.textContent = `Location: ${[selected.municipality, selected.barangay].filter(Boolean).join(', ') || 'Unavailable'}`;
    modalOwner.textContent = `Owner: ${selected.owner_name || selected.owner_id || 'Unknown owner'}`;
    modalType.textContent = `Type: ${String(selected.room_type || 'Unknown').replaceAll('_', ' ')}`;
    modalRent.textContent = `Rent: ${formatCurrency(selected.monthly_rent)}`;
    modalSubmitted.textContent = `Submitted: ${formatDate(selected.created_at)}`;
    modalOccupants.textContent = selected.max_occupants ? `Max occupants: ${esc(String(selected.max_occupants))}` : '';
    modalGender.textContent = selected.gender_preference ? `Gender preference: ${esc(String(selected.gender_preference).replaceAll('_', ' '))}` : '';
    modalDescription.textContent = selected.description ? `Description: ${esc(selected.description)}` : 'No description provided.';
    modalAddress.setAttribute('data-privacy-mask', 'detail');
    modalLocation.setAttribute('data-privacy-mask', 'detail');
    modalOwner.setAttribute('data-privacy-mask', 'name');
    modalType.setAttribute('data-privacy-mask', 'detail');
    modalRent.setAttribute('data-privacy-mask', 'stat');
    modalOccupants.setAttribute('data-privacy-mask', 'stat');
    modalGender.setAttribute('data-privacy-mask', 'detail');
    modalDescription.setAttribute('data-privacy-mask', 'detail');
    applyAdminPrivacy(modal);
    const image = resolveImageUrl(selected.image_url);
    modalHero.style.backgroundImage = image ? `url('${image}')` : 'linear-gradient(135deg,#d7efe5,#f3f6f4)';
    const rawAmenities = selected.amenities;
    const amenities = rawAmenities && Array.isArray(rawAmenities)
      ? rawAmenities
      : typeof rawAmenities === 'string'
        ? (() => {
            try { return JSON.parse(rawAmenities); } catch { return rawAmenities.split(',').map((value) => value.trim()).filter(Boolean); }
          })()
        : [];
    modalAmenities.innerHTML = Array.isArray(amenities) && amenities.length
      ? amenities.map((item) => `<span class="amenity-chip">${esc(String(item).replace(/_/g, ' '))}</span>`).join('')
      : '<span class="amenity-chip">None</span>';
    modal.removeAttribute('hidden');
  };

  const closeModal = () => modal.setAttribute('hidden', '');

  tabs.forEach((button) => {
    button.addEventListener('click', () => setActiveTab(button.dataset.status));
  });
  approveButton?.addEventListener('click', () => updatePropertyStatus('approved'));
  rejectButton?.addEventListener('click', () => {
    const reason = window.prompt('Enter a rejection reason for the owner (optional):');
    if (reason === null) return;
    updatePropertyStatus('rejected', reason.trim());
  });
  viewButton?.addEventListener('click', openModal);
  modalClose?.addEventListener('click', closeModal);
  modal?.addEventListener('click', (event) => {
    if (event.target === modal) closeModal();
  });

  searchInput.addEventListener('input', renderRows);
  typeFilter.addEventListener('change', renderRows);
  load();
}



