import { useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { monthLabel } from "../charts/theme";
import { Panel, PanelNote } from "../ui/Panel";
import { TfButton } from "../ui/Button";
import { HeatGrid, heatAmount, type ActivityMode } from "./Heatmap";
import { UntimedNote } from "./UntimedNote";
import {
  calendarColumns,
  dayTotalsOf,
  heatCuts,
  hourColumns,
  hourTotals,
  monthsOf,
  scopedMatches,
  weekdayTotals,
  yearSummary,
  yearSummaryText,
  yearsOf,
  type HourScope,
  type TimedMatch,
} from "./stats";

interface ActivityPanelProps {
  timed: TimedMatch[];
  untimed: number;
  // The first timed match across all data, so the calendar's blank days do not move with the filters
  firstTime: number | null;
  onShowDay: (dateKey: string) => void;
}

export function ActivityPanel({ timed, untimed, firstTime, onShowDay }: ActivityPanelProps) {
  // Activity is the first timed panel, so the untimed note is shown here and not in Form or Per match
  return (
    <Panel title="Activity" tip="Matches per day and by weekday and hour, in your local time">
      <UntimedNote count={untimed} />
      {timed.length === 0 ? (
        <PanelNote>No matches have a recorded time.</PanelNote>
      ) : (
        <TimedActivity timed={timed} firstTime={firstTime} onShowDay={onShowDay} />
      )}
    </Panel>
  );
}

interface TimedActivityProps {
  timed: TimedMatch[];
  firstTime: number | null;
  onShowDay: (dateKey: string) => void;
}

// The period buttons over the hour grids, in the order Left and Right move through them
const SCOPES: { scope: HourScope; label: string }[] = [
  { scope: "all", label: "All time" },
  { scope: "year", label: "Year" },
  { scope: "month", label: "Month" },
];

// The calendar and weekday-by-hour heatmaps. Only rendered when there is at least one timed match, so years is not empty.
function TimedActivity({ timed, firstTime, onShowDay }: TimedActivityProps) {
  // The toggle only changes the calendar. The hour grids always show matches and win rate.
  const [mode, setMode] = useState<ActivityMode>("matches");
  // The picked year is tied to the timed list it was picked from, so a new list (any filter change) falls back to the newest year
  const [picked, setPicked] = useState<{ year: number; from: TimedMatch[] } | null>(null);
  // The hour grids' period. The month is only read while the scope is "month", and a year change clears it.
  const [scope, setScope] = useState<HourScope>("all");
  const [month, setMonth] = useState<string | null>(null);
  const yearButtons = useRef<HTMLDivElement>(null);
  const scopeButtons = useRef<HTMLDivElement>(null);
  const years = useMemo(() => yearsOf(timed), [timed]);
  const year = picked?.from === timed ? picked.year : years[0];
  const months = useMemo(() => monthsOf(timed, year), [timed, year]);
  // A stored month that is no longer in this year's list (after a filter change) falls back to the newest month
  const activeMonth = month !== null && months.includes(month) ? month : (months[0] ?? null);
  const dayTotals = useMemo(() => dayTotalsOf(timed), [timed]);
  const scoped = useMemo(() => scopedMatches(timed, scope, year, activeMonth), [timed, scope, year, activeMonth]);
  const hours = useMemo(() => hourColumns(scoped), [scoped]);
  const hourEdges = useMemo(() => hourTotals(hours), [hours]);
  const dayEdges = useMemo(() => weekdayTotals(hours), [hours]);
  // One object for both hour grids, so HeatGrid's memo holds while the calendar mode or year changes
  const edges = useMemo(() => ({ hours: hourEdges, days: dayEdges }), [hourEdges, dayEdges]);

  // Cut points come from every year, so the years compare on the same levels. Each mode cuts its own amount (matches or time).
  const dayCuts = useMemo(
    () => heatCuts(Array.from(dayTotals.values(), (total) => heatAmount(total, mode))),
    [dayTotals, mode]
  );
  // Hour cells are shaded by match count, so their cut points do not depend on the toggle
  const hourCuts = useMemo(
    () => heatCuts(hours.flatMap((column) => column.cells.map((cell) => (cell ? cell.count : 0)))),
    [hours]
  );
  const columns = useMemo(() => calendarColumns(dayTotals, year, new Date(), firstTime), [dayTotals, year, firstTime]);
  const summary = useMemo(() => yearSummary(dayTotals, year), [dayTotals, year]);
  const suffix = periodSuffix(scope, year, activeMonth);

  function pickYear(next: number): void {
    if (next !== year) setMonth(null);
    setPicked({ year: next, from: timed });
  }

  // Left and Right move between the year buttons and select the one they land on, as the dashboard tabs do. The list wraps.
  function handleYearKey(event: ReactKeyboardEvent<HTMLButtonElement>, index: number): void {
    const next = arrowStep(event, index, years.length);
    if (next === null) return;
    pickYear(years[next]);
    yearButtons.current?.querySelectorAll("button")[next]?.focus();
  }

  function handleScopeKey(event: ReactKeyboardEvent<HTMLButtonElement>, index: number): void {
    const next = arrowStep(event, index, SCOPES.length);
    if (next === null) return;
    setScope(SCOPES[next].scope);
    scopeButtons.current?.querySelectorAll("button")[next]?.focus();
  }

  // The hour grids sit side by side once this box is wide enough. It follows the panel width, not the window.
  return (
    <div className="activity-body">
      <section>
        <div className="heat-heading">
          <h3 className="sub-title">{mode === "hours" ? "Hours per day" : "Matches per day"}</h3>
          <div className="activity-modes">
            <TfButton size="small" aria-pressed={mode === "matches"} onClick={() => setMode("matches")}>
              Matches
            </TfButton>
            <TfButton size="small" aria-pressed={mode === "hours"} onClick={() => setMode("hours")}>
              Hours
            </TfButton>
            <TfButton size="small" aria-pressed={mode === "winrate"} onClick={() => setMode("winrate")}>
              Win rate
            </TfButton>
          </div>
        </div>
        <div className="year-buttons" role="group" aria-label="Year" ref={yearButtons}>
          {years.map((option, index) => (
            <TfButton
              key={option}
              size="small"
              aria-pressed={option === year}
              onClick={() => pickYear(option)}
              onKeyDown={(event) => handleYearKey(event, index)}
            >
              {option}
            </TfButton>
          ))}
        </div>
        <HeatGrid columns={columns} cuts={dayCuts} mode={mode} variant="heat-grid-calendar" onPickDay={onShowDay} />
        <p className="activity-summary">{yearSummaryText(year, summary)}</p>
      </section>
      <section>
        <div className="heat-heading">
          <h3 className="sub-title">By weekday and hour</h3>
          <div className="activity-scope">
            <div className="activity-modes" role="group" aria-label="Period" ref={scopeButtons}>
              {SCOPES.map(({ scope: option, label }, index) => (
                <TfButton
                  key={option}
                  size="small"
                  aria-pressed={option === scope}
                  onClick={() => setScope(option)}
                  onKeyDown={(event) => handleScopeKey(event, index)}
                >
                  {label}
                </TfButton>
              ))}
            </div>
            {scope === "month" && (
              <div className="field">
                <select aria-label="Month" value={activeMonth ?? ""} onChange={(event) => setMonth(event.target.value)}>
                  {months.map((key) => (
                    <option key={key} value={key}>
                      {monthLabel(key)}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
        {scoped.length === 0 ? (
          <PanelNote>No matches in this period</PanelNote>
        ) : (
          <div className="hour-grids">
            <div className="hour-grid">
              <h4 className="hour-title">{`Matches${suffix}`}</h4>
              <HeatGrid
                columns={hours}
                cuts={hourCuts}
                mode="matches"
                variant="heat-grid-hours"
                edges={edges}
              />
            </div>
            <div className="hour-grid">
              <h4 className="hour-title">{`Win rate${suffix}`}</h4>
              <HeatGrid
                columns={hours}
                cuts={hourCuts}
                mode="winrate"
                variant="heat-grid-hours"
                edges={edges}
              />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

// The index Left or Right moves to in a button group of `count`, wrapping at both ends. null for any other key.
function arrowStep(event: ReactKeyboardEvent<HTMLButtonElement>, index: number, count: number): number | null {
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return null;
  event.preventDefault();
  return (index + (event.key === "ArrowRight" ? 1 : count - 1)) % count;
}

// Heading text after the grid name, so the grids say which period they show
function periodSuffix(scope: HourScope, year: number, month: string | null): string {
  if (scope === "year") return `, ${year}`;
  if (scope === "month" && month !== null) return `, ${monthLabel(month)}`;
  return "";
}
