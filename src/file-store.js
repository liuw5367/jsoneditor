const DATABASE_NAME = 'clean-json-editor';
const DATABASE_VERSION = 1;
const STORE_NAME = 'handles';
const DIRECTORY_KEY = 'save-directory';

export function isDirectoryStoreAvailable(windowRef = globalThis) {
  return Boolean(windowRef?.indexedDB?.open);
}

export async function loadStoredDirectoryHandle(indexedDBRef = globalThis.indexedDB) {
  if (!indexedDBRef?.open) {
    return null;
  }

  try {
    const database = await openDatabase(indexedDBRef);
    const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(DIRECTORY_KEY);

    return (await requestToPromise(request)) ?? null;
  } catch {
    return null;
  }
}

export async function saveStoredDirectoryHandle(handle, indexedDBRef = globalThis.indexedDB) {
  if (!indexedDBRef?.open || !handle) {
    return false;
  }

  try {
    const database = await openDatabase(indexedDBRef);
    const request = database.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(handle, DIRECTORY_KEY);

    await requestToPromise(request);
    return true;
  } catch {
    return false;
  }
}

function openDatabase(indexedDBRef) {
  const request = indexedDBRef.open(DATABASE_NAME, DATABASE_VERSION);

  request.onupgradeneeded = () => {
    if (!request.result.objectStoreNames?.contains?.(STORE_NAME)) {
      request.result.createObjectStore(STORE_NAME);
    }
  };

  return requestToPromise(request);
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
