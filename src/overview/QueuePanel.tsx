import { useMemo, useState } from "react";
import type { ChartConfiguration, ChartDataset } from "chart.js";
import { ChartCanvas } from "../charts/Chart";
import { monthLabel, palette } from "../charts/theme";
import { Panel, PanelNote } from "../ui/Panel";
import { formatNumber, formatShortDuration } from "../lib/format";
import type { Match } from "../data/match";
import { ChoiceGroup, type Choice } from "./ActivityPanel";
import { gapSegments, samplePoints } from "./monthLine";
import { RecordList } from "./RecordList";
import {
  averageOf,
  LINE_STYLE,
  localTimeOf,
  matchRecord,
  monthBuckets,
  present,
  quantile,
  queueBins,
  sumOf,
  timedMatches,
  type RecordRow,
  type TimedMatch,
} from "./stats";

interface QueuePanelProps {
  queued: Match[];
  // Matches the player joined after they had started
  joined: number;
  onFocusMatch: (key: string) => void;
}

type QueueView = "spread" | "time" | "hour";

const VIEWS: Choice<QueueView>[] = [
  { value: "spread", label: "Spread" },
  { value: "time", label: "Over time" },
  { value: "hour", label: "Time of day" },
];

// The band edges only bound the shaded fill, so they draw no line and no hover dot of their own
const BAND_STYLE = { ...LINE_STYLE, borderWidth: 0, pointHoverRadius: 0 };
// Dataset index of the median line. The band datasets come first, so the median draws on top of them.
const MEDIAN = 2;

export function QueuePanel({ queued, joined, onFocusMatch }: QueuePanelProps) {
  const [view, setView] = useState<QueueView>("spread");
  const config = useMemo(() => queueConfig(queued, view), [queued, view]);
  const rows = useMemo(() => {
    const list: (RecordRow | null)[] = [
      { label: "Avg queue", value: formatShortDuration(averageOf(queued, "queueSeconds")) },
      { label: "Total queue", value: formatShortDuration(sumOf(queued, "queueSeconds")) },
      matchRecord("Longest queue", queued, (match) => match.queueSeconds, true, formatShortDuration),
      matchRecord("Shortest queue", queued, (match) => match.queueSeconds, false, formatShortDuration),
      { label: "Joined in progress", value: formatNumber(joined) },
    ];
    return present(list);
  }, [queued, joined]);

  if (queued.length === 0) {
    // Joined in progress does not need a queue time, so it still shows when no queue time was recorded
    return (
      <Panel className="queue-panel" title="Queue times">
        <PanelNote>No queue times recorded.</PanelNote>
        {joined > 0 && <RecordList rows={[{ label: "Joined in progress", value: formatNumber(joined) }]} />}
      </Panel>
    );
  }

  return (
    <Panel
      className="queue-panel"
      title="Queue times"
      actions={<ChoiceGroup label="View" choices={VIEWS} value={view} onChange={setView} />}
    >
      <div className="queue-body">
        {config ? (
          // Keyed by view, since a chart cannot change between bars and lines in place
          <ChartCanvas key={view} config={config} height={180} />
        ) : (
          <PanelNote>No queued matches have a recorded time.</PanelNote>
        )}
        <RecordList rows={rows} onFocusMatch={onFocusMatch} />
      </div>
    </Panel>
  );
}

// Null for a time view with no queued match that has a recorded time, so the panel shows a note instead of an empty chart
function queueConfig(queued: Match[], view: QueueView): ChartConfiguration<"bar" | "line"> | null {
  if (view === "spread") return spreadConfig(queued);
  const timed = timedMatches(queued);
  if (timed.length === 0) return null;
  return view === "time" ? overTimeConfig(timed) : timeOfDayConfig(timed);
}

function spreadConfig(queued: Match[]): ChartConfiguration<"bar" | "line"> {
  const bins = queueBins(queued.map((match) => match.queueSeconds));
  return {
    type: "bar",
    data: {
      labels: bins.labels,
      datasets: [{ label: "Matches", data: bins.counts, backgroundColor: palette.tan }],
    },
    options: {
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0, callback: (value) => formatNumber(Number(value)) } } },
    },
  };
}

