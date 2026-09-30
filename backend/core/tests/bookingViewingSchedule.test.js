import test from 'node:test';
import assert from 'node:assert/strict';
import { canTenantEditViewingSchedule, isValidViewingSchedule, resolveViewingSchedule } from '../controllers/bookingController.js';

test('viewing schedules accept valid independent date and time values', () => {
  assert.equal(isValidViewingSchedule('2026-10-01', '10:00'), true);
  assert.equal(isValidViewingSchedule('2026-12-31', '23:59'), true);
});

test('viewing schedules reject malformed or impossible date and time values', () => {
  assert.equal(isValidViewingSchedule('2026-02-30', '10:00'), false);
  assert.equal(isValidViewingSchedule('2026-10-01', '24:00'), false);
  assert.equal(isValidViewingSchedule('10/01/2026', '10:00'), false);
  assert.equal(isValidViewingSchedule('2026-10-01', '10:00 AM'), false);
});

test('tenant submissions may omit both viewing values but not just one', () => {
  assert.deepEqual(resolveViewingSchedule('', ''), { valid: true, viewingDate: null, viewingTime: null });
  assert.equal(resolveViewingSchedule('2026-10-01', '').valid, false);
  assert.deepEqual(resolveViewingSchedule('2026-10-01', '10:00'), {
    valid: true,
    viewingDate: '2026-10-01',
    viewingTime: '10:00'
  });
});

test('only the tenant can edit a viewing schedule while the inquiry is pending', () => {
  const booking = { tenant_id: 12, owner_id: 34, status: 'pending' };
  assert.equal(canTenantEditViewingSchedule(booking, { id: 12, role: 'tenant' }), true);
  assert.equal(canTenantEditViewingSchedule(booking, { id: 34, role: 'owner' }), false);
  assert.equal(canTenantEditViewingSchedule({ ...booking, status: 'approved' }, { id: 12, role: 'tenant' }), false);
});