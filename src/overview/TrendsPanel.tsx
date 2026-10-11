import { useMemo } from "react";
import type { ChartConfiguration, ChartDataset, Tick } from "chart.js";
import { ChartCanvas } from "../charts/Chart";
import { monthLabel, palette } from "../charts/theme";
import { SelectField } from "../ui/Field";
import { Panel, PanelNote } from "../ui/Panel";
import { formatNumber } from "../lib/format";
import { hasStats, LINE_STYLE, monthKd, monthWinPercent, type MonthBucket, type StatField, statAverage, type TimedMatch } from "./stats";
import { emptyMonthNote, gapSegments, resultCount, samplePoints, type Series, seriesLabel } from "./monthLine";

type TrendKey = "winRate" | "kd" | "matches" | StatField;

export interface TrendMetric {
  key: TrendKey;
  label: string;
  color: string;
  // Matches is a count, drawn as bars. The rest are rates or averages, drawn as lines with a sample size per month.
  bars: boolean;
  beginAtZero: boolean;
  max?: number;
  // Null for a month with no value, which leaves a gap in the line
  value: (list: TimedMatch[]) => number | null;
  // Tooltip text for one value
  format: (value: number) => string;
  // Axis label text
  tick: (value: number, ticks: Tick[]) => string;
}

// Ticks less than 1 apart need a decimal, or a small range repeats labels like "0"
function tickDecimals(ticks: Tick[]): number {
  return ticks.length > 1 && ticks[1].value - ticks[0].value < 1 ? 1 : 0;
}

function averageMetric(field: StatField, label: string, color: string): TrendMetric {
  return {
    key: field,
    label,
    color,
    bars: false,
    beginAtZero: false,
    value: (list) => statAverage(list, field),
    format: (value) => formatNumber(value, 1),
    tick: (value, ticks) => formatNumber(value, tickDecimals(ticks)),
  };
}

export const METRICS: TrendMetric[] = [
  {
    key: "winRate",
    label: "Win rate",
    color: palette.positive,
    bars: false,
    beginAtZero: true,
    max: 100,
    value: monthWinPercent,
    format: (value) => `${formatNumber(value, 1)}%`,
    tick: (value) => `${formatNumber(value)}%`,
  },
  {
    key: "kd",
    label: "K/D",
    color: palette.orange,
    bars: false,
    beginAtZero: true,
    value: (list) => monthKd(list.filter(hasStats)),
    format: (value) => value.toFixed(2),
    tick: (value) => value.toFixed(2),
  },
  {
    key: "matches",
    label: "Matches",
    color: palette.tan,
    bars: true,
    beginAtZero: true,
    value: (list) => list.length,
    format: (value) => formatNumber(value),
    tick: (value) => formatNumber(value),
  },
  averageMetric("kills", "Kills", palette.red),
  averageMetric("deaths", "Deaths", palette.blu),
  averageMetric("damage", "Damage", palette.orange),
  averageMetric("healing", "Healing", palette.olive),
];

const METRIC_OPTIONS = METRICS.map((metric) => ({ value: metric.key, label: metric.label }));

interface TrendsPanelProps {
  timed: TimedMatch[];
  months: MonthBucket[];
  // The metric is owned by TrendsTab, since the HUD strip above the chart follows it too
  metric: TrendMetric;
  onMetricChange: (metric: TrendMetric) => void;
}

export function TrendsPanel({ timed, months, metric, onMetricChange }: TrendsPanelProps) {
  const config = useMemo(() => trendConfig(metric, months), [metric, months]);

  // The select gives back a string, so the metric is looked up by its key
  function selectMetric(key: string) {
    const next = METRICS.find((option) => option.key === key);
    if (next) onMetricChange(next);
  }

  const controls = <SelectField label="Metric" value={metric.key} options={METRIC_OPTIONS} onChange={selectMetric} />;

  return (
    <Panel
      className="trends-panel"
      title="Trends"
      tip="One value per month, from matches with a recorded time"
      actions={timed.length > 0 ? controls : undefined}
    >
      {timed.length === 0 ? (
        <PanelNote>No matches have a recorded time.</PanelNote>
      ) : (
        // Keyed by metric, since a chart cannot change between bars and lines in place
        <ChartCanvas key={metric.key} className="trends-chart" config={config} />
      )}
    </Panel>
  );
}

function trendConfig(metric: TrendMetric, months: MonthBucket[]): ChartConfiguration<"bar" | "line"> {
  const values = months.map((month) => metric.value(month.matches));
  const samples = months.map(resultCount);
  const series: Series = { label: metric.label, format: metric.format, values, samples: metric.bars ? undefined : samples };

  const dataset: ChartDataset<"bar" | "line"> = metric.bars
    ? { type: "bar", label: metric.label, data: values, backgroundColor: metric.color + "59", order: 1 }
    : {
        ...LINE_STYLE,
        ...gapSegments(metric.color),
        ...samplePoints(metric.color, samples, 2),
        type: "line",
        label: metric.label,
        data: values,
        borderColor: metric.color,
        backgroundColor: metric.color,
        spanGaps: true,
        order: 1,
      };

  return {
    type: metric.bars ? "bar" : "line",
    data: {
      labels: months.map((month) => monthLabel(month.key)),
      datasets: [dataset],
    },
    options: {
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            // Only line months need a note, since a bar month with no matches already reads as 0
            beforeBody: metric.bars ? undefined : emptyMonthNote(months),
            label: seriesLabel([series]),
          },
        },
      },
      scales: {
        x: { ticks: { maxRotation: 0, autoSkip: true } },
        y: {
          beginAtZero: metric.beginAtZero,
          max: metric.max,
          ticks: {
            // Counts are whole numbers, so a small range does not get 0.5 steps
            precision: metric.bars ? 0 : undefined,
            callback: (value, _index, ticks) => metric.tick(Number(value), ticks),
          },
        },
      },
    },
  };
}
