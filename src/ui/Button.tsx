import type { ButtonHTMLAttributes } from "react";

interface TfButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  // Path relative to public, e.g. "ui/glyphs/camera.png"
  icon?: string;
  size?: "small" | "menu";
  // Icon-only buttons have no text, so label becomes their accessible name
  iconOnly?: boolean;
  label?: string;
}

export function TfButton({ icon, size, iconOnly = false, label, className, children, ...rest }: TfButtonProps) {
  const classes = ["tf-button", size && `${size}-button`, iconOnly && "icon-button", className].filter(Boolean).join(" ");
  return (
    <button type="button" className={classes} aria-label={iconOnly ? label : undefined} {...rest}>
      {icon && <img src={import.meta.env.BASE_URL + icon} alt="" />}
      {children}
    </button>
  );
}

interface TextButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tip?: string;
}

export function TextButton({ tip, className, children, ...rest }: TextButtonProps) {
  const classes = className ? `text-button ${className}` : "text-button";
  return (
    <button type="button" className={classes} data-tip={tip} {...rest}>
      {children}
    </button>
  );
}
