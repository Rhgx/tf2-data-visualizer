import { cleanNumeric, findColumnKey, isTruthy, type CsvRow } from "./csv";
import { getGameModeFromMapName, mapLabel, mapNameById } from "./maps";

function matchTitle(row: CsvRow): string {
  return row.match_title || row.match_id || "";
}

function matchType(row: CsvRow): string {
  return (row.type || "").trim() || "Unknown";
}

// "none" is no result at all (MvM and abandoned matches), which is not a stalemate.
export type Outcome = "wins" | "losses" | "ties" | "none";

// Teams are numbers in the current export ("2" RED, "3" BLU) and names in older ones.
function parseTeam(value: string): Team | null {
  const normalized = value.trim().toLowerCase();
  if (normalized === "2") return "red";
  if (normalized === "3") return "blu";
  if (/red|defend/.test(normalized)) return "red";
  if (/blu|invad/.test(normalized)) return "blu";
  return null;
}

// The player's team comes from teamOf, so the outcome and the displayed team agree.
function outcomeOf(row: CsvRow, team: Team | null): Outcome {
  const winning = (row.winning_team || "").trim().toLowerCase();
  if (!winning || (row.reached_conclusion || "").trim().toLowerCase() === "false") return "none";
  if (winning === "0" || winning === "none" || winning === "null") return "ties";
  // Without the player's team there is no win or loss to report, so it is no result rather than a loss
  if (team === null) return "none";
  return team === parseTeam(winning) ? "wins" : "losses";
}

export const TF_CLASSES = ["Scout", "Sniper", "Soldier", "Demoman", "Medic", "Heavy", "Pyro", "Spy", "Engineer"] as const;

// classes_played is a bitmask: bit n is TF_CLASSES[n - 1]. Bit 0 means "no class" and is ignored.
function classesOf(row: CsvRow): string[] {
  const mask = cleanNumeric(row.classes_played);
  return TF_CLASSES.filter((_, index) => ((mask >> (index + 1)) & 1) === 1);
}

const parseTimestamp = (value: string | undefined): number | null => {
  const raw = (value ?? "").trim();
  if (!raw) return null;

  let ms = Date.parse(raw);
  if (Number.isFinite(ms)) return ms;

  // Some exports use "2026-01-02 10:00:00 GMT" style stamps that Date.parse rejects.
  const normalized = raw
    .replace(" GMT", "Z")
    .replace(" UTC", "Z")
    .replace(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})(Z?)$/, "$1T$2$3");
  ms = Date.parse(normalized);
  return Number.isFinite(ms) ? ms : null;
};

// connectedAt is the row's connection_time, parsed once by the caller
function calculateTimePlayedSeconds(row: CsvRow, connectedAt: number | null): number {
  const matchDuration = Math.max(0, cleanNumeric(row.match_duration));
  const joinedAt = parseTimestamp(row.join_time) ?? connectedAt;
  const leftAt = parseTimestamp(row.time_left_match) ?? parseTimestamp(row.match_end_time);

  if (joinedAt !== null && leftAt !== null && leftAt >= joinedAt) {
    const computedSeconds = Math.max(0, Math.floor((leftAt - joinedAt) / 1000));
    return matchDuration > 0 ? Math.min(matchDuration, computedSeconds) : computedSeconds;
  }

  if (matchDuration > 0 && !isTruthy(row.joined_after_match_start)) {
    return matchDuration;
  }

  return 0;
}

export type Team = "red" | "blu";

// One CSV row as the tabs see it: numbers parsed once here, names resolved once here.
export interface Match {
  row: CsvRow;
  key: string;
  id: string;
  title: string;
  type: string;
  mapId: string;
  mapName: string;
  mode: string | null;
  time: number | null;
  outcome: Outcome;
  team: Team | null;
  classes: string[];
  kills: number;
  deaths: number;
  damage: number;
  healing: number;
  support: number;
  score: number;
  redScore: number | null;
  bluScore: number | null;
  queueSeconds: number;
  durationSeconds: number;
  playedSeconds: number;
  joinedMidway: boolean;
  datacenter: string;
}

// A column that may be missing or blank in some exports, so blank means unknown rather than 0.
function optionalNumber(value: string | undefined): number | null {
  const num = parseFloat(value ?? "");
  return Number.isNaN(num) ? null : num;
}

// result_team is the team you finished on, team_at_join the fallback when it is missing or unreadable.
function teamOf(row: CsvRow): Team | null {
  return parseTeam(row.result_team || "") ?? parseTeam(row.team_at_join || "");
}

export function toMatches(rows: CsvRow[]): Match[] {
  const mapIndexKey = rows.length ? findColumnKey(rows[0], "map_index") : undefined;

  return rows.map((row, index) => {
    const id = row.match_id || "";
    const team = teamOf(row);
    const mapIndex = mapIndexKey ? (row[mapIndexKey] || "").trim() : "";
    // Index 0 is the "Missing" placeholder (Steam has no map for the match), so it counts as having no map.
    const noMap = mapIndex === "0";
    const mapId = noMap ? "" : mapIndex;
    const mapName = noMap ? "-" : mapId ? mapLabel(mapId) : row.map_name || row.map || "Unknown";
    // Modes fall back to the CSV's own map name when the index doesn't know the map.
    const modeSource = mapNameById(mapId) || row.map_name || row.map || row.mapid || row.mapId || "";
    const connectedAt = parseTimestamp(row.connection_time);

    return {
      row,
      // The row position, not the match id: ids repeat or are blank in some exports. It is stable for one upload.
      key: String(index),
      id,
      title: matchTitle(row),
      type: matchType(row),
      mapId,
      mapName,
      // A match with no map has no real mode, so it never reads as one.
      mode: noMap ? null : getGameModeFromMapName(modeSource),
      time: connectedAt ?? parseTimestamp(row.match_creation_time),
      outcome: outcomeOf(row, team),
      team,
      classes: classesOf(row),
      kills: cleanNumeric(row.kills),
      deaths: cleanNumeric(row.deaths),
      damage: cleanNumeric(row.damage),
      healing: cleanNumeric(row.healing),
      support: cleanNumeric(row.support),
      score: cleanNumeric(row.result_score),
      redScore: optionalNumber(row.red_team_final_score),
      bluScore: optionalNumber(row.blu_team_final_score),
      queueSeconds: cleanNumeric(row.time_in_queue),
      durationSeconds: cleanNumeric(row.match_duration),
      playedSeconds: calculateTimePlayedSeconds(row, connectedAt),
      joinedMidway: isTruthy(row.joined_after_match_start),
      datacenter: row.datacenter || "",
    };
  });
}

// Deaths of 0 have no finite ratio, so a player with kills and no deaths gets the infinity sign.
export function kdRatio(kills: number, deaths: number): string {
  if (deaths === 0) return kills > 0 ? "∞" : "0.00";
  return (kills / deaths).toFixed(2);
}

// Share of matches won, as a fraction. Stalemates count as played; matches with no result are left out.
export function winRate(matches: Match[]): number | null {
  const wins = matches.filter((match) => match.outcome === "wins").length;
  const played = matches.filter((match) => match.outcome !== "none").length;
  return played === 0 ? null : wins / played;
}

export function formatWinRate(rate: number | null): string {
  return rate === null ? "-" : `${(rate * 100).toFixed(1)}%`;
}
