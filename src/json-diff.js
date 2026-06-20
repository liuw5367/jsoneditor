import { create } from 'jsondiffpatch';

const diffPatcher = create({
  arrays: {
    detectMove: false,
    includeValueOnMove: false
  }
});

export function compareJsonTexts(leftText, rightText) {
  const leftResult = parseJson(leftText);
  const rightResult = parseJson(rightText);

  if (!leftResult.valid || !rightResult.valid) {
    return {
      valid: false,
      errors: {
        left: leftResult.valid ? '' : '原始 JSON 无效',
        right: rightResult.valid ? '' : '目标 JSON 无效'
      }
    };
  }

  const differences = coalesceReplacements(normalizeDelta(diffPatcher.diff(leftResult.value, rightResult.value)));
  differences.sort((a, b) => formatPath(a.path).localeCompare(formatPath(b.path)));

  return {
    valid: true,
    differences,
    counts: differences.reduce(
      (counts, difference) => {
        counts[difference.type] += 1;
        return counts;
      },
      { added: 0, removed: 0, changed: 0 }
    )
  };
}

export function formatJsonPath(path) {
  if (path.length === 0) {
    return '$';
  }

  return `$${path
    .map((part) => (typeof part === 'number' ? `[${part}]` : `.${part}`))
    .join('')}`;
}

function parseJson(text) {
  try {
    return { valid: true, value: JSON.parse(text) };
  } catch {
    return { valid: false };
  }
}

function normalizeDelta(delta, path = []) {
  if (delta === undefined) {
    return [];
  }

  if (Array.isArray(delta)) {
    if (delta.length === 1) {
      return [{ path, type: 'added', left: undefined, right: delta[0] }];
    }

    if (delta.length === 3 && delta[1] === 0 && delta[2] === 0) {
      return [{ path, type: 'removed', left: delta[0], right: undefined }];
    }

    return [{ path, type: 'changed', left: delta[0], right: delta[1] }];
  }

  const isArrayDelta = delta._t === 'a';

  return Object.entries(delta).flatMap(([key, childDelta]) => {
    if (key === '_t') {
      return [];
    }

    const normalizedKey = isArrayDelta ? Number(key.replace(/^_/, '')) : key;
    return normalizeDelta(childDelta, [...path, normalizedKey]);
  });
}

function coalesceReplacements(differences) {
  const consumed = new Set();
  const result = [];

  for (let index = 0; index < differences.length; index += 1) {
    if (consumed.has(index)) {
      continue;
    }

    const difference = differences[index];
    if (difference.type === 'changed') {
      result.push(difference);
      continue;
    }

    const oppositeType = difference.type === 'added' ? 'removed' : 'added';
    const oppositeIndex = differences.findIndex(
      (candidate, candidateIndex) =>
        candidateIndex !== index &&
        !consumed.has(candidateIndex) &&
        candidate.type === oppositeType &&
        JSON.stringify(candidate.path) === JSON.stringify(difference.path)
    );

    if (oppositeIndex === -1) {
      result.push(difference);
      continue;
    }

    const opposite = differences[oppositeIndex];
    const added = difference.type === 'added' ? difference : opposite;
    const removed = difference.type === 'removed' ? difference : opposite;

    consumed.add(oppositeIndex);
    result.push({
      path: difference.path,
      type: 'changed',
      left: removed.left,
      right: added.right
    });
  }

  return result;
}

function formatPath(path) {
  return path.map(String).join('\u0000');
}
