// Refreshes data/datacenters.json: the location name, a short "City, CC" name and the country for each Steam Datagram
// Relay datacenter code (for example "sto" to "Stockholm - Kista (Sweden)", "Stockholm, SE" and "SE"), from the public
// SDR config that Valve serves for TF2 (appid 440). It also downloads the Twemoji flag for each country into
// public/ui/flags.
//
// Usage: pnpm datacenters

import { mkdir, writeFile } from "node:fs/promises";
import { EOL } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { displayPath } from "./map-data/maps.ts";

const SDR_CONFIG_URL = "https://api.steampowered.com/ISteamApps/GetSDRConfig/v1/?appid=440";
const USER_AGENT = "tf2-data-visualizer/1.0 (datacenter data refresh script)";
const OUTPUT = fileURLToPath(new URL("../data/datacenters.json", import.meta.url));
const FLAGS_DIR = fileURLToPath(new URL("../public/ui/flags/", import.meta.url));
// The jdecked/twemoji release the flags come from (graphics under CC-BY 4.0). Pinned rather than @latest so a refresh
// reproduces the same artwork.
const TWEMOJI_TAG = "v17.0.3";

// Valve's place names to ISO 3166-1 alpha-2 codes: countries, the places Valve names without a country (Guam, Hong Kong,
// Singapore), and US states, which map to US. Georgia here is the US state (Atlanta); Valve lists no Georgian datacenter.
// A name missing from the table is reported by the refresh, and is added here rather than guessed.
const COUNTRY_CODES = new Map<string, string>([
  ["Argentina", "AR"],
  ["Australia", "AU"],
  ["Austria", "AT"],
  ["Brazil", "BR"],
  ["California", "US"],
  ["Chile", "CL"],
  ["England", "GB"],
  ["Finland", "FI"],
  ["France", "FR"],
  ["Georgia", "US"],
  ["Germany", "DE"],
  ["Guam", "GU"],
  ["Hong Kong", "HK"],
  ["Illinois", "US"],
  ["India", "IN"],
  ["Japan", "JP"],
  ["Netherlands", "NL"],
  ["Peru", "PE"],
  ["Poland", "PL"],
  ["Singapore", "SG"],
  ["South Africa", "ZA"],
  ["South Korea", "KR"],
  ["Spain", "ES"],
  ["Sweden", "SE"],
  ["Texas", "US"],
  ["United Arab Emirates", "AE"],
  ["Virginia", "US"],
  ["Washington", "US"],
]);

// Hosting providers Valve puts in front of a city ("Hetzner Falkenstein"). They are dropped from the short name.
const HOSTING_PREFIXES = ["Datapacket ", "Hetzner "];

// Short names the rules in shortNameOf get wrong, keyed by the city as it reads after those rules.
const SHORT_NAME_OVERRIDES = new Map<string, string>([["Tokyo Koto City", "Tokyo"]]);

type Datacenter = { name: string; short: string; country: string };

