import { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type ReactNode, type Ref, type UIEvent } from "react";
import "./ui.css";

export interface Column<T> {
  key: string;
  label: string;
  // Hover text on the header, shown by tooltip.ts
  tip?: string;
  // Plain text of the cell. It sizes the column and is the cell content unless render is given. Empty text shows "-".
  text: (row: T) => string;
  // Replaces the cell content, e.g. icons or colored spans. The column is still sized from text.
  render?: (row: T) => ReactNode;
  // Fixed width in px instead of measuring the text. Use it for icon columns.
  width?: number;
  // Extra px added to the measured text, for spans or padding the text does not show (e.g. a score's colored blocks)
  pad?: number;
}

export interface VirtualTableHandle {
  // Scrolls the row near the middle of the viewport and renders it
  scrollToRow: (index: number) => void;
}

interface VirtualTableProps<T> {
  // Keep rows and columns memoized. A new rows array resets the scroll to the top, and a new columns array re-measures every column.
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  rowClassName?: (row: T, index: number) => string;
  className?: string;
  ref?: Ref<VirtualTableHandle>;
}

// Fixed by ".table-wrapper tbody tr" in base.css, so the row math matches what is drawn
const ROW_HEIGHT = 28;
// Rows rendered above and below the viewport, so quick scrolling does not show blank space
const BUFFER = 8;
// Used until the wrapper has a height, e.g. while its tab is hidden
const FALLBACK_VIEWPORT = 400;
// Left and right padding of each cell in base.css
const CELL_PADDING = 16;
// Wider columns are clipped by the cell's overflow hidden instead of stretching the table
const MAX_COLUMN_WIDTH = 400;

