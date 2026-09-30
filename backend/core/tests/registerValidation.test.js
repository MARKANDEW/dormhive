import test from 'node:test';
import assert from 'node:assert/strict';
import { validate } from '../middleware/validate.js';
import { isValidPhilippinePhoneNumber, loginRejection, normalizePhilippinePhoneNumber } from '../controllers/authController.js';

function makeResponse() {
  return {
    statusCode: null,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(value) {
      this.payload = value;
      return this;
    }
  };
}

test('register validation accepts missing phone when required identity fields are present', () => {
  const request = {
    body: {
      first_name: 'Jake',
      last_name: 'Wonder',
      email: 'owner@wonder.com',
      password: 'secret123',
      role: 'tenant'
    }
  };
  const response = makeResponse();
  let nextCalled = false;

  validate(['first_name', 'last_name', 'email', 'password'])(request, response, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(response.statusCode, null);
});

test('Philippine phone validation requires +63 plus exactly 10 digits after the code', () => {
  assert.equal(isValidPhilippinePhoneNumber('+639123456789'), true);
  assert.equal(isValidPhilippinePhoneNumber('9123456789'), true);
  assert.equal(isValidPhilippinePhoneNumber('+63912345678'), false);
  assert.equal(isValidPhilippinePhoneNumber('+6391234567890'), false);
  assert.equal(isValidPhilippinePhoneNumber('+631234567890'), false);
  assert.equal(isValidPhilippinePhoneNumber('+63abc123456'), false);
});

test('Philippine phone numbers normalize to E.164 for SMS verification', () => {
  assert.equal(normalizePhilippinePhoneNumber('9123456789'), '+639123456789');
  assert.equal(normalizePhilippinePhoneNumber('+63 912 345 6789'), '+639123456789');
  assert.equal(normalizePhilippinePhoneNumber('09123456789'), '+639123456789');
  assert.equal(normalizePhilippinePhoneNumber('+63abc9123456789'), null);
});

test('suspended login requires a valid password before returning the suspension message', () => {
  const suspendedUser = { status: 'suspended' };
  assert.deepEqual(loginRejection(suspendedUser, false), { status: 401, message: 'Invalid email or password.' });
  assert.deepEqual(loginRejection(suspendedUser, true), {
    status: 403,
    message: 'Your account has been suspended. Please contact the administrator for assistance.'
  });
});

test('active users continue through login and unknown statuses remain denied', () => {
  assert.equal(loginRejection({ status: 'active' }, true), null);
  assert.deepEqual(loginRejection({ status: 'pending' }, true), { status: 401, message: 'Invalid email or password.' });
});
