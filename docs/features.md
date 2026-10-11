# Features

Every tab reads the same list of matches, after the header filters are applied, so a filter changes all of them at once. Hover a number or header to see how it is computed.

## Overview

The HUD strip across the top shows the match count, win rate, K/D, time played, and average queue time. Results follows, with an outcome bar for the wins, losses, stalemates, and matches with no result. When the file records teams, a RED and a BLU half sit below it, each leading with that team's win rate. Win rates leave out matches with no result, but the match counts do not. The team halves are hidden when no match has a recorded team.

Below them is a two-row grid: Game modes beside Classes, then Records beside Per match. Under 900px the grid becomes one column in that order.

Game modes lists the top 9 by matches, and its Show all button in the title row expands the list. Mode, matches, and win rate sit in aligned columns. Bar colors and the bar scale come from the full ranking, so a mode keeps its color when the list grows.

Classes lists every class with its matches, win rate, and K/D, ranked by matches. A match counts toward every class it was played as. The panel is left out when the file has no class column.

Records shows six single-match records: most kills, deaths, damage, healing, and support, and the longest time played. Each has a View link that opens its match on the Matches tab.

Per match shows six averages in a 3 by 2 grid. Kills, deaths, damage, healing, and support are averaged over matches with a result, and time played over matches with a played time.

## Activity

Activity shows one heatmap at a time. The View control switches it between Calendar and Weekday × hour. Calendar offers Matches, Hours, and Win rate, and Weekday × hour offers Matches and Win rate, so switching to it changes Hours to Matches. Both views share one footprint, so switching does not move the panel.

Calendar shows one year at a time. The arrows page to an older or newer year, and only years with timed matches are reached. The newest year is selected by default, and any change to the filters selects the newest year again. Days with matches are buttons that open the Matches tab searched for that day. Days after today, and days before the first match in the upload, are empty outlines with no tooltip, and today has a tan outline. With Updates on, the days TF2 updates released get a frame, gold for major updates and tan for seasonal ones, and the day's tooltip names the update. A line under the calendar summarizes the selected year: its matches, the days played, the busiest day, and the longest run of days with matches.

Each cell is shaded by its level. Matches and Hours show five swatches with a tick between each pair, labeled with the first match count (or duration, such as `23m` or `1.6h`) of the next level. Win rate shows a RED to BLU ramp, plus a faded swatch labeled `<3` for cells with fewer than 3 results. Matches and Hours cut their levels at the 25th, 50th, 75th, and 90th percentiles of their non-zero values, so the brightest level holds only the busiest tenth. The calendar's cut points come from every year, so the years compare on one scale. In Win rate mode each cell is tinted by its rate, and cells with fewer than 3 results are drawn faint. The edge bars always set their length by match count.

Weekday × hour is one grid, with weekdays down the side and hours across. Hour totals sit under it and weekday totals to its right, as edge bars. Hours mode does not apply here. The grid shades by match count, so its cut points come from the counts of its cells. Beside it, a stat list gives the busiest day and hour, the peak slot, and the best win rate day and hour. A win rate needs at least 3 matches with a result to count.

The Period buttons set the scope to All time, Year, or Month. Year uses the calendar's selected year. Month adds a select listing that year's months with timed matches, newest first, and it defaults to the newest. Changing the calendar's year while Year or Month is active moves the scope to that year, and Month resets to its newest month. The cut points come from the scoped matches, and a scope with no matches shows "No matches in this period".

Matches without a timestamp are left out of the heatmap and Trends. A footnote under the Activity panel gives their count.

Queue times sits below the heatmap. Its histogram sits beside the stats, stacked under 900px: the average and total queue time, the longest and shortest queue (each with a View link), and the number of matches joined in progress. With no queue times, the panel shows a note and the joined count. The View control switches the chart between Spread, the histogram; Over time, each month's median queue time with a shaded band for the 25th to 75th percentile; and Time of day, the same by local hour. Months and hours with fewer than 5 queued matches are drawn as hollow points. With Updates on, Over time draws the same update lines as Trends. Spread and Time of day never show them.

## Trends

Trends is one monthly chart that fills the window, with a 320px minimum height, so a shorter window scrolls the tab. The Metric dropdown picks Win rate, K/D, Matches, Kills, Deaths, Damage, or Healing. Matches is drawn as bars and the rest as lines.

A stat strip above the chart follows the metric, with All time, Best month, Worst month, and Last 12 months. Best and worst only use months with at least 5 matches behind them (matches with a result, for rates and averages), and a tie keeps the earlier month. The strip is hidden when no match has a recorded time.

The chart has one point per calendar month, from the first to the last timed match. A month with no value leaves a dashed, dimmer gap. On the line metrics, a month with fewer than 5 matches that have a result is a hollow point, and its tooltip gives the sample size. With Updates on, a thin vertical line is drawn in each month at the day an update was released: solid gold for major updates, dashed tan for seasonal ones. Hovering a month lists its updates in gold under the value, such as Scream Fortress XVIII (Oct 1, Halloween update).

## Maps

The top of the Maps tab shows four figures: the matches with a known map, the unique maps, the most played map, and the time played.

The chart ranks the top maps by matches, or by hours when the matches have played time. Top N shows 10, 20, 30, 50, or all of them. Clicking a bar selects that map. The Table view lists the same maps with their matches, share, time played, win rate, K/D, and average damage. Chart and Table share the Sort, Search, and Reset controls. Sorting the table never changes which maps the chart shows, because Top N comes from the chart's own ranking. The Download PNG button saves the chart.

The map card beside them shows the selected map, or the top map when the selected one is filtered out. It has the matches, share, time played, win rate, K/D, average damage, first and last played dates, the most played class, the last 10 results, and a matches-per-month chart. Its View matches link opens the Matches tab searched for the map's name.

## Matches

Matches is a scoreboard of every match in the filtered list. Rank by date, kills, deaths, damage, healing, support, time played, or queue time, in descending or ascending order. Search matches the title, match ID, map, mode, type, datacenter, and local day, so `2026-10` finds October. The default columns cover the result, classes, and the main stats. All columns adds every column in your CSV, with numbers and times formatted.

A click on a row, or Enter or Space on it, opens its details below the row. These show the team and score, mode and type, the stats, medals, queue time, time played, match duration, whether you joined in progress, and the datacenter with its flag. Fields the file does not have are left out.

## Filters

The Maps, Modes, and Type dropdowns in the header apply to every tab. Type is the match type column of the CSV, and a blank value counts as Unknown. Each item cycles through three states: off, included, and excluded. An included item keeps only the matches with that value, and an excluded item drops them. The Clear filters button in the header resets them all.

The TF2 Updates checkbox beside the dropdowns is one setting for the whole dashboard, checked when it is on. It is off by default and remembered in this browser. When it is on, the Trends chart, the queue times Over time chart, and the Activity calendar mark the TF2 update releases, and the sections above say how. A tooltip on a marked day or month names each update in gold with its date and kind.

Each dropdown shows its active count, such as Maps (2), and has a Clear link. Its item counts are the matches each item would give with the other two filters applied. Items that would give none are dimmed and listed last. Included and excluded items are pinned to the top when the dropdown opens. The search box finds items by name, and the arrow keys move through the list.

## Tooltips

Numbers, headers, and controls with a short explanation show it in a tooltip after a hover or keyboard focus. Chart tooltips follow the pointer rather than sitting on the data point. Tooltips close when you scroll or click elsewhere.
