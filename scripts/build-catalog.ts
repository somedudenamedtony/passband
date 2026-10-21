// D4: the daily data job. Fetches public satellite data, merges the overlay, writes
// public/catalog.json. Run with `npm run catalog`.

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Catalog, OmmElements } from '../src/model/types.ts';
import {
  AMSAT_HISTORY_DAYS,
  buildCatalog,
  inScopeTransmitter,
  tleToOmm,
  withRetry,
  type AmsatReport,
  type OverlayEntry,
  type SatnogsSatellite,
  type SatnogsTransmitter,
} from './catalog-lib.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'public', 'catalog.json');
const OVERLAY_DIR = join(root, 'data', 'overlay');
const IMAGE_DIR = join(root, 'public', 'sat-images');
const SATNOGS_MEDIA = 'https://db-satnogs.freetls.fastly.net/media/';
/** Photos bigger than this are skipped: the app shouldn't ship a poster for a thumbnail. */
const MAX_IMAGE_BYTES = 400_000;

const CELESTRAK = 'https://celestrak.org/NORAD/elements/gp.php';
const SATNOGS = 'https://db.satnogs.org/api';
const AMSAT_STATUS = 'https://www.amsat.org/status/api/v1/sat_info.php';
const UA = 'passband-catalog/0.1 (+https://github.com/somedudenamedtony/passband)';

const RETRY_DELAYS_MS = [5_000, 20_000];
const TIMEOUT_MS = 60_000;

async function getJson<T>(url: string): Promise<T> {
  return withRetry(
    async () => {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
      return (await res.json()) as T;
    },
    RETRY_DELAYS_MS,
    undefined,
    (err, attempt) => console.warn(`Retrying ${url} (attempt ${attempt + 1}): ${(err as Error).message}`),
  );
}

async function celestrakGroup(group: string): Promise<OmmElements[]> {
  return getJson<OmmElements[]>(`${CELESTRAK}?GROUP=${group}&FORMAT=json`);
}

async function satnogsTle(): Promise<OmmElements[]> {
  const rows = await getJson<Array<{ tle0: string; tle1: string; tle2: string }>>(`${SATNOGS}/tle/?format=json`);
  return rows.map((r) => tleToOmm(r.tle0, r.tle1, r.tle2));
}

/**
 * Recent reports for every overlay satellite AMSAT tracks, one request per AMSAT name, one at a
 * time to stay polite. A satellite whose fetch fails gets null: the app then says the reports are
 * unavailable rather than claiming nobody heard it (D6). The build never fails over this.
 */
async function amsatReports(overlay: OverlayEntry[]): Promise<Map<number, AmsatReport[] | null>> {
  const out = new Map<number, AmsatReport[] | null>();
  for (const o of overlay) {
    if (!o.amsatStatusNames?.length) continue;
    try {
      const rows: AmsatReport[] = [];
      for (const name of o.amsatStatusNames) {
        const q = new URLSearchParams({ name, hours: String(AMSAT_HISTORY_DAYS * 24) });
        rows.push(...(await getJson<AmsatReport[]>(`${AMSAT_STATUS}?${q}`)));
      }
      out.set(o.noradId, rows);
    } catch (err) {
      console.warn(`::warning::AMSAT status unavailable for ${o.name ?? o.noradId} (${(err as Error).message}).`);
      out.set(o.noradId, null);
    }
  }
  return out;
}

/**
 * Photos of the curated satellites, from SatNOGS, saved next to the app so the info sheet never
 * calls out from the browser (D4). Not precached; a missing one just isn't shown.
 */
