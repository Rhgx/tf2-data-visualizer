// Chart.js is registered and styled in Chart.tsx. This file only holds colors and month helpers, so it does not import Chart.js.
export const palette = {
  red: "#b8383b", // RED team, Kills
  blu: "#5885a2", // BLU team, Deaths, Wins
  orange: "#efb471", // Damage
  tan: "#ebe2ca",
  olive: "#c7d49b", // Healing
  positive: "#99ccff", // TF2 positive attribute, WIN
};

// TF2 paint can colors for bars that need to tell apart from each other, in the order they are used
const BAR_COLORS = [
  "#cf7336", // Mann Co. Orange
  "#7d4071", // A Deep Commitment to Purple
  "#729e42", // Indubitably Green
  "#e7b53b", // Australium Gold
  "#5885a2", // Team Spirit BLU
  "#b8383b", // Team Spirit RED
  "#e9967a", // Dark Salmon Injustice
  "#bcddb3", // A Mann's Mint
  "#a57545", // Muskelmannbraun
  "#d8bed8", // Color No. 216-190-216
  "#32cd32", // The Bitter Taste of Defeat and Lime
  "#f0e68c", // The Color of a Gentlemann's Business Pants
  "#ff69b4", // Pink as Hell
  "#c5af91", // Peculiarly Drab Tincture
  "#2f4f4f", // A Color Similar to Slate
  "#808000", // Drably Olive
  "#694d3a", // Radigan Conagher Brown
  "#7e7e7e", // Aged Moustache Grey
  "#256d8d", // The Value of Teamwork BLU
  "#803020", // The Value of Teamwork RED
  "#839fa3", // Waterlogged Lab Coat BLU
  "#a89a8c", // Waterlogged Lab Coat RED
  "#c36c2d", // Cream Spirit RED
  "#b88035", // Cream Spirit BLU
];

// Cycles through BAR_COLORS, so neighbouring bars differ until the list wraps after 24 bars
export function barColor(index: number): string {
  return BAR_COLORS[index % BAR_COLORS.length];
}

// Calendar month of a timestamp in local time, as "2026-03", so months sort as plain strings.
export function monthKey(ms: number): string {
  const date = new Date(ms);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

// Built once, since a formatter costs far more than the format call and monthLabel runs once per chart month.
const monthFormatter = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" });

export function monthLabel(key: string): string {
  const [year, month] = key.split("-").map(Number);
  return monthFormatter.format(new Date(year, month - 1));
}
