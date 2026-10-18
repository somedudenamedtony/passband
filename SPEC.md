# Passband — Specification

A Progressive Web App for working amateur radio satellites. Built for the operator standing in a
field with a handheld radio in one hand and an antenna in the other, with a ten-minute window
before the satellite sets.

**Audience:** beginners first, without boring anyone who has already worked 100 grids. Every
beginner feature must also be useful to an experienced operator, or it must get out of their way.

This document is the source of truth. If code and spec disagree, fix one of them on purpose;
don't work around it.

---

## 1. Goals and non-goals

### Goals

1. **Answer "should I bother?"** Which passes in the next 24 hours can I actually work, from where
   I'm standing, on a satellite that is alive?
2. **Get me through the pass.** Where do I point, what do I tune to, when do I retune.
3. **Don't lose a contact.** Record the pass, log from the recording afterwards, export ADIF
   that LoTW accepts.
4. **Get a beginner to a first contact** without a mentor standing next to them.
5. **Work offline in the field.** No signal at the hilltop is the normal case, not an edge case.

### Non-goals (v1)

- Native app-store apps. (Capacitor later if needed — see D18.)
- Accounts, sync, or any server holding user data.
- Radio (CAT) or rotator control. Designed for, not built (D18).
- Telemetry decoding. SatNOGS does this well; link to it.
- Non-amateur satellites (weather, Starlink spotting, etc.).

---

## 2. Users

| Who | What they need | What they don't |
|---|---|---|
| **New licensee** with an HT and an Arrow-type antenna | Which FM bird, when, where to point, what to say | Transponder theory, Kepler elements |
| **Listener, no license yet** | ISS SSTV, APRS, beacons — something to hear tonight | Uplink frequencies cluttering the screen |
| **Grid chaser / VUCC hunter** | Rover activations, mutual windows, worked-grid map, fast logging | Tutorials in the way |
| **Rover** | Passes from a *different* location, footprint coverage of rare grids | — |
| **Linear transponder operator** | Passband position, inverting/non-inverting Doppler | (v2 — see §8) |

---

## 3. Decisions

Each decision is numbered so code comments and issues can cite it (`// D7`).

### D1 — A static PWA. No backend in v1.

Everything the user creates (location, logs, recordings, settings) lives on the device. The only
network traffic is fetching public satellite data. This keeps the app free to host, keeps it
working offline, and means there is no user data to leak.

Anything that would need a server (push reminders, shared spots, community status reports) is
v2+ and must arrive as an *optional* layer — the app stays fully usable without it.

A move to **Vercel + Supabase** is on the table for that later layer. Nothing in v1 should make it
harder: keep data access behind small modules (`catalog`, `log`, `locations`) so a synced store can
sit behind the same functions, and keep IDs as client-generated UUIDs so records can be uploaded
without renumbering.

### D2 — Vite + React + TypeScript. Tailwind for styling.

No server rendering is needed (D1), so Next.js would add weight for nothing. Vite's PWA plugin
(`vite-plugin-pwa`, Workbox underneath) generates the service worker and manifest.

Hosting: **GitHub Pages**, because the daily data job (D4) already lives in GitHub Actions and can
deploy in the same run. The app is served from a project path (`/passband/`) until there is a
domain, so every asset and service-worker scope uses Vite's `base`, never a hardcoded `/`.

### D3 — Orbit propagation with `satellite.js` (SGP4), in a Web Worker.

Predicting 24 h of passes for ~40 satellites is a few hundred thousand propagation steps. That
belongs off the main thread. One worker owns propagation; the UI asks it for passes and for
live look angles.

Pass search: coarse step (30 s) to find elevation sign changes, then bisect AOS/LOS to the
second. Max elevation by golden-section search between them.

### D4 — Satellite data is a static snapshot we publish, refreshed daily.

The app does **not** call CelesTrak or SatNOGS from the browser. A scheduled GitHub Action:

