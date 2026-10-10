// Reads the map-to-mode table from the TF2 Wiki's List of maps page.

// The rendered page is the same content the wiki shows, and it holds the
// "File name" and "Game mode" text exactly as readers see it.
const WIKI_API_URL = "https://wiki.teamfortress.com/w/api.php?action=parse&page=List_of_maps&prop=text&format=json&formatversion=2";
const USER_AGENT = "tf2-data-visualizer/1.0 (map-data refresh script)";

// Maps the wiki "Game mode" cell text to our internal mode key.
// Keys are the map name prefixes the app groups by (see getGameModeFromMapName).
// A null value means the row is a developer or test map and is left out.
const WIKI_MODE_TO_KEY = new Map<string, string | null>([
  ["Capture the Flag", "ctf"],
  ["Control Point", "cp"], // symmetric 5CP
  ["Attack/Defend", "ad"], // e.g. cp_dustbowl, cp_gorge
  ["Attack/DefendPayload", "cppl"], // cppl_gavle (wiki concatenates without space)
  ["Attack/Defend Payload", "cppl"], // alternate spacing
  ["Medieval Mode", "medieval"], // cp_degrootkeep etc.
  ["Capture the FlagMedieval Mode", "medieval"], // ctf_medi_evil: two mode labels in one cell; Medieval Mode changes how the map plays, like cp_degrootkeep
  ["Domination", "cp"], // cp_standin, essentially 5CP
  ["Territorial Control", "tc"],
  ["Payload", "pl"],
  ["Payload Race", "plr"],
  ["Arena", "arena"],
  ["King of the Hill", "koth"],
  ["Special Delivery", "sd"],
  ["Mann vs. Machine", "mvm"],
  ["Robot Destruction", "rd"],
  ["Mannpower", "mann"],
  ["PASS Time", "pass"],
  ["Player Destruction", "pd"],
  ["Versus Saxton Hale", "vsh"],
  ["Zombie Infection", "zi"],
  ["Tug of War", "tow"],
  ["Hold the Flag", "htf"],
  ["Training Mode", "tr"],
  // Developer and test maps: omitted from the output.
  ["Test", null],
  ["N/A", null],
]);

function errorText(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  // fetch reports network failures as "fetch failed" with the real reason in cause.
  return error.cause instanceof Error ? error.cause.message : error.message;
}

// Narrows the API response without trusting its shape.
function renderedHtml(body: unknown): string | null {
  if (typeof body !== "object" || body === null || !("parse" in body)) return null;
  const parse = body.parse;
  if (typeof parse !== "object" || parse === null || !("text" in parse)) return null;
  return typeof parse.text === "string" ? parse.text : null;
}

async function fetchMapListHtml(): Promise<string> {
  let response: Response;
  try {
    response = await fetch(WIKI_API_URL, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    throw new Error(`Could not reach the TF2 Wiki: ${errorText(error)}`);
  }
  if (!response.ok) throw new Error(`The TF2 Wiki returned HTTP ${response.status}.`);

  const html = renderedHtml(await response.json());
  if (html === null) throw new Error("The TF2 Wiki response did not contain the List of maps page.");
  return html;
}

// A small HTML tree, enough to walk the wikitable rows. It handles comments,
// void tags, and script or style blocks, and it closes unmatched tags quietly.
type HtmlElement = { name: string; classes: string[]; children: Array<HtmlElement | string> };

const VOID_TAGS = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);
const RAW_TEXT_TAGS = new Set(["script", "style"]);
const TAG_PATTERN = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*)\s*(\/?)>/y;
const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

// Decodes the entities that appear on the wiki page. Other named entities are left as written.
function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (whole, body: string) => {
    if (body.startsWith("#x")) return String.fromCodePoint(parseInt(body.slice(2), 16));
    if (body.startsWith("#")) return String.fromCodePoint(parseInt(body.slice(1), 10));
    return ENTITIES[body] ?? whole;
  });
}

