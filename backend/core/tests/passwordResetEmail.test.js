import test from 'node:test';
import assert from 'node:assert/strict';
import { passwordResetEmailStatus } from '../controllers/authController.js';
import { isEmailConfigured, sendPasswordResetEmail } from '../services/email.js';

function withSmtpEnvironment(values, callback) {
  const original = Object.fromEntries(['SMTP_USER', 'SMTP_PASSWORD'].map((key) => [key, process.env[key]]));
  for (const key of Object.keys(original)) {
    if (values[key] === undefined) delete process.env[key];
    else process.env[key] = values[key];
  }
  try {
    callback();
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test('password reset email status is unavailable without Gmail credentials', () => {
  withSmtpEnvironment({}, () => {
    let payload;
    let cacheControl;
    passwordResetEmailStatus({}, {
      set(name, value) { cacheControl = [name, value]; return this; },
      json(value) { payload = value; }
    });
    assert.deepEqual(payload, { available: false });
    assert.deepEqual(cacheControl, ['Cache-Control', 'no-store']);
    assert.equal(isEmailConfigured(), false);
  });
});

test('reset email sender does not claim delivery when Gmail credentials are missing', async () => {
  const original = Object.fromEntries(['SMTP_USER', 'SMTP_PASSWORD'].map((key) => [key, process.env[key]]));
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASSWORD;
  try {
    const result = await sendPasswordResetEmail({ email: 'user@example.com', name: 'User', resetUrl: 'https://example.com/reset' });
    assert.deepEqual(result, { sent: false, reason: 'not_configured' });
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test('password reset email status is available when Gmail credentials are present', () => {
  withSmtpEnvironment({ SMTP_USER: 'user@example.com', SMTP_PASSWORD: 'app-password' }, () => {
    assert.equal(isEmailConfigured(), true);
  });
});
