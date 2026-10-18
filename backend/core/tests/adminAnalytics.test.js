import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildDashboardMetrics,
  countByRole,
  countByStatus,
  totalCount,
} from '../../../frontend/src/users/admin/analyticsUtils.js';
import { buildActivityFeed } from '../../../frontend/src/users/admin/analyticsUtils.js';
import { guardUserArchive, guardUserStatusChange } from '../controllers/userController.js';

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

test('active users with a login record are labeled as logged in', () => {
  const now = Date.now();
  const activities = buildActivityFeed([
    {
      name: 'Logged In Tenant',
      email: 'tenant@example.com',
      role: 'tenant',
      status: 'active',
      created_at: new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(),
      last_login_at: new Date(now - 2 * 60 * 1000).toISOString()
    },
    {
      name: 'Updated Owner',
      role: 'owner',
      status: 'active',
      created_at: new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(now - 1 * 60 * 1000).toISOString(),
      last_login_at: new Date(now - 2 * 60 * 1000).toISOString()
    },
    {
      name: 'Older Tenant',
      email: 'owner@example.com',
      role: 'owner',
      status: 'active',
      created_at: new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString()
    }
  ]);

  assert.equal(activities[0].title, 'User logged in');
  assert.match(activities[1].time, /^2 mins? ago$/);
  assert.equal(activities[1].title, 'User logged in');
  assert.equal(activities[2].title, 'New user registered');
});

test('new pending properties appear in the recent activity feed', () => {
  const now = Date.now();
  const activities = buildActivityFeed([], [
    {
      title: 'Maple Studio',
      status: 'pending',
      created_at: new Date(now - 2 * 60 * 1000).toISOString(),
      updated_at: new Date(now - 2 * 60 * 1000).toISOString()
    },
    {
      title: 'Sunset Apartment',
      status: 'approved',
      created_at: new Date(now - 5 * 60 * 1000).toISOString(),
      updated_at: new Date(now - 5 * 60 * 1000).toISOString()
    }
  ], []);

  assert.ok(activities.some((activity) => activity.title === 'Property submitted' && activity.detail.includes('Maple Studio')));
  assert.ok(activities.some((activity) => activity.title === 'Property approved' && activity.detail.includes('Sunset Apartment')));
});

test('recent activity merges notifications and every booking status newest first', () => {
  const now = Date.now();
  const activities = buildActivityFeed(
    [{ name: 'New Tenant', status: 'active', created_at: new Date(now - 6000).toISOString(), updated_at: new Date(now - 6000).toISOString() }],
    [{ title: 'Dorm Room', status: 'archived', updated_at: new Date(now - 4000).toISOString() }],
    [
      { tenant_name: 'Pending Tenant', status: 'pending', created_at: new Date(now - 3000).toISOString() },
      { tenant_name: 'Cancelled Tenant', status: 'cancelled', updated_at: new Date(now - 2000).toISOString() }
    ],
    [{ title: 'Booking update', message: 'Viewing schedule changed', created_at: new Date(now - 1000).toISOString() }]
  );

  assert.equal(activities[0].title, 'Booking update');
  assert.ok(activities.some((activity) => activity.title === 'New user registered'));
  assert.ok(activities.some((activity) => activity.title === 'Property archived'));
  assert.ok(activities.some((activity) => activity.title === 'Booking requested'));
  assert.ok(activities.some((activity) => activity.title === 'Booking cancelled'));
});

test('admin self-suspension is blocked', () => {
  const result = guardUserStatusChange({
    actor: { id: 7, role: 'admin' },
    target: { id: 7, role: 'admin' },
    nextStatus: 'suspended'
  });

  assert.equal(result.allowed, false);
  assert.match(result.message, /cannot.*suspend/i);
});

test('only tenant and owner accounts can be archived by an admin', () => {
  const tenant = guardUserArchive({
    actor: { id: 7, role: 'admin' },
    target: { id: 8, role: 'tenant', status: 'active' }
  });
  const admin = guardUserArchive({
    actor: { id: 7, role: 'admin' },
    target: { id: 8, role: 'admin', status: 'active' }
  });

  assert.equal(tenant.allowed, true);
  assert.equal(admin.allowed, false);
  assert.match(admin.message, /tenant and owner/i);
});

test('account archive prevents self-archive and repeated archive actions', () => {
  const selfArchive = guardUserArchive({
    actor: { id: 7, role: 'admin' },
    target: { id: 7, role: 'owner', status: 'active' }
  });
  const alreadyArchived = guardUserArchive({
    actor: { id: 7, role: 'admin' },
    target: { id: 8, role: 'tenant', status: 'archived' }
  });

  assert.equal(selfArchive.allowed, false);
  assert.match(selfArchive.message, /own account/i);
  assert.equal(alreadyArchived.allowed, false);
  assert.equal(alreadyArchived.status, 409);
});
