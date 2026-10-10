import { kdRatio, formatWinRate } from "../data/match";
import { gameModeName } from "../data/maps";
import { formatHours, formatNumber } from "../lib/format";
import { Panel, PanelNote } from "../ui/Panel";
import { VirtualTable, type Column } from "../ui/VirtualTable";
import { mapWinRate, percent, plural, type MapStats } from "./stats";

// Every cell as display text, built once per map. The table sorts these rows and sizes its columns from their text.
export interface MapRow {
  // The map's own stats, for the table's sort
  stats: MapStats;
  id: string;
  map: string;
  mode: string;
  matches: string;
  share: string;
  played: string;
  winRate: string;
  kd: string;
  damage: string;
}

export function tableRows(stats: MapStats[], totalMatches: number): MapRow[] {
  return stats.map((s) => {
    const rate = mapWinRate(s);
    // Maps with no decided results (MvM) have no real K/D or damage, so a dash beats a misleading 0
    const hasStats = rate !== null;
    return {
      stats: s,
      id: s.id,
      map: s.name,
      mode: s.mode ? gameModeName(s.mode) : "Unknown",
      matches: formatNumber(s.matches),
      share: percent(s.matches, totalMatches),
      played: formatHours(s.seconds),
      winRate: formatWinRate(rate),
      kd: hasStats ? kdRatio(s.kills, s.deaths) : "-",
      damage: hasStats ? formatNumber(Math.round(s.damage / s.results)) : "-",
    };
  });
}

const MAP: Column<MapRow> = { key: "map", label: "Map", text: (row) => row.map };
const MODE: Column<MapRow> = { key: "mode", label: "Mode", text: (row) => row.mode };
const MATCHES: Column<MapRow> = { key: "matches", label: "Matches", text: (row) => row.matches };
const SHARE: Column<MapRow> = {
  key: "share",
  label: "Share",
  tip: "Share of all matches in the current filters",
  text: (row) => row.share,
};
const PLAYED: Column<MapRow> = { key: "played", label: "Time played", text: (row) => row.played };
const WIN_RATE: Column<MapRow> = {
  key: "winRate",
  label: "Win rate",
  tip: "Wins divided by wins, losses and stalemates. Maps with no results show -",
  text: (row) => row.winRate,
};
const KD: Column<MapRow> = {
  key: "kd",
  label: "K/D",
  tip: "Kills divided by deaths over matches with a result",
  text: (row) => row.kd,
};
const DAMAGE: Column<MapRow> = {
  key: "damage",
  label: "Avg damage",
  tip: "Average damage per match, over matches with a result",
  text: (row) => row.damage,
};

// Time played is optional: it only appears when some match has played time
const COLUMNS: Column<MapRow>[] = [MAP, MODE, MATCHES, SHARE, WIN_RATE, KD, DAMAGE];
const COLUMNS_WITH_TIME: Column<MapRow>[] = [MAP, MODE, MATCHES, SHARE, PLAYED, WIN_RATE, KD, DAMAGE];

function rowKey(row: MapRow): string {
  return row.id;
}

interface MapDetailsPanelProps {
  // Already sorted by the table's own sort, not the chart's rank
  rows: MapRow[];
  hasHours: boolean;
}

export function MapDetailsPanel({ rows, hasHours }: MapDetailsPanelProps) {
  return (
    <Panel title="Map details" actions={<PanelNote>{plural(rows.length, "map", "maps")}</PanelNote>}>
      <VirtualTable rows={rows} columns={hasHours ? COLUMNS_WITH_TIME : COLUMNS} rowKey={rowKey} />
    </Panel>
  );
}
