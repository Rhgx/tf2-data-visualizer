import { HudStat } from "../ui/HudStat";
import { Panel } from "../ui/Panel";
import { formatShortDuration } from "../lib/format";
import type { Match } from "../data/match";
import { averageOf, averageText } from "./stats";

interface PerMatchPanelProps {
  // Matches with a result, the only ones the stat averages use
  scored: Match[];
  // Matches with a played time, the only ones the time average uses
  played: Match[];
}

// Six averages in a 2 x 3 grid. The grid stretches to the Records panel beside it, so its rows spread over that height.
export function PerMatchPanel({ scored, played }: PerMatchPanelProps) {
  return (
    <Panel className="per-match-panel" title="Per match" tip="Averages per match, over matches with a result">
      <div className="well">
        <div className="multiples">
          <HudStat value={averageText(scored, "kills", 1)} label="Kills per match" />
          <HudStat value={averageText(scored, "deaths", 1)} label="Deaths per match" />
          <HudStat value={averageText(scored, "damage", 1)} label="Damage per match" />
          <HudStat value={averageText(scored, "healing", 1)} label="Healing per match" />
          <HudStat value={averageText(scored, "support", 1)} label="Support per match" />
          <HudStat
            value={played.length ? formatShortDuration(averageOf(played, "playedSeconds")) : "N/A"}
            label="Time played per match"
            tip="Over matches with a played time"
          />
        </div>
      </div>
    </Panel>
  );
}
