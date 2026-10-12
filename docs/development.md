# Development

## Running it locally

With Node.js 26 and pnpm 11.3.0 (the version pinned in `package.json`):

```sh
git clone https://github.com/Rhgx/tf2-data-visualizer.git
cd tf2-data-visualizer
pnpm install --ignore-workspace
pnpm dev
```

If pnpm finds a workspace above this folder, add `--ignore-workspace` to each command.

## Layout

- `src/` is the React app. `App.tsx` switches between the menu and the dashboard. The `menu/`, `dashboard/`, `overview/`, `maps/`, and `matches/` folders hold the screens and tabs, and `ui/`, `charts/`, `data/`, `lib/`, and `styles/` hold the shared code.
- `scripts/` holds the maintainer tools: the map data refresh (`map-data/`), the datacenter refresh, the badge generator, and `fetcher.js`, the console script the help dialog copies.
- `public/` holds the TF2 art, sounds, fonts, and flags under `public/ui/`, copied into the build as they are.
- `data/` holds the JSON files the app imports at build time: map names, map modes, and datacenters. The scripts below write them.
- `docs/` holds these docs, the README screenshot, and the badges.

## Scripts

| Command            | What it does                                                                                       |
| ------------------ | -------------------------------------------------------------------------------------------------- |
| `pnpm dev`         | Starts the Vite dev server at http://127.0.0.1:5173 with hot reload.                               |
| `pnpm build`       | Type-checks the app, the Vite config, and the scripts, then builds the site into `dist/`.          |
| `pnpm preview`     | Serves the last build in `dist/` at 127.0.0.1.                                                     |
| `pnpm maps`        | Rebuilds `data/map-index.json` and `data/map-modes.json` (see [Updating the map list](#updating-the-map-list)). |
| `pnpm datacenters` | Rebuilds `data/datacenters.json` and the flags in `public/ui/flags/` (see [Updating datacenter names](#updating-datacenter-names)). |

## How a file moves through the app

1. `App.tsx` gets a file from the picker in `menu/MainMenu.tsx`, a drop anywhere on the page, or pasted CSV text, and calls `parseCsv`. In the same step it starts the `data/match.ts` and `dashboard/Dashboard.tsx` imports, so those chunks download while the worker parses.
2. `data/csv.ts` starts a worker per upload. The worker parses with PapaParse and returns rows of strings.
3. `toMatches` turns the rows into `Match` objects: numbers parsed, outcome and team read, map and mode resolved, classes decoded, and time played computed.
4. `App.tsx` keeps the matches once both the parse and the chunks are ready, then renders `Dashboard` with a key that changes on every load, so each upload starts with no filters, an empty search, and the Overview tab. The menu stays up until the dashboard can render.
5. `Dashboard` applies the three tri-state filters with `applyFilters` (Maps by `mapId`, Modes by `mode`, Type by `type`). Include lists keep only the listed values, and exclude lists drop them. The open dropdown's per-item counts come from one `countItems` pass over the matches.
6. The active tab gets the latest filtered matches through `useDeferredValue`, so a click updates the filter controls at once and rapid clicks render the tabs once. Switching to a tab shows the current list in the same render, and a hidden tab keeps the matches it last had. Activity, Trends, Maps, and Matches are also filled in while the browser is idle, after load and after each filter change, so opening them is quick. The tab components are wrapped in `memo`, so a header search that does not change the matches does not re-render them.
7. "<< Back" clears the upload, which unmounts `Dashboard` and its tabs and returns to the menu.

## Deploying

Pushes to `main` build the site and deploy it to GitHub Pages. The workflow in `.github/workflows/ci.yml` installs with `pnpm install --frozen-lockfile` on Node 26, runs `pnpm build`, and uploads `dist/` for the Pages deploy. Pull requests run the build only. `vite.config.ts` sets `base` to `./`, so the same build works under the repository's Pages path.

## Updating the map list

`pnpm maps` rebuilds `data/map-index.json` (map names) and `data/map-modes.json` (map modes). The names come from TF2's local `items_game.txt`, so it needs a Team Fortress 2 installation. The modes come from the TF2 Wiki's List of maps, so it needs internet access. The script searches the usual Steam installation and library locations on Windows, Linux, and macOS. If it cannot find TF2, pass the file path:

```sh
pnpm --ignore-workspace maps --input "/path/to/Team Fortress 2/tf/scripts/items/items_game.txt"
```

You can also set `TF2_ITEMS_GAME_PATH` to `items_game.txt` or the folder that holds it. Each output can be written elsewhere, and one dataset can be refreshed on its own:

```sh
pnpm --ignore-workspace maps --maps-output /path/to/map-index.json --modes-output /path/to/map-modes.json
pnpm --ignore-workspace maps --maps-only
pnpm --ignore-workspace maps --modes-only
```

If either step fails, the script prints one error line, exits with a non-zero code, and leaves both files as they were. The data is imported at build time, so run `pnpm build` or restart `pnpm dev` after refreshing it.

## Updating datacenter names

`pnpm datacenters` rebuilds `data/datacenters.json`. It maps each datacenter code in a match export (such as `sto`) to Valve's location name (such as `Stockholm - Kista (Sweden)`), a short `City, CC` name (such as `Stockholm, SE`), and a country code (such as `SE`). The names come from Valve's public Steam Datagram Relay config for TF2, so it needs internet access but no local TF2 installation:

```sh
pnpm --ignore-workspace datacenters
```

If a request or the parse fails, the script prints one error line, exits with a non-zero code, and leaves the data file as it was. A code missing from the file, such as an old or retired relay, is shown in uppercase with no flag on the Matches tab until the file is refreshed.

### Short names

The short name is the city from Valve's description, followed by the country code: `Warsaw, PL`. The city drops the trailing parenthetical, a hosting provider prefix (`Hetzner` or `Datapacket`, listed in `HOSTING_PREFIXES`), and any district after ` - `. `SHORT_NAME_OVERRIDES` holds the few cities the rules get wrong, such as `Tokyo Koto City` to `Tokyo`. A city that is not plain words gets a warning line, so add an override by hand rather than guessing. The match details show the short name next to the flag, and hovering the datacenter shows Valve's full name and the code.

### Flags

The country code comes from the parenthesized country or US state at the end of Valve's description, or from a bare place name such as `Singapore`. The script's `COUNTRY_CODES` table holds those names, and US states map to `US`. A description the table does not know gets an empty country, a warning line, and no flag. Add the name to `COUNTRY_CODES` in `scripts/datacenters.ts` rather than guessing a code.

Each refresh also downloads one flag per country in the file into `public/ui/flags/<code>.svg` (such as `public/ui/flags/se.svg`). The download is pinned by `TWEMOJI_TAG` in the script (currently `v17.0.3`), so a refresh gives the same artwork; change the tag on purpose. The app serves these files directly, with no request to a CDN at runtime. Flags for countries that no longer appear in the config are not deleted. The flag artwork's license is in [credits](credits.md).

## Updating the update list

`src/data/updates.ts` exports `UPDATES`, the TF2 updates that the Trends and Queue times charts can mark and the Activity calendar can outline. Each entry has a `date` (`"YYYY-MM-DD"`), a `name`, and a `kind`: `major` for the big updates, or `halloween`, `smissmas`, or `summer` for the seasonal ones. The names are the TF2 Wiki page titles, and the dates come from the wiki's [Patches](https://wiki.teamfortress.com/wiki/Patches) pages. The list starts with Meet Your Match (July 2016) and stays oldest first.

The list is edited by hand, with no script, so add each update when it ships. The data is imported at build time, so run `pnpm build` or restart `pnpm dev` after editing it.

## Updating the badges

The README badges are TF2 item-tooltip style SVGs in `docs/badges/`, made by `scripts/make-badges.py`. The script reads the game fonts in `public/ui/fonts` (WOFF2, which needs brotli to decode) and downloads the icons from Simple Icons through cdn.jsdelivr.net. It needs fonttools and brotli:

```sh
python -m pip install fonttools brotli
python scripts/make-badges.py
```

To add a badge, add a row to `BADGES` in the script (file name, icon slug, icon color, label, name, and an optional backing color for logos with cut-outs), then add the matching `<img>` to the README.

## Sounds

Each sound is a file in `public/ui/sfx/`, listed by name in `src/ui/sound.ts` and played with `playSound(name)`, or `playSound(name, gainDb)` for a play that is quieter by `gainDb` dB. The files are processed copies of `sound/ui/*.wav` from `tf2_sound_misc_dir.vpk`: mono, 44.1 kHz, 16-bit. Each one is leveled against the click (the active-RMS level of `buttonclick.wav`), and the shared output gain is 0.5. Mute silences all of them. A control that plays a panel sound on the same press has `data-sound="none"`, so the generic click is skipped.

| Name | File | TF2 source | Plays when | Processing |
| --- | --- | --- | --- | --- |
| click | `buttonclick.wav` | `sound/ui/buttonclick.wav` | buttons, tabs, text buttons, filter items, Maps chart bars | none |
| panel-open | `panel-open.wav` | `sound/ui/panel_open.wav` | help dialog or filter dropdown opens | 4 ms fade-out, 2 dB below the click |
| panel-close | `panel-close.wav` | `sound/ui/panel_close.wav` | help dialog or filter dropdown closes, by any path | 4 ms fade-out, 2 dB below the click |
| dashboard-ready | `dashboard-ready.wav` | `sound/ui/mm_join.wav` | a newly loaded CSV shows the dashboard | cut to 2.0 s with a 250 ms fade-out, 6 dB below the click |
| error | `error.wav` | `sound/ui/vote_no.wav` | a file fails to load or parse, or a tab shows its error panel | trailing silence cut, 30 ms fade-out, 3 dB below the click |
| strip-open | `strip-open.wav` | `sound/ui/slide_down.wav` | a Matches row's detail strip opens (click, Enter or Space) | 6 dB below the click |
| strip-close | `strip-close.wav` | `sound/ui/slide_up.wav` | a Matches row's detail strip closes | leading silence cut, 6 dB below the click |

The detail strip slides open in 180 ms and shut in 220 ms, timed to the two slide sounds. Switching rows slides the old strip shut while the new one opens, the table scrolls to keep the clicked row in place, and strip-close plays 8 dB quieter under strip-open. With reduced motion on, the strip snaps open and shut and plays the click instead, since nothing slides.

## Style

The color tokens (`--tan`, `--tan-muted`, `--rule`, `--red`, `--blu`, `--positive`, `--negative`, `--gold`) and the shared primitives live in `src/styles/base.css`, so a tab only adds feature-specific CSS. Feature CSS sits next to its component, such as `src/overview/overview.css`. Inline styles are only for the custom properties above.

- `.tf-button` (`.small-button`, `.icon-button`, `.menu-button`) is pressed when `aria-selected`, `aria-pressed`, or `aria-expanded` is `"true"`.
- `.tab-button` is a property-sheet tab for the dialog header, not a `.tf-button`. The selected tab has `aria-selected="true"`.
- `.table-wrapper tbody tr` rows are a fixed 28px. VirtualTable spacer rows have the class `vt-spacer`.
- `.panel` with a `.panel-title` header, `.panel-note` for small text and empty notes.
- `.well` for inset lists, `.table-wrapper` for tables (480px max height, sticky header).
- `.grid` with `--cols` for responsive panel grids (one column under 900px).
- `.field` and `.search` for controls, `.field.check` for checkboxes.
- `.hud-stat` for big numbers, `.bar-list` for bars (`--value`, `--bar-color`), `.chart-box` for canvases (`--h`).
- `.outcome-win`, `.outcome-loss`, `.outcome-tie`, `.outcome-none`, `.team-red`, `.team-blu`, `.text-button`.
- The dashboard is as tall as the viewport and only `.dialog-body` scrolls. `.tab-panel.fill` makes a tab fill that body, which Trends, Maps, and Matches use. Other tabs scroll with it.

Hover text goes in `data-tip="..."`, which `ui/tooltip.ts` shows in one shared tooltip. Never use `title`, and never put both on one element.

Other conventions:

- `index.html` has only the `#root` element for React, and React owns everything under it. A missing `#root` throws at startup through `getElement`.
- Show and hide with the `hidden` class, or the `hidden` attribute on a tab section. Filter items carry their include or exclude state in `data-state`, and in their accessible name ("Name, 152 matches, included").
- Team and outcome colors are fixed: RED is `--red`, BLU is `--blu`, WIN is `--positive`, LOSS is `--negative`, a stalemate is `--neutral`, and no result is `--tan-muted`.
- Chart bar colors come from `barColor` in `charts/theme.ts`, which cycles the TF2 paint colors by bar index.
- Map names, game modes, and datacenter locations are imported as JSON, so refreshing the data needs a rebuild or a dev server restart.
- The dashboard is a separate chunk, so the main bundle is only the menu, React, and the app shell. The dashboard chunk is prefetched once the menu is idle.
- Chart.js only has the types the charts use, registered in `charts/Chart.tsx`. A new chart type needs its controller, elements, scale, or plugin added there, or creating the chart throws "is not a registered" from Chart.js.
- The menu's character art uses the same media query as its CSS, so phones never download it. The 2014 and 2015 Halloween team art shows no character, as in TF2. The help dialog's script is a separate chunk that loads when the dialog first opens.
- Fonts are WOFF2 files in `public/ui/fonts`, with every glyph kept (no subsetting). `base.css` declares them and `index.html` preloads them. To replace a font, convert it with fontTools and keep the same family names.
