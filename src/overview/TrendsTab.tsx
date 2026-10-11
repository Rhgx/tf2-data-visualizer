import { memo, useMemo, useState, type JSX } from "react";
import type { Match } from "../data/match";
import { monthLabel } from "../charts/theme";
import { HudStat } from "../ui/HudStat";
import { Panel, PanelNote } from "../ui/Panel";
import { METRICS, TrendsPanel, type TrendMetric } from "./TrendsPanel";
import { LOW_SAMPLE_MATCHES, resultCount } from "./monthLine";
import { monthBuckets, timedMatches, type MonthBucket } from "./stats";
import "./overview.css";
import "./trends.css";

interface TrendsTabProps {
  matches: Match[];
}

// A month below LOW_SAMPLE_MATCHES is too thin to be the best or worst month. The same threshold draws hollow points in monthLine.ts.
// The "Last 12 months" stat covers this many months of data, the latest month included
const RECENT_MONTHS = 12;

interface RankedMonth {
  value: number;
  key: string;
}

// The highest and lowest month with enough matches behind it. Ties keep the earlier month.
function rankMonths(metric: TrendMetric, months: MonthBucket[]): { best: RankedMonth | null; worst: RankedMonth | null } {
  let best: RankedMonth | null = null;
  let worst: RankedMonth | null = null;
  for (const month of months) {
    // Counts are judged by their matches. Rates and averages are judged by the matches with a result, the sample behind a hollow point.
    const sample = metric.bars ? month.matches.length : resultCount(month);
    const value = sample >= LOW_SAMPLE_MATCHES ? metric.value(month.matches) : null;
    if (value === null) continue;
    if (best === null || value > best.value) best = { value, key: month.key };
    if (worst === null || value < worst.value) worst = { value, key: month.key };
  }
  return { best, worst };
}

// Memoized, so a render of the dashboard for another tab or a filter typed in a dropdown leaves it alone
export const TrendsTab = memo(function TrendsTab({ matches }: TrendsTabProps): JSX.Element {
  const timed = useMemo(() => timedMatches(matches), [matches]);
  const months = useMemo(() => monthBuckets(timed), [timed]);
  const [metric, setMetric] = useState(METRICS[0]);
  const ranked = useMemo(() => rankMonths(metric, months), [metric, months]);
  const allTime = useMemo(() => metric.value(timed), [metric, timed]);
  const recent = useMemo(() => metric.value(months.slice(-RECENT_MONTHS).flatMap((month) => month.matches)), [metric, months]);

  if (matches.length === 0) {
    return (
      <div className="tab-panel">
        <Panel title="Trends">
          <PanelNote>No matches with the current filters.</PanelNote>
        </Panel>
      </div>
    );
  }

  // A null value (no month qualifies, or nothing to average) shows as N/A
  const show = (value: number | null) => (value === null ? "N/A" : metric.format(value));

  return (
    <div className="tab-panel fill">
      {timed.length > 0 && (
        <section className="hud-strip">
          <HudStat value={show(allTime)} label="All time" tip="The selected metric over every match with a recorded time" />
          <HudStat
            value={show(ranked.best?.value ?? null)}
            label={ranked.best ? `Best month: ${monthLabel(ranked.best.key)}` : "Best month"}
            tip={`Highest month with at least ${LOW_SAMPLE_MATCHES} matches behind it (matches with a result for rates and averages)`}
          />
          <HudStat
            value={show(ranked.worst?.value ?? null)}
            label={ranked.worst ? `Worst month: ${monthLabel(ranked.worst.key)}` : "Worst month"}
            tip={`Lowest month with at least ${LOW_SAMPLE_MATCHES} matches behind it (matches with a result for rates and averages)`}
          />
          <HudStat
            value={show(recent)}
            label="Last 12 months"
            tip={`The selected metric over the last ${RECENT_MONTHS} months of data, up to the latest month`}
          />
        </section>
      )}
      <TrendsPanel timed={timed} months={months} metric={metric} onMetricChange={setMetric} />
    </div>
  );
});
