import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { filterDifferences, toggleDifferenceFilter } from './difference-filter.js';

const differences = [
  { type: 'added', path: ['enabled'] },
  { type: 'removed', path: ['obsolete'] },
  { type: 'changed', path: ['name'] },
  { type: 'changed', path: ['profile', 'age'] }
];

describe('difference filter', () => {
  test('filters differences by the selected type', () => {
    assert.deepEqual(filterDifferences(differences, 'added'), [differences[0]]);
    assert.deepEqual(filterDifferences(differences, 'removed'), [differences[1]]);
    assert.deepEqual(filterDifferences(differences, 'changed'), [differences[2], differences[3]]);
  });

  test('returns no rows when no filter is active', () => {
    assert.deepEqual(filterDifferences(differences, ''), []);
  });

  test('toggles the active filter closed', () => {
    assert.equal(toggleDifferenceFilter('added', 'added', 1), '');
  });

  test('switches to another non-empty filter', () => {
    assert.equal(toggleDifferenceFilter('added', 'changed', 2), 'changed');
  });

  test('does not open a zero-count filter', () => {
    assert.equal(toggleDifferenceFilter('', 'removed', 0), '');
  });
});
