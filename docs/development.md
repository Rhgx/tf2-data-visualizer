# Development

## Project layout

```
index.html           shell: head (font and image preloads), the menu background script, and the #root element
package.json         scripts, and the pnpm version pinned in packageManager
pnpm-lock.yaml       the lockfile; install with pnpm, not npm
vite.config.ts       React plugin, and a relative base so the build works under GitHub Pages
tsconfig.json        type check for src/
tsconfig.node.json   type check for vite.config.ts and scripts/map-data/*.ts
LICENSE              MIT, for the code only
.github/
  workflows/ci.yml   build on pushes to main and on pull requests; deploy to GitHub Pages on pushes to main
data/
  map-index.json     map names keyed by map_index (imported at build time)
  map-modes.json     map file name to game mode (imported at build time)
docs/
  development.md     this file: layout, data flow, styling and notes
  components.md      tab component API and shared UI components
  overview.md        the Overview tab charts
  data.md            the match data contract
  map-data.md        refreshing the map data
  badges.md          updating the README badges
  screenshot.webp    the README screenshot, made from synthetic data
  badges/            README badges, written by scripts/make-badges.py
public/ui/           TF2 assets copied from the game files, served as-is (see README credits)
  fonts/             tf2build.woff2 (headings) and tf2secondary.woff2 (body text), every glyph kept; make-badges.py reads them
  glyphs/            tab, button and CSV icons
  sfx/               buttonclick.wav, the click on TF2 controls (see README credits)
  classes/           class icons for the Classes column and panel
  characters/        menu character art
  console/           menu backgrounds and holiday title art
  button_*.png, innershadow_border.png, button_holder_central.png
                     panel, button and well textures used by base.css
scripts/
  fetcher.js         the console script copied from the help dialog (plain JS, not type checked; imported as raw text)
  map-data/          refreshes both data files (see map-data.md)
    cli.ts           the pnpm maps entry point: options, writing both files together, and the two steps
    maps.ts          map names from items_game.txt
    modes.ts         map modes from the TF2 Wiki's List of maps
  make-badges.py     regenerates docs/badges/ (see badges.md)
src/
  main.tsx           entry point: base.css, the tooltip and sound scripts, then createRoot(#root)
  App.tsx            screen state (menu or dashboard), loading from the picker, drop or paste, error alerts, drop overlay; loads the dashboard chunk lazily
  styles/
    base.css         tokens, buttons, panels, wells, grids, forms, bars, tables, footer, tooltip, drop overlay
  ui/
    Button.tsx       TfButton and TextButton
    Panel.tsx        Panel and PanelNote
    Field.tsx        SelectField, SearchField and CheckField
    HudStat.tsx      large number with a label
    BarList.tsx      BarList and BarRow for the bar charts
    VirtualTable.tsx windowed table that renders only the visible rows
    tooltip.ts       the shared data-tip tooltip; imported once for its listeners
    sound.ts         the button click sound and the mute state; imported once for its document listener, fetches the sound on the first unmuted gesture
    SoundButton.tsx  the mute toggle in both footers
    ui.css           VirtualTable's table layout
  charts/
    theme.ts         palette, barColor, monthKey, monthLabel; no Chart.js import here
    Chart.tsx        Chart.js registration and dark theme defaults, reduced motion, and ChartCanvas, a React wrapper around one Chart.js canvas
  data/
    csv.ts           CsvRow type, parseCsv (runs the worker), column and value helpers
    csv.worker.ts    PapaParse inside a module worker; quote and field-count errors fail the upload, blank lines are dropped
    match.ts         Match type: one CSV row with numbers and names resolved once (toMatches, kdRatio, winRate)
    maps.ts          map names and game modes, from data/*.json
  lib/
    format.ts        formatting (formatNumber, formatShortDuration, formatHours, formatMatchTime) and getElement
    idle.ts          whenIdle, an idle callback with a timeout fallback, for the dashboard prefetch and the tab warm-up
  menu/
    MainMenu.tsx     the menu: wordmark, Load Match History, the help button, the drop and paste hint
    HelpDialog.tsx   the "How do I get my data?" dialog with the copy script button; the script loads on the first open
    characters.ts    picks the menu character art for this page load
    menu.css         menu and help dialog styles
  dashboard/
    Dashboard.tsx    header (title, filter strip, tabs), the three tab sections, footer with << Back; Maps and Matches are filled in one at a time while idle, so their first open is cheap
    FilterMenu.tsx   one tri-state dropdown: button, search, list
    filters.ts       FilterState type, item lists, cycleItemState, applyFilters (pure)
    dashboard.css    header, tabs, filter strip and dropdown styles
  overview/
    OverviewTab.tsx  the Overview tab; lays out the panels below
    HudStrip.tsx     the five HUD numbers at the top
    ResultsPanel.tsx outcome bar, RED and BLU columns
    ActivityPanel.tsx matches per day calendar with a year selector, and the weekday by hour grids; the Matches / Hours / Win rate toggle is on the calendar
    FormPanel.tsx    monthly win rate and K/D lines, with matches per month as bars
    PerMatchPanel.tsx monthly averages per match for kills, deaths, damage and healing
    monthLine.ts     chart helpers shared by FormPanel and PerMatchPanel: gap segments, low-sample points, tooltips
    GameModesPanel.tsx matches per game mode
    ClassesPanel.tsx matches per class
    QueuePanel.tsx   queue time histogram, with bins picked from the data
    RecordsPanel.tsx records, each with a View link to its match
    RecordList.tsx   the row list used by ResultsPanel, QueuePanel and RecordsPanel
    Heatmap.tsx      the grid, legend and edge bars used by ActivityPanel
    UntimedNote.tsx  the note for matches without a timestamp
    stats.ts         pure calculations for the Overview tab, including heat levels and the queue time bins
    overview.css     Overview tab styles
  maps/
    MapsTab.tsx      the Maps tab: controls, state, and the charted and sorted lists
    MapsHud.tsx      the four HUD numbers for the Maps tab
    MapsChartPanel.tsx the top maps bar chart and its controls
    MapDetailsPanel.tsx the map details table
    stats.ts         per-map totals and the chart and table sort orders
    maps.css         Maps tab styles
  matches/
    MatchesTab.tsx   the Matches tab: rank, order, search, all columns, and focus handling
    ScoreboardControls.tsx the header controls of the scoreboard
    columns.tsx      the default columns and the raw CSV columns for "All columns"
    sort.ts          rank options, the search filter and the sort
    matches.css      Matches tab styles
```

