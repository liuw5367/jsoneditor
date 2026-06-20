export function filterDifferences(differences, type) {
  if (!type) {
    return [];
  }

  return differences.filter((difference) => difference.type === type);
}

export function toggleDifferenceFilter(activeType, nextType, count) {
  if (count === 0 || activeType === nextType) {
    return '';
  }

  return nextType;
}
