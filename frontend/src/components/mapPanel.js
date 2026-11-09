import { withMediaAccessToken } from '../services/mediaAccess.js';

  function style() {
    if (document.querySelector('[data-component-style="mapPanel"]')) return;
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    const stylesheet = new URL('./style/mapPanel.css', import.meta.url);
    stylesheet.searchParams.set('v', 'map-place-icons-2');
    l.href = stylesheet;
    l.dataset.componentStyle = 'mapPanel';
    document.head.append(l);

    // Load Leaflet CSS if not already present
    if (!document.querySelector('link[href*="leaflet.css"]')) {
      const leafletCss = document.createElement('link');
      leafletCss.rel = 'stylesheet';
      leafletCss.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.append(leafletCss);
    }
  }

  const escapeHtml = (value = '') => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const parsePropertyImages = (item = {}) => {
    let list = item.images;
    if (typeof list === 'string') {
      try {
        list = JSON.parse(list);
      } catch {
        list = list ? [list] : [];
      }
    }
    if (!Array.isArray(list)) list = [];
    const normalized = [
      item.image_url,
      item.cover_image,
      ...list,
      ...(Array.isArray(item.gallery) ? item.gallery : [])
    ]
      .filter(Boolean)
      .map((image) => String(image).trim())
      .filter(Boolean);
    return [...new Set(normalized)];
  };

  const money = (value = 0) => `₱${Number(value || 0).toLocaleString('en-PH')}`;

  // Dynamically load Leaflet JS if needed
  function ensureLeaflet() {
    if (window.L) return Promise.resolve();
    return new Promise((resolve, reject) => {
      if (document.querySelector('script[data-leaflet]')) {
        const existing = document.querySelector('script[data-leaflet]');
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', (e) => reject(e));
        return;
      }
      const s = document.createElement('script');
      s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      s.async = true;
      s.dataset.leaflet = '1';
      s.onload = () => resolve();
      s.onerror = (e) => reject(e);
      document.head.append(s);
    });
  }

  export function renderMapPanelShell({ title = 'Map Overview', buttonLabel = 'View Full Map & Heatmap', statusText = 'Loading listings...' } = {}) {
    style();
    return `
      <article class="panel map-panel">
        <div class="panel-title-row">
          <h2>${escapeHtml(title)}</h2>
          <button class="panel-button">${escapeHtml(buttonLabel)}</button>
        </div>
        <div class="map" id="shared-map">
          <div id="tenant-map" class="leaflet-map" style="height:385px;border-radius:10px"></div>
          <div class="key">📍 Active listings</div>
        </div>
        <p id="map-status">${escapeHtml(statusText)}</p>
      </article>`;
  }

  // MapManager stored on the root element to allow multiple maps if needed
  function getMapManager(root) {
    return root.__leafletMapManager;
  }

  // Wait for stylesheet to load so container has proper dimensions
  function waitForCss(href) {
    return new Promise((resolve) => {
      if (document.querySelector(`link[href="${href}"]`)) {
        // If link already exists, wait a short time for it to parse
        setTimeout(resolve, 50);
        return;
      }
      // If we just added it, wait for it to load
      const link = document.querySelector(`link[href="${href}"]`);
      if (link) {
        link.onload = resolve;
        link.onerror = resolve;
        // Also use a timeout as fallback
        setTimeout(resolve, 200);
      } else {
        setTimeout(resolve, 200);
      }
    });
  }

  export async function initLeafletMap(root, items = [], { viewStorageKey = '', nearbyPlaces = false } = {}) {
    if (!root) return null;
    const statusEl = root.querySelector('#map-status');
    
    // Load Leaflet CSS and mapPanel CSS FIRST
    if (!document.querySelector('[data-component-style="mapPanel"]')) {
      const l = document.createElement('link');
      l.rel = 'stylesheet';
      const stylesheet = new URL('./style/mapPanel.css', import.meta.url);
      stylesheet.searchParams.set('v', 'map-place-icons-2');
      l.href = stylesheet;
      l.dataset.componentStyle = 'mapPanel';
      document.head.append(l);
    }
    const leafletCssHref = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    if (!document.querySelector('link[href*="leaflet.css"]')) {
      const leafletCss = document.createElement('link');
      leafletCss.rel = 'stylesheet';
      leafletCss.href = leafletCssHref;
      document.head.append(leafletCss);
    }
    
    // Wait for CSS to load and be parsed
    await waitForCss(leafletCssHref);
    
    try {
      if (statusEl) statusEl.textContent = 'Loading map…';
      await ensureLeaflet();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Leaflet load failed:', err);
      if (statusEl) statusEl.textContent = 'Map library failed to load. Check browser console.';
      return null;
    }

    // Find the map container - search in root or within root
    let container = root.querySelector('#tenant-map');
    if (!container && root.id === 'tenant-map') container = root;
    if (!container) {
      // eslint-disable-next-line no-console
      console.error('Map container #tenant-map not found in root');
      if (statusEl) statusEl.textContent = 'Map container not found.';
      return null;
    }
    
    if (statusEl) statusEl.textContent = 'Initializing map…';
    
    if (getMapManager(root)) {
      // reuse existing map manager
      const mgr = getMapManager(root);
      mgr.setItems(items);
      return mgr;
    }

    const L = window.L;
    if (!L) {
      // eslint-disable-next-line no-console
      console.error('Leaflet (window.L) not available after load');
      if (statusEl) statusEl.textContent = 'Map library not initialized.';
      return null;
    }
    
    // Ensure container has proper dimensions by waiting for layout
    // and explicitly setting display properties if needed
    if (!container.style.display || container.style.display === 'none') {
      container.style.display = 'block';
    }
    if (!container.style.width) container.style.width = '100%';
    if (!container.style.height) container.style.height = '100%';
    
    // Wait for browser to lay out the element
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const rect = container.getBoundingClientRect();
    // eslint-disable-next-line no-console
    console.log('Map container rect:', { width: rect.width, height: rect.height, display: container.style.display });
    
    if (rect.width === 0 || rect.height === 0) {
      // eslint-disable-next-line no-console
      console.error('Map container has zero dimensions');
      if (statusEl) statusEl.textContent = 'Map container has no size.';
      return null;
    }
    
    let savedView = null;
    if (viewStorageKey) {
      try {
        const storedView = JSON.parse(localStorage.getItem(viewStorageKey) || 'null');
        if (
          Number.isFinite(storedView?.latitude)
          && storedView.latitude >= -90
          && storedView.latitude <= 90
          && Number.isFinite(storedView?.longitude)
          && storedView.longitude >= -180
          && storedView.longitude <= 180
          && Number.isFinite(storedView?.zoom)
        ) {
          savedView = storedView;
        }
      } catch (error) {
        console.warn('Unable to restore map view:', error);
      }
    }

    let map;
    try {
      map = L.map(container, { attributionControl: true }).setView(
        savedView ? [savedView.latitude, savedView.longitude] : [14.5995, 120.9842],
        savedView ? savedView.zoom : 13
      );
      map.attributionControl.setPrefix(false);
      // eslint-disable-next-line no-console
      console.log('Leaflet map created successfully');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Leaflet map init failed:', err);
      if (statusEl) statusEl.textContent = 'Failed to initialize map. See console.';
      return null;
    }
    if (viewStorageKey) {
      map.on('moveend', () => {
        const center = map.getCenter();
        try {
          localStorage.setItem(viewStorageKey, JSON.stringify({
            latitude: center.lat,
            longitude: center.lng,
            zoom: map.getZoom()
          }));
        } catch (error) {
          console.warn('Unable to save map view:', error);
        }
      });
    }
    const tile = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    
    // eslint-disable-next-line no-console
    console.log('Tile layer added, URL:', 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png');
    
    // Track tile loading events
    let tileLoadCount = 0;
    let tileErrorCount = 0;
    
    if (tile.on) {
      tile.on('tileload', () => {
        tileLoadCount++;
        // eslint-disable-next-line no-console
        console.log('Tile loaded, total:', tileLoadCount);
      });
      tile.on('tileerror', () => {
        tileErrorCount++;
        if (statusEl) statusEl.textContent = `Tile error (${tileErrorCount}). Retrying...`;
        // eslint-disable-next-line no-console
        console.warn('Tile failed to load, total errors:', tileErrorCount);
      });
      tile.on('load', () => {
        // eslint-disable-next-line no-console
        console.log('All tiles loaded successfully');
        if (statusEl) statusEl.textContent = '';
      });
    }

    const markers = L.layerGroup().addTo(map);
    const searchMarkerLayer = L.layerGroup().addTo(map);
    const nearbyPlaceLayers = new Map();
    const nearbyPlaceRequests = new Map();
    const nearbyPlaceConfig = {
      transport: {
        label: 'Transport',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 16V6.8A2.8 2.8 0 0 1 7.8 4h8.4A2.8 2.8 0 0 1 19 6.8V16"/><path d="M5 11h14M8 20l2-4m6 4-2-4M7.5 8h.01M16.5 8h.01M7 16h10"/></svg>',
        filters: [
          'node["amenity"="bus_station"]',
          'way["amenity"="bus_station"]',
          'relation["amenity"="bus_station"]',
          'node["highway"="bus_stop"]',
          'way["highway"="bus_stop"]',
          'node["railway"~"^(station|halt|tram_stop)$"]',
          'way["railway"~"^(station|halt|tram_stop)$"]',
          'relation["railway"~"^(station|halt|tram_stop)$"]',
          'node["public_transport"="station"]',
          'way["public_transport"="station"]',
          'relation["public_transport"="station"]',
          'node["public_transport"="platform"]',
          'way["public_transport"="platform"]'
        ]
      },
      supermarket: {
        label: 'Supermarket',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 4h2l2.2 11.1a2 2 0 0 0 2 1.6h8.5a2 2 0 0 0 1.9-1.4L21 9H6"/><path d="M9 12h8m-7-3 1 6m5-6-1 6"/><circle cx="10" cy="20" r="1"/><circle cx="18" cy="20" r="1"/></svg>',
        filters: ['node["shop"="supermarket"]', 'way["shop"="supermarket"]', 'relation["shop"="supermarket"]']
      },
      restaurant: {
        label: 'Restaurant',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3v6m-3-6v4a3 3 0 0 0 6 0V3M7 13v8M17 3v18m0-18c2 2 3 4.5 3 7h-3"/></svg>',
        filters: ['node["amenity"="restaurant"]', 'way["amenity"="restaurant"]', 'relation["amenity"="restaurant"]']
      },
      pharmacy: {
        label: 'Pharmacies',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/></svg>',
        filters: [
          'node["amenity"="pharmacy"]',
          'way["amenity"="pharmacy"]',
          'relation["amenity"="pharmacy"]',
          'node["shop"="chemist"]',
          'way["shop"="chemist"]',
          'relation["shop"="chemist"]'
        ]
      },
      hospital: {
        label: 'Hospitals',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 21V5h16v16M2 21h20M9 21v-5h6v5"/><path d="M12 8v5m-2.5-2.5h5"/></svg>',
        filters: ['node["amenity"="hospital"]', 'way["amenity"="hospital"]', 'relation["amenity"="hospital"]']
      }
    };
    const nearbyPlaceControl = nearbyPlaces ? L.control({ position: 'topleft' }) : null;
    if (nearbyPlaceControl) {
      nearbyPlaceControl.onAdd = () => {
        const control = L.DomUtil.create('div', 'map-place-legend leaflet-control');
        control.setAttribute('aria-label', 'Nearby places');
        Object.entries(nearbyPlaceConfig).forEach(([category, config]) => {
          const button = L.DomUtil.create('button', 'map-place-legend__button', control);
          button.type = 'button';
          button.dataset.placeCategory = category;
          button.setAttribute('aria-pressed', 'false');
          button.setAttribute('aria-label', config.label);
          button.dataset.tooltip = config.label;
          button.innerHTML = `<span class="map-place-legend__symbol" aria-hidden="true">${config.icon}</span>`;
          let tooltipTimer = null;
          const showTooltip = () => {
            window.clearTimeout(tooltipTimer);
            tooltipTimer = window.setTimeout(() => button.classList.add('tooltip-visible'), 1000);
          };
          const hideTooltip = () => {
            window.clearTimeout(tooltipTimer);
            button.classList.remove('tooltip-visible');
          };
          button.addEventListener('pointerenter', showTooltip);
          button.addEventListener('pointerleave', hideTooltip);
          button.addEventListener('focus', showTooltip);
          button.addEventListener('blur', hideTooltip);
          L.DomEvent.disableClickPropagation(button);
          L.DomEvent.on(button, 'click', (event) => {
            L.DomEvent.stop(event);
            const isEnabled = button.getAttribute('aria-pressed') === 'true';
            button.setAttribute('aria-pressed', String(!isEnabled));
            button.classList.toggle('is-active', !isEnabled);
            if (isEnabled) {
              nearbyPlaceRequests.get(category)?.abort();
              nearbyPlaceRequests.delete(category);
              nearbyPlaceLayers.get(category)?.clearLayers();
              const status = control.querySelector('.map-place-legend__status');
              if (status && !control.querySelector('.map-place-legend__button[aria-pressed="true"]')) {
                status.hidden = true;
              }
              return;
            }
            loadNearbyPlaces(category);
          });
        });
        const status = L.DomUtil.create('p', 'map-place-legend__status', control);
        status.setAttribute('aria-live', 'polite');
        status.hidden = true;
        return control;
      };
      nearbyPlaceControl.addTo(map);
    }

    function loadNearbyPlaces(category) {
      const config = nearbyPlaceConfig[category];
      if (!config) return;
      const legend = root.querySelector('.map-place-legend');
      const status = legend?.querySelector('.map-place-legend__status');
      const button = legend?.querySelector(`[data-place-category="${category}"]`);
      if (map.getZoom() < 11) {
        nearbyPlaceLayers.get(category)?.clearLayers();
        if (status) {
          status.hidden = false;
          status.textContent = `Zoom in to find nearby ${config.label.toLowerCase()}.`;
        }
        return;
      }

      const bounds = map.getBounds();
      const bbox = [
        bounds.getSouth().toFixed(5),
        bounds.getWest().toFixed(5),
        bounds.getNorth().toFixed(5),
        bounds.getEast().toFixed(5)
      ].join(',');
      const query = `[out:json][timeout:25];(${config.filters.map((filter) => `${filter}(${bbox});`).join('')});out center tags;`;
      nearbyPlaceRequests.get(category)?.abort();
      const controller = new AbortController();
      nearbyPlaceRequests.set(category, controller);
      nearbyPlaceLayers.get(category)?.clearLayers();
      const requestTimeout = window.setTimeout(() => controller.abort(), 30000);
      if (status) {
        status.hidden = false;
        status.textContent = `Finding ${config.label.toLowerCase()}…`;
      }

      fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal
      }).then((response) => {
        if (!response.ok) throw new Error(`Nearby places request failed (${response.status}).`);
        return response.json();
      }).then((data) => {
        if (nearbyPlaceRequests.get(category) !== controller) return;
        let layer = nearbyPlaceLayers.get(category);
        if (!layer) {
          layer = L.layerGroup().addTo(map);
          nearbyPlaceLayers.set(category, layer);
        }
        layer.clearLayers();
        const places = Array.isArray(data.elements) ? data.elements : [];
        places.forEach((place) => {
          const latitude = Number(place.lat ?? place.center?.lat);
          const longitude = Number(place.lon ?? place.center?.lon);
          if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
          const placeName = place.tags?.name || `Unnamed ${config.label.toLowerCase()}`;
          const name = escapeHtml(placeName);
          const marker = L.marker([latitude, longitude], {
            icon: L.divIcon({
              className: 'map-place-marker',
              html: config.icon,
              iconSize: [30, 30],
              iconAnchor: [15, 15]
            }),
            title: placeName,
            alt: `${config.label}: ${placeName}`
          });
          marker.bindPopup(`<strong>${name}</strong><br>${config.label}`);
          marker.addTo(layer);
        });
        if (status && button?.getAttribute('aria-pressed') === 'true') {
          status.hidden = false;
          status.textContent = places.length
            ? `Showing ${places.length} ${config.label.toLowerCase()}.`
            : `No named ${config.label.toLowerCase()} found in this map area.`;
        }
      }).catch((error) => {
        if (nearbyPlaceRequests.get(category) !== controller) return;
        console.warn(`Unable to load nearby ${config.label.toLowerCase()}:`, error);
        if (status && button?.getAttribute('aria-pressed') === 'true') {
          status.hidden = false;
          status.textContent = `Could not load ${config.label.toLowerCase()}. Please try again.`;
        }
      }).finally(() => {
        window.clearTimeout(requestTimeout);
        if (nearbyPlaceRequests.get(category) === controller) nearbyPlaceRequests.delete(category);
      });
    }

    let nearbyPlacesRefreshTimer = null;
    if (nearbyPlaces) {
      map.on('moveend', () => {
        window.clearTimeout(nearbyPlacesRefreshTimer);
        nearbyPlacesRefreshTimer = window.setTimeout(() => {
          root.querySelectorAll('.map-place-legend__button[aria-pressed="true"]').forEach((button) => {
            loadNearbyPlaces(button.dataset.placeCategory);
          });
        }, 500);
      });
    }
    let searchLocation = null;
    let searchRadiusLayer = null;
    let currentItems = [];
    let itemsUpdated = false;
    let hasFitInitialItems = Boolean(savedView);
    const distanceInKm = (first, second) => {
      const radians = (value) => value * Math.PI / 180;
      const latitudeDelta = radians(second.latitude - first.latitude);
      const longitudeDelta = radians(second.longitude - first.longitude);
      const latitude = radians(first.latitude);
      const otherLatitude = radians(second.latitude);
      const arc = Math.sin(latitudeDelta / 2) ** 2
        + Math.sin(longitudeDelta / 2) ** 2 * Math.cos(latitude) * Math.cos(otherLatitude);
      return 6371 * 2 * Math.atan2(Math.sqrt(arc), Math.sqrt(1 - arc));
    };

    const mgr = {
      map,
      markers,
      setSearchLocation({ latitude, longitude, label = 'Searched location', zoom, showMarker = true, radiusInKm = 1 } = {}) {
        searchLocation = { latitude, longitude, radiusInKm };
        map.closePopup();
        searchMarkerLayer.clearLayers();
        searchRadiusLayer = L.circle([latitude, longitude], {
          radius: radiusInKm * 1000,
          color: '#2d7dc0',
          weight: 2,
          fillColor: '#58a9e8',
          fillOpacity: 0.12
        }).addTo(searchMarkerLayer);
        if (showMarker) {
          const marker = L.marker([latitude, longitude], {
            icon: L.divIcon({
              className: 'search-location-marker',
              html: '<span></span>',
              iconSize: [28, 28],
              iconAnchor: [14, 14]
            })
          }).addTo(searchMarkerLayer);
          const popupContent = `<div class="tenant-search-popup"><span class="tenant-search-popup__label">Searched area</span><strong class="tenant-search-popup__place">${escapeHtml(label)}</strong></div>`;
          marker.bindPopup(popupContent, {
            minWidth: 240,
            maxWidth: 280,
            className: 'tenant-search-location-popup'
          }).openPopup();
        }
        this.setItems(currentItems);
        if (Number.isFinite(zoom)) map.setView([latitude, longitude], zoom);
        else map.fitBounds(searchRadiusLayer.getBounds(), { padding: [40, 40], maxZoom: 14 });
      },
      clearSearchLocation() {
        searchLocation = null;
        searchRadiusLayer = null;
        map.closePopup();
        searchMarkerLayer.clearLayers();
        this.setItems(currentItems);
      },
      countNearbyItems(radiusInKm = 1) {
        if (!searchLocation) return 0;
        return currentItems.filter((item) => {
          const latitude = Number(item.latitude ?? item.lat ?? NaN);
          const longitude = Number(item.longitude ?? item.lng ?? NaN);
          return Number.isFinite(latitude)
            && Number.isFinite(longitude)
            && distanceInKm(searchLocation, { latitude, longitude }) <= radiusInKm;
        }).length;
      },
      setItems(itemsArray = []) {
        itemsUpdated = true;
        currentItems = itemsArray;
        markers.clearLayers();
        const added = [];
        itemsArray.forEach((item) => {
          const lat = Number(item.latitude ?? item.lat ?? NaN);
          const lng = Number(item.longitude ?? item.lng ?? NaN);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
          const marker = L.marker([lat, lng]).addTo(markers);
          const title = escapeHtml(item.title || item.property_title || item.name || 'Listing');
          const nameText = item.title || item.property_title || item.name || 'Listing';
          const locationText = [item.barangay, item.city, item.municipality, item.province].filter(Boolean).join(', ') || 'Metro Manila';
          const galleryImages = parsePropertyImages(item);
          const roomImage = galleryImages[0] || item.image_url || item.cover_image || item.thumbnail || '';
          const detailImage = roomImage ? withMediaAccessToken(String(roomImage)) : 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500"><rect width="800" height="500" fill="#edf4f1"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#48676a" font-family="Arial,sans-serif" font-size="28">No image</text></svg>');
          const totalPhotos = Math.max(galleryImages.length, 1);
          const popupContent = `
            <div class="map-property-popup">
              <div class="map-property-card">
                <div class="map-property-image">
                  <img class="map-property-photo" data-property-id="${escapeHtml(item.id ?? '')}" src="${detailImage}" alt="${escapeHtml(nameText)}" />
                  <span class="map-property-image-badge">1/${totalPhotos}</span>
                </div>
                <div class="map-property-body">
                  <h3>${title}</h3>
                  <div class="map-property-location"><span>📍</span> ${escapeHtml(locationText)}</div>
                  <div class="map-property-price">${money(item.monthly_rent ?? 0)} <span>/ month</span></div>
                  <div class="map-property-actions">
                    <button type="button" class="map-property-details" data-property-id="${escapeHtml(item.id ?? '')}">View Details</button>
                    <button type="button" class="map-property-directions" data-property-id="${escapeHtml(item.id ?? '')}">Get Directions</button>
                  </div>
                </div>
              </div>
            </div>
          `;
          marker.bindPopup(popupContent);
          marker.on('click', () => {
            const statusEl = root.querySelector('#map-status');
            if (statusEl) statusEl.textContent = `${title} selected`; 
          });
          added.push(marker);
        });
        if (added.length && !hasFitInitialItems) {
          const group = L.featureGroup(added);
          map.fitBounds(group.getBounds().pad(0.2));
          hasFitInitialItems = true;
        }
      }
    };

    root.__leafletMapManager = mgr;
    // Ensure Leaflet recalculates layout once the map is ready,
    // then set items. Use both whenReady and a small timeout to
    // handle various rendering timing cases across browsers.
    const onReady = () => {
      setTimeout(() => {
        try {
          // eslint-disable-next-line no-console
          console.log('Calling invalidateSize to recalculate map layout');
          map.invalidateSize(false);
          // eslint-disable-next-line no-console
          console.log('Map size invalidated, setting items...');
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn('Failed to invalidate map size:', e);
        }
        try {
          mgr.setItems(itemsUpdated ? currentItems : items);
          // eslint-disable-next-line no-console
          console.log('Map items set, count:', items.length);
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn('Failed to set map items:', e);
        }
        if (statusEl) statusEl.textContent = '';
      }, 250);
    };
    
    try {
      if (map.whenReady) {
        // eslint-disable-next-line no-console
        console.log('Map has whenReady, attaching handler');
        map.whenReady(onReady);
      } else {
        // eslint-disable-next-line no-console
        console.log('Map does not have whenReady, using setTimeout');
        setTimeout(onReady, 400);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('whenReady error, using fallback:', e);
      setTimeout(onReady, 400);
    }

    return mgr;
  }

  export function updateLeafletMarkers(root, items = []) {
    const mgr = getMapManager(root);
    if (!mgr) return initLeafletMap(root, items);
    mgr.setItems(items);
    return mgr;
  }