`dist/` and `node_modules/` are build output and dependencies, and are not committed.

## How a file moves through the app

1. `App.tsx` receives a file from the picker in `MainMenu`, a drop anywhere on the page, or pasted CSV text, and calls `parseCsv`. In the same step it starts the `data/match` and `dashboard/Dashboard` imports, so those chunks download while the worker parses.
2. `data/csv.ts` starts a worker per upload. The worker parses with PapaParse and returns rows of strings.
3. `toMatches` turns the rows into `Match` objects: numbers parsed, outcome and team read, map and mode resolved, classes decoded, time played computed.
4. `App.tsx` keeps the matches once both the parse and the chunks are ready, then renders `Dashboard` with a key that changes on every load, so each upload starts with no filters, an empty search, and the Overview tab. The menu stays up until the dashboard can render.
5. `Dashboard` applies the three tri-state filters with `applyFilters` (Maps by `mapId`, Modes by `mode`, Type by `type`). Include lists keep only the listed values, exclude lists drop them.
6. The active tab gets the latest filtered matches, and switching to a tab shows the current list in the same render. A hidden tab keeps the matches it last had. Maps and Matches are also filled in while the browser is idle, after load and after each filter change, so opening them is quick. The tab components are wrapped in `memo`, so a header search that does not change the matches does not re-render them.
7. "<< Back" clears the upload, which unmounts `Dashboard` and its tabs and returns to the menu.

