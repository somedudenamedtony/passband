# Passband v2 — Rebuild specification

**Status:** proposal. When the owner accepts it, this file replaces `SPEC.md` and becomes the source
of truth. Until then `SPEC.md` still governs the running app.

**Why a rebuild.** The engine is sound: prediction, Doppler, the catalog build, ADIF and offline all
work and are tested. What doesn't work is how you move through the app. Today you open a long
scrolling *Tonight* page that holds a pick card, a satellite selector, a list and a timeline. Sheets
open over it (info, settings, locations), and a full-screen live overlay sits on top of those. The
same pass appears in three places, in three shapes. Planning has no home, and logging is a separate
tab with no link to the pass you just worked. v2 keeps the engine and rebuilds everything the
operator touches around one object, **the pass**.

---

## 1. What changes, in one page

| | v1 (today) | v2 |
|---|---|---|
| Central object | The satellite (pick card, selector, info sheet) | **The pass**: one satellite, one window, one place |
| Home | Long page: pick card + selector + list + timeline | **Now**: next pass at a glance, then today's passes as a list you can read in a second |
| Planning | Spread across outlook, timeline, preferred hours and `.ics` | A **Plan** tab: the week ahead, passes you've marked *Going*, conflicts, reminders |
| Logging | Separate Log tab; quick log in the live overlay | Logging belongs to the pass: before (expected), during (one tap), after (review). The Log tab is history |
| Satellites | Scope selector with four lists, paging and activity keys | A **library** you search; ★ *My satellites* decides what Now and Plan show |
| Navigation | Tabs, then stacked sheets, then a modal overlay | Real URLs and a stack: tab → pass → live → review. Back always goes one step back |
| Map, Learn | Their own tabs | Map goes on the pass page and in the Log (grids). Learn moves to help in context and a *First contact* path |
| Settings | A sheet opened from several places | One **Station** screen, reached from the header chip |

The test for every screen: **can someone glance at it, at arm's length, at dusk, and know what to
do next?**

---

## 2. Goals and non-goals

### Goals (v1's goals, kept, in task order)

1. **Glance:** *Is there anything worth working, and when?* Answered on open with zero taps.
2. **Plan:** *Which passes this week am I going to try?* Mark them, get reminded, see clashes.
3. **Work:** *Where do I point, what do I tune, when do I retune?* Through the pass, hands busy.
4. **Log:** *Don't lose a contact.* Log in one tap during the pass and finish afterwards, with ADIF
   that LoTW accepts.
5. **Learn:** get a beginner to a first contact without a mentor. Offer this in context, never as a
   gate.
6. **Offline in the field** as the normal case.

### Non-goals (unchanged from v1)

Native apps, accounts, servers holding user data, CAT/rotator control (designed for, not built),
telemetry decoding, and non-amateur satellites.

---

## 3. Users

The five v1 users, kept: new licensee, listener, grid chaser, rover, linear operator. v2 adds
one framing. Each user does the same four things (glance, plan, work, log) at a different depth.
Depth is set by **what's shown by default**, never by what exists (v1 D19's principle, kept).

---

## 4. Decisions

The v1 decisions are **kept with their numbers** so existing `// D7` comments stay valid, unless
listed here as changed or retired. New decisions start at D22.

### Kept as written

D1 static PWA, no backend · D3 SGP4 in a worker · D4 daily catalog snapshot · D5 element age shown,
old elements refused · D6 no hardcoded frequency or status, Unknown is a value · D7 Doppler from
range rate, integer Hz · D8 location stays on the device · D9 horizon mask · D10 compass ·
D11 IndexedDB, persistent, exportable · D12 LoTW-ready ADIF · D13 recording · D14 cues as a channel ·
D15 wake lock · D16 injectable clock, practice is the live screen · D17 calendar export ·
D18 rig adapter later · D20 store SI, show miles · D21 "will it be on?".

### Changed

**D2 — Vite + React + TypeScript, custom radio-panel UI, *plus a router*.** The radio front-panel
look stays (`theme.css` tokens, LCD readouts, keys). The component set is rebuilt to the screens
below. A router is added (D22). Still no UI library.

