# Components

The tab components and the shared pieces they are built from.

## Tab component API

Each tab is a React component, wrapped in `memo` (their props only change when the matches or a request changes). `Dashboard` renders all five. The active tab gets the latest filtered matches. A hidden tab keeps the matches it last had, and a tab never opened starts empty until it is opened or warmed while idle:

```ts
function OverviewTab(props: { matches: Match[]; onFocusMatch: (key: string) => void }): JSX.Element;
function ActivityTab(props: {
  matches: Match[];
  firstTime: number | null;
  onFocusMatch: (key: string) => void;
  onShowDay: (dateKey: string) => void;
}): JSX.Element;
function TrendsTab(props: { matches: Match[] }): JSX.Element;
function MapsTab(props: { matches: Match[]; onShowMap: (name: string) => void }): JSX.Element;
function MatchesTab(props: { matches: Match[]; allMatches: Match[]; focus: MatchFocus | null; query: MatchQuery | null }): JSX.Element;

interface MatchFocus { key: string; id: number }
interface MatchQuery { text: string; id: number }
```

- `Dashboard` owns the filter states, the search text inside each filter dropdown, the open dropdown, the active tab, and the match focus. Tabs own their own controls (top N, metric, sort, search, rank, order) and their charts. Charts are created through `ChartCanvas`, which destroys its chart on unmount.
- `matches` is already filtered. An empty array must render an empty note, not throw.
- All five tabs stay mounted. Inactive tabs are hidden with the `hidden` attribute, so their control state survives a tab switch.
- `OverviewTab` and `ActivityTab` call `onFocusMatch(key)` when a "View" link is clicked. `Dashboard` switches to the Matches tab and sets `focus` to `{ key, id }`, with `id` one higher than before, so the same match can be focused again. `MatchesTab` resets its search and rank, scrolls to that row, highlights it and opens its detail strip.
- `ActivityTab` calls `onShowDay("YYYY-MM-DD")` when a calendar day with matches is clicked. `Dashboard` switches to the Matches tab and sets `query` to `{ text, id }`. `MatchesTab` replaces its search with the text and keeps its rank and order. The search also matches the local day of each match, so `2026-10` finds the month.
- `MapsTab` calls `onShowMap(name)` from a map card's "View matches" link. `Dashboard` passes its `onShowDay` handler, so the Matches tab opens with the map's name in its search and the search box takes focus.
- `firstTime` is the first timed match across all data, so the calendar's blank days before it do not change when a filter is set.

## Shared UI components

Components in `src/ui/` take plain props, and a `tip` prop sets the `data-tip` hover text.

- `TfButton`: `icon` (a path under `public`), `size` (`"small"` or `"menu"`), `iconOnly` with `label` for its accessible name.
- `TextButton`: `tip`. The underlined link style used for "View" and "Reset".
- `Panel`: `title`, `tip` for the title, `actions` for the controls at the right of the title row. `PanelNote` is the small text line under a title.
- `SelectField`, `SearchField`, `CheckField`: `label`, `value` or `checked`, `onChange`, `tip`. Their options are `{ value, label }`.
- `HudStat`: `value` and `label`, both strings, shown as the large numbers in the HUD rows. `tip` is optional.
- `BarList` and `BarRow`: `label`, `value`, `max`, `color`, `valueText`, `extra`, `tip`. A row sizes its bar from `value / max`.
- `VirtualTable<T>`: `rows`, `columns` (`Column<T>`: `key`, `label`, `text`, optional `render`, `width`, `pad`, `tip`), `rowKey`, `rowClassName`, `className`, and a `ref` exposing `scrollToRow(index)`. Keep `rows` and `columns` memoized: a new array resets the scroll or re-measures the columns. Optional `sizingRows` is the array the widths are measured from (default `rows`); the Matches table passes every match, so filters never re-measure. Optional `expandedKey`, `onToggle` and `renderDetail` add a detail strip: a click, Enter or Space on a row calls `onToggle(row)`, and the row whose key is `expandedKey` shows `renderDetail(row)` under it. For rows that select rather than expand (the Maps table), `onToggle` picks the row and `selectedKey` marks it with `aria-selected`. The table is one tab stop: Up and Down, PageUp and PageDown, and Home and End move focus between rows.
- `ChartCanvas<T>` in `charts/Chart.tsx`: `config`, `height` in px, `className`, `onChart` called once with the chart instance. The first config creates the chart. Later configs update it in place, so a filter change redraws every chart at once. No chart animates (animation is off globally in `charts/Chart.tsx`). Tooltips follow the pointer through the `cursor` positioner set there, rather than sitting on the data point.
