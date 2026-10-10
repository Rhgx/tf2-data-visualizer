import { formatNumber } from "../lib/format";
import { winRate, type Match, type Outcome, type Team } from "../data/match";

// Pure calculations for the Overview tab. Components call these with the filtered matches and render the result.

export type TimedMatch = Match & { time: number };
type SumField = "kills" | "deaths" | "damage" | "healing" | "support" | "queueSeconds" | "playedSeconds";
export type StatField = "kills" | "deaths" | "damage" | "healing";

export interface MonthBucket {
  key: string;
  matches: TimedMatch[];
}

// A record row: a label and value, optionally a detail line and a match to open in the Matches tab
export interface RecordRow {
  label: string;
  value: string;
  detail?: string;
  matchKey?: string;
}

// Matches on one heatmap day, hour or weekday. wins and results only count matches with a result, and stalemates are results, as in winRate.
// seconds is the time played across them, with 0 for a match that has no played time.
export interface HeatTotal {
  count: number;
  wins: number;
  results: number;
  seconds: number;
}

// A heatmap cell or edge total: its label for the tip, and the totals behind it.
// Calendar days also carry their YYYY-MM-DD key. blank marks a day with no data (after today, or before the first match) and today marks today.
export interface HeatCell extends HeatTotal {
  label: string;
  dateKey?: string;
  blank?: boolean;
  today?: boolean;
}

// One heatmap column: an axis label on top, then one cell per weekday (Monday first). null is a day outside the year.
export interface HeatColumn {
  axis: string;
  cells: (HeatCell | null)[];
}

export const TEAMS: { team: Team; name: string }[] = [
  { team: "red", name: "RED" },
  { team: "blu", name: "BLU" },
];

export const OUTCOME_SPLIT: { outcome: Outcome; label: string; className: string }[] = [
  { outcome: "wins", label: "Wins", className: "win" },
  { outcome: "ties", label: "Stalemates", className: "tie" },
  { outcome: "losses", label: "Losses", className: "loss" },
  { outcome: "none", label: "No result", className: "none" },
];

export const LINE_STYLE = { pointRadius: 0, borderWidth: 2, tension: 0.3 };

const DAY_MS = 24 * 60 * 60 * 1000;
export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
// Like GitHub's calendar, only Mon, Wed and Fri are labeled to keep the column narrow
export const DAY_LABELS = ["Mon", "", "Wed", "", "Fri", "", ""];

export function isTimed(match: Match): match is TimedMatch {
  return match.time !== null;
}

// Timed matches in time order. filter returns a new array, so the input is not reordered. Upload order is usually
// already by time, so the sort only runs when it is not.
export function timedMatches(matches: Match[]): TimedMatch[] {
  const timed = matches.filter(isTimed);
  const sorted = timed.every((match, index) => index === 0 || timed[index - 1].time <= match.time);
  return sorted ? timed : timed.sort((a, b) => a.time - b.time);
}

// "none" matches have no result and no stats, so they stay out of per-match averages
export function hasStats(match: Match): boolean {
  return match.outcome !== "none";
}

export function sumOf(list: readonly Match[], field: SumField): number {
  let total = 0;
  for (const match of list) total += match[field];
  return total;
}

export function averageOf(list: readonly Match[], field: SumField): number {
  return list.length ? sumOf(list, field) / list.length : 0;
}

export function averageText(list: Match[], field: SumField, maxFractionDigits: number): string {
  return list.length ? formatNumber(averageOf(list, field), maxFractionDigits) : "N/A";
}

export function countOutcomes(list: readonly Match[]): Record<Outcome, number> {
  const counts: Record<Outcome, number> = { wins: 0, losses: 0, ties: 0, none: 0 };
  for (const match of list) counts[match.outcome]++;
  return counts;
}

// The win rate of a list, from its outcome counts. Same result as winRate on that list: stalemates count, no-result matches do not.
export function winRateOf(counts: Record<Outcome, number>): number | null {
  const played = counts.wins + counts.losses + counts.ties;
  return played === 0 ? null : counts.wins / played;
}

// The lists and counts the Overview panels group by. Each list keeps the order of the input.
export interface OverviewGroups {
  outcomes: Record<Outcome, number>;
  queued: Match[];
  played: Match[];
  // Matches with a result, the only ones that carry stats
  scored: Match[];
  joined: number;
  teams: Map<Team, Match[]>;
  modes: Map<string, Match[]>;
  classes: Map<string, Match[]>;
}

function pushTo<K>(map: Map<K, Match[]>, key: K, match: Match): void {
  const list = map.get(key);
  if (list) list.push(match);
  else map.set(key, [match]);
}

