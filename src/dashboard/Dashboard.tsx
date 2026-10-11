import { startTransition, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, useSyncExternalStore, type JSX, type KeyboardEvent as ReactKeyboardEvent } from "react";
import type { Match } from "../data/match";
import { formatNumber } from "../lib/format";
import { whenIdle } from "../lib/idle";
import { MapsTab } from "../maps/MapsTab";
import { MatchesTab, type MatchFocus, type MatchQuery } from "../matches/MatchesTab";
import { ActivityTab } from "../overview/ActivityTab";
import { OverviewTab } from "../overview/OverviewTab";
import { TrendsTab } from "../overview/TrendsTab";
import { earliestTime } from "../overview/stats";
import { ErrorBoundary } from "../ui/ErrorBoundary";
import { CheckField } from "../ui/Field";
import { playSound } from "../ui/sound";
import { SoundButton } from "../ui/SoundButton";
import { isUpdatesShown, setUpdatesShown, subscribeUpdates } from "../ui/updatesShown";
import { FilterMenu } from "./FilterMenu";
import {
  applyFilters,
  countItems,
  cycleItemState,
  FILTER_KEYS,
  mapItems,
  modeItems,
  NO_FILTERS,
  typeItems,
  type FilterKey,
  type FilterState,
} from "./filters";
import "./dashboard.css";

type TabName = "overview" | "activity" | "trends" | "maps" | "matches";

const TABS: { name: TabName; label: string }[] = [
  { name: "overview", label: "Overview" },
  { name: "activity", label: "Activity" },
  { name: "trends", label: "Trends" },
  { name: "maps", label: "Maps" },
  { name: "matches", label: "Matches" },
];

// The index of the tab a navigation key moves to, or null for keys that do not move between tabs
function tabIndexAfter(key: string, index: number): number | null {
  switch (key) {
    case "ArrowRight":
      return (index + 1) % TABS.length;
    case "ArrowLeft":
      return (index - 1 + TABS.length) % TABS.length;
    case "Home":
      return 0;
    case "End":
      return TABS.length - 1;
    default:
      return null;
  }
}

const NO_SEARCHES: Record<FilterKey, string> = { maps: "", modes: "", types: "" };
const NO_COUNTS: ReadonlyMap<string, number> = new Map();

// The tabs filled in while the browser is idle, in order. Overview is shown first, so it needs no warm-up.
const WARM_TABS: TabName[] = ["activity", "trends", "maps", "matches"];

interface DashboardProps {
  // Every match from the upload. The filters narrow this list; the tabs only see the narrowed list.
  matches: Match[];
  onBack: () => void;
}

