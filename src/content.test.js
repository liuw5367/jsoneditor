import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  contentToText,
  formatJsonText,
  getInitialContent,
  isJsonText,
  readDraft,
  saveDraft
} from './content.js';

describe('content helpers', () => {
  it('formats valid JSON text with two-space indentation', () => {
    assert.equal(formatJsonText('{"name":"Ada","items":[1,true]}'), '{\n  "name": "Ada",\n  "items": [\n    1,\n    true\n  ]\n}');
  });

  it('keeps invalid JSON text unchanged when formatting is requested', () => {
    assert.equal(formatJsonText('{"name":'), '{"name":');
  });

  it('detects valid JSON text', () => {
    assert.equal(isJsonText('{"ok":true}'), true);
    assert.equal(isJsonText('{"ok":'), false);
  });

  it('converts editor text content to text', () => {
    assert.equal(contentToText({ text: '{"ok":true}' }), '{"ok":true}');
  });

  it('converts editor json content to pretty JSON text', () => {
    assert.equal(contentToText({ json: { ok: true } }), '{\n  "ok": true\n}');
  });

  it('uses the saved draft as initial content when present', () => {
    const storage = new MapStorage();

    saveDraft(storage, '{"saved":true}');

    assert.deepEqual(getInitialContent(storage), { text: '{"saved":true}' });
  });

  it('uses a small empty object when no saved draft exists', () => {
    assert.deepEqual(getInitialContent(new MapStorage()), { text: '{\n  \n}' });
  });

  it('ignores storage failures and returns an empty draft', () => {
    const storage = {
      getItem() {
        throw new Error('blocked');
      },
      setItem() {
        throw new Error('blocked');
      }
    };

    saveDraft(storage, '{"ok":true}');

    assert.equal(readDraft(storage), '');
  });
});

class MapStorage {
  #values = new Map();

  getItem(key) {
    return this.#values.get(key) ?? null;
  }

  setItem(key, value) {
    this.#values.set(key, value);
  }
}
