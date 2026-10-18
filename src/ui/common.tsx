// Shared building blocks, on Ionic components so the app looks and behaves like a native one.

import type { ReactNode } from 'react';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonModal,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { alertCircleOutline, informationCircleOutline, warningOutline } from 'ionicons/icons';

export function Button({
  children,
  onClick,
  kind = 'secondary',
  type = 'button',
  disabled,
  expand = 'block',
  className,
  'aria-label': ariaLabel,
  color,
  size,
}: {
  children: ReactNode;
  onClick?: () => void;
  kind?: 'primary' | 'secondary' | 'ghost';
  type?: 'button' | 'submit';
  disabled?: boolean;
  expand?: 'block' | 'full' | undefined;
  className?: string;
  'aria-label'?: string;
  color?: string;
  size?: 'small' | 'default' | 'large';
}) {
  const fill = { primary: 'solid', secondary: 'outline', ghost: 'clear' } as const;
  return (
    <IonButton
      type={type}
      onClick={onClick}
      disabled={disabled}
      expand={expand}
      fill={fill[kind]}
      color={color}
      size={size}
      className={className}
      aria-label={ariaLabel}
    >
      {children}
    </IonButton>
  );
}

const BANNER_ICON = { warn: warningOutline, danger: alertCircleOutline, info: informationCircleOutline };

export function Banner({ tone, children }: { tone: 'warn' | 'danger' | 'info'; children: ReactNode }) {
  return (
    <div role="status" className={`banner banner-${tone}`}>
      <IonIcon icon={BANNER_ICON[tone]} aria-hidden />
      <div>{children}</div>
    </div>
  );
}

/** A sheet: card modal on iOS, full-height on Android, with a title bar and Close. */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <IonModal isOpen onDidDismiss={onClose} aria-label={title}>
      <IonHeader>
        <IonToolbar>
          <IonTitle>{title}</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={onClose} aria-label="Close">
              Close
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">{children}</IonContent>
    </IonModal>
  );
}

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
    <IonSegment
      value={String(value)}
      aria-label={label}
      onIonChange={(e) => {
        const v = options.find((o) => String(o.value) === String(e.detail.value));
        if (v) onChange(v.value);
      }}
    >
      {options.map((o) => (
        <IonSegmentButton key={String(o.value)} value={String(o.value)}>
          <IonLabel>{o.label}</IonLabel>
        </IonSegmentButton>
      ))}
    </IonSegment>
  );
}

/** Section heading inside a page, in the platform's list-header style. */
export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '20px 0 8px' }}>{children}</h2>;
}
