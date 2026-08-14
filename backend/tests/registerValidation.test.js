import test from 'node:test';
import assert from 'node:assert/strict';
import { validate } from '../middleware/validate.js';

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
