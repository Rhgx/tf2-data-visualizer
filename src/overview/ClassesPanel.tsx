import { useMemo } from "react";
import { palette } from "../charts/theme";
import { Panel } from "../ui/Panel";
import { BarList, BarRow } from "../ui/BarList";
import { formatNumber } from "../lib/format";
import { formatWinRate, kdRatio, TF_CLASSES, type Match } from "../data/match";
import { countOutcomes, sumOf, winRateOf } from "./stats";

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

  return (
    <Panel className="classes-panel" title="Classes" tip="A match counts for every class you played in it">
      <div className="well">
        <BarList>
          {ranked.map(({ name, list }) => (
            <BarRow
              key={name}
              label={
                <>
                  <img className="class-icon" src={`${import.meta.env.BASE_URL}ui/classes/${name.toLowerCase()}.png`} alt="" />
                  {name}
                </>
              }
              value={list.length}
              max={largest}
              color={palette.orange}
              valueText={formatNumber(list.length)}
              extra={list.length ? `${formatWinRate(winRateOf(countOutcomes(list)))} win, ${kdRatio(sumOf(list, "kills"), sumOf(list, "deaths"))} K/D` : undefined}
            />
          ))}
        </BarList>
      </div>
    </Panel>
  );
}