function parseHtml(html: string): HtmlElement {
  const root: HtmlElement = { name: "", classes: [], children: [] };
  const stack: HtmlElement[] = [root];
  const top = () => stack[stack.length - 1];
  let pos = 0;

  while (pos < html.length) {
    const lt = html.indexOf("<", pos);
    const textEnd = lt === -1 ? html.length : lt;
    if (textEnd > pos) top().children.push(decodeEntities(html.slice(pos, textEnd)));
    if (lt === -1) break;

    if (html.startsWith("<!--", lt)) {
      const close = html.indexOf("-->", lt + 4);
      pos = close === -1 ? html.length : close + 3;
      continue;
    }
    // Doctype and other <! or <? markup carries no text we need.
    if (html[lt + 1] === "!" || html[lt + 1] === "?") {
      const close = html.indexOf(">", lt);
      pos = close === -1 ? html.length : close + 1;
      continue;
    }

    TAG_PATTERN.lastIndex = lt;
    const tag = TAG_PATTERN.exec(html);
    if (!tag) {
      // A stray "<" is text.
      top().children.push("<");
      pos = lt + 1;
      continue;
    }
    pos = lt + tag[0].length;
    const name = tag[2].toLowerCase();

    if (tag[1] === "/") {
      // Close the nearest open element with this name, dropping anything left open inside it.
      for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i].name === name) {
          stack.length = i;
          break;
        }
      }
      continue;
    }

    const classAttr = /(?:^|\s)class\s*=\s*"([^"]*)"/i.exec(tag[3]);
    const element: HtmlElement = { name, classes: classAttr ? classAttr[1].split(/\s+/) : [], children: [] };
    top().children.push(element);

    if (tag[4] === "/" || VOID_TAGS.has(name)) continue;
    if (RAW_TEXT_TAGS.has(name)) {
      // Script and style text is not page text: skip straight to the closing tag.
      const closeAt = html.toLowerCase().indexOf(`</${name}`, pos);
      pos = closeAt === -1 ? html.length : closeAt;
      continue;
    }
    stack.push(element);
  }
  return root;
}

// Every element under `node` in document order (the node itself is not included).
function findElements(node: HtmlElement, match: (element: HtmlElement) => boolean): HtmlElement[] {
  const found: HtmlElement[] = [];
  for (const child of node.children) {
    if (typeof child === "string") continue;
    if (match(child)) found.push(child);
    found.push(...findElements(child, match));
  }
  return found;
}

// The text under an element with each piece trimmed and the pieces joined
// with no separator, so a <br> between two names joins them.
function textOf(node: HtmlElement): string {
  const pieces: string[] = [];
  for (const child of node.children) {
    if (typeof child === "string") pieces.push(child.trim());
    else pieces.push(textOf(child));
  }
  return pieces.filter((piece) => piece !== "").join("");
}

// Returns map file name to mode key, in page order. Unknown game modes are
// reported and skipped; a page with no map tables is an error.
export async function buildMapModes(): Promise<Map<string, string>> {
  console.log("Fetching the TF2 Wiki map list");
  const root = parseHtml(await fetchMapListHtml());

  const modes = new Map<string, string>();
  for (const table of findElements(root, (el) => el.name === "table" && el.classes.includes("wikitable"))) {
    const rows = findElements(table, (el) => el.name === "tr");
    const headers = rows.length > 0 ? findElements(rows[0], (el) => el.name === "th" || el.name === "td").map(textOf) : [];

    // Only tables with both required columns are map tables.
    const fileCol = headers.indexOf("File name");
    const modeCol = headers.indexOf("Game mode");
    if (fileCol === -1 || modeCol === -1) continue;

    for (const row of rows) {
      const cells = findElements(row, (el) => el.name === "td");
      if (cells.length <= Math.max(fileCol, modeCol)) continue;

      const fileName = textOf(cells[fileCol]);
      const gameMode = textOf(cells[modeCol]);
      if (!fileName || !gameMode) continue;

      const modeKey = WIKI_MODE_TO_KEY.get(gameMode);
      if (modeKey === undefined) {
        console.warn(`warning: Unknown game mode '${gameMode}' for '${fileName}'`);
        continue;
      }
      if (modeKey === null) continue;
      modes.set(fileName, modeKey);
    }
  }

  // Also covers a page with no map tables at all.
  if (modes.size === 0) {
    throw new Error("No maps were extracted from the TF2 Wiki. Its page structure may have changed.");
  }
  return modes;
}

export function printModeBreakdown(modes: Array<[string, string]>): void {
  const counts = new Map<string, number>();
  for (const [, mode] of modes) counts.set(mode, (counts.get(mode) ?? 0) + 1);
  const sorted = [...counts].sort((a, b) => b[1] - a[1]);
  const modeWidth = Math.max(...sorted.map(([mode]) => mode.length));
  const countWidth = Math.max(...sorted.map(([, count]) => String(count).length));
  console.log("\nMode breakdown:");
  for (const [mode, count] of sorted) {
    console.log(`  ${mode.padEnd(modeWidth)}  ${String(count).padStart(countWidth)} ${count === 1 ? "map" : "maps"}`);
  }
}
