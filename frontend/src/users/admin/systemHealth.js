import { ensureAdminSidebarStyles, renderAdminSidebar } from './sidebarAdmin.js';
import { applyAdminPrivacy } from './privacy.js';

const API = window.DORMHIVE_API_URL ?? 'http://localhost:5000/api/v1';

function css() {
  if (document.querySelector('[data-admin-style="health"]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('./style/systemHealth.css', import.meta.url);
  link.dataset.adminStyle = 'health';
  document.head.append(link);
}

const serviceDefinitions = [
  ['api', 'bi-code-slash', 'API Service'],
  ['database', 'bi-database', 'Database'],
  ['authentication', 'bi-lock', 'Authentication'],
  ['storage', 'bi-cloud-arrow-up', 'File Storage'],
  ['notifications', 'bi-bell', 'Notifications'],
  ['webServer', 'bi-hdd-rack', 'Web Server']
];

const formatDuration = (seconds = 0) => {
  const totalMinutes = Math.floor(seconds / 60);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days) return `${days}d ${hours}h`;
  if (hours) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

const formatBytes = (bytes = 0) => {
  if (!bytes) return '0 B';
  const units = ['B', 'GB', 'TB'];
  const unit = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / (1024 ** unit)).toFixed(unit ? 1 : 0)} ${units[unit]}`;
};

const statusLabel = (status) => status === 'healthy' ? 'Healthy' : status === 'degraded' ? 'Degraded' : 'Down';
const statusClass = (status) => status === 'healthy' ? 'healthy' : status === 'degraded' ? 'degraded' : 'down';
const checkedTime = (timestamp) => timestamp ? new Date(timestamp).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : 'Unavailable';

function serviceValues(key, service, body) {
  if (key === 'database') return [service.status === 'healthy' ? 'Connected' : 'Unavailable', service.responseMs == null ? '—' : `${Math.round(service.responseMs)}ms`];
  if (key === 'storage') return [service.status === 'healthy' ? `${service.usedPercent}% used` : 'Unavailable', service.availableBytes == null ? '—' : `${formatBytes(service.availableBytes)} free`];
  if (key === 'authentication') return [service.status === 'healthy' ? 'Configured' : 'Not configured', 'JWT ready'];
  if (key === 'notifications') return ['Application', 'Internal'];
  if (key === 'webServer') return [formatDuration(service.uptimeSeconds), `${body.system.cpuCount} CPUs`];
  return [formatDuration(service.uptimeSeconds), `${Math.round(body.system.loadAverage || 0)} load`];
}

function renderServiceRows(body) {
  return serviceDefinitions.map(([key, iconName, name]) => {
    const service = body.services[key];
    const [uptime, response] = serviceValues(key, service, body);
    return `<div class="service-row"><div class="service-name"><i class="bi ${iconName}" aria-hidden="true"></i><strong>${name}</strong></div><span class="health-badge ${statusClass(service.status)}"><i></i>${statusLabel(service.status)}</span><span>${uptime}</span><span>${response}</span><time>${checkedTime(body.checkedAt)}</time></div>`;
  }).join('');
}

function renderEventRows(body) {
  const events = [
    [body.services.database.status, 'Database check completed', body.services.database.status === 'healthy' ? `MySQL responded in ${Math.round(body.services.database.responseMs)}ms.` : 'The database connection is unavailable.'],
    [body.services.storage.status, 'File storage check completed', body.services.storage.status === 'healthy' ? `${formatBytes(body.services.storage.availableBytes)} is available.` : 'The upload storage path is unavailable.'],
    [body.services.authentication.status, 'Authentication configuration checked', body.services.authentication.status === 'healthy' ? 'JWT authentication is configured.' : 'JWT_SECRET is not configured.'],
    [body.system.memoryUsedPercent > 85 ? 'degraded' : 'healthy', 'Memory usage checked', `${body.system.memoryUsedPercent}% of system memory is in use.`]
  ];
  return events.map(([status, title, detail]) => `<div class="event-row"><i class="event-dot ${statusClass(status)}" aria-hidden="true"></i><div><strong>${title}</strong><p>${detail}</p></div><time>${checkedTime(body.checkedAt)}</time></div>`).join('');
}

function renderHealthErrorEvent(message) {
  return `<div class="event-row"><i class="event-dot degraded" aria-hidden="true"></i><div><strong>Health check response unavailable</strong><p>${message}</p></div><time>Now</time></div>`;
}

export function renderSystemHealth(root = document.querySelector('#app')) {
  if (!root) throw new Error('System health page requires #app.');
  css();
  ensureAdminSidebarStyles();
  root.innerHTML = `<div class="admin-shell">${renderAdminSidebar('systemHealth')}<div class="admin-main"><main class="health-page"><section class="health-content">
    <header class="health-heading"><div><div class="health-kicker"><i class="bi bi-activity" aria-hidden="true"></i> System health</div><h1>System Health</h1><p>Live status of your platform, services, and infrastructure.</p></div><div class="operational-status"><i class="status-dot"></i><div><strong id="overall-status">All systems operational</strong><small id="last-updated">Last updated: checking now</small></div></div></header>
    <section class="metric-grid" aria-label="System health metrics"><article class="metric-card metric-green"><div class="metric-icon"><i class="bi bi-server"></i></div><div class="metric-copy"><span>API Uptime</span><strong data-health="api-uptime">Checking</strong><small data-health="api-detail">Checking service</small></div><span class="sparkline spark-green"></span></article><article class="metric-card metric-blue"><div class="metric-icon"><i class="bi bi-database"></i></div><div class="metric-copy"><span>Database</span><strong data-health="database-status">Checking</strong><small data-health="database-detail">Checking connection</small></div><span class="sparkline spark-blue"></span></article><article class="metric-card metric-orange"><div class="metric-icon"><i class="bi bi-shield-check"></i></div><div class="metric-copy"><span>Security</span><strong data-health="auth-status">Checking</strong><small data-health="auth-detail">Checking configuration</small></div><span class="sparkline spark-orange"></span></article><article class="metric-card metric-purple"><div class="metric-icon"><i class="bi bi-cloud"></i></div><div class="metric-copy"><span>Memory Usage</span><strong data-health="memory-used">Checking</strong><small data-health="memory-detail">Checking system</small></div><span class="sparkline spark-purple"></span></article></section>
    <section class="health-main-grid"><article class="service-card health-card"><div class="card-heading"><div class="heading-icon"><i class="bi bi-diagram-3"></i></div><div><h2>Service Status</h2><p>Live checks from the DormHive API.</p></div><div class="legend"><span><i class="healthy"></i>Healthy</span><span><i class="degraded"></i>Degraded</span><span><i class="down"></i>Down</span></div></div><div class="service-table"><div class="service-head"><span>Service</span><span>Status</span><span>Uptime</span><span>Response Time</span><span>Last Checked</span></div><div data-health="service-rows"></div></div></article><div class="health-side-column"><article class="health-card infrastructure-card"><div class="card-heading"><div class="heading-icon"><i class="bi bi-hdd-stack"></i></div><div><h2>Infrastructure Overview</h2><p>Resource usage across your infrastructure.</p></div></div><div class="ring-grid"><div class="ring-item"><span class="ring" data-health="cpu-ring"><b data-health="cpu-value">--</b></span><strong>CPU Load</strong><small data-health="cpu-detail">Checking</small></div><div class="ring-item"><span class="ring" data-health="memory-ring"><b data-health="memory-ring-value">--</b></span><strong>Memory Usage</strong><small data-health="memory-ring-detail">Checking</small></div><div class="ring-item"><span class="ring" data-health="storage-ring"><b data-health="storage-ring-value">--</b></span><strong>Disk Usage</strong><small data-health="storage-ring-detail">Checking</small></div></div></article><article class="health-card events-card"><div class="card-heading"><div class="heading-icon"><i class="bi bi-activity"></i></div><div><h2>Recent System Events</h2><p>Latest live checks.</p></div></div><div class="event-list" data-health="event-rows"></div></article></div></section>
  </section></main></div></div>`;

  const overallStatus = root.querySelector('#overall-status');
  const lastUpdated = root.querySelector('#last-updated');
  const apiMetric = root.querySelector('.metric-green');
  const setHealthText = (key, value) => {
    const element = root.querySelector(`[data-health="${key}"]`);
    if (element) element.textContent = value;
  };
  const check = async () => {
    const started = performance.now();
    try {
      const response = await fetch(`${API}/health`);
      const body = await response.json();
      if (!response.ok || !body.services) throw new Error('Unavailable');
      const database = body.services.database;
      const authentication = body.services.authentication;
      const storage = body.services.storage;
      const memoryPercent = body.system.memoryUsedPercent;
      const apiResponse = Math.round(performance.now() - started);
      const overallClass = body.status === 'ok' ? 'healthy' : body.status === 'warning' ? 'degraded' : 'down';
      overallStatus.textContent = body.status === 'ok' ? 'All systems operational' : body.status === 'warning' ? 'Some systems need attention' : 'System degradation detected';
      lastUpdated.textContent = `Last updated: ${checkedTime(body.checkedAt)}`;
      root.querySelector('.operational-status').classList.remove('healthy', 'degraded', 'down');
      root.querySelector('.operational-status').classList.add(overallClass);
      root.querySelector('.status-dot').className = `status-dot ${overallClass}`;
      apiMetric.classList.toggle('metric-unhealthy', body.services.api.status === 'down');
      setHealthText('api-uptime', formatDuration(body.uptimeSeconds));
      setHealthText('api-detail', `Response: ${apiResponse}ms`);
      setHealthText('database-status', statusLabel(database.status));
      setHealthText('database-detail', database.responseMs == null ? 'Connection failed' : `Response time: ${Math.round(database.responseMs)}ms`);
      setHealthText('auth-status', statusLabel(authentication.status));
      setHealthText('auth-detail', authentication.status === 'healthy' ? 'JWT configured' : 'JWT_SECRET missing');
      setHealthText('memory-used', `${memoryPercent}%`);
      setHealthText('memory-detail', `${body.system.processMemoryMb} MB process memory`);
      setHealthText('cpu-value', `${Math.round(body.system.loadAverage || 0)}%`);
      setHealthText('cpu-detail', `${body.system.cpuCount} CPU cores`);
      setHealthText('memory-ring-value', `${memoryPercent}%`);
      setHealthText('memory-ring-detail', `${body.system.processMemoryMb} MB process`);
      setHealthText('storage-ring-value', storage.usedPercent == null ? '--' : `${storage.usedPercent}%`);
      setHealthText('storage-ring-detail', storage.availableBytes == null ? 'Unavailable' : `${formatBytes(storage.availableBytes)} free`);
      root.querySelector('[data-health="cpu-ring"]').style.setProperty('--value', `${Math.min(100, Math.round(body.system.loadAverage || 0))}%`);
      root.querySelector('[data-health="memory-ring"]').style.setProperty('--value', `${memoryPercent}%`);
      root.querySelector('[data-health="storage-ring"]').style.setProperty('--value', `${storage.usedPercent ?? 0}%`);
      root.querySelector('[data-health="service-rows"]').innerHTML = renderServiceRows(body);
      root.querySelector('[data-health="event-rows"]').innerHTML = renderEventRows(body);
    } catch (error) {
      overallStatus.textContent = 'API service unavailable';
      lastUpdated.textContent = 'Last updated: check failed';
      apiMetric.querySelector('small').textContent = error.message === 'Unavailable' ? 'Invalid health response' : 'Check failed';
      apiMetric.classList.add('metric-unhealthy');
      const eventRows = root.querySelector('[data-health="event-rows"]');
      if (eventRows) eventRows.innerHTML = renderHealthErrorEvent(error.message === 'Unavailable' ? 'The health endpoint returned an incomplete response.' : 'Unable to reach the health endpoint.');
    }
    applyAdminPrivacy(root);
  };
  check();
  window.setInterval(check, 30000);
}
