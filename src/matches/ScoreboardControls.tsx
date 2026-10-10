import type { JSX } from "react";
import { TextButton } from "../ui/Button";
import { CheckField, SearchField, SelectField } from "../ui/Field";
import { RANKS, rankByKey, type RankOption } from "./sort";

interface ScoreboardControlsProps {
  rank: RankOption;
  descending: boolean;
  search: string;
  allColumns: boolean;
  onRank: (rank: RankOption) => void;
  onDescending: (descending: boolean) => void;
  onSearch: (search: string) => void;
  onAllColumns: (allColumns: boolean) => void;
  onReset: () => void;
}

const RANK_OPTIONS = RANKS.map((rank) => ({ value: rank.key, label: rank.label }));
const ORDER_OPTIONS = [
  { value: "desc", label: "Descending" },
  { value: "asc", label: "Ascending" },
];

// The panel header controls. The state lives in MatchesTab, so these survive filter changes.
export function ScoreboardControls({
  rank,
  descending,
  search,
  allColumns,
  onRank,
  onDescending,
  onSearch,
  onAllColumns,
  onReset,
}: ScoreboardControlsProps): JSX.Element {
  return (
    <div className="matches-controls">
      <SelectField
        label="Rank by"
        value={rank.key}
        options={RANK_OPTIONS}
        onChange={(value) => onRank(rankByKey(value))}
      />
      <SelectField
        label="Order"
        value={descending ? "desc" : "asc"}
        options={ORDER_OPTIONS}
        onChange={(value) => onDescending(value === "desc")}
      />
      <SearchField
        label="Search"
        tip="Matches title, ID, map, mode, type or datacenter"
        placeholder="Search matches"
        value={search}
        onChange={onSearch}
      />
      <CheckField
        label="All columns"
        tip="Every CSV column, formatted"
        checked={allColumns}
        onChange={onAllColumns}
      />
      <TextButton tip="Back to newest first, all columns off" onClick={onReset}>
        Reset
      </TextButton>
    </div>
  );
}
