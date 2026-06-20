export function getToolbarState(currentFileName) {
  const fileName = currentFileName || '';
  const hasCurrentFile = Boolean(fileName);

  return {
    fileName,
    hasCurrentFile,
    showSaveNew: true,
    showSave: hasCurrentFile,
    showDelete: hasCurrentFile
  };
}
