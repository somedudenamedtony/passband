// Shared building blocks for the radio front panel: rubber keys, bezel panels, an LCD, sheets.
// Plain elements and CSS (theme.css); no UI library.

import { useEffect, useId, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './icons';

export function Button({
  children,
  onClick,
  kind = 'secondary',
  type = 'button',
  disabled,
  expand = 'block',
  className,
  'aria-label': ariaLabel,
  'aria-pressed': ariaPressed,
  size,
}: {
  children: ReactNode;
  onClick?: () => void;
  /** primary: the amber key. danger: red. ghost: a flat text key. */
  kind?: 'primary' | 'secondary' | 'ghost' | 'danger';
  type?: 'button' | 'submit';
  disabled?: boolean;
  /** block fills the row; inline sizes to the label. */
  expand?: 'block' | 'inline';
  className?: string;
  'aria-label'?: string;
  'aria-pressed'?: boolean;
  size?: 'small' | 'default' | 'large';
}) {
  const cls = ['key', `key-${kind}`, expand === 'block' && 'key-block', size === 'large' && 'key-lg', size === 'small' && 'key-sm', className]
    .filter(Boolean)
    .join(' ');
  return (
    <button type={type} className={cls} onClick={onClick} disabled={disabled} aria-label={ariaLabel} aria-pressed={ariaPressed}>
      {children}
    </button>
  );
}

const BANNER_ICON = { warn: 'warning', danger: 'alert', info: 'info' } as const;

export function Banner({ tone, children }: { tone: 'warn' | 'danger' | 'info'; children: ReactNode }) {
  return (
    <div role="status" className={`banner banner-${tone}`}>
      <Icon name={BANNER_ICON[tone]} />
      <div>{children}</div>
    </div>
  );
}

/** Close on Escape, the way a native sheet does. */
function useEscape(onClose: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
}

/**
 * Overlays render at the top of the document, never inside the scrolling page that opened them:
 * iOS Safari mis-stacks and mis-scrolls fixed layers nested in an overflow container.
 */
function Overlay({ children }: { children: ReactNode }) {
  return createPortal(children, document.body);
}

/** A sheet over the panel, with a title strip and Close. */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEscape(onClose);
  const id = useId();
  return (
    <Overlay>
    <div className="sheet-scrim">
      <div role="dialog" aria-modal="true" aria-labelledby={id} className="sheet">
        <header className="sheet-head">
          <h2 id={id} className="sheet-title">
            {title}
          </h2>
          <Button expand="inline" size="small" onClick={onClose} aria-label="Close">
            Close
          </Button>
        </header>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
    </Overlay>
  );
}

export interface ConfirmSpec {
  title: string;
  message?: string;
  confirmLabel?: string;
  onConfirm: () => void;
}

/** A yes/no question. Returns the asker and the element to render while one is open. */
export function useConfirm(): [(c: ConfirmSpec) => void, ReactNode] {
  const [spec, setSpec] = useState<ConfirmSpec | null>(null);
  const id = useId();
  const node = spec && (
    <Overlay>
    <div className="sheet-scrim sheet-scrim-center">
      <div role="alertdialog" aria-modal="true" aria-labelledby={id} className="confirm">
        <h2 id={id} className="sheet-title">
          {spec.title}
        </h2>
        {spec.message && <p className="muted">{spec.message}</p>}
        <div className="key-row">
          <Button onClick={() => setSpec(null)}>Cancel</Button>
          <Button
            kind="danger"
            onClick={() => {
              spec.onConfirm();
              setSpec(null);
            }}
          >
            {spec.confirmLabel ?? 'Delete'}
          </Button>
        </div>
      </div>
    </div>
    </Overlay>
  );
  return [setSpec, node];
}

/** A row of keys where one is down, like a band or mode selector. */
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
    <div role="tablist" aria-label={label} className="segmented">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="tab"
          aria-selected={o.value === value}
          className="segment"
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** A silk-screened label over a group of controls. */
export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="section-title">{children}</h2>;
}

/** A recessed well in the chassis. */
export function Panel({ children, label, className }: { children: ReactNode; label?: string; className?: string }) {
  return (
    <section aria-label={label} className={['panel', className].filter(Boolean).join(' ')}>
      {children}
    </section>
  );
}

export function Toggle({
  checked,
  onChange,
  disabled,
  children,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  children: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <label className={`toggle${disabled ? ' is-disabled' : ''}`}>
      <span className="toggle-text">
        {children}
        {hint && <small className="hint">{hint}</small>}
      </span>
      <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-led" aria-hidden />
    </label>
  );
}

export function Field({
  label,
  hint,
  invalid,
  className,
  ...input
}: {
  label: string;
  hint?: string;
  invalid?: boolean;
  className?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'className'>) {
  const id = useId();
  return (
    <div className={['field', className].filter(Boolean).join(' ')}>
      <label htmlFor={id}>{label}</label>
      <input id={id} aria-invalid={invalid || undefined} {...input} />
      {hint && <small className="hint">{hint}</small>}
    </div>
  );
}

export function Select<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
}) {
  const id = useId();
  return (
    <div className="field field-inline">
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        value={String(value)}
        onChange={(e) => {
          const o = options.find((x) => String(x.value) === e.target.value);
          if (o) onChange(o.value);
        }}
      >
        {options.map((o) => (
          <option key={String(o.value)} value={String(o.value)}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/** A small lamp-style tag: Easy, Inactive, FM. */
export function Tag({ tone = 'plain', children }: { tone?: 'plain' | 'ok' | 'warn' | 'danger'; children: ReactNode }) {
  return <span className={`tag tag-${tone}`}>{children}</span>;
}

/** A folding section. Starts open or closed; after that the user decides. */
export function Fold({ title, open, children, className }: { title: ReactNode; open?: boolean; children: ReactNode; className?: string }) {
  return (
    <details className={['fold', className].filter(Boolean).join(' ')} open={open}>
      <summary>
        <span>{title}</span>
        <Icon name="chevronDown" />
      </summary>
      <div className="fold-body">{children}</div>
    </details>
  );
}
