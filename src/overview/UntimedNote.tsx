import { PanelNote } from "../ui/Panel";
import { formatNumber } from "../lib/format";

interface UntimedNoteProps {
  count: number;
}

// Matches without a timestamp are left out of the timed panels. This note is shown once, in Activity, and names them all.
export function UntimedNote({ count }: UntimedNoteProps) {
  if (count === 0) return null;
  const noun = count === 1 ? "match" : "matches";
  const verb = count === 1 ? "is" : "are";
  return <PanelNote>{`${formatNumber(count)} ${noun} without a time ${verb} left out of Activity, Form and Per match.`}</PanelNote>;
}
