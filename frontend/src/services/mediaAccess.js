export function withMediaAccessToken(value) {
  const raw = String(value ?? '');
  if (!raw) return raw;

  try {
    const apiUrl = new URL(globalThis.window?.DORMHIVE_API_URL ?? 'http://localhost:5000/api/v1');
    const mediaPrefix = `${apiUrl.pathname.replace(/\/$/, '')}/media/`;
    const frontendOrigin = globalThis.window?.location?.origin;
    const candidate = new URL(raw, apiUrl.origin);

    const isUploadAsset = /^\/uploads(?:\/|$)/i.test(candidate.pathname);
    if (isUploadAsset) return '';

    const isApiMediaPath = candidate.pathname.startsWith(mediaPrefix)
      || candidate.pathname.startsWith('/api/v1/media/');
    if (!isApiMediaPath) return raw;

    const needsApiOriginRewrite = frontendOrigin && candidate.origin === frontendOrigin && candidate.origin !== apiUrl.origin;
    const finalUrl = needsApiOriginRewrite ? new URL(candidate.pathname + candidate.search, apiUrl.origin) : candidate;

    const token = globalThis.localStorage?.getItem('dormhive.accessToken');
    if (!token) return raw;

    if (finalUrl.origin !== apiUrl.origin) return raw;
    finalUrl.searchParams.set('access_token', token);
    return finalUrl.toString();
  } catch {
    return raw;
  }
}
