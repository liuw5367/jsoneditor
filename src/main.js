import { createJSONEditor, Mode } from 'vanilla-jsoneditor';
import './styles.css';

import { contentToText, getInitialContent, isJsonText, saveDraft } from './content.js';
import { getFileListEmptyMessage, restoreDirectorySession } from './directory-session.js';
import { createJsonFilename, downloadJsonText } from './download.js';
import {
  deleteJsonFile,
  ensureHandlePermission,
  getDisplayDirectoryName,
  listJsonFiles,
  queryHandlePermission,
  readFileText,
  renameJsonFile,
  selectDirectory,
  supportsDirectoryAccess,
  writeFileHandle,
  writeJsonFile
} from './file-system.js';
import { loadStoredDirectoryHandle, saveStoredDirectoryHandle } from './file-store.js';

const editorTarget = document.querySelector('#editor');
const directoryLabel = document.querySelector('#directory-label');
const fileListPanel = document.querySelector('#file-list-panel');
const fileList = document.querySelector('#file-list');
const saveButton = document.querySelector('#save-button');
const saveNewButton = document.querySelector('#save-new-button');
const deleteCurrentButton = document.querySelector('#delete-current-button');
const saveStatus = document.querySelector('#save-status');
const renameDialog = document.querySelector('#rename-dialog');
const renameForm = document.querySelector('#rename-form');
const renameInput = document.querySelector('#rename-input');
const renameCancelButton = document.querySelector('#rename-cancel-button');

let currentContent = getInitialContent();
let directoryHandle = null;
let currentFileHandle = null;
let currentFileName = '';
let files = [];
let filesLoaded = false;
let renameTargetName = '';

const editor = createJSONEditor({
  target: editorTarget,
  props: {
    content: currentContent,
    mode: Mode.text,
    mainMenuBar: true,
    navigationBar: false,
    statusBar: true,
    askToFormat: false,
    onChange(updatedContent) {
      currentContent = updatedContent;
      const text = contentToText(updatedContent);

      saveDraft(localStorage, text);
      updateStatus(text);
    }
  }
});

directoryLabel.addEventListener('click', (event) => {
  if (event.target.closest('.dir-edit-btn')) {
    selectDirectoryHandler();
    return;
  }
  void toggleFileList();
});

directoryLabel.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();

    if (event.target.closest('.dir-edit-btn')) {
      selectDirectoryHandler();
      return;
    }
    void toggleFileList();
  }
});

async function selectDirectoryHandler() {
  try {
    directoryHandle = await selectDirectory(window);

    if (!(await ensureHandlePermission(directoryHandle, 'readwrite'))) {
      setStatus('目录未授权');
      return;
    }

    currentFileHandle = null;
    currentFileName = '';
    filesLoaded = false;
    await saveStoredDirectoryHandle(directoryHandle);
    await refreshFiles();
    setStatus('已设置目录');
  } catch (error) {
    if (error?.name !== 'AbortError') {
      setStatus(error.message || '设置目录失败');
    }
  } finally {
    renderToolbar();
  }
}

async function toggleFileList() {
  const nextOpen = fileListPanel.hidden;

  fileListPanel.hidden = !nextOpen;
  directoryLabel.setAttribute('aria-expanded', String(nextOpen));

  if (nextOpen) {
    await loadFilesForList();
  }
}

fileList.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]');

  if (!button) {
    return;
  }

  const fileName = button.dataset.fileName;
  const action = button.dataset.action;

  if (action === 'open') {
    await openFile(fileName);
  }

  if (action === 'rename') {
    openRenameDialog(fileName);
  }

  if (action === 'delete') {
    await deleteFileFromList(fileName);
  }
});

saveNewButton.addEventListener('click', async () => {
  await saveAsNewFile();
});

saveButton.addEventListener('click', async () => {
  currentContent = editor.get();
  const text = contentToText(currentContent);

  saveDraft(localStorage, text);

  if (!directoryHandle) {
    downloadJsonText(text);
    setStatus('已下载');
    return;
  }

  if (!currentFileName) {
    await saveAsNewFile();
    return;
  }

  try {
    if (!(await ensureHandlePermission(currentFileHandle ?? directoryHandle, 'readwrite'))) {
      setStatus('目录未授权');
      return;
    }

    if (!currentFileHandle) {
      currentFileHandle = await directoryHandle.getFileHandle(currentFileName);
    }

    await writeFileHandle(currentFileHandle, text);
    await refreshFiles();
    setStatus(`已保存 ${currentFileName}`);
  } catch (error) {
    setStatus(error.message || '保存失败');
  }
});

