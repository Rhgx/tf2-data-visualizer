import { Fragment, memo, type CSSProperties } from "react";
import { formatHours, formatNumber } from "../lib/format";
import { UPDATE_KIND_LABELS, updatesOn } from "../data/updates";
import { DAY_LABELS, WEEKDAYS, heatLevel, heatTickLabels, type HeatCell, type HeatColumn, type HeatTotal } from "./stats";

// CSS custom properties are not in CSSProperties, so the ones used here are typed on the style object instead of casting it.
type HeatStyle = CSSProperties & { [name: `--${string}`]: string | number };

export type ActivityMode = "matches" | "hours" | "winrate";

// Cells with fewer results than this are drawn faint, so one or two matches do not read as a strong rate
export const THIN_RESULTS = 3;
// Column 1 holds the weekday names and row 1 the axis labels, so the first weekday row is 2 and the edge row comes after the seventh
const FIRST_ROW = 2;
const EDGE_ROW = WEEKDAYS.length + FIRST_ROW;

// Win rate scale: RED at 0%, the neutral mid at 50% and BLU at 100%, the same stops the cell tints use
const RAMP: HeatStyle = { "--tint": `linear-gradient(to right, ${tintOf(0)}, ${tintOf(0.5)}, ${tintOf(1)})` };
// The faded swatch that explains thin cells. Neutral, so it does not read as a rate.
const THIN_SWATCH: HeatStyle = { "--tint": "var(--heat-mid)" };
// The short "<3" label under that swatch is explained here on hover and for screen readers
const THIN_TIP = `Fewer than ${THIN_RESULTS} matches with a result`;
// One swatch per heat level, level 1 up to the busiest level 5. Level 0 is an empty cell, so it has no swatch.
const LEGEND_LEVELS = [1, 2, 3, 4, 5];

// The amount a mode shades and measures by: time played in hours mode, the match count otherwise. Levels and bar lengths both use it.
export function heatAmount(total: HeatTotal, mode: ActivityMode): number {
  return mode === "hours" ? total.seconds : total.count;
}

interface HeatGridProps {
  columns: HeatColumn[];
  // Upper bounds of levels 1 to 4 from heatCuts. Win rate mode does not use them.
  cuts: number[];
  mode: ActivityMode;
  variant: "heat-grid-calendar" | "heat-grid-hours";
  // Totals under the grid, one per hour, and to its right, one per weekday
  edges?: { hours: HeatCell[]; days: HeatCell[] };
  // Days with matches become buttons that call this with their YYYY-MM-DD key
  onPickDay?: (dateKey: string) => void;
  // Outlines the calendar days that TF2 updates were released on
  markUpdates?: boolean;
}

// Every item is placed explicitly, so the edge bars can share the grid's tracks. overview.css sizes the tracks from --columns.
// The legend is the last row of the grid, so it starts at the first cell column and shares the cell sizes.
// Memoized, so a re-render of the panel leaves the grid alone when its own props are the same.
export const HeatGrid = memo(function HeatGrid({ columns, cuts, mode, variant, edges, onPickDay, markUpdates }: HeatGridProps) {
  const gridStyle: HeatStyle = { "--columns": columns.length };
  const edgeColumn = columns.length + 2;
  const hourEdges = edges?.hours ?? [];
  const dayEdges = edges?.days ?? [];
  const hourMax = busiest(hourEdges.map((hour) => heatAmount(hour, mode)));
  const dayMax = busiest(dayEdges.map((day) => heatAmount(day, mode)));
  // The hour grid names every weekday. The calendar only labels Mon, Wed and Fri to keep its column narrow.
  const dayLabels = variant === "heat-grid-hours" ? WEEKDAYS : DAY_LABELS;
  // The hour grid has an edge row above its legend. The calendar has none, so its legend takes that row.
  const legendRow = EDGE_ROW + (edges ? 1 : 0);

  return (
    <div className="heat">
      <div className="heat-scroll">
        <div className={`heat-grid ${variant}`} style={gridStyle}>
          {dayLabels.map((label, day) => (
            <span key={day} className="heat-day" style={{ gridColumnStart: 1, gridRowStart: day + FIRST_ROW }}>
              {label}
            </span>
          ))}
          {columns.map((column, index) => (
            <Fragment key={index}>
              <span className="heat-axis" style={{ gridColumnStart: index + 2, gridRowStart: 1 }}>
                {column.axis}
              </span>
              {column.cells.map((cell, day) => (
                <HeatCellView
                  key={day}
                  cell={cell}
                  cuts={cuts}
                  mode={mode}
                  column={index + 2}
                  row={day + FIRST_ROW}
                  onPickDay={onPickDay}
                  markUpdates={markUpdates}
                />
              ))}
            </Fragment>
          ))}
          {hourEdges.map((hour, index) => (
            <EdgeBar
              key={`hour-${index}`}
              total={hour}
              share={heatAmount(hour, mode) / hourMax}
              mode={mode}
              className="heat-edge-hour"
              column={index + 2}
              row={EDGE_ROW}
            />
          ))}
          {dayEdges.map((day, index) => (
            <EdgeBar
              key={`day-${index}`}
              total={day}
              share={heatAmount(day, mode) / dayMax}
              mode={mode}
              className="heat-edge-day"
              column={edgeColumn}
              row={index + FIRST_ROW}
              value={edgeValue(day, mode)}
            />
          ))}
          <HeatLegend
            mode={mode}
            cuts={cuts}
            place={{ gridColumn: `2 / span ${columns.length}`, gridRowStart: legendRow }}
          />
        </div>
      </div>
    </div>
  );
});

