// Row math for VirtualTable. It has no React or DOM imports, so it can be checked on its own.
// Rows are ROW_HEIGHT tall. The open row (expandedIndex) has a strip of detailHeight px under it, and every row below it sits that much lower.

// Row height of the data rows, fixed by ".table-wrapper tbody tr" in base.css, so the row math matches what is drawn.
// The open row's strip is not this height, so its measured height is added wherever the math passes it.
export const ROW_HEIGHT = 28;
// Rows rendered above and below the viewport, so quick scrolling does not show blank space
export const BUFFER = 8;

// Top of a row in the list, counting the open row's strip when the row is below it
export function rowTopFor(index: number, expandedIndex: number, detailHeight: number): number {
  return index * ROW_HEIGHT + (expandedIndex !== -1 && index > expandedIndex ? detailHeight : 0);
}

// The row under a scroll offset. Above the strip rows are plain. Inside the strip the row is the open row, so it and its
// strip stay rendered. Past the strip rows sit detailHeight lower.
function rowAt(scrollTop: number, expandedIndex: number, detailHeight: number): number {
  const stripTop = (expandedIndex + 1) * ROW_HEIGHT;
  if (expandedIndex === -1 || scrollTop < stripTop) return Math.floor(scrollTop / ROW_HEIGHT);
  if (scrollTop < stripTop + detailHeight) return expandedIndex;
  return Math.floor((scrollTop - detailHeight) / ROW_HEIGHT);
}

// First rendered row for a scroll offset, with the buffer above it
export function windowStartFor(scrollTop: number, expandedIndex: number, detailHeight: number): number {
  return Math.max(0, rowAt(scrollTop, expandedIndex, detailHeight) - BUFFER);
}

// The row a navigation key moves to, clamped to the list, or null when the key is not a navigation key
export function moveTarget(key: string, index: number, page: number, count: number): number | null {
  let target: number;
  switch (key) {
    case "ArrowUp":
      target = index - 1;
      break;
    case "ArrowDown":
      target = index + 1;
      break;
    case "PageUp":
      target = index - page;
      break;
    case "PageDown":
      target = index + page;
      break;
    case "Home":
      target = 0;
      break;
    case "End":
      target = count - 1;
      break;
    default:
      return null;
  }
  return Math.min(count - 1, Math.max(0, target));
}
