import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { getSyncedScrollTop } from './merge-scroll.js';

describe('merge scroll helpers', () => {
  test('maps scroll progress between panes with different content heights', () => {
    assert.equal(
      getSyncedScrollTop({
        sourceTop: 300,
        sourceScrollHeight: 1000,
        sourceClientHeight: 400,
        targetScrollHeight: 1600,
        targetClientHeight: 400
      }),
      600
    );
  });

  test('keeps the target at the top when the source cannot scroll', () => {
    assert.equal(
      getSyncedScrollTop({
        sourceTop: 0,
        sourceScrollHeight: 400,
        sourceClientHeight: 400,
        targetScrollHeight: 1000,
        targetClientHeight: 400
      }),
      0
    );
  });
});
