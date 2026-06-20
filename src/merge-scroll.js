export function getSyncedScrollTop({
  sourceTop,
  sourceScrollHeight,
  sourceClientHeight,
  targetScrollHeight,
  targetClientHeight
}) {
  const sourceRange = sourceScrollHeight - sourceClientHeight;
  const targetRange = Math.max(0, targetScrollHeight - targetClientHeight);

  if (sourceRange <= 0 || targetRange === 0) {
    return 0;
  }

  return (sourceTop / sourceRange) * targetRange;
}

export function synchronizeScroll(leftScroller, rightScroller) {
  let syncing = false;

  function sync(source, target) {
    if (syncing) {
      return;
    }

    syncing = true;
    target.scrollTop = getSyncedScrollTop({
      sourceTop: source.scrollTop,
      sourceScrollHeight: source.scrollHeight,
      sourceClientHeight: source.clientHeight,
      targetScrollHeight: target.scrollHeight,
      targetClientHeight: target.clientHeight
    });
    target.scrollLeft = source.scrollLeft;

    requestAnimationFrame(() => {
      syncing = false;
    });
  }

  leftScroller.addEventListener('scroll', () => sync(leftScroller, rightScroller), { passive: true });
  rightScroller.addEventListener('scroll', () => sync(rightScroller, leftScroller), { passive: true });
}
