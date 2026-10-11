import type { CSSProperties } from "react";
import { Panel } from "../ui/Panel";
import { formatWinRate, type Match, type Team } from "../data/match";
import { formatNumber } from "../lib/format";
import { countOutcomes, OUTCOME_SPLIT, percent, TEAMS, winRateOf, type OverviewGroups } from "./stats";

// CSSProperties has no custom properties, so --value is added to the type instead of casting the style object.
type SplitStyle = CSSProperties & { "--value": number };

// Every split segment and key shares this note, since the header win rate leaves no-result matches out
const SPLIT_TIP = "Share of all matches, including no-result ones. Win rate leaves those out";
// Same reasoning for the team halves: the rate leaves no-result matches out, the match count does not
const TEAM_TIP = "Wins divided by wins, losses and stalemates. No-result matches are left out of the rate, but not the match count";

interface ResultsPanelProps {
  matches: Match[];
  groups: OverviewGroups;
}

export function ResultsPanel({ matches, groups }: ResultsPanelProps) {
  const counts = groups.outcomes;
  const total = matches.length;
  return (
    <Panel title="Results">
      <div className="split-bar">
        {OUTCOME_SPLIT.map((row) => {
          const style: SplitStyle = { "--value": counts[row.outcome] / total };
          return <span key={row.className} className={`split-segment split-${row.className}`} style={style} data-tip={SPLIT_TIP} />;
        })}
      </div>
      <div className="split-legend">
        {OUTCOME_SPLIT.map((row) => (
          <div key={row.className} className={`split-key outcome-${row.className}`} data-tip={SPLIT_TIP}>
            <span className="split-count">{formatNumber(counts[row.outcome])}</span>
            <span className="split-name">{row.label}</span>
            <span className="split-pct">{percent(counts[row.outcome], total)}</span>
          </div>
        ))}
      </div>
      <TeamScores teams={groups.teams} />
    </Panel>
  );
}

interface TeamScoresProps {
  teams: Map<Team, Match[]>;
}

// Scoreboard-style RED and BLU halves, each led by the team's win rate. Hidden when no match has a recorded team.
function TeamScores({ teams }: TeamScoresProps) {
  if (teams.size === 0) return null;
  return (
    <div className="team-scores">
      {TEAMS.map(({ team, name }) => {
        const list = teams.get(team) ?? [];
        const counts = countOutcomes(list);
        return (
          <div key={team} className={`team-score team-score-${team}`} data-tip={TEAM_TIP}>
            <header className={`team-${team}`}>{name}</header>
            <span className="team-score-rate">{formatWinRate(winRateOf(counts))}</span>
            <span className="team-score-note">{`${formatNumber(counts.wins)} wins of ${formatNumber(list.length)} matches`}</span>
          </div>
        );
      })}
    </div>
  );
}
