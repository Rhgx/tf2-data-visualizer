import { memo, useDeferredValue, useEffect, useMemo, useRef, useState, type JSX } from "react";
import type { Match } from "../data/match";
import { formatHours } from "../lib/format";
import { TextButton, TfButton } from "../ui/Button";
import { SearchField, SelectField } from "../ui/Field";
import { Panel, PanelNote } from "../ui/Panel";
import { MapCard } from "./MapCard";
import { MapDetailsPanel, tableRows } from "./MapDetailsPanel";
import { MapsChartPanel } from "./MapsChartPanel";
import { MapsHud } from "./MapsHud";
import { buildStats, chartSortKey, compareStats, mapHistory, type ChartMetric, type MapStats } from "./stats";
import "./maps.css";

interface MapsTabProps {
  matches: Match[];
  // Opens the Matches tab searched for the map's name
  onShowMap: (name: string) => void;
}

// The defaults the controls start with, and go back to on Reset
const DEFAULT_TOP_N = "10";
const DEFAULT_METRIC: ChartMetric = "count";
const DEFAULT_SORT = "countDesc";

const TOP_OPTIONS = [
  { value: "10", label: "10" },
  { value: "20", label: "20" },
  { value: "30", label: "30" },
  { value: "50", label: "50" },
  { value: "all", label: "All" },
];

// One view at a time. Search and sort are shared, so switching views keeps them.
type MapsView = "chart" | "table";

