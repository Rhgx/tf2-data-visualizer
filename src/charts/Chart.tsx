import { useEffect, useRef, type CSSProperties } from "react";
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
  type ChartConfiguration,
  type ChartType,
} from "chart.js";

// Only the controllers, elements, scales and plugins the charts use. Chart.register(...registerables) keeps every
// type, including the ones no chart here uses. A new chart type needs its controller, elements and scale added here.
Chart.register(
  BarController,
  BarElement,
  CategoryScale,
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
// Set the fields in place. Replacing the whole object drops Chart.js's own animation defaults, and then hovered
// bars animate their colors with no interpolator and throw "this._fn is not a function".
const animation = Chart.defaults.animation;
if (animation) {
  animation.duration = 450;
  animation.easing = "easeOutCubic";
}
// Reduced motion turns animation off for every chart. The stored object goes back in as is, so its fields survive.
// Charts that set their own animation (e.g. MapsChartPanel) are not in liveCharts, so the preference leaves them alone.
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
// Only the two members the preference uses. A Chart<TType> is not assignable to Chart, since its options depend on TType.
interface MotionTarget {
  options: { animation?: unknown } | undefined;
  update(mode: "none"): void;
}
const liveCharts = new Set<MotionTarget>();
function applyMotionPreference(): void {
  const next = reducedMotion.matches ? false : animation;
  Chart.defaults.animation = next;
  for (const chart of liveCharts) {
    if (chart.options) chart.options.animation = next;
    chart.update("none");
  }
}
reducedMotion.addEventListener("change", applyMotionPreference);
// Without this, every hot reload of this module adds another listener that keeps the old module alive.
if (import.meta.hot) {
  import.meta.hot.dispose(() => reducedMotion.removeEventListener("change", applyMotionPreference));
}
applyMotionPreference();

Chart.defaults.plugins.tooltip.backgroundColor = "rgba(36, 33, 31, 0.96)";
Chart.defaults.plugins.tooltip.borderColor = "#625a50";
Chart.defaults.plugins.tooltip.borderWidth = 1;
Chart.defaults.plugins.tooltip.titleColor = "#ffd700";
Chart.defaults.plugins.tooltip.titleFont = { family: `"TF2 Build", sans-serif` };
Chart.defaults.plugins.tooltip.bodyColor = "#ebe2ca";
Chart.defaults.plugins.tooltip.cornerRadius = 2;
Chart.defaults.plugins.tooltip.padding = 10;

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

  // The first config creates the chart, which animates in. Later configs update it in place with no animation, so a
  // filter change redraws every chart at once instead of animating each one again.
  // The chart type cannot change in place, so a ChartCanvas keeps the TType it was first given.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (chartRef.current) {
      chartRef.current.data = config.data;
      if (config.options) chartRef.current.options = config.options;
      chartRef.current.update("none");
      return;
    }
    // Read before the chart is built, since Chart.js resolves the options object it is given
    const followsDefaults = config.options?.animation === undefined;
    const chart = new Chart<TType>(canvas, config);
    chartRef.current = chart;
    if (followsDefaults) liveCharts.add(chart);
    onChart?.(chart);
  }, [config, onChart]);

  // Only unmount destroys the chart. Config updates never tear it down.
  useEffect(() => {
    return () => {
      const chart = chartRef.current;
      if (chart) {
        liveCharts.delete(chart);
        chart.destroy();
      }
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
