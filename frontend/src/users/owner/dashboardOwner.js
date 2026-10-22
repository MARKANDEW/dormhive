import { ensureOwnerSidebarStyles, loadOwnerStylesheet, renderOwnerProfileCard, renderOwnerSidebar, updateListingCountsInSidebar } from './sidebarOwner.js';
import { initLeafletMap, updateLeafletMarkers } from '../../components/mapPanel.js';
import { createModal, openModal } from '../../components/modal.js';
import { showToast } from '../../components/toast.js';
import { api, getApiErrorMessage, readApiResponse } from '../../services/api.js';
import { markNotificationRead } from '../../services/notificationSystem.js';
import { withMediaAccessToken } from '../../services/mediaAccess.js';

const API = window.DORMHIVE_API_URL ?? 'http://localhost:5000/api/v1';
const apiBase = API.replace(/\/api\/v1\/?$/, '');
const session = () => { try { return JSON.parse(localStorage.getItem('dormhive.user')) ?? {}; } catch { return {}; } };
const auth = () => ({ Authorization: `Bearer ${localStorage.getItem('dormhive.accessToken') ?? ''}` });
const escape = (value = '') => { const el = document.createElement('span'); el.textContent = value; return el.innerHTML; };
const resolveAvatarUrl = (value = '') => {
  const url = String(value || '').trim();
  if (!url) return '';
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;
  if (/^https?:\/\//i.test(url)) return url;
  return withMediaAccessToken(`${apiBase}${url.startsWith('/') ? '' : '/'}${url}`);
};
function ownerPropertyPhotoUrls(property = {}) {
  let images = property.images;
  if (typeof images === 'string') {
    try { images = JSON.parse(images); } catch { images = [images]; }
  }
  return [...new Set([
    property.image_url,
    property.cover_image,
    property.thumbnail,
    ...(Array.isArray(images) ? images : []),
    ...(Array.isArray(property.gallery) ? property.gallery : [])
  ].map((image) => typeof image === 'string' ? image : image?.url || image?.image_url || '')
    .map((image) => String(image || '').trim())
    .filter(Boolean)
    .map(withMediaAccessToken))];
}
function buildOwnerPropertyPopup(property = {}) {
  const title = String(property.title || property.property_title || property.name || 'Property');
  const locationText = [property.barangay, property.city, property.municipality, property.province].filter(Boolean).join(', ') || 'Metro Manila';
  const photoSources = ownerPropertyPhotoUrls(property);
  const primaryImage = photoSources[0] || 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500"><rect width="800" height="500" fill="#edf4f1"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#48676a" font-family="Arial,sans-serif" font-size="28">No image</text></svg>');
  const totalPhotos = Math.max(photoSources.length, 1);
  const rent = Number(property.monthly_rent ?? property.rent ?? 0);

  return `
    <div class="map-property-popup">
      <div class="map-property-card">
        <div class="map-property-image">
          <img class="map-property-photo" data-property-id="${escape(String(property.id ?? ''))}" src="${escape(primaryImage)}" alt="${escape(title)}" ${photoSources.length ? 'tabindex="0" role="button" aria-label="View property photos"' : ''} />
          <span class="map-property-image-badge">1/${totalPhotos}</span>
        </div>
        <div class="map-property-body">
          <h3>${escape(title)}</h3>
          <div class="map-property-location"><span>📍</span> ${escape(locationText)}</div>
          <div class="map-property-price">${escape(`₱${Number(rent || 0).toLocaleString('en-PH')}`)} <span>/ month</span></div>
          <div class="map-property-actions">
            <button type="button" class="map-property-details" data-property-id="${escape(String(property.id ?? ''))}">View Details</button>
            <button type="button" class="map-property-directions" data-property-id="${escape(String(property.id ?? ''))}">Get Directions</button>
          </div>
        </div>
      </div>
    </div>
  `;
}
const statusClass = {
  new: 'status-new',
  'new-inquiry': 'status-new',
  replied: 'status-replied',
  approved: 'status-approved',
  pending: 'status-pending'
};
const formatNotificationDate = (value) => new Date(value ?? Date.now()).toLocaleDateString([], { month: 'short', day: 'numeric' });

// Ensure Leaflet is loaded
async function ensureLeafletLoaded() {
  // Load Leaflet CSS if not already present
  if (!document.querySelector('link[href*="leaflet.css"]')) {
    const leafletCss = document.createElement('link');
    leafletCss.rel = 'stylesheet';
    leafletCss.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.append(leafletCss);
  }
  
  // Load Leaflet JS if not already loaded
  if (!window.L) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = (err) => reject(err);
      document.head.append(script);
    });
  }
  return Promise.resolve();
}
function clearTenantRouteStyles() {
  document.querySelectorAll('[data-tenant-style], [data-tenant-sidebar-style], [data-tenant-modal-css], [data-user-style="tenant-support"]').forEach((node) => node.remove());
}

function css() {
  const stylesheet = new URL('./style/dashboardOwner.css', import.meta.url);
  stylesheet.searchParams.set('v', 'owner-photo-viewer-reference-8');
  return loadOwnerStylesheet('dashboard', stylesheet);
}
async function get(path) { const response = await fetch(`${API}${path}`, { headers: auth() }); const body = await readApiResponse(response); if (!response.ok) throw new Error(getApiErrorMessage(body, 'Unable to load this information.')); return body; }
function metricCard(label, value, note, icon, trend = false) {
  return `<article class="metric-card"><div class="metric-icon">${icon}</div><div><p>${label}</p><strong>${value}</strong><span>${note}${trend ? ' ↗' : ''}</span></div></article>`;
}
function mapUrl(query) { return `https://www.google.com/maps?q=${encodeURIComponent(query)}&z=12&output=embed`; }

