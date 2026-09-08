import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { create, findByEmail } from '../models/User.js';

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
      const firstName = profile.given_name ?? profile.first_name ?? '';
      const lastName = profile.family_name ?? profile.last_name ?? '';
      user = await create({ name: profile.name ?? `${firstName} ${lastName}`.trim(), first_name: firstName, last_name: lastName, email: String(profile.email).toLowerCase(), passwordHash: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12), phone: null, role: state.role });
    }
    if (user.status !== 'active') throw new Error('This account is not active.');
    return response.redirect(frontendCallback({ mode: state.mode, accessToken: tokenFor(user) }));
  } catch (error) {
    return response.redirect(frontendCallback({ mode, error: error.message || 'OAuth sign-in failed.' }));
  }
}

export function isValidPhilippinePhoneNumber(value) {
  if (typeof value !== 'string') return false;
  const trimValue = value.trim();
  const digits = trimValue.replace(/\D/g, '');
  const localNumber = digits.startsWith('63') ? digits.slice(2) : digits;
  return /^9\d{9}$/.test(localNumber) && localNumber.length === 10;
}

function isValidPhone(value) {
  return typeof value === 'string' && /^\+?[0-9\s().-]{7,20}$/.test(value.trim());
}

export async function register(request, response, next) {
  try {
    const { first_name, last_name, name, email, password, role = 'tenant', phone } = request.body;
    const normalizedPhone = typeof phone === 'string' ? phone.trim() : phone;
    if (!['tenant', 'owner'].includes(role)) return response.status(422).json({ message: 'Role must be tenant or owner.' });
    if (!normalizedPhone || !isValidPhilippinePhoneNumber(normalizedPhone)) {
      return response.status(422).json({ message: 'Phone number must be exactly 10 digits.' });
    }
    if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 8 || (normalizedPhone && !isValidPhone(normalizedPhone))) {
      return response.status(422).json({ message: 'Provide a valid email, a valid phone number if supplied, and a password of at least 8 characters.' });
    }
    if (await findByEmail(email.toLowerCase())) return response.status(409).json({ message: 'Email is already registered.' });
    const computedName = name ?? ([first_name, last_name].filter(Boolean).join(' ').trim() || null);
    const user = await create({
      name: computedName,
      first_name: first_name ?? null,
      last_name: last_name ?? null,
      email: email.toLowerCase(),
      passwordHash: await bcrypt.hash(password, 12),
      phone: normalizedPhone ? String(normalizedPhone).trim() : null,
      role
    });
    response.status(201).json({ user, accessToken: tokenFor(user) });
  } catch (error) { next(error); }
}

export async function login(request, response, next) {
  try {
    const user = await findByEmail(String(request.body.email ?? '').toLowerCase());
    if (!user || !(await bcrypt.compare(request.body.password ?? '', user.password_hash)) || user.status !== 'active') return response.status(401).json({ message: 'Invalid email or password.' });
    delete user.password_hash;
    response.json({ user, accessToken: tokenFor(user) });
  } catch (error) { next(error); }
}

export function logout(_request, response) { response.status(204).end(); }
