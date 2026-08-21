import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePasswordChange } from '../controllers/userController.js';

test('password update validation rejects mismatched or short passwords', () => {
  const result = validatePasswordChange({
    currentPassword: 'Current123!',
    newPassword: 'short',
    confirmPassword: 'short'
  });

  assert.equal(result.valid, false);
  assert.match(result.message, /at least 8 characters/i);

  const mismatch = validatePasswordChange({
    currentPassword: 'Current123!',
    newPassword: 'NewPass123!',
    confirmPassword: 'Different123!'
  });

  assert.equal(mismatch.valid, false);
  assert.match(mismatch.message, /match/i);
});

test('password update validation accepts a valid change request', () => {
  const result = validatePasswordChange({
    currentPassword: 'Current123!',
    newPassword: 'NewPass123!',
    confirmPassword: 'NewPass123!'
  });

  assert.equal(result.valid, true);
  assert.equal(result.message, '');
});
