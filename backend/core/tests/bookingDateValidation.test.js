import test from 'node:test';
import assert from 'node:assert/strict';
import { hasRentalSlotCapacity, isValidOccupantCount, resolveMoveOutSchedule } from '../controllers/bookingController.js';

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

test('occupants are a positive whole-person count independent from rental slot capacity', () => {
  assert.equal(isValidOccupantCount(1), true);
  assert.equal(isValidOccupantCount(8), true);
  assert.equal(isValidOccupantCount(0), false);
  assert.equal(isValidOccupantCount(1.5), false);
  assert.equal(isValidOccupantCount('not a number'), false);
});

test('each approved booking consumes one rental slot independently of its occupants', () => {
  assert.equal(hasRentalSlotCapacity(8, 0), true);
  assert.equal(hasRentalSlotCapacity(8, 7), true);
  assert.equal(hasRentalSlotCapacity(8, 8), false);
  assert.equal(hasRentalSlotCapacity(8, 7, 2), false);
});