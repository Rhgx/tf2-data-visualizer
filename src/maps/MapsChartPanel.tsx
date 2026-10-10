import { useCallback, useMemo, useRef, type JSX } from "react";
import type { Chart, ChartConfiguration, ChartOptions, ChartType, Plugin } from "chart.js";
import { barColor } from "../charts/theme";
import { ChartCanvas } from "../charts/Chart";
import { formatWinRate } from "../data/match";
import { gameModeName } from "../data/maps";
import { formatHours, formatNumber } from "../lib/format";
import { Panel, PanelNote } from "../ui/Panel";
import { SearchField, SelectField } from "../ui/Field";
import { TextButton, TfButton } from "../ui/Button";
import { mapWinRate, percent, plural, type ChartMetric, type MapStats } from "./stats";

// One bar is 24px tall so horizontal map names stay readable without rotation
const PX_PER_BAR = 24;
const MIN_CHART_HEIGHT = 200;

const TOP_OPTIONS = [
  { value: "10", label: "10" },
  { value: "20", label: "20" },
  { value: "30", label: "30" },
  { value: "50", label: "50" },
  { value: "all", label: "All" },
];

// The value label plugin reads its metric from the chart options, so one plugin object serves every render.
declare module "chart.js" {
  interface PluginOptionsByType<TType extends ChartType> {
    barValueLabels?: { metric: ChartMetric };
  }
}

// Hours get one decimal and an "h" suffix; match counts get thousands separators
function formatBarValue(metric: ChartMetric, value: number): string {
  return metric === "hours" ? `${value.toFixed(1)}h` : formatNumber(value);
}

// The x axis scrolls out of view with a tall chart, so each value is drawn at the end of its bar
const barValueLabels: Plugin<"bar", { metric: ChartMetric }> = {
  id: "barValueLabels",
  afterDatasetsDraw(chart, _args, options) {
    const { ctx } = chart;
    const values = chart.data.datasets[0].data;
    ctx.save();
    ctx.font = `12px "TF2 Secondary"`;
    ctx.fillStyle = "#ebe2ca";
    ctx.textBaseline = "middle";
    chart.getDatasetMeta(0).data.forEach((bar, i) => {
      const value = values[i];
      if (typeof value !== "number") return;
      ctx.fillText(formatBarValue(options.metric, value), bar.x + 6, bar.y);
    });
    ctx.restore();
  },
};

// Bar colors follow rank, not mode, so the mode is listed here instead
function tooltipLines(s: MapStats, totalMatches: number, hasHours: boolean): string[] {
  const lines = [
    `Mode: ${s.mode ? gameModeName(s.mode) : "Unknown"}`,
    `Matches: ${formatNumber(s.matches)} (${percent(s.matches, totalMatches)})`,
  ];
  if (hasHours) lines.push(`Time played: ${formatHours(s.seconds)}`);
  lines.push(`Win rate: ${formatWinRate(mapWinRate(s))}`);
  return lines;
}

function chartConfig(charted: MapStats[], metric: ChartMetric, totalMatches: number, hasHours: boolean): ChartConfiguration<"bar"> {
  const isHours = metric === "hours";
  const options: ChartOptions<"bar"> = {
    indexAxis: "y",
    // This chart is built while its tab is hidden at 0 width, so an animated first draw would show the squashed layout
    animation: false,
    // Room for the value labels drawn past the longest bar
    layout: { padding: { right: 48 } },
    scales: {
      x: {
        beginAtZero: true,
        ticks: {
          precision: isHours ? 1 : 0,
          callback: (value) => (isHours ? formatBarValue(metric, Number(value)) : value),
        },
      },
      y: {
        grid: { display: false },
        ticks: { autoSkip: false },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: ({ dataIndex }) => tooltipLines(charted[dataIndex], totalMatches, hasHours),
        },
      },
      barValueLabels: { metric },
    },
  };

  return {
    type: "bar",
    data: {
      labels: charted.map((s) => s.name),
      datasets: [
        {
          label: isHours ? "Hours played" : "Matches played",
          data: charted.map((s) => (isHours ? s.seconds / 3600 : s.matches)),
          backgroundColor: charted.map((_, i) => barColor(i)),
          borderWidth: 0,
          barPercentage: 0.8,
          categoryPercentage: 0.8,
        },
      ],
    },
    options,
    plugins: [barValueLabels],
  };
}

