import { useMemo } from "react";
import { Panel } from "../ui/Panel";
import { formatNumber, formatShortDuration } from "../lib/format";
import type { Match } from "../data/match";
import { RecordList } from "./RecordList";
import { matchRecord, present, type OverviewGroups, type RecordRow } from "./stats";

interface RecordsPanelProps {
  matches: Match[];
  groups: OverviewGroups;
  onFocusMatch: (key: string) => void;
}

// Single-match records only. Queue records live in Queue times, and time totals are in the HUD.
export function RecordsPanel({ matches, groups, onFocusMatch }: RecordsPanelProps) {
  const { played } = groups;
  const rows = useMemo(() => {
    const list: (RecordRow | null)[] = [
      matchRecord("Most kills", matches, (match) => match.kills, true, formatNumber),
      matchRecord("Most deaths", matches, (match) => match.deaths, true, formatNumber),
      matchRecord("Most damage", matches, (match) => match.damage, true, formatNumber),
      matchRecord("Most healing", matches, (match) => match.healing, true, formatNumber),
      matchRecord("Most support", matches, (match) => match.support, true, formatNumber),
      matchRecord("Longest time played", played, (match) => match.playedSeconds, true, formatShortDuration),
    ];
    return present(list);
  }, [matches, played]);

  return (
    <Panel className="records-panel" title="Records" tip="Best single matches. View opens the match in the Matches tab">
      <RecordList rows={rows} onFocusMatch={onFocusMatch} />
    </Panel>
  );
}
