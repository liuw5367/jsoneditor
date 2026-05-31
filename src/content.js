export const DRAFT_KEY = 'clean-json-editor:draft';
export const DEFAULT_CONTENT_TEXT = '{\n  \n}';

export function formatJsonText(text) {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

export function isJsonText(text) {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

export function contentToText(content) {
  if (content && typeof content.text === 'string') {
    return content.text;
  }

  if (content && Object.hasOwn(content, 'json')) {
    return JSON.stringify(content.json, null, 2);
  }

  return '';
}

export function readDraft(storage = globalThis.localStorage) {
  try {
    return storage.getItem(DRAFT_KEY) ?? '';
  } catch {
    return '';
  }
}

export function saveDraft(storage = globalThis.localStorage, text) {
  try {
    storage.setItem(DRAFT_KEY, text);
  } catch {
    // Private windows or locked-down browser policies can block localStorage.
  }
}

export function getInitialContent(storage = globalThis.localStorage) {
  const draft = readDraft(storage);

  return {
    text: draft || DEFAULT_CONTENT_TEXT
  };
}
