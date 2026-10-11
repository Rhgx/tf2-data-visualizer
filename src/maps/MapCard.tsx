import { useMemo, type ReactNode } from "react";
import type { ChartConfiguration, ChartOptions } from "chart.js";
import { ChartCanvas } from "../charts/Chart";
import { monthLabel, palette } from "../charts/theme";
import type { Outcome } from "../data/match";
import { TextButton } from "../ui/Button";
import { PanelNote } from "../ui/Panel";
import type { MapRow } from "./MapDetailsPanel";
import type { MapHistory } from "./stats";

interface MapCardProps {
  row: MapRow;
  history: MapHistory;
  hasHours: boolean;
  // Opens the Matches tab searched for this map
  onViewMatches: (name: string) => void;
}

const OUTCOME_TEXT: Record<Outcome, string> = { wins: "Win", losses: "Loss", ties: "Stalemate", none: "No result" };

// Long names wrap at their underscores, never inside a word. Plain text, so no HTML is built from the name.
function breakAfterUnderscores(name: string): ReactNode[] {
  return name.split("_").flatMap((part, i) => (i === 0 ? [part] : ["_", <wbr key={i} />, part]));
}

// Month or day text, or N/A when the map has no dated match
function dateText(time: number | null, options: Intl.DateTimeFormatOptions): string {
  return time === null ? "N/A" : new Date(time).toLocaleDateString("en-US", options);
}

// Matches per month for this map. The axes are minimal: month labels under the bars, no value axis or grid.
function monthlyConfig(monthly: MapHistory["monthly"]): ChartConfiguration<"bar"> {
  const options: ChartOptions<"bar"> = {
    layout: { padding: { top: 4 } },
    scales: {
      x: {
        grid: { display: false },
        ticks: { maxRotation: 0, color: "#b8aa92", font: { size: 11 } },
      },
      y: { display: false, beginAtZero: true },
    },
    plugins: { legend: { display: false } },
  };
  return {
    type: "bar",
    data: {
      labels: monthly.map((month) => monthLabel(month.key)),
      datasets: [
        {
          label: "Matches",
          data: monthly.map((month) => month.matches),
          backgroundColor: palette.tan,
          borderWidth: 0,
          barPercentage: 0.7,
        },
      ],
    },
    options,
  };
}

// One label and its value, in the Records list style
function StatRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <li className="record-row">
      <span className="record-name">
        <span className="record-label">{label}</span>
      </span>
      <span className="record-end">
        <span className="record-value">{children}</span>
      </span>
    </li>
  );
}

// The selected map's details. The card stretches to the panel height, so the monthly chart takes the space the list
// leaves, and the link sits under it.
export function MapCard({ row, history, hasHours, onViewMatches }: MapCardProps) {
  const { stats } = row;
  const config = useMemo(() => monthlyConfig(history.monthly), [history.monthly]);
  const { topClass, recent } = history;

  return (
    <section className="panel map-card" aria-label="Selected map">
      <header className="map-card-head">
        <h2 className="map-card-name">{breakAfterUnderscores(row.map)}</h2>
        <p className="map-card-mode">{row.mode}</p>
      </header>
      <div className="well">
        <ul className="record-list">
          <StatRow label="Matches">{row.matches}</StatRow>
          <StatRow label="Share">{row.share}</StatRow>
          {hasHours && <StatRow label="Time played">{row.played}</StatRow>}
          <StatRow label="Win rate">{row.winRate}</StatRow>
          <StatRow label="K/D">{row.kd}</StatRow>
          <StatRow label="Avg damage">{row.damage}</StatRow>
          <StatRow label="First played">{dateText(history.firstTime, { year: "numeric", month: "short", day: "numeric" })}</StatRow>
          <StatRow label="Last played">{dateText(stats.lastTime, { year: "numeric", month: "short", day: "numeric" })}</StatRow>
          <StatRow label="Most played class">
            {topClass ? (
              <span className="map-card-class">
                <img className="class-icon" src={`${import.meta.env.BASE_URL}ui/classes/${topClass.name.toLowerCase()}.png`} alt="" />
                {topClass.name}
              </span>
            ) : (
              "-"
            )}
          </StatRow>
          <StatRow label="Last 10">
            {recent.length > 0 ? (
              <span className="map-recent" role="img" aria-label={recent.map((outcome) => OUTCOME_TEXT[outcome]).join(", ")}>
                {recent.map((outcome, i) => (
                  <span key={i} className={`map-recent-square map-recent-${outcome}`} />
                ))}
              </span>
            ) : (
              "-"
            )}
          </StatRow>
        </ul>
      </div>
      <div className="map-card-chart">
        <p className="map-card-caption">Matches per month</p>
        {history.monthly.length > 0 ? <ChartCanvas config={config} /> : <PanelNote>No dated matches</PanelNote>}
      </div>
      <TextButton className="map-card-link" onClick={() => onViewMatches(row.map)}>
        View matches
      </TextButton>
    </section>
  );
}
