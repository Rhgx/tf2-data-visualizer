// Compact "12h 30m" for totals on the HUD and in tables. Sub-minute totals show as "<1m".
export function formatHours(seconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  if (totalSeconds === 0) return "0m";

  const totalMinutes = Math.round(totalSeconds / 60);
  if (totalMinutes === 0) return "<1m";

  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// One formatter per fraction digit count. toLocaleString with options builds a new Intl.NumberFormat on every call,
// and the table formats every row when it measures its columns.
const numberFormatters = new Map<number, Intl.NumberFormat>();

// The UI is English, so numbers and dates use en-US regardless of the browser locale.
export function formatNumber(value: number, maxFractionDigits = 0): string {
  let formatter = numberFormatters.get(maxFractionDigits);
  if (!formatter) {
    formatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: maxFractionDigits });
    numberFormatters.set(maxFractionDigits, formatter);
  }
  return formatter.format(value);
}

// Table cell duration: always keeps the seconds under an hour, so short matches never read as "<1m".
export function formatShortDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// The same fields toLocaleString("en-US") shows by default, built once because the raw view formats every row
const matchTimeFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
});

export function formatMatchTime(isoString: string | undefined): string {
  if (!isoString) return "N/A";
  const date = new Date(isoString);
  // Intl throws on an invalid date, where toLocaleString shows this text
  if (Number.isNaN(date.getTime())) return "Invalid Date";
  return matchTimeFormatter.format(date);
}

// Looks up a required element. A missing element means index.html and the components disagree, so fail loudly.
export function getElement<T extends HTMLElement>(id: string, type: new () => T): T {
  const element = document.getElementById(id);
  if (!(element instanceof type)) throw new Error(`Missing #${id} in index.html`);
  return element;
}
