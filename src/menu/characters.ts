// Character art behind the main menu, picked like TF2's characterbackgrounds.txt. The basic classes show outside
// holidays. During a holiday only that holiday's set is eligible, as in TF2 (tf_hud_mainmenuoverride.cpp).
// Files live in public/ui/characters.
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
  if (holiday === "halloween" || holiday === "fullmoon") return SPOOKY;
  if (holiday === "christmas") return SMISSMAS;
  return CLASSES;
}

// Module scope, so the pick happens once per page load and survives the menu remounting after Back.
const pool = eligibleCharacters(document.documentElement.dataset.holiday);
// index.html sets noCharacter for the 2014 and 2015 Halloween team art, which has no character portrait.
export const MENU_CHARACTER: string | null =
  document.documentElement.dataset.noCharacter !== undefined ? null : `ui/characters/${pool[Math.floor(Math.random() * pool.length)]}.webp`;
