import { Fragment, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode, type Ref, type UIEvent } from "react";
import { BUFFER, ROW_HEIGHT, moveTarget, rowTopFor, windowStartFor } from "./tableWindow";
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
  // Scrolls the row near the middle of the viewport and renders it. With focus, the row is focused once it is rendered.
  scrollToRow: (index: number, options?: { focus?: boolean }) => void;
}

interface VirtualTableProps<T> {
  // Keep rows and columns memoized. A new rows array resets the scroll to the top, and a new columns array re-measures every column.
  rows: T[];
  // Rows the column widths are measured from. Defaults to rows. Pass a stable superset (e.g. every match, unfiltered) so a
  // filter or search never re-measures and widths hold still.
  sizingRows?: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  rowClassName?: (row: T, index: number) => string;
  className?: string;
  ref?: Ref<VirtualTableHandle>;
  // Optional row expansion. Clicking a row, or pressing Enter or Space on it, calls onToggle. The row whose key is
  // expandedKey shows renderDetail in a strip under it. Only one row is open.
  expandedKey?: string | null;
  onToggle?: (row: T) => void;
  renderDetail?: (row: T) => ReactNode;
  // Set when the rows select instead of expand (onToggle picks one). The row whose key is selectedKey gets aria-selected,
  // and rows get no aria-expanded. Leave it unset for expandable rows.
  selectedKey?: string | null;
}

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

// Ends a slide when no transitionend comes, e.g. in a hidden tab. The slides run 180 ms (open) and 220 ms (close).
const SLIDE_FALLBACK_MS = 300;

// True when the OS asks for less motion. Read when it is needed, so the next open or close follows the setting.
export function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

interface DetailStripProps {
  open: boolean;
  // True while this strip is sliding. Any other strip, e.g. one scrolled back into the window, is drawn at its final size.
  sliding: boolean;
  onSlideEnd: () => void;
  // Only the open strip is measured, so a closing strip does not take the measuring ref away from it
  contentRef?: Ref<HTMLDivElement>;
  children: ReactNode;
}

// The strip under a row. It mounts closed and opens on the layout pass after mount, so the open transition starts from 0.
// Its content is measured by contentRef, not the clip, since the clip's height is the animated one.
function DetailStrip({ open, sliding, onSlideEnd, contentRef, children }: DetailStripProps) {
  const slide = useRef<HTMLDivElement>(null);
  // A strip that is not sliding starts at its final state, so it does not animate when the window scrolls back to it
  const [shown, setShown] = useState(open && !sliding);
  useLayoutEffect(() => {
    // Reading the layout applies the closed style first, so the change below animates instead of snapping open
    if (open && sliding) slide.current?.getBoundingClientRect();
    setShown(open);
  }, [open, sliding]);

  return (
    <div
      ref={slide}
      className={shown ? "vt-detail-slide is-open" : "vt-detail-slide"}
      onTransitionEnd={(event) => {
        if (sliding && event.target === event.currentTarget) onSlideEnd();
      }}
    >
      <div className="vt-detail-clip">
        <div ref={contentRef}>{children}</div>
      </div>
    </div>
  );
}

