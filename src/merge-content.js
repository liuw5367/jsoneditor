export function formatMergeContent(text) {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

export function replaceMergeDocument(state, text) {
  return {
    changes: {
      from: 0,
      to: state.doc.length,
      insert: text
    }
  };
}
