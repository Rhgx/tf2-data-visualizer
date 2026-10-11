# Credits

Unofficial fan tool, not affiliated with Valve. Team Fortress 2 and everything in it belong to Valve Corporation.

## Fonts

`public/ui/fonts/tf2build.woff2` and `public/ui/fonts/tf2secondary.woff2` are Valve's TF2 fonts, extracted from the game files.

## Textures and icons

The Team Fortress 2 textures, glyphs, class icons, menu backgrounds, and character art in `public/ui/` are Valve's, extracted from the game files in `tf2_textures_dir.vpk`: `materials/vgui/glyph_*.vtf`, `materials/hud/leaderboard_class_*.vtf`, `materials/hud/ico_camera.vtf`, `materials/console/characters/*.vtf`, `materials/console/background_*.vtf`, and the title images.

The CSV icon (`public/ui/glyphs/csv.svg`) is drawn for this site in the style of the game glyphs.

The README badges follow [Devin's Badges](https://github.com/intergrav/devins-badges), with icons from [Simple Icons](https://simpleicons.org) (CC0).

## Sounds

The UI sounds in `public/ui/sfx/` are processed from `sound/ui/` files in `tf2_sound_misc_dir.vpk`: `buttonclick.wav`, `panel_open.wav`, `panel_close.wav`, `mm_join.wav`, `vote_no.wav`, `slide_down.wav`, and `slide_up.wav`.

## Map data

Map names come from TF2's `items_game.txt`, and map modes come from the [TF2 Wiki](https://wiki.teamfortress.com).

## Flags

The country flags in `public/ui/flags/` are [Twemoji](https://github.com/jdecked/twemoji) v17.0.3 graphics by jdecked, licensed under [CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/). The datacenter names beside them come from Valve's public Steam Datagram Relay config for TF2 (appid 440).

## Libraries

The app is built on [React](https://react.dev) for the interface, [Chart.js](https://www.chartjs.org) for the charts, and [Papa Parse](https://www.papaparse.com) for reading the CSV.
