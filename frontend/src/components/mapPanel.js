
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

  export async function initLeafletMap(root, items = []) {
    await ensureLeaflet();
    if (!root) return null;
    const container = root.querySelector('#tenant-map');
    if (!container) return null;
    if (getMapManager(root)) {
      // reuse existing map manager
      const mgr = getMapManager(root);
      mgr.setItems(items);
      return mgr;
    }

    const L = window.L;
    const map = L.map(container).setView([14.5995, 120.9842], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

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
          const content = `<strong>${title}</strong><br>${money(item.monthly_rent ?? 0)}<br>${escapeHtml(item.municipality || '')}`;
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
    mgr.setItems(items);
    return mgr;
  }

  export function updateLeafletMarkers(root, items = []) {
    const mgr = getMapManager(root);
    if (!mgr) return initLeafletMap(root, items);
    mgr.setItems(items);
    return mgr;
  }
