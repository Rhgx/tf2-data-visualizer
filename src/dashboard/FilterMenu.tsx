import { useId, useRef, type JSX } from "react";
import type { FilterItem, ItemState } from "./filters";

// Read out as the item's accessible name suffix, e.g. "Badwater, included"
const STATE_TEXT: Record<ItemState | "off", string> = { include: "included", exclude: "excluded", off: "off" };

interface FilterMenuProps {
  label: string;
  // Plural noun for the search placeholder and tooltip, e.g. "maps"
  noun: string;
  items: FilterItem[];
  states: ReadonlyMap<string, ItemState>;
  search: string;
  open: boolean;
  onSearch: (search: string) => void;
  onToggle: () => void;
  onCycle: (key: string) => void;
}

// The button's click stops propagation so the dashboard's outside-click close does not undo the toggle.
export function FilterMenu({ label, noun, items, states, search, open, onSearch, onToggle, onCycle }: FilterMenuProps): JSX.Element {
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const needle = search.trim().toLowerCase();
  const shown = needle === "" ? items : items.filter((item) => item.searchText.includes(needle));

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
        aria-expanded={open}
        aria-controls={panelId}
        data-tip="Click an item to cycle: off, include, exclude"
        onClick={(event) => {
          event.stopPropagation();
          onToggle();
        }}
      >
        {label}
      </button>
      <div className={open ? "filter-panel" : "filter-panel hidden"} id={panelId} onClick={(event) => event.stopPropagation()}>
        <div className="search">
          <input
            type="search"
            placeholder={`Search ${noun}`}
            aria-label={`Search ${noun}`}
            autoComplete="off"
            value={search}
            onChange={(event) => onSearch(event.target.value)}
          />
        </div>
        {/* Only the open list is rendered: the header has one list per filter, and a closed one is never seen */}
        {open && (
          <div className="well filter-list">
            {items.length === 0 && <p className="panel-note filter-empty">Nothing to filter yet</p>}
            {shown.map((item) => {
              const state = states.get(item.key) ?? "off";
              return (
                <button key={item.key} className="filter-item" type="button" data-state={state} aria-label={`${item.name}, ${STATE_TEXT[state]}`} onClick={() => onCycle(item.key)}>
                  <span className="filter-state" aria-hidden="true" />
                  <span className="filter-name">{item.name}</span>
                  {item.prefix && <span className="filter-prefix">{item.prefix}</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
