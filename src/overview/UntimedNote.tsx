import { PanelNote } from "../ui/Panel";
import { formatNumber } from "../lib/format";

interface UntimedNoteProps {
  count: number;
}

// Matches without a timestamp cannot be placed on the timeline, so the timed panels leave them out. Shown as a footnote in Activity.
export function UntimedNote({ count }: UntimedNoteProps) {
  if (count === 0) return null;
  const noun = count === 1 ? "match has" : "matches have";
  const verb = count === 1 ? "is" : "are";
  return <PanelNote className="untimed-note">{`${formatNumber(count)} ${noun} no recorded time and ${verb} not shown.`}</PanelNote>;
}
