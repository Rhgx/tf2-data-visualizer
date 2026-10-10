import { useMemo } from "react";
import { Panel } from "../ui/Panel";
import { formatNumber, formatShortDuration } from "../lib/format";
import type { Match } from "../data/match";
import { RecordList } from "./RecordList";
import { averageOf, matchRecord, present, sumOf, type OverviewGroups, type RecordRow } from "./stats";

interface RecordsPanelProps {
  matches: Match[];
  groups: OverviewGroups;
  onFocusMatch: (key: string) => void;
}

export function RecordsPanel({ matches, groups, onFocusMatch }: RecordsPanelProps) {
  const { queued, played, joined } = groups;
  const rows = useMemo(() => {
    const list: (RecordRow | null)[] = [
      matchRecord("Most kills", matches, (match) => match.kills, true, formatNumber),
      matchRecord("Most deaths", matches, (match) => match.deaths, true, formatNumber),
      matchRecord("Most damage", matches, (match) => match.damage, true, formatNumber),
      matchRecord("Most healing", matches, (match) => match.healing, true, formatNumber),
      matchRecord("Most support", matches, (match) => match.support, true, formatNumber),
      matchRecord("Longest time played", played, (match) => match.playedSeconds, true, formatShortDuration),
      matchRecord("Shortest time played", played, (match) => match.playedSeconds, false, formatShortDuration),
      matchRecord("Longest queue", queued, (match) => match.queueSeconds, true, formatShortDuration),
      matchRecord("Shortest queue", queued, (match) => match.queueSeconds, false, formatShortDuration),
      { label: "Joined in progress", value: formatNumber(joined) },
      played.length ? { label: "Avg time played", value: formatShortDuration(averageOf(played, "playedSeconds")) } : null,
      { label: "Total time played", value: formatShortDuration(sumOf(played, "playedSeconds")) },
    ];
    return present(list);
  }, [matches, queued, played, joined]);

  return (
    <Panel className="records-panel" title="Records" tip="Best and worst single matches. View opens the match in the Matches tab">
      <RecordList rows={rows} onFocusMatch={onFocusMatch} />
    </Panel>
  );
}
