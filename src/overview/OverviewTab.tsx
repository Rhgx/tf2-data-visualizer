import { memo, useMemo, type JSX } from "react";
import type { Match } from "../data/match";
import { Panel, PanelNote } from "../ui/Panel";
import { ClassesPanel } from "./ClassesPanel";
import { GameModesPanel } from "./GameModesPanel";
import { HudStrip } from "./HudStrip";
import { PerMatchPanel } from "./PerMatchPanel";
import { RecordsPanel } from "./RecordsPanel";
import { ResultsPanel } from "./ResultsPanel";
import { groupMatches } from "./stats";
import "./overview.css";

interface OverviewTabProps {
  matches: Match[];
  onFocusMatch: (key: string) => void;
}

// Memoized, so a render of the dashboard for another tab or a filter typed in a dropdown leaves it alone
export const OverviewTab = memo(function OverviewTab({ matches, onFocusMatch }: OverviewTabProps): JSX.Element {
  // Shared inputs for several panels, computed once per filter change
  const groups = useMemo(() => groupMatches(matches), [matches]);

  if (matches.length === 0) {
    return (
      <div className="tab-panel">
        <Panel title="Overview">
          <PanelNote>No matches with the current filters.</PanelNote>
        </Panel>
      </div>
    );
  }

  // Two rows of two panels: Game modes | Classes, then Records | Per match. Each row's panels stretch to the same height.
  // Below 900px the grid is one column in DOM order, which is the same order (see overview.css).
  return (
    <div className="tab-panel">
      <HudStrip matches={matches} groups={groups} />
      <ResultsPanel matches={matches} groups={groups} />
      <div className="overview-grid">
        <GameModesPanel modes={groups.modes} />
        <ClassesPanel classes={groups.classes} />
        <RecordsPanel matches={matches} groups={groups} onFocusMatch={onFocusMatch} />
        <PerMatchPanel scored={groups.scored} played={groups.played} />
      </div>
    </div>
  );
});