**D19 — Guidance level replaces the experience preset.** v1 had experience, goal, radio, and three
overrides that each followed the preset until changed. That was six settings to explain one thing.
v2 has:

- **Goal:** *Listen* · *Make contacts* · *Both*. This decides whether transmit readouts and logging
  appear.
- **Radio:** *FM handheld* · *SSB/CW* · *SDR / receiver* · *Not sure*. This decides which satellites
  are *workable*.
- **Guidance:** *Walk me through it* · *Just the numbers*. This decides tips, the first-contact
  path, and how much the pass page says by default.

Everything else (tracking view, cues, detail level) is remembered from the operator's last choice
on that screen. There is no preset.

### Retired

- **The scope selector** (★ Favorites / Recommended / Available / Full catalog) and its paging and
  activity keys. They are replaced by *My satellites* (D24) and library search (§6.5).
- **The "top pick" card** as a separate object. The next pass on Now is the top pick, ranked by D21
  and shown in the same row shape as every other pass.

### New

**D22 — Every screen has a URL; back is one step.** Hash-free routes under Vite's `base`
(`/passband/now`, `/passband/pass/25544-1761100800000`, …). The service worker serves
`index.html` for every navigation (SPA fallback inside the `/passband/` scope). Browser back, the
edge swipe and the on-screen ← all do the same thing: pop one level. A shared link to a pass opens
that pass, recomputed on the recipient's device for their location (nothing user-owned goes in the
URL; D8). The router is `wouter` (about 2 kB, supports `base`) or an in-house equivalent on the
History API. No nested modals: at most **one** sheet at a time, and a sheet never opens another
sheet.

**D23 — The pass is the unit.** A pass has a stable id: `${noradId}-${aosUtcMs rounded to the
minute}`. Plans, QSOs, recordings and notes all point at a pass id. The pass page is one route that
changes with the clock:

- **Before** (more than 10 minutes to AOS, configurable): plan, prep, set the radio.
- **Soon** (10 minutes to AOS): countdown, checklist, point at the rise azimuth.
- **During** (AOS to LOS): the live view (§6.3).
- **After** (LOS to 2 hours later): review and finish logs.
- **Past:** read-only summary of what happened.

Practice mode (D16) is the same route with a simulated clock.

**D24 — *My satellites* drives the app.** A starred set, stored locally (v1 favorites, kept). On
first run it is filled from the goal and radio answers with satellites that are *on* (D21) and
workable with that radio. Now and Plan show only My satellites by default. One toggle, *Everything
workable*, widens them. The full catalog is reached by search in the library, never as a 300-row
list.

**D25 — A plan is a promise to yourself, kept locally.** Marking a pass *Going* creates a `Plan`
record. Planned passes:

- pin to the top of Now when they're next;
- get an `.ics` entry and an in-app reminder (D17);
- are checked for overlaps (two passes at once) and flagged;
- turn into *Worked*, *Heard*, or *Missed* after LOS, either from the log or from one tap.

That outcome is the operator's history of attempts, not only of contacts.

**D26 — A pass row reads in one second.** Every list in the app that shows passes uses one row
component with fixed slots, left to right:

1. **When:** local start time, big, with a relative label ("in 23 min", "now", "ended").
2. **What:** satellite name and mode chip (FM / SSB/CW / APRS / SSTV / beacon; from `modeGuide`).
3. **How good:** max elevation as a number **and** a three-step quality bar (low / fair / great).
   The thresholds are configurable but have defaults.
4. **Where:** a direction arrow (rise → set compass points, e.g. "SW → NE").
5. **Status:** a single icon for on/off/unknown (D21), with element age only if stale (D5), and
   ★ planned / ✓ worked.

No row wraps to a second line at 360 px wide. Details live on the pass page, not in the row.

**D27 — One app store over IndexedDB.** UI reads state through one store module
(`src/store/`) that wraps the `data/` modules, exposes `useSyncExternalStore` hooks, and owns
cross-cutting derivations (passes for My satellites, plans with outcomes). Screens never call
`idb` or the worker directly. This replaces v1's per-component loading hooks and keeps D1's "a
synced store can replace it later".

---

## 5. Data model

