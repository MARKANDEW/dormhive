import { ensureOwnerSidebarStyles, renderOwnerSidebar } from './sidebarOwner.js';

const API = window.DORMHIVE_API_URL ?? 'http://localhost:5000/api/v1';
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('dormhive.accessToken') ?? ''}` });
const user = () => JSON.parse(localStorage.getItem('dormhive.user') ?? '{}');
const apiBase = API.replace(/\/api\/v1\/?$/, '');
const DEFAULT_IMAGE_PLACEHOLDER = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 300"><rect width="500" height="300" fill="#ecf5ef"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#4a7160" font-family="Inter,Arial,sans-serif" font-size="28">No image available</text></svg>');
const resolveImageUrl = (value = '') => {
  const url = String(value || '').trim();
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  return `${apiBase}${url.startsWith('/') ? '' : '/'}${url}`;
};
const normalizePropertyImage = (property) => {
  const source = property.image_url || property.cover_image || (Array.isArray(property.images) && property.images[0]) || '';
  return resolveImageUrl(source);
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
  if (!document.querySelector('[data-owner-style="listings"]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = new URL('./style/myListing.css', import.meta.url);
    link.dataset.ownerStyle = 'listings';
    document.head.append(link);
  }
}

export function renderMyListing(root = document.querySelector('#app')) {
  if (!root) throw new Error('My listings page requires #app.');
  css();
  ensureOwnerSidebarStyles();

  const account = user();
  const profileName = account.name || 'Property Owner';
  const initials = profileName.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || 'PO';

  root.innerHTML = `
    <div class="owner-shell">
      ${renderOwnerSidebar('myListing')}
      <div class="owner-main">
        <main class="portfolio-page">
          <header class="portfolio-topbar">
            <div class="topbar-left">
              <a class="brand" href="#/owner/dashboardOwner">DormHive</a>
            </div>
            <label class="search-bar" aria-label="Search my listings, inquiries, tenants">
              <span>⌕</span>
              <input type="search" placeholder="Search my listings, inquiries, tenants..." />
            </label>
            <div class="topbar-right">
              <button class="top-icon" aria-label="Notifications">🔔</button>
              <div class="profile-identity">
                <div class="avatar">${escape(initials)}</div>
                <div>
                  <strong>${escape(profileName)}</strong>
                  <span>Property Owner</span>
                </div>
              </div>
            </div>
          </header>

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
                <span>Property Type</span>
                <select>
                  <option>All Types</option>
                  <option>Studio</option>
                  <option>Bed Space</option>
                  <option>Solo Room</option>
                  <option>Dormitory</option>
                  <option>Apartment</option>
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
                      <input id="property-image" name="image" type="file" accept="image/*" hidden>
                      <label for="property-image" class="media-dropzone-label">
                        <span class="dropzone-icon">📸</span>
                        <span>Drag &amp; drop a photo here</span>
                        <span class="dropzone-hint">or click to browse</span>
                      </label>
                      <div class="media-upload-status" aria-live="polite">No photo selected yet.</div>
                    </div>
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
                      <th>Type</th>
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

              <div class="pagination" aria-label="Portfolio pagination">
                <button type="button" data-page="prev" aria-label="Previous page">‹</button>
                <button type="button" data-page="1" class="active">1</button>
                <button type="button" data-page="2">2</button>
                <button type="button" data-page="3">3</button>
                <button type="button" data-page="next" aria-label="Next page">›</button>
              </div>
            </section>
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
  const formStepIndicator = root.querySelector('#form-step-indicator');
  const propertyFormMessage = root.querySelector('#property-form-message');
  const mediaDropzone = root.querySelector('.media-dropzone');
  const imageInput = root.querySelector('#property-image');
  const uploadStatus = root.querySelector('.media-upload-status');
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
  let leafletMap = null;
  let leafletMarker = null;
  let leafletLoadingPromise = null;
  let activePage = 1;
  let workflowTitle = '';
  let workflowPrice = 0;
  let currentFormStep = 1;

  const setFormMessage = (message, type = 'error') => {
    propertyFormMessage.hidden = false;
    propertyFormMessage.textContent = message;
    propertyFormMessage.className = `form-message ${type === 'success' ? 'success' : ''}`;
  };

  const updateUploadStatus = () => {
    if (!imageInput || !uploadStatus) return;
    if (imageInput.files.length) {
      uploadStatus.textContent = `Selected photo: ${imageInput.files[0].name}`;
      uploadStatus.classList.add('selected');
    } else {
      uploadStatus.textContent = 'Drag & drop a photo here or click to browse.';
      uploadStatus.classList.remove('selected');
    }
  };

  const setDropFiles = (files) => {
    if (!imageInput || !files?.length) return;
    try {
      const dataTransfer = new DataTransfer();
      Array.from(files).slice(0, 1).forEach((file) => dataTransfer.items.add(file));
      imageInput.files = dataTransfer.files;
      updateUploadStatus();
    } catch {
      // if DataTransfer is not supported, fallback to manual selection via click
    }
  };

  if (imageInput) {
    imageInput.addEventListener('change', updateUploadStatus);
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
        setDropFiles(files);
      }
    });
  }

  updateUploadStatus();

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
      const imageField = propertyForm.elements.image;
      if (!imageField?.files?.length) {
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
    updateUploadStatus();
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

  paginationButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const page = button.dataset.page;
      if (page === 'prev') {
        activePage = Math.max(1, activePage - 1);
      } else if (page === 'next') {
        activePage = Math.min(3, activePage + 1);
      } else {
        activePage = Number(page);
      }
      paginationButtons.forEach((pageButton) => pageButton.classList.toggle('active', String(pageButton.dataset.page) === String(activePage)));
    });
  });

  propertyForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!validateStep(3)) return;
    const formData = new FormData(propertyForm);
    try {
      const response = await fetch(`${API}/properties`, {
        method: 'POST',
        headers: authHeaders(),
        body: formData
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 401) {
          clearSession();
          setFormMessage('Your session has expired. Please sign in again.', 'error');
          setTimeout(() => location.assign('#/login'), 800);
          return;
        }
        throw new Error(body.message ?? 'Unable to create property.');
      }
      setFormMessage('Property created successfully. Listing is now pending admin approval.', 'success');
      setTimeout(() => {
        closeModal();
        load();
      }, 600);
    } catch (error) {
      setFormMessage(error.message);
    }
  });


  const renderRows = (items = []) => {
    const rows = items.map((item) => {
      const rate = Math.min(100, Math.max(35, Math.round((Number(item.max_occupants ?? 1) / 4) * 100)));
      const occupancy = `${rate}% (${Math.min(Number(item.max_occupants ?? 1), 4)}/${Math.max(Number(item.max_occupants ?? 1), 4)})`;
      const image = normalizePropertyImage(item);
      return `
        <tr>
          <td>${image ? `<img class="property-thumb" src="${escape(image)}" alt="${escape(item.title || 'Property photo')}" />` : '<div class="thumb-placeholder"></div>'}</td>
          <td>
            <strong>${escape(item.title || 'Untitled Property')}</strong><br />
            <small>${escape([item.address, item.municipality, item.barangay].filter(Boolean).join(', ') || 'No address provided')}</small>
          </td>
          <td>${escape(String(item.room_type || 'Room').replaceAll('_', ' '))}</td>
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
            <a href="#/owner/inquiries" class="manage-link">Manage</a>
            <button class="action-chip">Edit</button>
            <button class="action-chip">View</button>
          </td>
        </tr>`;
    });
    portfolioBody.innerHTML = rows.join('') || '<tr><td colspan="7" class="empty-row">No listings yet for this account.</td></tr>';
    portfolioBody.querySelectorAll('.progress-track span').forEach((bar) => {
      bar.style.setProperty('--rate', `${bar.dataset.rate}%`);
    });
  };

  const load = async () => {
    try {
      const response = await fetch(`${API}/properties?limit=100`, { headers: authHeaders() });
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
      const items = (body.data ?? []).filter((item) => Number(item.owner_id) === Number(account.id));
      renderRows(items);
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
