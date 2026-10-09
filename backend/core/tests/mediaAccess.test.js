import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = { DORMHIVE_API_URL: 'https://api.example.test/api/v1' };
globalThis.localStorage = {
  getItem(key) { return key === 'dormhive.accessToken' ? 'test-access-token' : null; }
};

const { withMediaAccessToken } = await import('../../../frontend/src/services/mediaAccess.js');

test('adds access tokens only to same-origin database media URLs', () => {
  assert.equal(
    withMediaAccessToken('/api/v1/media/42'),
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
