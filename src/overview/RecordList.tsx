import { TextButton } from "../ui/Button";
import type { RecordRow } from "./stats";

interface RecordListProps {
  rows: RecordRow[];
  // Rows with a matchKey get a View link only when this is given
  onFocusMatch?: (key: string) => void;
}

// Label and detail on the left, value and View on the right. Rows stay readable at half-panel width.
export function RecordList({ rows, onFocusMatch }: RecordListProps) {
  return (
    <div className="well">
      <ul className="record-list">
        {rows.map((row) => (
          <RecordItem key={row.label} row={row} onFocusMatch={onFocusMatch} />
        ))}
      </ul>
    </div>
  );
}

interface RecordItemProps {
  row: RecordRow;
  onFocusMatch?: (key: string) => void;
}

function RecordItem({ row, onFocusMatch }: RecordItemProps) {
  const matchKey = row.matchKey;
  return (
    <li className="record-row">
      <span className="record-name">
        <span className="record-label">{row.label}</span>
        {row.detail && <span className="record-detail">{row.detail}</span>}
      </span>
      <span className="record-end">
        <span className="record-value">{row.value}</span>
        {matchKey !== undefined && onFocusMatch && (
          <TextButton onClick={() => onFocusMatch(matchKey)}>
            View
          </TextButton>
        )}
      </span>
    </li>
  );
}
