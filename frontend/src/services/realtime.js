const API_BASE = (window.DORMHIVE_API_URL ?? 'http://localhost:5000/api/v1').replace(/\/$/, '');
export const realtimeClientId = crypto.randomUUID();

export function installRealtimeFetchHeader() {
  if (window.dormHiveRealtimeFetchInstalled) return;
  window.dormHiveRealtimeFetchInstalled = true;
  const originalFetch = window.fetch.bind(window);

  window.fetch = (input, init = {}) => {
    const requestUrl = new URL(input instanceof Request ? input.url : input, window.location.href);
    const method = String(init.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
    if (requestUrl.origin !== new URL(API_BASE).origin || !['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return originalFetch(input, init);
    }

    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    headers.set('X-DormHive-Client', realtimeClientId);
    return originalFetch(input, { ...init, headers });
  };
}

export function connectRealtime(onChange) {
  let stopped = false;
  let controller;

  const connect = async () => {
    const token = localStorage.getItem('dormhive.accessToken');
    if (stopped) return;
    if (!token) {
      window.setTimeout(connect, 3000);
      return;
    }
    controller = new AbortController();
    try {
      const response = await fetch(`${API_BASE}/events`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-DormHive-Client': realtimeClientId
        },
        signal: controller.signal
      });
      if (!response.ok || !response.body) throw new Error('Realtime connection unavailable.');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (!stopped) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split(/\r?\n\r?\n/);
        buffer = events.pop() ?? '';
        for (const event of events) {
          const data = event.split(/\r?\n/).find((line) => line.startsWith('data:'))?.slice(5).trim();
          if (!data) continue;
          try {
            const payload = JSON.parse(data);
            if (payload.sourceId !== realtimeClientId) onChange(payload);
          } catch {
            // Ignore malformed events and keep the stream alive.
          }
        }
      }
    } catch (error) {
      if (error.name !== 'AbortError' && !stopped) console.warn('Realtime connection interrupted.', error);
    } finally {
      controller = undefined;
      if (!stopped && localStorage.getItem('dormhive.accessToken')) window.setTimeout(connect, 3000);
    }
  };

  connect();
  return () => {
    stopped = true;
    controller?.abort();
  };
}