import { useEffect, useRef, type CSSProperties } from "react";
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
  type ChartConfiguration,
  type ChartType,
  type Plugin,
  type TooltipPositionerFunction,
} from "chart.js";
import type { UpdateMarker } from "./theme";

// Only the controllers, elements, scales and plugins the charts use. Chart.register(...registerables) keeps every
// type, including the ones no chart here uses. A new chart type needs its controller, elements and scale added here.
Chart.register(
  BarController,
  BarElement,
  CategoryScale,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip
);

// Dark TF2 panel theme. Panel text is tan, grid lines are faint tan, tooltips look like TF2 item tooltips.
Chart.defaults.color = "#ebe2ca";
Chart.defaults.font.family = `"TF2 Secondary", Verdana, sans-serif`;
Chart.defaults.font.size = 13;
Chart.defaults.borderColor = "rgba(235, 226, 202, 0.12)";
Chart.defaults.scale.ticks.color = "#b8aa92";
Chart.defaults.maintainAspectRatio = false;
// Nothing animates: no grow on load, no tween on tab switch or data change, and hover color changes apply at once.
Chart.defaults.animation = false;

Chart.defaults.plugins.tooltip.backgroundColor = "rgba(36, 33, 31, 0.96)";
Chart.defaults.plugins.tooltip.borderColor = "#625a50";
Chart.defaults.plugins.tooltip.borderWidth = 1;
Chart.defaults.plugins.tooltip.titleColor = "#ffd700";
Chart.defaults.plugins.tooltip.titleFont = { family: `"TF2 Build", sans-serif` };
Chart.defaults.plugins.tooltip.bodyColor = "#ebe2ca";
// The footer holds the update lines, so they read gold and apart from the stats above them
Chart.defaults.plugins.tooltip.footerColor = "#ffd700";
Chart.defaults.plugins.tooltip.footerFont = { weight: "normal" };
Chart.defaults.plugins.tooltip.footerMarginTop = 6;
Chart.defaults.plugins.tooltip.cornerRadius = 2;
Chart.defaults.plugins.tooltip.padding = 10;

// The tooltip sits at the pointer, like TF2's item tooltips, instead of at the data point. The offset goes toward the
// side Chart.js opens the box on (right of the pointer, or left of it past the middle), so the box clears the pointer.
const CURSOR_OFFSET = 14;
declare module "chart.js" {
  interface TooltipPositionerMap {
    cursor: TooltipPositionerFunction<ChartType>;
  }
  // Unset on charts without update markers, so the plugin below draws nothing for them
  interface PluginOptionsByType<TType extends ChartType> {
    updateMarkers?: { markers: UpdateMarker[] };
  }
}
Tooltip.positioners.cursor = function (items, eventPosition) {
  const { x, y } = eventPosition;
  // Null when the event has no coordinates, so use the average position of the items instead
  if (x === null || y === null) return Tooltip.positioners.average.call(this, items, eventPosition);
  const { chartArea } = this.chart;
  const offsetX = x > (chartArea.left + chartArea.right) / 2 ? -CURSOR_OFFSET : CURSOR_OFFSET;
  const offsetY = y > (chartArea.top + chartArea.bottom) / 2 ? -CURSOR_OFFSET : CURSOR_OFFSET;
  return { x: x + offsetX, y: y + offsetY };
};
Chart.defaults.plugins.tooltip.position = "cursor";

// One plugin serves every chart, since ChartCanvas never re-applies config.plugins. A chart opts in through
// options.plugins.updateMarkers. Drawn after the datasets, so the lines sit over the bars and the line.
const updateMarkersPlugin: Plugin<ChartType, { markers?: UpdateMarker[] }> = {
  id: "updateMarkers",
  afterDatasetsDraw(chart, _args, options) {
    const { markers } = options;
    if (!markers) return;
    const { ctx, chartArea, scales } = chart;
    ctx.save();
    for (const marker of markers) {
      // Line charts put the first and last month points on the plot edges, so a release in the outer half of
      // those months is clamped to the edge (at most half a month off). The left edge snaps to a whole pixel, so
      // a 1px line fills one pixel column and a 2px line fills two, with no blur across the neighbours.
      const width = marker.major ? 2 : 1;
      const x = Math.round(scales.x.getPixelForValue(marker.x) - width / 2);
      const left = Math.min(Math.max(x, chartArea.left), chartArea.right - width);
      ctx.lineWidth = width;
      ctx.strokeStyle = marker.major ? "rgba(255, 215, 0, 0.9)" : "rgba(235, 226, 202, 0.75)";
      ctx.setLineDash(marker.major ? [] : [4, 3]);
      ctx.beginPath();
      ctx.moveTo(left + width / 2, chartArea.top);
      ctx.lineTo(left + width / 2, chartArea.bottom);
      ctx.stroke();
    }
    ctx.restore();
  },
};
Chart.register(updateMarkersPlugin);

// CSSProperties has no custom properties, so --h is added to the type instead of casting the style object.
type ChartBoxStyle = CSSProperties & Record<`--${string}`, string | number>;

interface ChartCanvasProps<TType extends ChartType> {
  config: ChartConfiguration<TType>;
  // Height in px of the .chart-box wrapper. Without it, the stylesheet's default height applies.
  height?: number;
  className?: string;
  // Called once, when the chart is created, so a caller can keep the instance (e.g. for toBase64Image)
  onChart?: (chart: Chart<TType>) => void;
}

export function ChartCanvas<TType extends ChartType>({ config, height, className, onChart }: ChartCanvasProps<TType>) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart<TType> | null>(null);

  // The first config creates the chart. Later configs update it in place, so a filter change redraws every chart at
  // once. The chart type cannot change in place, so a ChartCanvas keeps the TType it was first given.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (chartRef.current) {
      chartRef.current.data = config.data;
      if (config.options) chartRef.current.options = config.options;
      chartRef.current.update("none");
      return;
    }
    const chart = new Chart<TType>(canvas, config);
    chartRef.current = chart;
    onChart?.(chart);
  }, [config, onChart]);

  // Only unmount destroys the chart. Config updates never tear it down.
  useEffect(() => {
    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, []);

  const style: ChartBoxStyle | undefined = height === undefined ? undefined : { "--h": `${height}px` };
  return (
    <div className={className ? `chart-box ${className}` : "chart-box"} style={style}>
      <canvas ref={canvasRef} />
    </div>
  );
}