deleteCurrentButton.addEventListener('click', async () => {
  if (!currentFileName || !directoryHandle) {
    return;
  }

  if (!confirm(`删除 ${currentFileName}？`)) {
    return;
  }

  try {
    if (!(await ensureHandlePermission(directoryHandle, 'readwrite'))) {
      setStatus('目录未授权');
      return;
    }

    await deleteJsonFile(directoryHandle, currentFileName);
    currentFileHandle = null;
    currentFileName = '';
    await refreshFiles();
    setStatus('已删除文件');
  } catch (error) {
    setStatus(error.message || '删除失败');
  }
});

renameCancelButton.addEventListener('click', () => {
  closeRenameDialog();
});

renameForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  await renameCurrentTarget();
});

document.addEventListener('click', (event) => {
  if (fileListPanel.hidden || event.target.closest('.file-list-wrap')) {
    return;
  }

  closeFileList();
});

init();

function updateStatus(text) {
  saveStatus.textContent = isJsonText(text) ? '已自动记录' : 'JSON 未完成';
}

function setStatus(message) {
  saveStatus.textContent = message;
}

async function restoreStoredDirectory() {
  if (!supportsDirectoryAccess(window)) {
    return;
  }

  const session = await restoreDirectorySession(loadStoredDirectoryHandle, queryHandlePermission);

  directoryHandle = session.handle;

  if (session.shouldLoadFiles) {
    await refreshFiles();
  }
}

async function refreshFiles() {
  files = await listJsonFiles(directoryHandle);
  filesLoaded = true;
  renderToolbar();
}

async function loadFilesForList() {
  if (!directoryHandle || filesLoaded) {
    return;
  }

  if (!(await ensureHandlePermission(directoryHandle, 'read'))) {
    setStatus('目录未授权');
    renderToolbar();
    return;
  }

  await refreshFiles();
}

function renderToolbar() {
  const directorySupported = supportsDirectoryAccess(window);
  const dirText = directoryLabel.querySelector('.dir-text');

  dirText.textContent = directorySupported ? getDisplayDirectoryName(directoryHandle) : '目录不可用';
  deleteCurrentButton.disabled = !directoryHandle || !currentFileName;

  renderFileList();
}

function renderFileList() {
  fileList.replaceChildren();

  const emptyMessage = getFileListEmptyMessage({
    directoryHandle,
    filesLoaded,
    filesCount: files.length
  });

  if (emptyMessage) {
    fileList.append(createEmptyRow(emptyMessage));
    return;
  }

  for (const file of files) {
    const row = document.createElement('div');
    const openButton = document.createElement('button');
    const renameButton = document.createElement('button');
    const deleteButton = document.createElement('button');

    row.className = file.name === currentFileName ? 'file-row is-active' : 'file-row';
    row.setAttribute('role', 'option');
    row.setAttribute('aria-selected', String(file.name === currentFileName));

    openButton.className = 'file-name-button';
    openButton.type = 'button';
    openButton.dataset.action = 'open';
    openButton.dataset.fileName = file.name;
    openButton.title = `打开 ${file.name}`;
    openButton.textContent = file.name;

    renameButton.className = 'icon-button';
    renameButton.type = 'button';
    renameButton.dataset.action = 'rename';
    renameButton.dataset.fileName = file.name;
    renameButton.setAttribute('aria-label', `重命名 ${file.name}`);
    renameButton.title = '重命名';
    renameButton.textContent = '✎';

    deleteButton.className = 'icon-button danger-icon';
    deleteButton.type = 'button';
    deleteButton.dataset.action = 'delete';
    deleteButton.dataset.fileName = file.name;
    deleteButton.setAttribute('aria-label', `删除 ${file.name}`);
    deleteButton.title = '删除';
    deleteButton.textContent = '×';

    row.append(openButton, renameButton, deleteButton);
    fileList.append(row);
  }
}

