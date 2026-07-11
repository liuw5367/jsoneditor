import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { reorderEditorMenu } from './editor-menu.js';

function button(title) {
  return { type: 'button', title };
}

describe('editor menu', () => {
  test('places formatting and structure actions after the mode switcher', () => {
    const items = [
      button('Switch to text mode (current mode: text)'),
      button('Switch to tree mode (current mode: text)'),
      button('Switch to table mode (current mode: text)'),
      button('Expand all'),
      button('Collapse all'),
      button('Format JSON: add proper indentation and new lines (Ctrl+I)'),
      button('Compact JSON: remove all white spacing and new lines (Ctrl+Shift+I)'),
      button('Sort'),
      button('Search (Ctrl+F)')
    ];

    const reordered = reorderEditorMenu(items);

    assert.deepEqual(
      reordered.map((item) => item.title),
      [
        'Switch to text mode (current mode: text)',
        'Switch to tree mode (current mode: text)',
        'Switch to table mode (current mode: text)',
        'Format JSON: add proper indentation and new lines (Ctrl+I)',
        'Compact JSON: remove all white spacing and new lines (Ctrl+Shift+I)',
        undefined,
        'Expand all',
        'Collapse all',
        'Sort',
        'Search (Ctrl+F)'
      ]
    );
  });

  test('collapses adjacent separators after the preferred actions', () => {
    const items = [
      button('Switch to text mode (current mode: text)'),
      button('Format JSON: add proper indentation'),
      button('Compact JSON: remove whitespace'),
      button('Expand all'),
      button('Collapse all'),
      { type: 'separator' },
      { type: 'separator' },
      { type: 'separator' },
      button('Sort')
    ];

    const reordered = reorderEditorMenu(items);
    const compactIndex = reordered.findIndex((item) => item.title?.startsWith('Compact JSON:'));
    const collapseIndex = reordered.findIndex((item) => item.title === 'Collapse all');

    assert.equal(reordered[compactIndex + 1].type, 'separator');
    assert.equal(reordered[compactIndex + 2].title, 'Expand all');
    assert.equal(reordered[collapseIndex + 1].type, 'separator');
    assert.equal(reordered[collapseIndex + 2].title, 'Sort');
  });

  test('adds visible labels to formatting actions', () => {
    const items = [
      button('Switch to text mode (current mode: text)'),
      button('Format JSON: add proper indentation'),
      button('Compact JSON: remove whitespace')
    ];

    const reordered = reorderEditorMenu(items);

    assert.equal(reordered[1].text, '美化 JSON');
    assert.equal(reordered[2].text, '压缩');
  });

  test('keeps unknown items and their relative order', () => {
    const items = [
      button('Switch to text mode (current mode: text)'),
      { type: 'separator' },
      button('Expand all'),
      button('Custom action'),
      button('Format JSON: add proper indentation')
    ];

    const reordered = reorderEditorMenu(items);

    assert.equal(reordered.length, items.length);
    assert.ok(reordered.indexOf(items[1]) < reordered.indexOf(items[3]));
  });

  test('skips unavailable preferred actions without throwing', () => {
    const items = [
      button('Switch to text mode (current mode: text)'),
      button('Expand all'),
      button('Search (Ctrl+F)')
    ];

    assert.deepEqual(reorderEditorMenu(items), items);
  });

  test('does not mutate the menu supplied by the editor', () => {
    const items = [
      button('Switch to text mode (current mode: text)'),
      button('Expand all'),
      button('Format JSON: add proper indentation')
    ];
    const original = [...items];

    reorderEditorMenu(items);

    assert.deepEqual(items, original);
  });
});
