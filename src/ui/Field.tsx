interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectFieldProps {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  // Hover text on the label, shown by tooltip.ts
  tip?: string;
}

export function SelectField({ label, value, options, onChange, tip }: SelectFieldProps) {
  return (
    <label className="field">
      {/* The tip is on the text, not the label, so hovering the select itself never shows it */}
      <span data-tip={tip}>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

interface SearchFieldProps {
  // Without a label, the placeholder names the input for screen readers
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  tip?: string;
}

export function SearchField({ label, value, onChange, placeholder, tip }: SearchFieldProps) {
  return (
    <label className="field search" data-tip={tip}>
      {label && <span>{label}</span>}
      <input
        type="search"
        value={value}
        placeholder={placeholder}
        aria-label={label ? undefined : placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

interface CheckFieldProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  tip?: string;
}

export function CheckField({ label, checked, onChange, tip }: CheckFieldProps) {
  return (
    <label className="field check" data-tip={tip}>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}
