import { memo, useMemo, type JSX } from "react";
import type { Match } from "../data/match";
import { Panel, PanelNote } from "../ui/Panel";
import { ActivityPanel } from "./ActivityPanel";
import { ClassesPanel } from "./ClassesPanel";
import { FormPanel } from "./FormPanel";
import { GameModesPanel } from "./GameModesPanel";
import { HudStrip } from "./HudStrip";
import { PerMatchPanel } from "./PerMatchPanel";
import { QueuePanel } from "./QueuePanel";
import { RecordsPanel } from "./RecordsPanel";
import { ResultsPanel } from "./ResultsPanel";
import { groupMatches, monthBuckets, timedMatches } from "./stats";
import "./overview.css";

interface OverviewTabProps {
  matches: Match[];
  // The first timed match across all data, not only the filtered matches
  firstTime: number | null;
  onFocusMatch: (key: string) => void;
  // Opens the Matches tab searched for a day, given as YYYY-MM-DD
  onShowDay: (dateKey: string) => void;
}

// Memoized, so a render of the dashboard for another tab or a filter typed in a dropdown leaves it alone
export const OverviewTab = memo(function OverviewTab({ matches, firstTime, onFocusMatch, onShowDay }: OverviewTabProps): JSX.Element {
  // Shared inputs for several panels, computed once per filter change
  const timed = useMemo(() => timedMatches(matches), [matches]);
  const months = useMemo(() => monthBuckets(timed), [timed]);
  const groups = useMemo(() => groupMatches(matches), [matches]);
  const untimed = matches.length - timed.length;

  if (matches.length === 0) {
    return (
      <div className="tab-panel">
        <Panel title="Overview">
          <PanelNote>No matches with the current filters.</PanelNote>
        </Panel>
      </div>
    );
  }

  // The two lower stacks are independent columns, so a short panel is not stretched to match a tall one.
  // Below 900px they become one column in the order Game modes, Classes, Queue times, Records (see overview.css).
  return (
    <div className="tab-panel">
      <HudStrip matches={matches} groups={groups} />
      <ResultsPanel matches={matches} groups={groups} onFocusMatch={onFocusMatch} />
      <ActivityPanel timed={timed} untimed={untimed} firstTime={firstTime} onShowDay={onShowDay} />
      <FormPanel timed={timed} months={months} />
      <PerMatchPanel scored={groups.scored} hasTimed={timed.length > 0} months={months} />
      <div className="overview-split">
        <div className="stack">
          <GameModesPanel modes={groups.modes} />
          <QueuePanel queued={groups.queued} onFocusMatch={onFocusMatch} />
        </div>
        <div className="stack">
          <ClassesPanel classes={groups.classes} />
          <RecordsPanel matches={matches} groups={groups} onFocusMatch={onFocusMatch} />
        </div>
      </div>
    </div>
  );
});