All v1 types are kept (`Satellite`, `Transmitter`, `Catalog`, `Location`, `QsoRecord`, `Recording`,
`Station`) with these changes. Storage is IndexedDB, schema version 4; the v3→v4 upgrade migrates
existing data and loses nothing.

```ts
type PassId = string; // `${noradId}-${aosMinuteUtcMs}` (D23)

interface Pass {             // computed in the worker, never stored as truth
  id: PassId;
  noradId: number;
  aos: number; tca: number; los: number;  // UTC epoch ms (rule 4)
  maxElDeg: number;
  aosAzDeg: number; losAzDeg: number;
  quality: 'low' | 'fair' | 'great';      // D26, from maxElDeg and mask
  elementAgeDays: number;                 // D5
}

interface Plan {             // new store: 'plans', keyPath id = PassId
  id: PassId;
  noradId: number;
  aos: number; los: number;               // copied so the plan survives re-prediction
  locationId: string;
  transmitterId: string | null;           // which mode you mean to work
  note: string;
  outcome: 'planned' | 'worked' | 'heard' | 'missed';
  createdAt: number;
}

interface QsoRecord { /* v1 fields, plus */ passId: PassId | null; }
interface Recording { /* v1 fields, plus */ passId: PassId | null; }

interface Station {
  callsign: string;
  units: 'imperial' | 'metric';            // D20
  goal: 'listen' | 'contacts' | 'both';    // D19
  radio: 'fm' | 'ssb' | 'sdr' | 'unknown'; // D19
  guidance: 'guided' | 'numbers';          // D19
  mySatellites: number[];                  // D24 (was the 'favorites' setting)
  showEverythingWorkable: boolean;         // D24
  qualityThresholdsDeg: { fair: number; great: number };  // D26
  hours: Hours | null;                     // preferred operating hours, kept
  remembered: { liveView: 'sky' | 'compass' | 'ar'; cues: Cues; stepHz: RadioStepHz;
                speakInPass: 'key' | 'all' | 'none'; recordPasses: boolean };
  compassOffsetDeg: number; compassCalibratedAt: number | null;  // D10
}
```

**Migration (v3 → v4).** While the v1 screens still run beside v2 (until R6b), v4 only *adds*: the
`plans` store, and an optional `passId` on QSOs and recordings. The v2 station is saved under its
own `stationV2` key, derived from the v1 station the first time it's read. My satellites stays in
the shared `favorites` setting, so a star set in either app shows in both. The v1 keys are dropped
in R6b. Each v1 value maps as follows (`model/stationV2.ts`):

- `experience: 'new'` becomes `guidance: 'guided'`; `'experienced'` becomes `'numbers'`. An
  explicit `showTips` wins over the preset.
- `goal: 'explore'` becomes `'both'`.
- `equipment` becomes `radio`.
- `favorites` becomes `mySatellites`.
- `showTips`, `compactDetails`, `liveView`, `liveCues` and related fields fold into `remembered`,
  with explicit choices kept.

Since R4, existing QSOs get `passId` back-filled by matching `satNoradId` and `timeOn` against a
re-prediction for their location, where one matches; otherwise `null`. Only contacts from the last
14 days are matched: today's elements no longer place an older pass. In R6b, v1's listening
results (`passResults`) become plan outcomes. A test opens a seeded v3 database in v4
(`data/migration.test.ts`).

---

## 6. Screens

Three tabs, always visible except on the live view: **Now · Plan · Log**. The header shows the active
location (tap to switch) and a station chip (callsign or "Set up"; tap for Station). Search (🔍) in
the header opens the library from anywhere.

```
 Now ─┬─ Pass ── Live ── Review
      └─ Satellite
 Plan ─┬─ Pass …
       └─ Satellite
 Log ──┬─ Contact
       └─ Pass (past)
 Header: Location sheet · Station · Library (search) ─ Satellite
```

### 6.0 First run (four screens, all skippable)

1. **Where are you?** Use location, or enter a grid. Kept from v1 LocationSetup.
2. **What do you want to do?** Listen / Make contacts / Both.
3. **What radio?** FM handheld / SSB/CW / SDR / Not sure.
4. **Callsign** (optional; needed only for logging), and guidance level.

The app lands on Now with My satellites already filled (D24). Without a location, Now shows one
card, *Set your location*, and nothing else.