function showOwnerPhotoViewer(images, title) {
  if (!images.length) return;
  let photoIndex = 0;
  const viewer = document.createElement('dialog');
  viewer.className = 'owner-photo-viewer';
  const actions = document.createElement('div');
  actions.className = 'owner-photo-viewer__actions';

  const viewerImage = document.createElement('img');
  viewerImage.className = 'owner-photo-viewer__image';
  const stage = document.createElement('div');
  stage.className = 'owner-photo-viewer__stage';
  const previousButton = document.createElement('button');
  previousButton.type = 'button';
  previousButton.className = 'owner-photo-viewer__nav owner-photo-viewer__nav--previous';
  previousButton.setAttribute('aria-label', 'View previous photo');
  previousButton.title = 'Previous photo';
  previousButton.innerHTML = '<i class="bi bi-chevron-left" aria-hidden="true"></i>';
  const nextButton = document.createElement('button');
  nextButton.type = 'button';
  nextButton.className = 'owner-photo-viewer__nav owner-photo-viewer__nav--next';
  nextButton.setAttribute('aria-label', 'View next photo');
  nextButton.title = 'Next photo';
  nextButton.innerHTML = '<i class="bi bi-chevron-right" aria-hidden="true"></i>';
  const thumbnails = document.createElement('nav');
  thumbnails.className = 'owner-photo-viewer__thumbnails';
  thumbnails.setAttribute('aria-label', 'Property photos');
  const thumbnailButtons = images.map((image, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'owner-photo-viewer__thumbnail';
    button.dataset.photoIndex = String(index);
    button.setAttribute('aria-label', `View photo ${index + 1}`);
    button.setAttribute('aria-current', String(index === 0));
    const thumbnailImage = document.createElement('img');
    thumbnailImage.src = image;
    thumbnailImage.alt = '';
    thumbnailImage.loading = 'lazy';
    button.append(thumbnailImage);
    thumbnails.append(button);
    return button;
  });

  const createActionButton = (className, label, iconName) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `owner-photo-viewer__action ${className}`;
    button.setAttribute('aria-label', label);
    button.title = label;
    button.innerHTML = `<i class="bi ${iconName}" aria-hidden="true"></i>`;
    actions.append(button);
    return button;
  };
  const downloadButton = createActionButton('owner-photo-viewer__download', 'Download photo', 'bi-download');
  const shareButton = createActionButton('owner-photo-viewer__share', 'Share photo', 'bi-share');
  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'owner-photo-viewer__close';
  closeButton.setAttribute('aria-label', 'Close photo viewer');
  closeButton.title = 'Close viewer';
  closeButton.innerHTML = '<i class="bi bi-x-lg" aria-hidden="true"></i>';
  actions.append(closeButton);

  const renderPhoto = (nextIndex = photoIndex) => {
    photoIndex = (nextIndex + images.length) % images.length;
    viewerImage.src = images[photoIndex];
    viewerImage.alt = `${title} photo ${photoIndex + 1}`;
    const hasMultiplePhotos = images.length > 1;
    previousButton.hidden = !hasMultiplePhotos;
    nextButton.hidden = !hasMultiplePhotos;
    thumbnailButtons.forEach((button, index) => {
      const active = index === photoIndex;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-current', String(active));
    });
  };
  thumbnails.addEventListener('click', (event) => {
    const button = event.target.closest('.owner-photo-viewer__thumbnail');
    if (button) renderPhoto(Number(button.dataset.photoIndex));
  });
  previousButton.addEventListener('click', () => {
    photoIndex = (photoIndex - 1 + images.length) % images.length;
    renderPhoto();
  });
  nextButton.addEventListener('click', () => {
    photoIndex = (photoIndex + 1) % images.length;
    renderPhoto();
  });
  downloadButton.addEventListener('click', async () => {
    try {
      const response = await fetch(images[photoIndex]);
      if (!response.ok) throw new Error('Download failed');
      const objectUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `${String(title || 'property').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')}-photo-${photoIndex + 1}`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch {
      window.open(images[photoIndex], '_blank', 'noopener,noreferrer');
    }
  });
  shareButton.addEventListener('click', async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title, url: images[photoIndex] });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(images[photoIndex]);
        showToast({ message: 'Photo link copied.', type: 'success' });
      } else {
        throw new Error('Sharing is unavailable.');
      }
    } catch (error) {
      if (error.name !== 'AbortError') showToast({ message: 'Could not share this photo.', type: 'error' });
    }
  });
  closeButton.addEventListener('click', () => viewer.close());
  viewer.addEventListener('click', (event) => { if (event.target === viewer) viewer.close(); });
  viewer.addEventListener('close', () => viewer.remove(), { once: true });
  viewer.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') previousButton.click();
    if (event.key === 'ArrowRight') nextButton.click();
  });
  stage.append(viewerImage, previousButton, nextButton, actions);
  viewer.append(stage, thumbnails);
  document.body.append(viewer);
  renderPhoto();
  viewer.showModal();
}

