interface HudStatProps {
  value: string;
  label: string;
  // Hover text on the whole stat, shown by tooltip.ts
  tip?: string;
}

export function HudStat({ value, label, tip }: HudStatProps) {
  return (
    <div className="hud-stat" data-tip={tip}>
      <span className="hud-value">{value}</span>
      <span className="hud-label">{label}</span>
    </div>
  );
}
