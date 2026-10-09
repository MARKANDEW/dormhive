import test from 'node:test';
import assert from 'node:assert/strict';
import { authenticate, authenticateMedia, optionalAuthenticate } from '../middleware/authenticate.js';

process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? 'test-secret';

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