export function VirtualTable<T>({
  rows,
  sizingRows,
  columns,
  rowKey,
  rowClassName,
  className,
  ref,
  expandedKey,
  onToggle,
  renderDetail,
  selectedKey,
}: VirtualTableProps<T>) {
  const selecting = selectedKey !== undefined;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  // Scrolling re-renders only when the first visible row changes. The viewport height changes only on resize.
  const [windowStart, setWindowStart] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [widths, setWidths] = useState<number[]>([]);
  // The open row's strip height. Its fields wrap with the width, so it is measured rather than fixed.
  const [detailHeight, setDetailHeight] = useState(0);
  // A new object per call, so asking for the same row twice still scrolls to it
  const [scrollRequest, setScrollRequest] = useState<{ index: number; focus: boolean } | null>(null);
  // The row to focus once it is rendered, set by a key move or a scroll request with focus
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  // The row Tab lands on. A click, focus or key move sets it. Until then it is the open or selected row, else the first.
  const [activeKey, setActiveKey] = useState<string | null>(null);
  // The open row's place in rows, or -1. It counts toward the scroll height even when its strip is not rendered.
  const expandedIndex = expandedKey == null ? -1 : rows.findIndex((row) => rowKey(row) === expandedKey);
  // The only row with tabIndex 0, so Tab walks out of the table instead of through every rendered row
  const activeIndex = Math.max(0, rows.findIndex((row) => rowKey(row) === (activeKey ?? expandedKey ?? selectedKey)));

  // The strips in motion. opening is the open strip sliding open after a click. closing is a strip sliding shut: after a
  // close, or after a switch away from it, where the new strip opens at the same time. At most one of each.
  const [opening, setOpening] = useState<string | null>(null);
  const [closing, setClosing] = useState<string | null>(null);
  const openKey = expandedKey ?? null;
  const [shownKey, setShownKey] = useState<string | null>(openKey);
  // Compared during render, so a change is seen in the same commit that clears or moves expandedKey and no strip flashes out.
  // The strip that was open slides shut, unless reduced motion asks for an instant change or its row left the list.
  // setClosing replaces any strip still closing, so a click during a slide drops that strip at once.
  if (openKey !== shownKey) {
    setShownKey(openKey);
    const reduced = prefersReducedMotion();
    const leaving = shownKey !== null && !reduced && rows.some((row) => rowKey(row) === shownKey) ? shownKey : null;
    setClosing(leaving);
    setOpening(openKey !== null && !reduced ? openKey : null);
  }
  // Ends a slide the strip does not report, so no strip stays mounted. Each slide gets its own timer.
  useEffect(() => {
    if (opening === null) return;
    const timer = window.setTimeout(() => setOpening(null), SLIDE_FALLBACK_MS);
    return () => window.clearTimeout(timer);
  }, [opening]);
  useEffect(() => {
    if (closing === null) return;
    const timer = window.setTimeout(() => setClosing(null), SLIDE_FALLBACK_MS);
    return () => window.clearTimeout(timer);
  }, [closing]);
  // A strip's slide ended. Clears only the state that names this row, so a late event cannot clear another strip's slide.
  const endSlide = (key: string) => {
    setOpening((current) => (current === key ? null : current));
    setClosing((current) => (current === key ? null : current));
  };

  useImperativeHandle(
    ref,
    () => ({
      scrollToRow: (index: number, options?: { focus?: boolean }) => setScrollRequest({ index, focus: options?.focus ?? false }),
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

  const sizing = sizingRows ?? rows;
  // A visible table measures every column in one pass, so its widths arrive with its rows. A hidden table (a tab that is
  // warming up in idle time) measures one column per frame, so a filter change never holds one task for all the columns.
  useLayoutEffect(() => {
    const table = tableRef.current;
    if (!table) return;
    if (widthCache.current.version !== fontsVersion) {
      widthCache.current = { version: fontsVersion, widths: new Map<string, Map<string, number>>() };
    }
    const cache = widthCache.current.widths;
    if (table.offsetParent !== null) {
      setWidths(measureColumns(table, columns, sizing, cache));
      return;
    }
    if (columns.length === 0) return;
    let index = 0;
    let frame = 0;
    const measureNext = () => {
      // The updater runs after index has moved on, so this step's column is kept in its own constant
      const at = index;
      const [width] = measureColumns(table, columns.slice(at, at + 1), sizing, cache);
      setWidths((previous) => {
        const next = previous.slice();
        next[at] = width;
        return next;
      });
      index += 1;
      if (index < columns.length) frame = requestAnimationFrame(measureNext);
    };
    frame = requestAnimationFrame(measureNext);
    // A new rows or columns set, or unmounting, drops the columns still waiting for their frame
    return () => cancelAnimationFrame(frame);
  }, [sizing, columns, fontsVersion]);

  // Declared after the reset, so a request made in the same batch as a new data set still lands on its row
  useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    if (!scrollRequest || !wrapper) return;
    const offset = rowTopFor(scrollRequest.index, expandedIndex, detailHeight) - (wrapper.clientHeight - ROW_HEIGHT) / 2;
    wrapper.scrollTop = Math.max(0, offset);
    setWindowStart(windowStartFor(wrapper.scrollTop, expandedIndex, detailHeight));
    if (scrollRequest.focus) setFocusIndex(scrollRequest.index);
  }, [scrollRequest]);

  // The window follows the open row and its strip height, so a strip that opens, moves or resizes while the table is
  // scrolled re-places the rows. Runs before paint, like the scroll request above.
  useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    if (wrapper) setWindowStart(windowStartFor(wrapper.scrollTop, expandedIndex, detailHeight));
  }, [expandedIndex, detailHeight]);

  // Focuses the row once the window has rendered it. The window is set in the same batch as focusIndex, so it is there.
  useLayoutEffect(() => {
    if (focusIndex === null) return;
    tableRef.current?.querySelector<HTMLTableRowElement>(`tbody tr[data-index="${focusIndex}"]`)?.focus({ preventScroll: true });
    setFocusIndex(null);
  }, [focusIndex, windowStart]);

  // A table built in a hidden tab gets its height when the tab opens, and no scroll event fires for that
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const observer = new ResizeObserver(() => setViewportHeight(wrapper.clientHeight));
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, []);

  function handleScroll(event: UIEvent<HTMLDivElement>) {
    setWindowStart(windowStartFor(event.currentTarget.scrollTop, expandedIndex, detailHeight));
  }

  // Rows outside the window are replaced by two spacer rows, so the scrollbar covers the whole list
  const visibleCount = Math.ceil((viewportHeight || FALLBACK_VIEWPORT) / ROW_HEIGHT) + BUFFER * 2;
  const end = Math.min(rows.length, windowStart + visibleCount);
  const topPad = windowStart * ROW_HEIGHT + (expandedIndex !== -1 && expandedIndex < windowStart ? detailHeight : 0);
  const bottomPad = Math.max(0, (rows.length - end) * ROW_HEIGHT + (expandedIndex >= end ? detailHeight : 0));
  const visible = rows.slice(windowStart, end);
  const closingIndex = closing === null ? -1 : rows.findIndex((row) => rowKey(row) === closing);

  // Re-measured when the strip mounts or moves to another row, and on each resize of it after that. Rows below the
  // open row are placed by this height, so a stale height would shift them.
  const detailShown = expandedIndex >= windowStart && expandedIndex < end;
  useLayoutEffect(() => {
    const detail = detailRef.current;
    if (!detail) return;
    const measure = () => setDetailHeight(detail.getBoundingClientRect().height);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(detail);
    return () => observer.disconnect();
  }, [expandedKey, detailShown]);

  // A strip above the open row shrinks into the space above it, which pulls the open row up by the same amount each frame.
  // Each frame scrolls up by that shrink, so the open row stays where it was on screen. Clamped at the top, where the row may
  // move a little. Layout effects run before paint, so the frame that paints already has the scroll.
  useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    const table = tableRef.current;
    if (!wrapper || !table || closingIndex === -1 || expandedIndex === -1 || closingIndex >= expandedIndex) return;
    const closingSlide = () => table.querySelector<HTMLElement>(`tr[data-index="${closingIndex}"] + tr.vt-detail .vt-detail-slide`);
    // Read here, before the closing transition has moved, so the first frame's shrink is counted
    let previous = closingSlide()?.getBoundingClientRect().height ?? 0;
    // Kept as a running target, not read back from scrollTop, which snaps to whole pixels. Reading it back would add up that rounding.
    let target = wrapper.scrollTop;
    let frame = 0;
    const follow = () => {
      const height = closingSlide()?.getBoundingClientRect().height ?? 0;
      const shrink = previous - height;
      if (shrink > 0) {
        target = Math.max(0, target - shrink);
        wrapper.scrollTop = target;
        setWindowStart(windowStartFor(wrapper.scrollTop, expandedIndex, detailHeight));
      }
      previous = height;
      if (height > 0) frame = requestAnimationFrame(follow);
    };
    frame = requestAnimationFrame(follow);
    return () => cancelAnimationFrame(frame);
  }, [closingIndex, expandedIndex, detailHeight]);

  // Moves the active row and focuses it once it is rendered. Scrolls only as far as the row needs, and the sticky header
  // covers the top of the viewport, so a row is kept below it.
  function moveActive(index: number) {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const header = tableRef.current?.tHead?.offsetHeight ?? 0;
    const top = rowTopFor(index, expandedIndex, detailHeight);
    if (top < wrapper.scrollTop) {
      wrapper.scrollTop = top;
    } else if (top + ROW_HEIGHT > wrapper.scrollTop + wrapper.clientHeight - header) {
      wrapper.scrollTop = top + ROW_HEIGHT - (wrapper.clientHeight - header);
    }
    setWindowStart(windowStartFor(wrapper.scrollTop, expandedIndex, detailHeight));
    setActiveKey(rowKey(rows[index]));
    setFocusIndex(index);
  }

  // Enter and Space toggle. Space would scroll the table, so it is taken for the toggle too.
  function handleRowKey(event: KeyboardEvent<HTMLTableRowElement>, row: T, index: number) {
    if (!onToggle) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onToggle(row);
      return;
    }
    const page = Math.max(1, Math.floor(viewportHeight / ROW_HEIGHT) - 1);
    const target = moveTarget(event.key, index, page, rows.length);
    if (target === null) return;
    event.preventDefault();
    moveActive(target);
  }

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
            const key = rowKey(row);
            const open = index === expandedIndex;
            const closingRow = closing === key;
            return (
              <Fragment key={key}>
                <tr
                  data-index={index}
                  className={rowClassName?.(row, index)}
                  tabIndex={onToggle ? (index === activeIndex ? 0 : -1) : undefined}
                  aria-expanded={onToggle && !selecting ? open : undefined}
                  aria-selected={selecting ? key === selectedKey : undefined}
                  onClick={onToggle ? () => onToggle(row) : undefined}
                  onFocus={onToggle ? () => setActiveKey(key) : undefined}
                  onKeyDown={onToggle ? (event) => handleRowKey(event, row, index) : undefined}
                >
                  {columns.map((column) => (
                    <td key={column.key}>{column.render ? column.render(row) : cellText(column, row)}</td>
                  ))}
                </tr>
                {(open || closingRow) && renderDetail && (
                  // A closing strip is inert, so its links cannot be focused or clicked while it slides shut
                  <tr className="vt-detail" inert={!open}>
                    <td colSpan={columns.length}>
                      <DetailStrip
                        open={open}
                        sliding={opening === key || closingRow}
                        onSlideEnd={() => endSlide(key)}
                        contentRef={open ? detailRef : undefined}
                      >
                        {renderDetail(row)}
                      </DetailStrip>
                    </td>
                  </tr>
                )}
              </Fragment>
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
