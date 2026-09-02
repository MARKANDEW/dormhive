import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBookingListSql } from '../models/Booking.js';

test('owner booking queries include tenant avatar information', () => {
  const sql = buildBookingListSql('owner');
  assert.match(sql, /u\.avatar_url\s+AS\s+tenant_avatar_url/i);
  assert.match(sql, /COALESCE\(CONCAT_WS\(' ', u\.first_name, u\.last_name\), u\.name\) AS tenant_name/i);
});
