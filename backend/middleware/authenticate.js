import jwt from 'jsonwebtoken';
import { findById } from '../models/User.js';

export async function authenticate(request, response, next) {
  const [scheme, token] = (request.headers.authorization ?? '').split(' ');
  if (scheme !== 'Bearer' || !token) return response.status(401).json({ message: 'Authentication is required.' });
  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    const user = await findById(payload.sub);
    if (!user || user.status !== 'active') return response.status(401).json({ message: 'Your session is no longer valid.' });
    request.user = user;
    return next();
  } catch {
    return response.status(401).json({ message: 'Invalid or expired access token.' });
  }
}

export function optionalAuthenticate(request, response, next) {
  return request.headers.authorization ? authenticate(request, response, next) : next();
}
