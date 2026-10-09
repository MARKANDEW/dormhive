import test from 'node:test';
import assert from 'node:assert/strict';

const rootUrl = 'http://localhost:5000/api/v1';
globalThis.window = { DORMHIVE_API_URL: rootUrl };
globalThis.document = { addEventListener() {} };
globalThis.localStorage = {
  getItem(key) { return key === 'dormhive.accessToken' ? 'test-access-token' : null; }
};

const { resolveImageUrl, getUserAvatarUrl } = await import('../../../frontend/src/users/tenant/setting.js');

test('legacy filesystem avatar URLs are not served from the backend', () => {
  const uploaded = '/uploads/users/1755223456789-portrait.jpg';

  assert.equal(resolveImageUrl(uploaded), '');
  assert.equal(resolveImageUrl('uploads/users/1755223456789-portrait.jpg'), '');
  assert.match(getUserAvatarUrl({ avatar_url: uploaded }, 'Jane Doe'), /^data:image\/svg\+xml/);
});

test('database media avatar references receive an authenticated media URL', () => {
  assert.equal(
    getUserAvatarUrl({ avatar_url: '/api/v1/media/42' }, 'Jane Doe'),
    'http://localhost:5000/api/v1/media/42?access_token=test-access-token'
  );
});
