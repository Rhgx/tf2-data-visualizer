# Match data

The upload is parsed in `data/csv.ts` and turned into `Match` objects by `toMatches`; the steps are in [development.md](development.md#how-a-file-moves-through-the-app).

## Match data contract

Shared exports the tabs rely on:

- `Outcome` is `"wins" | "losses" | "ties" | "none"`. `none` is no result (`reached_conclusion` is `"false"`, `winning_team` is empty, or the player's team is unknown), which is not a stalemate. `ties` is a stalemate (`winning_team` is `"0"`, `"none"`, or `"null"`). Teams compare after normalizing to red or blu, so the numeric `"2"` (RED) and `"3"` (BLU) match the team names.
- `Match.mode` is `null` for unknown modes and for matches with no map. Map index 0 (`Missing` in the map list) counts as no map: its `mapId` is empty and its `mapName` is `-`, so it stays out of the Maps tab and the header Maps filter but still counts everywhere else.
- `Match.classes` lists the class names decoded from `classes_played`, in `TF_CLASSES` order. `TF_CLASSES` is indexed by class number minus 1.
- `winRate(matches)` is wins over wins, losses, and ties, as a fraction, or `null` when no match has a result. `formatWinRate` shows it as `"47.3%"` or `"-"`.
- `formatNumber(value, maxFractionDigits)` formats numbers with en-US regardless of the browser locale. `formatShortDuration(seconds)` gives `"1h 4m"`, `"4m 31s"`, or `"31s"` for table cells.
- `datacenterOf(code)` gives a match's datacenter full name, short `City, CC` name and country code from `data/datacenters.json`, with the short name shown on the Matches tab next to its flag. A code missing from the file is shown uppercased with no flag (see [Updating datacenter names](development.md#updating-datacenter-names)).
- `monthKey(ms)` gives a local `"2026-03"` key, and `monthLabel(key)` gives its short month and year. Dates are formatted with en-US regardless of the browser locale.
