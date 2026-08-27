
  function style() {
    if (document.querySelector('[data-component-style="mapPanel"]')) return;
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = new URL('./style/mapPanel.css', import.meta.url);
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

  export async function initLeafletMap(root, items = []) {
    if (!root) return null;
    const statusEl = root.querySelector('#map-status');
    
    // Load Leaflet CSS and mapPanel CSS FIRST
    if (!document.querySelector('[data-component-style="mapPanel"]')) {
      const l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = new URL('./style/mapPanel.css', import.meta.url);
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
    
    let map;
    try {
      map = L.map(container, { attributionControl: true }).setView([14.5995, 120.9842], 13);
      // eslint-disable-next-line no-console
      console.log('Leaflet map created successfully');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Leaflet map init failed:', err);
      if (statusEl) statusEl.textContent = 'Failed to initialize map. See console.';
      return null;
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

    const mgr = {
      map,
      markers,
      setItems(itemsArray = []) {
        markers.clearLayers();
        const added = [];
        itemsArray.forEach((item) => {
          const lat = Number(item.latitude ?? item.lat ?? NaN);
          const lng = Number(item.longitude ?? item.lng ?? NaN);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
          const marker = L.marker([lat, lng]).addTo(markers);
          const title = escapeHtml(item.title || item.property_title || item.name || 'Listing');
          const content = `<strong>${title}</strong><br>${money(item.monthly_rent ?? 0)}<br>${escapeHtml(item.municipality || '')}<br><button type="button" class="map-property-details" data-property-id="${escapeHtml(item.id ?? '')}">View Details</button>`;
          marker.bindPopup(content);
          marker.on('click', () => {
            const statusEl = root.querySelector('#map-status');
            if (statusEl) statusEl.textContent = `${title} selected`; 
          });
          added.push(marker);
        });
        if (added.length) {
          const group = L.featureGroup(added);
          map.fitBounds(group.getBounds().pad(0.2));
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
          mgr.setItems(items);
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