1. Fetches orbital elements for the amateur group from CelesTrak (GP data, **OMM JSON**, not
   TLE — TLE catalog numbers run out above 99999).
2. Fetches transmitter data (frequencies, modes, CTCSS, status) from the SatNOGS DB API.
3. Merges them with our curated overlay (`data/overlay/*.json` — beginner notes, difficulty,
   LoTW `SAT_NAME`; see D6).
4. Publishes `catalog.json` with a `generated_at` timestamp alongside the app.

Why: no CORS dependency, no hammering CelesTrak (they rate-limit and ask clients not to poll),
one fetch for the app instead of dozens, and the snapshot is reproducible.

**Scope: every satellite with a 2 m or 70 cm transmitter** — any uplink or downlink in 144–148 MHz
or 420–450 MHz, regardless of mode. The filter runs in the Action on the transmitter frequencies,
not on a hand-kept list, so a newly launched bird appears without a code change. Satellites with
only other bands (10 m, 23 cm, S-band…) are out of scope for v1. The overlay (D6) is curated for
everything inside the filter that has a working uplink; anything not yet curated still appears,
with *Unknown* where the overlay would be.

The app fetches `catalog.json` from its own origin on launch when online and keeps the last good
copy in IndexedDB.

### D5 — Element age is shown, and old elements are refused.

Every prediction screen shows how old its orbital elements are.

| Age | Behaviour |
|---|---|
| < 3 days | Normal |
| 3–14 days | Amber "Elements are N days old" banner |
| > 14 days | Passes still listed, but times marked approximate and the live screen warns before starting |

A prediction is only as good as its elements. Low satellites drift by minutes within a couple of
weeks, and a beginner pointing at the wrong patch of sky concludes the hobby doesn't work.

### D6 — Never hardcode a frequency. Never invent a status.

Frequencies, tones and modes come from the catalog (D4), not from source code. The curated overlay
adds things SatNOGS doesn't have (plain-language notes, difficulty, LoTW name) and may *override*
a transmitter field only with a comment citing where the correction came from.

If something is unknown, the UI says **Unknown**. A satellite whose status we don't have is
*Unknown*, not *Active*. A missing tone is *Unknown*, not blank — blank reads as "no tone needed",
which is a different and wrong instruction.

### D7 — Doppler is computed from range rate; frequencies are integers in Hz.

With range rate `ṙ` (m/s, positive when the satellite is moving away) and `c` = 299 792 458 m/s:

```
downlink you hear:   f_rx = f_down × (1 − ṙ/c)
uplink you send:     f_tx = f_up   / (1 − ṙ/c)    // so the satellite hears f_up
```

Scale: about ±10 kHz on 70 cm and ±3.4 kHz on 2 m over a LEO pass. Store and compute frequencies as
integer Hz; format only at the edge. Floating-point MHz strings (`"436.795"`) never enter the
model.

**FM display:** quantise to the user's radio step (5 kHz default; 2.5 and 6.25 available) and show
a **retune schedule** — "436.805 now → 436.800 at +2:10 → 436.795 at +4:30…". Show the full
schedule before AOS so it can be programmed into memory channels.

