import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { compareJsonTexts } from './json-diff.js';

describe('JSON diff', () => {
  test('ignores object key order', () => {
    const result = compareJsonTexts('{"name":"Ada","active":true}', '{"active":true,"name":"Ada"}');

    assert.deepEqual(result, {
      valid: true,
      differences: [],
      counts: { added: 0, removed: 0, changed: 0 }
    });
  });

  test('reports added, removed, and changed values by JSON path', () => {
    const result = compareJsonTexts(
      '{"name":"Ada","obsolete":true,"profile":{"age":30}}',
      '{"name":"Grace","enabled":true,"profile":{"age":31}}'
    );

    assert.deepEqual(result, {
      valid: true,
      differences: [
        { path: ['enabled'], type: 'added', left: undefined, right: true },
        { path: ['name'], type: 'changed', left: 'Ada', right: 'Grace' },
        { path: ['obsolete'], type: 'removed', left: true, right: undefined },
        { path: ['profile', 'age'], type: 'changed', left: 30, right: 31 }
      ],
      counts: { added: 1, removed: 1, changed: 2 }
    });
  });

  test('returns side-specific parse errors for invalid JSON', () => {
    assert.deepEqual(compareJsonTexts('{', '[]'), {
      valid: false,
      errors: { left: '原始 JSON 无效', right: '' }
    });

    assert.deepEqual(compareJsonTexts('{}', ']'), {
      valid: false,
      errors: { left: '', right: '目标 JSON 无效' }
    });
  });

  test('treats an array replacement at the same index as a change', () => {
    assert.deepEqual(compareJsonTexts('[1,2,3]', '[1,4,3,5]'), {
      valid: true,
      differences: [
        { path: [1], type: 'changed', left: 2, right: 4 },
        { path: [3], type: 'added', left: undefined, right: 5 }
      ],
      counts: { added: 1, removed: 0, changed: 1 }
    });
  });
});
