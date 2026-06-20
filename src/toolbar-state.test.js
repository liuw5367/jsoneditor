import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { getToolbarState } from './toolbar-state.js';

describe('toolbar state', () => {
  test('only shows new save when no file is selected', () => {
    assert.deepEqual(getToolbarState(''), {
      fileName: '',
      hasCurrentFile: false,
      showSaveNew: true,
      showSave: false,
      showDelete: false
    });
  });

  test('shows the current filename and all file actions when a file is selected', () => {
    assert.deepEqual(getToolbarState('example.json'), {
      fileName: 'example.json',
      hasCurrentFile: true,
      showSaveNew: true,
      showSave: true,
      showDelete: true
    });
  });
});
