import { createJSONEditor, Mode } from 'vanilla-jsoneditor';
import { json } from '@codemirror/lang-json';
import { MergeView } from '@codemirror/merge';
import { EditorView, lineNumbers } from '@codemirror/view';
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
import { filterDifferences, toggleDifferenceFilter } from './difference-filter.js';
import { reorderEditorMenu } from './editor-menu.js';
import { compareJsonTexts, formatJsonPath } from './json-diff.js';
import { formatMergeContent, replaceMergeDocument } from './merge-content.js';
import { synchronizeScroll } from './merge-scroll.js';
import {
  formatJsonSmart,
  loadSmartFormatLineLength,
  saveSmartFormatLineLength
} from './smart-format.js';
import { getToolbarState } from './toolbar-state.js';

const editorTarget = document.querySelector('#editor');
const directoryLabel = document.querySelector('#directory-label');
const directoryEditButton = document.querySelector('#directory-edit-button');
const currentFileLabel = document.querySelector('#current-file-label');
const fileListPanel = document.querySelector('#file-list-panel');
const fileList = document.querySelector('#file-list');
const saveButton = document.querySelector('#save-button');
const saveNewButton = document.querySelector('#save-new-button');
const deleteCurrentButton = document.querySelector('#delete-current-button');
const saveStatus = document.querySelector('#save-status');
const settingsButton = document.querySelector('#settings-button');
const settingsDialog = document.querySelector('#settings-dialog');
const settingsForm = document.querySelector('#settings-form');
const settingsInput = document.querySelector('#smart-format-line-length');
const settingsError = document.querySelector('#settings-error');
const settingsCancelButton = document.querySelector('#settings-cancel-button');
const renameDialog = document.querySelector('#rename-dialog');
const renameForm = document.querySelector('#rename-form');
const renameInput = document.querySelector('#rename-input');
const renameCancelButton = document.querySelector('#rename-cancel-button');
const editModeButton = document.querySelector('#edit-mode-button');
const compareModeButton = document.querySelector('#compare-mode-button');
const editWorkspace = document.querySelector('#edit-workspace');
const compareWorkspace = document.querySelector('#compare-workspace');
const compareTopbarActions = document.querySelector('#compare-topbar-actions');
const compareMessage = document.querySelector('#compare-message');
const compareMergeTarget = document.querySelector('#compare-merge-editor');
const compareLeftFile = document.querySelector('#compare-left-file');
const compareRightFile = document.querySelector('#compare-right-file');
const swapCompareButton = document.querySelector('#swap-compare-button');
const applyCompareButton = document.querySelector('#apply-compare-button');
const differenceCounts = document.querySelector('#difference-counts');
const differencePanel = document.querySelector('#difference-panel');
const differenceList = document.querySelector('#difference-list');
const differenceCountButtons = [...differenceCounts.querySelectorAll('[data-difference-type]')];

let currentContent = getInitialContent();
let directoryHandle = null;
let currentFileHandle = null;
let currentFileName = '';
let files = [];
let filesLoaded = false;
let renameTargetName = '';
let compareInitialized = false;
let compareResult = null;
let activeDifferenceFilter = '';
let smartFormatLineLength = loadSmartFormatLineLength();

const editor = createJSONEditor({
  target: editorTarget,
  props: {
    content: currentContent,
    mode: Mode.text,
    mainMenuBar: true,
    navigationBar: false,
    statusBar: true,
    askToFormat: false,
    onRenderMenu(items, context) {
      return reorderEditorMenu(items, {
        mode: context.mode,
        onSmartFormat: smartFormatCurrentContent
      });
    },
    onChange(updatedContent) {
      currentContent = updatedContent;
      const text = contentToText(updatedContent);

      saveDraft(localStorage, text);
      updateStatus(text);
    }
  }
});

const mergeEditorExtensions = [
  lineNumbers(),
  json(),
  EditorView.lineWrapping,
  EditorView.updateListener.of((update) => {
    if (update.docChanged) {
      renderComparison();
    }
  })
];

const compareMergeEditor = new MergeView({
  a: { doc: '{}', extensions: mergeEditorExtensions },
  b: { doc: '{}', extensions: mergeEditorExtensions },
  parent: compareMergeTarget,
  orientation: 'a-b',
  highlightChanges: true,
  gutter: true
});

