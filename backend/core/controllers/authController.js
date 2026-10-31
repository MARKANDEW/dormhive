import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import {
  create,
  createPasswordResetToken,
  consumePasswordResetToken,
  findByEmail,
  recordLogin,
  revokePasswordResetToken,
  remove,
  setVerificationDocument,
  updatePassword
} from '../models/User.js';
import * as mediaFiles from '../models/Media.js';
import { validateUpload } from '../utils/fileValidation.js';
import { isEmailConfigured, sendPasswordResetEmail } from '../services/email.js';

function tokenFor(user) {
  return jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_ACCESS_SECRET, { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m' });
}

const oauthProviders = {
  google: {
    clientId: () => process.env.GOOGLE_CLIENT_ID,
    clientSecret: () => process.env.GOOGLE_CLIENT_SECRET,
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scope: 'openid email profile'
  },
  facebook: {
    clientId: () => process.env.FACEBOOK_CLIENT_ID,
    clientSecret: () => process.env.FACEBOOK_CLIENT_SECRET,
    authorizeUrl: 'https://www.facebook.com/v20.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v20.0/oauth/access_token',
    scope: 'email,public_profile'
  }
};

function oauthRedirectUri(provider) {
  return `${process.env.API_URL ?? `http://localhost:${process.env.PORT ?? 5000}`}/api/v1/auth/${provider}/callback`;
}

function frontendCallback({ mode, accessToken, error }) {
  const query = new URLSearchParams({ mode }).toString();
  const fragment = accessToken ? `#accessToken=${encodeURIComponent(accessToken)}` : '';
  const errorQuery = error ? `&error=${encodeURIComponent(error)}` : '';
  return `${process.env.CLIENT_URL ?? 'https://dormhive-frontend.vercel.app'}/#/oauth/callback?${query}${errorQuery}${fragment}`;
}

function oauthState(provider, mode, role) {
  return jwt.sign({ provider, mode, role, purpose: 'oauth' }, process.env.JWT_ACCESS_SECRET, { expiresIn: '10m' });
}

function readOAuthState(value) {
  const state = jwt.verify(value, process.env.JWT_ACCESS_SECRET);
  if (state.purpose !== 'oauth' || !oauthProviders[state.provider]) throw new Error('Invalid OAuth state.');
  return state;
}

async function exchangeOAuthCode(provider, code) {
  const config = oauthProviders[provider];
  const redirectUri = oauthRedirectUri(provider);
  const tokenParams = new URLSearchParams({ client_id: config.clientId(), client_secret: config.clientSecret(), code, redirect_uri: redirectUri });
  let tokenResponse;
  if (provider === 'google') {
    tokenParams.set('grant_type', 'authorization_code');
    tokenResponse = await fetch(config.tokenUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: tokenParams });
  } else {
    tokenResponse = await fetch(`${config.tokenUrl}?${tokenParams}`);
  }
  const tokens = await tokenResponse.json();
  if (!tokenResponse.ok || !tokens.access_token) throw new Error(tokens.error_description || tokens.error?.message || 'OAuth token exchange failed.');
  const profileUrl = provider === 'google'
    ? 'https://openidconnect.googleapis.com/v1/userinfo'
    : `https://graph.facebook.com/me?fields=id,name,first_name,last_name,email,picture&access_token=${encodeURIComponent(tokens.access_token)}`;
  const profileResponse = await fetch(profileUrl, { headers: { Authorization: `Bearer ${tokens.access_token}` } });
  const profile = await profileResponse.json();
  if (!profileResponse.ok || !profile.email) throw new Error('The OAuth provider did not return an email address.');
  return profile;
}