interface MapsChartPanelProps {
  // The maps to chart, already sorted by the chart's rank and cut to Top N
  charted: MapStats[];
  // How many maps match the search, before Top N cuts them
  filteredCount: number;
  // The search as it is shown in the field, and the trimmed query the chart is filtered by
  search: string;
  query: string;
  totalMatches: number;
  hasHours: boolean;
  topN: string;
  metric: ChartMetric;
  sort: string;
  onTopN: (value: string) => void;
  onMetric: (value: ChartMetric) => void;
  onSort: (value: string) => void;
  onSearch: (value: string) => void;
  onReset: () => void;
}

export function MapsChartPanel({
  charted,
  filteredCount,
  search,
  query,
  totalMatches,
  hasHours,
  topN,
  metric,
  sort,
  onTopN,
  onMetric,
  onSort,
  onSearch,
  onReset,
}: MapsChartPanelProps): JSX.Element {
  const chartRef = useRef<Chart<"bar"> | null>(null);
  // Stable, so ChartCanvas does not re-run its effect on every render
  const handleChart = useCallback((chart: Chart<"bar">) => {
    chartRef.current = chart;
  }, []);

  const config = useMemo(
    () => chartConfig(charted, metric, totalMatches, hasHours),
    [charted, metric, totalMatches, hasHours]
  );

  // Hours options are disabled when no match has played time, so the metric and sort fall back to matches
  const metricOptions = [
    { value: "count", label: "Matches" },
    { value: "hours", label: "Hours", disabled: !hasHours },
  ];
  const sortOptions = [
    { value: "countDesc", label: "Matches (most)" },
    { value: "countAsc", label: "Matches (fewest)" },
    { value: "hoursDesc", label: "Hours (most)", disabled: !hasHours },
    { value: "hoursAsc", label: "Hours (least)", disabled: !hasHours },
    { value: "alphaAsc", label: "Name (A-Z)" },
    { value: "alphaDesc", label: "Name (Z-A)" },
  ];

  function downloadChart() {
    const chart = chartRef.current;
    if (!chart) return;
    const link = document.createElement("a");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    link.href = chart.toBase64Image("image/png", 1);
    link.download = `tf2_most_played_maps_${timestamp}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  const controls = (
    <div className="maps-controls">
      <SelectField
        label="Top"
        tip="Maps shown in the chart. The table below always lists every map."
        value={topN}
        options={TOP_OPTIONS}
        onChange={onTopN}
      />
      <SelectField
        label="Metric"
        tip="Rank and label bars by matches or hours played. Hours need played time in the file"
        value={metric}
        options={metricOptions}
        onChange={(value) => onMetric(value === "hours" ? "hours" : "count")}
      />
      <SelectField
        label="Sort"
        tip="Table order. The chart uses the same direction for the chosen metric."
        value={sort}
        options={sortOptions}
        onChange={onSort}
      />
      <SearchField label="Search" placeholder="Search maps" value={search} onChange={onSearch} />
      <TfButton size="small" icon="ui/glyphs/camera.png" onClick={downloadChart}>
        Download PNG
      </TfButton>
      <TextButton tip="Back to Top 20, most matches first, and no search" onClick={onReset}>
        Reset
      </TextButton>
    </div>
  );

  return (
    <Panel title="Most played maps" actions={controls}>
      <div className="chart-scroll">
        <ChartCanvas
          config={config}
          height={Math.max(MIN_CHART_HEIGHT, charted.length * PX_PER_BAR)}
          className={charted.length === 0 ? "hidden" : undefined}
          onChart={handleChart}
        />
      </div>
      {charted.length === 0 && <PanelNote>{`No maps match "${query}".`}</PanelNote>}
      <PanelNote>{`${charted.length} of ${plural(filteredCount, "map", "maps")}`}</PanelNote>
    </Panel>
  );
}
