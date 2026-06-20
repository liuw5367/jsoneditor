import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { formatMergeContent, replaceMergeDocument } from './merge-content.js';

describe('merge content helpers', () => {
  test('formats valid JSON for stable line comparison', () => {
    assert.equal(formatMergeContent('{"b":2,"a":1}'), '{\n  "b": 2,\n  "a": 1\n}');
  });

  test('keeps incomplete JSON editable', () => {
    assert.equal(formatMergeContent('{'), '{');
  });

  test('creates a full-document replacement transaction', () => {
    const state = { doc: { length: 8 } };

    assert.deepEqual(replaceMergeDocument(state, 'next'), {
      changes: { from: 0, to: 8, insert: 'next' }
    });
  });
});
