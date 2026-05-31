import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isDirectoryStoreAvailable, loadStoredDirectoryHandle, saveStoredDirectoryHandle } from './file-store.js';

describe('directory handle store', () => {
  it('reports unavailable indexedDB when missing', () => {
    assert.equal(isDirectoryStoreAvailable({}), false);
  });

  it('does not throw when indexedDB is unavailable', async () => {
    assert.equal(await saveStoredDirectoryHandle({ name: 'json-files' }, null), false);
    assert.equal(await loadStoredDirectoryHandle(null), null);
  });

  it('saves and loads a directory handle through indexedDB', async () => {
    const indexedDB = new FakeIndexedDB();
    const handle = { kind: 'directory', name: 'json-files' };

    assert.equal(await saveStoredDirectoryHandle(handle, indexedDB), true);
    assert.equal(await loadStoredDirectoryHandle(indexedDB), handle);
  });
});

class FakeIndexedDB {
  db = new FakeDatabase();

  open() {
    const request = {};

    queueMicrotask(() => {
      request.result = this.db;
      request.onupgradeneeded?.();
      request.onsuccess?.();
    });

    return request;
  }
}

class FakeDatabase {
  stores = new Map();

  createObjectStore(name) {
    if (!this.stores.has(name)) {
      this.stores.set(name, new Map());
    }
  }

  transaction(name) {
    if (!this.stores.has(name)) {
      this.createObjectStore(name);
    }

    return {
      objectStore: () => new FakeObjectStore(this.stores.get(name))
    };
  }
}

class FakeObjectStore {
  constructor(store) {
    this.store = store;
  }

  get(key) {
    const request = {};

    queueMicrotask(() => {
      request.result = this.store.get(key);
      request.onsuccess?.();
    });

    return request;
  }

  put(value, key) {
    const request = {};

    queueMicrotask(() => {
      this.store.set(key, value);
      request.onsuccess?.();
    });

    return request;
  }
}
