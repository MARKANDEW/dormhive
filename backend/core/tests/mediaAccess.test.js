import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = {
  DORMHIVE_API_URL: 'https://api.example.test/api/v1',
  location: { origin: 'http://localhost:3000' }
};
globalThis.localStorage = {
  getItem(key) { return key === 'dormhive.accessToken' ? 'test-access-token' : null; }
};

const { withMediaAccessToken } = await import('../../../frontend/src/services/mediaAccess.js');
const { canAccessPrivateMedia, canAccessVerificationDocument } = await import('../models/Media.js');

test('verification documents are accessible only to admins', () => {
  const document = { id: 42, verification_document_id: 42 };
  assert.equal(canAccessVerificationDocument(document, { id: 7, role: 'tenant' }), false);
  assert.equal(canAccessVerificationDocument(document, { id: 42, role: 'owner' }), false);
  assert.equal(canAccessVerificationDocument(document, { id: 99, role: 'admin' }), true);
  assert.equal(canAccessVerificationDocument({ id: 43, verification_document_id: null }, { id: 7, role: 'tenant' }), true);
});

test('private property documents are accessible only to admins', () => {
  const proof = { id: 73, is_private: 1 };
  assert.equal(canAccessPrivateMedia(proof, { id: 42, role: 'owner' }), false);
  assert.equal(canAccessPrivateMedia(proof, { id: 84, role: 'tenant' }), false);
  assert.equal(canAccessPrivateMedia(proof, { id: 7, role: 'admin' }), true);
  assert.equal(canAccessPrivateMedia({ id: 74, is_private: 0 }, { id: 42, role: 'owner' }), true);
});

test('adds access tokens only to same-origin database media URLs', () => {
  assert.equal(
    withMediaAccessToken('/api/v1/media/42'),
    'https://api.example.test/api/v1/media/42?access_token=test-access-token'
  );
  assert.equal(
    withMediaAccessToken('http://localhost:3000/api/v1/media/42'),
    'https://api.example.test/api/v1/media/42?access_token=test-access-token'
  );
  assert.equal(
    withMediaAccessToken('https://elsewhere.example/api/v1/media/42'),
    'https://elsewhere.example/api/v1/media/42'
  );
  assert.equal(
    withMediaAccessToken('/uploads/legacy-photo.jpg'),
    ''
  );
  assert.equal(
    withMediaAccessToken('https://api.example.test/uploads/legacy-photo.jpg'),
    ''
  );
});
