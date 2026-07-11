import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  DEFAULT_SMART_FORMAT_LINE_LENGTH,
  formatJsonSmart,
  loadSmartFormatLineLength,
  parseSmartFormatLineLength,
  saveSmartFormatLineLength
} from './smart-format.js';

describe('smart JSON formatting', () => {
  test('uses 120 as the default maximum line length', () => {
    assert.equal(DEFAULT_SMART_FORMAT_LINE_LENGTH, 120);
    assert.equal(loadSmartFormatLineLength({ getItem: () => null }), 120);
  });

  test('accepts line lengths from 40 through 500', () => {
    assert.equal(parseSmartFormatLineLength('40'), 40);
    assert.equal(parseSmartFormatLineLength('120'), 120);
    assert.equal(parseSmartFormatLineLength('500'), 500);
  });

  test('rejects non-integer and out-of-range line lengths', () => {
    assert.throws(() => parseSmartFormatLineLength('39'), /40/);
    assert.throws(() => parseSmartFormatLineLength('501'), /500/);
    assert.throws(() => parseSmartFormatLineLength('120.5'), /整数/);
  });

  test('falls back to the default when stored settings are invalid or unavailable', () => {
    assert.equal(loadSmartFormatLineLength({ getItem: () => 'invalid' }), 120);
    assert.equal(loadSmartFormatLineLength({ getItem: () => { throw new Error('blocked'); } }), 120);
  });

  test('saves a validated line length', () => {
    let storedValue = '';
    const storage = { setItem: (_key, value) => { storedValue = value; } };

    assert.equal(saveSmartFormatLineLength(storage, '160'), 160);
    assert.equal(storedValue, '160');
  });

  test('keeps simple nested values compact when they fit the configured line length', async () => {
    const formatted = await formatJsonSmart('{"name":"Ada","point":{"x":12,"y":8},"tags":["a","b"]}', {
      indentation: 2,
      maxLineLength: 120
    });

    assert.match(formatted, /"point": \{"x": 12, "y": 8\}/);
    assert.match(formatted, /"tags" *: \["a", "b"\]/);
  });
});
