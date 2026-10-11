import { TF_CLASSES, type Match, type Outcome } from "../data/match";
import { monthKey } from "../charts/theme";
import { formatNumber } from "../lib/format";

export type ChartMetric = "count" | "hours";

// Summed per map, so the HUD, chart and table all come from one pass over the matches
export interface MapStats {
  id: string;
  name: string;
  mode: string | null;
  matches: number;
  seconds: number;
  // Start time of the latest match, whatever its result. Null when no match has a time.
  lastTime: number | null;
  // Matches with a result. Stalemates count, no-result matches do not, as in winRate.
  results: number;
  wins: number;
  // Sums over the matches with a result, which the K/D and average damage use
  kills: number;
  deaths: number;
  damage: number;
}

export function buildStats(matches: Match[]): MapStats[] {
  const byId = new Map<string, MapStats>();
  for (const match of matches) {
    if (!match.mapId) continue;

    let stats = byId.get(match.mapId);
    if (!stats) {
      stats = {
        id: match.mapId,
        name: match.mapName,
        mode: match.mode,
        matches: 0,
        seconds: 0,
        lastTime: null,
        results: 0,
        wins: 0,
        kills: 0,
        deaths: 0,
        damage: 0,
      };
      byId.set(match.mapId, stats);
    }

    stats.matches++;
    stats.seconds += match.playedSeconds;
    if (match.time !== null && (stats.lastTime === null || match.time > stats.lastTime)) stats.lastTime = match.time;
    if (match.outcome !== "none") {
      stats.results++;
      if (match.outcome === "wins") stats.wins++;
      stats.kills += match.kills;
      stats.deaths += match.deaths;
      stats.damage += match.damage;
    }
  }
  return [...byId.values()];
}

// What the card shows beyond the totals, for one map from the matches in view
export interface MapHistory {
  firstTime: number | null;
  // The class the map was played as most, or null when no match lists a class
  topClass: { name: string; matches: number } | null;
  // The last ten results, oldest first
  recent: Outcome[];
  // Every calendar month from the first match to the last, empty months included
  monthly: { key: string; matches: number }[];
}

export function mapHistory(matches: Match[], mapId: string): MapHistory {
  const played = matches.filter((match) => match.mapId === mapId);
  const timed = played
    .filter((match): match is Match & { time: number } => match.time !== null)
    .sort((a, b) => a.time - b.time);

  const classCounts = new Map<string, number>();
  for (const match of played) {
    for (const name of match.classes) classCounts.set(name, (classCounts.get(name) ?? 0) + 1);
  }
  let topClass: MapHistory["topClass"] = null;
  for (const name of TF_CLASSES) {
    const count = classCounts.get(name) ?? 0;
    if (count > (topClass?.matches ?? 0)) topClass = { name, matches: count };
  }

  const monthCounts = new Map<string, number>();
  for (const match of timed) {
    const key = monthKey(match.time);
    monthCounts.set(key, (monthCounts.get(key) ?? 0) + 1);
  }
  const monthly: MapHistory["monthly"] = [];
  if (timed.length > 0) {
    const last = monthKey(timed[timed.length - 1].time);
    const cursor = new Date(timed[0].time);
    cursor.setDate(1);
    for (let key = monthKey(cursor.getTime()); key <= last; key = monthKey(cursor.getTime())) {
      monthly.push({ key, matches: monthCounts.get(key) ?? 0 });
      cursor.setMonth(cursor.getMonth() + 1);
    }
  }

  return {
    firstTime: timed[0]?.time ?? null,
    topClass,
    recent: timed.slice(-10).map((match) => match.outcome),
    monthly,
  };
}

// Share of results that were wins, null for a map with no results (MvM and the like)
export function mapWinRate(stats: MapStats): number | null {
  return stats.results === 0 ? null : stats.wins / stats.results;
}

// Name sorts stay as they are. Count and hours sorts follow the chart metric and keep their direction.
export function chartSortKey(sort: string, metric: ChartMetric): string {
  if (sort.startsWith("alpha")) return sort;
  return `${metric}${sort.endsWith("Asc") ? "Asc" : "Desc"}`;
}

export function compareStats(sort: string): (a: MapStats, b: MapStats) => number {
  switch (sort) {
    case "countAsc":
      return (a, b) => a.matches - b.matches || byName(a, b);
    case "hoursDesc":
      return (a, b) => b.seconds - a.seconds || byName(a, b);
    case "hoursAsc":
      return (a, b) => a.seconds - b.seconds || byName(a, b);
    case "alphaAsc":
      return byName;
    case "alphaDesc":
      return (a, b) => byName(b, a);
    default:
      return (a, b) => b.matches - a.matches || byName(a, b);
  }
}

function byName(a: MapStats, b: MapStats): number {
  return a.name.localeCompare(b.name);
}

export function percent(part: number, whole: number): string {
  return `${((part / whole) * 100).toFixed(1)}%`;
}

export function plural(count: number, singular: string, pluralForm: string): string {
  return `${formatNumber(count)} ${count === 1 ? singular : pluralForm}`;
}
