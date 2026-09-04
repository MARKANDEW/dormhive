import { showToast } from '../../components/toast.js';
import { ensureOwnerSidebarStyles, renderOwnerSidebar, updateListingCountsInSidebar } from './sidebarOwner.js';

const API = (window.DORMHIVE_API_URL ?? 'http://localhost:5000/api/v1').replace(/\/$/, '');
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('dormhive.accessToken') ?? ''}` });
const user = () => JSON.parse(localStorage.getItem('dormhive.user') ?? '{}');
const apiBase = API.replace(/\/api\/v1\/?$/, '');
const MAX_PROPERTY_PHOTO_SIZE = 2 * 1024 * 1024;
const SUPPORTED_PROPERTY_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
const DEFAULT_IMAGE_PLACEHOLDER = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 300"><rect width="500" height="300" fill="#ecf5ef"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#4a7160" font-family="Inter,Arial,sans-serif" font-size="28">No image available</text></svg>');
const resolveImageUrl = (value = '') => {
  const url = String(value || '').trim();
  if (!url) return '';
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;
  if (/^https?:\/\//i.test(url)) return url;
  return `${apiBase}${url.startsWith('/') ? '' : '/'}${url}`;
};
const normalizePropertyImage = (property) => {
  const source = property.image_url || property.cover_image || (Array.isArray(property.images) && property.images[0]) || '';
  return resolveImageUrl(source);
};
const normalizePropertyTypeLabel = (value = '') => {
  const raw = String(value ?? '').trim().toLowerCase();
  const labelMap = {
    bedspace: 'Bedspace',
    private_room: 'Solo Room',
    'solo room': 'Solo Room',
    entire_unit: 'Studio Unit',
    'studio unit': 'Studio Unit'
  };
  return labelMap[raw] ?? (raw ? raw.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()) : '');
};
const escape = (value = '') => { const n = document.createElement('span'); n.textContent = value; return n.innerHTML; };
const AMENITY_LABELS = {
  wifi: 'Wi-Fi',
  laundry: 'Laundry',
  kitchen: 'Kitchen',
  aircon: 'Aircon',
  pets_allowed: 'Pets allowed',
  dishwasher: 'Dishwasher',
  balcony: 'Balcony',
  parking: 'Parking',
  utilities_included: 'Utilities included',
  cable_ready: 'Cable ready'
};
const formatAmenityLabel = (value = '') => AMENITY_LABELS[String(value).toLowerCase()] ?? String(value).replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
const normalizeAmenities = (item = {}) => {
  const raw = item.amenities;
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((value) => String(value).toLowerCase());
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map((value) => String(value).toLowerCase());
  } catch {}
  return String(raw).split(',').map((value) => value.trim().toLowerCase()).filter(Boolean);
};
const renderAmenitiesChips = (item = {}) => normalizeAmenities(item)
  .slice(0, 4)
  .map((amenity) => `<span class="amenity-chip">${escape(formatAmenityLabel(amenity))}</span>`)
  .join('');
const clearSession = () => { localStorage.removeItem('dormhive.accessToken'); localStorage.removeItem('dormhive.user'); };

function css() {
  document.querySelectorAll('link[data-owner-style]:not([data-owner-style="shared"]), style[data-owner-style]:not([data-owner-style="shared"])').forEach((node) => node.remove());
  const existing = document.querySelector('[data-owner-style="listings"]');
  if (existing) return existing.sheet ? Promise.resolve() : new Promise((resolve) => existing.addEventListener('load', resolve, { once: true }));
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('./style/myListing.css', import.meta.url);
  link.dataset.ownerStyle = 'listings';
  document.head.append(link);
  return new Promise((resolve) => {
    link.addEventListener('load', resolve, { once: true });
    link.addEventListener('error', resolve, { once: true });
  });
}

export async function renderMyListing(root = document.querySelector('#app')) {
  if (!root) throw new Error('My listings page requires #app.');
  await css();
  ensureOwnerSidebarStyles();
  const routeSearch = typeof window.DORMHIVE_ROUTE_SEARCH === 'string' ? window.DORMHIVE_ROUTE_SEARCH : window.location.search;
  const requestedPropertyId = new URLSearchParams(routeSearch).get('propertyId');
  const requestedAction = new URLSearchParams(routeSearch).get('action');

  root.innerHTML = `
    <div class="owner-shell">
      ${renderOwnerSidebar('myListing')}
      <div class="owner-main">
        <main class="portfolio-page">
          <section class="portfolio-content">
            <div class="portfolio-headline">
              <div>
                <p class="eyebrow">OWNER PORTFOLIO</p>
                <h1>My Property Portfolio</h1>
              </div>
            </div>

            <div class="portfolio-toolbar">
              <label class="property-search">
                <span>⌕</span>
                <input type="search" placeholder="Search property" />
              </label>
              <label class="property-filter">
                <select>
                  <option value="">Property Type</option>
                  <option value="bedspace">Bedspace</option>
                  <option value="private_room">Solo Room</option>
                  <option value="entire_unit">Studio Unit</option>
                </select>
              </label>
              <button type="button" class="add-property">Add a New Property</button>
            </div>

            <div id="property-modal" class="property-modal" hidden>
              <div class="property-modal-card">
                <div class="property-modal-header">
                  <h2>Create a listing</h2>
                  <button type="button" class="modal-close">×</button>
                </div>
                <p id="property-form-message" class="form-message" hidden></p>

                <div class="form-step-indicator" id="form-step-indicator">
                  <div class="step-marker" data-step="1">
                    <span class="step-number">1</span>
                    <span class="step-label">Property Info</span>
                  </div>
                  <div class="step-connector"></div>
                  <div class="step-marker" data-step="2">
                    <span class="step-number">2</span>
                    <span class="step-label">Location</span>
                  </div>
                  <div class="step-connector"></div>
                  <div class="step-marker" data-step="3">
                    <span class="step-number">3</span>
                    <span class="step-label">Details</span>
                  </div>
                </div>

                <form id="property-form" enctype="multipart/form-data" novalidate>
                  <input type="hidden" name="address" />
                  <input type="hidden" name="municipality" />
                  <input type="hidden" name="barangay" />
                  <input type="hidden" name="latitude" />
                  <input type="hidden" name="longitude" />

                  <div id="property-form-step-1" class="property-form-step">
                    <div class="form-step-title">
                      <h3>Property Basics</h3>
                      <p>Tell us about your property</p>
                    </div>
                    <div class="form-grid">
                      <label class="full-span">Property title<input name="title" required maxlength="160"></label>
                      <label>Property type<select name="roomType" required>
                        <option value="">Select type</option>
                        <option value="bedspace">Bedspace</option>
                        <option value="private_room">Solo Room</option>
                        <option value="entire_unit">Studio Unit</option>
                      </select></label>
                      <label>Monthly price (₱)<input name="monthlyRent" type="number" min="1" required></label>
                      <label>Maximum occupancy<input name="maxOccupants" type="number" min="1" required></label>
                      <label>Available slots<input name="availableSlots" type="number" min="1" required></label>
                      <label>Gender preference<select name="genderPreference" required>
                        <option value="">Select preference</option>
                        <option value="co-ed">Co-Ed</option>
                        <option value="male">Male Only</option>
                        <option value="female">Female Only</option>
                      </select></label>
                    </div>
                    <div class="modal-actions">
                      <button type="button" class="btn-secondary modal-close">Cancel</button>
                      <button type="button" class="btn-primary step-next" data-next-step="2">Next: Location</button>
                    </div>
                  </div>

                  <div id="property-form-step-2" class="property-form-step" hidden>
                    <div class="form-step-title">
                      <h3>Location Details</h3>
                      <p>Click or drag the marker to pin your property's exact location on the map.</p>
                    </div>
                    <div class="map-helper-bar">Click or drag the marker to pin your property's exact location on the map.</div>
                    <div class="map-pin-stage" id="map-pin-stage">
                      <div id="property-map" class="property-map" aria-label="Property location map"></div>
                    </div>
                    <div class="location-details-panel">
                      <p class="location-status" id="location-status">Move the pin to detect the address.</p>
                      <p class="location-preview" id="location-preview">Detected address will appear here after selecting the location.</p>
                      <p class="location-coords" id="location-coords"></p>
                    </div>
                    <div class="modal-actions">
                      <button type="button" class="btn-secondary step-back" data-back-step="1">Back</button>
                      <button type="button" class="btn-primary step-next" data-next-step="3" id="location-next" disabled>Next: Amenities</button>
                    </div>
                  </div>

                  <div id="property-form-step-3" class="property-form-step" hidden>
                    <div class="form-step-title">
                      <h3>Amenities &amp; Media</h3>
                      <p>Add photos and describe your property</p>
                    </div>
                    <div class="amenities-section">
                      <label class="section-label">Select available amenities</label>
                      <div class="amenities-grid">
                        <label class="amenity-check"><input type="checkbox" name="amenities" value="wifi"> <span>Wi-Fi</span></label>
                        <label class="amenity-check"><input type="checkbox" name="amenities" value="laundry"> <span>Laundry</span></label>
                        <label class="amenity-check"><input type="checkbox" name="amenities" value="kitchen"> <span>Kitchen</span></label>
                        <label class="amenity-check"><input type="checkbox" name="amenities" value="aircon"> <span>Aircon</span></label>
                        <label class="amenity-check"><input type="checkbox" name="amenities" value="pets_allowed"> <span>Pets allowed</span></label>
                        <label class="amenity-check"><input type="checkbox" name="amenities" value="dishwasher"> <span>Dishwasher</span></label>
                        <label class="amenity-check"><input type="checkbox" name="amenities" value="balcony"> <span>Balcony</span></label>
                        <label class="amenity-check"><input type="checkbox" name="amenities" value="parking"> <span>Parking</span></label>
                        <label class="amenity-check"><input type="checkbox" name="amenities" value="utilities_included"> <span>Utilities included</span></label>
                        <label class="amenity-check"><input type="checkbox" name="amenities" value="cable_ready"> <span>Cable ready</span></label>
                      </div>
                    </div>
                    <div class="media-dropzone">
                      <input id="property-image" name="images" type="file" accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml" multiple hidden>
                      <label for="property-image" class="media-dropzone-label">
                        <span class="dropzone-icon" aria-hidden="true">☁</span>
                        <strong>Drag files to upload</strong>
                        <span class="dropzone-or">or</span>
                        <span class="browse-files">Browse Files</span>
                        <span class="dropzone-hint">JPG, PNG, GIF, WEBP or SVG up to 2 MB each</span>
                      </label>
                      <div class="media-upload-status" aria-live="polite">Select as many photos as you need</div>
                    </div>
                    <div class="media-file-list" aria-live="polite"></div>
                    <div class="form-grid">
                      <label class="full-span">Description (optional)<textarea name="description" rows="4" placeholder="Describe your property, house rules, and what makes it special..."></textarea></label>
                    </div>
                    <div class="modal-actions">
                      <button type="button" class="btn-secondary step-back" data-back-step="2">Back</button>
                      <button type="submit" class="btn-primary">Create Listing &amp; Set Location</button>
                    </div>
                  </div>
                </form>

              </div>
            </div>

            <section class="portfolio-table-shell">
              <div class="table-wrap">
                <table class="portfolio-table">
                  <thead>
                    <tr>
                      <th>Thumbnail</th>
                      <th>Property Name &amp; Address</th>
                      <th>Amenities</th>
                      <th>Current Rent (PHP)</th>
                      <th>Occupancy Rate</th>
                      <th>Active Inquiries</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody id="portfolio-body"></tbody>
                </table>
              </div>

            </section>

            <div id="property-action-confirm" class="property-action-confirm" hidden>
              <div class="property-action-confirm-overlay"></div>
              <div class="property-action-confirm-card">
                <div class="property-action-confirm-header">
                  <h2 id="property-action-confirm-title">Archive Property</h2>
                </div>
                <div class="property-action-confirm-body">
                  <p id="property-action-confirm-text">Are you sure you want to archive this property?</p>
                </div>
                <div class="property-action-confirm-footer">
                  <button type="button" class="secondary-btn property-action-cancel">Cancel</button>
                  <button type="button" class="primary-btn property-action-confirm-btn">Confirm Archive</button>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>`;

  const portfolioBody = root.querySelector('#portfolio-body');
  const addPropertyButton = root.querySelector('.add-property');
  const propertyModal = root.querySelector('#property-modal');
  const propertyForm = root.querySelector('#property-form');
  const propertyFormStep1 = root.querySelector('#property-form-step-1');
  const propertyFormStep2 = root.querySelector('#property-form-step-2');
  const propertyFormStep3 = root.querySelector('#property-form-step-3');
  const propertySearchInput = root.querySelector('.property-search input');
  const propertyTypeFilter = root.querySelector('.property-filter select');
  const formStepIndicator = root.querySelector('#form-step-indicator');
  const propertyFormMessage = root.querySelector('#property-form-message');
  const mediaDropzone = root.querySelector('.media-dropzone');
  const imageInput = root.querySelector('#property-image');
  const uploadStatus = root.querySelector('.media-upload-status');
  const mediaFileList = root.querySelector('.media-file-list');
  const closeButtons = root.querySelectorAll('.modal-close');
  const paginationButtons = root.querySelectorAll('.pagination button[data-page]');
  const mapContainer = root.querySelector('#property-map');
  const mapStage = root.querySelector('#map-pin-stage');
  const locationStatus = root.querySelector('#location-status');
  const locationPreview = root.querySelector('#location-preview');
  const locationCoords = root.querySelector('#location-coords');
  const locationNextButton = root.querySelector('#location-next');
  const stepNextButtons = root.querySelectorAll('.step-next');
  const stepBackButtons = root.querySelectorAll('.step-back');
  const MAP_ZOOM = 17;
  const MAP_DEFAULT_CENTER = { latitude: 14.5242, longitude: 121.0562 };
  
  // Property cache for reliable data retrieval
  const propertyCache = new Map();
  
  let leafletMap = null;
  let leafletMarker = null;
  let leafletLoadingPromise = null;
  let activePage = 1;
  let workflowPropertyId = null;
  let workflowTitle = '';
  let workflowPrice = 0;
  let currentFormStep = 1;
  let selectedPhotos = [];

  const setFormMessage = (message, type = 'error') => {
    propertyFormMessage.hidden = false;
    propertyFormMessage.textContent = message;
    propertyFormMessage.className = `form-message ${type === 'success' ? 'success' : ''}`;
  };

  const formatFileSize = (bytes) => bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

  const renderUploadFiles = () => {
    if (!mediaFileList) return;
    mediaFileList.innerHTML = selectedPhotos.map((item) => `
      <article class="media-file ${item.error ? 'is-error' : ''}" data-photo-id="${item.id}">
        <img class="media-file-preview" src="${item.previewUrl}" alt="">
        <div class="media-file-details">
          <div class="media-file-heading"><strong title="${escape(item.file.name)}">${escape(item.file.name)}</strong><span>${formatFileSize(item.file.size)}</span></div>
          <div class="media-progress-row"><div class="media-progress-track"><span style="width: ${item.progress}%"></span></div><strong class="media-progress-percent">${item.progress}%</strong></div>
          <small class="media-file-status"><span class="media-file-status-icon">${item.error ? '!' : item.progress === 100 ? '✓' : '○'}</span>${escape(item.error || (item.progress === 100 ? 'Uploaded successfully' : item.uploading ? 'Uploading...' : 'Ready to upload'))}</small>
        </div>
        ${item.error ? `<button type="button" class="media-file-retry" data-photo-id="${item.id}">Retry</button>` : ''}
        <button type="button" class="media-file-remove" data-photo-id="${item.id}" aria-label="Remove ${escape(item.file.name)}">&times;</button>
      </article>`).join('');
    uploadStatus.textContent = selectedPhotos.length === 1 ? '1 photo selected' : `${selectedPhotos.length} photos selected`;
    uploadStatus.classList.toggle('selected', selectedPhotos.length > 0);
  };

  const syncInputFiles = () => {
    if (!imageInput || typeof DataTransfer === 'undefined') return;
    const dataTransfer = new DataTransfer();
    selectedPhotos.forEach(({ file }) => dataTransfer.items.add(file));
    imageInput.files = dataTransfer.files;
  };

  const addPhotos = (files) => {
    const errors = [];
    Array.from(files || []).forEach((file) => {
      if (!SUPPORTED_PROPERTY_PHOTO_TYPES.includes(file.type)) {
        errors.push(`${file.name}: unsupported file type.`);
        return;
      }
      if (file.size > MAX_PROPERTY_PHOTO_SIZE) {
        errors.push(`${file.name}: file exceeds the 2 MB limit.`);
        return;
      }
      if (selectedPhotos.some((item) => item.file.name === file.name && item.file.size === file.size)) return;
      const photo = { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, file, previewUrl: URL.createObjectURL(file), progress: 0, error: '', uploading: false, uploadedUrl: '' };
      selectedPhotos.push(photo);
      photo.uploadPromise = uploadPhoto(photo);
    });
    syncInputFiles();
    renderUploadFiles();
    if (errors.length) setFormMessage(errors.join(' '));
  };

  const resetPhotos = () => {
    selectedPhotos.forEach(({ previewUrl }) => URL.revokeObjectURL(previewUrl));
    selectedPhotos = [];
    if (imageInput) imageInput.value = '';
    renderUploadFiles();
  };

  if (imageInput) {
    imageInput.addEventListener('change', (event) => addPhotos(event.target.files));
  }

  if (mediaDropzone) {
    ['dragenter', 'dragover'].forEach((eventName) => {
      mediaDropzone.addEventListener(eventName, (event) => {
        event.preventDefault();
        event.stopPropagation();
        mediaDropzone.classList.add('dragover');
      });
    });
    ['dragleave', 'dragend'].forEach((eventName) => {
      mediaDropzone.addEventListener(eventName, (event) => {
        event.preventDefault();
        event.stopPropagation();
        mediaDropzone.classList.remove('dragover');
      });
    });
    mediaDropzone.addEventListener('drop', (event) => {
      event.preventDefault();
      event.stopPropagation();
      mediaDropzone.classList.remove('dragover');
      const files = event.dataTransfer?.files;
      if (files?.length) {
        addPhotos(files);
      }
    });
  }

  mediaFileList?.addEventListener('click', (event) => {
    const retryButton = event.target.closest('.media-file-retry');
    if (retryButton) {
      const photo = selectedPhotos.find((item) => item.id === retryButton.dataset.photoId);
      if (photo) photo.uploadPromise = uploadPhoto(photo);
      return;
    }
    const button = event.target.closest('.media-file-remove');
    if (!button) return;
    const photo = selectedPhotos.find((item) => item.id === button.dataset.photoId);
    if (photo) URL.revokeObjectURL(photo.previewUrl);
    selectedPhotos = selectedPhotos.filter((item) => item.id !== button.dataset.photoId);
    syncInputFiles();
    renderUploadFiles();
  });

  renderUploadFiles();

  const updateStepIndicator = (step) => {
    const stepMarkers = formStepIndicator.querySelectorAll('.step-marker');
    stepMarkers.forEach((marker) => {
      const markerStep = Number(marker.dataset.step);
      marker.classList.toggle('active', markerStep === step);
      marker.classList.toggle('completed', markerStep < step);
    });
  };

  const showFormStep = (step) => {
    currentFormStep = step;
    propertyFormStep1.hidden = step !== 1;
    propertyFormStep2.hidden = step !== 2;
    propertyFormStep3.hidden = step !== 3;
    updateStepIndicator(step);
    propertyFormMessage.hidden = true;
    if (step === 2) {
      initializeMapStep();
    }
  };

  const validateStep = (step) => {
    if (step === 1) {
      const title = propertyForm.elements.title.value.trim();
      const roomType = propertyForm.elements.roomType.value;
      const monthlyRent = propertyForm.elements.monthlyRent.value;
      const maxOccupants = propertyForm.elements.maxOccupants.value;
      const availableSlots = propertyForm.elements.availableSlots.value;
      const genderPreference = propertyForm.elements.genderPreference.value;
      
      if (!title) {
        setFormMessage('Please enter a property title.');
        return false;
      }
      if (!roomType) {
        setFormMessage('Please select a property type.');
        return false;
      }
      if (!monthlyRent || Number(monthlyRent) < 1) {
        setFormMessage('Please enter a valid monthly price.');
        return false;
      }
      if (!maxOccupants || Number(maxOccupants) < 1) {
        setFormMessage('Please enter a valid maximum occupancy.');
        return false;
      }
      if (!availableSlots || Number(availableSlots) < 1) {
        setFormMessage('Please enter valid available slots.');
        return false;
      }
      if (!genderPreference) {
        setFormMessage('Please select a gender preference.');
        return false;
      }
      return true;
    }
    if (step === 2) {
      const address = propertyForm.elements.address.value.trim();
      const municipality = propertyForm.elements.municipality.value.trim();
      const latitude = propertyForm.elements.latitude.value;
      const longitude = propertyForm.elements.longitude.value;
      if (!address || !municipality || !latitude || !longitude) {
        setFormMessage('Please pin the property location on the map to detect the address.');
        return false;
      }
      return true;
    }
    if (step === 3) {
      const imageField = propertyForm.elements.images;
      const isEditing = !!propertyForm.dataset.editingPropertyId;
      // Only require image when creating new property, not when editing
      if (!isEditing && !imageField?.files?.length) {
        setFormMessage('Please upload a property image.');
        return false;
      }
      return true;
    }
    return true;
  };

  const closeModal = () => {
    propertyModal.hidden = true;
    propertyForm.reset();
    resetPhotos();
    showFormStep(1);
    propertyFormMessage.hidden = true;
    propertyFormMessage.className = 'form-message';
    workflowPropertyId = null;
    workflowTitle = '';
    workflowPrice = 0;
    currentFormStep = 1;
    locationStatus.textContent = 'Move the pin to detect the address.';
    locationPreview.textContent = 'Detected address will appear here after selecting the location.';
    locationCoords.textContent = '';
    locationNextButton.disabled = true;
    // Reset editing state
    propertyForm.removeAttribute('data-editing-property-id');
    const modalHeader = propertyModal.querySelector('.property-modal-header h2');
    const submitBtn = propertyForm.querySelector('button[type="submit"]');
    modalHeader.textContent = 'Create a listing';
    submitBtn.textContent = 'Create Listing & Set Location';
  };

  const loadLeafletAssets = () => {
    if (leafletLoadingPromise) return leafletLoadingPromise;
    leafletLoadingPromise = new Promise((resolve, reject) => {
      if (window.L && window.L.map) {
        resolve();
        return;
      }

      const cssLink = document.createElement('link');
      cssLink.rel = 'stylesheet';
      cssLink.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.append(cssLink);

      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Unable to load Leaflet assets.'));
      document.body.append(script);
    });
    return leafletLoadingPromise;
  };

  const initializeLeafletMap = async () => {
    if (!mapContainer) return;
    await loadLeafletAssets();
    const storedLatitude = parseFloat(propertyForm.elements.latitude.value) || MAP_DEFAULT_CENTER.latitude;
    const storedLongitude = parseFloat(propertyForm.elements.longitude.value) || MAP_DEFAULT_CENTER.longitude;
    const initialCenter = [storedLatitude, storedLongitude];

    if (!leafletMap) {
      leafletMap = L.map(mapContainer, {
        center: initialCenter,
        zoom: MAP_ZOOM,
        scrollWheelZoom: true,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(leafletMap);

      leafletMarker = L.marker(initialCenter, {
        draggable: true,
      }).addTo(leafletMap);

      leafletMarker.on('dragend', syncLocationFromMarker);
      leafletMap.on('click', (event) => {
        leafletMarker.setLatLng(event.latlng);
        syncLocationFromMarker();
      });
    } else {
      leafletMap.setView(initialCenter, MAP_ZOOM);
      leafletMarker.setLatLng(initialCenter);
    }

    setTimeout(() => leafletMap?.invalidateSize(), 150);
  };

  const initializeMapStep = async () => {
    if (!mapContainer || !mapStage) return;
    locationStatus.textContent = 'Move the pin to detect the address.';
    locationPreview.textContent = 'Detected address will appear here after selecting the location.';
    locationCoords.textContent = '';
    locationNextButton.disabled = true;

    try {
      await initializeLeafletMap();
      syncLocationFromMarker();
    } catch (error) {
      locationStatus.textContent = 'Unable to load the map. Please try again later.';
      setFormMessage('Could not initialize the location map.');
    }
  };

  const pinCoordinates = () => {
    if (leafletMarker && leafletMarker.getLatLng) {
      const { lat, lng } = leafletMarker.getLatLng();
      return { latitude: lat, longitude: lng };
    }
    return { latitude: MAP_DEFAULT_CENTER.latitude, longitude: MAP_DEFAULT_CENTER.longitude };
  };

  const updateLocationFields = (address = '', municipality = '', barangay = '', latitude = '', longitude = '') => {
    propertyForm.elements.address.value = address;
    propertyForm.elements.municipality.value = municipality;
    propertyForm.elements.barangay.value = barangay;
    propertyForm.elements.latitude.value = latitude;
    propertyForm.elements.longitude.value = longitude;
  };

  const setLocationPreview = ({ displayName, addressLine, municipality, barangay, latitude, longitude }) => {
    locationStatus.textContent = 'Location detected successfully.';
    locationPreview.textContent = displayName || addressLine || 'Address detected.';
    locationCoords.textContent = latitude && longitude ? `Latitude: ${latitude.toFixed(6)}, Longitude: ${longitude.toFixed(6)}` : '';
    locationNextButton.disabled = !addressLine || !municipality || !latitude || !longitude;
  };

  const reverseGeocode = async (latitude, longitude) => {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}`);
      if (!response.ok) throw new Error('Reverse geocoding failed.');
      const data = await response.json();
      const address = data.address ?? {};
      const addressLine = [address.road, address.house_number, address.neighbourhood, address.suburb].filter(Boolean).join(' ') || data.display_name || '';
      const municipality = address.city || address.town || address.village || address.county || address.state || '';
      const barangay = address.suburb || address.quarter || address.hamlet || '';
      const displayName = [addressLine, municipality, barangay].filter(Boolean).join(', ');
      updateLocationFields(addressLine, municipality, barangay, latitude.toFixed(8), longitude.toFixed(8));
      setLocationPreview({ displayName, addressLine, municipality, barangay, latitude, longitude });
    } catch (error) {
      locationStatus.textContent = 'Unable to detect address. Move the pin again.';
      locationPreview.textContent = 'Move the marker to refresh the detected address.';
      locationCoords.textContent = '';
      locationNextButton.disabled = true;
    }
  };

  const syncLocationFromMarker = () => {
    const { latitude, longitude } = pinCoordinates();
    reverseGeocode(latitude, longitude);
  };

  addPropertyButton?.addEventListener('click', () => {
    propertyModal.hidden = false;
    showFormStep(1);
  });
  closeButtons.forEach((button) => button.addEventListener('click', closeModal));
  propertyModal?.addEventListener('click', (event) => {
    if (event.target === propertyModal) closeModal();
  });

  stepNextButtons.forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      const nextStep = Number(button.dataset.nextStep);
      if (validateStep(currentFormStep)) {
        showFormStep(nextStep);
      }
    });
  });

  stepBackButtons.forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      const backStep = Number(button.dataset.backStep);
      showFormStep(backStep);
    });
  });

  // Leaflet map interaction is handled internally by the map library.

  const ITEMS_PER_PAGE = 3;

  const getPagedProperties = (items = []) => {
    const totalPages = Math.max(1, Math.ceil(items.length / ITEMS_PER_PAGE));
    activePage = Math.min(Math.max(1, activePage), totalPages);
    const startIndex = (activePage - 1) * ITEMS_PER_PAGE;
    return items.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  };

  paginationButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const page = button.dataset.page;
      if (page === 'prev') {
        activePage = Math.max(1, activePage - 1);
      } else if (page === 'next') {
        activePage = Math.min(Math.max(1, Math.ceil(allPropertyRows.length / ITEMS_PER_PAGE)), activePage + 1);
      } else {
        activePage = Number(page);
      }

      const totalPages = Math.max(1, Math.ceil(allPropertyRows.length / ITEMS_PER_PAGE));
      activePage = Math.min(Math.max(1, activePage), totalPages);
      renderRows(getPagedProperties(allPropertyRows));
      paginationButtons.forEach((pageButton) => pageButton.classList.toggle('active', String(pageButton.dataset.page) === String(activePage)));
    });
  });

  const uploadPhoto = (photo) => new Promise((resolve, reject) => {
    photo.uploading = true;
    photo.error = '';
    photo.progress = 0;
    renderUploadFiles();
    const request = new XMLHttpRequest();
    request.open('POST', `${API}/properties/uploads`);
    request.timeout = 120000;
    Object.entries(authHeaders()).forEach(([key, value]) => request.setRequestHeader(key, value));
    request.upload.addEventListener('progress', (event) => {
      if (!event.lengthComputable) return;
      photo.progress = Math.round((event.loaded / event.total) * 100);
      renderUploadFiles();
    });
    request.addEventListener('load', () => {
      let body = {};
      try { body = JSON.parse(request.responseText || '{}'); } catch {}
      if (request.status >= 200 && request.status < 300) {
        photo.progress = 100;
        photo.uploading = false;
        photo.uploadedUrl = body.data?.imageUrl ?? '';
        renderUploadFiles();
        resolve(body);
      } else {
        console.error('[property upload] server rejected file', {
          file: photo.file.name,
          status: request.status,
          response: request.responseText
        });
        photo.uploading = false;
        photo.error = `Upload failed (${request.status || 'no response'})`;
        renderUploadFiles();
        reject(Object.assign(new Error(body.message ?? 'Upload failed'), { status: request.status, body }));
      }
    });
    request.addEventListener('error', () => {
      console.error('[property upload] network error', { file: photo.file.name, url: request.responseURL, status: request.status });
      photo.uploading = false;
      photo.error = 'Upload failed (network error)';
      renderUploadFiles();
      reject(new Error('Upload failed'));
    });
    request.addEventListener('timeout', () => {
      console.error('[property upload] timeout', { file: photo.file.name, url: request.responseURL });
      photo.uploading = false;
      photo.error = 'Upload failed (timeout)';
      renderUploadFiles();
      reject(new Error('Upload failed'));
    });
    const formData = new FormData();
    formData.append('image', photo.file);
    request.send(formData);
  });

  propertyForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!validateStep(3)) return;
    const formData = new FormData(propertyForm);
    const editingPropertyId = propertyForm.dataset.editingPropertyId;
    const isEditing = !!editingPropertyId;
    
    try {
      const url = isEditing ? `${API}/properties/${editingPropertyId}` : `${API}/properties`;
      const method = isEditing ? 'PUT' : 'POST';
      
      formData.delete('images');
      formData.delete('image');
      const uploadResults = await Promise.allSettled(selectedPhotos.map((photo) => photo.uploadPromise));
      if (uploadResults.some((result) => result.status === 'rejected' || !result.value?.data?.imageUrl)) {
        setFormMessage('Some photos failed to upload. Retry them individually before closing this form.');
        return;
      }
      formData.append('imageUrl', selectedPhotos[0]?.uploadedUrl ?? '');
      formData.append('images', JSON.stringify(selectedPhotos.map((photo) => photo.uploadedUrl)));
      const finalResponse = await fetch(url, { method, headers: authHeaders(), body: formData });
      let responseBody = {};
      try { responseBody = await finalResponse.json(); } catch {}
      if (!finalResponse.ok) {
        throw Object.assign(new Error(responseBody.message || 'Unable to save property.'), {
          status: finalResponse.status,
          body: responseBody
        });
      }
      const successMessage = isEditing 
        ? 'Property updated successfully. Changes are now pending admin approval.' 
        : 'Property created successfully. Listing is now pending admin approval.';
      setFormMessage(successMessage, 'success');
      showToast({ message: successMessage, type: 'success' });
      setTimeout(() => {
        closeModal();
        load();
      }, 600);
    } catch (error) {
      if (error.status === 401) {
        clearSession();
        setFormMessage('Your session has expired. Please sign in again.', 'error');
        setTimeout(() => location.assign('#/login'), 800);
        return;
      }
      setFormMessage(error.message);
    }
  });


  let propertyRows = [];
  let allPropertyRows = [];
  let pendingPropertyAction = null;

  const normalizePropertyTypeValue = (value = '') => {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw || raw === 'property type') return '';
    const aliasMap = {
      'bedspace': 'bedspace',
      'solo room': 'private_room',
      'private_room': 'private_room',
      'private room': 'private_room',
      'studio unit': 'entire_unit',
      'entire_unit': 'entire_unit',
      'entire unit': 'entire_unit'
    };
    return aliasMap[raw] ?? raw.replace(/\s+/g, '_');
  };

  const getFilteredPropertyRows = () => {
    const searchValue = (propertySearchInput?.value ?? '').trim().toLowerCase();
    const selectedType = normalizePropertyTypeValue(propertyTypeFilter?.value ?? '');

    return allPropertyRows.filter((item) => {
      const propertyType = normalizePropertyTypeValue(item.room_type || item.property_type || '');
      const searchableText = [
        item.title,
        item.address,
        item.municipality,
        item.barangay,
        item.room_type,
        item.property_type,
        propertyType
      ].join(' ').toLowerCase();

      const matchesSearch = !searchValue || searchableText.includes(searchValue);
      const matchesType = !selectedType || propertyType === selectedType;
      return matchesSearch && matchesType;
    });
  };

  const applyPropertyTableState = () => {
    const filteredRows = getFilteredPropertyRows();
    const pagedRows = getPagedProperties(filteredRows);
    renderRows(pagedRows);
  };

  const propertyActionConfirm = root.querySelector('#property-action-confirm');
  const propertyActionConfirmTitle = root.querySelector('#property-action-confirm-title');
  const propertyActionConfirmText = root.querySelector('#property-action-confirm-text');
  const propertyActionConfirmCancelBtn = root.querySelector('.property-action-cancel');
  const propertyActionConfirmActionBtn = root.querySelector('.property-action-confirm-btn');

  const closePropertyActionConfirm = () => {
    pendingPropertyAction = null;
    propertyActionConfirm.hidden = true;
  };

  const openPropertyActionConfirm = (property, action) => {
    pendingPropertyAction = { property, action };
    const isDelete = action === 'delete';
    propertyActionConfirmTitle.textContent = isDelete ? 'Delete Property' : 'Archive Property';
    propertyActionConfirmText.textContent = isDelete
      ? `Are you sure you want to delete ${property.title || 'this property'}?`
      : `Are you sure you want to archive ${property.title || 'this property'}?`;
    propertyActionConfirmActionBtn.textContent = isDelete ? 'Confirm Delete' : 'Confirm Archive';
    propertyActionConfirmActionBtn.dataset.action = action;
    propertyActionConfirm.hidden = false;
  };

  const renderRows = (items = []) => {
    propertyRows = items;
    propertyCache.clear();
    const rows = items.map((item) => {
      const rate = Math.min(100, Math.max(35, Math.round((Number(item.max_occupants ?? 1) / 4) * 100)));
      const occupancy = `${rate}% (${Math.min(Number(item.max_occupants ?? 1), 4)}/${Math.max(Number(item.max_occupants ?? 1), 4)})`;
      const image = normalizePropertyImage(item);
      propertyCache.set(String(item.id), item);
      const titleText = escape(item.title || 'Untitled Property');
      const propertyTypeLabel = normalizePropertyTypeLabel(item.room_type || item.property_type || '');
      return `
        <tr>
          <td>${image ? `<img class="property-thumb" src="${escape(image)}" alt="${escape(item.title || 'Property photo')}" />` : '<div class="thumb-placeholder"></div>'}</td>
          <td>
            <strong>${titleText}</strong><br />
            <small>${escape([item.address, item.municipality, item.barangay].filter(Boolean).join(', ') || 'No address provided')}</small>
          </td>
          <td>${renderAmenitiesChips(item) || '<span class="empty-amenity">None</span>'}</td>
          <td>₱${Number(item.monthly_rent ?? 0).toLocaleString()}/mo</td>
          <td>
            <div class="occupancy-cell">
              <div class="progress-track"><span data-rate="${rate}"></span></div>
              <small>${escape(occupancy)}</small>
            </div>
          </td>
          <td>0 inquiries</td>
          <td>
            <div class="property-row-actions">
              <div class="property-inline-actions">
                <a href="#/owner/inquiries?propertyId=${escape(String(item.id ?? ''))}" class="manage-link" data-property-id="${escape(String(item.id ?? ''))}">Manage</a>
              </div>
              <div class="property-more-wrap">
                <button type="button" class="property-more-btn" data-property-id="${escape(String(item.id ?? ''))}" aria-label="More property actions">⋯</button>
                <div class="property-menu" hidden>
                  <button type="button" class="property-menu-action edit-property" data-property-id="${escape(String(item.id ?? ''))}">Edit</button>
                  <button type="button" class="property-menu-action view-property" data-property-id="${escape(String(item.id ?? ''))}">View</button>
                  <button type="button" class="property-menu-action" data-property-id="${escape(String(item.id ?? ''))}" data-action="archive">Archive</button>
                  <button type="button" class="property-menu-action danger" data-property-id="${escape(String(item.id ?? ''))}" data-action="delete">Delete</button>
                </div>
              </div>
            </div>
          </td>
        </tr>`;
    });
    portfolioBody.innerHTML = rows.join('') || '<tr><td colspan="7" class="empty-row">No listings yet for this account.</td></tr>';
    portfolioBody.querySelectorAll('.progress-track span').forEach((bar) => {
      bar.style.setProperty('--rate', `${bar.dataset.rate}%`);
    });
  };

  portfolioBody.addEventListener('click', (event) => {
    const menuButton = event.target.closest('.property-more-btn');
    if (menuButton) {
      event.stopPropagation();
      const menu = menuButton.parentElement.querySelector('.property-menu');
      const shouldOpen = menu.hidden;

      portfolioBody.querySelectorAll('.property-menu').forEach((item) => {
        if (item !== menu) {
          item.hidden = true;
          item.classList.remove('is-upward');
        }
      });

      if (shouldOpen) {
        const rect = menuButton.getBoundingClientRect();
        const menuHeight = menu.offsetHeight || 170;
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        const shouldOpenUpward = spaceBelow < menuHeight && spaceAbove > menuHeight;
        menu.classList.toggle('is-upward', shouldOpenUpward);
      } else {
        menu.classList.remove('is-upward');
      }

      menu.hidden = !shouldOpen;
      return;
    }

    const editBtn = event.target.closest('.edit-property');
    const viewBtn = event.target.closest('.view-property');
    const menuAction = event.target.closest('.property-menu-action');

    if (menuAction && menuAction.dataset.action) {
      const propertyId = String(menuAction.dataset.propertyId);
      const property = propertyRows.find((item) => String(item.id) === propertyId);
      if (property) {
        openPropertyActionConfirm(property, menuAction.dataset.action);
      }
      return;
    }

    if (editBtn) {
      event.preventDefault();
      try {
        const propertyId = String(editBtn.dataset.propertyId);
        const propertyData = propertyCache.get(propertyId);
        if (!propertyData) {
          console.error('Property not found in cache:', propertyId);
          setFormMessage('Unable to find property data. Please try again.');
          return;
        }
        loadPropertyForEdit(propertyData);
      } catch (error) {
        console.error('Error loading property for edit:', error);
        setFormMessage('Unable to load property for editing.');
      }
      return;
    }

    if (viewBtn) {
      event.preventDefault();
      try {
        const propertyId = String(viewBtn.dataset.propertyId);
        const propertyData = propertyCache.get(propertyId);
        if (!propertyData) {
          console.error('Property not found in cache:', propertyId);
          setFormMessage('Unable to find property data. Please try again.');
          return;
        }
        showPropertyDetails(propertyData);
      } catch (error) {
        console.error('Error loading property details:', error);
        setFormMessage('Unable to load property details.');
      }
    }
  });

  propertyActionConfirmCancelBtn.addEventListener('click', closePropertyActionConfirm);
  propertyActionConfirmActionBtn.addEventListener('click', async () => {
    if (!pendingPropertyAction) return;

    const { property, action } = pendingPropertyAction;
    const propertyId = String(property.id);

    try {
      if (action === 'delete') {
        const response = await fetch(`${API}/properties/${propertyId}`, {
          method: 'DELETE',
          headers: authHeaders()
        });
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.message || 'Unable to delete property.');
        }
        showToast({ message: 'Property deleted successfully.', type: 'success' });
      } else if (action === 'archive') {
        const response = await fetch(`${API}/properties/${propertyId}`, {
          method: 'PATCH',
          headers: authHeaders(),
          body: JSON.stringify({ status: 'archived' })
        });
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.message || 'Unable to archive property.');
        }
        showToast({ message: 'Property archived successfully.', type: 'success' });
      }

      closePropertyActionConfirm();
      await load();
      await updateListingCountsInSidebar();
    } catch (error) {
      console.error('Property action failed:', error);
      setFormMessage(error.message || 'Unable to complete this action.');
      closePropertyActionConfirm();
    }
  });

  propertySearchInput?.addEventListener('input', () => {
    activePage = 1;
    applyPropertyTableState();
  });

  propertyTypeFilter?.addEventListener('change', () => {
    activePage = 1;
    applyPropertyTableState();
  });

  document.addEventListener('click', (event) => {
    if (!event.target.closest('.property-more-btn') && !event.target.closest('.property-menu')) {
      portfolioBody.querySelectorAll('.property-menu').forEach((menu) => {
        menu.hidden = true;
      });
    }
  });

  const loadPropertyForEdit = (propertyData) => {
    // Populate the form with existing property data
    const form = propertyForm;
    form.elements.title.value = propertyData.title || '';
    form.elements.roomType.value = propertyData.room_type || '';
    form.elements.monthlyRent.value = propertyData.monthly_rent || '';
    form.elements.maxOccupants.value = propertyData.max_occupants || '';
    form.elements.availableSlots.value = propertyData.available_slots || '';
    form.elements.genderPreference.value = propertyData.gender_preference || '';
    form.elements.address.value = propertyData.address || '';
    form.elements.municipality.value = propertyData.municipality || '';
    form.elements.barangay.value = propertyData.barangay || '';
    form.elements.latitude.value = propertyData.latitude || '';
    form.elements.longitude.value = propertyData.longitude || '';
    form.elements.description.value = propertyData.description || '';
    
    // Set amenities
    const amenitiesCheckboxes = form.querySelectorAll('input[name="amenities"]');
    const propertyAmenities = normalizeAmenities(propertyData);
    amenitiesCheckboxes.forEach((checkbox) => {
      checkbox.checked = propertyAmenities.includes(checkbox.value.toLowerCase());
    });
    
    // Update modal title and button text for edit mode
    const modalHeader = propertyModal.querySelector('.property-modal-header h2');
    const submitBtn = form.querySelector('button[type="submit"]');
    modalHeader.textContent = 'Edit Property Listing';
    submitBtn.textContent = 'Update Listing';
    form.dataset.editingPropertyId = propertyData.id;
    
    // Show modal and start from step 1
    propertyModal.hidden = false;
    showFormStep(1);
  };

  const showPropertyDetails = (propertyData) => {
    const detailsModal = document.createElement('div');
    detailsModal.className = 'property-details-modal';
    detailsModal.innerHTML = `
      <div class="property-details-card">
        <div class="property-details-header">
          <h2>${escape(propertyData.title || 'Property Details')}</h2>
          <button type="button" class="modal-close">×</button>
        </div>
        <div class="property-details-content">
          <div class="details-section">
            <label>Address</label>
            <p>${escape([propertyData.address, propertyData.barangay, propertyData.municipality].filter(Boolean).join(', ') || 'No address')}</p>
          </div>
          <div class="details-section">
            <label>Property Type</label>
            <p>${escape(normalizePropertyTypeLabel(propertyData.room_type || propertyData.property_type || 'N/A')) || 'N/A'}</p>
          </div>
          <div class="details-section">
            <label>Monthly Rent</label>
            <p>₱${Number(propertyData.monthly_rent ?? 0).toLocaleString()}</p>
          </div>
          <div class="details-section">
            <label>Max Occupants</label>
            <p>${propertyData.max_occupants || 'N/A'}</p>
          </div>
          <div class="details-section">
            <label>Available Slots</label>
            <p>${propertyData.available_slots || 'N/A'}</p>
          </div>
          <div class="details-section">
            <label>Gender Preference</label>
            <p>${escape(String(propertyData.gender_preference || 'Any').replaceAll('_', ' '))}</p>
          </div>
          <div class="details-section">
            <label>Amenities</label>
            <div class="amenities-list">
              ${renderAmenitiesChips(propertyData) || '<span>None</span>'}
            </div>
          </div>
          <div class="details-section">
            <label>Description</label>
            <p>${escape(propertyData.description || 'No description provided')}</p>
          </div>
        </div>
        <div class="property-details-actions">
          <button type="button" class="btn-secondary close-details">Close</button>
        </div>
      </div>
    `;
    
    document.body.append(detailsModal);
    
    // Handle close button
    detailsModal.querySelector('.modal-close').addEventListener('click', () => detailsModal.remove());
    detailsModal.querySelector('.close-details').addEventListener('click', () => detailsModal.remove());
    
    // Close on backdrop click
    detailsModal.addEventListener('click', (event) => {
      if (event.target === detailsModal) detailsModal.remove();
    });
  };

  const load = async () => {
    try {
      let response;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        response = await fetch(`${API}/properties?limit=100`, { headers: authHeaders() });
        if (response.status !== 429 || attempt === 1) break;
        await new Promise((resolve) => setTimeout(resolve, 800));
      }
      const body = await response.json();
      if (!response.ok) {
        if (response.status === 401) {
          clearSession();
          portfolioBody.innerHTML = '<tr><td colspan="7" class="empty-row">Your session has expired. Please sign in again.</td></tr>';
          setTimeout(() => location.assign('#/login'), 800);
          return;
        }
        throw new Error(body.message ?? 'Unable to load listings.');
      }
      const items = (body.data ?? []).filter((item) => Number(item.owner_id) === Number(user().id));
      allPropertyRows = items;
      applyPropertyTableState();
      if (requestedPropertyId && requestedAction === 'edit') {
        const requestedProperty = allPropertyRows.find((item) => String(item.id) === String(requestedPropertyId));
        if (requestedProperty) loadPropertyForEdit(requestedProperty);
      }
      await updateListingCountsInSidebar();
    } catch (error) {
      portfolioBody.innerHTML = `<tr><td colspan="7" class="empty-row">${escape(error.message)}</td></tr>`;
    }
  };

  root.querySelector('.logout')?.addEventListener('click', () => {
    localStorage.clear();
    location.assign('#/login');
  });

  load();
}
