import { useMemo } from "react";
import { Panel } from "../ui/Panel";
import { BarList, BarRow } from "../ui/BarList";
import { barColor } from "../charts/theme";
import { gameModeName } from "../data/maps";
import { formatWinRate, type Match } from "../data/match";
import { formatNumber } from "../lib/format";
import { countOutcomes, winRateOf } from "./stats";

interface GameModesPanelProps {
  // Matches per game mode, from groupMatches. Matches with no known mode are not in it.
  modes: Map<string, Match[]>;
}

// Matches per game mode, most played first.
export function GameModesPanel({ modes }: GameModesPanelProps) {
  const ranked = useMemo(() => [...modes].sort((a, b) => b[1].length - a[1].length), [modes]);

  // Nothing to rank when every match lacks a mode, so the panel is left out (same as ClassesPanel)
  if (ranked.length === 0) return null;

  const largest = Math.max(1, ...ranked.map(([, list]) => list.length));

  return (
    <Panel className="modes-panel" title="Game modes">
      <div className="well">
        <BarList>
          {ranked.map(([mode, list], index) => (
            <BarRow
              key={mode}
              label={gameModeName(mode)}
              value={list.length}
              max={largest}
              color={barColor(index)}
              valueText={formatNumber(list.length)}
              extra={`${formatWinRate(winRateOf(countOutcomes(list)))} win`}
            />
          ))}
        </BarList>
      </div>
    </Panel>
  );
}
