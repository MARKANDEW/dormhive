import * as mediaFiles from '../models/Media.js';

export async function get(request, response, next) {
  try {
    if (!/^\d+$/.test(String(request.params.id))) return response.status(404).end();
    const file = await mediaFiles.findAuthorized(request.params.id, request.user);
    if (!file) return response.status(404).end();

    const inline = file.mime_type.startsWith('image/');
    const encodedFilename = encodeURIComponent(file.original_filename.replace(/[\r\n"\\]/g, '_'));
    const asciiFilename = file.original_filename.replace(/[^\x20-\x7e]|["\\;]/g, '_');
    response.set({
      'Content-Type': file.mime_type,
      'Content-Length': String(file.file_size),
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${asciiFilename}"; filename*=UTF-8''${encodedFilename}`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store'
    });
    response.end(file.file_data);
  } catch (error) { next(error); }
}