### 6.1 Now (home)

From top to bottom, nothing scrolls past the second item on a 6.1″ phone until you choose to scroll:

1. **Next up.** The next pass of a planned satellite, or the D21 top pick if none is planned. It is
   one large row (D26 slots, bigger type) with a live countdown and one sentence:
   *"Rises in the SW in 23 min, climbs high, FM voice repeater, on and busy."*
   Its single action changes with the clock: **Prepare** before the pass, **Track** from 10 minutes
   before AOS, **Log** after LOS. Tapping the row opens the pass.
2. **Today.** The rest of the next 24 hours for My satellites as D26 rows, grouped by
   *Tonight / Overnight / Tomorrow* using local time and the sun (`model/sun`). Passes below the
   minimum quality are collapsed into one line, *"4 low passes"*, which opens on tap. Swiping a row,
   or a ★ button for those who don't swipe, marks it *Going* (D25).
3. **Since last time** (only if there is any): the last pass you worked or planned, with its
   outcome, and a *Finish logging* prompt if contacts are incomplete.

Now has no filters, no selector and no timeline. *Everything workable* is a single toggle in the
Today header.

### 6.2 Pass page (`/pass/:passId`)

One screen, in four phases (D23). The top block is the same in every phase:
- satellite name;
- mode chip;
- AOS–LOS in local time, with duration;
- max elevation and quality;
- rise → set direction;
- on/off status with its reason (D21);
- element age (D5).

Below it, depending on phase:

**Before / Soon**
- **Sky track:** a small polar plot of this pass with the mask (D9). A ground-track map of the
  footprint goes here too; this replaces the Map tab.
- **Set your radio:** the `RadioSetup` block (kept), showing the chosen transmitter with nominal
  frequencies, tone, band and mode explainer. If the satellite has several transmitters, a picker
  appears; the choice is saved on the Plan.
- **Plan:** the *Going* toggle, a note, *Add to calendar* (`.ics`) and *Remind me*. An overlap
  warning appears if another planned pass collides.
- **Checklist** (Soon only, and only with guidance on): antenna, battery, tone set, recording on.
- **Practice this pass:** runs it at 10× on a simulated clock (D16).
- **About the satellite →** opens the satellite page.

**During:** the live view (§6.3), full screen.

**After**
- the outcome chips (*Worked / Heard / Missed*);
- the contacts logged during the pass, with any incomplete ones highlighted;
- the recording with timestamps, and log from playback (D13);
- *Add contact*.

**Past:** the same as After, read-only except for editing contacts.

### 6.3 Live view (`/pass/:passId/live`)

The v1 live screen is the strongest part of the app and is kept in substance: sky / compass / AR,
Doppler, retune schedule, spoken cues, wake lock, linear tuner. What changes is the layout, so the
hands-busy operator gets a fixed geography:

```
┌───────────────────────────────┐
│ ←  SO-50   07:42 left   ● REC │  status bar: back, sat, time to LOS, recording
├───────────────────────────────┤
│                               │
│        pointing area          │  sky plot / compass / AR (swipe to switch)
│     az 214°  el 38° ↑         │
│                               │
├───────────────────────────────┤
│ ↓ 436.795  ↑ 145.850  67.0    │  radio strip: corrected Hz, tone; next step flashes
│ next: ↓ 436.790 in 0:40       │
├───────────────────────────────┤
│  [ LOG CONTACT ]   [ CUES ]   │  two big keys, thumb reach
└───────────────────────────────┘
```

The frequencies in the sketch are illustrative; real values come from the catalog (D6).

- **Log contact** stamps the time, satellite, mode and grid at once. Callsign and grid are typed
  now or later; the contact is saved either way. This is v1 quick log, made one tap.
- Leaving the live view early asks nothing; it goes back to the pass page, which is still *During*.
- At LOS the view hands over to the pass page's *After* phase automatically.
- Listen-only goals (D19) remove the uplink, tone and log key; *Heard it* replaces Log.

### 6.4 Plan (`/plan`)

The week ahead for My satellites, so you can decide where your evenings go.

