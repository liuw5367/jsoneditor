import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  deleteJsonFile,
  ensureHandlePermission,
  getDisplayDirectoryName,
  listJsonFiles,
  normalizeJsonFileName,
  queryHandlePermission,
  renameJsonFile,
  supportsDirectoryAccess,
  writeFileHandle,
  writeJsonFile
} from './file-system.js';

describe('file system helpers', () => {
  it('detects directory access support', () => {
    assert.equal(supportsDirectoryAccess({ showDirectoryPicker() {} }), true);
    assert.equal(supportsDirectoryAccess({}), false);
  });

  it('normalizes edited filenames to safe json filenames', () => {
    assert.equal(normalizeJsonFileName('settings'), 'settings.json');
    assert.equal(normalizeJsonFileName('settings.JSON'), 'settings.json');
    assert.equal(normalizeJsonFileName('reports/2026'), 'reports-2026.json');
    assert.equal(normalizeJsonFileName('   '), 'untitled.json');
  });

  it('lists only json files in alphabetical order', async () => {
    const directory = new FakeDirectoryHandle({
      'zeta.json': new FakeFileHandle('zeta.json', '{}'),
      'notes.txt': new FakeFileHandle('notes.txt', ''),
      'alpha.JSON': new FakeFileHandle('alpha.JSON', '{}'),
      nested: { kind: 'directory', name: 'nested' }
    });

    assert.deepEqual(await listJsonFiles(directory), [
      { name: 'alpha.JSON', handle: directory.items.get('alpha.JSON') },
      { name: 'zeta.json', handle: directory.items.get('zeta.json') }
    ]);
  });

  it('writes json text to a file with a trailing newline', async () => {
    const directory = new FakeDirectoryHandle();

    const handle = await writeJsonFile(directory, 'draft', '{"ok":true}');

    assert.equal(handle.name, 'draft.json');
    assert.equal(directory.items.get('draft.json').text, '{"ok":true}\n');
  });

  it('writes to an existing handle without normalizing its filename', async () => {
    const handle = new FakeFileHandle('alpha.JSON', '{}');

    await writeFileHandle(handle, '{"ok":true}');

    assert.equal(handle.name, 'alpha.JSON');
    assert.equal(handle.text, '{"ok":true}\n');
  });

  it('deletes an existing file by its exact filename', async () => {
    const directory = new FakeDirectoryHandle({
      'alpha.JSON': new FakeFileHandle('alpha.JSON', '{}')
    });

    await deleteJsonFile(directory, 'alpha.JSON');

    assert.equal(directory.items.has('alpha.JSON'), false);
  });

  it('renames a json file by copying content and removing the old entry', async () => {
    const directory = new FakeDirectoryHandle({
      'old-name.JSON': new FakeFileHandle('old-name.JSON', '{"ok":true}')
    });

    const next = await renameJsonFile(directory, 'old-name.JSON', 'new/name');

    assert.equal(next.name, 'new-name.json');
    assert.equal(directory.items.has('old-name.JSON'), false);
    assert.equal(directory.items.get('new-name.json').text, '{"ok":true}\n');
  });

  it('does not overwrite an existing file when renaming', async () => {
    const directory = new FakeDirectoryHandle({
      'old-name.json': new FakeFileHandle('old-name.json', '{"old":true}'),
      'new-name.json': new FakeFileHandle('new-name.json', '{"new":true}')
    });

    await assert.rejects(() => renameJsonFile(directory, 'old-name.json', 'new-name.json'), /已存在/);
    assert.equal(directory.items.get('old-name.json').text, '{"old":true}');
    assert.equal(directory.items.get('new-name.json').text, '{"new":true}');
  });

  it('returns the selected directory name when available', () => {
    assert.equal(getDisplayDirectoryName({ name: 'json-files' }), 'json-files');
    assert.equal(getDisplayDirectoryName(null), '未设置');
  });

  it('queries read permission by default', async () => {
    const handle = new FakePermissionHandle(['granted']);

    assert.equal(await queryHandlePermission(handle), 'granted');
    assert.deepEqual(handle.queryCalls, [{ mode: 'read' }]);
  });

  it('requests readwrite permission when needed', async () => {
    const handle = new FakePermissionHandle(['prompt'], ['granted']);

    assert.equal(await ensureHandlePermission(handle, 'readwrite'), true);
    assert.deepEqual(handle.queryCalls, [{ mode: 'readwrite' }]);
    assert.deepEqual(handle.requestCalls, [{ mode: 'readwrite' }]);
  });

  it('returns false when permission request is denied', async () => {
    const handle = new FakePermissionHandle(['prompt'], ['denied']);

    assert.equal(await ensureHandlePermission(handle, 'read'), false);
  });
});

class FakeDirectoryHandle {
  kind = 'directory';
  name = 'fixtures';

  constructor(items = {}) {
    this.items = new Map(Object.entries(items));
  }

  async *entries() {
    for (const item of this.items.entries()) {
      yield item;
    }
  }

  async getFileHandle(name, options = {}) {
    const existing = this.items.get(name);

    if (existing) {
      return existing;
    }

    if (!options.create) {
      throw new Error(`Missing file: ${name}`);
    }

    const handle = new FakeFileHandle(name, '');
    this.items.set(name, handle);
    return handle;
  }

  async removeEntry(name) {
    this.items.delete(name);
  }
}

class FakeFileHandle {
  kind = 'file';

  constructor(name, text) {
    this.name = name;
    this.text = text;
  }

  async getFile() {
    return {
      text: async () => this.text
    };
  }

  async createWritable() {
    return {
      write: async (text) => {
        this.text = text;
      },
      close: async () => {}
    };
  }
}

class FakePermissionHandle {
  constructor(queryResults = [], requestResults = []) {
    this.queryResults = queryResults;
    this.requestResults = requestResults;
    this.queryCalls = [];
    this.requestCalls = [];
  }

  async queryPermission(options) {
    this.queryCalls.push(options);
    return this.queryResults.shift() ?? 'prompt';
  }

  async requestPermission(options) {
    this.requestCalls.push(options);
    return this.requestResults.shift() ?? 'denied';
  }
}
