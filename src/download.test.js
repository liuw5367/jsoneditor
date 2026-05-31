import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createJsonBlobParts, createJsonFilename } from './download.js';

describe('download helpers', () => {
  it('creates a stable json filename from the current date', () => {
    const date = new Date('2026-05-31T09:30:00.000Z');

    assert.equal(createJsonFilename(date), 'json-2026-05-31-093000.json');
  });

  it('normalizes text content with a trailing newline for saved files', () => {
    assert.deepEqual(createJsonBlobParts('{"ok":true}'), ['{"ok":true}\n']);
  });
});
