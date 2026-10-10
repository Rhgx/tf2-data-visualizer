// Reads map names from TF2's items_game.txt (the master_maps_list block).

import { existsSync, readFileSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { homedir, platform } from "node:os";
import { isAbsolute, join, relative, sep } from "node:path";

const ENV_INPUT_PATH = "TF2_ITEMS_GAME_PATH";
const ITEMS_RELATIVE_PATH = join("steamapps", "common", "Team Fortress 2", "tf", "scripts", "items", "items_game.txt");

function expandHome(path: string): string {
  if (path === "~" || path.startsWith("~/") || path.startsWith("~\\")) return join(homedir(), path.slice(1));
  return path;
}

// Shows a path relative to the current directory when it is inside it.
export function displayPath(path: string): string {
  const relativePath = relative(process.cwd(), path);
  const outside = relativePath === ".." || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath);
  return outside ? path : relativePath;
}

function isDirectory(path: string): boolean {
  return statSync(path, { throwIfNoEntry: false })?.isDirectory() ?? false;
}

// A folder argument means the items_game.txt inside it.
function itemsGamePathFrom(path: string): string {
  const expanded = expandHome(path);
  return isDirectory(expanded) ? join(expanded, "items_game.txt") : expanded;
}

function candidateSteamRoots(): string[] {
  const home = homedir();
  switch (platform()) {
    case "win32": {
      const roots: string[] = [];
      for (const variable of ["PROGRAMFILES(X86)", "PROGRAMFILES"]) {
        const base = process.env[variable];
        if (base) roots.push(join(base, "Steam"));
      }
      return roots;
    }
    case "linux":
      return [
        join(home, ".steam", "steam"),
        join(home, ".local", "share", "Steam"),
        join(home, ".var", "app", "com.valvesoftware.Steam", ".local", "share", "Steam"),
      ];
    case "darwin":
      return [join(home, "Library", "Application Support", "Steam")];
    default:
      return [];
  }
}

// The Steam root plus every extra library listed in libraryfolders.vdf.
// Newer files write "path"  "D:\\SteamLibrary"; older ones write "1"  "D:\\SteamLibrary".
function steamLibraries(steamRoot: string): string[] {
  const libraries = [steamRoot];
  const foldersPath = join(steamRoot, "steamapps", "libraryfolders.vdf");
  if (!existsSync(foldersPath)) return libraries;

  const text = readFileSync(foldersPath, "utf8");
  for (const match of text.matchAll(/"path"\s*"([^"]+)"/gi)) {
    libraries.push(match[1].replaceAll("\\\\", "\\"));
  }
  for (const match of text.matchAll(/"\d+"\s*"([^"]+)"/g)) {
    const value = match[1].replaceAll("\\\\", "\\");
    // Numeric keys also hold non-path values, so only values with a separator count as library paths.
    if (/[\\/]/.test(value)) libraries.push(value);
  }
  return [...new Set(libraries.map(expandHome))];
}

// Returns the first items_game.txt that exists, or null when nothing is found.
function findItemsGamePath(input: string | undefined): string | null {
  if (input !== undefined) return itemsGamePathFrom(input);

  const fromEnv = process.env[ENV_INPUT_PATH];
  if (fromEnv) return itemsGamePathFrom(fromEnv);

  const candidates = candidateSteamRoots().flatMap((root) =>
    steamLibraries(root).map((library) => join(library, ITEMS_RELATIVE_PATH)),
  );
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

// Returns the index just past the "}" that closes the "{" at `open`, or -1.
function findBlockEnd(text: string, open: number): number {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

// Returns map ID to map name, in file order. A repeated ID keeps its first
// position and takes the later name.
export async function buildMapIndex(input: string | undefined): Promise<Map<string, string>> {
  const itemsPath = findItemsGamePath(input);
  if (itemsPath === null) {
    throw new Error(`Could not find TF2 items_game.txt. Pass --input <path> or set ${ENV_INPUT_PATH}.`);
  }
  if (!existsSync(itemsPath)) throw new Error(`Could not find items_game.txt at ${itemsPath}`);

  console.log(`Reading ${displayPath(itemsPath)}`);
  const content = await readFile(itemsPath, "utf8");

  // Slice the whole master_maps_list block so only its entries are matched.
  const start = /"master_maps_list"\s*\{/i.exec(content);
  if (!start) throw new Error("Could not locate 'master_maps_list' in items_game.txt.");
  const end = findBlockEnd(content, start.index + start[0].length - 1);
  if (end === -1) throw new Error("Could not find the end of the master_maps_list block.");
  const block = content.slice(start.index, end);

  // [^}] keeps each match inside one entry, so a name is never taken from the next entry.
  const maps = new Map<string, string>();
  for (const match of block.matchAll(/"(\d+)"\s*\{[^}]*?"name"\s*"([^"]+)"/g)) {
    maps.set(match[1], match[2]);
  }
  // Writing an empty index would silently break the app, so treat it as a failed parse.
  if (maps.size === 0) throw new Error("No maps were found in master_maps_list.");
  return maps;
}
