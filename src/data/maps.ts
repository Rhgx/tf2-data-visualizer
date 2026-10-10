import mapIndexFile from "../../data/map-index.json";
import mapModesFile from "../../data/map-modes.json";

const mapNames: Partial<Record<string, { name: string }>> = mapIndexFile.master_maps_list;

// Authoritative map file to mode lookup from the TF2 Wiki scrape (data/map-modes.json).
const mapModes: Partial<Record<string, string>> = mapModesFile.map_modes;

export function mapNameById(id: string): string | undefined {
  return mapNames[id]?.name;
}

export function mapLabel(id: string): string {
  return mapNameById(id) || `Unknown (${id})`;
}

// CTF maps that are actually Mannpower mode
const MANNPOWER_MAPS = new Set([
  "ctf_foundry",
  "ctf_hellfire",
  "ctf_gorge",
  "ctf_thundermountain",
]);

const GAME_MODE_NAMES: Record<string, string> = {
  pl: "Payload",
  plr: "Payload Race",
  cp: "Control Points",
  cppl: "Control Point Payload",
  koth: "King of the Hill",
  "2koth": "Double KOTH",
  ctf: "Capture the Flag",
  mann: "Mannpower",
  mvm: "Mann vs Machine",
  arena: "Arena",
  sd: "Special Delivery",
  tc: "Territorial Control",
  pass: "PASS Time",
  pd: "Player Destruction",
  rd: "Robot Destruction",
  vsh: "Versus Saxton Hale",
  tow: "Tug of War",
  zi: "Zombie Infection",
  // Wiki-derived sub-modes
  ad: "Attack/Defend",
  medieval: "Medieval Mode",
  htf: "Hold the Flag",
  tr: "Training Mode",
};

export function gameModeName(mode: string): string {
  return GAME_MODE_NAMES[mode] || mode.toUpperCase();
}

export function getGameModeFromMapName(mapName: string): string | null {
  if (!mapName || mapName.startsWith("Unknown")) return null;
  // The wiki folds 2koth_ maps into koth, so check the prefix before the lookup
  if (mapName.startsWith("2koth_")) return "2koth";
  const wikiMode = mapModes[mapName];
  if (wikiMode) return wikiMode;
  if (MANNPOWER_MAPS.has(mapName)) return "mann";
  return mapName.split("_")[0] || null;
}