export function Dashboard({ matches, onBack }: DashboardProps): JSX.Element {
  const [tab, setTab] = useState<TabName>("overview");
  const [filters, setFilters] = useState<FilterState>(NO_FILTERS);
  const [searches, setSearches] = useState(NO_SEARCHES);
  const [openFilter, setOpenFilter] = useState<FilterKey | null>(null);
  const [focus, setFocus] = useState<MatchFocus | null>(null);
  const [query, setQuery] = useState<MatchQuery | null>(null);
  const filterStripRef = useRef<HTMLDivElement>(null);
  const updatesShown = useSyncExternalStore(subscribeUpdates, isUpdatesShown);

  const items = useMemo(
    () => ({ maps: mapItems(matches), modes: modeItems(matches), types: typeItems(matches) }),
    [matches]
  );
  const shown = useMemo(() => applyFilters(matches, filters), [matches, filters]);
  // The tabs catch up after the filter controls. A rapid run of clicks renders the newest filters only, not one tab
  // update per click.
  const deferredShown = useDeferredValue(shown);
  // Counts are only needed for the open dropdown, and one pass over the matches gives them. A search box change does
  // not touch matches or filters, so typing does not recompute them.
  const openCounts = useMemo(() => (openFilter === null ? NO_COUNTS : countItems(matches, filters, openFilter)), [matches, filters, openFilter]);
  const firstTime = useMemo(() => earliestTime(matches), [matches]);
  const filtersActive = FILTER_KEYS.some((key) => filters[key].size > 0);

  // A tab is handed the filtered list only while it is the active tab. An inactive tab keeps the list it last had, so
  // its memo skips it, and when it opens it gets the current list in that same render. A tab never opened starts empty,
  // so loading a file does not sort and measure the Maps and Matches tables before they are seen.
  const [lastShown, setLastShown] = useState<Record<TabName, Match[]>>(() => ({
    overview: shown,
    activity: [],
    trends: [],
    maps: [],
    matches: [],
  }));
  useEffect(() => {
    setLastShown((previous) => (previous[tab] === deferredShown ? previous : { ...previous, [tab]: deferredShown }));
  }, [tab, deferredShown]);

  // Hidden tabs are filled in one at a time while the browser is idle, so opening Maps or Matches later does not pay for
  // its sort and layout. Each step is scheduled by the commit of the previous one, so the work never overlaps. A filter
  // change cancels the pending step and starts again, which keeps the warm-up idle-only.
  useEffect(() => {
    const stale = WARM_TABS.find((name) => name !== tab && lastShown[name] !== deferredShown);
    if (!stale) return;
    return whenIdle(() => {
      startTransition(() => {
        setLastShown((previous) => (previous[stale] === deferredShown ? previous : { ...previous, [stale]: deferredShown }));
      });
    });
  }, [tab, deferredShown, lastShown]);

  // Any click outside a dropdown closes it, and Escape closes it too. Clicks inside a dropdown and its button stop
  // propagation, so they never reach this listener.
  const anyFilterOpen = openFilter !== null;
  useEffect(() => {
    if (!anyFilterOpen) return;
    const close = () => setOpenFilter(null);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenFilter(null);
    };
    document.addEventListener("click", close);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [anyFilterOpen]);

  // One sound per change of the open dropdown, from every path that changes it (trigger, outside click, Escape). Moving
  // from one dropdown to another plays the open sound once. The ref keeps the mount render silent.
  const shownFilter = useRef<FilterKey | null>(null);
  useEffect(() => {
    if (openFilter !== null) playSound("panel-open");
    else if (shownFilter.current !== null) playSound("panel-close");
    shownFilter.current = openFilter;
  }, [openFilter]);

  const toggleFilter = (key: FilterKey) => setOpenFilter((current) => (current === key ? null : key));
  const cycleItem = (key: FilterKey, itemKey: string) => setFilters((previous) => cycleItemState(previous, key, itemKey));
  const clearItems = (key: FilterKey) => setFilters((previous) => ({ ...previous, [key]: NO_FILTERS[key] }));
  const setSearch = (key: FilterKey, value: string) => setSearches((previous) => ({ ...previous, [key]: value }));

  const clearFilters = () => {
    setFilters(NO_FILTERS);
    setSearches(NO_SEARCHES);
    // This button is hidden once nothing is filtered, so focus moves to the first filter trigger (Maps) rather than being lost
    filterStripRef.current?.querySelector<HTMLButtonElement>(".filter-trigger")?.focus();
  };

  // The Overview and Activity tabs link to a match by key; this switches to the Matches tab and asks it to show that row.
  // The id changes on every request, so the same key can be focused again after the user moves away.
  const focusMatch = useCallback((key: string) => {
    setTab("matches");
    setFocus((previous) => ({ key, id: (previous?.id ?? 0) + 1 }));
  }, []);

  // The Activity heatmap links a day to its matches. The search is set to the day's key, and the id changes on every request.
  const showDay = useCallback((dateKey: string) => {
    setTab("matches");
    setQuery((previous) => ({ text: dateKey, id: (previous?.id ?? 0) + 1 }));
  }, []);

  // Moving focus with the arrow keys also selects the tab, as in the WAI-ARIA tabs pattern
  const handleTabKey = (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
    const next = tabIndexAfter(event.key, index);
    if (next === null) return;
    event.preventDefault();
    const { name } = TABS[next];
    setTab(name);
    document.getElementById(`tab-${name}`)?.focus();
  };

  return (
    <div id="dashboard">
      <header className="dialog-header">
        <div className="dialog-top">
          <h1 className="dialog-title">Match History</h1>

          <div className="filter-strip" aria-label="Filters" ref={filterStripRef}>
            <button className={filtersActive ? "text-button" : "text-button hidden"} type="button" onClick={clearFilters}>
              Clear filters
            </button>
            <span className={filtersActive ? "filter-count" : "filter-count hidden"} aria-live="polite" data-tip="Matches left after the filters, out of all in the file">
              {`${formatNumber(shown.length)} / ${formatNumber(matches.length)} shown`}
            </span>

            <FilterMenu
              label="Maps"
              noun="maps"
              items={items.maps}
              counts={openFilter === "maps" ? openCounts : NO_COUNTS}
              states={filters.maps}
              search={searches.maps}
              open={openFilter === "maps"}
              onSearch={(value) => setSearch("maps", value)}
              onToggle={() => toggleFilter("maps")}
              onCycle={(key) => cycleItem("maps", key)}
              onClear={() => clearItems("maps")}
            />
            <FilterMenu
              label="Modes"
              noun="modes"
              items={items.modes}
              counts={openFilter === "modes" ? openCounts : NO_COUNTS}
              states={filters.modes}
              search={searches.modes}
              open={openFilter === "modes"}
              onSearch={(value) => setSearch("modes", value)}
              onToggle={() => toggleFilter("modes")}
              onCycle={(key) => cycleItem("modes", key)}
              onClear={() => clearItems("modes")}
            />
            <FilterMenu
              label="Type"
              noun="types"
              items={items.types}
              counts={openFilter === "types" ? openCounts : NO_COUNTS}
              states={filters.types}
              search={searches.types}
              open={openFilter === "types"}
              onSearch={(value) => setSearch("types", value)}
              onToggle={() => toggleFilter("types")}
              onCycle={(key) => cycleItem("types", key)}
              onClear={() => clearItems("types")}
            />
            <CheckField
              label="TF2 Updates"
              tip="Show TF2 update releases on the Trends and queue time charts and the Activity calendar"
              checked={updatesShown}
              onChange={setUpdatesShown}
            />
          </div>
        </div>

        <div className="tab-nav" role="tablist" aria-label="Match history views">
          {TABS.map(({ name, label }, index) => (
            <button
              key={name}
              className="tab-button"
              id={`tab-${name}`}
              type="button"
              role="tab"
              aria-selected={tab === name}
              aria-controls={`${name}-tab`}
              tabIndex={tab === name ? 0 : -1}
              onClick={() => setTab(name)}
              onKeyDown={(event) => handleTabKey(event, index)}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {/* All tabs stay mounted so their control state survives a tab switch. */}
      <main className="dialog-body">
        <section id="overview-tab" role="tabpanel" aria-labelledby="tab-overview" hidden={tab !== "overview"}>
          <ErrorBoundary>
            <OverviewTab matches={tab === "overview" ? deferredShown : lastShown.overview} onFocusMatch={focusMatch} />
          </ErrorBoundary>
        </section>
        <section id="activity-tab" role="tabpanel" aria-labelledby="tab-activity" hidden={tab !== "activity"}>
          <ErrorBoundary>
            <ActivityTab
              matches={tab === "activity" ? deferredShown : lastShown.activity}
              firstTime={firstTime}
              onFocusMatch={focusMatch}
              onShowDay={showDay}
            />
          </ErrorBoundary>
        </section>
        <section id="trends-tab" role="tabpanel" aria-labelledby="tab-trends" hidden={tab !== "trends"}>
          <ErrorBoundary>
            <TrendsTab matches={tab === "trends" ? deferredShown : lastShown.trends} />
          </ErrorBoundary>
        </section>
        <section id="maps-tab" role="tabpanel" aria-labelledby="tab-maps" hidden={tab !== "maps"}>
          <ErrorBoundary>
            <MapsTab matches={tab === "maps" ? deferredShown : lastShown.maps} onShowMap={showDay} />
          </ErrorBoundary>
        </section>
        <section id="matches-tab" role="tabpanel" aria-labelledby="tab-matches" hidden={tab !== "matches"}>
          <ErrorBoundary>
            <MatchesTab matches={tab === "matches" ? deferredShown : lastShown.matches} allMatches={matches} focus={focus} query={query} />
          </ErrorBoundary>
        </section>
      </main>

      <footer className="dialog-footer">
        <button className="tf-button menu-button" type="button" data-tip="Back to the menu. Forgets the loaded file" onClick={onBack}>
          &lt;&lt; Back
        </button>
        <SoundButton />
        <p>Unofficial fan tool, not affiliated with Valve. Made by <a href="https://github.com/Rhgx">Rocks</a></p>
      </footer>
    </div>
  );
}
