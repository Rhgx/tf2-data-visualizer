import type { JSX, ReactNode } from "react";
import { cleanNumeric } from "../data/csv";
import { datacenterOf } from "../data/datacenters";
import type { Match } from "../data/match";
import { gameModeName } from "../data/maps";
import { formatNumber, formatShortDuration } from "../lib/format";
import { hasStats, ScoreBlocks, TEAM_TEXT } from "./columns";

// The medal columns and the names shown for them. A medal column is 0 when no medal was earned; its other values are not
// decoded here, so only the names show.
const MEDALS: [string, string][] = [
  ["score_medal", "Score"],
  ["kills_medal", "Kills"],
  ["damage_medal", "Damage"],
  ["healing_medal", "Healing"],
  ["support_medal", "Support"],
];

function Field({ label, children }: { label: string; children: ReactNode }): JSX.Element {
  return (
    <div className="match-detail-field">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

// The fields behind a row. A field the match has no value for is left out rather than shown as a dash.
export function MatchDetail({ match }: { match: Match }): JSX.Element {
  const { row } = match;
  const stats = hasStats(match);
  const medals = MEDALS.filter(([key]) => cleanNumeric(row[key]) !== 0).map(([, name]) => name);
  const ping = cleanNumeric(row.result_ping) || cleanNumeric(row.ping_estimate_at_join);
  const datacenter = datacenterOf(match.datacenter);
  return (
    <dl className="match-detail">
      {match.team && (
        <Field label="Team">
          <span className={`team-${match.team}`}>{TEAM_TEXT[match.team]}</span>
        </Field>
      )}
      {match.redScore !== null && match.bluScore !== null && (
        <Field label="Score">
          <ScoreBlocks match={match} />
        </Field>
      )}
      <Field label="Mode">{match.mode ? gameModeName(match.mode) : "Unknown"}</Field>
      <Field label="Type">{match.type}</Field>
      {stats && <Field label="Healing">{formatNumber(match.healing)}</Field>}
      {stats && <Field label="Support">{formatNumber(match.support)}</Field>}
      {medals.length > 0 && <Field label="Medals">{medals.join(", ")}</Field>}
      {stats && <Field label="Queue time">{formatShortDuration(match.queueSeconds)}</Field>}
      {stats && <Field label="Time played">{formatShortDuration(match.playedSeconds)}</Field>}
      {stats && match.durationSeconds > 0 && <Field label="Match duration">{formatShortDuration(match.durationSeconds)}</Field>}
      <Field label="Joined in progress">{match.joinedMidway ? "Yes" : "No"}</Field>
      {match.datacenter && (
        <Field label="Datacenter">
          <span className="match-datacenter" data-tip={`${datacenter.name}, ${match.datacenter}`}>
            {datacenter.country && (
              <img className="flag" src={`${import.meta.env.BASE_URL}ui/flags/${datacenter.country.toLowerCase()}.svg`} alt="" />
            )}
            {datacenter.short}
          </span>
        </Field>
      )}
      {ping > 0 && <Field label="Ping">{`${formatNumber(ping)} ms`}</Field>}
    </dl>
  );
}
