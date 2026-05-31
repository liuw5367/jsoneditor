export function createJsonFilename(date = new Date()) {
  const stamp = date.toISOString().replace(/\.\d{3}Z$/, '').replace('T', '-').replaceAll(':', '');

  return `json-${stamp}.json`;
}

export function createJsonBlobParts(text) {
  return [text.endsWith('\n') ? text : `${text}\n`];
}

export function downloadJsonText(text, documentRef = globalThis.document, urlRef = globalThis.URL) {
  const blob = new Blob(createJsonBlobParts(text), {
    type: 'application/json;charset=utf-8'
  });
  const objectUrl = urlRef.createObjectURL(blob);
  const link = documentRef.createElement('a');

  link.href = objectUrl;
  link.download = createJsonFilename();
  link.rel = 'noopener';
  link.click();
  urlRef.revokeObjectURL(objectUrl);
}