// The font parts of an element in the form canvas.font takes
function fontOf(element: Element): string {
  const style = getComputedStyle(element);
  return `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
}

// What a cell shows as plain text. Empty text shows a dash.
function cellText<T>(column: Column<T>, row: T): string {
  return column.text(row) || "-";
}

// Widest header or cell text per column, so widths hold still while scrolling. Runs once per rows or columns change,
// never on scroll. Rows often share a text (a mode, a result, a date), so each distinct text is looked at once, and
// its body width is kept per column in cachedWidths until the fonts change. In a proportional font the character count
// does not determine width, so each distinct text is measured once per column and font version.
function measureColumns<T>(
  table: HTMLTableElement,
  columns: Column<T>[],
  rows: T[],
  cachedWidths: Map<string, Map<string, number>>
): number[] {
  const header = table.querySelector("th");
  if (!header) return [];
  const context = document.createElement("canvas").getContext("2d");
  if (!context) throw new Error("Canvas 2D is needed to size the table columns");

  const headerFont = fontOf(header);
  const bodyFont = fontOf(table);
  return columns.map((column) => {
    if (column.width !== undefined) return column.width;
    const padding = CELL_PADDING + (column.pad ?? 0);
    // Headers are uppercased by the stylesheet, so they are measured uppercase
    context.font = headerFont;
    let widest = context.measureText(column.label.toUpperCase()).width;
    context.font = bodyFont;

    const texts = new Set<string>();
    for (const row of rows) texts.add(cellText(column, row));
    let known = cachedWidths.get(column.key);
    if (!known) {
      known = new Map<string, number>();
      cachedWidths.set(column.key, known);
    }
    for (const text of texts) {
      // Once a column reaches the cap, a wider text cannot change its width
      if (Math.ceil(widest) + padding >= MAX_COLUMN_WIDTH) break;
      let width = known.get(text);
      if (width === undefined) {
        width = context.measureText(text).width;
        known.set(text, width);
      }
      widest = Math.max(widest, width);
    }
    return Math.min(MAX_COLUMN_WIDTH, Math.ceil(widest) + padding);
  });
}

// First rendered row for a scroll offset, with the buffer above it
function windowStartFor(scrollTop: number): number {
  return Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - BUFFER);
}

export function VirtualTable<T>({ rows, columns, rowKey, rowClassName, className, ref }: VirtualTableProps<T>) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  // Scrolling re-renders only when the first visible row changes. The viewport height changes only on resize.
  const [windowStart, setWindowStart] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [widths, setWidths] = useState<number[]>([]);
  // A new object per call, so asking for the same row twice still scrolls to it
  const [scrollRequest, setScrollRequest] = useState<{ index: number } | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      scrollToRow: (index: number) => setScrollRequest({ index }),
    }),
    []
  );

  // A new data set starts at the top. Layout effects run before paint, so the first frame already shows the top.
  useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    wrapper.scrollTop = 0;
    setWindowStart(0);
  }, [rows]);

  // The TF2 fonts swap in after first paint, so widths measured before then use fallback metrics. Each font
  // arrival bumps fontsVersion, which remeasures. Scrolling never changes it.
  const [fontsVersion, setFontsVersion] = useState(0);
  // Body widths for the current fonts. A new fonts version starts an empty cache, since every width may change.
  const widthCache = useRef({ version: -1, widths: new Map<string, Map<string, number>>() });
  useEffect(() => {
    let mounted = true;
    const remeasure = () => setFontsVersion((version) => version + 1);
    document.fonts.ready.then(() => {
      if (mounted) remeasure();
    });
    document.fonts.addEventListener("loadingdone", remeasure);
    return () => {
      mounted = false;
      document.fonts.removeEventListener("loadingdone", remeasure);
    };
  }, []);

  useLayoutEffect(() => {
    const table = tableRef.current;
    if (!table) return;
    if (widthCache.current.version !== fontsVersion) {
      widthCache.current = { version: fontsVersion, widths: new Map<string, Map<string, number>>() };
    }
    setWidths(measureColumns(table, columns, rows, widthCache.current.widths));
  }, [rows, columns, fontsVersion]);

  // Declared after the reset, so a request made in the same batch as a new data set still lands on its row
  useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    if (!scrollRequest || !wrapper) return;
    const offset = scrollRequest.index * ROW_HEIGHT - (wrapper.clientHeight - ROW_HEIGHT) / 2;
    wrapper.scrollTop = Math.max(0, offset);
    setWindowStart(windowStartFor(wrapper.scrollTop));
  }, [scrollRequest]);

  // A table built in a hidden tab gets its height when the tab opens, and no scroll event fires for that
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const observer = new ResizeObserver(() => setViewportHeight(wrapper.clientHeight));
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, []);

  function handleScroll(event: UIEvent<HTMLDivElement>) {
    setWindowStart(windowStartFor(event.currentTarget.scrollTop));
  }

  // Rows outside the window are replaced by two spacer rows, so the scrollbar covers the whole list
  const visibleCount = Math.ceil((viewportHeight || FALLBACK_VIEWPORT) / ROW_HEIGHT) + BUFFER * 2;
  const end = Math.min(rows.length, windowStart + visibleCount);
  const topPad = windowStart * ROW_HEIGHT;
  const bottomPad = Math.max(0, (rows.length - end) * ROW_HEIGHT);
  const visible = rows.slice(windowStart, end);

  return (
    <div
      ref={wrapperRef}
      className={className ? `table-wrapper ${className}` : "table-wrapper"}
      onScroll={handleScroll}
    >
      <table ref={tableRef} className="vt-table">
        <colgroup>
          {columns.map((column, i) => (
            <col key={column.key} style={{ width: widths[i] }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} data-tip={column.tip}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="vt-spacer" style={{ height: topPad }}>
            <td colSpan={columns.length} />
          </tr>
          {visible.map((row, offset) => {
            const index = windowStart + offset;
            return (
              <tr key={rowKey(row)} className={rowClassName?.(row, index)}>
                {columns.map((column) => (
                  <td key={column.key}>{column.render ? column.render(row) : cellText(column, row)}</td>
                ))}
              </tr>
            );
          })}
          <tr className="vt-spacer" style={{ height: bottomPad }}>
            <td colSpan={columns.length} />
          </tr>
        </tbody>
      </table>
    </div>
  );
}
