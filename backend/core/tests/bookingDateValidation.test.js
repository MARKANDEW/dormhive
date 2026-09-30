import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveMoveOutSchedule } from '../controllers/bookingController.js';

test('indefinite move-out is stored without a date and with its flag', () => {
  assert.deepEqual(resolveMoveOutSchedule('2026-10-01', null, true), {
    valid: true,
    moveOutDate: null,
    isIndefiniteMoveOut: true
  });
});

test('move-out is optional and a specific date must be after move-in', () => {
  assert.deepEqual(resolveMoveOutSchedule('2026-10-01', null, false), {
    valid: true,
    moveOutDate: null,
    isIndefiniteMoveOut: false
  });
  assert.equal(resolveMoveOutSchedule('2026-10-01', '2026-10-02').valid, true);
  assert.equal(resolveMoveOutSchedule('2026-10-01', '2026-10-01').valid, false);
  assert.equal(resolveMoveOutSchedule('2026-10-01', '2026-09-30').valid, false);
  assert.equal(resolveMoveOutSchedule('2026-02-30', null).valid, false);
});