// One pass over the matches for every list the Overview panels need, in place of a scan per panel and per group.
// Groups are created in the order their first match appears, which the panels' sorts depend on for ties.
export function groupMatches(matches: Match[]): OverviewGroups {
  const groups: OverviewGroups = {
    outcomes: { wins: 0, losses: 0, ties: 0, none: 0 },
    queued: [],
    played: [],
    scored: [],
    joined: 0,
    teams: new Map(),
    modes: new Map(),
    classes: new Map(),
  };
  for (const match of matches) {
    groups.outcomes[match.outcome]++;
    if (match.queueSeconds > 0) groups.queued.push(match);
    if (match.playedSeconds > 0) groups.played.push(match);
    if (match.outcome !== "none") groups.scored.push(match);
    if (match.joinedMidway) groups.joined++;
    if (match.team !== null) pushTo(groups.teams, match.team, match);
    if (match.mode !== null) pushTo(groups.modes, match.mode, match);
    for (const name of match.classes) pushTo(groups.classes, name, match);
  }
  return groups;
}

export function percent(part: number, total: number): string {
  // toFixed keeps one decimal even for whole numbers ("47.0%"), like formatWinRate
  return `${(total > 0 ? (part / total) * 100 : 0).toFixed(1)}%`;
}

// Formatters are built once. toLocaleDateString would build a new one on every call.
const dayFormatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });
const monthDayFormatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const monthFormatter = new Intl.DateTimeFormat("en-US", { month: "short" });

function formatDay(date: Date): string {
  return dayFormatter.format(date);
}

function monthDay(date: Date): string {
  return monthDayFormatter.format(date);
}

function emptyTotal(): HeatTotal {
  return { count: 0, wins: 0, results: 0, seconds: 0 };
}

function addMatch(total: HeatTotal, match: Match): void {
  total.count += 1;
  total.seconds += match.playedSeconds;
  if (match.outcome === "wins") total.wins += 1;
  if (match.outcome !== "none") total.results += 1;
}

function sumCells(cells: (HeatCell | null)[]): HeatTotal {
  const total = emptyTotal();
  for (const cell of cells) {
    if (cell === null) continue;
    total.count += cell.count;
    total.wins += cell.wins;
    total.results += cell.results;
    total.seconds += cell.seconds;
  }
  return total;
}

// Keys by local calendar day. Month is 0-based and not padded, so it is only for lookups, not for sorting.
function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

const pad2 = (value: number): string => String(value).padStart(2, "0");

