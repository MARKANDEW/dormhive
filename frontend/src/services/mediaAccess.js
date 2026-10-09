export function withMediaAccessToken(value) {
  const raw = String(value ?? '');
  if (!raw) return raw;

  try {
    const apiUrl = new URL(globalThis.window?.DORMHIVE_API_URL ?? 'http://localhost:5000/api/v1');
    const mediaUrl = new URL(raw, apiUrl.origin);
    if (mediaUrl.origin === apiUrl.origin && /^\/uploads(?:\/|$)/i.test(mediaUrl.pathname)) return '';

    const token = globalThis.localStorage?.getItem('dormhive.accessToken');
    if (!token) return raw;
    const mediaPrefix = `${apiUrl.pathname.replace(/\/$/, '')}/media/`;
    if (mediaUrl.origin !== apiUrl.origin || !mediaUrl.pathname.startsWith(mediaPrefix)) return raw;
    mediaUrl.searchParams.set('access_token', token);
    return mediaUrl.toString();
  } catch {
    return raw;
  }
}
