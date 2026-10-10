import type { ComponentProps, ReactNode } from "react";

interface PanelProps {
  title: string;
  // Hover text on the title, shown by tooltip.ts
  tip?: string;
  // Controls at the right end of the title row
  actions?: ReactNode;
  className?: string;
  children?: ReactNode;
}

export function Panel({ title, tip, actions, className, children }: PanelProps) {
  return (
    <section className={className ? `panel ${className}` : "panel"}>
      <header className="panel-title">
        <h2 data-tip={tip}>{title}</h2>
        {actions}
      </header>
      {children}
    </section>
  );
}

export function PanelNote({ className, children }: ComponentProps<"p">) {
  return <p className={className ? `panel-note ${className}` : "panel-note"}>{children}</p>;
}
