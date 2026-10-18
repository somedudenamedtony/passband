import type { ReactNode } from 'react';

export function Button({
  children,
  onClick,
  kind = 'secondary',
  type = 'button',
  disabled,
  className = '',
  'aria-label': ariaLabel,
}: {
  children: ReactNode;
  onClick?: () => void;
  kind?: 'primary' | 'secondary' | 'ghost';
  type?: 'button' | 'submit';
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
}) {
  const styles = {
    primary: 'bg-accent text-accent-fg',
    secondary: 'bg-surface text-fg border border-line',
    ghost: 'text-accent',
  }[kind];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={`min-h-12 rounded-xl px-4 text-base font-semibold disabled:opacity-50 ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function Banner({ tone, children }: { tone: 'warn' | 'danger' | 'info'; children: ReactNode }) {
  const styles = {
    warn: 'bg-warn-bg text-warn-fg',
    danger: 'bg-danger-bg text-danger-fg',
    info: 'bg-surface text-fg border border-line',
  }[tone];
  return (
    <div role="status" className={`rounded-xl px-4 py-3 text-sm font-medium ${styles}`}>
      {children}
    </div>
  );
}

/** A bottom sheet / dialog. Full width on phones, centred column on wider screens. */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-bg p-4 pb-8 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">{title}</h2>
          <button type="button" onClick={onClose} className="min-h-12 min-w-12 text-2xl" aria-label="Close">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-sm text-muted">{hint}</span>}
    </label>
  );
}

export const inputClass =
  'min-h-12 w-full rounded-xl border border-line bg-surface px-3 text-lg text-fg placeholder:text-muted';

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-xl border border-line bg-surface p-1">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={`min-h-11 flex-1 rounded-lg px-2 text-sm font-semibold ${
            o.value === value ? 'bg-accent text-accent-fg' : 'text-fg'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
