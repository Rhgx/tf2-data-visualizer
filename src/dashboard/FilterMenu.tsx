import { useEffect, useId, useLayoutEffect, useRef, useState, type JSX, type KeyboardEvent } from "react";
import { formatNumber } from "../lib/format";
import { TextButton } from "../ui/Button";
import { orderItems, type FilterItem, type ItemState, type OrderedItems } from "./filters";

// Read out as the item's accessible name suffix, e.g. "Badwater, included"
const STATE_TEXT: Record<ItemState | "off", string> = { include: "included", exclude: "excluded", off: "off" };

// The list gets the room the window leaves below the dropdown, but never less than this, so the search and a few rows stay usable
const MIN_PANEL_HEIGHT = 160;
// Space kept between the bottom of the dropdown and the bottom of the window
const WINDOW_MARGIN = 12;

interface FilterMenuProps {
  label: string;
  // Plural noun for the search placeholder and tooltip, e.g. "maps"
  noun: string;
  items: FilterItem[];
  // Matches each item would add with the other filters applied (see countItems)
  counts: ReadonlyMap<string, number>;
  states: ReadonlyMap<string, ItemState>;
  search: string;
  open: boolean;
  onSearch: (search: string) => void;
  onToggle: () => void;
  onCycle: (key: string) => void;
  onClear: () => void;
}

// The button's click stops propagation so the dashboard's outside-click close does not undo the toggle.
export function FilterMenu({ label, noun, items, counts, states, search, open, onSearch, onToggle, onCycle, onClear }: FilterMenuProps): JSX.Element {
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [wasOpen, setWasOpen] = useState(false);
  const [ordered, setOrdered] = useState<OrderedItems>({ active: [], rest: [] });
  const [panelHeight, setPanelHeight] = useState<number>();
  // The item Tab reaches and arrow keys start from (roving focus). Until one is focused, it is the first shown item.
  const [focusedKey, setFocusedKey] = useState<string>();

  // The order is taken as the dropdown opens and kept while it stays open, so a click never moves the item under the
  // cursor. The next open takes it again. The counts here do not change while this dropdown is open, since they leave
  // its own filter out.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setOrdered(orderItems(items, states, counts));
  }

  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  // Sized from where the panel starts, so the list ends above the bottom edge of the window
  useLayoutEffect(() => {
    if (!open || !panelRef.current) return;
    const top = panelRef.current.getBoundingClientRect().top;
    setPanelHeight(Math.max(MIN_PANEL_HEIGHT, window.innerHeight - top - WINDOW_MARGIN));
  }, [open]);

  const needle = search.trim().toLowerCase();
  const matchesSearch = (item: FilterItem) => needle === "" || item.searchText.includes(needle);
  const activeShown = ordered.active.filter(matchesSearch);
  const restShown = ordered.rest.filter(matchesSearch);
  const shown = [...activeShown, ...restShown];
  const tabStopKey = (shown.find((item) => item.key === focusedKey) ?? shown[0])?.key;
  // States only hold included or excluded items (an off item is removed), so the size is the active count
  const active = states.size;

  // Arrow keys, Home and End move between the shown items. ArrowUp from the first item goes back to the search box.
  const onListKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const buttons = [...(listRef.current?.querySelectorAll<HTMLButtonElement>(".filter-item") ?? [])];
    const index = buttons.findIndex((button) => button === event.target);
    if (index < 0) return;
    let next: number;
    switch (event.key) {
      case "ArrowDown":
        next = Math.min(index + 1, buttons.length - 1);
        break;
      case "ArrowUp":
        next = index - 1;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = buttons.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    if (next < 0) searchRef.current?.focus();
    else buttons[next].focus();
  };

  const renderItem = (item: FilterItem) => {
    const state = states.get(item.key) ?? "off";
    const count = counts.get(item.key) ?? 0;
    return (
      <button
        key={item.key}
        className={count === 0 ? "filter-item empty" : "filter-item"}
        type="button"
        data-state={state}
        tabIndex={item.key === tabStopKey ? 0 : -1}
        aria-label={`${item.name}, ${formatNumber(count)} ${count === 1 ? "match" : "matches"}, ${STATE_TEXT[state]}`}
        onFocus={() => setFocusedKey(item.key)}
        onClick={() => onCycle(item.key)}
      >
        <span className="filter-state" aria-hidden="true" />
        <span className="filter-name">{item.name}</span>
        {item.prefix && <span className="filter-prefix">{item.prefix}</span>}
        <span className="filter-item-count" aria-hidden="true">
          {formatNumber(count)}
        </span>
      </button>
    );
  };

  return (
    <div
      className="filter-group"
      onKeyDown={(event) => {
        // Escape from inside the dropdown returns focus to the trigger, so keyboard users keep their place
        if (event.key !== "Escape" || !open) return;
        onToggle();
        triggerRef.current?.focus();
      }}
    >
      <button
        ref={triggerRef}
        className="tf-button small-button filter-trigger"
        type="button"
        // The panel open or close sound plays from Dashboard, so the press makes no click
        data-sound="none"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={(event) => {
          event.stopPropagation();
          onToggle();
        }}
      >
        {active > 0 ? `${label} (${active})` : label}
      </button>
      <div
        ref={panelRef}
        className={open ? "filter-panel" : "filter-panel hidden"}
        id={panelId}
        style={{ maxHeight: panelHeight }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="search">
          <input
            ref={searchRef}
            type="search"
            placeholder={`Search ${noun}`}
            aria-label={`Search ${noun}`}
            autoComplete="off"
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "ArrowDown") return;
              event.preventDefault();
              listRef.current?.querySelector<HTMLButtonElement>('.filter-item[tabindex="0"]')?.focus();
            }}
          />
        </div>
        {open && (
          <div className="filter-hint">
            <p className="panel-note">Click to include, again to exclude</p>
            {active > 0 && (
              <TextButton
                aria-label={`Clear ${noun}`}
                onClick={() => {
                  onClear();
                  // The Clear link is removed once nothing is active, so focus moves to the search box rather than being lost
                  searchRef.current?.focus();
                }}
              >
                Clear
              </TextButton>
            )}
          </div>
        )}
        {/* Only the open list is rendered: the header has one list per filter, and a closed one is never seen */}
        {open && (
          <div ref={listRef} className="well filter-list" onKeyDown={onListKeyDown}>
            {items.length === 0 && <p className="panel-note filter-empty">Nothing to filter yet</p>}
            {items.length > 0 && shown.length === 0 && <p className="panel-note filter-empty">No {noun} match</p>}
            {activeShown.map(renderItem)}
            {activeShown.length > 0 && restShown.length > 0 && <hr className="filter-divider" />}
            {restShown.map(renderItem)}
          </div>
        )}
      </div>
    </div>
  );
}
