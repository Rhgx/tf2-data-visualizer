import { cleanNumeric } from "../data/csv";
import { kdRatio, type Match, type Outcome, type Team } from "../data/match";
import { gameModeName } from "../data/maps";
import { formatMatchTime, formatNumber, formatShortDuration } from "../lib/format";
import type { Column } from "../ui/VirtualTable";

// One visible row: the match and its place in the current order. The rank is the first column.
export interface MatchRow {
  match: Match;
  rank: number;
}

// Fixed format, so the date reads the same in every browser locale: "2026-10-07 19:46" in local time
function formatPlayedAt(time: number | null): string {
  if (time === null) return "-";
  const date = new Date(time);
  const pad = (value: number): string => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const OUTCOME_TEXT: Record<Outcome, string> = { wins: "WIN", losses: "LOSS", ties: "STALEMATE", none: "NO RESULT" };
const OUTCOME_CLASS: Record<Outcome, string> = { wins: "outcome-win", losses: "outcome-loss", ties: "outcome-tie", none: "outcome-none" };
const TEAM_TEXT: Record<Team, string> = { red: "RED", blu: "BLU" };

// Rows without result data have no stats, so their stat cells show "-" instead of 0
function hasStats(match: Match): boolean {
  return match.outcome !== "none";
}

// Team score color blocks in the TF2 scoreboard style. Their padding is the column's pad, not part of the text.
function scoreText(match: Match): string {
  if (match.redScore === null || match.bluScore === null) return "";
  return `RED ${match.redScore}:${match.bluScore} BLU`;
}

function ScoreBlocks({ match }: { match: Match }) {
  if (match.redScore === null || match.bluScore === null) return "-";
  return (
    <>
      <span className="score-red">RED {match.redScore}</span>
      <span className="score-sep">:</span>
      <span className="score-blu">{match.bluScore} BLU</span>
    </>
  );
}

// TF2 class icons, one per class. The names are the tooltip and the alt text.
function ClassIcons({ classes }: { classes: string[] }) {
  if (classes.length === 0) return "-";
  return (
    <span className="class-icons" data-tip={classes.join(", ")}>
      {classes.map((name) => (
        <img key={name} className="class-icon" src={`${import.meta.env.BASE_URL}ui/classes/${name.toLowerCase()}.png`} alt={name} />
      ))}
    </span>
  );
}

export const DEFAULT_COLUMNS: Column<MatchRow>[] = [
  { key: "rank", label: "#", tip: "Rank in the current order", text: ({ rank }) => String(rank) },
  { key: "played_at", label: "Played At", text: ({ match }) => formatPlayedAt(match.time) },
  { key: "map", label: "Map", text: ({ match }) => match.mapName },
  { key: "mode", label: "Mode", text: ({ match }) => (match.mode ? gameModeName(match.mode) : "Unknown") },
  { key: "type", label: "Type", text: ({ match }) => match.type },
  {
    key: "result",
    label: "Result",
    tip: "NO RESULT: no result data, such as MvM and abandoned matches",
    text: ({ match }) => OUTCOME_TEXT[match.outcome],
    render: ({ match }) => <span className={OUTCOME_CLASS[match.outcome]}>{OUTCOME_TEXT[match.outcome]}</span>,
  },
  {
    key: "team",
    label: "Team",
    text: ({ match }) => (match.team ? TEAM_TEXT[match.team] : ""),
    render: ({ match }) => (match.team ? <span className={`team-${match.team}`}>{TEAM_TEXT[match.team]}</span> : "-"),
  },
  {
    // Icons are 18px with 2px gaps, so the width is fixed rather than measured from the names
    key: "classes",
    label: "Classes",
    width: 200,
    text: ({ match }) => match.classes.join(", "),
    render: ({ match }) => <ClassIcons classes={match.classes} />,
  },
  {
    key: "score",
    label: "Score",
    pad: 40,
    text: ({ match }) => scoreText(match),
    render: ({ match }) => <ScoreBlocks match={match} />,
  },
  { key: "kills", label: "Kills", text: ({ match }) => (hasStats(match) ? formatNumber(match.kills) : "") },
  { key: "deaths", label: "Deaths", text: ({ match }) => (hasStats(match) ? formatNumber(match.deaths) : "") },
  { key: "kd", label: "K/D", tip: "Kills divided by deaths", text: ({ match }) => (hasStats(match) ? kdRatio(match.kills, match.deaths) : "") },
  { key: "damage", label: "Damage", text: ({ match }) => (hasStats(match) ? formatNumber(match.damage) : "") },
  { key: "healing", label: "Healing", text: ({ match }) => (hasStats(match) ? formatNumber(match.healing) : "") },
  {
    key: "support",
    label: "Support",
    tip: "Support score, as counted by the game",
    text: ({ match }) => (hasStats(match) ? formatNumber(match.support) : ""),
  },
  {
    key: "played_seconds",
    label: "Time played",
    tip: "Time in the match, from when you joined",
    text: ({ match }) => (hasStats(match) ? formatShortDuration(match.playedSeconds) : ""),
  },
  {
    key: "queue_seconds",
    label: "Queue",
    text: ({ match }) => (hasStats(match) ? formatShortDuration(match.queueSeconds) : ""),
  },
];

// Columns the raw view puts first, in this order
const PREFERRED_COLUMNS = [
  "match_id",
  "match_title",
  "connection_time",
  "game_mode",
  "type",
  "datacenter",
  "kills",
  "deaths",
  "damage",
  "healing",
  "support",
  "time_played_seconds",
  "match_duration",
  "time_in_queue",
  "winning_team",
  "result_team",
];

// time_played_seconds is computed, not in the CSV, but the raw view always shows it
const COMPUTED_TIME_KEY = "time_played_seconds";
const RAW_NUMBER_KEYS = new Set(["kills", "deaths", "damage", "healing"]);
const RAW_DURATION_KEYS = new Set([COMPUTED_TIME_KEY, "match_duration", "time_in_queue"]);

// Every CSV column of the matches, preferred columns first, then the rest sorted
function rawColumnKeys(matches: Match[]): string[] {
  const keys = new Set<string>([COMPUTED_TIME_KEY]);
  for (const match of matches) {
    for (const key of Object.keys(match.row)) keys.add(key);
  }
  const preferred = PREFERRED_COLUMNS.filter((key) => keys.has(key));
  const rest = [...keys].filter((key) => !PREFERRED_COLUMNS.includes(key)).sort();
  return [...preferred, ...rest];
}

// Raw cells are CSV strings. Empty numbers read as 0.
function rawValue(match: Match, key: string): string | number | undefined {
  if (key === COMPUTED_TIME_KEY) return match.playedSeconds;
  const value: string | undefined = match.row[key];
  return value;
}

function rawText(key: string, value: string | number | undefined): string {
  if (RAW_NUMBER_KEYS.has(key)) return formatNumber(cleanNumeric(String(value ?? "")));
  if (RAW_DURATION_KEYS.has(key)) return formatShortDuration(Number(value) || 0);
  if (typeof value === "string" && key.includes("time")) return formatMatchTime(value);
  if (typeof value === "string" && ["true", "false"].includes(value.toLowerCase())) {
    return value.toLowerCase() === "true" ? "Yes" : "No";
  }
  return value == null ? "" : String(value);
}

export function rawColumns(matches: Match[]): Column<MatchRow>[] {
  return rawColumnKeys(matches).map((key) => ({
    key,
    // base.css uppercases table headers, so only the underscores change here
    label: key.replace(/_/g, " "),
    text: ({ match }) => rawText(key, rawValue(match, key)),
  }));
}
