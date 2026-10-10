import { memo, useDeferredValue, useEffect, useMemo, useState, type JSX } from "react";
import type { Match } from "../data/match";
import { formatHours } from "../lib/format";
import { Panel, PanelNote } from "../ui/Panel";
import { MapDetailsPanel, tableRows } from "./MapDetailsPanel";
import { MapsChartPanel } from "./MapsChartPanel";
import { MapsHud } from "./MapsHud";
import { buildStats, chartSortKey, compareStats, type ChartMetric, type MapStats } from "./stats";
import "./maps.css";

interface MapsTabProps {
  matches: Match[];
}

// The defaults the controls start with, and go back to on Reset
const DEFAULT_TOP_N = "20";
const DEFAULT_METRIC: ChartMetric = "count";
const DEFAULT_SORT = "countDesc";

// Memoized so a dashboard re-render (e.g. typing in a header filter search) skips this tab when its matches are unchanged
export const MapsTab = memo(function MapsTab({ matches }: MapsTabProps): JSX.Element {
  const [topN, setTopN] = useState(DEFAULT_TOP_N);
  const [metric, setMetric] = useState<ChartMetric>(DEFAULT_METRIC);
  const [sort, setSort] = useState(DEFAULT_SORT);
  const [search, setSearch] = useState("");
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

  function reset() {
    setTopN(DEFAULT_TOP_N);
    setMetric(DEFAULT_METRIC);
    setSort(DEFAULT_SORT);
    setSearch("");
  }

  return (
    <div className="tab-panel">
      <div className="maps-content">
        <MapsHud
          totalMatches={totalMatches}
          uniqueMaps={stats.length}
          mostPlayed={mostPlayed}
          timePlayed={hasHours ? formatHours(totalSeconds) : "N/A"}
        />
        <MapsChartPanel
          charted={charted}
          filteredCount={filtered.length}
          search={search}
          query={trimmedQuery}
          totalMatches={totalMatches}
          hasHours={hasHours}
          topN={topN}
          metric={activeMetric}
          sort={activeSort}
          onTopN={setTopN}
          onMetric={setMetric}
          onSort={setSort}
          onSearch={setSearch}
          onReset={reset}
        />
        <MapDetailsPanel rows={sortedRows} hasHours={hasHours} />
      </div>
    </div>
  );
});