async function showOwnerPropertyDetails(property) {
  if (document.querySelector('.property-details-modal')) return;

  const stylesheet = new URL('./style/myListing.css', import.meta.url);
  stylesheet.searchParams.set('v', 'portfolio-archive-tabs-1');
  await loadOwnerStylesheet('property-details', stylesheet);

  const galleryImages = ownerPropertyPhotoUrls(property);
  const placeholder = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 300"><rect width="500" height="300" fill="#ecf5ef"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#4a7160" font-family="Arial,sans-serif" font-size="28">No image available</text></svg>');
  const photos = [...new Set(galleryImages)].length ? [...new Set(galleryImages)] : [placeholder];
  const title = String(property.title || property.property_title || 'Property');
  const propertyType = String(property.room_type || property.property_type || 'N/A').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  const location = [property.address, property.barangay, property.municipality, property.city, property.province].filter(Boolean).join(', ') || 'No address';
  const owner = session();
  const ownerName = property.owner_name || property.owner?.name || [owner.first_name, owner.last_name].filter(Boolean).join(' ') || owner.name || 'N/A';
  let amenities = property.amenities;
  if (typeof amenities === 'string') {
    try { amenities = JSON.parse(amenities); } catch { amenities = amenities.split(','); }
  }
  const amenityLabels = { wifi: 'Wi-Fi', laundry: 'Laundry', kitchen: 'Kitchen', aircon: 'Aircon', pets_allowed: 'Pets allowed', dishwasher: 'Dishwasher', balcony: 'Balcony', parking: 'Parking', utilities_included: 'Utilities included', cable_ready: 'Cable ready' };
  const amenityMarkup = (Array.isArray(amenities) ? amenities : []).slice(0, 4).map((amenity) => {
    const value = String(amenity).trim().toLowerCase();
    const label = amenityLabels[value] || value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
    return `<span class="amenity-chip">${escape(label)}</span>`;
  }).join('');

  const modal = document.createElement('div');
  modal.className = 'property-details-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', 'Property Details');
  modal.innerHTML = `
    <div class="property-details-card">
      <div class="property-details-header">
        <h2><span class="property-details-header-icon"><i class="bi bi-house-door-fill" aria-hidden="true"></i></span>Property Details</h2>
        <button type="button" class="modal-close" aria-label="Close property details">×</button>
      </div>
      <div class="property-details-content">
        <div class="property-details-gallery" aria-label="Property photos">
          <div class="property-details-gallery-stage">
            <img class="property-details-main-image" src="${escape(photos[0])}" alt="${escape(title)} photo 1">
            <span class="property-details-image-counter" aria-live="polite">1 / ${photos.length}</span>
            <button type="button" class="property-details-gallery-nav previous" aria-label="Previous photo">&#8249;</button>
            <button type="button" class="property-details-gallery-nav next" aria-label="Next photo">&#8250;</button>
          </div>
          <div class="property-details-thumbnails" role="group" aria-label="Property photo thumbnails">
            ${photos.map((image, index) => `<button type="button" class="property-details-thumbnail${index === 0 ? ' active' : ''}" data-gallery-index="${index}" aria-label="View photo ${index + 1}" aria-current="${index === 0}"><img src="${escape(image)}" alt=""></button>`).join('')}
          </div>
        </div>
        <div class="property-details-information">
          <div class="property-details-heading">
            <h3>${escape(title)}</h3>
            <strong>PHP ${Number(property.monthly_rent ?? 0).toLocaleString('en-PH')} / month</strong>
          </div>
          <div class="property-details-facts">
            <div class="details-section"><span class="details-label"><i class="bi bi-geo-alt-fill" aria-hidden="true"></i>Location</span><p>${escape(location)}</p></div>
            <div class="details-section"><span class="details-label"><i class="bi bi-house-fill" aria-hidden="true"></i>Room Type</span><p>${escape(propertyType)}</p></div>
            <div class="details-section"><span class="details-label"><i class="bi bi-people-fill" aria-hidden="true"></i>Occupancy</span><p>${property.max_occupants != null ? `Up to ${escape(property.max_occupants)} tenants` : 'N/A'}</p></div>
            <div class="details-section"><span class="details-label"><i class="bi bi-door-open-fill" aria-hidden="true"></i>Available Slots</span><p>${escape(property.available_slots ?? 'N/A')}</p></div>
            <div class="details-section"><span class="details-label"><i class="bi bi-gender-ambiguous" aria-hidden="true"></i>Gender Preference</span><p>${escape(String(property.gender_preference || 'Any').replaceAll('_', ' '))}</p></div>
            <div class="details-section"><span class="details-label"><i class="bi bi-person-fill" aria-hidden="true"></i>Owner</span><p>${escape(ownerName)}</p></div>
            <div class="details-section details-amenities"><span class="details-label"><i class="bi bi-stars" aria-hidden="true"></i>Amenities</span><div class="amenities-list">${amenityMarkup || '<span>None</span>'}</div></div>
          </div>
          <div class="details-section property-details-description"><span class="details-label"><i class="bi bi-card-text" aria-hidden="true"></i>Description</span><p>${escape(property.description || 'No description provided')}</p></div>
        </div>
      </div>
      <div class="property-details-actions"><button type="button" class="btn-secondary close-details">Close</button></div>
    </div>`;

  const detailsStylesheet = document.querySelector('link[data-owner-style="property-details"]');
  const closeModal = () => {
    modal.remove();
    document.removeEventListener('keydown', handleEscape);
    detailsStylesheet?.remove();
  };
  const handleEscape = (event) => { if (event.key === 'Escape') closeModal(); };
  document.body.append(modal);
  modal.querySelector('.modal-close').addEventListener('click', closeModal);
  modal.querySelector('.close-details').addEventListener('click', closeModal);
  modal.addEventListener('click', (event) => { if (event.target === modal) closeModal(); });
  document.addEventListener('keydown', handleEscape);

  const mainImage = modal.querySelector('.property-details-main-image');
  const counter = modal.querySelector('.property-details-image-counter');
  const thumbnails = Array.from(modal.querySelectorAll('.property-details-thumbnail'));
  let photoIndex = 0;
  const showPhoto = (nextIndex) => {
    photoIndex = (nextIndex + photos.length) % photos.length;
    mainImage.src = photos[photoIndex];
    mainImage.alt = `${title} photo ${photoIndex + 1}`;
    counter.textContent = `${photoIndex + 1} / ${photos.length}`;
    thumbnails.forEach((thumbnail, index) => {
      const active = index === photoIndex;
      thumbnail.classList.toggle('active', active);
      thumbnail.setAttribute('aria-current', String(active));
    });
  };
  modal.querySelector('.property-details-gallery-nav.previous').addEventListener('click', () => showPhoto(photoIndex - 1));
  modal.querySelector('.property-details-gallery-nav.next').addEventListener('click', () => showPhoto(photoIndex + 1));
  thumbnails.forEach((thumbnail) => thumbnail.addEventListener('click', () => showPhoto(Number(thumbnail.dataset.galleryIndex))));
  mainImage.addEventListener('click', () => showOwnerPhotoViewer(photos, title));
}