The beginner hint follows the rule of thumb: **leave the VHF side alone and tune the UHF side**,
because Doppler on 70 cm is three times larger. The hint is derived from the transmitter bands,
not hardcoded per satellite (it's U/v on some birds).

### D8 — Location stays on the device.

Location comes from the Geolocation API or a manually entered Maidenhead grid. It is stored in
IndexedDB and never sent anywhere. (D1 means there is nowhere to send it — keep it that way when
a server arrives.)

Users can save **multiple locations** (home, the park, a rove grid) and switch between them.
Prediction for a location you aren't at is a first-class feature for rovers.

Grid squares are computed to 6 characters; the 4-character square is what's shown and logged by
default.

### D9 — Horizon mask: 36 numbers per location.

Each saved location carries a minimum elevation for every 10° of azimuth (default all 0°). A pass
is judged on the part of it that clears the mask — "47° max, but only 3 minutes above your
trees".

Setting it: a slider per sector, or **sweep mode** — hold the phone up and pan along the treeline
while the compass and tilt sensor record it (uses D10).

### D10 — Compass: device orientation, declination-corrected, user-calibratable.

- Android/Chrome: `deviceorientationabsolute`. iOS: `deviceorientation` + `webkitCompassHeading`,
  after `DeviceOrientationEvent.requestPermission()` from a user tap.
- Magnetic → true north using a World Magnetic Model implementation.
- A per-device **calibration offset**, set by **sun calibration**: the app computes the sun's
  azimuth, the user lines up the phone with the sun (or its shadow), taps, and the offset is
  stored. This fixes errors that a model can't, such as the phone being clipped to a metal
  antenna boom.
- The compass always shows its accuracy state. A compass that is wrong and confident is worse
  than no compass.

### D11 — Storage: IndexedDB, persistent, exportable.

- All user data in IndexedDB (via `idb`). Call `navigator.storage.persist()` on first log entry.
- **ADIF export** is one tap from the log, and the app nudges for an export after 25 unexported
  contacts. The device is not a backup.
- Recordings are blobs in IndexedDB with a per-recording delete and a storage-used readout.

### D12 — Logging produces LoTW-ready ADIF.

A satellite QSO in ADIF 3.1 carries at least:

`CALL`, `QSO_DATE`, `TIME_ON`, `BAND`, `FREQ`, `BAND_RX`, `FREQ_RX`, `MODE`, `PROP_MODE=SAT`,
`SAT_NAME`, `GRIDSQUARE` (theirs, if given), `MY_GRIDSQUARE`.

`SAT_NAME` must be the name **LoTW** expects, which isn't always the catalog name. It comes from
the overlay (D6) and is a required overlay field for every satellite that has a working uplink.

Times are UTC everywhere in the log. The UI may show local time next to UTC; it never stores it.

### D13 — Pass recording, with timestamps.

`MediaRecorder` on the mic (or a wired line input), started automatically at AOS if the user turned
it on. Each recording stores its start time, so playback shows UTC, and "log at this moment"
pre-fills `TIME_ON` from the playback position.

Constraint: iOS stops recording if the app goes to the background or the screen locks. The live
screen holds a wake lock (D15) and says so plainly if recording was interrupted.

### D14 — Cues are a channel, not a feature of one platform.

Live-pass cues ("Rising in the south-west", "Retune: 436.800", "Elevation 40, peak") go through
one `Cue` interface with three outputs, each feature-detected, never sniffed from the user agent:

| Output | Where it works |
|---|---|
| Speech (`speechSynthesis`) | Everywhere |
| Tones (Web Audio) | Everywhere |
| Vibration (`navigator.vibrate`) | Android only — iOS Safari has no vibration API |

The user chooses which outputs are on. Speech is the default because it's the one that works
everywhere and needs no eyes.

### D15 — The live screen holds a wake lock.

`navigator.wakeLock.request('screen')` from AOS − 2 min to LOS + 1 min, re-acquired on
`visibilitychange`. If the request fails, show "Keep the screen on — your phone may lock" rather
than failing silently. Test in an installed iOS home-screen app specifically; it has been
unreliable there historically.

### D16 — The clock is injectable. Practice mode is the live screen.

Nothing calls `Date.now()` directly. One `Clock` provides time; the live screen, cues, Doppler
and recorder all read it. Practice mode runs a real past or future pass through the **same live
screen** at 1× (or 2×, 4×) on a simulated clock, with a synthetic tone standing in for the
downlink so the user can practise retuning by ear.

No second "practice" UI. If practice and live drift apart, practice stops teaching the real
thing.

### D17 — Reminders without a server: calendar export.

The web has no way to schedule a local notification, and push needs a server (D1). v1 does this
instead:

- **Add to calendar:** a pass (or "all good passes of SO-50 this week") exports as an `.ics` file
  with an alarm at AOS − 5 min and the frequencies, tone and direction in the description. The
  phone's own calendar does the reminding, works on iOS and Android, and works offline.
- **In-app countdown** while the app is open.

Server push is v2 and optional (§8).

### D18 — Radio and rotator control is an adapter, built later.

Not in v1. Code that sets a frequency goes through a `Rig` interface whose v1 implementation is
"display it for a human". A later `HamlibBridgeRig` talks WebSocket to a small bridge on a
laptop or Pi running `rigctld`/`rotctld`.

Known constraints, recorded so nobody rediscovers them:
- iOS has no Web Serial, WebUSB or Web Bluetooth in any browser. Rig control from an iPhone means
  the bridge, or a Capacitor wrapper.
- An HTTPS page cannot open a plain `ws://` connection to a LAN address (mixed content). The bridge
  needs `wss://` with a certificate the device trusts.

### D20 — Miles by default, metric by toggle. Stored in SI.

Distances (range, altitude, footprint radius) display in **miles** by default, with a **Units**
setting for kilometres. Heights display in feet / metres to match. Angles are degrees either way,
and frequencies are never converted.

Everything is **stored and computed in SI** (metres, m/s). Conversion happens only in the display
formatters. A value converted to miles inside a calculation is the bug to look for.

### D19 — Beginner and experienced modes are defaults, not walls.

One setting, **Experience**: *New to satellites* / *I've made contacts*. It changes defaults only:

| | New | Experienced |
|---|---|---|
| Satellites listed | Easy FM birds + receive-only targets | All with a working transponder |
| Pass card | Plain-language note, gear hint | Dense: AOS/TCA/LOS, max el, azimuths, Doppler span |
| Live screen | Big compass, one frequency, spoken cues on | Compass + full retune schedule, cues off |
| First-contact guide | Shown | Hidden in Help |

Everything is reachable in either mode. Nothing is locked.

---

## 4. Data model

TypeScript types. All times are UTC epoch milliseconds; all frequencies are integer Hz (D7).

```ts
// ---- From the published catalog (D4) — read-only on device ----

interface Catalog {
  generatedAt: number;
  satellites: Satellite[];
}

interface Satellite {
  noradId: number;
  name: string;                    // display name, e.g. "SO-50"
  lotwName: string | null;         // D12; null = cannot be logged for LoTW (receive-only)
  status: 'active' | 'inactive' | 'unknown';   // D6 — 'unknown' is a real value
  elements: OmmElements;           // CelesTrak GP, OMM JSON
  elementsEpoch: number;           // for D5
  transmitters: Transmitter[];
  overlay: {
    difficulty: 'beginner' | 'intermediate' | 'advanced' | null;
    note: string | null;           // plain language, one or two sentences
    receiveOnly: boolean;          // listener targets (beacons, ISS APRS/SSTV)
  };
}

interface Transmitter {
  id: string;                      // SatNOGS transmitter UUID
  description: string;
  kind: 'fm_repeater' | 'linear_transponder' | 'beacon' | 'digipeater' | 'other';
  uplinkHz: number | null;         // null when downlink-only
  uplinkHighHz: number | null;     // passband top for linear transponders
  downlinkHz: number | null;
  downlinkHighHz: number | null;
  inverting: boolean | null;       // linear transponders only
  mode: string;                    // 'FM', 'USB', 'CW', 'APRS', 'SSTV'...
  ctcssHz: number | null | 'unknown';   // D6: null = none needed; 'unknown' = we don't know
  status: 'active' | 'inactive' | 'unknown';
}

// ---- On-device, user-owned (IndexedDB) ----

interface Station {
  callsign: string;                     // empty until set; examples and tests use W7LIT
  units: 'imperial' | 'metric';         // D20 — default 'imperial'
  experience: 'new' | 'experienced';    // D19
  radioStepHz: 2500 | 5000 | 6250;      // D7
  cues: { speech: boolean; tones: boolean; vibration: boolean };   // D14
  compassOffsetDeg: number;             // D10
}

interface Location {
  id: string;
  name: string;
  latDeg: number;
  lonDeg: number;
  altM: number;
  grid6: string;
  horizonMask: number[];                // 36 values, index i = azimuth i*10° (D9)
}

interface Pass {                        // computed, cached, never edited
  noradId: number;
  locationId: string;
  aos: number; tca: number; los: number;
  maxElDeg: number;
  aosAzDeg: number; losAzDeg: number;
  visibleSecondsAboveMask: number;      // D9
  elementsEpoch: number;                // D5
}

interface QsoRecord {                   // maps 1:1 onto ADIF (D12)
  id: string;
  call: string;
  timeOn: number;
  satNoradId: number;
  satName: string;                      // LoTW name at time of logging
  transmitterId: string;
  freqHz: number; freqRxHz: number;
  mode: string;
  gridsquare: string | null;
  myGridsquare: string;
  locationId: string;
  recordingId: string | null;           // D13
  exportedAt: number | null;            // D11 nudge
  note: string | null;
}

interface Recording {
  id: string;
  noradId: number;
  startedAt: number;
  durationMs: number;
  interrupted: boolean;                 // D13 — iOS background / lock
  blob: Blob;
}
```

---

## 5. Screens

Three tabs plus the live screen. Designed for sunlight, gloves, and one hand: high contrast, touch
targets ≥ 48 px, primary actions in the bottom third. A **red night mode** for dark sites.

### 5.1 Tonight (home)

- Location chip at the top (tap to switch, D8).
- Next good pass as a large card: satellite, countdown, max elevation, rise/set directions, the
  frequency to start on, tone. "Start" opens the live screen; "Remind me" exports `.ics` (D17).
- Below: a 24 h timeline, one row per satellite, passes as bars whose height is max elevation,
  dimmed where below the horizon mask. Inactive satellites hidden by default; Unknown shown with
  a marker.
- Element-age banner when D5 says so.

### 5.2 Live pass

The screen that matters most.

```
┌───────────────────────────┐
│ SO-50  ▲ 47° max  ⏱ 6:12  │  ← satellite, peak, time to LOS
│        N                  │
│     ·  ·  ●→  ·           │  ← sky plot: track, now, direction
│   W    ( you )     E      │
│        S     AZ 214 EL 38 │  ← big, readable at arm's length
├───────────────────────────┤
│ ↑ 145.850   67.0 Hz       │  ← uplink, tone
│ ↓ 436.800   next ▼ 0:42   │  ← downlink now, next retune
├───────────────────────────┤
│  [ ● REC ]     [ + LOG ]  │  ← thumb zone
└───────────────────────────┘
```

- **Pointing:** sky plot with the pass track, and an **AR toggle** that overlays the satellite's
  position and an arrow on the camera view (D10).
- **Pre-pass:** from AOS − 5 min, shows where it will rise, the full retune schedule, and a
  checklist (tone set, recorder on, antenna polarisation hint).
- **Quick log:** callsign field with a large keypad-style entry, grid optional, time filled in.
  One tap to save; edit later.
- Wake lock (D15), cues (D14), recording (D13).

### 5.3 Map

- Satellite footprint and ground track, live.
- Worked grids shaded (from the log); with a rover location selected, the grids that location's
  footprint covers.
- Offline: vector tiles for the user's region cached on demand. If none are cached, a plain
  graticule with grid squares, which is the part that matters.

### 5.4 Log

- Contacts newest first, filter by satellite.
- Recordings, with "log at this moment" during playback (D13).
- Export ADIF (D11, D12). Unexported count shown.
- **Grids worked** counter, towards VUCC's 100.

### 5.5 Learn (in Help for experienced users)

- **Your first contact:** gear checklist, picking the pass (one tap selects the easiest coming
  one), what to say, etiquette (listen first, callsign and grid, keep it short, never transmit
  without hearing the downlink), what success sounds like.
- **Listen tonight:** receive-only targets with what you'll hear.
- **Practice a pass** (D16).

---

## 6. Offline behaviour

| Need | Offline? |
|---|---|
| App shell | Yes — service worker precache |
| Pass prediction | Yes — catalog in IndexedDB, propagation on device |
| Live screen, cues, compass, recording, logging | Yes |
| Map tiles | Only regions cached in advance; grid overlay always |
| Catalog refresh | Next time online; element age shown meanwhile (D5) |
| ADIF export | Yes — file download or share sheet |

The app must open and be fully usable with networking off after one online visit. That's a test,
not an aim (§10).

---

## 7. Privacy

Nothing user-owned leaves the device in v1. No analytics that carry location or callsign. When a
server arrives (§8), it receives the minimum a feature needs, and the feature is opt-in.

---

## 8. Later (v2+), in rough order

1. **Linear transponders:** passband view showing where your uplink lands in the downlink,
   inverting/non-inverting Doppler, "one true frequency" tracking at the satellite.
2. **Rover alerts and mutual windows:** import rover activations (hams.at) and show passes you
   share with a rover or a named station.
3. **Rig and rotator control** via the bridge (D18).
4. **Optional server:** web push reminders; community "heard it / silent" reports feeding status.
5. **Capacitor wrapper** if radio control from iOS or reliable background behaviour becomes the
   bottleneck. Same codebase.

---

## 9. Milestones

Each one ends with something usable on a phone.

| | Milestone | Done when |
|---|---|---|
| **M1** | Scaffold, catalog, prediction | Installable PWA; the daily Action publishes `catalog.json`; Tonight lists real passes for a manual grid, with element age |
| **M2** | Live pass | Sky plot, look angles, Doppler + FM retune schedule, wake lock, spoken cues, injectable clock |
| **M3** | Practice and first-contact guide | Practice runs any pass through the live screen; Learn tab complete |
| **M4** | Logging | Quick log, Log tab, ADIF export validated against LoTW's TQSL import |
| **M5** | Compass, AR, horizon mask | Calibrated compass incl. sun calibration; AR overlay; mask affects pass ranking |
| **M6** | Recording, calendar export, map | Recording with log-from-playback; `.ics` export; footprint and grid map |

---

## 10. Verification

Tests assert behaviour that would hurt a user if wrong.

- **Prediction** against a reference: for fixed elements, location and time window, AOS/LOS
  within ±2 s and max elevation within ±0.2° of Gpredict or a published reference.
- **Doppler sign:** approaching satellite → received downlink *above* nominal and transmitted
  uplink *below* nominal. The classic bug is flipping one of them.
- **No hardcoded frequencies (D6):** a lint check fails if a frequency-like integer
  (≥ 28 000 000) appears in `src/` outside tests and fixtures.
- **ADIF:** round-trips, carries `PROP_MODE=SAT` and `SAT_NAME`, times in UTC.
- **Offline:** a Playwright test loads the app once, goes offline, reloads, and computes passes.
- **Clock injection (D16):** a lint check fails on `Date.now()` / `new Date()` with no arguments
  in `src/` outside `clock.ts`.

---

## 11. Owner decisions

Settled 2026-10-18:

| Question | Answer |
|---|---|
| Hosting | GitHub Pages now (D2). Vercel + Supabase possible later (D1). |
| Domain | None yet — served from `/passband/` on Pages. |
| Example / test callsign | **W7LIT** — used in examples, fixtures and the LoTW ADIF test (M4). |
| Satellites | Every satellite with a 2 m or 70 cm transmitter (D4). |
| Licence | **MIT** — matches `satellite.js` and most of the JS ecosystem, and keeps a later hosted version simple. |
| Units | Miles by default, kilometres by toggle (D20). |

Still open: a domain, if and when one is wanted.
