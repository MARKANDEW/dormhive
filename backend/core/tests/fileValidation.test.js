import test from 'node:test';
import assert from 'node:assert/strict';
import { detectMimeType, validateUpload } from '../utils/fileValidation.js';

test('detects supported image types from their bytes', () => {
  assert.equal(detectMimeType(Buffer.from([0xff, 0xd8, 0xff, 0x00])), 'image/jpeg');
  assert.equal(detectMimeType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), 'image/png');
  assert.equal(detectMimeType(Buffer.from('GIF89a')), 'image/gif');
  assert.equal(detectMimeType(Buffer.from('RIFFxxxxWEBP')), 'image/webp');
});

test('rejects mismatched and unsupported file content', () => {
  const invalidImage = { buffer: Buffer.from('not an image'), mimetype: 'image/jpeg', originalname: 'fake.jpg' };
  assert.throws(() => validateUpload(invalidImage, { imagesOnly: true }), { statusCode: 422 });
  assert.throws(() => validateUpload({
    buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    mimetype: 'image/jpeg',
    originalname: 'mismatch.jpg'
  }), /does not match/);
});

test('accepts validated support attachment signatures', () => {
  const pdf = { buffer: Buffer.from('%PDF-1.7'), mimetype: 'application/pdf', originalname: 'proof.pdf' };
  assert.equal(validateUpload(pdf).mimeType, 'application/pdf');
});
