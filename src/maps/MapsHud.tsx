import { formatNumber } from "../lib/format";
import { HudStat } from "../ui/HudStat";
import type { MapStats } from "./stats";

interface MapsHudProps {
  totalMatches: number;
  uniqueMaps: number;
  mostPlayed: MapStats;
  // Already formatted, so "N/A" when no match has played time
  timePlayed: string;
}

export function MapsHud({ totalMatches, uniqueMaps, mostPlayed, timePlayed }: MapsHudProps) {
  return (
    <div className="grid maps-hud">
      <HudStat value={formatNumber(totalMatches)} label="Matches" tip="Matches with a known map in the current filters" />
      <HudStat value={formatNumber(uniqueMaps)} label="Unique maps" />
      <HudStat value={formatNumber(mostPlayed.matches)} label={`Most played: ${mostPlayed.name}`} />
      <HudStat
        value={timePlayed}
        label="Time played"
        tip="Total time in these matches. N/A means the file has no played time"
      />
    </div>
  );
}
