import { useMemo } from "react";
import { HudStat } from "../ui/HudStat";
import { formatHours, formatNumber, formatShortDuration } from "../lib/format";
import { formatWinRate, kdRatio, type Match } from "../data/match";
import { averageOf, sumOf, winRateOf, type OverviewGroups } from "./stats";

interface HudStripProps {
  matches: Match[];
  groups: OverviewGroups;
}

export function HudStrip({ matches, groups }: HudStripProps) {
  const values = useMemo(
    () => ({
      winRate: formatWinRate(winRateOf(groups.outcomes)),
      kd: kdRatio(sumOf(groups.scored, "kills"), sumOf(groups.scored, "deaths")),
      played: formatHours(sumOf(groups.played, "playedSeconds")),
      queue: groups.queued.length ? formatShortDuration(averageOf(groups.queued, "queueSeconds")) : "N/A",
    }),
    [groups]
  );

  return (
    <section className="hud-strip">
      <HudStat value={formatNumber(matches.length)} label="Matches" />
      <HudStat
        value={values.winRate}
        label="Win rate"
        tip="Wins divided by wins, losses and stalemates. No-result matches (MvM, abandoned) are left out"
      />
      <HudStat
        value={values.kd}
        label="K/D"
        tip="Total kills divided by total deaths, over matches with a result"
      />
      <HudStat
        value={values.played}
        label="Time played"
        tip="Time from joining to leaving each match, capped at its length. Without join and leave times, a match counts in full, or not at all if you joined in progress"
      />
      <HudStat
        value={values.queue}
        label="Avg queue"
        tip="Average matchmaking queue time, over matches with a recorded queue"
      />
    </section>
  );
}
