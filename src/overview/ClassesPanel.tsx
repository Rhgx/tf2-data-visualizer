import { useMemo, type CSSProperties } from "react";
import { Panel } from "../ui/Panel";
import { formatNumber } from "../lib/format";
import { formatWinRate, kdRatio, TF_CLASSES, type Match } from "../data/match";
import { countOutcomes, sumOf, winRateOf } from "./stats";

// CSSProperties has no custom properties, so --value is added to the type instead of casting the style object.
type BarStyle = CSSProperties & { "--value": number };

interface ClassesPanelProps {
  // Matches per class, from groupMatches. A match is in the list of every class it was played as.
  classes: Map<string, Match[]>;
}

// Matches per class, ranked. A match counts toward every class it was played as.
export function ClassesPanel({ classes }: ClassesPanelProps) {
  const ranked = useMemo(
    () =>
      TF_CLASSES.map((name) => ({
        name,
        list: classes.get(name) ?? [],
      })).sort((a, b) => b.list.length - a.list.length),
    [classes]
  );

  // Older exports have no class column, so the panel is left out rather than showing all zeros
  if (classes.size === 0) return null;

  const largest = Math.max(1, ...ranked.map(({ list }) => list.length));

  // One header row, then a row per class. The numbers are in fixed right-aligned columns after the bar.
  return (
    <Panel className="classes-panel" title="Classes" tip="A match counts for every class you played in it">
      <div className="well">
        <ol className="rank-list">
          <li className="rank-head">
            <span>Class</span>
            <span />
            <span className="rank-num">Matches</span>
            <span className="rank-num">Win rate</span>
            <span className="rank-num">K/D</span>
          </li>
          {ranked.map(({ name, list }) => {
            const style: BarStyle = { "--value": list.length / largest };
            return (
              <li key={name} className="rank-row" style={style}>
                <span className="rank-name">
                  <img className="class-icon" src={`${import.meta.env.BASE_URL}ui/classes/${name.toLowerCase()}.png`} alt="" />
                  {name}
                </span>
                <span className="bar-track">
                  <span className="bar-fill" />
                </span>
                <span className="rank-num rank-matches">{formatNumber(list.length)}</span>
                <span className="rank-num">{formatWinRate(winRateOf(countOutcomes(list)))}</span>
                <span className="rank-num">{list.length ? kdRatio(sumOf(list, "kills"), sumOf(list, "deaths")) : "-"}</span>
              </li>
            );
          })}
        </ol>
      </div>
    </Panel>
  );
}
