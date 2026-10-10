import type { Match } from "../data/match";
import { formatNumber } from "../lib/format";

export type ChartMetric = "count" | "hours";

// Summed per map, so the HUD, chart and table all come from one pass over the matches
export interface MapStats {
  id: string;
  name: string;
  mode: string | null;
  matches: number;
  seconds: number;
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