// The largest value in a row of totals, at least 1 so an empty list still divides safely
function busiest(values: number[]): number {
  return Math.max(1, ...values);
}

interface HeatCellViewProps {
  cell: HeatCell | null;
  cuts: number[];
  mode: ActivityMode;
  column: number;
  row: number;
  onPickDay?: (dateKey: string) => void;
  markUpdates?: boolean;
}

const HeatCellView = memo(function HeatCellView({ cell, cuts, mode, column, row, onPickDay, markUpdates }: HeatCellViewProps) {
  // null is a day outside the year. It keeps its grid slot but stays invisible.
  if (cell === null) return <span className="heat-cell is-outside" style={{ gridColumnStart: column, gridRowStart: row }} />;
  const place: HeatStyle = { gridColumnStart: column, gridRowStart: row };
  // A blank day has no data, so it has no tip and is not an image
  if (cell.blank) return <span className="heat-cell is-blank" style={place} />;

  const { dateKey } = cell;
  const updates = markUpdates && dateKey ? updatesOn(dateKey) : [];
  const major = updates.some((update) => update.kind === "major");
  const thin = mode === "winrate" && cell.results > 0 && cell.results < THIN_RESULTS;
  const className = `heat-cell${thin ? " is-thin" : ""}${cell.today ? " is-today" : ""}${updates.length > 0 ? " is-update" : ""}${major ? " is-major" : ""}`;
  const style: HeatStyle = { ...place, ...fillOf(cell, cuts, mode) };
  const tip = cellTip(cell, mode);
  // One note line per update, under the day's tip. The label reads the same text to screen readers after the tip.
  const notes = updates.map((update) => `${update.name} (${UPDATE_KIND_LABELS[update.kind]})`);
  const note = notes.length > 0 ? notes.join("\n") : undefined;
  const label = [tip, ...notes].join(". ");
  if (onPickDay && dateKey && cell.count > 0) {
    return (
      <button type="button" className={className} style={style} data-tip={tip} data-tip-note={note} aria-label={label} onClick={() => onPickDay(dateKey)} />
    );
  }
  return <span className={className} style={style} data-tip={tip} data-tip-note={note} role="img" aria-label={label} />;
});

interface EdgeBarProps {
  total: HeatCell;
  // Fraction of the busiest total in this row, by the mode's amount. It sets the bar length in every mode.
  share: number;
  mode: ActivityMode;
  className: string;
  column: number;
  row: number;
  // Printed at the end of the bar. Only the weekday bars have one.
  value?: string;
}

// A bar under the hours or to the right of the weekdays. Matches mode uses the default bar color; win rate mode colors it by rate.
function EdgeBar({ total, share, mode, className, column, row, value }: EdgeBarProps) {
  const style: HeatStyle = {
    gridColumnStart: column,
    gridRowStart: row,
    "--share": share,
    ...(mode === "winrate" ? tintStyle(total) : {}),
  };
  const tip = edgeTip(total, mode);
  return (
    <span className={`heat-edge ${className}`} style={style} data-tip={tip} role="img" aria-label={tip}>
      {value !== undefined && <span className="heat-edge-value">{value}</span>}
    </span>
  );
}