- **Agenda, by day:** D26 rows. Planned passes are ★-marked and pinned within their day. Each day
  header shows sunset and sunrise. Your preferred hours (`Station.hours`) are shaded; passes outside
  them are dimmed, not hidden.
- **Filters** (one row of chips): *Planned only*, *Great only*, a mode chip per mode present, and
  *In my hours*.
- **Clashes:** two planned passes that overlap are marked on both rows.
- **Export:** *Add planned to calendar* exports all planned passes as one `.ics` file (D17).
- **Other location:** the header location switch applies here, so a rover plans from the activation
  site. A planned pass remembers its location.
- **Rover windows:** v1 §8 rover alerts / hams.at stay *later*. The Plan tab is where they will
  land.

v1's timeline is the agenda's alternative view (a toggle), not a separate widget; it comes after R6.
Each day shows planned and fair-or-better passes first, at most twelve before *Show more*, with low
passes folded into one line: a week of everything workable runs to thousands of passes.

### 6.5 Library and satellite page (`/sat/:noradId`)

- **Library:** opened from search. It starts as a search box over My satellites, plus "Suggested
  for your radio" (D21 *on* and workable). Typing searches the full catalog by name, alias, NORAD id
  and mode. Results are compact rows with mode chip, status and ★. There is no paging; the catalog
  is only ever seen through a query.
- **Satellite page:** v1's profile is kept and tidied:
  - photo;
  - who built it and launched it;
  - story and facts at a glance;
  - transmitters, each in `RadioSetup` form;
  - the 14-day activity graph;
  - the AMSAT status reports;
  - *Next passes* (three D26 rows).
  
  ★ adds it to My satellites.

### 6.6 Log (`/log`)

History, grouped by pass, newest first.

- **Pass groups:** a header row (date, satellite, outcome) with its contacts below. Contacts without
  a pass (imported or manual) sit under a day header.
- **Contact (`/log/:qsoId`):** edit any field. `SAT_NAME` is shown as LoTW will see it (D12).
- **Totals strip:** QSOs, grids, DXCC and satellites. Tapping *grids* opens the worked-grid map
  (v1 VUCC + map, merged).
- **Export ADIF** (all, or since the last export), **import ADIF**, and backup/restore of everything
  (D11).
- **Recordings** are listed under their pass, not in a separate section.

### 6.7 Station (`/station`)

One screen, grouped: *You* (callsign, goal, radio, guidance), *Locations* (list, mask editor, default),
*Display* (units, quality thresholds, theme), *Live* (cues, speech, step, recording, compass
calibration), *Data* (backup, restore, storage use, reset). Every row reads as a plain sentence:
"Speak during passes: rise, peak and set only."

### 6.8 Help and the first-contact path

- Every jargon word in the UI (AOS, CTCSS, Doppler, inverting, grid) is a tappable term that opens
  a one-paragraph sheet. This replaces v1's Learn tab content, reorganised by term.
- **First contact** is a five-step path, reachable from Now while the operator has no logged
  contacts and from Station → Help at any time. Its steps: pick an easy FM pass → set the radio →
  practise it → work it → log it. Each step links to the real screen, not to a copy.

---

## 7. Architecture

```
src/
  model/      pure functions, unchanged, all tests kept (orbit, doppler, adif, outlook, …)
  worker/     prediction worker, unchanged API plus pass ids (D23)
  data/       IndexedDB modules, schema v4 + migration (D11)
  store/      NEW: app store, hooks, derivations (D27)
  routes/     NEW: one file per screen in §6
  components/ NEW: PassRow (D26), PassHeader, RadioSetup, SkyTrack, ModeChip, Sheet, Key, Lcd …
  live/       live view pieces kept (SkyPlot, ARView, LinearTuner, PointingGuide), new layout
  theme.css   tokens kept; component styles move next to components
```

- **Kept unchanged:**
  - `model/` (about 30 modules with tests);
  - the worker;
  - `scripts/build-catalog.ts`, `catalog-lib.ts` and the overlay;
  - `deploy.yml`;
  - the `clock.ts` rule;
  - the frequency lint.
- **Rebuilt:** everything in `src/ui/`, plus `App.tsx`, `TabBar`, `Tonight`, `PassCard`, `PassList`,
  `Timeline` and the sheets. Before deleting any v1 component, port its behaviour into the new
  screen or record here that it was dropped.
