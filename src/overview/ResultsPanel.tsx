import { useMemo, type CSSProperties } from "react";
import { Panel } from "../ui/Panel";
import { formatWinRate, type Match, type Team } from "../data/match";
import { formatNumber } from "../lib/format";
import { RecordList } from "./RecordList";
import {
  averageText,
  countOutcomes,
  OUTCOME_SPLIT,
  percent,
  TEAMS,
  winRateOf,
  hasStats,
  type OverviewGroups,
  type RecordRow,
} from "./stats";

// CSSProperties has no custom properties, so --value is added to the type instead of casting the style object.
type SplitStyle = CSSProperties & { "--value": number };

// Every split segment and key shares this note, since the header win rate leaves no-result matches out
const SPLIT_TIP = "Share of all matches, including no-result ones. Win rate leaves those out";

interface ResultsPanelProps {
  matches: Match[];
  groups: OverviewGroups;
  onFocusMatch: (key: string) => void;
}

export function ResultsPanel({ matches, groups, onFocusMatch }: ResultsPanelProps) {
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
      <TeamColumns teams={groups.teams} onFocusMatch={onFocusMatch} />
    </Panel>
  );
}

interface TeamColumnsProps {
  teams: Map<Team, Match[]>;
  onFocusMatch: (key: string) => void;
}

// Scoreboard-style RED and BLU columns. Hidden when no match has a recorded team.
function TeamColumns({ teams, onFocusMatch }: TeamColumnsProps) {
  const columns = useMemo(
    () =>
      TEAMS.map(({ team, name }) => {
        const list = teams.get(team) ?? [];
        const scored = list.filter(hasStats);
        const counts = countOutcomes(list);
        const rows: RecordRow[] = [
          { label: "Matches", value: formatNumber(list.length) },
          { label: "Wins", value: formatNumber(counts.wins) },
          { label: "Win rate", value: formatWinRate(winRateOf(counts)) },
          { label: "Avg kills", value: averageText(scored, "kills", 2) },
          { label: "Avg damage", value: averageText(scored, "damage", 1) },
        ];
        return { team, name, rows };
      }),
    [teams]
  );

  if (teams.size === 0) return null;
  return (
    <div className="team-columns">
      {columns.map(({ team, name, rows }) => (
        <div key={team} className="team-column">
          <header className={`team-${team}`}>{name}</header>
          <RecordList rows={rows} onFocusMatch={onFocusMatch} />
        </div>
      ))}
    </div>
  );
}
