import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { getFileListEmptyMessage, restoreDirectorySession } from './directory-session.js';

describe('directory session helpers', () => {
  it('keeps a stored directory handle when permission will prompt later', async () => {
    const handle = { name: 'json-files' };
    const result = await restoreDirectorySession(
      async () => handle,
      async () => 'prompt'
    );

    assert.deepEqual(result, {
      handle,
      shouldLoadFiles: false
    });
  });

  it('loads files immediately when read permission is already granted', async () => {
    const handle = { name: 'json-files' };
    const result = await restoreDirectorySession(
      async () => handle,
      async () => 'granted'
    );

    assert.deepEqual(result, {
      handle,
      shouldLoadFiles: true
    });
  });

  it('drops a stored directory handle when read permission is denied', async () => {
    const result = await restoreDirectorySession(
      async () => ({ name: 'json-files' }),
      async () => 'denied'
    );

    assert.deepEqual(result, {
      handle: null,
      shouldLoadFiles: false
    });
  });

  it('returns the right empty-state message for each directory state', () => {
    assert.equal(getFileListEmptyMessage({ directoryHandle: null, filesLoaded: false, filesCount: 0 }), '先设置保存目录');
    assert.equal(
      getFileListEmptyMessage({ directoryHandle: { name: 'json-files' }, filesLoaded: false, filesCount: 0 }),
      '点击展开并授权读取目录'
    );
    assert.equal(
      getFileListEmptyMessage({ directoryHandle: { name: 'json-files' }, filesLoaded: true, filesCount: 0 }),
      '目录里还没有 JSON 文件'
    );
    assert.equal(getFileListEmptyMessage({ directoryHandle: { name: 'json-files' }, filesLoaded: true, filesCount: 2 }), '');
  });
});