// Memoized so a dashboard re-render (e.g. typing in a header filter search) skips this tab when its matches are unchanged
export const MapsTab = memo(function MapsTab({ matches, onShowMap }: MapsTabProps): JSX.Element {
  const [topN, setTopN] = useState(DEFAULT_TOP_N);
  const [metric, setMetric] = useState<ChartMetric>(DEFAULT_METRIC);
  const [sort, setSort] = useState(DEFAULT_SORT);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<MapsView>("chart");
  const viewSwitchRef = useRef<HTMLDivElement>(null);
  const refocusView = useRef(false);
  // The map picked in the chart or table. The card falls back to the top map when it is filtered out.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // The field shows each keystroke at once, while the chart and table catch up after, so typing never waits on a redraw
  const deferredSearch = useDeferredValue(search);

  const stats = useMemo(() => buildStats(matches), [matches]);
  const totalMatches = stats.reduce((sum, s) => sum + s.matches, 0);
  const totalSeconds = stats.reduce((sum, s) => sum + s.seconds, 0);
  const hasHours = totalSeconds > 0;
  const hasMatches = stats.length > 0;

  // Until the effect below runs, the controls already show the fallback, so no frame draws hours without played time
  const activeMetric: ChartMetric = hasHours ? metric : DEFAULT_METRIC;
  const activeSort = !hasHours && sort.startsWith("hours") ? DEFAULT_SORT : sort;

  // Without played time the hours options are disabled. The controls fall back for good,
  // so a later filter with played time does not bring hours back on its own.
  useEffect(() => {
    if (!hasMatches || hasHours) return;
    setMetric(DEFAULT_METRIC);
    setSort((current) => (current.startsWith("hours") ? DEFAULT_SORT : current));
  }, [hasMatches, hasHours]);

  // The switch is remounted with each view, which drops focus to the body. The button for the new view is focused instead.
  useEffect(() => {
    if (!refocusView.current) return;
    refocusView.current = false;
    viewSwitchRef.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus();
  }, [view]);

  const trimmedQuery = deferredSearch.trim();
  const filtered = useMemo(() => {
    const needle = trimmedQuery.toLowerCase();
    return stats.filter((s) => s.name.toLowerCase().includes(needle));
  }, [stats, trimmedQuery]);

  // Each map's row is formatted once, then the rows are sorted. The table sort never changes which maps are charted:
  // Top N picks from the chart's own ranking
  const rows = useMemo(() => tableRows(filtered, totalMatches), [filtered, totalMatches]);
  const sortedRows = useMemo(() => {
    const compare = compareStats(activeSort);
    return [...rows].sort((a, b) => compare(a.stats, b.stats));
  }, [rows, activeSort]);
  const charted = useMemo(() => {
    const ranked = [...filtered].sort(compareStats(chartSortKey(activeSort, activeMetric)));
    return ranked.slice(0, topN === "all" ? ranked.length : Number(topN));
  }, [filtered, activeSort, activeMetric, topN]);

  // The card shows the picked map while it is in the filtered set, otherwise the top of the chart's ranking
  const selectedRow =
    rows.find((row) => row.id === selectedId) ?? rows.find((row) => row.id === charted[0]?.id);
  const pickedId = selectedRow?.id;
  const history = useMemo(() => (pickedId === undefined ? null : mapHistory(matches, pickedId)), [matches, pickedId]);

  const mostPlayed = stats.reduce<MapStats | null>((best, s) => (!best || s.matches > best.matches ? s : best), null);

  if (!mostPlayed) {
    const note = matches.length
      ? "No matches have a known map, so no maps can be charted."
      : "No matches with the current filters.";
    return (
      <div className="tab-panel">
        <Panel title="Maps">
          <PanelNote>{note}</PanelNote>
        </Panel>
      </div>
    );
  }

  // Without played time the hours options are disabled, same as the chart's Metric select
  const sortOptions = [
    { value: "countDesc", label: "Matches (most)" },
    { value: "countAsc", label: "Matches (fewest)" },
    { value: "hoursDesc", label: "Hours (most)", disabled: !hasHours },
    { value: "hoursAsc", label: "Hours (least)", disabled: !hasHours },
    { value: "alphaAsc", label: "Name (A-Z)" },
    { value: "alphaDesc", label: "Name (Z-A)" },
  ];

  function reset() {
    setTopN(DEFAULT_TOP_N);
    setMetric(DEFAULT_METRIC);
    setSort(DEFAULT_SORT);
    setSearch("");
  }

  function selectView(next: MapsView) {
    refocusView.current = true;
    setView(next);
  }

  // Shared by both views, so the header keeps the same controls in the same places when the view changes
  const viewSwitch = (
    <div className="maps-views" role="group" aria-label="View" ref={viewSwitchRef}>
      <TfButton size="small" aria-pressed={view === "chart"} onClick={() => selectView("chart")}>
        Chart
      </TfButton>
      <TfButton size="small" aria-pressed={view === "table"} onClick={() => selectView("table")}>
        Table
      </TfButton>
    </div>
  );
  // Hours options are disabled when no match has played time, so the metric falls back to matches
  const metricOptions = [
    { value: "count", label: "Matches" },
    { value: "hours", label: "Hours", disabled: !hasHours },
  ];
  // Top and Metric only shape the chart. The table renders the same selects hidden, so Sort, Search and Reset wrap and
  // sit in the same places in both views.
  const countControls = (
    <>
      <SelectField
        label="Top"
        tip="Maps shown in the chart. The table always lists every map."
        value={topN}
        options={TOP_OPTIONS}
        onChange={setTopN}
      />
      <SelectField
        label="Metric"
        tip="Rank and label bars by matches or hours played. Hours need played time in the file"
        value={activeMetric}
        options={metricOptions}
        onChange={(value) => setMetric(value === "hours" ? "hours" : "count")}
      />
    </>
  );
  const filters = (
    <>
      <SelectField
        label="Sort"
        tip="Table order. The chart uses the same direction for the chosen metric."
        value={activeSort}
        options={sortOptions}
        onChange={setSort}
      />
      <SearchField label="Search" placeholder="Search maps" value={search} onChange={setSearch} />
      <TextButton tip="Back to Top 10, most matches first, and no search" onClick={reset}>
        Reset
      </TextButton>
    </>
  );

  return (
    <div className="tab-panel fill">
      <div className="maps-content">
        <MapsHud
          totalMatches={totalMatches}
          uniqueMaps={stats.length}
          mostPlayed={mostPlayed}
          timePlayed={hasHours ? formatHours(totalSeconds) : "N/A"}
        />
        <div className="maps-body">
          {view === "chart" ? (
            <MapsChartPanel
              charted={charted}
              filteredCount={filtered.length}
              query={trimmedQuery}
              totalMatches={totalMatches}
              hasHours={hasHours}
              metric={activeMetric}
              selectedId={selectedRow?.id ?? null}
              onSelect={setSelectedId}
              countControls={countControls}
              viewSwitch={viewSwitch}
              filters={filters}
            />
          ) : (
            <MapDetailsPanel
              rows={sortedRows}
              hasHours={hasHours}
              selectedId={selectedRow?.id ?? null}
              onSelect={setSelectedId}
              countControls={countControls}
              viewSwitch={viewSwitch}
              filters={filters}
            />
          )}
          {selectedRow && history && (
            <MapCard row={selectedRow} history={history} hasHours={hasHours} onViewMatches={onShowMap} />
          )}
        </div>
      </div>
    </div>
  );
});