- **Dropped on purpose:**
  - scope selector and paging;
  - activity keys;
  - `MapView` tab (the map moves to the pass and grid views);
  - `Learn` tab (moved to §6.8);
  - experience presets (D19).

---

## 8. Offline, privacy, accessibility

- **Offline:** v1 §6 kept. Added: deep links work offline because the service worker serves the
  SPA shell for every navigation in scope (D22).
- **Privacy:** v1 §7 kept. Pass ids in URLs contain no location; shared links recompute on the
  recipient's device.
- **Accessibility and field use:**
  - 44 px minimum targets, and 64 px on the live view;
  - every readout survives 200 % text size;
  - contrast is WCAG AA on both themes, checked in CI with axe on each route;
  - the live view is usable one-handed, with all actions in the bottom third;
  - nothing depends on colour alone (quality bars have a step count, and status has an icon shape).

---

## 9. Milestones

Each milestone is one PR, ships to Pages, and leaves the app usable. v1 stays reachable at
`/passband/classic/` until R6b lands, so nothing is lost mid-rebuild.

| | Milestone | Done when |
|---|---|---|
| **R1** | Router, store, schema v4 | Routes for §6 exist as shells; store wraps `data/`; v3→v4 migration tested; deep links work offline |
| **R2** | Now + PassRow + pass page (Before/Soon) | Cold open answers "what's next" with zero taps; pass page shows track, radio setup, plan toggle |
| **R3** | Live view + After phase | The v1 live screen hosted at `/pass/:id/live`, logging with the pass id; practice on the same route; the pass page's After phase (outcome, contacts on the pass, add contact) |
| **R3b** | Live layout | Live view in the §6.3 layout; one-tap log with callsign later; LOS hands over to review |
| **R4** | Log | Pass-grouped history, contact at `/log/:id`, ADIF export/import as in v1, grid map, recordings; recent contacts matched to passes |
| **R5** | Plan | Week agenda, Going/outcomes, clashes, `.ics` for planned passes, location switching |
| **R6a** | Library, satellite page, Station, help | Search over the full catalog, profile page with next passes, one Station screen, v1's Learn as help with the first-contact path |
| **R6b** | Retire v1 | The root becomes Now, `/classic/` and the v1 screens are removed, their e2e tests ported, v1 settings keys dropped; term sheets for jargon |

---

## 10. Verification

Every v1 §10 check is kept: the Doppler sign test, ADIF against LoTW, element-age refusal, the
frequency lint and the clock rule. The new checks are task tests in Playwright, run on a 390×844
viewport with a fixed clock, and each has a **tap budget**:

| Task | Budget |
|---|---|
| Cold open → know the next workable pass (time, direction, mode, on/off) | 0 taps |
| Next pass → radio frequencies for it | 1 tap |
| Mark a pass *Going* and add it to the calendar | 2 taps |
| During a pass → a saved contact | 1 tap (callsign can come later) |
| After LOS → finish a contact's callsign and grid | ≤ 3 taps + typing |
| Find any catalog satellite by name | 1 tap + typing |
| Back from any screen to its tab | 1 back gesture per level, never a dead end |

Plus:
- **Migration:** a v3 database fixture opens in v4 with all QSOs, locations, favorites and station
  choices intact.
- **Row legibility:** a D26 row renders on one line at 360 px for the longest catalog name, with
  truncation tested.
- **Route a11y:** axe passes on every route in both themes.

---

## 11. Open questions for the owner

1. **Tabs:** *Now · Plan · Log* — or should Plan fold into Now as a "This week" section, leaving two
   tabs? (Proposal: three; planning deserves a home.)
2. **Classic mode:** keep v1 at `/classic/` during the rebuild (proposal), or replace it in place?
3. **Quality thresholds:** proposed defaults are *low* under 20°, *fair* 20–45°, *great* over 45°.
   Are those right for an HT and an Arrow?
4. **Reminders:** in-app reminders only work while the app is open (no push without a server, D1).
   Is `.ics` enough, or is Web Push via a free relay worth revisiting as the first crack in D1?
5. **Shared pass links:** worth having in R2, or later?
