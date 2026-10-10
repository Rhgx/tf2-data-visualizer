import { useMemo } from "react";
import type { ChartConfiguration } from "chart.js";
import { ChartCanvas } from "../charts/Chart";
import { palette } from "../charts/theme";
import { Panel, PanelNote } from "../ui/Panel";
import { formatNumber, formatShortDuration } from "../lib/format";
import type { Match } from "../data/match";
import { RecordList } from "./RecordList";
import { averageOf, matchRecord, present, queueBins, sumOf, type RecordRow } from "./stats";

interface QueuePanelProps {
  queued: Match[];
  onFocusMatch: (key: string) => void;
}

export function QueuePanel({ queued, onFocusMatch }: QueuePanelProps) {
  const config = useMemo(() => queueConfig(queued), [queued]);
  const rows = useMemo(() => {
    const list: (RecordRow | null)[] = [
      { label: "Avg queue", value: formatShortDuration(averageOf(queued, "queueSeconds")) },
      { label: "Total queue", value: formatShortDuration(sumOf(queued, "queueSeconds")) },
      matchRecord("Longest queue", queued, (match) => match.queueSeconds, true, formatShortDuration),
      matchRecord("Shortest queue", queued, (match) => match.queueSeconds, false, formatShortDuration),
    ];
    return present(list);
  }, [queued]);

  if (queued.length === 0) {
    return (
      <Panel className="queue-panel" title="Queue times">
        <PanelNote>No queue times recorded.</PanelNote>
      </Panel>
    );
  }

  return (
    <Panel className="queue-panel" title="Queue times">
      <ChartCanvas config={config} height={180} />
      <RecordList rows={rows} onFocusMatch={onFocusMatch} />
    </Panel>
  );
}

function queueConfig(queued: Match[]): ChartConfiguration<"bar"> {
  const bins = queueBins(queued.map((match) => match.queueSeconds));
  return {
    type: "bar",
    data: {
      labels: bins.labels,
      datasets: [{ label: "Matches", data: bins.counts, backgroundColor: palette.tan }],
    },
    options: {
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0, callback: (value) => formatNumber(Number(value)) } } },
    },
  };
}
