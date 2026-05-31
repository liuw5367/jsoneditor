import { createJsonBlobParts } from './download.js';

export function supportsDirectoryAccess(windowRef = globalThis) {
  return typeof windowRef.showDirectoryPicker === 'function';
}

export function getDisplayDirectoryName(directoryHandle) {
  return directoryHandle?.name || '未设置';
}

export function normalizeJsonFileName(name) {
  const baseName = String(name)
    .trim()
    .replace(/\.json$/i, '')
    .replace(/[\\/]/g, '-')
    .replace(/[<>:"|?*\u0000-\u001f]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/^-+|-+$/g, '');

  return `${baseName || 'untitled'}.json`;
}

export async function selectDirectory(windowRef = globalThis) {
  if (!supportsDirectoryAccess(windowRef)) {
    throw new Error('当前浏览器不支持保存目录');
  }

  return windowRef.showDirectoryPicker({
    id: 'clean-json-editor-directory',
    mode: 'readwrite',
    startIn: 'documents'
  });
}

export async function ensureReadWritePermission(handle) {
  if (!handle) {
    return false;
  }

  const options = { mode: 'readwrite' };

  if (typeof handle.queryPermission === 'function' && (await handle.queryPermission(options)) === 'granted') {
    return true;
  }

  if (typeof handle.requestPermission === 'function') {
    return (await handle.requestPermission(options)) === 'granted';
  }

  return true;
}

export async function listJsonFiles(directoryHandle) {
  if (!directoryHandle) {
    return [];
  }

  const files = [];

  for await (const [name, handle] of directoryHandle.entries()) {
    if (handle.kind === 'file' && /\.json$/i.test(name)) {
      files.push({ name, handle });
    }
  }

  return files.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

export async function readFileText(fileHandle) {
  const file = await fileHandle.getFile();

  return file.text();
}

export async function writeJsonFile(directoryHandle, fileName, text) {
  const normalizedName = normalizeJsonFileName(fileName);
  const fileHandle = await directoryHandle.getFileHandle(normalizedName, { create: true });

  await writeFileHandle(fileHandle, text);

  return fileHandle;
}

export async function writeFileHandle(fileHandle, text) {
  const writable = await fileHandle.createWritable();

  await writable.write(createJsonBlobParts(text).join(''));
  await writable.close();
}

export async function deleteJsonFile(directoryHandle, fileName) {
  await directoryHandle.removeEntry(fileName);
}

export async function renameJsonFile(directoryHandle, oldName, nextName) {
  const normalizedNextName = normalizeJsonFileName(nextName);

  if (oldName === nextName || oldName.toLowerCase() === normalizedNextName.toLowerCase()) {
    return directoryHandle.getFileHandle(oldName);
  }

  if (await fileExists(directoryHandle, normalizedNextName)) {
    throw new Error('目标文件已存在');
  }

  const oldHandle = await directoryHandle.getFileHandle(oldName);
  const oldText = await readFileText(oldHandle);
  const nextHandle = await writeJsonFile(directoryHandle, normalizedNextName, oldText);

  await directoryHandle.removeEntry(oldName);

  return nextHandle;
}

async function fileExists(directoryHandle, fileName) {
  try {
    await directoryHandle.getFileHandle(fileName);
    return true;
  } catch {
    return false;
  }
}