function errorText(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  // fetch reports network failures as "fetch failed" with the real reason in cause.
  return error.cause instanceof Error ? error.cause.message : error.message;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function fetchSdrConfig(): Promise<unknown> {
  console.log("Fetching the Steam Datagram Relay config");
  let response: Response;
  try {
    response = await fetch(SDR_CONFIG_URL, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    throw new Error(`Could not reach the Steam API: ${errorText(error)}`);
  }
  if (!response.ok) throw new Error(`The Steam API returned HTTP ${response.status}.`);
  return response.json();
}

// The ISO code for a description. Valve ends it with the country or US state in parentheses ("Stockholm - Kista (Sweden)"),
// or gives a bare place name ("Singapore"). Returns "" for a place the table does not know.
function countryCodeOf(desc: string): string {
  const parenthesized = /\(([^()]+)\)$/.exec(desc);
  return COUNTRY_CODES.get(parenthesized ? parenthesized[1] : desc) ?? "";
}

// The city for a description, as the Matches tab names it. "Stockholm - Kista (Sweden)" becomes "Stockholm" and
// "Hetzner Falkenstein (Germany)" becomes "Falkenstein". A result that is not plain words is reported, so the override
// table can be extended by hand rather than guessed.
function cityOf(desc: string): string {
  const place = desc.replace(/\s*\([^()]*\)$/, "");
  const provider = HOSTING_PREFIXES.find((prefix) => place.startsWith(prefix));
  const city = (provider ? place.slice(provider.length) : place).split(" - ")[0];
  const short = SHORT_NAME_OVERRIDES.get(city) ?? city;
  if (!/^[A-Za-z]+( [A-Za-z]+)*$/.test(short)) console.warn(`warning: Unusual city for '${desc}' ('${short}')`);
  return short;
}

// Returns datacenter code to location, from the config's "pops" object. An entry without a description is reported and
// skipped, so one odd entry does not block the refresh. An entry with an unknown country keeps its name, with an empty country.
function datacentersFrom(body: unknown): Map<string, Datacenter> {
  const pops = isRecord(body) ? body.pops : undefined;
  if (!isRecord(pops)) throw new Error("The SDR config did not contain a pops list.");

  const datacenters = new Map<string, Datacenter>();
  for (const [code, pop] of Object.entries(pops)) {
    const desc = isRecord(pop) ? pop.desc : undefined;
    if (typeof desc !== "string" || desc === "") {
      console.warn(`warning: No description for '${code}'`);
      continue;
    }
    const country = countryCodeOf(desc);
    if (country === "") console.warn(`warning: No country for '${code}' ('${desc}')`);
    const city = cityOf(desc);
    datacenters.set(code, { name: desc, short: country ? `${city}, ${country}` : city, country });
  }
  // Writing an empty file would silently blank the Matches tab, so treat it as a failed parse.
  if (datacenters.size === 0) throw new Error("No datacenters were found in the SDR config.");
  return datacenters;
}

// Twemoji names a flag by its two regional indicator symbols in lowercase hex, joined by "-" ("SE" is 1f1f8-1f1ea).
function twemojiFileName(code: string): string {
  return [...code].map((letter) => (0x1f1e6 + letter.charCodeAt(0) - 0x41).toString(16)).join("-");
}

async function downloadFlag(code: string): Promise<void> {
  const url = `https://cdn.jsdelivr.net/gh/jdecked/twemoji@${TWEMOJI_TAG}/assets/svg/${twemojiFileName(code)}.svg`;
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    throw new Error(`Could not reach the Twemoji CDN for '${code}': ${errorText(error)}`);
  }
  if (!response.ok) throw new Error(`The Twemoji CDN returned HTTP ${response.status} for '${code}'.`);
  await writeFile(join(FLAGS_DIR, `${code.toLowerCase()}.svg`), new Uint8Array(await response.arrayBuffer()));
}

async function main(): Promise<void> {
  const datacenters = datacentersFrom(await fetchSdrConfig());

  // Flags are downloaded before the data file is written, so a failed request leaves the data file as it was.
  const countries = new Set([...datacenters.values()].map(({ country }) => country));
  countries.delete("");
  console.log(`Downloading ${countries.size} country flags to ${displayPath(FLAGS_DIR)}`);
  await mkdir(FLAGS_DIR, { recursive: true });
  await Promise.all([...countries].map((code) => downloadFlag(code)));

  // Sorted by code point; the keys are ASCII codes.
  const sorted = Object.fromEntries([...datacenters].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  // Same layout as the map data: two-space indent, no trailing newline, and os.EOL line breaks.
  await writeFile(OUTPUT, JSON.stringify(sorted, null, 2).replaceAll("\n", EOL), "utf8");
  console.log(`Wrote ${datacenters.size} datacenters to ${displayPath(OUTPUT)}`);
}

try {
  await main();
} catch (error) {
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
