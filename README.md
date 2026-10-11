# TF2 Match Data Visualizer

<a href="https://www.typescriptlang.org"><img src="docs/badges/typescript.svg" alt="Built with TypeScript" /></a>
<a href="https://react.dev"><img src="docs/badges/react.svg" alt="Built with React" /></a>
<a href="https://vite.dev"><img src="docs/badges/vite.svg" alt="Built with Vite" /></a>
<a href="https://pnpm.io"><img src="docs/badges/pnpm.svg" alt="Managed with pnpm" /></a>

Load your Team Fortress 2 match history CSV and explore it as stats, charts, and tables.

<img src="docs/screenshot.webp" alt="TF2 Match Data Visualizer Overview tab with HUD numbers, results with team win rates, game modes, classes, records, and per-match averages" width="600" />

## What it does

- Loads your match history CSV from the file picker, a drop anywhere on the page, or pasted text.
- Summarizes your matches on the Overview tab, with HUD numbers, results, game modes, classes, records, and averages.
- Shows when you play on the Activity tab, with a calendar, a weekday by hour grid, and queue times.
- Tracks your monthly trends and your most played maps on the Trends and Maps tabs.
- Filters every tab at once by map, game mode, and type, and opens matches on the Matches tab from records, queue times, and calendar days.

## Using it

Open it at https://rhgx.github.io/tf2-data-visualizer/. The **How do I get my data?** button walks you through exporting your match history from Steam.

1. Click **Load Match History** and pick your CSV, drop it anywhere on the page, or paste its text.
2. Pick a tab. **Overview** has the totals, **Activity** shows when you play, **Trends** charts each month, **Maps** ranks your maps, and **Matches** lists every match.
3. Narrow the numbers with the **Maps**, **Modes**, and **Type** filters in the header. Click an item once to include it, again to exclude it, and a third time to clear it.
4. Click **View** on a record or a queue time to open that match, or click a row on the Matches tab to see its details.

## More

- [What each tab, filter, and tooltip shows](docs/features.md)
- [The tab component API and shared UI components](docs/components.md)
- [The match data contract the tabs rely on](docs/data.md)
- [Running it locally, scripts, and refreshing the data files](docs/development.md)
- [Fonts, textures, sounds, map data, flags, and libraries](docs/credits.md)

## License

The code is under the [MIT License](LICENSE), and the Team Fortress 2 assets in it belong to Valve; see [credits](docs/credits.md).
