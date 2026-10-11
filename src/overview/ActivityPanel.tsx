import { useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { monthLabel } from "../charts/theme";
import { Panel, PanelNote } from "../ui/Panel";
import { TfButton } from "../ui/Button";
import { HeatGrid, THIN_RESULTS, heatAmount, type ActivityMode } from "./Heatmap";
import { RecordList } from "./RecordList";
import { UntimedNote } from "./UntimedNote";
import {
  calendarColumns,
  dayTotalsOf,
  heatCuts,
  hourColumns,
  hourTotals,
  monthsOf,
  scopedMatches,
  weekdayRecords,
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
  // The untimed count sits at the foot of the panel, so it reads as a footnote to the heatmap
  return (
    <Panel title="Activity" tip="Matches per day or by weekday and hour, in your local time">
      {timed.length === 0 ? (
        <PanelNote>No matches have a recorded time.</PanelNote>
      ) : (
        <TimedActivity timed={timed} firstTime={firstTime} onShowDay={onShowDay} />
      )}
      <UntimedNote count={untimed} />
    </Panel>
  );
}

interface TimedActivityProps {
  timed: TimedMatch[];
  firstTime: number | null;
  onShowDay: (dateKey: string) => void;
}

export interface Choice<T extends string> {
  value: T;
  label: string;
}

type ActivityView = "calendar" | "weekday";

const VIEWS: Choice<ActivityView>[] = [
  { value: "calendar", label: "Calendar" },
  { value: "weekday", label: "Weekday × hour" },
];

const CALENDAR_METRICS: Choice<ActivityMode>[] = [
  { value: "matches", label: "Matches" },
  { value: "hours", label: "Hours" },
  { value: "winrate", label: "Win rate" },
];

const WEEKDAY_METRICS: Choice<ActivityMode>[] = [
  { value: "matches", label: "Matches" },
  { value: "winrate", label: "Win rate" },
];

const SCOPES: Choice<HourScope>[] = [
  { value: "all", label: "All time" },
  { value: "year", label: "Year" },
  { value: "month", label: "Month" },
];

// One heatmap at a time: the calendar of days, or the weekday by hour grid. Only rendered when there is at least one timed match, so years is not empty.
function TimedActivity({ timed, firstTime, onShowDay }: TimedActivityProps) {
  const [view, setView] = useState<ActivityView>("calendar");
  const [metric, setMetric] = useState<ActivityMode>("matches");
  // The picked year is tied to the timed list it was picked from, so a new list (any filter change) falls back to the newest year
  const [picked, setPicked] = useState<{ year: number; from: TimedMatch[] } | null>(null);
  // The weekday grid's period. The month is only read while the scope is "month", and a year change clears it.
  const [scope, setScope] = useState<HourScope>("all");
  const [month, setMonth] = useState<string | null>(null);
  const years = useMemo(() => yearsOf(timed), [timed]);
  // The calendar and the weekday grid's Year scope share this year
  const year = picked?.from === timed ? picked.year : years[0];
  const months = useMemo(() => monthsOf(timed, year), [timed, year]);
  // A stored month that is no longer in this year's list (after a filter change) falls back to the newest month
  const activeMonth = month !== null && months.includes(month) ? month : (months[0] ?? null);
  const dayTotals = useMemo(() => dayTotalsOf(timed), [timed]);
  const scoped = useMemo(() => scopedMatches(timed, scope, year, activeMonth), [timed, scope, year, activeMonth]);
  const hours = useMemo(() => hourColumns(scoped), [scoped]);
  const hourEdges = useMemo(() => hourTotals(hours), [hours]);
  const dayEdges = useMemo(() => weekdayTotals(hours), [hours]);
  const edges = useMemo(() => ({ hours: hourEdges, days: dayEdges }), [hourEdges, dayEdges]);
  const records = useMemo(() => weekdayRecords(hours, dayEdges, hourEdges, THIN_RESULTS), [hours, dayEdges, hourEdges]);

  // Cut points come from every year, so the years compare on the same levels. Each metric cuts its own amount (matches or time).
  const dayCuts = useMemo(
    () => heatCuts(Array.from(dayTotals.values(), (total) => heatAmount(total, metric))),
    [dayTotals, metric]
  );
  // Hour cells are shaded by match count, so their cut points do not depend on the metric
  const hourCuts = useMemo(
    () => heatCuts(hours.flatMap((column) => column.cells.map((cell) => (cell ? cell.count : 0)))),
    [hours]
  );
  const columns = useMemo(() => calendarColumns(dayTotals, year, new Date(), firstTime), [dayTotals, year, firstTime]);
  const summary = useMemo(() => yearSummary(dayTotals, year), [dayTotals, year]);

  // The calendar always shows one year. The weekday grid only needs one for its Year scope.
  const showYear = view === "calendar" || scope === "year";
  const showMonth = view === "weekday" && scope === "month";

  function pickView(next: ActivityView): void {
    // Hours is only offered by the calendar, so it falls back to matches here
    if (next === "weekday" && metric === "hours") setMetric("matches");
    setView(next);
  }

  function pickYear(next: number): void {
    if (next !== year) setMonth(null);
    setPicked({ year: next, from: timed });
  }

  return (
    <div className="activity-body">
      <div className="activity-controls">
        <ChoiceGroup label="View" choices={VIEWS} value={view} onChange={pickView} />
        <ChoiceGroup
          label="Metric"
          choices={view === "calendar" ? CALENDAR_METRICS : WEEKDAY_METRICS}
          value={metric}
          onChange={setMetric}
        />
        {view === "weekday" && <ChoiceGroup label="Period" choices={SCOPES} value={scope} onChange={setScope} />}
        {showYear && <YearPager years={years} year={year} onPick={pickYear} />}
        {showMonth && (
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
      {/* Both views share one grid cell, so the panel is as tall as the taller view. The hidden one keeps its space, so switching does not move the panel. */}
      <div className="activity-views">
        <div className={view === "calendar" ? "activity-view" : "activity-view is-hidden"}>
          <HeatGrid columns={columns} cuts={dayCuts} mode={metric} variant="heat-grid-calendar" onPickDay={onShowDay} />
          <p className="activity-summary">{yearSummaryText(year, summary)}</p>
        </div>
        <div className={view === "weekday" ? "activity-view" : "activity-view is-hidden"}>
          {scoped.length === 0 ? (
            <PanelNote>No matches in this period</PanelNote>
          ) : (
            <div className="activity-weekday">
              <HeatGrid columns={hours} cuts={hourCuts} mode={metric} variant="heat-grid-hours" edges={edges} />
              {records.length > 0 && (
                <div className="activity-records">
                  <RecordList rows={records} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface ChoiceGroupProps<T extends string> {
  label: string;
  choices: Choice<T>[];
  value: T;
  onChange: (value: T) => void;
}

// A row of toggle buttons with one pressed. Left and Right move through them and select the button they land on, wrapping at both ends.
export function ChoiceGroup<T extends string>({ label, choices, value, onChange }: ChoiceGroupProps<T>) {
  const buttons = useRef<HTMLDivElement>(null);

  function handleKey(event: ReactKeyboardEvent<HTMLButtonElement>, index: number): void {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const next = (index + (event.key === "ArrowRight" ? 1 : choices.length - 1)) % choices.length;
    onChange(choices[next].value);
    buttons.current?.querySelectorAll("button")[next]?.focus();
  }

  return (
    <div className="activity-group">
      <span className="activity-label">{label}</span>
      <div className="activity-modes" role="group" aria-label={label} ref={buttons}>
        {choices.map((choice, index) => (
          <TfButton
            key={choice.value}
            size="small"
            aria-pressed={choice.value === value}
            onClick={() => onChange(choice.value)}
            onKeyDown={(event) => handleKey(event, index)}
          >
            {choice.label}
          </TfButton>
        ))}
      </div>
    </div>
  );
}

interface YearPagerProps {
  // Newest first, as yearsOf returns them
  years: number[];
  year: number;
  onPick: (year: number) => void;
}

// Pages through the years with timed matches, like the backpack pages: "<" goes to an older year and ">" to a newer one.
function YearPager({ years, year, onPick }: YearPagerProps) {
  const index = years.indexOf(year);
  const older: number | undefined = years[index + 1];
  const newer: number | undefined = years[index - 1];
  return (
    <div className="year-pager" role="group" aria-label="Year">
      <TfButton
        size="small"
        aria-label="Earlier year"
        disabled={older === undefined}
        onClick={older === undefined ? undefined : () => onPick(older)}
      >
        {"<"}
      </TfButton>
      <span className="year-pager-year">{year}</span>
      <TfButton
        size="small"
        aria-label="Later year"
        disabled={newer === undefined}
        onClick={newer === undefined ? undefined : () => onPick(newer)}
      >
        {">"}
      </TfButton>
    </div>
  );
}
