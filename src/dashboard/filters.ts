import { gameModeName, mapLabel, mapNameById } from "../data/maps";
import type { Match } from "../data/match";

export type FilterKey = "maps" | "modes" | "types";
// An item is either included or excluded. An item with no state is off.
export type ItemState = "include" | "exclude";
export type FilterState = Record<FilterKey, ReadonlyMap<string, ItemState>>;

export const FILTER_KEYS: readonly FilterKey[] = ["maps", "modes", "types"];

export const NO_FILTERS: FilterState = { maps: new Map(), modes: new Map(), types: new Map() };

export interface FilterItem {
  key: string;
  name: string;
  prefix?: string;
  searchText: string;
}

// The match value each filter tests. A null value (a match with no known game mode) fails an include list.
const VALUE_OF: Record<FilterKey, (match: Match) => string | null> = {
  maps: (match) => match.mapId,
  modes: (match) => match.mode,
  types: (match) => match.type,
};

// Sub-modes that share another mode's map prefix, so they have no prefix of their own
const NO_OWN_PREFIX = new Set(["ad", "medieval", "tr"]);

export function mapItems(matches: Match[]): FilterItem[] {
  const mapIds = [...new Set(matches.map((match) => match.mapId).filter(Boolean))];
  // Maps with a known name sort by name, unknown IDs go last
  return mapIds
    .sort((a, b) => (mapNameById(a) || `zzz_${a}`).localeCompare(mapNameById(b) || `zzz_${b}`))
    .map((id) => ({ key: id, name: mapLabel(id), searchText: mapLabel(id).toLowerCase() }));
}

export function modeItems(matches: Match[]): FilterItem[] {
  const modes = [...new Set(matches.map((match) => match.mode).filter((mode): mode is string => mode !== null))];
  return modes
    .sort((a, b) => gameModeName(a).localeCompare(gameModeName(b)))
    .map((mode) => {
      const name = gameModeName(mode);
      const prefix = NO_OWN_PREFIX.has(mode) ? undefined : `${mode}_`;
      return { key: mode, name, prefix, searchText: `${name} ${prefix ?? ""}`.toLowerCase() };
    });
}

export function typeItems(matches: Match[]): FilterItem[] {
  const types = [...new Set(matches.map((match) => match.type))];
  return types
    .sort((a, b) => a.localeCompare(b))
    .map((type) => ({ key: type, name: type, searchText: type.toLowerCase() }));
}

// off -> include -> exclude -> off. Returns a new state so React sees the change.
export function cycleItemState(states: FilterState, key: FilterKey, itemKey: string): FilterState {
  const current = states[key].get(itemKey);
  const next: ItemState | undefined = current === undefined ? "include" : current === "include" ? "exclude" : undefined;
  const updated = new Map(states[key]);
  if (next) updated.set(itemKey, next);
  else updated.delete(itemKey);
  return { ...states, [key]: updated };
}

function keysWithState(states: ReadonlyMap<string, ItemState>, state: ItemState): Set<string> {
  return new Set([...states].filter(([, value]) => value === state).map(([key]) => key));
}

interface Rule {
  valueOf: (match: Match) => string | null;
  includes: Set<string>;
  excludes: Set<string>;
}

function rulesFor(keys: readonly FilterKey[], states: FilterState): Rule[] {
  return keys.map((key) => ({
    valueOf: VALUE_OF[key],
    includes: keysWithState(states[key], "include"),
    excludes: keysWithState(states[key], "exclude"),
  }));
}

function passes(match: Match, rules: Rule[]): boolean {
  return rules.every(({ valueOf, includes, excludes }) => {
    const value = valueOf(match);
    if (value !== null && excludes.has(value)) return false;
    return includes.size === 0 || (value !== null && includes.has(value));
  });
}

// How many matches each item of one filter would add, given the other two filters. The filter's own state is left out,
// so its counts do not move when its items are toggled. One pass over the matches, for the dropdown that is open.
export function countItems(matches: Match[], states: FilterState, key: FilterKey): Map<string, number> {
  const rules = rulesFor(FILTER_KEYS.filter((other) => other !== key), states);
  const counts = new Map<string, number>();
  for (const match of matches) {
    if (!passes(match, rules)) continue;
    const value = VALUE_OF[key](match);
    if (value !== null) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

export interface OrderedItems {
  // Included, then excluded. Shown above the rest with a divider.
  active: FilterItem[];
  rest: FilterItem[];
}

// Each group sorts by count, most first. Ties keep the item's alphabetical order from the mapItems, modeItems, typeItems lists.
export function orderItems(items: FilterItem[], states: ReadonlyMap<string, ItemState>, counts: ReadonlyMap<string, number>): OrderedItems {
  const byCount = (a: FilterItem, b: FilterItem) => (counts.get(b.key) ?? 0) - (counts.get(a.key) ?? 0);
  const included = items.filter((item) => states.get(item.key) === "include").sort(byCount);
  const excluded = items.filter((item) => states.get(item.key) === "exclude").sort(byCount);
  const rest = items.filter((item) => !states.has(item.key)).sort(byCount);
  return { active: [...included, ...excluded], rest };
}

export function applyFilters(matches: Match[], states: FilterState): Match[] {
  const rules = rulesFor(FILTER_KEYS, states);
  return matches.filter((match) => passes(match, rules));
}
