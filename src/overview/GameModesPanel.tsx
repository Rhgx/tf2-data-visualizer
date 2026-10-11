import { useMemo, useState, type CSSProperties } from "react";
import { Panel } from "../ui/Panel";
import { TextButton } from "../ui/Button";
import { barColor } from "../charts/theme";
import { gameModeName } from "../data/maps";
import { formatWinRate, type Match } from "../data/match";
import { formatNumber } from "../lib/format";
import { countOutcomes, winRateOf } from "./stats";

// Modes shown before the "Show all" button. Nine matches the class count, so Classes beside it is the same height.
const TOP_MODES = 9;

// CSSProperties has no custom properties, so --value and --bar-color are added to the type instead of casting the style object.
type BarStyle = CSSProperties & { "--value": number; "--bar-color": string };

interface GameModesPanelProps {
  // Matches per game mode, from groupMatches. Matches with no known mode are not in it.
  modes: Map<string, Match[]>;
}

// Matches per game mode, most played first. The top modes show first, and the rest are one click away.
export function GameModesPanel({ modes }: GameModesPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const ranked = useMemo(() => [...modes].sort((a, b) => b[1].length - a[1].length), [modes]);

  // Nothing to rank when every match lacks a mode, so the panel is left out (same as ClassesPanel)
  if (ranked.length === 0) return null;

  const largest = Math.max(1, ...ranked.map(([, list]) => list.length));
  // Colors and the bar scale come from the full ranking, so a mode keeps its color when the list expands
  const shown = expanded ? ranked : ranked.slice(0, TOP_MODES);

  // The toggle sits in the title row, so the list is the panel's only body and its well can match Classes beside it.
  // One header row, then a row per mode, laid out like the Classes list.
  return (
    <Panel
      className="modes-panel"
      title="Game modes"
      actions={
        ranked.length > TOP_MODES && (
          <TextButton className="modes-toggle" onClick={() => setExpanded(!expanded)}>
            {expanded ? "Show fewer" : `Show all (${formatNumber(ranked.length)})`}
          </TextButton>
        )
      }
    >
      <div className="well">
        <ol className="rank-list mode-list">
          <li className="rank-head">
            <span>Mode</span>
            <span />
            <span className="rank-num">Matches</span>
            <span className="rank-num">Win rate</span>
          </li>
          {shown.map(([mode, list], index) => {
            const style: BarStyle = { "--value": list.length / largest, "--bar-color": barColor(index) };
            return (
              <li key={mode} className="rank-row" style={style}>
                <span className="rank-name">{gameModeName(mode)}</span>
                <span className="bar-track">
                  <span className="bar-fill" />
                </span>
                <span className="rank-num rank-matches">{formatNumber(list.length)}</span>
                <span className="rank-num">{formatWinRate(winRateOf(countOutcomes(list)))}</span>
              </li>
            );
          })}
        </ol>
      </div>
    </Panel>
  );
}
