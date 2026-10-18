declare module 'magvar' {
  /** Declination in degrees, east positive (WMM2025). Always pass `when`: D16, no hidden clock reads. */
  export function magvar(latitude: number, longitude: number, altitudeKm: number, when: Date | number): number;
}
