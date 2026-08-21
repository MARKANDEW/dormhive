import test from 'node:test';
import assert from 'node:assert/strict';

const rootUrl = 'http://localhost:5000/api/v1';
globalThis.window = { DORMHIVE_API_URL: rootUrl };
globalThis.document = { addEventListener() {} };

const { resolveImageUrl, getUserAvatarUrl } = await import('../../../frontend/src/users/tenant/setting.js');

test('tenant avatar URLs resolve to the exact uploaded file', () => {
  const uploaded = '/uploads/users/1755223456789-portrait.jpg';

  assert.equal(resolveImageUrl(uploaded), 'http://localhost:5000/uploads/users/1755223456789-portrait.jpg');
  assert.equal(resolveImageUrl('uploads/users/1755223456789-portrait.jpg'), 'http://localhost:5000/uploads/users/1755223456789-portrait.jpg');
  assert.equal(getUserAvatarUrl({ avatar_url: uploaded }, 'Jane Doe'), 'http://localhost:5000/uploads/users/1755223456789-portrait.jpg');
});
