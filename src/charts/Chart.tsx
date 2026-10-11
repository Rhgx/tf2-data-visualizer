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
  type TooltipPositionerFunction,
} from "chart.js";

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
Chart.defaults.plugins.tooltip.cornerRadius = 2;
Chart.defaults.plugins.tooltip.padding = 10;

// The tooltip sits at the pointer, like TF2's item tooltips, instead of at the data point. The offset goes toward the
// side Chart.js opens the box on (right of the pointer, or left of it past the middle), so the box clears the pointer.
const CURSOR_OFFSET = 14;
declare module "chart.js" {
  interface TooltipPositionerMap {
    cursor: TooltipPositionerFunction<ChartType>;
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
