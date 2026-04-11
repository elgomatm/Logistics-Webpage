"use client";

interface ToggleGroupProps {
  value: boolean;
  onChange: (v: boolean) => void;
  trueLabel: string;
  falseLabel: string;
  disabled?: boolean;
}

export default function ToggleGroup({
  value,
  onChange,
  trueLabel,
  falseLabel,
  disabled,
}: ToggleGroupProps) {
  return (
    <div className="inline-flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--border-mid)" }}>
      {[false, true].map((opt) => {
        const active = value === opt;
        const label = opt ? trueLabel : falseLabel;
        return (
          <button
            key={String(opt)}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt)}
            className="px-4 py-2 text-[11px] tracking-[0.06em] font-medium transition-colors duration-150"
            style={{
              background: active ? "rgba(var(--champ-rgb), 0.14)" : "transparent",
              color: active ? "var(--champagne)" : "var(--text-3)",
              borderRight: opt === false ? "1px solid var(--border-mid)" : "none",
              cursor: disabled ? "not-allowed" : "pointer",
              opacity: disabled ? 0.5 : 1,
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