synchronizeScroll(compareMergeEditor.a.scrollDOM, compareMergeEditor.b.scrollDOM);

settingsButton.addEventListener('click', openSettingsDialog);
settingsCancelButton.addEventListener('click', () => settingsDialog.close());
settingsInput.addEventListener('input', clearSettingsError);
settingsForm.addEventListener('submit', saveSettings);
editorTarget.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'j') {
    event.preventDefault();
    event.stopPropagation();
    void smartFormatCurrentContent();
  }
}, true);

editModeButton.addEventListener('click', () => switchWorkspace('edit'));
compareModeButton.addEventListener('click', () => switchWorkspace('compare'));
swapCompareButton.addEventListener('click', swapCompareContents);
applyCompareButton.addEventListener('click', applyRightComparison);
compareLeftFile.addEventListener('change', () => loadFileIntoComparison(compareLeftFile, compareMergeEditor.a));
compareRightFile.addEventListener('change', () => loadFileIntoComparison(compareRightFile, compareMergeEditor.b));
differenceCounts.addEventListener('click', (event) => {
  const button = event.target.closest('[data-difference-type]');

  if (!button) {
    return;
  }

  const type = button.dataset.differenceType;
  const count = compareResult?.valid ? compareResult.counts[type] : 0;

  activeDifferenceFilter = toggleDifferenceFilter(activeDifferenceFilter, type, count);
  renderDifferencePopover();
});

directoryLabel.addEventListener('click', () => {
  void toggleFileList();
});

directoryEditButton.addEventListener('click', () => {
  void selectDirectoryHandler();
});

async function smartFormatCurrentContent() {
  const content = editor.get();
  const text = contentToText(content);

  try {
    const formattedText = await formatJsonSmart(text, {
      indentation: 2,
      maxLineLength: smartFormatLineLength
    });

    editor.update({ text: formattedText });
    setStatus(`已智能格式化，最大行宽 ${smartFormatLineLength}`);
  } catch {
    setStatus('智能格式化失败，请检查 JSON');
  }
}

function openSettingsDialog() {
  settingsInput.value = String(smartFormatLineLength);
  clearSettingsError();
  settingsDialog.showModal();
  settingsInput.focus();
  settingsInput.select();
}

function saveSettings(event) {
  event.preventDefault();

  try {
    smartFormatLineLength = saveSmartFormatLineLength(localStorage, settingsInput.value);
    settingsDialog.close();
    setStatus(`智能格式化行宽已设为 ${smartFormatLineLength}`);
  } catch (error) {
    settingsError.textContent = error.message;
    settingsError.hidden = false;
    settingsInput.focus();
  }
}

function clearSettingsError() {
  settingsError.textContent = '';
  settingsError.hidden = true;
}

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
  if (!fileListPanel.hidden && !event.target.closest('.file-list-wrap')) {
    closeFileList();
  }

  if (!differencePanel.hidden && !event.target.closest('.difference-menu')) {
    closeDifferencePopover();
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') {
    return;
  }

  closeFileList();
  closeDifferencePopover();
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
  const toolbarState = getToolbarState(currentFileName);

  dirText.textContent = directorySupported ? getDisplayDirectoryName(directoryHandle) : '目录不可用';
  currentFileLabel.textContent = toolbarState.fileName;
  currentFileLabel.title = toolbarState.fileName;
  currentFileLabel.hidden = !toolbarState.hasCurrentFile;
  saveNewButton.hidden = !toolbarState.showSaveNew;
  saveButton.hidden = !toolbarState.showSave;
  deleteCurrentButton.hidden = !toolbarState.showDelete;
  deleteCurrentButton.disabled = !directoryHandle || !toolbarState.hasCurrentFile;

  renderFileList();
  renderCompareFileOptions();
}

async function switchWorkspace(workspace) {
  const isCompare = workspace === 'compare';

  editWorkspace.hidden = isCompare;
  compareWorkspace.hidden = !isCompare;
  editModeButton.classList.toggle('is-active', !isCompare);
  compareModeButton.classList.toggle('is-active', isCompare);
  editModeButton.setAttribute('aria-pressed', String(!isCompare));
  compareModeButton.setAttribute('aria-pressed', String(isCompare));
  document.querySelector('.actions').hidden = isCompare;
  compareTopbarActions.hidden = !isCompare;

  if (!isCompare) {
    closeDifferencePopover();
    return;
  }

  if (!compareInitialized) {
    currentContent = editor.get();
    setMergeDocument(compareMergeEditor.a, formatMergeContent(contentToText(currentContent)));
    setMergeDocument(compareMergeEditor.b, '{}');
    compareInitialized = true;
  }

  await loadFilesForList();
  renderCompareFileOptions();
  renderComparison();
}

