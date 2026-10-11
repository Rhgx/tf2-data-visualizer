import datacenterFile from "../../data/datacenters.json";

// A datacenter's location: its full name from Valve, the short "City, CC" name shown on the Matches tab, and its ISO
// 3166-1 alpha-2 country code ("" when the refresh could not map the location to a country).
export interface Datacenter {
  name: string;
  short: string;
  country: string;
}

// Locations keyed by the datacenter code in the match CSV (data/datacenters.json, see docs/development.md#updating-datacenter-names).
const DATACENTERS = new Map<string, Datacenter>(Object.entries(datacenterFile));

// The location for a datacenter code. A code missing from the file (an old or retired relay) is shown uppercased with no
// country, and an empty code stays empty.
export function datacenterOf(code: string): Datacenter {
  const upper = code.toUpperCase();
  return DATACENTERS.get(code) ?? { name: upper, short: upper, country: "" };
}
