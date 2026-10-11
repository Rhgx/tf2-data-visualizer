import { useCallback, useMemo, useRef, type JSX, type ReactNode } from "react";
import type { Chart, ChartConfiguration, ChartOptions, ChartType, Plugin } from "chart.js";
import { barColor } from "../charts/theme";
import { ChartCanvas } from "../charts/Chart";
import { formatWinRate } from "../data/match";
import { gameModeName } from "../data/maps";
import { formatHours, formatNumber } from "../lib/format";
import { playSound } from "../ui/sound";
import { Panel, PanelNote } from "../ui/Panel";
import { TfButton } from "../ui/Button";
import { mapWinRate, percent, plural, type ChartMetric, type MapStats } from "./stats";

// One bar is 24px tall so horizontal map names stay readable without rotation
const PX_PER_BAR = 24;
const MIN_CHART_HEIGHT = 200;

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

function chartConfig(
  charted: MapStats[],
  metric: ChartMetric,
  totalMatches: number,
  hasHours: boolean,
  selectedId: string | null,
  onSelect: (id: string) => void
): ChartConfiguration<"bar"> {
  const isHours = metric === "hours";
  const options: ChartOptions<"bar"> = {
    indexAxis: "y",
    // Room for the value labels drawn past the longest bar
    layout: { padding: { right: 48 } },
    onClick: (_event, elements) => {
      const [hit] = elements;
      if (hit) {
        playSound("click");
        onSelect(charted[hit.index].id);
      }
    },
    onHover: (_event, elements, chart) => {
      chart.canvas.style.cursor = elements.length > 0 ? "pointer" : "default";
    },
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
          // The picked bar gets a thin tan outline, the others have none
          borderColor: "#ebe2ca",
          borderWidth: charted.map((s) => (s.id === selectedId ? 2 : 0)),
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
  // The trimmed search the chart is filtered by
  query: string;
  totalMatches: number;
  hasHours: boolean;
  metric: ChartMetric;
  // The map the card shows, highlighted in the chart
  selectedId: string | null;
  onSelect: (id: string) => void;
  // The Top and Metric selects, which only the chart uses
  countControls: ReactNode;
  // The Chart / Table switch and the sort, search and reset controls, shared with the table view
  viewSwitch: ReactNode;
  filters: ReactNode;
}

export function MapsChartPanel({
  charted,
  filteredCount,
  query,
  totalMatches,
  hasHours,
  metric,
  selectedId,
  onSelect,
  countControls,
  viewSwitch,
  filters,
}: MapsChartPanelProps): JSX.Element {
  const chartRef = useRef<Chart<"bar"> | null>(null);
  // Stable, so ChartCanvas does not re-run its effect on every render
  const handleChart = useCallback((chart: Chart<"bar">) => {
    chartRef.current = chart;
  }, []);

  const config = useMemo(
    () => chartConfig(charted, metric, totalMatches, hasHours, selectedId, onSelect),
    [charted, metric, totalMatches, hasHours, selectedId, onSelect]
  );

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

  // The view switch sits after the title, and the right-aligned group drops to the next line. Download PNG is last
  // because only the chart has it.
  const controls = (
    <>
      {viewSwitch}
      <div className="maps-filters">
        {countControls}
        {filters}
        <TfButton size="small" icon="ui/glyphs/camera.png" onClick={downloadChart}>
          Download PNG
        </TfButton>
      </div>
    </>
  );

  return (
    <Panel title="Maps" className="maps-main" actions={controls}>
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