export function oauthStart(request, response) {
  const provider = String(request.params.provider ?? '').toLowerCase();
  const config = oauthProviders[provider];
  if (!config) return response.status(404).json({ message: 'Unsupported OAuth provider.' });
  if (!config.clientId() || !config.clientSecret()) {
    return response.redirect(frontendCallback({ mode: request.query.mode === 'register' ? 'register' : 'login', error: `${provider} sign-in is not configured on the server.` }));
  }
  const mode = request.query.mode === 'register' ? 'register' : 'login';
  const role = ['tenant', 'owner'].includes(request.query.role) ? request.query.role : 'tenant';
  const params = new URLSearchParams({ client_id: config.clientId(), redirect_uri: oauthRedirectUri(provider), response_type: 'code', scope: config.scope, state: oauthState(provider, mode, role) });
  return response.redirect(`${config.authorizeUrl}?${params}`);
}

export async function oauthCallback(request, response) {
  const provider = String(request.params.provider ?? '').toLowerCase();
  const mode = 'login';
  try {
    const state = readOAuthState(request.query.state);
    const profile = await exchangeOAuthCode(provider, request.query.code);
    let user = await findByEmail(String(profile.email).toLowerCase());
    if (!user) {
      throw new Error('Create your account using the registration form and upload an ID for verification before signing in.');
    }
    if (user.verification_status === 'pending') throw new Error('Your account is awaiting admin verification. We will email you when it has been reviewed.');
    if (user.verification_status === 'rejected') throw new Error('Your account verification was rejected. Please check your email for details.');
    if (user.status !== 'active') throw new Error('This account is not active.');
    user = await recordLogin(user.id);
    return response.redirect(frontendCallback({ mode: state.mode, accessToken: tokenFor(user) }));
  } catch (error) {
    return response.redirect(frontendCallback({ mode, error: error.message || 'OAuth sign-in failed.' }));
  }
}

export function isValidPhilippinePhoneNumber(value) {
  return normalizePhilippinePhoneNumber(value) !== null;
}

export function normalizePhilippinePhoneNumber(value) {
  if (typeof value !== 'string' || !/^\+?[\d\s().-]+$/.test(value.trim())) return null;
  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('63')) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith('09')) digits = digits.slice(1);
  return /^9\d{9}$/.test(digits) ? `+63${digits}` : null;
}

function isValidPhone(value) {
  return typeof value === 'string' && /^\+?[0-9\s().-]{7,20}$/.test(value.trim());
}

export async function register(request, response, next) {
  try {
    const { first_name, last_name, name, email, password, role = 'tenant', phone } = request.body;
    if (!request.file) return response.status(422).json({ message: 'Upload a clear photo or PDF of a government-issued or other valid ID.' });
    const document = validateUpload(request.file);
    if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(document.mimeType)) {
      return response.status(422).json({ message: 'ID documents must be a JPEG, PNG, WEBP, or PDF file.' });
    }
    const normalizedPhone = typeof phone === 'string' ? phone.trim() : phone;
    if (!['tenant', 'owner'].includes(role)) return response.status(422).json({ message: 'Role must be tenant or owner.' });
    if (!normalizedPhone || !isValidPhilippinePhoneNumber(normalizedPhone)) {
      return response.status(422).json({ message: 'Phone number must be exactly 10 digits.' });
    }
    if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 8 || (normalizedPhone && !isValidPhone(normalizedPhone))) {
      return response.status(422).json({ message: 'Provide a valid email, a valid phone number if supplied, and a password of at least 8 characters.' });
    }
    if (await findByEmail(email.toLowerCase())) return response.status(409).json({ message: 'This email already has an account. Please log in instead.' });
    const computedName = name ?? ([first_name, last_name].filter(Boolean).join(' ').trim() || null);
    const user = await create({
      name: computedName,
      first_name: first_name ?? null,
      last_name: last_name ?? null,
      email: email.toLowerCase(),
      passwordHash: await bcrypt.hash(password, 12),
      phone: normalizedPhone ? String(normalizedPhone).trim() : null,
      role,
      status: 'pending',
      verificationStatus: 'pending'
    });
    try {
      const storedDocument = await mediaFiles.create({
        uploadedBy: user.id,
        filename: document.filename,
        mimeType: document.mimeType,
        buffer: request.file.buffer
      });
      const pendingUser = await setVerificationDocument(user.id, storedDocument.id);
      response.status(201).json({
        user: pendingUser,
        message: 'Your account is submitted for verification. You can sign in after an admin reviews your ID. We will email you with the decision.'
      });
    } catch (error) {
      await remove(user.id);
      throw error;
    }
  } catch (error) { next(error); }
}

