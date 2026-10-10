import type { CSSProperties, ReactNode } from "react";

// CSSProperties has no custom properties, so they are added to the type instead of casting the style object.
type BarStyle = CSSProperties & Record<`--${string}`, string | number>;

interface BarListProps {
  children?: ReactNode;
}

export function BarList({ children }: BarListProps) {
  return <ol className="bar-list">{children}</ol>;
}

interface BarRowProps {
  // ReactNode, so a caller can put an icon before the text
  label: ReactNode;
  value: number;
  max: number;
  // Fill color of the bar, e.g. a palette color
  color: string;
  // The value as shown, already formatted
  valueText: string;
  extra?: string;
  // Hover text on the row, shown by tooltip.ts
  tip?: string;
}

export function BarRow({ label, value, max, color, valueText, extra, tip }: BarRowProps) {
  const style: BarStyle = { "--value": max > 0 ? value / max : 0, "--bar-color": color };
  return (
    <li className="bar-row" style={style} data-tip={tip}>
      <span className="bar-label">{label}</span>
      <span className="bar-track">
        <span className="bar-fill" />
      </span>
      <span className="bar-value">{valueText}</span>
      <span className="bar-extra">{extra}</span>
    </li>
  );
}
