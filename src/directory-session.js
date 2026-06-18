export async function restoreDirectorySession(loadStoredDirectoryHandle, queryHandlePermission) {
  const storedHandle = await loadStoredDirectoryHandle();

  if (!storedHandle) {
    return {
      handle: null,
      shouldLoadFiles: false
    };
  }

  const permissionState = await queryHandlePermission(storedHandle, 'read');

  if (permissionState === 'denied') {
    return {
      handle: null,
      shouldLoadFiles: false
    };
  }

  return {
    handle: storedHandle,
    shouldLoadFiles: permissionState === 'granted'
  };
}

export function getFileListEmptyMessage({ directoryHandle, filesLoaded, filesCount }) {
  if (!directoryHandle) {
    return '先设置保存目录';
  }

  if (!filesLoaded) {
    return '点击展开并授权读取目录';
  }

  if (filesCount === 0) {
    return '目录里还没有 JSON 文件';
  }

  return '';
}
