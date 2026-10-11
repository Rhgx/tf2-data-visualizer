import type { LineControllerDatasetOptions, ScriptableLineSegmentContext, TooltipItem } from "chart.js";
import { hasStats, type MonthBucket } from "./stats";

// Months with fewer matches that have a result than this are drawn as hollow points, and their tooltip gives the sample size
export const LOW_SAMPLE_MATCHES = 5;

// Panel background, so a hollow point looks empty
const PANEL_FILL = "#2a2625";
const LOW_POINT_RADIUS = 3;
const GAP_DASH = [4, 4];
// Alpha suffixes for hex colors: the line across a gap is dimmer, a low-sample point border is quieter
const GAP_ALPHA = "66";
const LOW_POINT_ALPHA = "b3";

// Matches in a month that have a result. Rates and averages only use these, so this is the sample behind a point.
export function resultCount(month: MonthBucket): number {
  return month.matches.filter(hasStats).length;
}

// The line segments that touch a month with no value are dashed and dimmer, so the gap reads as "no data".
// Chart.js types need every segment key, and undefined keeps the dataset value.
export function gapSegments(color: string): Pick<LineControllerDatasetOptions, "segment"> {
  const isGap = (ctx: ScriptableLineSegmentContext) => ctx.p0.skip || ctx.p1.skip;
  return {
    segment: {
      backgroundColor: undefined,
      borderColor: (ctx) => (isGap(ctx) ? color + GAP_ALPHA : undefined),
      borderCapStyle: undefined,
      borderDash: (ctx) => (isGap(ctx) ? GAP_DASH : undefined),
      borderDashOffset: undefined,
      borderJoinStyle: undefined,
      borderWidth: undefined,
    },
  };
}

// Low-sample months get a hollow, dimmer point. Other months get a filled point of `radius`.
export function samplePoints(
  color: string,
  samples: number[],
  radius: number
): Pick<LineControllerDatasetOptions, "pointRadius" | "pointBackgroundColor" | "pointBorderColor" | "pointBorderWidth"> {
  const low = samples.map((sample) => sample < LOW_SAMPLE_MATCHES);
  return {
    pointRadius: low.map((isLow) => (isLow ? LOW_POINT_RADIUS : radius)),
    pointBackgroundColor: low.map((isLow) => (isLow ? PANEL_FILL : color)),
    pointBorderColor: low.map((isLow) => (isLow ? color + LOW_POINT_ALPHA : color)),
    pointBorderWidth: low.map((isLow) => (isLow ? 1.5 : 1)),
  };
}

// One line of a chart's data, in dataset order. values hold null for a month with no value.
export interface Series {
  label: string;
  format: (value: number) => string;
  values: (number | null)[];
  // Matches with a result behind each value. Left out for series that are not rates or averages.
  samples?: number[];
}

// Tooltip line per dataset. A low-sample month names its sample size, and a month with no value gives no line.
export function seriesLabel<TType extends "bar" | "line">(series: Series[]) {
  return (context: TooltipItem<TType>): string => {
    const info = series.at(context.datasetIndex);
    const value = info?.values[context.dataIndex] ?? null;
    if (info === undefined || value === null) return "";
    const samples = info.samples?.[context.dataIndex];
    const note = samples !== undefined && samples < LOW_SAMPLE_MATCHES ? ` (${samples} ${samples === 1 ? "match" : "matches"})` : "";
    return `${info.label}: ${info.format(value)}${note}`;
  };
}

// Tooltip header line that says why a month has no values
export function emptyMonthNote<TType extends "bar" | "line">(months: MonthBucket[]) {
  return (items: TooltipItem<TType>[]): string[] => {
    const month = months[items[0].dataIndex];
    if (month.matches.length === 0) return ["No matches"];
    return resultCount(month) === 0 ? ["No results"] : [];
  };
}
