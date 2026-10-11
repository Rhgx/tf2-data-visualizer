import { memo, useMemo, type JSX } from "react";
import type { Match } from "../data/match";
import { Panel, PanelNote } from "../ui/Panel";
import { ActivityPanel } from "./ActivityPanel";
import { QueuePanel } from "./QueuePanel";
import { timedMatches } from "./stats";
import "./overview.css";

interface ActivityTabProps {
  matches: Match[];
  // The first timed match across all data, not only the filtered matches
  firstTime: number | null;
  onFocusMatch: (key: string) => void;
  // Opens the Matches tab searched for a day, given as YYYY-MM-DD
  onShowDay: (dateKey: string) => void;
}

// Memoized, so a render of the dashboard for another tab or a filter typed in a dropdown leaves it alone
export const ActivityTab = memo(function ActivityTab({ matches, firstTime, onFocusMatch, onShowDay }: ActivityTabProps): JSX.Element {
  const timed = useMemo(() => timedMatches(matches), [matches]);
  // Only the queued matches and the joined count are needed here, so this is a single pass with the same rules as groupMatches
  const queue = useMemo(() => {
    const queued: Match[] = [];
    let joined = 0;
    for (const match of matches) {
      if (match.queueSeconds > 0) queued.push(match);
      if (match.joinedMidway) joined++;
    }
    return { queued, joined };
  }, [matches]);
  const untimed = matches.length - timed.length;

  if (matches.length === 0) {
    return (
      <div className="tab-panel">
        <Panel title="Activity">
          <PanelNote>No matches with the current filters.</PanelNote>
        </Panel>
      </div>
    );
  }

  return (
    <div className="tab-panel">
      <ActivityPanel timed={timed} untimed={untimed} firstTime={firstTime} onShowDay={onShowDay} />
      <QueuePanel queued={queue.queued} joined={queue.joined} onFocusMatch={onFocusMatch} />
    </div>
  );
});
