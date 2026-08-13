export function notFound(_request, response) {
  response.status(404).json({ message: 'Route not found.' });
}

export function errorHandler(error, _request, response, _next) {
  console.error(error);
  if (error.code === 'ER_DUP_ENTRY') {
    return response.status(409).json({ message: 'A record with those details already exists.' });
  }
  const expose = error.expose || process.env.NODE_ENV === 'development';
  const payload = { message: expose ? error.message : 'An unexpected server error occurred.' };
  if (process.env.NODE_ENV === 'development' && error.stack) {
    payload.stack = error.stack;
  }
  return response.status(error.statusCode ?? 500).json(payload);
}