## Styling conventions

`styles/base.css` holds the color tokens (`--tan`, `--tan-muted`, `--rule`, `--red`, `--blu`, `--positive`, `--negative`, `--gold`) and the primitives the tabs use, so a tab only adds feature-specific CSS in its own file:

- `.tf-button` (`.small-button`, `.icon-button`, `.menu-button`) is pressed when `aria-selected`, `aria-pressed`, or `aria-expanded` is `"true"`.
- `.tab-button` is a property-sheet tab for the dialog header, not a `.tf-button`. The selected tab has `aria-selected="true"`.
- `.table-wrapper tbody tr` rows are a fixed 28px. VirtualTable spacer rows have the class `vt-spacer`.
- `.panel` with a `.panel-title` header, `.panel-note` for small text and empty notes.
- `.well` for inset lists, `.table-wrapper` for tables (480px max height, sticky header).
- `.grid` with `--cols` for responsive panel grids (one column under 900px).
- `.field` and `.search` for controls, `.field.check` for checkboxes.
- `.hud-stat` for big numbers, `.bar-list` for bars (`--value`, `--bar-color`), `.chart-box` for canvases (`--h`).
- `.outcome-win`, `.outcome-loss`, `.outcome-tie`, `.outcome-none`, `.team-red`, `.team-blu`, `.text-button`.

Feature CSS sits next to its component: `menu/menu.css`, `dashboard/dashboard.css`, `overview/overview.css`, `maps/maps.css`, `matches/matches.css`. Inline styles are only for the custom properties above.

Hover text goes in `data-tip="..."`, which `ui/tooltip.ts` shows in one shared tooltip. Never use `title`, and never put both on one element.

## Notes

- `index.html` only has `#root`. React owns everything under it. A missing `#root` throws at startup through `getElement`.
- Show and hide with the `hidden` class, or the `hidden` attribute on a tab section. Filter items carry their include or exclude state in `data-state`, and in their accessible name ("Name, included").
- Team and outcome colors are fixed: RED is `--red`, BLU is `--blu`, WIN is `--positive`, LOSS is `--negative`, a stalemate is `--neutral`, and no result is `--tan-muted`.
- Chart bar colors come from `barColor` in `charts/theme.ts`, which cycles the TF2 paint colors by bar index.
- Map names and game modes are imported as JSON. Refreshing the data needs a rebuild or a dev server restart.
- The dashboard is a separate chunk, so the main bundle is only the menu, React and the app shell. Everything under `dashboard/`, `overview/`, `maps/`, `matches/`, the charts and the map data loads with the dashboard, and the dashboard chunk is prefetched once the menu is idle.
- Chart.js only has the types the charts use: controllers `BarController` and `LineController`, elements `BarElement`, `LineElement` and `PointElement`, scales `CategoryScale` and `LinearScale`, and the `Legend` and `Tooltip` plugins. Registration lives in `charts/Chart.tsx`. A new chart type needs its controller, elements, scale or plugin added there, or creating the chart throws "is not a registered" from Chart.js.
- The menu's character art has the same media query as its CSS, so phones never download it. The help dialog's script is a separate chunk that loads when the dialog first opens.
- Fonts are WOFF2 files in `public/ui/fonts`, with every glyph kept (no subsetting). `base.css` declares them and `index.html` preloads them. To replace a font, convert it with fontTools and keep the same family names.

## More

- [Components](components.md): the Tab component API and the shared UI components.
- [Overview tab](overview.md): the Overview charts, their period scope and legends.
- [Match data](data.md): the match data contract the tabs rely on.
- [Map data](map-data.md): refreshing `data/map-index.json` and `data/map-modes.json`.
- [Badges](badges.md): regenerating the README badges.
