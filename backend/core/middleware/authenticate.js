import jwt from 'jsonwebtoken';
import { findById } from '../models/User.js';

export function canAuthenticateUser(user) {
  return (user?.status === 'active' && user?.verification_status === 'approved')
    || (user?.status === 'pending' && user?.verification_status === 'pending');
}

export async function authenticate(request, response, next) {
  const [scheme, token] = (request.headers.authorization ?? '').split(' ');
  if (scheme !== 'Bearer' || !token) return response.status(401).json({ message: 'Authentication is required.' });
  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    const user = await findById(payload.sub);
    if (!canAuthenticateUser(user)) return response.status(401).json({ message: 'Your session is no longer valid.' });
    request.user = user;
    return next();
  } catch {
    return response.status(401).json({ message: 'Invalid or expired access token.' });
  }
}

export async function authenticateMedia(request, response, next) {
  const authorization = request.headers.authorization ?? '';
  const [scheme, headerToken] = authorization.split(' ');
  const token = scheme === 'Bearer' && headerToken
    ? headerToken
    : String(request.query.access_token ?? '');
  if (!token) return response.status(401).end();
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
  } catch {
    return response.status(401).end();
  }
  try {
    const user = await findById(payload.sub);
    if (!canAuthenticateUser(user)) return response.status(401).end();
    request.user = user;
    return next();
  } catch (error) {
    return next(error);
  }
}

export async function optionalAuthenticate(request, response, next) {
  if (!request.headers.authorization) return next();
  const [scheme, token] = String(request.headers.authorization).split(' ');
  if (scheme !== 'Bearer' || !token) return next();

  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    const user = await findById(payload.sub);
    if (!canAuthenticateUser(user)) return next();
    request.user = user;
    return next();
  } catch {
    return next();
  }
}
