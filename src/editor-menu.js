const PREFERRED_ACTION_TITLES = ['Format JSON:', 'Compact JSON:', 'Expand all', 'Collapse all'];
const ACTION_LABELS = new Map([
  ['Format JSON:', '格式化'],
  ['Compact JSON:', '单行']
]);

export function reorderEditorMenu(items, { mode, onSmartFormat } = {}) {
  const preferredActionEntries = PREFERRED_ACTION_TITLES.flatMap((title) => {
    const item = items.find((candidate) => candidate.type === 'button' && candidate.title?.startsWith(title));

    return item ? [{ item, title }] : [];
  });
  const preferredActions = preferredActionEntries.flatMap(({ item, title }) => {
    const action = {
      ...item,
      ...(ACTION_LABELS.has(title) ? { text: ACTION_LABELS.get(title) } : {})
    };

    if (title === 'Compact JSON:') {
      const smartFormatAction = mode === 'text' && onSmartFormat
        ? [{
            type: 'button',
            text: '智能格式化',
            title: '智能格式化 JSON (Ctrl+J)',
            className: 'jse-format-smart',
            onClick: onSmartFormat,
            disabled: item.disabled
          }]
        : [];

      return [...smartFormatAction, action, { type: 'separator' }];
    }

    return [action];
  });
  const preferredActionItems = preferredActionEntries.map(({ item }) => item);
  const remainingItems = items.filter((item) => !preferredActionItems.includes(item));
  const lastModeIndex = remainingItems.findLastIndex(
    (item) => item.type === 'button' && item.title?.startsWith('Switch to ') && item.title.includes(' mode')
  );
  const insertionIndex = lastModeIndex + 1;

  return [
    ...remainingItems.slice(0, insertionIndex),
    ...preferredActions,
    ...remainingItems.slice(insertionIndex)
  ].filter((item, index, reorderedItems) => {
    return item.type !== 'separator' || reorderedItems[index - 1]?.type !== 'separator';
  });
}
