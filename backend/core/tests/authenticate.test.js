import test from 'node:test';
import assert from 'node:assert/strict';
import { authenticate, authenticateMedia, canAuthenticateUser, optionalAuthenticate } from '../middleware/authenticate.js';
import { requireApprovedVerification } from '../middleware/authorize.js';

process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? 'test-secret';

test('pending applicants may authenticate but cannot perform approved-only actions', () => {
  const pendingUser = { status: 'pending', verification_status: 'pending' };
  assert.equal(canAuthenticateUser(pendingUser), true);
  assert.equal(canAuthenticateUser({ status: 'suspended', verification_status: 'approved' }), false);

  let nextCalled = false;
  const response = makeResponse();
  requireApprovedVerification({ user: pendingUser }, response, () => { nextCalled = true; });
  assert.equal(nextCalled, false);
  assert.equal(response.statusCode, 403);
  assert.equal(response.payload.message, 'Your account must be approved before you can perform this action.');
});

test('approved active users pass the approved-account guard', () => {
  let nextCalled = false;
  const response = makeResponse();
  requireApprovedVerification({ user: { status: 'active', verification_status: 'approved' } }, response, () => { nextCalled = true; });
  assert.equal(nextCalled, true);
  assert.equal(response.statusCode, null);
});

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

test('optionalAuthenticate ignores invalid bearer tokens', async () => {
  let nextCalled = false;
  const request = { headers: { authorization: 'Bearer definitely-invalid-token' } };
  const response = makeResponse();

  await optionalAuthenticate(request, response, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(response.statusCode, null);
});

test('authenticate still rejects invalid bearer tokens', async () => {
  const request = { headers: { authorization: 'Bearer definitely-invalid-token' } };
  const response = makeResponse();

  await authenticate(request, response, () => {
    throw new Error('next() should not be called');
  });

  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.payload, { message: 'Invalid or expired access token.' });
});

test('authenticateMedia rejects invalid query-string access tokens', async () => {
  const request = { headers: {}, query: { access_token: 'invalid-token' } };
  const response = {
    statusCode: null,
    ended: false,
    status(code) {
      this.statusCode = code;
      return this;
    },
    end() {
      this.ended = true;
    }
  };

  await authenticateMedia(request, response, () => {
    throw new Error('next() should not be called');
  });

  assert.equal(response.statusCode, 401);
  assert.equal(response.ended, true);
});
