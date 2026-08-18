import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildDashboardMetrics,
  countByRole,
  countByStatus,
  totalCount,
} from '../../frontend/src/users/admin/analyticsUtils.js';

test('buildDashboardMetrics totals are computed from aggregated analytics rows', () => {
  const metrics = buildDashboardMetrics({
    users: [
      { role: 'tenant', status: 'active', count: 12 },
      { role: 'tenant', status: 'suspended', count: 2 },
      { role: 'owner', status: 'active', count: 5 },
      { role: 'admin', status: 'active', count: 1 },
    ],
    properties: [
      { status: 'approved', count: 8 },
      { status: 'pending', count: 3 },
      { status: 'rejected', count: 1 },
    ],
    bookings: [
      { status: 'pending', count: 6 },
      { status: 'approved', count: 9 },
      { status: 'cancelled', count: 2 },
    ],
  });

  assert.equal(metrics.totalUsers, 20);
  assert.equal(metrics.totalProperties, 12);
  assert.equal(metrics.totalBookings, 17);
  assert.equal(metrics.pendingModeration, 3);
  assert.equal(metrics.approvalRate, 53);
  assert.equal(countByRole([{ role: 'tenant', count: 12 }, { role: 'owner', count: 5 }], 'tenant'), 12);
  assert.equal(countByStatus([{ status: 'pending', count: 6 }, { status: 'approved', count: 9 }], 'pending'), 6);
  assert.equal(totalCount([{ count: 5 }, { count: 3 }]), 8);
});

test('countByRole and countByStatus return zero for missing groups', () => {
  assert.equal(countByRole([{ role: 'tenant', count: 4 }], 'owner'), 0);
  assert.equal(countByStatus([{ status: 'approved', count: 7 }], 'pending'), 0);
});
