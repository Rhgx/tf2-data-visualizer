// Refreshes data/map-index.json (map names from TF2's items_game.txt) and
// data/map-modes.json (map file name to game mode key, from the TF2 Wiki).
//
// Usage: pnpm maps [--input <items_game.txt or its folder>]
//        [--maps-output <path>] [--modes-output <path>] [--maps-only | --modes-only]
// TF2_ITEMS_GAME_PATH can hold the same input path as --input.

import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { EOL } from "node:os";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { buildMapIndex, displayPath } from "./maps.ts";
import { buildMapModes, printModeBreakdown } from "./modes.ts";

const DEFAULT_MAPS_OUTPUT = fileURLToPath(new URL("../../data/map-index.json", import.meta.url));
const DEFAULT_MODES_OUTPUT = fileURLToPath(new URL("../../data/map-modes.json", import.meta.url));

// JSON value that keeps insertion order. Plain objects would move numeric
// keys such as map IDs to the front in ascending order.
type JsonNode = string | Map<string, JsonNode>;

// Keeps the committed data files byte-identical across refreshes: two-space indent, ASCII-only
// strings, no trailing newline. Line breaks use os.EOL, so a Windows refresh writes CRLF like the committed files.
function formatJson(node: JsonNode, depth = 0): string {
  if (typeof node === "string") {
    // JSON.stringify leaves non-ASCII characters as they are, so each UTF-16 unit is escaped here.
    return JSON.stringify(node).replace(/[^\x20-\x7e]/g, (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`);
  }
  if (node.size === 0) return "{}";
  const inner = "  ".repeat(depth + 1);
  const lines = [...node].map(([key, value]) => `${inner}${formatJson(key)}: ${formatJson(value, depth + 1)}`);
  return `{${EOL}${lines.join(`,${EOL}`)}${EOL}${"  ".repeat(depth)}}`;
}

interface JsonFile {
  path: string;
  text: string;
}

// Returns the file's current text, or null when it does not exist yet.
async function readExisting(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return null;
    throw error;
  }
}

// Each file is written to a temp file beside its destination, then renamed over it, so a failed write never leaves
// a truncated destination. If a rename fails after earlier ones succeeded, those destinations get their old text back.
async function writeJsonFiles(files: JsonFile[]): Promise<void> {
  const temps = files.map((file) => `${file.path}.${process.pid}.tmp`);
  const previous = await Promise.all(files.map((file) => readExisting(file.path)));
  let renamed = 0;
  try {
    for (const [index, file] of files.entries()) {
      await mkdir(dirname(file.path), { recursive: true });
      await writeFile(temps[index], file.text, "utf8");
    }
    for (const [index, file] of files.entries()) {
      await rename(temps[index], file.path);
      renamed += 1;
    }
  } catch (error) {
    await Promise.all(temps.map((temp) => rm(temp, { force: true })));
    for (const [index, file] of files.slice(0, renamed).entries()) {
      const text = previous[index];
      if (text === null) await rm(file.path, { force: true });
      else await writeFile(file.path, text, "utf8");
    }
    throw error;
  }
}

function parseCli() {
  const { values } = parseArgs({
    options: {
      input: { type: "string" },
      "maps-output": { type: "string" },
      "modes-output": { type: "string" },
      "maps-only": { type: "boolean" },
      "modes-only": { type: "boolean" },
    },
    strict: true,
  });
  if (values["maps-only"] && values["modes-only"]) {
    throw new Error("Pass only one of --maps-only and --modes-only.");
  }
  return {
    input: values.input,
    mapsOutput: values["maps-output"] ?? DEFAULT_MAPS_OUTPUT,
    modesOutput: values["modes-output"] ?? DEFAULT_MODES_OUTPUT,
    refreshMaps: !values["modes-only"],
    refreshModes: !values["maps-only"],
  };
}

async function main(): Promise<void> {
  const args = parseCli();

  // Build both datasets before writing either file, so a failed fetch or
  // parse never leaves one file refreshed and the other stale.
  const mapNames = args.refreshMaps ? await buildMapIndex(args.input) : null;
  const mapModes = args.refreshModes ? await buildMapModes() : null;

  const files: JsonFile[] = [];
  if (mapNames) {
    const maps = new Map<string, JsonNode>([...mapNames].map(([id, name]) => [id, new Map<string, JsonNode>([["name", name]])]));
    files.push({ path: args.mapsOutput, text: formatJson(new Map<string, JsonNode>([["master_maps_list", maps]])) });
  }
  if (mapModes) {
    // Sorted by code point; the keys are ASCII file names.
    const sorted = [...mapModes].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    files.push({ path: args.modesOutput, text: formatJson(new Map<string, JsonNode>([["map_modes", new Map<string, JsonNode>(sorted)]])) });
  }
  await writeJsonFiles(files);

  if (mapNames) console.log(`Wrote ${mapNames.size} maps to ${displayPath(args.mapsOutput)}`);
  if (mapModes) {
    console.log(`Wrote ${mapModes.size} maps to ${displayPath(args.modesOutput)}`);
    printModeBreakdown([...mapModes]);
  }
}

try {
  await main();
} catch (error) {
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
