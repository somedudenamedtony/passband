# Passband

A PWA for working amateur radio satellites: pass prediction, pointing, Doppler, logging. For
beginners first, useful to everyone. Write it **`Passband`** in prose and UI, **`passband`** for the
repo and package name.

## Read first

- **`SPEC-v2.md`** — the source of truth: screens, navigation, data model, decisions D22 onwards.
- **`SPEC.md`** — decisions D1–D21, which SPEC-v2 keeps (it lists the ones it changed or retired);
  its screens and milestones describe the v1 app, now replaced. If this file conflicts with either,
  the specs win.

## Environment

- The owner works on Windows 11 in PowerShell. **No Python installed** — don't reach for it. Node.js
  and Git are available; scripts are TypeScript or JavaScript run by Node.

## Stack

Vite · React · TypeScript · custom radio-panel UI (no UI library; `src/ui/common.tsx` + `src/theme.css`) · `vite-plugin-pwa` · `satellite.js` in a Web Worker ·
IndexedDB via `idb`. Static hosting; **no backend** (D1). Screens are routes (`src/router.ts`, `src/routes/`)
over one store (`src/store/`); they never call `idb` or the worker directly (D27).

## The things most likely to be got wrong

1. **Frequencies are integer Hz.** Never a float, never a `"436.795"` string in the model. Format at
   the edge (D7).
2. **Never hardcode a frequency, tone or status** in `src/`. They come from the catalog (D4, D6).
   Unknown is a real value and renders as *Unknown*, never blank or a guess.
3. **Doppler sign.** Approaching satellite: you *hear* the downlink high and must *transmit* the
   uplink low. Flipping one of the two is the classic bug; a test pins it (§10).
4. **All stored times are UTC epoch ms.** Local time is display-only.
5. **Never call `Date.now()` or `new Date()` directly** outside `clock.ts`. Practice mode runs the
   real live screen on a simulated clock (D16).
6. **Feature-detect, never sniff the user agent.** iOS lacks vibration, Web Serial, WebUSB and Web
   Bluetooth; work around it through the `Cue` and `Rig` interfaces (D14, D18).
7. **Show element age.** A pass predicted from stale elements is wrong without looking wrong (D5).
8. **Nothing user-owned leaves the device** — location, callsign, logs, recordings (D1, D8, §7).
9. **`SAT_NAME` in ADIF is LoTW's name**, from the overlay, not the catalog display name (D12).
10. **Store SI, show miles.** Metres and m/s everywhere in the model; miles/feet (default) or
    km/m only in display formatters (D20).
11. **Paths go through Vite's `base`.** The app lives at `/passband/` on GitHub Pages; a hardcoded
    `/` breaks assets and the service worker scope (D2).

The example and test callsign is **W7LIT**.