// The YYYY-MM-DD form used by the Matches search, so a day's key finds its matches
export function dateKeyOf(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

// "2026-03", the same key as theme's monthKey, so months sort as plain strings
function monthKeyOf(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
}

// The earliest timed match in the list, or null when none has a time
export function earliestTime(matches: Match[]): number | null {
  let earliest: number | null = null;
  for (const match of matches) {
    if (match.time !== null && (earliest === null || match.time < earliest)) earliest = match.time;
  }
  return earliest;
}

// Monday is 0, so every heatmap starts its weeks on Monday
function weekdayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

// The local calendar parts of one match's time. Read once per match and kept, so every filter change reuses them
// instead of making new Date objects for each match.
export interface LocalTime {
  year: number;
  monthKey: string;
  // The key dayTotalsOf and the calendar look days up by
  dayKey: string;
  dateKey: string;
  weekday: number;
  hour: number;
}

const localTimes = new WeakMap<TimedMatch, LocalTime>();

export function localTimeOf(match: TimedMatch): LocalTime {
  const cached = localTimes.get(match);
  if (cached) return cached;
  const date = new Date(match.time);
  const local: LocalTime = {
    year: date.getFullYear(),
    monthKey: monthKeyOf(date),
    dayKey: dayKey(date),
    dateKey: dateKeyOf(date),
    weekday: weekdayIndex(date),
    hour: date.getHours(),
  };
  localTimes.set(match, local);
  return local;
}

export function dayTotalsOf(timed: TimedMatch[]): Map<string, HeatTotal> {
  const totals = new Map<string, HeatTotal>();
  for (const match of timed) {
    const key = localTimeOf(match).dayKey;
    const total = totals.get(key) ?? emptyTotal();
    addMatch(total, match);
    totals.set(key, total);
  }
  return totals;
}

// Newest year first. Only years with at least one timed match get a button.
export function yearsOf(timed: TimedMatch[]): number[] {
  const years = new Set(timed.map((match) => localTimeOf(match).year));
  return Array.from(years).sort((a, b) => b - a);
}

// Months of `year` with at least one timed match, newest first, as monthKey strings
export function monthsOf(timed: TimedMatch[], year: number): string[] {
  const keys = new Set(timed.filter((match) => localTimeOf(match).year === year).map((match) => localTimeOf(match).monthKey));
  return Array.from(keys).sort().reverse();
}

// The period the weekday by hour grids show: every timed match, one calendar year, or one month ("2026-03")
export type HourScope = "all" | "year" | "month";

export function scopedMatches(timed: TimedMatch[], scope: HourScope, year: number, month: string | null): TimedMatch[] {
  if (scope === "all") return timed;
  if (scope === "year") return timed.filter((match) => localTimeOf(match).year === year);
  return timed.filter((match) => localTimeOf(match).monthKey === month);
}

// Every month from the first timed match to the last, so quiet months stay on the axis as gaps
export function monthBuckets(timed: TimedMatch[]): MonthBucket[] {
  if (timed.length === 0) return [];

  const byKey = new Map<string, TimedMatch[]>();
  for (const match of timed) {
    const key = localTimeOf(match).monthKey;
    const list = byKey.get(key);
    if (list) list.push(match);
    else byKey.set(key, [match]);
  }

  const lastKey = localTimeOf(timed[timed.length - 1]).monthKey;
  const cursor = new Date(timed[0].time);
  cursor.setDate(1);
  const buckets: MonthBucket[] = [];
  let key = monthKeyOf(cursor);
  while (key <= lastKey) {
    buckets.push({ key, matches: byKey.get(key) ?? [] });
    cursor.setMonth(cursor.getMonth() + 1);
    key = monthKeyOf(cursor);
  }
  return buckets;
}

// Win rate as a percent for the chart, null for a month with no matches that have a result
export function monthWinPercent(list: Match[]): number | null {
  const rate = winRate(list);
  return rate === null ? null : rate * 100;
}

// Kills per death over the month, null when the month has no deaths
export function monthKd(list: Match[]): number | null {
  const deaths = sumOf(list, "deaths");
  return deaths > 0 ? sumOf(list, "kills") / deaths : null;
}

// Average over matches that have stats, null for a month with none so the line leaves a gap
export function statAverage(list: Match[], field: StatField): number | null {
  const scored = list.filter(hasStats);
  return scored.length ? sumOf(scored, field) / scored.length : null;
}

// Upper bounds of levels 1 to 4: the 25th, 50th, 75th and 90th percentiles of the non-zero counts. Level 5 then holds only the
// busiest tenth, so the brightest color stays rare. Empty input gives no cuts.
export function heatCuts(counts: Iterable<number>): number[] {
  const busy = [...counts].filter((count) => count > 0).sort((a, b) => a - b);
  if (busy.length === 0) return [];
  return [0.25, 0.5, 0.75, 0.9].map((fraction) => busy[Math.floor(fraction * busy.length)]);
}

// Level 0 is an empty cell. Levels 1 to 5 count the cuts the count is above, so a count equal to a cut stays in the lower level.
export function heatLevel(count: number, cuts: number[]): number {
  return count === 0 ? 0 : 1 + cuts.filter((cut) => count > cut).length;
}

// Tick text for the boundaries between heat levels, from the cuts heatCuts returns. Each tick is the first value of the next level:
// a count is whole, so it is one above its cut, while a duration is shown as the cut itself.
// A tick that repeats the one before it gets "" so the same value is not printed twice. Its swatch and gap stay in place.
export function heatTickLabels(cuts: number[], inSeconds: boolean): string[] {
  const labels = cuts.map((cut) => (inSeconds ? durationText(cut) : formatNumber(cut + 1)));
  return labels.map((label, index) => (index > 0 && label === labels[index - 1] ? "" : label));
}

// Minutes under an hour, then hours to one decimal: "15m", "1h", "2.5h"
function durationText(seconds: number): string {
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${Number((seconds / 3600).toFixed(1))}h`;
}

// Jan 1 to Dec 31 of `year`, one column per Monday-start week. Days outside the year are null.
// Days after `today`, and days before the first match of `firstTime` (across all data, not just the filtered list), are blank.
// A blank day with matches is not blank, so no data is ever hidden.
export function calendarColumns(totals: Map<string, HeatTotal>, year: number, today: Date, firstTime: number | null): HeatColumn[] {
  const jan1 = new Date(year, 0, 1);
  const dec31 = new Date(year, 11, 31);
  const start = new Date(year, 0, 1 - weekdayIndex(jan1));
  const days = Math.round((dec31.getTime() - start.getTime()) / DAY_MS);
  const weekCount = Math.floor(days / 7) + 1;

  const todayStart = localMidnight(today);
  const firstStart = firstTime === null ? null : localMidnight(new Date(firstTime));

  const columns: HeatColumn[] = [];
  for (let week = 0; week < weekCount; week++) {
    let axis = "";
    const cells: (HeatCell | null)[] = [];
    for (let day = 0; day < 7; day++) {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + week * 7 + day);
      if (date.getFullYear() !== year) {
        cells.push(null);
        continue;
      }
      if (date.getDate() === 1) axis = monthFormatter.format(date);
      const total = totals.get(dayKey(date)) ?? emptyTotal();
      const time = date.getTime();
      const outside = time > todayStart || (firstStart !== null && time < firstStart);
      cells.push({
        label: formatDay(date),
        dateKey: dateKeyOf(date),
        blank: outside && total.count === 0,
        today: time === todayStart,
        ...total,
      });
    }
    columns.push({ axis, cells });
  }
  return columns;
}

function localMidnight(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export interface YearSummary {
  matches: number;
  daysPlayed: number;
  busiest: { date: Date; count: number };
  // Only set when a run of days is at least two days long
  streak: { days: number; start: Date; end: Date } | null;
}

// Matches and days with a timed match in `year`, the busiest day (the earliest on a tie) and the longest run of consecutive days. null when the year has no matches.
export function yearSummary(totals: Map<string, HeatTotal>, year: number): YearSummary | null {
  let matches = 0;
  let daysPlayed = 0;
  let busiest: YearSummary["busiest"] | null = null;
  let run: { days: number; start: Date } | null = null;
  let longest: { days: number; start: Date; end: Date } | null = null;

  for (let day = 0; day < 366; day++) {
    const date = new Date(year, 0, 1 + day);
    if (date.getFullYear() !== year) break;
    const count = totals.get(dayKey(date))?.count ?? 0;
    if (count === 0) {
      run = null;
      continue;
    }
    matches += count;
    daysPlayed += 1;
    if (busiest === null || count > busiest.count) busiest = { date, count };
    run = run ? { days: run.days + 1, start: run.start } : { days: 1, start: date };
    if (longest === null || run.days > longest.days) longest = { ...run, end: date };
  }

  if (busiest === null) return null;
  const streak = longest !== null && longest.days >= 2 ? longest : null;
  return { matches, daysPlayed, busiest, streak };
}

// "702 matches on 176 days, busiest Jan 17 (39 matches), longest streak 17 days (Jan 10 to Jan 26)". The streak part is left out for a one-day streak.
export function yearSummaryText(year: number, summary: YearSummary | null): string {
  if (summary === null) return `No matches in ${year}`;
  const parts = [
    `${countOf(summary.matches, "match", "matches")} on ${countOf(summary.daysPlayed, "day", "days")}`,
    `busiest ${monthDay(summary.busiest.date)} (${countOf(summary.busiest.count, "match", "matches")})`,
  ];
  if (summary.streak) {
    const { days, start, end } = summary.streak;
    parts.push(`longest streak ${countOf(days, "day", "days")} (${monthDay(start)} to ${monthDay(end)})`);
  }
  return parts.join(", ");
}

function countOf(count: number, singular: string, plural: string): string {
  return `${formatNumber(count)} ${count === 1 ? singular : plural}`;
}

// Weekday by hour, one column per hour. Column cells are Monday to Sunday.
export function hourColumns(timed: TimedMatch[]): HeatColumn[] {
  // Index is weekday * 24 + hour, weekdays Monday first
  const totals = Array.from({ length: 7 * 24 }, () => emptyTotal());
  for (const match of timed) {
    const local = localTimeOf(match);
    addMatch(totals[local.weekday * 24 + local.hour], match);
  }

  const columns: HeatColumn[] = [];
  for (let hour = 0; hour < 24; hour++) {
    const cells: HeatCell[] = [];
    for (let day = 0; day < 7; day++) {
      cells.push({ label: `${WEEKDAYS[day]} ${hour}:00`, ...totals[day * 24 + hour] });
    }
    columns.push({ axis: hour % 3 === 0 ? String(hour).padStart(2, "0") : "", cells });
  }
  return columns;
}

// One total per hour column, labelled by its hour
export function hourTotals(columns: HeatColumn[]): HeatCell[] {
  return columns.map((column, hour) => ({ label: `${hour}:00`, ...sumCells(column.cells) }));
}

// One total per weekday, across all hours
export function weekdayTotals(columns: HeatColumn[]): HeatCell[] {
  return WEEKDAYS.map((label, day) => ({ label, ...sumCells(columns.map((column) => column.cells[day])) }));
}

// Round durations in seconds that bin edges are picked from
const QUEUE_LADDER = [5, 10, 15, 30, 45, 60, 120, 180, 300, 600, 900, 1200, 1800, 2700, 3600, 7200];
const MAX_QUEUE_EDGES = 5;

interface QueueBins {
  labels: string[];
  counts: number[];
}

// Edges come from the 5th to 95th percentile so a few outliers cannot spread the bins thin.
// Every time falls in exactly one bin: the first holds everything under the first edge, the last everything at or above the last.
export function queueBins(seconds: number[]): QueueBins {
  if (seconds.length === 0) return { labels: [], counts: [] };

  const edges = queueEdges(seconds);
  const counts = new Array<number>(edges.length + 1).fill(0);
  for (const value of seconds) counts[edges.filter((edge) => edge <= value).length] += 1;
  return { labels: queueBinLabels(edges), counts };
}

function queueEdges(seconds: number[]): number[] {
  const sorted = [...seconds].sort((a, b) => a - b);
  const low = percentile(sorted, 0.05);
  const high = percentile(sorted, 0.95);

  let edges = QUEUE_LADDER.filter((value) => value > low && value <= high);
  if (edges.length > MAX_QUEUE_EDGES) edges = spreadEdges(edges);
  // No ladder value inside the range: start from the largest one at or below low, so the matches sit in a bin
  if (edges.length === 0) edges = [QUEUE_LADDER.filter((value) => value <= low).at(-1) ?? QUEUE_LADDER[0]];
  if (edges.length === 1) edges = widenEdge(edges[0]);
  return edges;
}

function percentile(sorted: number[], fraction: number): number {
  return sorted[Math.floor(fraction * (sorted.length - 1))];
}

// Keeps MAX_QUEUE_EDGES edges spread evenly across the list, always including the first and the last
function spreadEdges(edges: number[]): number[] {
  const last = edges.length - 1;
  return Array.from({ length: MAX_QUEUE_EDGES }, (_, i) => edges[Math.round((i * last) / (MAX_QUEUE_EDGES - 1))]);
}

// Adds a neighbouring ladder value so one edge becomes two. Goes up first so the bulk of the times gets split,
// and down only when the edge is already the top of the ladder.
function widenEdge(edge: number): number[] {
  const index = QUEUE_LADDER.indexOf(edge);
  if (index + 1 < QUEUE_LADDER.length) return [edge, QUEUE_LADDER[index + 1]];
  return [QUEUE_LADDER[index - 1], edge];
}

function queueBinLabels(edges: number[]): string[] {
  const labels = [`under ${shortDuration(edges[0])}`];
  for (let i = 1; i < edges.length; i++) labels.push(rangeLabel(edges[i - 1], edges[i]));
  labels.push(`${shortDuration(edges[edges.length - 1])}+`);
  return labels;
}

// "15s", "2m", "1h" for a ladder value
function shortDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${seconds / 60}m`;
  return `${seconds / 3600}h`;
}

// Both ends in the upper end's unit when they are whole there ("10-15m", "1-2h"), else each end on its own ("45m-1h")
function rangeLabel(lower: number, upper: number): string {
  const unit = upper < 60 ? 1 : upper < 3600 ? 60 : 3600;
  if (lower % unit === 0) return `${lower / unit}-${shortDuration(upper)}`;
  return `${shortDuration(lower)}-${shortDuration(upper)}`;
}

// Matches with no known map have no mapId, so the line is the date alone instead of a placeholder map name
function matchDetail(match: Match): string {
  if (match.time === null) return match.mapName;
  const date = formatDay(new Date(match.time));
  return match.mapId ? `${match.mapName}, ${date}` : date;
}

function extreme(list: Match[], value: (match: Match) => number, wantMax: boolean): Match | undefined {
  let best: Match | undefined;
  for (const match of list) {
    if (best === undefined || (wantMax ? value(match) > value(best) : value(match) < value(best))) best = match;
  }
  return best;
}

// A record that points at a match gets its map, date and a View button. Empty lists have no record.
export function matchRecord(
  label: string,
  list: Match[],
  value: (match: Match) => number,
  wantMax: boolean,
  format: (amount: number) => string
): RecordRow | null {
  const best = extreme(list, value, wantMax);
  return best ? { label, value: format(value(best)), detail: matchDetail(best), matchKey: best.key } : null;
}

export function present(rows: (RecordRow | null)[]): RecordRow[] {
  return rows.filter((row): row is RecordRow => row !== null);
}
