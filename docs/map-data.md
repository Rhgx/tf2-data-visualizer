# Map data

## Refreshing map data

`pnpm maps` rebuilds both `data/map-index.json` and `data/map-modes.json`. It
needs a local Team Fortress 2 installation for the map list and internet access
to the TF2 Wiki for the map modes. From the repository root, run:

```sh
pnpm --ignore-workspace maps
```

The map-list step reads TF2's local `items_game.txt`; the mode step fetches the
TF2 Wiki's List of maps. The script searches the usual Steam installation and
library locations on Windows, Linux, and macOS. If TF2 cannot be found
automatically, pass the file path explicitly:

```sh
pnpm --ignore-workspace maps --input "/path/to/Team Fortress 2/tf/scripts/items/items_game.txt"
```

Alternatively, set `TF2_ITEMS_GAME_PATH` to either `items_game.txt` or its
containing directory before running the script. Custom output paths can be set
independently, and one dataset can be refreshed on its own:

```sh
pnpm --ignore-workspace maps --maps-output /path/to/map-index.json --modes-output /path/to/map-modes.json
pnpm --ignore-workspace maps --maps-only
pnpm --ignore-workspace maps --modes-only
```

If either step fails, the script prints one error line, exits with a non-zero
code, and leaves both files as they were.

The map data is imported when the app is built, so run `pnpm build` or restart `pnpm dev` after refreshing it.
