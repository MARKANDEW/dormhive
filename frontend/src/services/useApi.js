import { ApiError } from './api.js';

export async function useApi(request, { onSuccess, onError } = {}) {
  try {
    const data = await request();
    onSuccess?.(data);
    return { data, error: null };
  } catch (error) {
    const normalized = error instanceof ApiError ? error : new ApiError(error.message ?? 'Network request failed.');
    onError?.(normalized);
    return { data: null, error: normalized };
  }
}
