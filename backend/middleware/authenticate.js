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

export async function optionalAuthenticate(request, response, next) {
  if (!request.headers.authorization) return next();
  const [scheme, token] = String(request.headers.authorization).split(' ');
  if (scheme !== 'Bearer' || !token) return next();

  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    const user = await findById(payload.sub);
    if (!user || user.status !== 'active') return next();
    request.user = user;
    return next();
  } catch {
    return next();
  }
}
