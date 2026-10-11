import { memo, useDeferredValue, useEffect, useMemo, useRef, useState, type JSX } from "react";
import type { Match } from "../data/match";
import { formatNumber } from "../lib/format";
import { playSound } from "../ui/sound";
import { Panel, PanelNote } from "../ui/Panel";
import { VirtualTable, prefersReducedMotion, type VirtualTableHandle } from "../ui/VirtualTable";
import { DEFAULT_COLUMNS, rawColumns, type MatchRow } from "./columns";
import "./matches.css";
import { MatchDetail } from "./MatchDetail";
import { ScoreboardControls } from "./ScoreboardControls";
import { DEFAULT_RANK, directionLabel, rankMatches, searchMatches, type RankOption } from "./sort";

// A request to show one match. The id changes on every request, so the same key can be requested twice.
export interface MatchFocus {
  key: string;
  id: number;
}

// A request to search for some text. The id changes on every request, so the same text can be requested twice.
export interface MatchQuery {
  text: string;
  id: number;
}

interface MatchesTabProps {
  matches: Match[];
  // Every match before the filters, used only to size the columns
  allMatches: Match[];
  focus: MatchFocus | null;
  query: MatchQuery | null;
}

// Keys are the match key, which is unique per match. The rank changes with the order, so it would reuse rows on a re-sort.
function rowKey(row: MatchRow): string {
  return row.match.key;
}

// What the last focus request left on screen. The highlight ends with the next matches list, and the note
// shows when the focused match is not in the list (a focus request, or a filter that hides it).
interface FocusView {
  key: string;
  highlighted: boolean;
  note: boolean;
}

