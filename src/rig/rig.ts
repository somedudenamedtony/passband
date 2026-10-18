// D18: anything that sets a frequency goes through a Rig. v1's rig is a human reading the screen;
// a HamlibBridgeRig (WebSocket to rigctld) can implement the same interface later.

export interface RigSetting {
  uplinkHz: number | null;
  downlinkHz: number | null;
  ctcssHz: number | null | 'unknown';
}

export interface Rig {
  readonly kind: 'display' | 'hamlib-bridge';
  set(setting: RigSetting): void;
}

/** "Display it for a human": remembers the last setting and tells the UI. */
export class DisplayRig implements Rig {
  readonly kind = 'display' as const;
  private current: RigSetting | null = null;
  private listeners = new Set<() => void>();

  set(setting: RigSetting): void {
    const c = this.current;
    if (c && c.uplinkHz === setting.uplinkHz && c.downlinkHz === setting.downlinkHz && c.ctcssHz === setting.ctcssHz) {
      return;
    }
    this.current = setting;
    this.listeners.forEach((l) => l());
  }

  get(): RigSetting | null {
    return this.current;
  }

  subscribe = (l: () => void): (() => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
}