// Queue times of the matches in one month or hour. Null for a bucket with no matches.
interface QueueSpread {
  count: number;
  median: number;
  low: number;
  high: number;
}

function spreadOf(matches: TimedMatch[]): QueueSpread | null {
  if (matches.length === 0) return null;
  const sorted = matches.map((match) => match.queueSeconds).sort((a, b) => a - b);
  return {
    count: sorted.length,
    median: quantile(sorted, 0.5),
    low: quantile(sorted, 0.25),
    high: quantile(sorted, 0.75),
  };
}

interface TimeAxis {
  // One per bucket. A blank label draws nothing on its tick.
  labels: string[];
  // Tooltip heading per bucket
  titles: string[];
  // Months let Chart.js thin the labels. The hour axis keeps its every-third labels, so Chart.js must not skip them.
  autoSkip: boolean;
}

function spreadChart(buckets: (QueueSpread | null)[], axis: TimeAxis): ChartConfiguration<"bar" | "line"> {
  const datasets: ChartDataset<"bar" | "line">[] = [
    {
      ...BAND_STYLE,
      type: "line",
      label: "75th percentile",
      data: buckets.map((bucket) => bucket?.high ?? null),
      backgroundColor: palette.tan + "59",
      fill: "+1",
      order: 2,
    },
    {
      ...BAND_STYLE,
      type: "line",
      label: "25th percentile",
      data: buckets.map((bucket) => bucket?.low ?? null),
      fill: false,
      order: 2,
    },
    {
      ...LINE_STYLE,
      ...gapSegments(palette.tan),
      ...samplePoints(palette.tan, buckets.map((bucket) => bucket?.count ?? 0), 2),
      type: "line",
      label: "Median",
      data: buckets.map((bucket) => bucket?.median ?? null),
      borderColor: palette.tan,
      backgroundColor: palette.tan,
      spanGaps: true,
      order: 1,
    },
  ];

  return {
    type: "line",
    data: { labels: axis.labels, datasets },
    options: {
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          // Only the median is listed, so the two band edges do not add lines of their own
          filter: (item) => item.datasetIndex === MEDIAN,
          callbacks: {
            title: (items) => axis.titles[items[0].dataIndex],
            label: (item) => {
              const bucket = buckets[item.dataIndex];
              if (bucket === null) return "No queued matches";
              return [
                `Median: ${formatShortDuration(bucket.median)}`,
                `25-75%: ${formatShortDuration(bucket.low)} to ${formatShortDuration(bucket.high)}`,
                `Matches: ${formatNumber(bucket.count)}`,
              ];
            },
          },
        },
      },
      scales: {
        x: { ticks: { maxRotation: 0, autoSkip: axis.autoSkip } },
        y: { beginAtZero: true, ticks: { callback: (value) => formatShortDuration(Number(value)) } },
      },
    },
  };
}

function overTimeConfig(timed: TimedMatch[]): ChartConfiguration<"bar" | "line"> {
  const months = monthBuckets(timed);
  const labels = months.map((month) => monthLabel(month.key));
  return spreadChart(
    months.map((month) => spreadOf(month.matches)),
    { labels, titles: labels, autoSkip: true }
  );
}

function timeOfDayConfig(timed: TimedMatch[]): ChartConfiguration<"bar" | "line"> {
  const hours = Array.from({ length: 24 }, (_, hour) => spreadOf(timed.filter((match) => localTimeOf(match).hour === hour)));
  // Every third hour is labelled, as on the weekday by hour heatmap
  const labels = hours.map((_, hour) => (hour % 3 === 0 ? String(hour).padStart(2, "0") : ""));
  const titles = hours.map((_, hour) => `${String(hour).padStart(2, "0")}:00`);
  return spreadChart(hours, { labels, titles, autoSkip: false });
}
