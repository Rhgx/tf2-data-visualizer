import { useMemo } from "react";
import type { ChartConfiguration } from "chart.js";
import { ChartCanvas } from "../charts/Chart";
import { monthLabel, palette } from "../charts/theme";
import { Panel, PanelNote } from "../ui/Panel";
import { formatNumber } from "../lib/format";
import { hasStats, LINE_STYLE, monthKd, monthWinPercent, type MonthBucket, type TimedMatch } from "./stats";
import { emptyMonthNote, gapSegments, resultCount, samplePoints, type Series, seriesLabel } from "./monthLine";

interface FormPanelProps {
  timed: TimedMatch[];
  months: MonthBucket[];
}

export function FormPanel({ timed, months }: FormPanelProps) {
  const config = useMemo(() => formConfig(months), [months]);
  return (
    <Panel title="Form" tip="Win rate and K/D for each month">
      {timed.length === 0 ? (
        <PanelNote>No matches have a recorded time.</PanelNote>
      ) : (
        <ChartCanvas config={config} />
      )}
    </Panel>
  );
}

function formConfig(months: MonthBucket[]): ChartConfiguration<"bar" | "line"> {
  const counts = months.map((month) => month.matches.length);
  const winRates = months.map((month) => monthWinPercent(month.matches));
  const kds = months.map((month) => monthKd(month.matches.filter(hasStats)));
  const samples = months.map(resultCount);
  const series: Series[] = [
    { label: "Matches", format: formatNumber, values: counts },
    { label: "Win rate", format: (value) => `${formatNumber(value, 1)}%`, values: winRates, samples },
    { label: "K/D", format: (value) => formatNumber(value, 2), values: kds, samples },
  ];

  return {
    type: "bar",
    data: {
      labels: months.map((month) => monthLabel(month.key)),
      datasets: [
        {
          type: "bar",
          label: "Matches",
          data: counts,
          backgroundColor: palette.tan + "26",
          yAxisID: "count",
          order: 2,
        },
        {
          ...LINE_STYLE,
          ...gapSegments(palette.positive),
          ...samplePoints(palette.positive, samples, 2),
          type: "line",
          label: "Win rate",
          data: winRates,
          borderColor: palette.positive,
          backgroundColor: palette.positive,
          spanGaps: true,
          yAxisID: "y",
          order: 1,
        },
        {
          ...LINE_STYLE,
          ...gapSegments(palette.orange),
          ...samplePoints(palette.orange, samples, 2),
          type: "line",
          label: "K/D",
          data: kds,
          borderColor: palette.orange,
          backgroundColor: palette.orange,
          spanGaps: true,
          yAxisID: "y1",
          order: 1,
        },
      ],
    },
    options: {
      interaction: { mode: "index", intersect: false },
      plugins: {
        tooltip: {
          callbacks: { beforeBody: emptyMonthNote(months), label: seriesLabel(series) },
        },
      },
      scales: {
        x: { ticks: { maxRotation: 0, autoSkip: true } },
        y: {
          position: "left",
          min: 0,
          max: 100,
          title: { display: true, text: "Win rate", color: palette.positive },
          ticks: { callback: (value) => `${value}%` },
        },
        y1: {
          position: "right",
          beginAtZero: true,
          title: { display: true, text: "K/D", color: palette.orange },
          ticks: { callback: (value) => formatNumber(Number(value), 1) },
          grid: { drawOnChartArea: false },
        },
        count: { display: false, beginAtZero: true },
      },
    },
  };
}
