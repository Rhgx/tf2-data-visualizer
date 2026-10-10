import { useMemo } from "react";
import type { ChartConfiguration } from "chart.js";
import { ChartCanvas } from "../charts/Chart";
import { monthLabel, palette } from "../charts/theme";
import { HudStat } from "../ui/HudStat";
import { Panel, PanelNote } from "../ui/Panel";
import { formatNumber } from "../lib/format";
import type { Match } from "../data/match";
import { averageText, LINE_STYLE, type MonthBucket, type StatField, statAverage } from "./stats";
import { emptyMonthNote, gapSegments, resultCount, samplePoints, seriesLabel } from "./monthLine";

interface StatMultiple {
  field: StatField;
  label: string;
  color: string;
}

const STAT_MULTIPLES: StatMultiple[] = [
  { field: "kills", label: "Kills", color: palette.red },
  { field: "deaths", label: "Deaths", color: palette.blu },
  { field: "damage", label: "Damage", color: palette.orange },
  { field: "healing", label: "Healing", color: palette.olive },
];

interface PerMatchPanelProps {
  // Matches with a result, the only ones the averages use
  scored: Match[];
  hasTimed: boolean;
  months: MonthBucket[];
}

export function PerMatchPanel({ scored, hasTimed, months }: PerMatchPanelProps) {
  const averages = useMemo(() => STAT_MULTIPLES.map((stat) => averageText(scored, stat.field, 1)), [scored]);
  const configs = useMemo(() => STAT_MULTIPLES.map((stat) => multipleConfig(stat, months)), [months]);

  return (
    <Panel title="Per match" tip="Averages per match, over matches with a result">
      <div className="multiples">
        {STAT_MULTIPLES.map((stat, index) => (
          <div key={stat.field} className="small-multiple">
            <HudStat value={averages[index]} label={`${stat.label} per match`} />
            {hasTimed && <ChartCanvas config={configs[index]} height={110} />}
          </div>
        ))}
      </div>
      {!hasTimed && <PanelNote>No matches have a recorded time.</PanelNote>}
    </Panel>
  );
}

// Ticks less than 1 apart need a decimal, or a small range repeats labels like "0"
function tickDecimals(ticks: { value: number }[]): number {
  return ticks.length > 1 && ticks[1].value - ticks[0].value < 1 ? 1 : 0;
}

function multipleConfig(stat: StatMultiple, months: MonthBucket[]): ChartConfiguration<"line"> {
  const values = months.map((month) => statAverage(month.matches, stat.field));
  const samples = months.map(resultCount);
  return {
    type: "line",
    data: {
      labels: months.map((month) => monthLabel(month.key)),
      datasets: [
        {
          ...LINE_STYLE,
          ...gapSegments(stat.color),
          ...samplePoints(stat.color, samples, 0),
          label: stat.label,
          data: values,
          borderColor: stat.color,
          spanGaps: true,
        },
      ],
    },
    options: {
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            beforeBody: emptyMonthNote(months),
            label: seriesLabel([{ label: stat.label, format: (value) => formatNumber(value, 1), values, samples }]),
          },
        },
      },
      scales: {
        x: { display: false },
        y: {
          ticks: {
            maxTicksLimit: 4,
            callback: (value, _index, ticks) => formatNumber(Number(value), tickDecimals(ticks)),
          },
        },
      },
    },
  };
}