async function showFullMapModal(properties = []) {
  // Load Leaflet libraries first
  try {
    await ensureLeafletLoaded();
  } catch (e) {
    console.error('Failed to load Leaflet:', e);
    alert('Could not load map library. Check browser console.');
    return;
  }
  
  await new Promise(resolve => setTimeout(resolve, 500));
  
  const mapHtml = `
    <div class="full-map-container">
      <div id="tenant-map" class="leaflet-map"></div>
      <p id="map-status"></p>
    </div>
  `;
  const modal = createModal({ title: 'Full Map & Heatmap', content: mapHtml, closeLabel: 'Close', closeOnBackdrop: false });
  
  // Store map reference for cleanup
  let mapInstance = null;
  
  // Add cleanup handler - try multiple approaches for better compatibility
  const cleanupMap = () => {
    if (mapInstance) {
      try {
        mapInstance.remove();
        mapInstance = null;
        console.log('Map cleaned up');
      } catch (e) {
        console.log('Error cleaning up map:', e);
      }
    }
    // Remove modal from DOM after closing
    setTimeout(() => {
      if (modal && modal.parentElement) {
        modal.remove();
      }
    }, 100);
  };
  
  modal.addEventListener('close', cleanupMap);
  
  openModal(modal);
  
  // Wait for modal to render and initialize map
  setTimeout(async () => {
    try {
      const mapContainer = modal.querySelector('#tenant-map');
      const statusEl = modal.querySelector('#map-status');
      
      if (!mapContainer) {
        console.error('Map container not found in modal');
        if (statusEl) statusEl.textContent = 'Map container not found';
        return;
      }
      
      if (!window.L) {
        console.error('Leaflet library not available');
        if (statusEl) statusEl.textContent = 'Leaflet library not loaded';
        return;
      }
      
      console.log('Initializing Leaflet map...');
      if (statusEl) statusEl.textContent = 'Initializing map...';
      
      // Force dimensions
      mapContainer.style.width = '100%';
      mapContainer.style.height = '500px';
      mapContainer.style.display = 'block';
      
      // Initialize map
      mapInstance = window.L.map(mapContainer, { 
        attributionControl: true,
        zoomControl: true 
      }).setView([14.5995, 120.9842], 12);
      
      console.log('Map created, adding tile layer...');
      
      // Add tile layer
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
      }).addTo(mapInstance);
      
      // Add markers for properties
      let markerCount = 0;
      if (properties && properties.length > 0) {
        const markerCoords = [];
        
        properties.forEach(prop => {
          let lat = Number(prop.latitude ?? prop.lat ?? NaN);
          let lng = Number(prop.longitude ?? prop.lng ?? NaN);
          
          // If coordinates are missing, use default Manila coordinates with small offset
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            // Use default Manila location with random small offset for clustering
            const offset = (markerCount * 0.001);
            lat = 14.5995 + offset;
            lng = 120.9842 + offset;
          }
          
          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            const marker = window.L.marker([lat, lng]).addTo(mapInstance);
            const title = String(prop.title || 'Property');
            const rent = Number(prop.monthly_rent ?? 0).toLocaleString();
            marker.bindPopup(`<strong>${escape(title)}</strong><br>₱${rent}/mo`);
            markerCoords.push([lat, lng]);
            markerCount++;
          }
        });
        
        console.log(`Added ${markerCount} markers to map`);
        if (statusEl) statusEl.textContent = `Map loaded with ${markerCount} properties`;
        
        // Fit map to bounds if we have markers
        if (markerCoords.length > 1) {
          try {
            const bounds = window.L.latLngBounds(markerCoords);
            mapInstance.fitBounds(bounds.pad(0.1));
          } catch (e) {
            console.log('Could not fit bounds:', e);
          }
        }
      } else {
        if (statusEl) statusEl.textContent = 'No properties to display';
      }
      
      // Trigger map resize to ensure it displays properly
      setTimeout(() => {
        if (mapInstance) {
          mapInstance.invalidateSize();
          console.log('Map size invalidated');
        }
      }, 100);
      
    } catch (error) {
      console.error('Map initialization error:', error);
      const statusEl = modal.querySelector('#map-status');
      if (statusEl) statusEl.textContent = 'Error: ' + error.message;
      cleanupMap();
    }
  }, 300);
}

