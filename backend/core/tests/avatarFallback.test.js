import test from 'node:test';
import assert from 'node:assert/strict';
import { buildInitialsAvatarSvg, getAvatarInitials } from '../../../frontend/src/services/avatar.js';

test('avatar fallbacks use the user initials, not a person illustration', () => {
  assert.equal(getAvatarInitials('Felix Jose'), 'FJ');
  assert.equal(getAvatarInitials('felix'), 'F');
  assert.equal(getAvatarInitials('', 'T'), 'T');

  const svg = decodeURIComponent(buildInitialsAvatarSvg('Felix Jose').split(',')[1]);
  assert.match(svg, /<text[^>]*>FJ<\/text>/);
  assert.match(svg, /<circle/);
  assert.doesNotMatch(svg, /<path/);
});

test('avatar fallback safely escapes initials in SVG markup', () => {
  const svg = decodeURIComponent(buildInitialsAvatarSvg('&lpha User').split(',')[1]);
  assert.match(svg, />&amp;U<\/text>/);
});
