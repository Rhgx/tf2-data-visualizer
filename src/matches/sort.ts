import { gameModeName } from "../data/maps";
import type { Match } from "../data/match";
import { isTimed, localTimeOf } from "../overview/stats";

export interface RankOption {
  key: string;
  label: string;
  // null means the match has no value for this rank (no time for Date), so it sorts last
  value: (match: Match) => number | null;
}

// Date is the default. The other entries rank by one match stat.
export const RANKS: RankOption[] = [
  { key: "date", label: "Date", value: (match) => match.time },
  { key: "kills", label: "Kills", value: (match) => match.kills },
  { key: "deaths", label: "Deaths", value: (match) => match.deaths },
  { key: "damage", label: "Damage", value: (match) => match.damage },
  { key: "healing", label: "Healing", value: (match) => match.healing },
  { key: "support", label: "Support", value: (match) => match.support },
  { key: "time", label: "Time played", value: (match) => match.playedSeconds },
  { key: "queue", label: "Queue", value: (match) => match.queueSeconds },
];

export const DEFAULT_RANK = RANKS[0];

export function rankByKey(key: string): RankOption {
  return RANKS.find((rank) => rank.key === key) ?? DEFAULT_RANK;
}

// The lowercase fields a search is matched against, built once per match so each keystroke does not rebuild them
const searchFields = new WeakMap<Match, string[]>();

// Title, ID, map, mode, type, datacenter and local day. The day is YYYY-MM-DD, so "2026-10" finds a month.
function searchFieldsOf(match: Match): string[] {
  const cached = searchFields.get(match);
  if (cached) return cached;
  const modeName = match.mode ? gameModeName(match.mode) : "";
  const day = isTimed(match) ? localTimeOf(match).dateKey : "";
  const fields = [match.title, match.id, match.mapName, modeName, match.type, match.datacenter, day].map((value) =>
    value.toLowerCase()
  );
  searchFields.set(match, fields);
  return fields;
}

// Matches without a value for the rank (no time for Date) sort last in either order
function compareByRank(a: Match, b: Match, rank: RankOption, direction: number): number {
  const x = rank.value(a);
  const y = rank.value(b);
  if (x === null || y === null) return Number(x === null) - Number(y === null);
  return (x - y) * direction;
}

// A copy of the matches in rank order. The input array is never changed. The search runs on this, not before it,
// so typing filters the ranked list instead of sorting again.
export function rankMatches(matches: Match[], rank: RankOption, descending: boolean): Match[] {
  const direction = descending ? -1 : 1;
  return [...matches].sort((a, b) => compareByRank(a, b, rank, direction));
}

// The matches that contain the search text, in the order they came in
export function searchMatches(matches: Match[], search: string): Match[] {
  const query = search.trim().toLowerCase();
  if (!query) return matches;
  return matches.filter((match) => searchFieldsOf(match).some((value) => value.includes(query)));
}

export function directionLabel(rank: RankOption, descending: boolean): string {
  if (rank.key === "date") return descending ? "newest first" : "oldest first";
  return descending ? "descending" : "ascending";
}
