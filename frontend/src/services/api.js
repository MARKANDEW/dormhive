const API_BASE_URL = (window.DORMHIVE_API_URL ?? 'http://localhost:5000/api/v1').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(message, { status = 0, data = null } = {}) { super(message); this.name = 'ApiError'; this.status = status; this.data = data; }
}

export async function readApiResponse(response) {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
}

export function getApiErrorMessage(payload, fallback = 'Something went wrong. Please try again.') {
  return payload && typeof payload === 'object' && typeof payload.message === 'string' && payload.message.trim()
    ? payload.message
    : fallback;
}

function readToken() { return localStorage.getItem('dormhive.accessToken'); }
function setSession({ accessToken, user }) {
  if (accessToken) localStorage.setItem('dormhive.accessToken', accessToken);
  if (user) {
    // Ensure legacy `name` is present for UI code that expects it
    try {
      const u = { ...user };
      if (!u.name) {
        const fn = u.first_name ?? u.firstName ?? '';
        const ln = u.last_name ?? u.lastName ?? '';
        u.name = [fn, ln].filter(Boolean).join(' ').trim() || u.name || '';
      }
      localStorage.setItem('dormhive.user', JSON.stringify(u));
    } catch (e) {
      localStorage.setItem('dormhive.user', JSON.stringify(user));
    }
  }
}
function clearSession() { localStorage.removeItem('dormhive.accessToken'); localStorage.removeItem('dormhive.user'); }

export function createApiClient(baseUrl = API_BASE_URL) {
  async function request(path, { method = 'GET', body, query, auth = true, headers = {}, signal } = {}) {
    const url = new URL(`${baseUrl}${path}`);
    Object.entries(query ?? {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
    });
    const token = readToken();
    const response = await fetch(url, {
      method, signal,
      headers: { Accept: 'application/json', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(auth && token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const payload = await readApiResponse(response);
    if (!response.ok) {
      if (response.status === 401) clearSession();
      throw new ApiError(getApiErrorMessage(payload, `Request failed (${response.status}).`), { status: response.status, data: payload });
    }
    return payload;
  }

  const resources = (path) => ({
    list: (filters = {}, options = {}) => request(path, { query: filters, ...options }),
    get: (id, options = {}) => request(`${path}/${encodeURIComponent(id)}`, options),
    create: (payload, options = {}) => request(path, { method: 'POST', body: payload, ...options }),
    update: (id, payload, options = {}) => request(`${path}/${encodeURIComponent(id)}`, { method: 'PATCH', body: payload, ...options }),
    remove: (id, options = {}) => request(`${path}/${encodeURIComponent(id)}`, { method: 'DELETE', ...options })
  });

  return {
    request,
    session: { get token() { return readToken(); }, set: setSession, clear: clearSession },
    health: (options = {}) => request('/health', { auth: false, ...options }),
    auth: {
      async register(payload, options = {}) { const result = await request('/auth/register', { method: 'POST', body: payload, auth: false, ...options }); setSession(result); return result; },
      async login(payload, options = {}) { const result = await request('/auth/login', { method: 'POST', body: payload, auth: false, ...options }); setSession(result); return result; },
      async logout(options = {}) { try { return await request('/auth/logout', { method: 'POST', auth: false, ...options }); } finally { clearSession(); } }
    },
    listings: resources('/properties'),
    bookings: {
      list: (options = {}) => request('/bookings', options),
      get: (id, options = {}) => request(`/bookings/${encodeURIComponent(id)}`, options),
      create: (payload, options = {}) => request('/bookings', { method: 'POST', body: payload, ...options }),
      updateStatus: (id, status, options = {}) => request(`/bookings/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: { status }, ...options }),
      cancel: (id, options = {}) => request(`/bookings/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: { status: 'cancelled' }, ...options })
    },
    users: resources('/users'),
    profile: {
      get: (id, options = {}) => request(`/users/${encodeURIComponent(id)}`, options),
      update: (id, payload, options = {}) => request(`/users/${encodeURIComponent(id)}`, { method: 'PATCH', body: payload, ...options })
    },
    messages: {
      listConversations: (options = {}) => request('/messages/conversations', options),
      getConversation: (id, options = {}) => request(`/messages/conversations/${encodeURIComponent(id)}`, options),
      createConversation: (payload, options = {}) => request('/messages/conversations', { method: 'POST', body: payload, ...options }),
      send: (payload, options = {}) => request('/messages', { method: 'POST', body: payload, ...options }),
      update: (id, payload, options = {}) => request(`/messages/${encodeURIComponent(id)}`, { method: 'PATCH', body: payload, ...options }),
      remove: (id, options = {}) => request(`/messages/${encodeURIComponent(id)}`, { method: 'DELETE', ...options })
    },
    notifications: {
      list: (filters = {}, options = {}) => request('/notifications', { query: filters, ...options }),
      update: (id, _payload = {}, options = {}) => request(`/notifications/${encodeURIComponent(id)}`, { method: 'PATCH', ...options })
    },
    analytics: {
      async overview(options = {}) {
        const [users, listings, bookings] = await Promise.all([request('/users', { query: { limit: 100 }, ...options }), request('/properties', { query: { limit: 100 }, ...options }), request('/bookings', options)]);
        return { users, listings, bookings };
      },
      users: (filters = {}, options = {}) => request('/analytics/users', { query: filters, ...options }),
      properties: (filters = {}, options = {}) => request('/analytics/properties', { query: filters, ...options }),
      bookings: (filters = {}, options = {}) => request('/analytics/bookings', { query: filters, ...options })
    }
  };
}

export const api = createApiClient();
export { API_BASE_URL, clearSession, readToken, setSession };
export default api;