async function satelliteImages(overlay: OverlayEntry[], sats: SatnogsSatellite[]): Promise<Map<number, string>> {
  await mkdir(IMAGE_DIR, { recursive: true });
  const out = new Map<number, string>();
  for (const o of overlay) {
    const img = sats.find((s) => s.norad_cat_id === o.noradId)?.image;
    const ext = img ? /\.(jpe?g|png|gif|webp)$/i.exec(img)?.[1]?.toLowerCase() : undefined;
    if (!img || !ext) continue;
    try {
      const res = await fetch(SATNOGS_MEDIA + img.split('/').map(encodeURIComponent).join('/'), {
        headers: { 'User-Agent': UA },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (bytes.byteLength > MAX_IMAGE_BYTES) {
        console.log(`Skipping ${o.name ?? o.noradId} photo: ${bytes.byteLength} bytes`);
        continue;
      }
      const file = `${o.noradId}.${ext === 'jpeg' ? 'jpg' : ext}`;
      await writeFile(join(IMAGE_DIR, file), bytes);
      out.set(o.noradId, `sat-images/${file}`);
    } catch (err) {
      console.warn(`No photo for ${o.name ?? o.noradId} (${(err as Error).message}).`);
    }
  }
  return out;
}

/**
 * The catalog currently published, for the activity history (AMSAT only serves 96 hours). From
 * PREVIOUS_CATALOG_URL, set by the deploy workflow; without it the history starts fresh.
 */
async function previousCatalog(): Promise<Catalog | null> {
  const url = process.env.PREVIOUS_CATALOG_URL;
  if (!url) return null;
  try {
    return await getJson<Catalog>(url);
  } catch (err) {
    console.warn(`::warning::No previous catalog (${(err as Error).message}); activity history starts fresh.`);
    return null;
  }
}

async function readOverlay(): Promise<OverlayEntry[]> {
  const files = (await readdir(OVERLAY_DIR)).filter((f) => f.endsWith('.json')).sort();
  const entries: OverlayEntry[] = [];
  for (const f of files) {
    const entry = JSON.parse(await readFile(join(OVERLAY_DIR, f), 'utf8')) as OverlayEntry;
    if (!Number.isInteger(entry.noradId)) throw new Error(`${f}: noradId missing`);
    if (!('lotwName' in entry)) throw new Error(`${f}: lotwName is required (D12)`);
    if (entry.profile && !entry.profile.source) throw new Error(`${f}: profile has no source (D6)`);
    if (entry.amsatStatusNames?.length && !entry.amsatStatusSource) throw new Error(`${f}: amsatStatusNames has no source`);
    for (const o of entry.transmitterOverrides ?? []) {
      if (!o.source) throw new Error(`${f}: override of ${o.id} has no source (D6)`);
    }
    entries.push(entry);
  }
  return entries;
}

async function main() {
  const [satnogsSatellites, satnogsTransmitters, satnogsTles, overlay] = await Promise.all([
    getJson<SatnogsSatellite[]>(`${SATNOGS}/satellites/?format=json`),
    getJson<SatnogsTransmitter[]>(`${SATNOGS}/transmitters/?format=json`),
    satnogsTle(),
    readOverlay(),
  ]);

  // D4 prefers CelesTrak OMM. If CelesTrak can't be reached even after retries, every satellite
  // falls back to its SatNOGS TLE (recorded per satellite as elementsSource) rather than the
  // build failing and the app keeping ever-older elements.
  let elements: OmmElements[] = [];
  try {
    elements = await celestrakGroup('amateur');
    // The scope is set by transmitter frequency, not CelesTrak's grouping, so anything in scope
    // but outside the amateur group is looked up in the active group (one more request).
    const have = new Set(elements.map((e) => Number(e.NORAD_CAT_ID)));
    const wanted = satnogsTransmitters
      .filter(inScopeTransmitter)
      .map((t) => t.norad_cat_id)
      .filter((n): n is number => n !== null);
    if (wanted.some((n) => !have.has(n))) {
      const active = await celestrakGroup('active');
      elements = elements.concat(active.filter((e) => !have.has(Number(e.NORAD_CAT_ID))));
    }
  } catch (err) {
    // A GitHub Actions warning annotation, so a degraded build is visible on the run.
    console.warn(`::warning::CelesTrak unavailable (${(err as Error).message}); using SatNOGS TLEs for all satellites.`);
  }

  const reports = await amsatReports(overlay);
  const images = await satelliteImages(overlay, satnogsSatellites);
  const previous = await previousCatalog();

  const { catalog, report } = buildCatalog({
    generatedAt: Date.now(),
    elements,
    fallbackElements: satnogsTles,
    satnogsSatellites,
    satnogsTransmitters,
    overlay,
    amsatReports: reports,
    images,
    previous,
  });

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(catalog));

  console.log(`Published ${report.published} of ${report.inScope} in-scope satellites.`);
  if (report.fromFallback.length) {
    console.log(`Elements from SatNOGS TLE (not on CelesTrak): ${report.fromFallback.join(', ')}`);
  }
  if (report.missingElements.length) {
    console.log(`No elements for ${report.missingElements.length}: ${report.missingElements.map((m) => m.name).join(', ')}`);
  }
  if (report.uncuratedWithUplink.length) {
    console.log(`Not yet curated, with an active uplink: ${report.uncuratedWithUplink.join(', ')}`);
  }
  if (report.overlayWithoutSatellite.length) {
    console.warn(`Overlay entries with no published satellite: ${report.overlayWithoutSatellite.join(', ')}`);
  }
  if (report.published === 0) throw new Error('Empty catalog; refusing to publish.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