function createEmptyRow(message) {
  const row = document.createElement('div');

  row.className = 'empty-row';
  row.textContent = message;

  return row;
}

async function openFile(fileName) {
  const file = files.find((item) => item.name === fileName);

  if (!file) {
    setStatus('文件不存在');
    return;
  }

  try {
    if (!(await ensureHandlePermission(file.handle, 'read'))) {
      setStatus('文件未授权');
      return;
    }

    const text = await readFileText(file.handle);

    currentFileHandle = file.handle;
    currentFileName = file.name;
    currentContent = { text };
    editor.set(currentContent);
    saveDraft(localStorage, text);
    closeFileList();
    renderToolbar();
    setStatus(`已打开 ${file.name}`);
  } catch (error) {
    setStatus(error.message || '打开失败');
  }
}

async function saveAsNewFile() {
  currentContent = editor.get();
  const text = contentToText(currentContent);

  saveDraft(localStorage, text);

  if (!directoryHandle && supportsDirectoryAccess(window)) {
    try {
      directoryHandle = await selectDirectory(window);
      if (!(await ensureHandlePermission(directoryHandle, 'readwrite'))) {
        setStatus('目录未授权');
        return;
      }
      filesLoaded = false;
      await saveStoredDirectoryHandle(directoryHandle);
    } catch (error) {
      if (error?.name !== 'AbortError') {
        setStatus(error.message || '设置目录失败');
      }
      return;
    }
  }

  if (!directoryHandle) {
    downloadJsonText(text);
    setStatus('已下载');
    return;
  }

  try {
    if (!(await ensureHandlePermission(directoryHandle, 'readwrite'))) {
      setStatus('目录未授权');
      return;
    }

    currentFileName = createJsonFilename();
    currentFileHandle = await writeJsonFile(directoryHandle, currentFileName, text);
    await refreshFiles();
    setStatus(`已新建 ${currentFileName}`);
  } catch (error) {
    setStatus(error.message || '新建保存失败');
  }
}

async function deleteFileFromList(fileName) {
  if (!directoryHandle || !confirm(`删除 ${fileName}？`)) {
    return;
  }

  try {
    if (!(await ensureHandlePermission(directoryHandle, 'readwrite'))) {
      setStatus('目录未授权');
      return;
    }

    await deleteJsonFile(directoryHandle, fileName);

    if (fileName === currentFileName) {
      currentFileHandle = null;
      currentFileName = '';
    }

    await refreshFiles();
    setStatus(`已删除 ${fileName}`);
  } catch (error) {
    setStatus(error.message || '删除失败');
  }
}

function openRenameDialog(fileName) {
  renameTargetName = fileName;
  renameInput.value = fileName;

  if (typeof renameDialog.showModal === 'function') {
    renameDialog.showModal();
    renameInput.select();
    return;
  }

  const nextName = prompt('文件名', fileName);

  if (nextName) {
    renameInput.value = nextName;
    renameCurrentTarget();
  }
}

function closeRenameDialog() {
  renameTargetName = '';

  if (renameDialog.open) {
    renameDialog.close();
  }
}

async function renameCurrentTarget() {
  if (!directoryHandle || !renameTargetName) {
    closeRenameDialog();
    return;
  }

  try {
    if (!(await ensureHandlePermission(directoryHandle, 'readwrite'))) {
      setStatus('目录未授权');
      return;
    }

    const nextHandle = await renameJsonFile(directoryHandle, renameTargetName, renameInput.value);
    const nextName = nextHandle.name;

    if (renameTargetName === currentFileName) {
      currentFileHandle = nextHandle;
      currentFileName = nextName;
    }

    await refreshFiles();
    setStatus(`已重命名为 ${nextName}`);
    closeRenameDialog();
  } catch (error) {
    setStatus(error.message || '重命名失败');
  }
}

function closeFileList() {
  fileListPanel.hidden = true;
  directoryLabel.setAttribute('aria-expanded', 'false');
}

async function init() {
  await restoreStoredDirectory();
  updateStatus(contentToText(currentContent));
  renderToolbar();
}
