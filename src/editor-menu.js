const PREFERRED_ACTION_TITLES = ['Format JSON:', 'Compact JSON:', 'Expand all', 'Collapse all'];
const ACTION_LABELS = new Map([
  ['Format JSON:', '格式化'],
  ['Compact JSON:', '单行']
]);
const SMART_FORMAT_ICON = {
  prefix: 'fas',
  iconName: 'format-smart',
  icon: [
    512,
    512,
    [],
    'e000',
    'm 448,512 -15,-49 -49,-15 49,-15 15,-49 15,49 49,15 -45,15 zM 335,512 294,376 156,335 292,294 333,156 374,292 512,333 376,374 Z M 0,32 V 96 H 512 V 32 Z M 0,288 v 64 h 128 v -64 Z M 0,160 v 64 h 256 v -64 Z'
  ]
};

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
            icon: SMART_FORMAT_ICON,
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
