import { ensureAdminSidebarStyles, loadAdminStylesheet, renderAdminDateMeta, renderAdminSidebar } from './sidebarAdmin.js';
import { applyAdminPrivacy } from './privacy.js';
import { confirmDialog, createModal, openModal as openUiModal, successDialog } from '../../components/modal.js';
import { showToast } from '../../components/toast.js';
import { withMediaAccessToken } from '../../services/mediaAccess.js';

const API = window.DORMHIVE_API_URL ?? 'http://localhost:5000/api/v1';
const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('dormhive.accessToken') ?? ''}` });
const esc = (value = '') => { const e = document.createElement('span'); e.textContent = value; return e.innerHTML; };
const ROOM_TYPE_LABELS = {
  bedspace: 'Bedspace',
  private_room: 'Solo Room',
  'private room': 'Solo Room',
  solo_room: 'Solo Room',
  'solo room': 'Solo Room',
  entire_unit: 'Studio Unit',
  'entire unit': 'Studio Unit',
  studio_unit: 'Studio Unit',
  'studio unit': 'Studio Unit',
  bed_space: 'Bedspace',
  shared_room: 'Bedspace'
};
const formatRoomType = (value = '') => {
  const type = String(value ?? '').trim();
  const normalized = type.toLowerCase();
  return ROOM_TYPE_LABELS[normalized]
    ?? (type.replace(/[_-]+/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase()) || 'Not specified');
};

let pdfjsPromise;
const loadPdfJs = () => {
  if (!pdfjsPromise) {
    pdfjsPromise = import('../../../node_modules/pdfjs-dist/build/pdf.mjs').then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL('../../../node_modules/pdfjs-dist/build/pdf.worker.mjs', import.meta.url).href;
      return pdfjs;
    });
  }
  return pdfjsPromise;
};

const createPdfProofViewer = (fileUrl, filename) => {
  const element = document.createElement('div');
  element.className = 'ownership-proof-pdf-viewer';
  element.innerHTML = `
    <aside class="ownership-proof-pdf-sidebar" aria-label="PDF pages">
      <div class="ownership-proof-pdf-thumbnails"></div>
    </aside>
    <section class="ownership-proof-pdf-main">
      <div class="ownership-proof-pdf-toolbar" role="toolbar" aria-label="PDF controls">
        <button type="button" class="pdf-toggle-pages" aria-label="Toggle page thumbnails" aria-expanded="true" title="Toggle page thumbnails"><i class="bi bi-layout-sidebar" aria-hidden="true"></i></button>
        <div class="pdf-page-controls">
          <span>Page</span>
          <input class="pdf-current-page" type="number" min="1" value="1" aria-label="Current page">
          <span>/ <span class="pdf-page-count">0</span></span>
          <button type="button" class="pdf-previous-page" aria-label="Previous page" title="Previous page"><i class="bi bi-chevron-left" aria-hidden="true"></i></button>
          <button type="button" class="pdf-next-page" aria-label="Next page" title="Next page"><i class="bi bi-chevron-right" aria-hidden="true"></i></button>
        </div>
        <span class="pdf-toolbar-divider" aria-hidden="true"></span>
        <button type="button" class="pdf-zoom-out" aria-label="Zoom out" title="Zoom out"><i class="bi bi-dash-lg" aria-hidden="true"></i></button>
        <output class="pdf-zoom-level" aria-live="polite">100%</output>
        <button type="button" class="pdf-zoom-in" aria-label="Zoom in" title="Zoom in"><i class="bi bi-plus-lg" aria-hidden="true"></i></button>
        <button type="button" class="pdf-fit-page" aria-label="Fit page" title="Fit page"><i class="bi bi-arrows-angle-contract" aria-hidden="true"></i></button>
        <span class="pdf-toolbar-spacer"></span>
        <button type="button" class="pdf-print" aria-label="Print PDF" title="Print PDF"><i class="bi bi-printer" aria-hidden="true"></i></button>
        <a class="pdf-download" href="${fileUrl}" download="${esc(filename)}" aria-label="Download PDF" title="Download PDF"><i class="bi bi-download" aria-hidden="true"></i></a>
      </div>
      <div class="ownership-proof-pdf-viewport" aria-label="PDF document page">
        <p class="ownership-proof-pdf-status" role="status">Loading PDF…</p>
        <canvas class="ownership-proof-pdf-canvas" aria-label="PDF page"></canvas>
      </div>
    </section>`;

  const sidebar = element.querySelector('.ownership-proof-pdf-sidebar');
  const thumbnails = element.querySelector('.ownership-proof-pdf-thumbnails');
  const viewport = element.querySelector('.ownership-proof-pdf-viewport');
  const canvas = element.querySelector('.ownership-proof-pdf-canvas');
  const status = element.querySelector('.ownership-proof-pdf-status');
  const pageInput = element.querySelector('.pdf-current-page');
  const pageCount = element.querySelector('.pdf-page-count');
  const zoomLevel = element.querySelector('.pdf-zoom-level');
  const previousButton = element.querySelector('.pdf-previous-page');
  const nextButton = element.querySelector('.pdf-next-page');
  const zoomOutButton = element.querySelector('.pdf-zoom-out');
  const zoomInButton = element.querySelector('.pdf-zoom-in');
  const fitButton = element.querySelector('.pdf-fit-page');
  const togglePagesButton = element.querySelector('.pdf-toggle-pages');
  let pdfDocument;
  let currentPage = 1;
  let zoom = 1;
  let renderTask;
  let destroyed = false;

  const syncControls = () => {
    pageInput.value = String(currentPage);
    pageInput.max = String(pdfDocument.numPages);
    pageCount.textContent = String(pdfDocument.numPages);
    previousButton.disabled = currentPage <= 1;
    nextButton.disabled = currentPage >= pdfDocument.numPages;
    zoomOutButton.disabled = zoom <= 0.5;
    zoomInButton.disabled = zoom >= 3;
    zoomLevel.textContent = `${Math.round(zoom * 100)}%`;
  };

  const renderCurrentPage = async () => {
    if (!pdfDocument || destroyed) return;
    renderTask?.cancel();
    const page = await pdfDocument.getPage(currentPage);
    const baseViewport = page.getViewport({ scale: 1 });
    const fitScale = Math.min(1, Math.max(0.35, (viewport.clientWidth - 48) / baseViewport.width));
    const scale = fitScale * 1.333 * zoom;
    const pageViewport = page.getViewport({ scale });
    const outputScale = window.devicePixelRatio || 1;
    canvas.width = Math.ceil(pageViewport.width * outputScale);
    canvas.height = Math.ceil(pageViewport.height * outputScale);
    canvas.style.width = `${Math.ceil(pageViewport.width)}px`;
    canvas.style.height = `${Math.ceil(pageViewport.height)}px`;
    viewport.scrollTo({ top: 0, left: 0 });
    status.hidden = true;
    const task = page.render({
      canvas,
      viewport: pageViewport,
      transform: outputScale === 1 ? null : [outputScale, 0, 0, outputScale, 0, 0]
    });
    renderTask = task;
    try {
      await task.promise;
    } catch (error) {
      if (error.name !== 'RenderingCancelledException') throw error;
    }
    if (!destroyed) syncControls();
  };

  const renderThumbnails = async () => {
    for (let pageNumber = 1; pageNumber <= pdfDocument.numPages && !destroyed; pageNumber += 1) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'ownership-proof-pdf-thumbnail';
      button.setAttribute('aria-label', `Go to page ${pageNumber}`);
      button.setAttribute('aria-current', String(pageNumber === currentPage));
      const thumbnailCanvas = document.createElement('canvas');
      const label = document.createElement('span');
      label.textContent = String(pageNumber);
      button.append(thumbnailCanvas, label);
      button.addEventListener('click', () => {
        currentPage = pageNumber;
        thumbnails.querySelectorAll('button').forEach((item) => item.setAttribute('aria-current', String(item === button)));
        renderCurrentPage().catch((error) => { status.hidden = false; status.textContent = error.message; });
      });
      thumbnails.append(button);
      const page = await pdfDocument.getPage(pageNumber);
      const baseViewport = page.getViewport({ scale: 1 });
      const scale = Math.min(112 / baseViewport.width, 140 / baseViewport.height);
      const thumbnailViewport = page.getViewport({ scale });
      thumbnailCanvas.width = Math.ceil(thumbnailViewport.width);
      thumbnailCanvas.height = Math.ceil(thumbnailViewport.height);
      await page.render({ canvas: thumbnailCanvas, viewport: thumbnailViewport }).promise;
    }
  };

  pageInput.addEventListener('change', () => {
    currentPage = Math.min(pdfDocument.numPages, Math.max(1, Number(pageInput.value) || 1));
    thumbnails.querySelectorAll('button').forEach((button, index) => button.setAttribute('aria-current', String(index + 1 === currentPage)));
    renderCurrentPage().catch((error) => { status.hidden = false; status.textContent = error.message; });
  });
  previousButton.addEventListener('click', () => {
    if (currentPage > 1) currentPage -= 1;
    thumbnails.querySelectorAll('button').forEach((button, index) => button.setAttribute('aria-current', String(index + 1 === currentPage)));
    renderCurrentPage().catch((error) => { status.hidden = false; status.textContent = error.message; });
  });
  nextButton.addEventListener('click', () => {
    if (currentPage < pdfDocument.numPages) currentPage += 1;
    thumbnails.querySelectorAll('button').forEach((button, index) => button.setAttribute('aria-current', String(index + 1 === currentPage)));
    renderCurrentPage().catch((error) => { status.hidden = false; status.textContent = error.message; });
  });
  zoomOutButton.addEventListener('click', () => { zoom = Math.max(0.5, zoom - 0.25); renderCurrentPage(); });
  zoomInButton.addEventListener('click', () => { zoom = Math.min(3, zoom + 0.25); renderCurrentPage(); });
  fitButton.addEventListener('click', () => { zoom = 1; renderCurrentPage(); });
  togglePagesButton.addEventListener('click', () => {
    const isOpen = !element.classList.toggle('pages-hidden');
    togglePagesButton.setAttribute('aria-expanded', String(isOpen));
    renderCurrentPage();
  });
  element.querySelector('.pdf-print').addEventListener('click', () => {
    const printWindow = window.open(fileUrl, '_blank', 'noopener');
    printWindow?.addEventListener('load', () => printWindow.print(), { once: true });
  });

  return {
    element,
    async load() {
      const pdfjs = await loadPdfJs();
      pdfDocument = await pdfjs.getDocument({ url: fileUrl }).promise;
      await renderCurrentPage();
      renderThumbnails().catch((error) => { status.hidden = false; status.textContent = error.message; });
    },
    async destroy() {
      destroyed = true;
      renderTask?.cancel();
      await pdfDocument?.destroy();
    }
  };
};

function css() {
  const stylesheet = new URL('./style/listingModeration.css', import.meta.url);
  stylesheet.searchParams.set('v', 'moderation-ownership-proof-1');
  return loadAdminStylesheet('moderation', stylesheet);
}

export async function renderListingModeration(root = document.querySelector('#app')) {
  if (!root) throw new Error('Listing moderation requires #app.');
  await Promise.all([css(), ensureAdminSidebarStyles()]);
  const requestedStatus = new URLSearchParams(window.DORMHIVE_ROUTE_SEARCH || '').get('status');
  const initialStatus = ['pending', 'approved', 'rejected'].includes(requestedStatus) ? requestedStatus : 'pending';
  const initialStatusLabels = { pending: 'Pending Approvals', approved: 'Approved Listings', rejected: 'Rejected Listings' };
  const initialLabel = initialStatusLabels[initialStatus];

  root.innerHTML = `
    <div class="admin-shell">
      ${renderAdminSidebar('listingModeration')}
      <div class="admin-main">
        <main class="moderation-page">
          <header class="moderation-header">
            <div>
              <div class="moderation-kicker-row"><div class="moderation-kicker">Moderation</div></div>
              <h1>Listing Moderation: ${initialLabel}</h1>
              <p>Manage and review property listings submitted by users.</p>
            </div>
            ${renderAdminDateMeta()}
          </header>

          <section class="moderation-content">
            <div class="toolbar">
              <label class="search-field">
                <span>⌕</span>
                <input id="moderation-search" type="search" placeholder="Search listings by property name, owner, or location..." />
              </label>
              <label class="filter-field">
                <select id="moderation-filter">
                  <option value="all">All Types</option>
                  <option value="bedspace">Bedspace</option>
                  <option value="private_room">Solo Room</option>
                  <option value="entire_unit">Studio Unit</option>
                </select>
              </label>
            </div>
            <div class="moderation-tabs" role="tablist">
              <button type="button" class="moderation-tab${initialStatus === 'pending' ? ' active' : ''}" data-status="pending">Pending Approvals</button>
              <button type="button" class="moderation-tab${initialStatus === 'approved' ? ' active' : ''}" data-status="approved">Approved Listings</button>
              <button type="button" class="moderation-tab${initialStatus === 'rejected' ? ' active' : ''}" data-status="rejected">Rejected Listings</button>
            </div>
            <div id="moderation-status" class="moderation-status"></div>

            <div class="moderation-layout">
              <section class="table-shell">
                <div class="table-heading">
                  <div class="table-heading-copy">
                    <div><h2 id="listing-card-title">${initialLabel}</h2><p id="listing-card-subtitle">Showing ${initialLabel.toLowerCase()}.</p></div>
                  </div>
                  <span id="listing-total" class="listing-total">0 total</span>
                </div>
                <table class="moderation-table">
                  <thead>
                    <tr>
                      <th>Thumbnail</th>
                      <th>Property Name</th>
                      <th>Owner Name</th>
                      <th>Type</th>
                      <th>Rent (PHP)</th>
                      <th>Submitted Date</th>
                      <th>View</th>
                    </tr>
                  </thead>
                  <tbody id="moderation-rows"></tbody>
                </table>
                <nav class="moderation-pagination" aria-label="Listing moderation pagination">
                  <span class="moderation-pagination-info" aria-live="polite">Showing 0 to 0 of 0 listings</span>
                  <div>
                    <button type="button" data-page-previous aria-label="Previous page" disabled>Previous</button>
                    <button type="button" data-page-next aria-label="Next page" disabled>Next</button>
                  </div>
                </nav>
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
                  <div class="detail-heading">
                    <h2 id="detail-name">Select a listing</h2>
                    <span class="detail-status"><span class="status-dot" aria-hidden="true"></span><span id="detail-status">Status pending review</span></span>
                  </div>
                  <div class="detail-location-row">
                    <i class="bi bi-geo-alt-fill" aria-hidden="true"></i>
                    <div><p id="detail-address">No property selected.</p><span id="detail-location">Waiting for backend data…</span></div>
                  </div>
                  <div class="detail-owner-row"><i class="bi bi-person-fill" aria-hidden="true"></i><span id="detail-owner">Owner details will appear here.</span></div>
                  <dl class="detail-extra" id="detail-extra"></dl>
                  <div class="detail-actions">
                      <button type="button" class="secondary owner-contact">Owner Contact</button>
                    <button type="button" class="primary approve">Review &amp; Approve</button>
                    <button type="button" class="danger reject">Reject</button>
                    <button type="button" class="primary view-listing hidden">View Full Listing</button>
                  </div>
                </div>
              </aside>
            </div>
          </section>

          <div class="approval-review-modal" hidden>
            <div class="approval-review-overlay" data-close-approval-review></div>
            <section class="approval-review-card" role="dialog" aria-modal="true" aria-labelledby="approval-review-title">
              <header class="approval-review-header">
                <div><span class="approval-review-icon"><i class="bi bi-shield-check" aria-hidden="true"></i></span><h2 id="approval-review-title">Review before approval</h2></div>
                <button type="button" class="approval-review-close" aria-label="Close approval review">×</button>
              </header>
              <div class="approval-review-content">
                <p class="approval-review-intro">Check the listing details and ownership proof before publishing.</p>
                <dl class="approval-review-facts">
                  <div><dt>Property</dt><dd data-approval-review="title"></dd></div>
                  <div><dt>Owner</dt><dd data-approval-review="owner"></dd></div>
                  <div><dt>Address</dt><dd data-approval-review="address"></dd></div>
                  <div><dt>Type</dt><dd data-approval-review="type"></dd></div>
                  <div><dt>Monthly rent</dt><dd data-approval-review="rent"></dd></div>
                  <div><dt>Availability</dt><dd data-approval-review="availability"></dd></div>
                </dl>
                <section class="ownership-proof-review">
                  <h3>Ownership or authorization proof</h3>
                  <p class="ownership-proof-review-message"></p>
                  <div class="ownership-proof-preview-card" hidden></div>
                  <button type="button" class="ownership-proof-open">Review proof</button>
                </section>
              </div>
              <footer class="approval-review-actions">
                <button type="button" class="approval-review-cancel">Cancel</button>
                <button type="button" class="approval-review-confirm" disabled>Confirm Approval</button>
              </footer>
            </section>
          </div>

          <div id="listing-view-modal" class="listing-view-modal" hidden>
            <div class="listing-view-card">
              <div class="listing-view-header">
                <h2><span class="listing-view-header-icon" aria-hidden="true"><i class="bi bi-house-door-fill"></i></span>Property Details</h2>
                <button type="button" class="modal-close" aria-label="Close listing details">×</button>
              </div>
              <div class="listing-view-content">
                <section class="listing-view-gallery" aria-label="Property photos">
                  <div class="listing-view-gallery-stage">
                    <img id="modal-hero" alt="Property photo">
                    <span id="modal-photo-counter" class="listing-view-photo-counter" aria-live="polite"></span>
                    <button type="button" id="modal-photo-previous" class="listing-view-gallery-nav previous" aria-label="Previous photo"><i class="bi bi-chevron-left" aria-hidden="true"></i></button>
                    <button type="button" id="modal-photo-next" class="listing-view-gallery-nav next" aria-label="Next photo"><i class="bi bi-chevron-right" aria-hidden="true"></i></button>
                  </div>
                  <div id="modal-photo-thumbnails" class="listing-view-thumbnails" role="group" aria-label="Property photo thumbnails"></div>
                </section>
                <section class="listing-view-information">
                  <div class="listing-view-heading">
                    <div><h3 id="modal-title">Listing details</h3><strong id="modal-rent"></strong></div>
                    <span id="modal-status" class="modal-status-text"></span>
                  </div>
                  <dl class="listing-view-facts">
                    <div><dt><i class="bi bi-geo-alt-fill" aria-hidden="true"></i>Address</dt><dd id="modal-address"></dd></div>
                    <div><dt><i class="bi bi-pin-map-fill" aria-hidden="true"></i>Location</dt><dd id="modal-location"></dd></div>
                    <div><dt><i class="bi bi-house-fill" aria-hidden="true"></i>Property type</dt><dd id="modal-type"></dd></div>
                    <div><dt><i class="bi bi-person-fill" aria-hidden="true"></i>Owner</dt><dd id="modal-owner"></dd></div>
                    <div><dt><i class="bi bi-door-open-fill" aria-hidden="true"></i>Availability</dt><dd id="modal-availability"></dd></div>
                    <div><dt><i class="bi bi-gender-ambiguous" aria-hidden="true"></i>Gender preference</dt><dd id="modal-gender"></dd></div>
                    <div><dt><i class="bi bi-calendar3" aria-hidden="true"></i>Submitted</dt><dd id="modal-submitted"></dd></div>
                  </dl>
                  <section class="listing-view-amenities"><h4>Amenities</h4><div id="modal-amenities" class="amenity-list"></div></section>
                  <section class="listing-view-description"><h4>Description</h4><p id="modal-description"></p></section>
                </section>
              </div>
              <div class="listing-view-footer"><button type="button" class="btn-secondary close-details">Close</button></div>
            </div>
          </div>
          <div id="approval-success-modal" class="approval-success-modal" hidden>
            <div class="approval-success-overlay"></div>
            <div class="approval-success-card" role="dialog" aria-modal="true" aria-labelledby="approval-success-title">
              <div class="approval-success-icon" aria-hidden="true"><span>✓</span></div>
              <h2 id="approval-success-title">Success!</h2>
              <p>Listing approved successfully.</p>
              <button type="button" class="approval-success-ok">OK</button>
            </div>
          </div>
        </main>
      </div>
    </div>`;

    const mobileMenu = root.querySelector('.admin-mobile-menu');
    const moderationKickerRow = root.querySelector('.moderation-kicker-row');
    if (mobileMenu && moderationKickerRow) moderationKickerRow.prepend(mobileMenu);

    const tbody = root.querySelector('#moderation-rows');
    const tableShell = root.querySelector('.table-shell');
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
  const ownershipProofReview = root.querySelector('.ownership-proof-review');
  const ownershipProofMessage = root.querySelector('.ownership-proof-review-message');
  const ownershipProofPreviewCard = root.querySelector('.ownership-proof-preview-card');
  const ownershipProofOpenButton = root.querySelector('.ownership-proof-open');
  const approvalReviewModal = root.querySelector('.approval-review-modal');
  const approvalReviewCloseButton = root.querySelector('.approval-review-close');
  const approvalReviewCancelButton = root.querySelector('.approval-review-cancel');
  const approvalReviewConfirmButton = root.querySelector('.approval-review-confirm');
  const approvalReviewFields = Object.fromEntries([...root.querySelectorAll('[data-approval-review]')].map((field) => [field.dataset.approvalReview, field]));
  const approveButton = root.querySelector('.detail-actions .approve');
  const rejectButton = root.querySelector('.detail-actions .reject');
  const viewButton = root.querySelector('.detail-actions .view-listing');
  const ownerContactButton = root.querySelector('.detail-actions .owner-contact');
  const statusLabel = root.querySelector('#moderation-status');
  const listingCardTitle = root.querySelector('#listing-card-title');
  const listingCardSubtitle = root.querySelector('#listing-card-subtitle');
  const listingTotal = root.querySelector('#listing-total');
  const paginationInfo = root.querySelector('.moderation-pagination-info');
  const previousPageButton = root.querySelector('[data-page-previous]');
  const nextPageButton = root.querySelector('[data-page-next]');
  const pageSize = 5;
  const modal = root.querySelector('#listing-view-modal');
  const approvalSuccessModal = root.querySelector('#approval-success-modal');
  const approvalSuccessOkButton = root.querySelector('.approval-success-ok');
  const modalClose = root.querySelector('.modal-close');
  const modalFooterClose = root.querySelector('.listing-view-footer .close-details');
  const modalTitle = root.querySelector('#modal-title');
  const modalStatusText = root.querySelector('#modal-status');
  const modalHero = root.querySelector('#modal-hero');
  const modalPhotoCounter = root.querySelector('#modal-photo-counter');
  const modalPhotoPrevious = root.querySelector('#modal-photo-previous');
  const modalPhotoNext = root.querySelector('#modal-photo-next');
  const modalPhotoThumbnails = root.querySelector('#modal-photo-thumbnails');
  const modalAddress = root.querySelector('#modal-address');
  const modalLocation = root.querySelector('#modal-location');
  const modalOwner = root.querySelector('#modal-owner');
  const modalType = root.querySelector('#modal-type');
  const modalRent = root.querySelector('#modal-rent');
  const modalSubmitted = root.querySelector('#modal-submitted');
  const modalAvailability = root.querySelector('#modal-availability');
  const modalGender = root.querySelector('#modal-gender');
  const modalDescription = root.querySelector('#modal-description');
  const modalAmenities = root.querySelector('#modal-amenities');

  approvalSuccessOkButton?.addEventListener('click', () => {
    approvalSuccessModal.hidden = true;
    document.body.classList.remove('approval-success-modal-open');
  });

  const statusLabels = {
    pending: 'Pending Approvals',
    approved: 'Approved Listings',
    rejected: 'Rejected Listings'
  };
  let currentStatus = initialStatus;
  let rows = [];
  let selected = null;
  let currentPage = 1;
  let reviewedProofPropertyId = null;
  let ownershipProofPropertyId = null;
  let ownershipProofFileUrl = null;
  let ownershipProofMimeType = '';
  let ownershipProofFilename = '';

  const apiBase = API.replace(/\/api\/v1\/?$/, '');
  const resolveImageUrl = (value = '') => {
    const url = String(value || '').trim();
    if (!url) return '';
    return withMediaAccessToken(/^https?:\/\//i.test(url) ? url : `${apiBase}${url.startsWith('/') ? '' : '/'}${url}`);
  };

  const getPropertyImages = (row = {}) => {
    let images = row.images;
    if (typeof images === 'string') {
      try { images = JSON.parse(images); } catch { images = []; }
    }
    const sources = [row.image_url, ...(Array.isArray(images) ? images : [])].filter(Boolean);
    return [...new Set(sources.map(resolveImageUrl).filter(Boolean))];
  };

  const getThumbStyles = (row) => {
    const image = resolveImageUrl(row.image_url);
    return image ? `style="background-image:url('${image}');background-position:center;background-size:cover;background-repeat:no-repeat"` : '';
  };

  let modalPhotoUrls = [];
  let modalPhotoIndex = 0;
  const renderListingModalGallery = () => {
    const imageUrl = modalPhotoUrls[modalPhotoIndex];
    modalHero.hidden = !imageUrl;
    if (imageUrl) {
      modalHero.src = imageUrl;
      modalHero.alt = `${selected?.title || 'Property'} photo ${modalPhotoIndex + 1}`;
    } else {
      modalHero.removeAttribute('src');
      modalHero.alt = 'No property photos available';
    }
    modalPhotoCounter.hidden = !imageUrl;
    modalPhotoCounter.textContent = imageUrl ? `${modalPhotoIndex + 1} / ${modalPhotoUrls.length}` : '';
    modalPhotoPrevious.hidden = modalPhotoUrls.length < 2;
    modalPhotoNext.hidden = modalPhotoUrls.length < 2;
    modalPhotoThumbnails.hidden = modalPhotoUrls.length < 2;
    modalPhotoThumbnails.replaceChildren(...modalPhotoUrls.map((url, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `listing-view-thumbnail${index === modalPhotoIndex ? ' active' : ''}`;
      button.setAttribute('aria-label', `View photo ${index + 1}`);
      button.setAttribute('aria-current', String(index === modalPhotoIndex));
      const image = document.createElement('img');
      image.src = url;
      image.alt = '';
      image.loading = 'lazy';
      button.append(image);
      button.addEventListener('click', () => {
        modalPhotoIndex = index;
        renderListingModalGallery();
      });
      return button;
    }));
  };

  const clearOwnershipProofPreview = () => {
    if (ownershipProofFileUrl) URL.revokeObjectURL(ownershipProofFileUrl);
    ownershipProofPropertyId = null;
    ownershipProofFileUrl = null;
    ownershipProofMimeType = '';
    ownershipProofFilename = '';
    ownershipProofPreviewCard.replaceChildren();
    ownershipProofPreviewCard.hidden = true;
    ownershipProofOpenButton.hidden = false;
    ownershipProofOpenButton.disabled = false;
    reviewedProofPropertyId = null;
  };

  const openOwnershipProof = async () => {
    const propertyId = selected?.id;
    if (!selected || !selected.has_ownership_proof || ownershipProofPropertyId !== propertyId || !ownershipProofFileUrl) return;

    const fileUrl = ownershipProofFileUrl;
    const preview = document.createElement('div');
    preview.className = 'ownership-proof-preview';
    let imageZoomControls = null;
    let pdfViewer = null;
    if (ownershipProofMimeType.startsWith('image/')) {
      const stage = document.createElement('div');
      stage.className = 'ownership-proof-image-stage';
      const image = document.createElement('img');
      image.src = fileUrl;
      image.alt = 'Proof of ownership or authorization';
      stage.append(image);

      const controls = document.createElement('div');
      controls.className = 'ownership-proof-image-controls';
      controls.setAttribute('role', 'group');
      controls.setAttribute('aria-label', 'Image zoom controls');
      const printButton = document.createElement('button');
      printButton.type = 'button';
      printButton.setAttribute('aria-label', 'Print image');
      printButton.title = 'Print image';
      printButton.innerHTML = '<i class="bi bi-printer" aria-hidden="true"></i>';
      const toolbarDivider = document.createElement('span');
      toolbarDivider.className = 'ownership-proof-toolbar-divider';
      toolbarDivider.setAttribute('aria-hidden', 'true');
      const zoomOutButton = document.createElement('button');
      zoomOutButton.type = 'button';
      zoomOutButton.setAttribute('aria-label', 'Zoom out');
      zoomOutButton.title = 'Zoom out';
      zoomOutButton.innerHTML = '<i class="bi bi-zoom-out" aria-hidden="true"></i>';
      const fitButton = document.createElement('button');
      fitButton.type = 'button';
      fitButton.setAttribute('aria-label', 'Fit image');
      fitButton.title = 'Fit image';
      fitButton.innerHTML = '<i class="bi bi-arrows-angle-contract" aria-hidden="true"></i>';
      const zoomInButton = document.createElement('button');
      zoomInButton.type = 'button';
      zoomInButton.setAttribute('aria-label', 'Zoom in');
      zoomInButton.title = 'Zoom in';
      zoomInButton.innerHTML = '<i class="bi bi-zoom-in" aria-hidden="true"></i>';
      const zoomLevel = document.createElement('output');
      zoomLevel.textContent = '100%';
      controls.append(printButton, toolbarDivider, zoomOutButton, zoomLevel, zoomInButton, fitButton);
      preview.append(controls, stage);

      imageZoomControls = { image, stage, printButton, zoomOutButton, fitButton, zoomInButton, zoomLevel };
    } else {
      pdfViewer = createPdfProofViewer(fileUrl, ownershipProofFilename);
      preview.append(pdfViewer.element);
    }
    const proofModal = createModal({ title: 'Review ownership proof', content: preview });
    proofModal.classList.add('ownership-proof-modal');
    const isImageProof = Boolean(imageZoomControls);
    proofModal.classList.add(isImageProof ? 'ownership-proof-image-modal' : 'ownership-proof-document-modal');
    proofModal.querySelector('.ui-modal__header h2').textContent = ownershipProofFilename;
    const proofIcon = document.createElement('span');
    proofIcon.className = isImageProof ? 'ownership-proof-image-icon' : 'ownership-proof-file-viewer-icon';
    proofIcon.setAttribute('aria-hidden', 'true');
    proofIcon.innerHTML = isImageProof
      ? '<i class="bi bi-image-fill"></i>'
      : '<i class="bi bi-file-earmark-pdf-fill"></i>';
    proofModal.querySelector('.ui-modal__header h2').before(proofIcon);
    await openUiModal(proofModal);
    document.documentElement.classList.add('ownership-proof-viewer-open');
    proofModal.addEventListener('close', () => {
      document.documentElement.classList.remove('ownership-proof-viewer-open');
      void pdfViewer?.destroy();
    }, { once: true });
    let proofLoaded = Boolean(imageZoomControls);
    if (imageZoomControls) {
      const { image, stage, printButton, zoomOutButton, fitButton, zoomInButton, zoomLevel } = imageZoomControls;
      let zoom = 1;
      const applyZoom = (nextZoom) => {
        zoom = Math.min(3, Math.max(1, nextZoom));
        if (image.naturalWidth && stage.clientWidth && stage.clientHeight) {
          const fitScale = Math.min(stage.clientWidth / image.naturalWidth, stage.clientHeight / image.naturalHeight, 1.25);
          image.style.width = `${Math.round(image.naturalWidth * fitScale * zoom)}px`;
          image.classList.toggle('is-zoomed', zoom > 1);
        }
        zoomLevel.textContent = `${Math.round(zoom * 100)}%`;
        zoomOutButton.disabled = zoom <= 1;
        zoomInButton.disabled = zoom >= 3;
      };
      zoomOutButton.addEventListener('click', () => applyZoom(zoom - 0.25));
      fitButton.addEventListener('click', () => applyZoom(1));
      zoomInButton.addEventListener('click', () => applyZoom(zoom + 0.25));
      printButton.addEventListener('click', () => window.print());
      image.addEventListener('load', () => applyZoom(zoom), { once: true });
      if (image.complete) applyZoom(zoom);
    }
    if (pdfViewer) {
      const status = pdfViewer.element.querySelector('.ownership-proof-pdf-status');
      try {
        await pdfViewer.load();
        proofLoaded = true;
      } catch (error) {
        status.hidden = false;
        status.textContent = `Unable to render this PDF: ${error.message}`;
      }
    }
    if (selected?.id === propertyId && proofLoaded) {
      reviewedProofPropertyId = propertyId;
      ownershipProofMessage.textContent = 'Proof opened. Confirm below to complete the approval.';
      updateDetailActions();
    }
  };

  const loadOwnershipProof = async () => {
    if (!selected || !selected.has_ownership_proof) return;
    const propertyId = selected.id;
    ownershipProofOpenButton.disabled = true;
    ownershipProofMessage.textContent = 'Loading proof preview…';
    try {
      const detailsResponse = await fetch(`${API}/properties/${encodeURIComponent(propertyId)}/ownership-document`, { headers: headers() });
      const details = await detailsResponse.json().catch(() => ({}));
      if (!detailsResponse.ok) throw new Error(details.message || 'Unable to load ownership proof.');
      const fileResponse = await fetch(`${API}/media/${encodeURIComponent(details.data.id)}`, {
        headers: { Authorization: headers().Authorization }
      });
      if (!fileResponse.ok) throw new Error('Unable to open ownership proof.');
      const blob = await fileResponse.blob();
      if (selected?.id !== propertyId) return;

      clearOwnershipProofPreview();
      ownershipProofPropertyId = propertyId;
      ownershipProofFileUrl = URL.createObjectURL(blob);
      ownershipProofMimeType = details.data.mimeType || blob.type;
      ownershipProofFilename = details.data.filename || 'Ownership proof';

      const previewButton = document.createElement('button');
      previewButton.type = 'button';
      previewButton.className = 'ownership-proof-preview-trigger';
      previewButton.setAttribute('aria-label', `Open ${ownershipProofFilename}`);
      if (ownershipProofMimeType.startsWith('image/')) {
        const thumbnail = document.createElement('img');
        thumbnail.src = ownershipProofFileUrl;
        thumbnail.alt = '';
        previewButton.append(thumbnail);
      } else {
        const fileIcon = document.createElement('span');
        fileIcon.className = 'ownership-proof-file-icon';
        fileIcon.innerHTML = '<i class="bi bi-file-earmark-pdf-fill" aria-hidden="true"></i>';
        previewButton.append(fileIcon);
      }
      const fileInfo = document.createElement('span');
      fileInfo.className = 'ownership-proof-file-info';
      const filename = document.createElement('strong');
      filename.textContent = ownershipProofFilename;
      const instruction = document.createElement('small');
      instruction.textContent = ownershipProofMimeType.startsWith('image/') ? 'Click to view image' : 'Click to open PDF';
      fileInfo.append(filename, instruction);
      previewButton.append(fileInfo);
      previewButton.addEventListener('click', openOwnershipProof);
      ownershipProofPreviewCard.replaceChildren(previewButton);
      ownershipProofPreviewCard.hidden = false;
      ownershipProofOpenButton.hidden = true;
      ownershipProofMessage.textContent = 'Preview ready. Select the file to open it.';
      updateDetailActions();
    } catch (error) {
      ownershipProofMessage.textContent = error.message;
    } finally {
      if (selected?.id === propertyId) ownershipProofOpenButton.disabled = false;
    }
  };

  const openPhotoViewer = (row) => {
    const photos = getPropertyImages(row);
    if (!photos.length) return;
    let photoIndex = 0;
    const viewer = document.createElement('dialog');
    viewer.className = 'moderation-photo-viewer';
    viewer.innerHTML = `
      <div class="moderation-photo-viewer__stage">
        <img class="moderation-photo-viewer__image" alt="">
        <button type="button" class="moderation-photo-viewer__nav moderation-photo-viewer__nav--previous" aria-label="View previous photo" title="Previous photo"><i class="bi bi-chevron-left" aria-hidden="true"></i></button>
        <button type="button" class="moderation-photo-viewer__nav moderation-photo-viewer__nav--next" aria-label="View next photo" title="Next photo"><i class="bi bi-chevron-right" aria-hidden="true"></i></button>
        <div class="moderation-photo-viewer__actions">
          <button type="button" class="moderation-photo-viewer__action moderation-photo-viewer__download" aria-label="Download photo" title="Download photo"><i class="bi bi-download" aria-hidden="true"></i></button>
          <button type="button" class="moderation-photo-viewer__action moderation-photo-viewer__share" aria-label="Share photo" title="Share photo"><i class="bi bi-share" aria-hidden="true"></i></button>
          <button type="button" class="moderation-photo-viewer__action moderation-photo-viewer__close" aria-label="Close photo viewer" title="Close viewer"><i class="bi bi-x-lg" aria-hidden="true"></i></button>
        </div>
      </div>
      <nav class="moderation-photo-viewer__thumbnails" aria-label="Property photos"></nav>`;
    const image = viewer.querySelector('.moderation-photo-viewer__image');
    const thumbnails = viewer.querySelector('.moderation-photo-viewer__thumbnails');
    const retryImageOnError = (target) => {
      const retriedSources = new Set();
      target.addEventListener('error', () => {
        const source = target.dataset.originalSource;
        if (!source || retriedSources.has(source)) return;
        retriedSources.add(source);
        const retryUrl = new URL(source);
        retryUrl.searchParams.set('_retry', String(Date.now()));
        target.src = retryUrl.toString();
      });
    };
    retryImageOnError(image);
    const thumbnailButtons = photos.map((photo, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'moderation-photo-viewer__thumbnail';
      button.dataset.photoIndex = String(index);
      button.setAttribute('aria-label', `View photo ${index + 1}`);
      button.setAttribute('aria-current', String(index === 0));
      const thumbnailImage = document.createElement('img');
      retryImageOnError(thumbnailImage);
      thumbnailImage.dataset.originalSource = photo;
      thumbnailImage.src = photo;
      thumbnailImage.alt = '';
      thumbnailImage.loading = 'lazy';
      button.append(thumbnailImage);
      thumbnails.append(button);
      return button;
    });
    const previousButton = viewer.querySelector('.moderation-photo-viewer__nav--previous');
    const nextButton = viewer.querySelector('.moderation-photo-viewer__nav--next');
    const renderPhoto = (nextIndex = photoIndex) => {
      photoIndex = (nextIndex + photos.length) % photos.length;
      image.dataset.originalSource = photos[photoIndex];
      image.src = photos[photoIndex];
      image.alt = `${row.title || 'Property'} photo ${photoIndex + 1}`;
      previousButton.hidden = photos.length < 2;
      nextButton.hidden = photos.length < 2;
      thumbnailButtons.forEach((button, index) => {
        const active = index === photoIndex;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-current', String(active));
      });
    };
    previousButton.addEventListener('click', () => { photoIndex = (photoIndex - 1 + photos.length) % photos.length; renderPhoto(); });
    nextButton.addEventListener('click', () => { photoIndex = (photoIndex + 1) % photos.length; renderPhoto(); });
    thumbnails.addEventListener('click', (event) => {
      const button = event.target.closest('.moderation-photo-viewer__thumbnail');
      if (button) renderPhoto(Number(button.dataset.photoIndex));
    });
    viewer.querySelector('.moderation-photo-viewer__close').addEventListener('click', () => viewer.close());
    viewer.querySelector('.moderation-photo-viewer__download').addEventListener('click', async () => {
      try {
        const response = await fetch(photos[photoIndex]);
        if (!response.ok) throw new Error('Download failed');
        const objectUrl = URL.createObjectURL(await response.blob());
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = `${String(row.title || 'property').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')}-photo-${photoIndex + 1}`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      } catch {
        window.open(photos[photoIndex], '_blank', 'noopener,noreferrer');
      }
    });
    viewer.querySelector('.moderation-photo-viewer__share').addEventListener('click', async () => {
      try {
        if (navigator.share) await navigator.share({ title: row.title || 'Property photo', url: photos[photoIndex] });
        else if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(photos[photoIndex]);
        else window.open(photos[photoIndex], '_blank', 'noopener,noreferrer');
      } catch (error) {
        if (error.name !== 'AbortError') window.open(photos[photoIndex], '_blank', 'noopener,noreferrer');
      }
    });
    viewer.addEventListener('keydown', (event) => {
      if (photos.length < 2) return;
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        renderPhoto(photoIndex - 1);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        renderPhoto(photoIndex + 1);
      }
    });
    viewer.addEventListener('click', (event) => { if (event.target === viewer) viewer.close(); });
    viewer.addEventListener('close', () => viewer.remove(), { once: true });
    document.body.append(viewer);
    renderPhoto();
    viewer.showModal();
  };

  const formatCurrency = (value = 0) => `₱${Number(value ?? 0).toLocaleString()}`;
  const formatDate = (value) => new Date(value ?? Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const formatMeta = (row) => [row.address, row.municipality, row.barangay].filter(Boolean).join(', ');

  const setActiveTab = (status) => {
    currentStatus = status;
    currentPage = 1;
    const nextSearch = new URLSearchParams(window.DORMHIVE_ROUTE_SEARCH || '');
    nextSearch.set('status', status);
    history.replaceState({}, '', `#/admin/listingModeration?${nextSearch}`);
    window.DORMHIVE_ROUTE_SEARCH = `?${nextSearch}`;
    tabs.forEach((button) => button.classList.toggle('active', button.dataset.status === status));
    headerTitle.textContent = `Listing Moderation: ${statusLabels[status] ?? 'Moderation'}`;
    listingCardTitle.textContent = statusLabels[status] ?? 'Listings';
    listingCardSubtitle.textContent = `Showing ${statusLabels[status]?.toLowerCase() ?? 'listings'}.`;
    clearSelection();
    load();
  };

  const updateDetailActions = () => {
    const isPending = selected?.status === 'pending';
    const isApprovedOrRejected = selected?.status === 'approved' || selected?.status === 'rejected';
    const hasProof = selected?.has_ownership_proof === true || Number(selected?.has_ownership_proof) === 1;
    const hasReviewedProof = hasProof && reviewedProofPropertyId === selected?.id;
    const hasPreview = hasProof && ownershipProofPropertyId === selected?.id && Boolean(ownershipProofFileUrl);
    approveButton?.toggleAttribute('hidden', !isPending);
    rejectButton?.toggleAttribute('hidden', !isPending);
    ownershipProofOpenButton.hidden = !hasProof || hasPreview;
    ownershipProofPreviewCard.hidden = !hasPreview;
    ownershipProofMessage.textContent = hasProof
      ? hasReviewedProof
        ? 'Proof reviewed. You can confirm approval.'
        : hasPreview
          ? 'Proof is ready to open if you want to review it before confirming.'
          : 'You can review the ownership proof before confirming approval.'
      : 'No ownership or authorization proof is attached. This listing can be rejected but cannot be approved.';
    approveButton.disabled = !isPending;
    approvalReviewConfirmButton.disabled = !isPending || !hasProof;
    rejectButton.disabled = !isPending;
    viewButton?.classList.toggle('hidden', !isApprovedOrRejected);
    ownerContactButton?.classList.toggle('hidden', !selected);
    if (isApprovedOrRejected && selected) {
      viewButton.textContent = 'View Full Listing';
    }
  };

  const clearSelection = () => {
    approvalReviewModal.hidden = true;
    selected = null;
    clearOwnershipProofPreview();
    detailName.textContent = 'Select a listing';
    detailAddress.textContent = 'No property selected.';
    detailLocation.textContent = 'Waiting for backend data…';
    detailOwner.textContent = 'Owner details will appear here.';
    detailStatus.textContent = 'Status pending review';
    detailStatus.parentElement.className = 'detail-status status-pending';
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
    clearOwnershipProofPreview();
    selected = row;
    detailName.textContent = row.title || 'Untitled property';
    detailAddress.textContent = formatMeta(row) || 'Address unavailable';
    detailLocation.textContent = [row.municipality, row.barangay].filter(Boolean).join(', ') || 'Location unavailable';
    detailOwner.textContent = `Owner: ${row.owner_name || row.owner_id || 'Unknown owner'}`;
    const status = String(row.status || 'pending').toLowerCase().replace(/[^a-z0-9_-]/g, '');
    detailStatus.textContent = status.replaceAll('_', ' ');
    detailStatus.parentElement.className = `detail-status status-${status}`;
    const totalSlots = Number(row.total_slots ?? 0);
    const availableSlots = Math.max(0, Number(row.available_slots ?? totalSlots));
    const availability = row.total_slots !== null && row.total_slots !== undefined
      ? (availableSlots > 0 ? `${availableSlots} slot${availableSlots === 1 ? '' : 's'} available` : 'No slots available')
      : 'Not provided';
    approvalReviewFields.title.textContent = row.title || 'Untitled property';
    approvalReviewFields.owner.textContent = row.owner_name || row.owner_id || 'Unknown owner';
    approvalReviewFields.address.textContent = formatMeta(row) || 'Address unavailable';
    approvalReviewFields.type.textContent = formatRoomType(row.room_type);
    approvalReviewFields.rent.textContent = `${formatCurrency(row.monthly_rent)} / month`;
    approvalReviewFields.availability.textContent = availability;
    detailExtra.innerHTML = `
      <div><dt>Type</dt><dd data-privacy-mask="detail">${formatRoomType(row.room_type)}</dd></div>
      <div><dt>Rent</dt><dd data-privacy-mask="stat">${esc(formatCurrency(row.monthly_rent))}</dd></div>
      <div><dt>Availability</dt><dd data-privacy-mask="stat">${esc(availability)}</dd></div>
      <div><dt>Submitted</dt><dd>${esc(formatDate(row.created_at))}</dd></div>`;
    applyAdminPrivacy(root);
    const imageUrls = getPropertyImages(row);
    const visibleImages = imageUrls.slice(0, 6);
    const remainingCount = Math.max(0, imageUrls.length - 6);
    const photoTiles = visibleImages.map((imageUrl, index) => {
      const showCount = index === visibleImages.length - 1 && remainingCount > 0;
      return `<div class="thumb${showCount ? ' has-more' : ''}" style="background-image:url('${esc(imageUrl)}');background-position:center;background-size:cover;background-repeat:no-repeat">${showCount ? `<span>+${remainingCount}</span>` : ''}</div>`;
    });
    if (imageUrls.length > 3) {
      photoTiles.splice(3, 0, `<div class="thumb has-more mobile-gallery-more" style="background-image:url('${esc(imageUrls[3])}');background-position:center;background-size:cover;background-repeat:no-repeat"><span>+${imageUrls.length - 3}</span></div>`);
    }
    detailPhotos.innerHTML = photoTiles.length ? photoTiles.join('') : '<div class="thumb"></div>';
    updateDetailActions();
  };

  const syncRowSelection = () => {
    tbody.querySelectorAll('tr').forEach((rowEl) => {
      const id = Number(rowEl.dataset.id);
      rowEl.classList.toggle('selected', !!selected && id === selected.id);
    });
  };

  const renderRows = () => {
    const query = searchInput.value.trim().toLowerCase();
    const filter = typeFilter.value;
    const visibleRows = rows.filter((row) => {
      const matchesQuery = !query || `${row.id} ${row.title} ${row.owner_name || ''} ${row.room_type || ''}`.toLowerCase().includes(query);
      const matchesType = filter === 'all' || String(row.room_type || '').toLowerCase() === filter.toLowerCase();
      return matchesQuery && matchesType;
    });
    const totalPages = Math.max(1, Math.ceil(visibleRows.length / pageSize));
    currentPage = Math.min(Math.max(1, currentPage), totalPages);
    const startIndex = (currentPage - 1) * pageSize;
    const pageRows = visibleRows.slice(startIndex, startIndex + pageSize);
    const rangeStart = visibleRows.length ? startIndex + 1 : 0;
    const rangeEnd = Math.min(startIndex + pageSize, visibleRows.length);
    paginationInfo.textContent = `Showing ${rangeStart} to ${rangeEnd} of ${visibleRows.length} listings`;
    previousPageButton.disabled = currentPage <= 1;
    nextPageButton.disabled = currentPage >= totalPages || visibleRows.length === 0;

    if (!pageRows.some((row) => row.id === selected?.id)) {
      if (pageRows.length) {
        selected = pageRows[0];
        syncDetails(selected);
      } else {
        selected = null;
        clearSelection();
      }
    }

    tableShell.classList.toggle('is-empty', visibleRows.length === 0);
    const emptyMessage = query || filter !== 'all'
      ? 'No matching listings found.'
      : `No ${statusLabels[currentStatus].toLowerCase()} available for this tab.`;
    tbody.innerHTML = pageRows.map((row) => `
      <tr class="listing-summary-row${selected?.id === row.id ? ' selected' : ''}" data-id="${row.id}">
        <td data-label="Thumbnail"><div class="thumbnail" ${getThumbStyles(row)}></div></td>
        <td data-label="Property" data-privacy-mask="detail">${esc(row.title || 'Untitled property')}</td>
        <td data-label="Owner" data-privacy-mask="name">${esc(row.owner_name || 'Unknown owner')}</td>
        <td data-label="Type" data-privacy-mask="detail">${formatRoomType(row.room_type)}</td>
        <td data-label="Rent" data-privacy-mask="stat">${esc(formatCurrency(row.monthly_rent))}</td>
        <td data-label="Submitted">${esc(formatDate(row.created_at))}</td>
        <td class="action-icons"><button type="button" aria-label="View full listing" title="View full listing"><i class="bi bi-eye" aria-hidden="true"></i></button></td>
      </tr>`).join('') || `<tr><td colspan="7" class="empty-row">${emptyMessage}</td></tr>`;

    applyAdminPrivacy(root);
    syncRowSelection();

    tbody.querySelectorAll('tr').forEach((rowEl) => {
      rowEl.querySelector('.thumbnail')?.addEventListener('click', (event) => {
        event.stopPropagation();
        const row = rows.find((item) => item.id === Number(rowEl.dataset.id));
        if (row) openPhotoViewer(row);
      });
      rowEl.querySelector('.action-icons button')?.addEventListener('click', (event) => {
        event.stopPropagation();
        const row = rows.find((item) => item.id === Number(rowEl.dataset.id));
        if (!row) return;
        syncDetails(row);
        syncRowSelection();
        openModal();
      });
      rowEl.addEventListener('click', (event) => {
        if (event.target.closest('button')) return;
        const id = Number(rowEl.dataset.id);
        const row = rows.find((item) => item.id === id);
        if (row) {
          syncDetails(row);
          syncRowSelection();
          root.querySelector('.detail-body')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
  };

  const load = async () => {
    try {
      const response = await fetch(`${API}/properties?limit=100&status=${currentStatus}`, { headers: headers() });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? 'Unable to load listings.');
      rows = Array.isArray(body.data) ? body.data : [];
      listingCardTitle.textContent = statusLabels[currentStatus] ?? 'Listings';
      listingCardSubtitle.textContent = `Showing ${rows.length} ${statusLabels[currentStatus].toLowerCase()}.`;
      listingTotal.textContent = `${rows.length} total`;
      if (!rows.length) {
        currentPage = 1;
        statusLabel.textContent = `No ${statusLabels[currentStatus].toLowerCase()} found.`;
        selected = null;
        renderRows();
        return;
      }
      statusLabel.textContent = `Showing ${rows.length} ${statusLabels[currentStatus].toLowerCase()}.`;
      selected = rows[0];
      syncDetails(selected);
      renderRows();
    } catch (error) {
      tableShell.classList.add('is-empty');
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
    if (!selected) return false;
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
        tbody.innerHTML = '<tr><td colspan="7" class="empty-row">No listings available for this tab.</td></tr>';
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
      if (status === 'approved') {
        approvalSuccessModal.hidden = false;
        document.body.classList.add('approval-success-modal-open');
        approvalSuccessOkButton.focus();
      }
      approveButton.disabled = rejectButton.disabled = false;
      return true;
    } catch (error) {
      statusLabel.textContent = error.message;
      approveButton.disabled = rejectButton.disabled = false;
      return false;
    }
  };

  const openApprovalReview = () => {
    if (!selected || selected.status !== 'pending') return;
    updateDetailActions();
    approvalReviewModal.hidden = false;
    approvalReviewCloseButton.focus();
  };

  const closeApprovalReview = () => {
    approvalReviewModal.hidden = true;
    approveButton.focus();
  };

  const openRejectDialog = async () => {
    if (!selected || selected.status !== 'pending') return;
    const rejectDialog = createModal({
      title: 'Listing Rejection',
      content: `<form class="moderation-reject-form">
        <fieldset class="moderation-reject-reasons">
          <legend>Reason(s) for Rejection <span>(Optional)</span></legend>
          <div class="moderation-reject-options">
            <label class="moderation-reject-option"><input type="checkbox" name="rejectionReason" value="Incomplete listing details"><i class="bi bi-file-earmark-text" aria-hidden="true"></i><span>Incomplete listing details</span></label>
            <label class="moderation-reject-option"><input type="checkbox" name="rejectionReason" value="Poor image quality or visibility"><i class="bi bi-camera" aria-hidden="true"></i><span>Poor image quality or visibility</span></label>
            <label class="moderation-reject-option"><input type="checkbox" name="rejectionReason" value="Incorrect category placement"><i class="bi bi-diagram-3" aria-hidden="true"></i><span>Incorrect category placement</span></label>
            <label class="moderation-reject-option"><input type="checkbox" name="rejectionReason" value="Prohibited item or content"><i class="bi bi-slash-circle" aria-hidden="true"></i><span>Prohibited item or content</span></label>
            <label class="moderation-reject-option"><input type="checkbox" name="rejectionReason" value="Unclear availability or pricing"><i class="bi bi-calendar2-check" aria-hidden="true"></i><span>Unclear availability or pricing</span></label>
            <label class="moderation-reject-option"><input type="checkbox" name="rejectionReason" value="Listing information conflict"><i class="bi bi-exclamation-triangle" aria-hidden="true"></i><span>Listing information conflict</span></label>
          </div>
        </fieldset>
        <div class="moderation-reject-specifics">
          <label for="moderation-rejection-reason">Additional Specifics <span>(Optional)</span></label>
          <div class="moderation-reject-textarea-wrap">
            <textarea id="moderation-rejection-reason" rows="4" maxlength="500" placeholder="Enter detailed feedback for the owner (max 500 characters)..."></textarea>
            <span class="moderation-reject-counter"><span>0</span>/500</span>
          </div>
        </div>
        <p class="moderation-reject-error" role="status"></p>
      </form>`,
      closeLabel: '',
      footerMarkup: '<button type="button" class="moderation-reject-cancel">Cancel</button><button type="button" class="moderation-reject-confirm">Reject Listing</button>',
      closeOnBackdrop: false
    });
    rejectDialog.classList.add('moderation-reject-modal');

    const reasonInput = rejectDialog.querySelector('#moderation-rejection-reason');
    const reasonCounter = rejectDialog.querySelector('.moderation-reject-counter span');
    const errorMessage = rejectDialog.querySelector('.moderation-reject-error');
    const confirmButton = rejectDialog.querySelector('.moderation-reject-confirm');
    rejectDialog.querySelector('.moderation-reject-cancel').addEventListener('click', () => rejectDialog.close());
    reasonInput.addEventListener('input', () => {
      reasonCounter.textContent = String(reasonInput.value.length);
    });
    confirmButton.addEventListener('click', async () => {
      confirmButton.disabled = true;
      errorMessage.textContent = '';
      const selectedReasons = [...rejectDialog.querySelectorAll('input[name="rejectionReason"]:checked')].map((input) => input.value);
      const reason = [
        selectedReasons.length ? `Reason(s): ${selectedReasons.join('; ')}` : '',
        reasonInput.value.trim() ? `Additional specifics: ${reasonInput.value.trim()}` : ''
      ].filter(Boolean).join('\n');
      const rejected = await updatePropertyStatus('rejected', reason);
      if (rejected) {
        rejectDialog.close();
        await successDialog('Listing rejected successfully.');
      } else {
        errorMessage.textContent = statusLabel.textContent || 'Unable to reject this listing.';
        confirmButton.disabled = false;
      }
    });
    await openUiModal(rejectDialog);
    reasonInput.focus();
  };

  const openModal = () => {
    if (!selected) return;
    modalTitle.textContent = selected.title || 'Untitled property';
    modalStatusText.textContent = String(selected.status || 'pending').replaceAll('_', ' ');
    modalStatusText.className = `modal-status-text status-${selected.status}`;
    modalAddress.textContent = formatMeta(selected) || 'Unavailable';
    modalLocation.textContent = [selected.municipality, selected.barangay].filter(Boolean).join(', ') || 'Unavailable';
    modalOwner.textContent = selected.owner_name || selected.owner_id || 'Unknown owner';
    modalType.textContent = formatRoomType(selected.room_type);
    modalRent.textContent = `${formatCurrency(selected.monthly_rent)} / month`;
    modalSubmitted.textContent = formatDate(selected.created_at);
    const hasSlotCount = selected.total_slots !== null && selected.total_slots !== undefined;
    const availableSlots = Math.max(0, Number(selected.available_slots ?? selected.total_slots ?? 0));
    modalAvailability.textContent = hasSlotCount
      ? (availableSlots > 0 ? `${availableSlots} slot${availableSlots === 1 ? '' : 's'} available` : 'No slots available')
      : 'Not specified';
    modalGender.textContent = selected.gender_preference ? String(selected.gender_preference).replaceAll('_', ' ') : 'Any';
    modalDescription.textContent = selected.description || 'No description provided.';
    modalAddress.setAttribute('data-privacy-mask', 'detail');
    modalLocation.setAttribute('data-privacy-mask', 'detail');
    modalOwner.setAttribute('data-privacy-mask', 'name');
    modalType.setAttribute('data-privacy-mask', 'detail');
    modalRent.setAttribute('data-privacy-mask', 'stat');
    modalAvailability.setAttribute('data-privacy-mask', 'stat');
    modalGender.setAttribute('data-privacy-mask', 'detail');
    modalDescription.setAttribute('data-privacy-mask', 'detail');
    applyAdminPrivacy(modal);
    modalPhotoUrls = getPropertyImages(selected);
    modalPhotoIndex = 0;
    renderListingModalGallery();
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

  const openPhotoPreview = (imageUrls, startIndex = 0) => {
    if (!imageUrls.length) return;
    const preview = document.createElement('div');
    preview.className = 'photo-preview-modal';
    preview.setAttribute('role', 'dialog');
    preview.setAttribute('aria-modal', 'true');
    preview.setAttribute('aria-label', 'Property photos');
    preview.innerHTML = `
      <div class="photo-preview-stage">
        <img alt="">
        <button type="button" class="photo-preview-arrow photo-preview-previous" aria-label="Previous photo" title="Previous photo"><i class="bi bi-chevron-left" aria-hidden="true"></i></button>
        <button type="button" class="photo-preview-arrow photo-preview-next" aria-label="Next photo" title="Next photo"><i class="bi bi-chevron-right" aria-hidden="true"></i></button>
        <div class="photo-preview-actions">
          <button type="button" class="photo-preview-action photo-preview-download" aria-label="Download photo" title="Download photo"><i class="bi bi-download" aria-hidden="true"></i></button>
          <button type="button" class="photo-preview-action photo-preview-share" aria-label="Share photo" title="Share photo"><i class="bi bi-share" aria-hidden="true"></i></button>
          <button type="button" class="photo-preview-action photo-preview-close" aria-label="Close photo" title="Close viewer"><i class="bi bi-x-lg" aria-hidden="true"></i></button>
        </div>
      </div>
      <nav class="photo-preview-thumbnails" aria-label="Property photos"></nav>`;
    const image = preview.querySelector('img');
    let currentIndex = (startIndex + imageUrls.length) % imageUrls.length;
    const thumbnails = preview.querySelector('.photo-preview-thumbnails');
    const thumbnailButtons = imageUrls.map((imageUrl, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'photo-preview-thumbnail';
      button.dataset.photoIndex = String(index);
      button.setAttribute('aria-label', `View photo ${index + 1}`);
      button.setAttribute('aria-current', String(index === currentIndex));
      const thumbnailImage = document.createElement('img');
      thumbnailImage.src = imageUrl;
      thumbnailImage.alt = '';
      thumbnailImage.loading = 'lazy';
      button.append(thumbnailImage);
      thumbnails.append(button);
      return button;
    });
    const showImage = (index) => {
      currentIndex = (index + imageUrls.length) % imageUrls.length;
      image.src = imageUrls[currentIndex];
      image.alt = `Property photo ${currentIndex + 1} of ${imageUrls.length}`;
      thumbnailButtons.forEach((button, thumbnailIndex) => {
        const active = thumbnailIndex === currentIndex;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-current', String(active));
      });
    };
    showImage(currentIndex);
    const closePreview = () => preview.remove();
    preview.querySelector('.photo-preview-close').addEventListener('click', closePreview);
    preview.querySelector('.photo-preview-previous').addEventListener('click', () => showImage(currentIndex - 1));
    preview.querySelector('.photo-preview-next').addEventListener('click', () => showImage(currentIndex + 1));
    thumbnails.addEventListener('click', (event) => {
      const button = event.target.closest('.photo-preview-thumbnail');
      if (button) showImage(Number(button.dataset.photoIndex));
    });
    preview.querySelector('.photo-preview-download').addEventListener('click', async () => {
      try {
        const response = await fetch(imageUrls[currentIndex]);
        if (!response.ok) throw new Error('Download failed');
        const objectUrl = URL.createObjectURL(await response.blob());
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = `property-photo-${currentIndex + 1}`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      } catch {
        window.open(imageUrls[currentIndex], '_blank', 'noopener,noreferrer');
      }
    });
    preview.querySelector('.photo-preview-share').addEventListener('click', async () => {
      try {
        if (navigator.share) await navigator.share({ title: image.alt, url: imageUrls[currentIndex] });
        else if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(imageUrls[currentIndex]);
        else window.open(imageUrls[currentIndex], '_blank', 'noopener,noreferrer');
      } catch (error) {
        if (error.name !== 'AbortError') window.open(imageUrls[currentIndex], '_blank', 'noopener,noreferrer');
      }
    });
    preview.addEventListener('click', (event) => {
      if (event.target === preview) closePreview();
    });
    preview.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowLeft') showImage(currentIndex - 1);
      if (event.key === 'ArrowRight') showImage(currentIndex + 1);
      if (event.key === 'Escape') closePreview();
    });
    document.body.append(preview);
    preview.tabIndex = -1;
    preview.focus();
  };

  tabs.forEach((button) => {
    button.addEventListener('click', () => setActiveTab(button.dataset.status));
  });
  ownershipProofOpenButton.addEventListener('click', loadOwnershipProof);
  approveButton?.addEventListener('click', openApprovalReview);
  approvalReviewCloseButton.addEventListener('click', closeApprovalReview);
  approvalReviewCancelButton.addEventListener('click', closeApprovalReview);
  approvalReviewModal.querySelector('[data-close-approval-review]').addEventListener('click', closeApprovalReview);
  approvalReviewModal.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeApprovalReview();
  });
  approvalReviewConfirmButton.addEventListener('click', async () => {
    if (!selected || selected.status !== 'pending' || !(selected.has_ownership_proof === true || Number(selected.has_ownership_proof) === 1)) return;
    approvalReviewConfirmButton.disabled = true;
    const approved = await updatePropertyStatus('approved');
    if (approved) closeApprovalReview();
    else approvalReviewConfirmButton.disabled = false;
  });
  rejectButton?.addEventListener('click', openRejectDialog);
  viewButton?.addEventListener('click', openModal);
  ownerContactButton?.addEventListener('click', async () => {
    if (!selected) return;
    const ownerEmail = String(selected.owner_email || selected.ownerEmail || selected.email || '').trim();
    if (!ownerEmail) {
      showToast({ message: 'No email address is available for this owner.', type: 'error' });
      return;
    }

    const subject = `DormHive listing: ${selected.title || 'Property listing'}`;
    const body = `Hello ${selected.owner_name || 'Owner'},\n\nI am contacting you about your DormHive listing "${selected.title || 'Property listing'}".`;
    const gmailUrl = new URL('https://mail.google.com/mail/');
    gmailUrl.searchParams.set('view', 'cm');
    gmailUrl.searchParams.set('fs', '1');
    gmailUrl.searchParams.set('to', ownerEmail);
    gmailUrl.searchParams.set('su', subject);
    gmailUrl.searchParams.set('body', body);

    const gmailLink = document.createElement('a');
    gmailLink.href = gmailUrl.toString();
    gmailLink.target = '_blank';
    gmailLink.rel = 'noopener noreferrer';
    gmailLink.hidden = true;
    document.body.append(gmailLink);
    gmailLink.click();
    gmailLink.remove();
  });
  modalClose?.addEventListener('click', closeModal);
  modalFooterClose?.addEventListener('click', closeModal);
  modalPhotoPrevious.addEventListener('click', () => {
    if (!modalPhotoUrls.length) return;
    modalPhotoIndex = (modalPhotoIndex - 1 + modalPhotoUrls.length) % modalPhotoUrls.length;
    renderListingModalGallery();
  });
  modalPhotoNext.addEventListener('click', () => {
    if (!modalPhotoUrls.length) return;
    modalPhotoIndex = (modalPhotoIndex + 1) % modalPhotoUrls.length;
    renderListingModalGallery();
  });
  modalHero.addEventListener('click', () => {
    if (selected && modalPhotoUrls.length) openPhotoViewer(selected, modalPhotoIndex);
  });
  modal?.addEventListener('click', (event) => {
    if (event.target === modal) closeModal();
  });
  detailPhotos.addEventListener('click', (event) => {
    const tile = event.target.closest('.thumb[style*="background-image"]');
    if (!tile) return;
    if (!selected) return;
    const imageUrls = getPropertyImages(selected);
    const tileIndex = Array.from(detailPhotos.querySelectorAll('.thumb[style*="background-image"]')).indexOf(tile);
    if (imageUrls.length) openPhotoPreview(imageUrls, Math.max(0, tileIndex));
  });

  typeFilter.addEventListener('change', () => {
    currentPage = 1;
    renderRows();
  });
  searchInput.addEventListener('input', () => {
    currentPage = 1;
    renderRows();
  });
  previousPageButton.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage -= 1;
      renderRows();
    }
  });
  nextPageButton.addEventListener('click', () => {
    currentPage += 1;
    renderRows();
  });
  load();
}
