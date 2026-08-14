import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { create, findByEmail } from '../models/User.js';

function tokenFor(user) {
  return jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_ACCESS_SECRET, { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m' });
}

function isValidPhone(value) {
  return typeof value === 'string' && /^\+?[0-9\s().-]{7,20}$/.test(value.trim());
}

export async function register(request, response, next) {
  try {
    const { first_name, last_name, name, email, password, role = 'tenant', phone } = request.body;
    const normalizedPhone = typeof phone === 'string' ? phone.trim() : phone;
    if (!['tenant', 'owner'].includes(role)) return response.status(422).json({ message: 'Role must be tenant or owner.' });
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
