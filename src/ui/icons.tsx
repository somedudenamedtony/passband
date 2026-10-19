// Line icons drawn for the panel: 20×20, 1.6 stroke, currentColor. Decorative; labels carry meaning.

const PATHS = {
  pass: 'M3 16l5-5M8 11l7-7M12 4l4 4M6 17h8',
  map: 'M2 5l5-2 6 2 5-2v12l-5 2-6-2-5 2zM7 3v12M13 5v12',
  log: 'M7 5h10M7 10h10M7 15h10M3 5h1M3 10h1M3 15h1',
  learn: 'M2 7l8-4 8 4-8 4zM5 8.5V13c0 1.5 2.2 2.5 5 2.5s5-1 5-2.5V8.5',
  location: 'M10 18s6-5.5 6-10.2a6 6 0 0 0-12 0C4 12.5 10 18 10 18zM10 9.8a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  settings: 'M4 3v14M10 3v14M16 3v14M2.5 12h3M8.5 6h3M14.5 10h3',
  calendar: 'M3 5h14v12H3zM3 8.5h14M6.5 2.5v4M13.5 2.5v4',
  play: 'M6 3.5v13l10-6.5z',
  add: 'M10 4v12M4 10h12',
  trash: 'M4 6h12M8 6V4h4v2M5.5 6l.8 11h7.4l.8-11',
  alert: 'M10 2.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15zM10 6v5M10 13.5v.5',
  info: 'M10 2.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15zM10 9v5M10 6v.5',
  warning: 'M10 2.5L18 17H2zM10 8v4M10 14.5v.5',
  share: 'M10 2.5v10M6 6.5l4-4 4 4M4 10v7h12v-7',
  backspace: 'M7 4h10v12H7l-5-6zM10 7.5l5 5M15 7.5l-5 5',
  check: 'M4 10.5l4 4 8-9',
  camera: 'M3 6h3l1.5-2h5L14 6h3v10H3zM10 13.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  mic: 'M10 2.5a2.5 2.5 0 0 0-2.5 2.5v5a2.5 2.5 0 0 0 5 0V5A2.5 2.5 0 0 0 10 2.5zM5 9.5a5 5 0 0 0 10 0M10 14.5v3',
  stop: 'M5 5h10v10H5z',
  volumeOn: 'M3 7.5h3l4-3.5v12l-4-3.5H3zM13 7a4 4 0 0 1 0 6M15.5 4.5a7.5 7.5 0 0 1 0 11',
  volumeOff: 'M3 7.5h3l4-3.5v12l-4-3.5H3zM13 7.5l5 5M18 7.5l-5 5',
  chevronDown: 'M5 7.5l5 5 5-5',
  chevronUp: 'M5 12.5l5-5 5 5',
  chevronLeft: 'M12.5 5l-5 5 5 5',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}