export function loginRejection(user, passwordMatches) {
  if (!user || !passwordMatches) return { status: 401, message: 'Invalid email or password.' };
  if (user.status === 'archived') {
    return {
      status: 403,
      message: 'This account has been archived and can’t sign in. Contact DormHive support if you think this is a mistake.'
    };
  }
  if (user.verification_status === 'pending' || user.status === 'pending') {
    return { status: 403, message: 'Your account is awaiting admin verification. We will email you when it has been reviewed.' };
  }
  if (user.verification_status === 'rejected') {
    return { status: 403, message: 'Your account verification was rejected. Please check your email for details or contact DormHive support.' };
  }
  if (user.status === 'suspended') {
    return { status: 403, message: 'Your account has been suspended. Please contact the administrator for assistance.' };
  }
  if (user.status !== 'active') return { status: 401, message: 'Invalid email or password.' };
  return null;
}

export async function login(request, response, next) {
  try {
    let user = await findByEmail(String(request.body.email ?? '').toLowerCase());
    const passwordMatches = user ? await bcrypt.compare(request.body.password ?? '', user.password_hash) : false;
    const rejection = loginRejection(user, passwordMatches);
    if (rejection) return response.status(rejection.status).json({ message: rejection.message });
    user = await recordLogin(user.id);
    delete user.password_hash;
    response.json({ user, accessToken: tokenFor(user) });
  } catch (error) { next(error); }
}

export function logout(_request, response) { response.status(204).end(); }

export function passwordResetEmailStatus(_request, response) {
  response.set('Cache-Control', 'no-store');
  response.json({ available: isEmailConfigured() });
}

export async function requestPasswordResetEmail(request, response, next) {
  try {
    if (!isEmailConfigured()) {
      return response.status(503).json({ message: 'Password recovery is unavailable. Please contact support.' });
    }
    const email = String(request.body.email ?? '').trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) return response.status(422).json({ message: 'Enter a valid email address.' });
    const user = await findByEmail(email);
    if (!user || user.status !== 'active') {
      return response.json({ message: 'If an active account matches that email, a reset link has been sent.' });
    }

    const token = await createPasswordResetToken(user.id);
    const clientUrl = (process.env.CLIENT_URL ?? 'http://localhost:3000').replace(/\/$/, '');
    const resetUrl = `${clientUrl}/#/reset-password?token=${encodeURIComponent(token)}`;
    try {
      const result = await sendPasswordResetEmail({ email: user.email, name: user.name, resetUrl });
      if (!result.sent) throw new Error('SMTP is not configured.');
    } catch (error) {
      await revokePasswordResetToken(token);
      console.error('Unable to send password reset email.', error.message);
      return response.status(503).json({ message: 'Password recovery is unavailable. Please contact support.' });
    }
    response.json({ message: 'If an active account matches that email, a reset link has been sent.' });
  } catch (error) { next(error); }
}

export async function resetPassword(request, response, next) {
  try {
    const token = String(request.body.token ?? '');
    const password = String(request.body.password ?? '');
    if (!token || password.length < 8) return response.status(422).json({ message: 'A valid token and password of at least 8 characters are required.' });
    const userId = await consumePasswordResetToken(token);
    if (!userId) return response.status(400).json({ message: 'This reset link is invalid or expired.' });
    await updatePassword(userId, await bcrypt.hash(password, 12));
    response.json({ message: 'Password updated successfully. You can now sign in.' });
  } catch (error) { next(error); }
}