function generatePerformanceReportHtml(properties = [], bookings = [], metrics = {}) {
  const approved = bookings.filter((item) => item.status === 'approved');
  const pending = bookings.filter((item) => item.status === 'pending');
  const rejected = bookings.filter((item) => item.status === 'rejected');
  const activeProperties = properties.filter((item) => item.status === 'approved').length;
  const totalRevenue = approved.reduce((total, item) => total + Number(item.monthly_rent ?? 0), 0);
  const occupancyRate = metrics.occupancy ?? 0;
  const reportDate = new Date().toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' });

  return `
    <div class="report-container">
      <div class="report-header">
        <h2>Performance Report</h2>
        <p class="report-date">Generated on ${escape(reportDate)}</p>
      </div>
      <div class="report-section">
        <h3>📊 Key Metrics</h3>
        <div class="metrics-grid">
          <div class="metric-box">
            <span class="metric-label">Active Properties</span>
            <strong class="metric-value">${activeProperties}</strong>
          </div>
          <div class="metric-box">
            <span class="metric-label">Total Bookings</span>
            <strong class="metric-value">${bookings.length}</strong>
          </div>
          <div class="metric-box">
            <span class="metric-label">Occupancy Rate</span>
            <strong class="metric-value">${occupancyRate}%</strong>
          </div>
          <div class="metric-box">
            <span class="metric-label">Monthly Revenue</span>
            <strong class="metric-value">₱${totalRevenue.toLocaleString()}</strong>
          </div>
        </div>
      </div>
      <div class="report-section">
        <h3>✅ Booking Status</h3>
        <div class="status-breakdown">
          <div class="status-item">
            <span class="status-label">Approved</span>
            <strong>${approved.length}</strong>
          </div>
          <div class="status-item">
            <span class="status-label">Pending</span>
            <strong>${pending.length}</strong>
          </div>
          <div class="status-item">
            <span class="status-label">Rejected</span>
            <strong>${rejected.length}</strong>
          </div>
        </div>
      </div>
      <div class="report-section">
        <h3>🏠 Property Overview</h3>
        <div class="property-list">
          ${properties.slice(0, 5).map((prop) => {
            const status = prop.status === 'approved' ? '✓ Active' : `⏳ ${prop.status}`;
            const rent = Number(prop.monthly_rent ?? 0).toLocaleString();
            return `
              <div class="property-item">
                <div class="property-name">${escape(prop.title || 'Untitled')}</div>
                <div class="property-details">
                  <span>${escape(prop.barangay || 'Location')}</span>
                  <span>₱${rent}/mo</span>
                  <span class="status-badge">${status}</span>
                </div>
              </div>
            `;
          }).join('')}
          ${properties.length === 0 ? '<p class="empty">No properties to display</p>' : ''}
        </div>
      </div>
    </div>
  `;
}
export async function renderDashboardOwner(root = document.querySelector('#app')) {
  if (!root) throw new Error('Owner dashboard requires #app.');
  clearTenantRouteStyles();
  await Promise.all([css(), ensureOwnerSidebarStyles()]);
  const user = session();
  const profileName = user.name || 'Owner';
  const profileInitials = profileName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'O';
  const firstName = profileName.split(/\s+/).filter(Boolean)[0] || 'there';
  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? 'Good morning' : currentHour < 18 ? 'Good afternoon' : 'Good evening';
  root.innerHTML = `
    <div class="owner-shell owner-shell--dashboard">
      ${renderOwnerSidebar('dashboardOwner')}
      <div class="owner-main">
        <main class="owner-dashboard">
          <section class="dashboard-greeting dashboard-greeting--with-tools">
            <div class="dashboard-greeting-copy">
              <p class="eyebrow">OWNER OVERVIEW</p>
              <h1 data-dashboard-greeting>${greeting}, ${escape(firstName)}</h1>
              <p>Here's what's happening with your properties today.</p>
            </div>
            <div class="dashboard-tools">
              <button class="menu" aria-label="Toggle menu">☰</button>
              <div class="topbar-right">
            <div class="notification-menu">
              <button class="top-icon notification-trigger" type="button" aria-label="Notifications" aria-expanded="false">
                <span aria-hidden="true">&#128276;</span>
                <span class="notification-badge" hidden>0</span>
              </button>
              <div class="notification-dropdown" hidden>
                <div class="notification-dropdown-header">
                  <strong>Notifications</strong>
                  <div class="notification-dropdown-actions">
                    <button class="notification-more-button" type="button" aria-label="Notification actions" aria-expanded="false">
                      <svg class="notification-more-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.8"></circle><circle cx="12" cy="12" r="1.8"></circle><circle cx="19" cy="12" r="1.8"></circle></svg>
                    </button>
                    <div class="notification-actions-menu" hidden>
                      <button class="notification-mark-all-read" type="button"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"></path></svg><span>Mark all as read</span></button>
                    </div>
                  </div>
                </div>
                <div class="notification-filters" role="group" aria-label="Filter notifications">
                  <button class="notification-filter is-active" type="button" data-notification-filter="all" aria-pressed="true">All</button>
                  <button class="notification-filter" type="button" data-notification-filter="unread" aria-pressed="false">Unread</button>
                </div>
                <div class="notification-list"><p class="notification-empty">No notifications yet.</p></div>
              </div>
            </div>
            ${renderOwnerProfileCard()}
              </div>
            </div>
          </section>
          <section class="metrics-grid">
            <article class="metric-card metric-card--highlight">
              <div><p>Listings</p><strong data-metric="listings">0 Active</strong><span data-metric-note="listings">0 / 0 properties active</span></div>
            </article>
            <article class="metric-card">
              <div><p>Inquiries</p><strong data-metric="inquiries">0 Total</strong><span data-metric-note="inquiries">No new inquiries</span></div>
            </article>
            <article class="metric-card">
              <div><p>Occupancy Rate</p><strong data-metric="occupancy">0%</strong><span data-metric-note="occupancy">0 / 0 units occupied</span></div>
            </article>
          </section>
          <section class="overview-grid">
            <article class="panel map-panel">
              <div class="panel-title-row">
                <div class="map-panel-heading">
                  <h2>Map Overview</h2>
                  <div class="map-location-search">
                    <button type="button" class="map-location-search-toggle" aria-label="Open location search" aria-expanded="false" title="Search locations"><i class="bi bi-search" aria-hidden="true"></i></button>
                    <form class="map-location-search-form" aria-hidden="true">
                      <input type="search" class="map-location-search-input" placeholder="Search a location" aria-label="Search a location" tabindex="-1">
                    </form>
                  </div>
                </div>
                <button class="panel-button">View Full Map & Heatmap</button>
              </div>
              <div class="map-frame-wrap"><div id="tenant-map" class="leaflet-map" style="height:20rem;border-radius:0.5rem"></div></div>
            </article>
            <aside class="panel action-panel">
              <div class="panel-title-row"><h2>Action Center</h2></div>
              <div class="action-stack">
                <button class="action-button" type="button" data-route="#/owner/myListing">+ List a New Property</button>
                <div class="pending-actions" data-pending-actions><p class="action-section-label">Pending Actions</p></div>
                <button class="action-button secondary">Generate Performance Report</button>
              </div>
            </aside>
          </section>
          <section class="panel attention-panel">
            <div class="panel-title-row"><h2>Needs Attention</h2><a href="#/owner/inquiries">View all</a></div>
            <div class="attention-list" data-attention-list></div>
          </section>
          <section class="interactions-grid">
            <article class="panel table-panel">
              <div class="panel-title-row"><h2>Inquiries &amp; Bookings</h2></div>
              <div class="table-wrap"><table><thead><tr><th>Tenant Name</th><th>Property</th><th>Date</th><th>Status</th><th>Action</th></tr></thead><tbody></tbody></table></div>
            </article>
            <article class="panel listings-panel">
              <div class="panel-title-row"><h2>My Listings</h2><a href="#/owner/myListing">Manage</a></div>
              <div class="listings-card-grid"></div>
            </article>
          </section>
        </main>
      </div>
    </div>
    <div class="owner-welcome" data-owner-welcome hidden>
      <section class="owner-welcome-dialog" role="dialog" aria-modal="true" aria-labelledby="owner-welcome-title">
        <p class="eyebrow">YOUR OWNER ACCOUNT</p>
        <h2 id="owner-welcome-title">Welcome, ${escape(firstName)}. What would you like to do first?</h2>
        <p class="owner-welcome-copy">You can create a listing now or explore your dashboard first.</p>
        <div class="owner-welcome-actions">
          <button class="owner-welcome-choice owner-welcome-choice--primary" type="button" data-owner-welcome-add>
            <i class="bi bi-plus-circle" aria-hidden="true"></i>
            <span><strong>Add a property</strong><small>Create your first listing</small></span>
          </button>
          <button class="owner-welcome-choice" type="button" data-owner-welcome-explore>
            <i class="bi bi-compass" aria-hidden="true"></i>
            <span><strong>Explore your dashboard</strong><small>Look around before adding a listing</small></span>
          </button>
        </div>
      </section>
    </div>`;
  const shell = root.querySelector('.owner-shell');
  const listingGrid = root.querySelector('.listings-card-grid');
  const ownerWelcome = root.querySelector('[data-owner-welcome]');
  const routeSearch = new URLSearchParams(window.DORMHIVE_ROUTE_SEARCH ?? window.location.search);
  if (routeSearch.get('welcome') === 'owner') {
    history.replaceState({}, '', '#/owner/dashboardOwner');
    ownerWelcome.hidden = false;
  }
  root.querySelector('[data-owner-welcome-add]').addEventListener('click', () => {
    location.hash = '#/owner/myListing?action=create';
  });
  root.querySelector('[data-owner-welcome-explore]').addEventListener('click', () => {
    ownerWelcome.hidden = true;
  });
  root.querySelector('.menu').addEventListener('click', () => shell.classList.toggle('nav-open'));
  root.querySelector('[data-route="#/owner/myListing"]').addEventListener('click', () => location.hash = '#/owner/myListing');
  const notificationMenu = root.querySelector('.notification-menu');
  const notificationTrigger = root.querySelector('.notification-trigger');
  const notificationBadge = root.querySelector('.notification-badge');
  const notificationDropdown = root.querySelector('.notification-dropdown');
  const notificationList = root.querySelector('.notification-list');
  const notificationMoreButton = root.querySelector('.notification-more-button');
  const notificationActionsMenu = root.querySelector('.notification-actions-menu');
  const markAllNotificationsReadButton = root.querySelector('.notification-mark-all-read');
  const notificationFilterButtons = Array.from(notificationDropdown.querySelectorAll('[data-notification-filter]'));
  let notifications = [];
  let notificationFilter = 'all';

  const renderNotifications = () => {
    const unreadCount = notifications.filter((item) => !item.read_at).length;
    notificationBadge.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
    notificationBadge.hidden = unreadCount === 0;
    markAllNotificationsReadButton.disabled = unreadCount === 0;
    notificationFilterButtons.forEach((button) => {
      const isActive = button.dataset.notificationFilter === notificationFilter;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
    });
    const visibleNotifications = (notificationFilter === 'unread'
      ? notifications.filter((item) => !item.read_at)
      : notifications).slice(0, 6);
    notificationList.innerHTML = visibleNotifications.length
      ? visibleNotifications.map((item) => `
          <button class="notification-item${item.read_at ? '' : ' is-unread'}" type="button" data-notification-id="${item.id}">
            <span class="notification-item-copy"><strong>${escape(item.title || 'Notification')}</strong><span>${escape(item.message || '')}</span></span>
            <time>${escape(formatNotificationDate(item.created_at))}</time>
          </button>`).join('')
      : `<p class="notification-empty">${notificationFilter === 'unread' && notifications.length ? 'No unread notifications.' : 'No notifications yet.'}</p>`;
  };

  const loadNotifications = async () => {
    try {
      const response = await api.notifications.list();
      notifications = Array.isArray(response?.data) ? response.data : [];
      renderNotifications();
    } catch {
      notificationList.innerHTML = '<p class="notification-empty">Notifications unavailable.</p>';
    }
  };

  notificationTrigger.addEventListener('click', () => {
    const isOpen = !notificationDropdown.hidden;
    notificationDropdown.hidden = isOpen;
    notificationTrigger.setAttribute('aria-expanded', String(!isOpen));
  });
  notificationMoreButton.addEventListener('click', () => {
    const isOpen = !notificationActionsMenu.hidden;
    notificationActionsMenu.hidden = isOpen;
    notificationMoreButton.setAttribute('aria-expanded', String(!isOpen));
  });
  markAllNotificationsReadButton.addEventListener('click', async () => {
    const unreadNotifications = notifications.filter((item) => !item.read_at);
    if (!unreadNotifications.length) return;
    markAllNotificationsReadButton.disabled = true;
    const results = await Promise.allSettled(unreadNotifications.map((item) => markNotificationRead(item.id)));
    const readAt = new Date().toISOString();
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') unreadNotifications[index].read_at = readAt;
    });
    notificationActionsMenu.hidden = true;
    notificationMoreButton.setAttribute('aria-expanded', 'false');
    renderNotifications();
  });
  notificationDropdown.querySelector('.notification-filters').addEventListener('click', (event) => {
    const button = event.target.closest('[data-notification-filter]');
    if (!button) return;
    notificationFilter = button.dataset.notificationFilter;
    renderNotifications();
  });
  notificationList.addEventListener('click', async (event) => {
    const item = event.target.closest('[data-notification-id]');
    if (!item) return;
    const notification = notifications.find((entry) => String(entry.id) === item.dataset.notificationId);
    if (!notification || notification.read_at) return;
    try {
      await markNotificationRead(notification.id);
      notification.read_at = new Date().toISOString();
      renderNotifications();
    } catch { /* Keep the item unread when the API request fails. */ }
  });
  document.addEventListener('click', (event) => {
    if (!notificationMenu.contains(event.target)) {
      notificationDropdown.hidden = true;
      notificationTrigger.setAttribute('aria-expanded', 'false');
    }
  });
  loadNotifications();
  const notificationPoll = setInterval(() => {
    if (!root.isConnected) return clearInterval(notificationPoll);
    loadNotifications();
  }, 15000);
  
  // Store report and map data for later use
  let reportData = { properties: [], bookings: [], metrics: { occupancy: 0 } };
  let ownerMap = null;
  let searchMarker = null;

  const locationSearch = root.querySelector('.map-location-search');
  const locationSearchToggle = root.querySelector('.map-location-search-toggle');
  const locationSearchForm = root.querySelector('.map-location-search-form');
  const locationSearchInput = root.querySelector('.map-location-search-input');

  locationSearchToggle.disabled = true;
  locationSearchToggle.addEventListener('click', () => {
    const isOpen = locationSearch.classList.toggle('is-open');
    locationSearchToggle.setAttribute('aria-expanded', String(isOpen));
    locationSearchToggle.setAttribute('aria-label', isOpen ? 'Close location search' : 'Open location search');
    locationSearchForm.setAttribute('aria-hidden', String(!isOpen));
    locationSearchInput.tabIndex = isOpen ? 0 : -1;
    if (isOpen) {
      const focusExpandedInput = (transitionEvent) => {
        if (transitionEvent.target !== locationSearchForm || transitionEvent.propertyName !== 'width') return;
        locationSearchForm.removeEventListener('transitionend', focusExpandedInput);
        if (locationSearch.classList.contains('is-open')) locationSearchInput.focus({ preventScroll: true });
      };
      locationSearchForm.addEventListener('transitionend', focusExpandedInput);
      locationSearchInput.focus({ preventScroll: true });
    }
  });

  locationSearchForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const query = locationSearchInput.value.trim();
    if (!query) {
      locationSearchInput.focus();
      return;
    }
    if (!ownerMap) {
      showToast({ message: 'Map is still loading. Try again shortly.', type: 'error' });
      return;
    }

    locationSearchInput.disabled = true;
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`);
      if (!response.ok) throw new Error('Location search is unavailable.');
      const results = await response.json();
      const result = results[0];
      if (!result) {
        showToast({ message: 'No matching location found.', type: 'error' });
        return;
      }

      const coordinates = [Number(result.lat), Number(result.lon)];
      if (!coordinates.every(Number.isFinite)) throw new Error('The location result is invalid.');
      if (searchMarker) ownerMap.removeLayer(searchMarker);
      searchMarker = window.L.marker(coordinates).addTo(ownerMap);
      searchMarker.bindPopup(escape(result.display_name || query)).openPopup();
      ownerMap.setView(coordinates, 15);
    } catch (error) {
      showToast({ message: error.message || 'Could not search this location.', type: 'error' });
    } finally {
      locationSearchInput.disabled = false;
    }
  });
  
  // Add event listener for View Full Map & Heatmap button
  root.querySelector('.panel-button').addEventListener('click', async () => {
    try {
      // Fetch properties if not already loaded
      let properties = reportData.properties;
      if (properties.length === 0) {
        const response = await get('/properties?limit=100').catch(() => ({ data: [] }));
        properties = (response.data ?? []).filter((item) => Number(item.owner_id) === Number(user.id));
      }
      await showFullMapModal(properties);
    } catch (error) {
      console.error('Map modal error:', error);
      showToast({ message: 'Could not open full map.', type: 'error' });
    }
  });
  
  // Add event listener for Generate Performance Report button
  root.querySelector('.action-button.secondary').addEventListener('click', () => {
    try {
      const reportHtml = generatePerformanceReportHtml(reportData.properties, reportData.bookings, reportData.metrics);
      const modal = createModal({ title: 'Performance Report', content: reportHtml, closeLabel: 'Close', closeOnBackdrop: false });
      openModal(modal);
    } catch (error) {
      showToast({ message: 'Could not generate performance report.', type: 'error' });
    }
  });
  Promise.all([get('/properties?limit=100').catch(() => ({ data: [] })), get('/bookings').catch(() => ({ data: [] }))]).then(async ([properties, bookings]) => {
    const items = (properties.data ?? []).filter((item) => Number(item.owner_id) === Number(user.id));
    const approvedListings = items.filter((item) => String(item.status).toLowerCase() === 'approved');
    const listingPhotoSets = new Map();
    const cards = items.map((item) => {
      const roomType = String(item.room_type || 'Property').replaceAll('_', ' ');
      const place = [item.barangay, item.municipality].filter(Boolean).join(', ') || 'Manila';
      const badge = item.status === 'approved' ? 'Active' : String(item.status || 'Available').replaceAll('_', ' ');
      let listingImages = item.images;
      if (typeof listingImages === 'string') {
        try { listingImages = JSON.parse(listingImages); } catch { listingImages = []; }
      }
      const photoSet = [...new Set((Array.isArray(listingImages) ? listingImages : []).map(resolveAvatarUrl).filter(Boolean))];
      const image = resolveAvatarUrl(item.image_url || item.cover_image || photoSet[0] || '');
      listingPhotoSets.set(String(item.id ?? ''), [...new Set([image, ...photoSet].filter(Boolean))]);
      return `
        <article class="listing-card">
          ${image ? `<img class="listing-card-image" data-property-id="${escape(String(item.id ?? ''))}" src="${escape(image)}" alt="${escape(item.title || 'Property')}" />` : '<div class="listing-card-image listing-card-image--empty">No image</div>'}
          <div class="listing-topline"><span class="property-pill">${escape(badge)}</span><span class="property-rent">₱${Number(item.monthly_rent ?? 0).toLocaleString()}/mo</span></div>
          <h3>${escape(item.title || 'Untitled property')}</h3>
          <p class="listing-subtitle">${escape(place)} • ${escape(roomType)}</p>
          <div class="listing-actions"><button type="button" class="manage-listing" data-property-id="${escape(String(item.id ?? ''))}">Manage</button><button type="button" class="ghost edit-listing" data-property-id="${escape(String(item.id ?? ''))}">Edit Listing</button></div>
        </article>`;
    }).join('');
    listingGrid.innerHTML = cards || '<p class="empty">No property listings yet for this account.</p>';
    listingGrid.querySelectorAll('.listing-card-image[data-property-id]').forEach((image) => {
      const photos = listingPhotoSets.get(image.dataset.propertyId) ?? [];
      const title = image.alt || 'Property';
      image.tabIndex = 0;
      image.setAttribute('role', 'button');
      image.setAttribute('aria-label', `View ${title} photo larger`);
      image.addEventListener('click', () => showOwnerPhotoViewer(photos, title));
      image.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          showOwnerPhotoViewer(photos, title);
        }
      });
    });
    listingGrid.querySelectorAll('.manage-listing').forEach((button) => {
      button.addEventListener('click', () => {
        location.hash = `#/owner/inquiries?propertyId=${encodeURIComponent(button.dataset.propertyId)}`;
      });
    });
    listingGrid.querySelectorAll('.edit-listing').forEach((button) => {
      button.addEventListener('click', () => {
        location.hash = `#/owner/myListing?propertyId=${encodeURIComponent(button.dataset.propertyId)}&action=edit`;
      });
    });
    const requests = bookings.data.length ? bookings.data : [];
    const approved = requests.filter((item) => item.status === 'approved');
    const pendingRequests = requests.filter((item) => item.status === 'pending');
    const activeListings = approvedListings.length;
    const inquiryCount = requests.length;
    const totalUnits = approvedListings.reduce((total, item) => total + Math.max(0, Number(item.max_occupants ?? item.available_slots ?? 0)), 0);
    const occupiedUnits = approved.reduce((total, item) => total + Math.max(1, Number(item.occupants ?? 1)), 0);
    const occupancy = totalUnits ? Math.min(100, Math.round((occupiedUnits / totalUnits) * 100)) : 0;
    const projectedRevenue = approved.reduce((total, item) => total + Number(item.monthly_rent ?? 0), 0);
    
    // Update report data for the Generate Performance Report button
    reportData = { properties: items, bookings: requests, metrics: { occupancy } };
    
    root.querySelector('[data-metric="listings"]').textContent = `${activeListings} Active`;
    root.querySelector('[data-metric="inquiries"]').textContent = `${inquiryCount} Total`;
    root.querySelector('[data-metric="occupancy"]').textContent = `${occupancy}%`;
    root.querySelector('[data-metric-note="listings"]').textContent = `${activeListings} / ${items.length} properties active`;
    root.querySelector('[data-metric-note="inquiries"]').textContent = pendingRequests.length ? `${pendingRequests.length} new request${pendingRequests.length === 1 ? '' : 's'}` : 'No new inquiries';
    root.querySelector('[data-metric-note="occupancy"]').textContent = `${occupiedUnits} / ${totalUnits} units occupied`;
    root.querySelector('tbody').innerHTML = requests.slice(0, 5).map((item) => {
      const normalized = (item.status ?? 'Pending').toLowerCase().replace(/\s+/g, '-');
      const badgeClass = statusClass[normalized] ?? 'status-pending';
      const viewHref = normalized === 'approved' ? '#/owner/activeTenant' : '#/owner/inquiries';
      return `
        <tr>
          <td>${escape(item.tenant_name ?? item.user_name ?? 'Tenant')}</td>
          <td>${escape(item.property_title ?? item.property_name ?? 'DormHive Listing')}</td>
          <td>${new Date(item.move_in_date ?? item.created_at ?? Date.now()).toLocaleDateString()}</td>
          <td><span class="status-tag ${badgeClass}">${escape(item.status ?? 'Pending')}</span></td>
          <td><a class="table-action" href="${viewHref}">View</a></td>
        </tr>`;
    }).join('') || '<tr><td colspan="5">No inquiries yet.</td></tr>';

    const pendingListings = items.filter((item) => String(item.status).toLowerCase() === 'pending').length;
    root.querySelector('[data-pending-actions]').innerHTML = `
      <p class="action-section-label">Pending Actions</p>
      <a href="#/owner/inquiries" class="pending-action-row"><span>${pendingRequests.length} New ${pendingRequests.length === 1 ? 'inquiry' : 'inquiries'}</span><strong>View</strong></a>
      <a href="#/owner/inquiries" class="pending-action-row"><span>${pendingRequests.length} Pending ${pendingRequests.length === 1 ? 'booking' : 'bookings'}</span><strong>View</strong></a>
      <a href="#/owner/myListing" class="pending-action-row"><span>${pendingListings} Pending ${pendingListings === 1 ? 'listing' : 'listings'}</span><strong>View</strong></a>`;

    const attentionList = root.querySelector('[data-attention-list]');
    const attentionItems = pendingRequests.slice(0, 3).map((item) => `<a class="attention-item attention-item--warning" href="#/owner/inquiries"><span class="attention-icon">!</span><span><strong>New inquiry from ${escape(item.tenant_name ?? item.user_name ?? 'Tenant')}</strong><small>${escape(item.property_title ?? item.property_name ?? 'DormHive Listing')} · Respond to your tenant</small></span></a>`);
    attentionList.innerHTML = attentionItems.length
      ? attentionItems.join('')
      : `<div class="attention-item attention-item--success"><span class="attention-icon">✓</span><span><strong>All listings are active</strong><small>No pending owner actions right now.</small></span></div>`;
    
    // Initialize Leaflet map with the owner's properties (pixel-accurate markers)
    try {
      await ensureLeafletLoaded();
      await new Promise(resolve => setTimeout(resolve, 300)); // Wait for CSS to load
      
      const mapPanel = root.querySelector('.map-panel');
      if (mapPanel && window.L) {
        const mapContainer = mapPanel.querySelector('#tenant-map');
        if (mapContainer) {
          // Force dimensions
          mapContainer.style.width = '100%';
          mapContainer.style.height = '20rem';
          mapContainer.style.display = 'block';
          
          // Initialize map directly
          const map = window.L.map(mapContainer).setView([14.5995, 120.9842], 12);
          ownerMap = map;
          locationSearchToggle.disabled = false;
          
          // Add tile layer
          window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap contributors'
          }).addTo(map);
          
          // Add markers
          const markers = [];
          let markerCount = 0;
          items.forEach((prop, index) => {
            let lat = Number(prop.latitude ?? prop.lat ?? NaN);
            let lng = Number(prop.longitude ?? prop.lng ?? NaN);
            
            // If coordinates are missing, use default Manila coordinates with small offset
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
              const offset = (markerCount * 0.001);
              lat = 14.5995 + offset;
              lng = 120.9842 + offset;
            }
            
            if (Number.isFinite(lat) && Number.isFinite(lng)) {
              const marker = window.L.marker([lat, lng]).addTo(map);
              marker.bindPopup(buildOwnerPropertyPopup(prop));
              markers.push([lat, lng]);
              markerCount++;
            }
          });

          mapPanel.addEventListener('click', (event) => {
            const detailsButton = event.target.closest('.map-property-details');
            if (detailsButton) {
              const property = items.find((item) => String(item.id) === detailsButton.dataset.propertyId);
              if (!property) return;
              event.preventDefault();
              event.stopPropagation();
              map.closePopup();
              showOwnerPropertyDetails(property).catch(() => {
                showToast({ message: 'Could not open property details.', type: 'error' });
              });
              return;
            }

            const photo = event.target.closest('.map-property-photo');
            if (!photo) return;
            const property = items.find((item) => String(item.id) === photo.dataset.propertyId);
            if (!property) return;
            event.preventDefault();
            event.stopPropagation();
            map.closePopup();
            showOwnerPhotoViewer(ownerPropertyPhotoUrls(property), property.title || property.property_title || 'Property');
          });
          mapPanel.addEventListener('keydown', (event) => {
            if (!['Enter', ' '].includes(event.key) || !event.target.matches('.map-property-photo[role="button"]')) return;
            event.preventDefault();
            event.target.click();
          });
          
          // Fit bounds if we have markers
          if (markers.length > 1) {
            try {
              const featureGroup = window.L.featureGroup(markers.map(coords => window.L.marker(coords)));
              map.fitBounds(featureGroup.getBounds().pad(0.2));
            } catch (e) {
              console.log('Could not fit bounds:', e);
            }
          }
          
          // Trigger map resize
          setTimeout(() => {
            map.invalidateSize();
          }, 100);
        }
      }
    } catch (err) {
      // ignore map init errors but surface a console warning
      // eslint-disable-next-line no-console
      console.warn('Failed to initialize owner map', err);
    }
    await updateListingCountsInSidebar();
  }).catch((error) => {
    root.querySelector('.table-wrap').innerHTML = `<p class="status-message">${escape(error.message)}</p>`;
  });
}