function renderComparison() {
  const leftText = compareMergeEditor.a.state.doc.toString();
  const rightText = compareMergeEditor.b.state.doc.toString();

  compareResult = compareJsonTexts(leftText, rightText);

  if (!compareResult.valid) {
    compareMessage.textContent = [compareResult.errors.left, compareResult.errors.right].filter(Boolean).join('，');
    compareMessage.hidden = false;
    applyCompareButton.disabled = true;
    updateDifferenceCounts({ added: 0, removed: 0, changed: 0 });
    closeDifferencePopover();
    return;
  }

  compareMessage.hidden = true;
  applyCompareButton.disabled = false;
  updateDifferenceCounts(compareResult.counts);

  if (activeDifferenceFilter && compareResult.counts[activeDifferenceFilter] === 0) {
    closeDifferencePopover();
    return;
  }

  renderDifferencePopover();
}

function createDifferenceRow(difference) {
  const row = document.createElement('div');
  const labels = { added: '新增', removed: '删除', changed: '修改' };

  row.className = `difference-row is-${difference.type}`;
  row.setAttribute('role', 'listitem');
  row.textContent = `${labels[difference.type]} ${formatJsonPath(difference.path)}`;
  return row;
}

function updateDifferenceCounts(counts) {
  for (const button of differenceCountButtons) {
    const type = button.dataset.differenceType;
    const count = counts[type];

    button.querySelector('strong').textContent = count;
    button.disabled = count === 0;
  }
}

function renderDifferencePopover() {
  differenceList.replaceChildren();

  for (const button of differenceCountButtons) {
    const isActive = button.dataset.differenceType === activeDifferenceFilter;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-expanded', String(isActive));
  }

  if (!activeDifferenceFilter || !compareResult?.valid) {
    differencePanel.hidden = true;
    return;
  }

  for (const difference of filterDifferences(compareResult.differences, activeDifferenceFilter)) {
    differenceList.append(createDifferenceRow(difference));
  }

  differencePanel.hidden = false;
}

function closeDifferencePopover() {
  activeDifferenceFilter = '';
  renderDifferencePopover();
}

function swapCompareContents() {
  const leftContent = compareMergeEditor.a.state.doc.toString();
  const rightContent = compareMergeEditor.b.state.doc.toString();

  setMergeDocument(compareMergeEditor.a, rightContent);
  setMergeDocument(compareMergeEditor.b, leftContent);
  compareLeftFile.value = '';
  compareRightFile.value = '';
  renderComparison();
}

function applyRightComparison() {
  if (!compareResult?.valid) {
    return;
  }

  const text = compareMergeEditor.b.state.doc.toString();
  currentContent = { text };

  editor.set({ text });
  saveDraft(localStorage, text);
  updateStatus(text);
  void switchWorkspace('edit');
}

async function loadFileIntoComparison(select, targetEditor) {
  const file = files.find((item) => item.name === select.value);

  if (!file) {
    return;
  }

  try {
    if (!(await ensureHandlePermission(file.handle, 'read'))) {
      compareMessage.textContent = '文件未授权';
      compareMessage.hidden = false;
      return;
    }

    setMergeDocument(targetEditor, formatMergeContent(await readFileText(file.handle)));
    renderComparison();
  } catch (error) {
    compareMessage.textContent = error.message || '读取文件失败';
    compareMessage.hidden = false;
  }
}

function setMergeDocument(targetEditor, text) {
  targetEditor.dispatch(replaceMergeDocument(targetEditor.state, text));
}

function renderCompareFileOptions() {
  for (const select of [compareLeftFile, compareRightFile]) {
    const selectedName = select.value;

    select.replaceChildren(new Option('从目录载入...', ''));
    for (const file of files) {
      select.append(new Option(file.name, file.name));
    }
    select.value = files.some((file) => file.name === selectedName) ? selectedName : '';
    select.disabled = files.length === 0;
  }
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