// Memoized for the same reason as MapsTab; focus and query only change on a request
export const MatchesTab = memo(function MatchesTab({ matches, allMatches, focus, query }: MatchesTabProps): JSX.Element {
  const [rank, setRank] = useState<RankOption>(DEFAULT_RANK);
  const [descending, setDescending] = useState(true);
  const [search, setSearch] = useState("");
  // The field shows each keystroke at once, while the table filters from the deferred value, so typing never waits on a redraw
  const deferredSearch = useDeferredValue(search);
  const [allColumns, setAllColumns] = useState(false);
  const [focusView, setFocusView] = useState<FocusView | null>(null);
  // The focused match key until the table shows it, see the scroll effect below
  const [pendingFocus, setPendingFocus] = useState<string | null>(null);
  // The match whose detail strip is open. Only one is open at a time.
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const table = useRef<VirtualTableHandle>(null);
  const panel = useRef<HTMLDivElement>(null);
  // The last focus request handled. A new matches list with the same request must not focus again.
  const handledFocus = useRef<MatchFocus | null>(null);
  // The last search request handled, for the same reason as handledFocus
  const handledQuery = useRef<MatchQuery | null>(null);

  // Ranking does not depend on the search, so typing only filters the ranked list
  const ranked = useMemo(() => rankMatches(matches, rank, descending), [matches, rank, descending]);
  const sorted = useMemo(() => searchMatches(ranked, deferredSearch), [ranked, deferredSearch]);
  const rows = useMemo<MatchRow[]>(() => sorted.map((match, index) => ({ match, rank: index + 1 })), [sorted]);
  // Widths come from every match, so filters and searches never re-measure.
  // Ranks run to the full count, so the "#" column fits any filtered rank.
  const sizingRows = useMemo<MatchRow[]>(() => allMatches.map((match, index) => ({ match, rank: index + 1 })), [allMatches]);
  const columns = useMemo(() => (allColumns ? rawColumns(allMatches) : DEFAULT_COLUMNS), [allColumns, allMatches]);

  // Declared before the focus effect, so a commit with both a new list and a new focus ends focused.
  // The open strip closes too, since a new list can put another match under the same key.
  useEffect(() => {
    setFocusView((view) =>
      view && { key: view.key, highlighted: false, note: !matches.some((match) => match.key === view.key) }
    );
    setExpandedKey(null);
  }, [matches]);

  useEffect(() => {
    if (!focus || focus === handledFocus.current) return;
    handledFocus.current = focus;
    if (!matches.some((match) => match.key === focus.key)) {
      setFocusView({ key: focus.key, highlighted: false, note: true });
      return;
    }
    // Newest first is the default rank, so the search and rank are reset to show the match among all of them.
    // The order direction is kept.
    setSearch("");
    setRank(DEFAULT_RANK);
    setFocusView({ key: focus.key, highlighted: true, note: false });
    setExpandedKey(focus.key);
    setPendingFocus(focus.key);
  }, [focus, matches, descending]);

  // A search request replaces the search and keeps the rank and order. The search field takes focus, so the user can refine it.
  useEffect(() => {
    if (!query || query === handledQuery.current) return;
    handledQuery.current = query;
    setSearch(query.text);
    panel.current?.querySelector<HTMLInputElement>('input[type="search"]')?.focus();
  }, [query]);

  // The search is deferred, so the rows lag one render behind it. Scrolling before they catch up would land on the
  // old rows, and the table resets its scroll when the new rows arrive. The row takes focus once it is rendered.
  useEffect(() => {
    if (pendingFocus === null || search !== deferredSearch) return;
    const index = rows.findIndex((row) => row.match.key === pendingFocus);
    if (index !== -1) table.current?.scrollToRow(index, { focus: true });
    setPendingFocus(null);
  }, [pendingFocus, rows, search, deferredSearch]);

  const reset = () => {
    setRank(DEFAULT_RANK);
    setDescending(true);
    setSearch("");
    setAllColumns(false);
  };

  const focusedKey = focusView?.highlighted ? focusView.key : null;
  const rowClassName = (row: MatchRow): string => {
    const outcome = `row-${row.match.outcome}`;
    return row.match.key === focusedKey ? `${outcome} is-focused` : outcome;
  };
  // A switch plays both slide sounds at once. The close sits 8 dB under the open so the opening sound leads. A judgment
  // call, so tune it by ear if it reads too loud or too quiet.
  const SWITCH_CLOSE_GAIN_DB = -8;
  // Clicking the open row closes it, clicking another row moves the strip there
  // The sound is picked from the current strip, not inside the updater, since StrictMode runs updaters twice.
  const toggleRow = (row: MatchRow) => {
    const opening = expandedKey !== row.match.key;
    // The strip sound goes with the slide, so with reduced motion nothing slides and the plain click plays instead
    if (prefersReducedMotion()) playSound("click");
    else if (opening && expandedKey !== null) {
      // Switching rows: the old strip slides shut as the new one opens, so the close sound is kept quieter under the open
      playSound("strip-open");
      playSound("strip-close", SWITCH_CLOSE_GAIN_DB);
    } else playSound(opening ? "strip-open" : "strip-close");
    setExpandedKey(opening ? row.match.key : null);
  };

  return (
    <div ref={panel} className="tab-panel fill">
      <Panel
        title="Scoreboard"
        className="matches-main"
        actions={
          <ScoreboardControls
            rank={rank}
            descending={descending}
            search={search}
            allColumns={allColumns}
            onRank={setRank}
            onDescending={setDescending}
            onSearch={setSearch}
            onAllColumns={setAllColumns}
            onReset={reset}
          />
        }
      >
        <PanelNote>{`${formatNumber(sorted.length)} ${sorted.length === 1 ? "match" : "matches"}, ranked by ${rank.label} (${directionLabel(rank, descending)})`}</PanelNote>
        {focusView?.note && <PanelNote>That match is hidden by the filters.</PanelNote>}
        {sorted.length === 0 && <PanelNote>No matches with the current filters.</PanelNote>}
        <VirtualTable
          ref={table}
          className="matches-table"
          rows={rows}
          sizingRows={sizingRows}
          columns={columns}
          rowKey={rowKey}
          rowClassName={rowClassName}
          expandedKey={expandedKey}
          onToggle={toggleRow}
          renderDetail={(row) => <MatchDetail match={row.match} />}
        />
      </Panel>
    </div>
  );
});
