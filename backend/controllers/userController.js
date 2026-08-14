import bcrypt from 'bcrypt';
import * as users from '../models/User.js';

export function validatePasswordChange({ currentPassword, newPassword, confirmPassword }) {
  if (!currentPassword || !newPassword || !confirmPassword) {
    return { valid: false, message: 'Please complete all password fields.' };
  }
  if (newPassword.length < 8) {
    return { valid: false, message: 'New password must be at least 8 characters long.' };
  }
  if (newPassword !== confirmPassword) {
    return { valid: false, message: 'New password and confirm password must match.' };
  }
  if (currentPassword === newPassword) {
    return { valid: false, message: 'New password must be different from your current password.' };
  }
  return { valid: true, message: '' };
}

export async function list(request, response, next) {
  try {
    const page = Math.max(1, Number(request.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(request.query.limit) || 20));
    const result = await users.list({ page, limit, search: String(request.query.search ?? '') });
    response.json({ data: result.rows, pagination: { page, limit, total: result.total } });
  } catch (error) { next(error); }
}

export async function get(request, response, next) {
  try {
    if (request.user.id !== Number(request.params.id) && request.user.role !== 'admin') return response.status(403).json({ message: 'Permission denied.' });
    const user = await users.findById(request.params.id);
    return user ? response.json({ data: user }) : response.status(404).json({ message: 'User not found.' });
  } catch (error) { next(error); }
}

function isValidPhone(value) {
  return typeof value === 'string' && /^\+?[0-9\s().-]{7,20}$/.test(value.trim());
}

export async function update(request, response, next) {
  try {
    const isAdmin = request.user.role === 'admin';
    if (request.user.id !== Number(request.params.id) && !isAdmin) return response.status(403).json({ message: 'Permission denied.' });

    const hasPasswordChange = ['currentPassword', 'newPassword', 'confirmPassword'].some((key) => Object.prototype.hasOwnProperty.call(request.body, key));
    if (hasPasswordChange) {
      const passwordCheck = validatePasswordChange(request.body);
      if (!passwordCheck.valid) return response.status(422).json({ message: passwordCheck.message });
      const currentUser = await users.findByIdWithPassword(request.params.id);
      if (!currentUser) return response.status(404).json({ message: 'User not found.' });
      const isCurrentPasswordValid = await bcrypt.compare(String(request.body.currentPassword), currentUser.password_hash);
      if (!isCurrentPasswordValid) return response.status(401).json({ message: 'Current password is incorrect.' });
      const passwordHash = await bcrypt.hash(String(request.body.newPassword), 12);
      await users.updatePassword(request.params.id, passwordHash);
    }

    if (request.body.phone !== undefined && request.body.phone !== null && !isValidPhone(request.body.phone)) {
      return response.status(422).json({ message: 'Provide a valid phone number.' });
    }

    const input = isAdmin
      ? { name: request.body.name, first_name: request.body.first_name, last_name: request.body.last_name, phone: request.body.phone, status: request.body.status, role: request.body.role }
      : { name: request.body.name, first_name: request.body.first_name, last_name: request.body.last_name, phone: request.body.phone };
    const user = await users.update(request.params.id, input);
    return user ? response.json({ data: user }) : response.status(404).json({ message: 'User not found.' });
  } catch (error) { next(error); }
}

export async function updateAvatar(request, response, next) {
  try {
    if (request.user.id !== Number(request.params.id) && request.user.role !== 'admin') {
      return response.status(403).json({ message: 'Permission denied.' });
    }
    if (!request.file) {
      return response.status(422).json({ message: 'Please provide a valid image file.' });
    }
    const avatarUrl = `/uploads/users/${request.file.filename}`;
    const user = await users.update(request.params.id, { avatar_url: avatarUrl });
    return user ? response.json({ data: user }) : response.status(404).json({ message: 'User not found.' });
  } catch (error) { next(error); }
}

export async function remove(request, response, next) {
  try {
    if (request.user.id === Number(request.params.id)) return response.status(422).json({ message: 'You cannot delete your own account.' });
    const removed = await users.remove(request.params.id);
    return removed ? response.status(204).end() : response.status(404).json({ message: 'User not found.' });
  } catch (error) { next(error); }
}
