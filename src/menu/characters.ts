// Character art behind the main menu, picked like TF2's characterbackgrounds.txt. The basic classes are always
// eligible, and each holiday adds its own set during its date window. Files live in public/ui/characters.
const CLASSES = ["scout", "soldier", "pyro", "demoman", "heavy", "engineer", "medic", "sniper", "spy"];

// Halloween and full moon share one set, as in TF2 (halloween_or_fullmoon).
const SPOOKY = [
  ...CLASSES.map((name) => `hwn_${name}`),
  ...CLASSES.map((name) => `hwn13_${name}`),
  ...CLASSES.map((name) => `hwn14_${name}`),
  ...CLASSES.map((name) => `zombie_${name}`),
  "hwn24_hale",
  "hwn24_upgrades",
];

const SMISSMAS = [...CLASSES.map((name) => `xms2011_${name}`), "xms2023_krampus", "xms2024_hale"];

// The holiday comes from the inline script in index.html, which uses the same UTC date windows as the menu background.
function eligibleCharacters(holiday: string | undefined): string[] {
  if (holiday === "halloween" || holiday === "fullmoon") return [...CLASSES, ...SPOOKY];
  if (holiday === "christmas") return [...CLASSES, ...SMISSMAS];
  return CLASSES;
}

// Module scope, so the pick happens once per page load and survives the menu remounting after Back.
const pool = eligibleCharacters(document.documentElement.dataset.holiday);
export const MENU_CHARACTER = `ui/characters/${pool[Math.floor(Math.random() * pool.length)]}.webp`;
