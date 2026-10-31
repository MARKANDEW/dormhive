import test from 'node:test';
import assert from 'node:assert/strict';
import { publishDataChange, subscribeToDataChanges } from '../services/realtimeEvents.js';

test('publishDataChange notifies other tabs and skips the source tab', () => {
  const sourceWrites = [];
  const otherWrites = [];
  const source = { destroyed: false, writableEnded: false, write: (value) => sourceWrites.push(value) };
  const other = { destroyed: false, writableEnded: false, write: (value) => otherWrites.push(value) };
  const unsubscribeSource = subscribeToDataChanges(source, 'tab-a');
  const unsubscribeOther = subscribeToDataChanges(other, 'tab-b');

  publishDataChange({ resource: 'properties', sourceId: 'tab-a' });

  assert.equal(sourceWrites.length, 0);
  assert.equal(otherWrites.length, 1);
  assert.match(otherWrites[0], /event: data-changed/);
  assert.match(otherWrites[0], /"resource":"properties"/);

  unsubscribeSource();
  unsubscribeOther();
});