interface HeatLegendProps {
  mode: ActivityMode;
  cuts: number[];
  place: HeatStyle;
}

// The scale under a grid. Matches and hours show one swatch per level, with the cut between each pair as a tick under it. Win rate shows the tint ramp and the thin swatch.
function HeatLegend({ mode, cuts, place }: HeatLegendProps) {
  if (mode === "winrate") {
    return (
      <div className="heat-legend" style={place}>
        <div className="heat-ramp-row">
          <div className="heat-ramp-group">
            <span className="heat-swatch heat-ramp" style={RAMP} aria-hidden="true" />
            <span className="heat-ramp-labels">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </span>
          </div>
          <span className="heat-step">
            <span className="heat-swatch is-thin" style={THIN_SWATCH} data-tip={THIN_TIP} role="img" aria-label={THIN_TIP} />
            <span className="heat-step-label">{`<${THIN_RESULTS}`}</span>
          </span>
        </div>
      </div>
    );
  }
  const ticks = heatTickLabels(cuts, mode === "hours");
  // Swatches sit on the odd tracks of the key grid and each tick on the gap track between two swatches, one row down
  return (
    <div className="heat-legend" style={place}>
      <div className="heat-key">
        {LEGEND_LEVELS.map((level, index) => {
          const style: HeatStyle = { "--level": level, gridColumnStart: index * 2 + 1, gridRowStart: 1 };
          return <span key={level} className="heat-swatch" style={style} aria-hidden="true" />;
        })}
        {ticks.map((tick, index) => (
          <span key={index} className="heat-tick" style={{ gridColumnStart: index * 2 + 2, gridRowStart: 2 }}>
            {tick}
          </span>
        ))}
      </div>
    </div>
  );
}

// Matches and hours modes shade by level. Win rate mode tints by the rate, and a total with no result stays empty.
function fillOf(total: HeatTotal, cuts: number[], mode: ActivityMode): HeatStyle {
  return mode === "winrate" ? tintStyle(total) : { "--level": heatLevel(heatAmount(total, mode), cuts) };
}

function tintStyle(total: HeatTotal): HeatStyle {
  return { "--tint": total.results === 0 ? "var(--page)" : tintOf(total.wins / total.results) };
}

// Diverging scale: TF2 red at 0%, a neutral tan-brown at 50%, TF2 blue at 100%
function tintOf(rate: number): string {
  return rate < 0.5
    ? `color-mix(in srgb, var(--red) ${(1 - rate * 2) * 100}%, var(--heat-mid))`
    : `color-mix(in srgb, var(--blu) ${(rate * 2 - 1) * 100}%, var(--heat-mid))`;
}

function matchCount(count: number): string {
  return `${formatNumber(count)} ${count === 1 ? "match" : "matches"}`;
}

function winPercent(total: HeatTotal): number {
  return Math.round((total.wins / total.results) * 100);
}

function winText(total: HeatTotal): string {
  return `${winPercent(total)}% win`;
}

// The number at the end of a weekday bar: its matches, or its win rate in win rate mode (blank when no result)
function edgeValue(total: HeatCell, mode: ActivityMode): string {
  if (mode === "winrate") return total.results === 0 ? "" : `${winPercent(total)}%`;
  return formatNumber(total.count);
}

// Cell tips name the day first. Hours mode adds the time played, and win rate mode adds the rate, or says why there is none.
function cellTip(cell: HeatCell, mode: ActivityMode): string {
  const matches = `${cell.label}: ${matchCount(cell.count)}`;
  if (mode === "matches") return matches;
  if (mode === "hours") return `${matches}, ${formatHours(cell.seconds)}`;
  if (cell.results === 0) return cell.count === 0 ? matches : `${matches}, no result`;
  return `${matches}, ${winText(cell)}`;
}

// Edge tips put the rate before the count, as in "18:00: 54% win, 214 matches"
function edgeTip(total: HeatCell, mode: ActivityMode): string {
  const matches = matchCount(total.count);
  if (mode === "matches" || total.results === 0) return `${total.label}: ${matches}`;
  return `${total.label}: ${winText(total)}, ${matches}`;
}
