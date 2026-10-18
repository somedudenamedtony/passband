// §5.3: footprint and ground track, live; worked grids from the log; a rover location's reach.
// Offline by construction: Natural Earth 110m land ships with the app, and the Maidenhead grid —
// the part that matters — is drawn, not fetched.

import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import land110 from 'world-atlas/land-110m.json';
import type { LoadedCatalog } from '../data/catalog';
import { circle, footprintAngle, footprintRadiusM, reachableGrids, splitAtAntimeridian } from '../model/footprint';
import { gridToLatLon, grid4, isValidGrid, toGrid6 } from '../model/grid';
import { listedSatellites, nextGoodPass } from '../model/selection';
import { MINUTE, SECOND } from '../model/time';
import type { Location, QsoRecord, Station } from '../model/types';
import { formatDistance } from '../model/units';
import { groundTrack } from '../predict/client';
import type { GroundPoint } from '../predict/worker';
import { Segmented } from './common';
import { IonItem, IonList, IonNote, IonSelect, IonSelectOption, IonToggle } from '@ionic/react';
import { useNow } from './clock';
import { gridsWorked } from './LogView';
import { usePasses } from './usePasses';

type Ring = Array<[number, number]>; // [lon, lat]

const LAND: Ring[] = (() => {
  const topo = land110 as unknown as Topology<{ land: GeometryCollection }>;
  const fc = feature(topo, topo.objects.land);
  const rings: Ring[] = [];
  for (const f of fc.features) {
    const g = f.geometry;
    if (g.type === 'Polygon') g.coordinates.forEach((r) => rings.push(r as Ring));
    if (g.type === 'MultiPolygon') g.coordinates.forEach((p) => p.forEach((r) => rings.push(r as Ring)));
  }
  return rings;
})();

const ZOOMS = {
  world: { w: 360, h: 180 },
  region: { w: 90, h: 52 },
  local: { w: 30, h: 18 },
} as const;
type Zoom = keyof typeof ZOOMS;

const wrap = (d: number) => ((((d + 180) % 360) + 360) % 360) - 180;

export function MapView({
  catalog,
  location,
  station,
  qsos,
}: {
  catalog: LoadedCatalog;
  location: Location;
  station: Station;
  qsos: QsoRecord[];
}) {
  const now = useNow(1000);
  const sats = useMemo(
    () => listedSatellites(catalog.catalog, station.experience, { showAll: false, showInactive: false }),
    [catalog, station.experience],
  );
  const byId = useMemo(() => new Map(sats.map((s) => [s.noradId, s])), [sats]);
  const { passes } = usePasses(sats, location);
  const [choice, setChoice] = useState<number | null>(null);
  const next = passes ? nextGoodPass(passes, byId, station.experience, now) : null;
  const satId = choice ?? next?.noradId ?? sats[0]?.noradId ?? null;
  const sat = satId === null ? undefined : byId.get(satId);

  const [zoom, setZoom] = useState<Zoom>('world');
  const [showReach, setShowReach] = useState(false);
  const [track, setTrack] = useState<GroundPoint[]>([]);
  const minute = Math.floor(now / (5 * MINUTE));
  useEffect(() => {
    if (!sat) return;
    let cancelled = false;
    const t0 = minute * 5 * MINUTE;
    void groundTrack(sat, t0 - 20 * MINUTE, t0 + 110 * MINUTE, 30 * SECOND).then((pts) => {
      if (!cancelled) setTrack(pts);
    });
    return () => {
      cancelled = true;
    };
  }, [sat, minute]);

  const here = interpolate(track, now);
  const worked = useMemo(() => gridsWorked(qsos), [qsos]);
  // Altitude barely changes for a LEO bird: recompute reach per 50 km, not every second.
  const altBucketM = here ? Math.round(here.altM / 50_000) * 50_000 : null;
  const reach = useMemo(
    () => (showReach && altBucketM !== null ? new Set(reachableGrids(location.latDeg, location.lonDeg, altBucketM)) : null),
    [showReach, location.latDeg, location.lonDeg, altBucketM],
  );

  const { w, h } = ZOOMS[zoom];
  const cLon = location.lonDeg;
  const cLat = zoom === 'world' ? 0 : location.latDeg;
  const x = (lon: number) => wrap(lon - cLon);
  const y = (lat: number) => -lat;
  const viewBox = `${-w / 2} ${-cLat - h / 2} ${w} ${h}`;
  const sw = w / 360; // stroke scale so lines look the same at every zoom

  const pathOf = (pts: ReadonlyArray<[number, number]>) =>
    splitAtAntimeridian(pts.map(([lat, lon]) => [lat, wrap(lon - cLon) + cLon] as [number, number]))
      .map((seg) => seg.map(([lat, lon], i) => `${i ? 'L' : 'M'}${x(lon).toFixed(2)},${y(lat).toFixed(2)}`).join(''))
      .join('');

  const gridRect = (g: string, cls: string, key: string) => {
    const c = gridToLatLon(g);
    return <rect key={key} x={x(c.lonDeg) - 1} y={y(c.latDeg) - 0.5} width={2} height={1} className={cls} />;
  };

  const showSquares = zoom !== 'world';
  const squareLines: ReactElement[] = [];
  if (showSquares) {
    for (let lon = -180; lon < 180; lon += 2) {
      const dx = x(lon);
      if (Math.abs(dx) <= w / 2 + 2) squareLines.push(<line key={`v${lon}`} x1={dx} x2={dx} y1={-90} y2={90} stroke="var(--border)" strokeWidth={0.4 * sw} />);
    }
    for (let lat = -90; lat <= 90; lat += 1) {
      squareLines.push(<line key={`h${lat}`} x1={-w / 2} x2={w / 2} y1={y(lat)} y2={y(lat)} stroke="var(--border)" strokeWidth={0.4 * sw} />);
    }
  }
  const fieldLines: ReactElement[] = [];
  for (let lon = -180; lon < 180; lon += 20) {
    const dx = x(lon);
    fieldLines.push(<line key={`fv${lon}`} x1={dx} x2={dx} y1={-90} y2={90} stroke="var(--muted)" strokeWidth={0.6 * sw} opacity={0.5} />);
  }
  for (let lat = -90; lat <= 90; lat += 10) {
    fieldLines.push(<line key={`fh${lat}`} x1={-w / 2} x2={w / 2} y1={y(lat)} y2={y(lat)} stroke="var(--muted)" strokeWidth={0.6 * sw} opacity={0.5} />);
  }

  const past = track.filter((p) => p.t <= now).map((p) => [p.latDeg, p.lonDeg] as [number, number]);
  const future = track.filter((p) => p.t >= now).map((p) => [p.latDeg, p.lonDeg] as [number, number]);

  return (
    <div className="stack">
      <IonList inset style={{ margin: 0 }}>
        <IonItem lines="none">
          <IonSelect label="Satellite" value={satId ?? undefined} interface="action-sheet" onIonChange={(e) => setChoice(Number(e.detail.value))}>
            {sats.map((s) => (
              <IonSelectOption key={s.noradId} value={s.noradId}>
                {s.name}
              </IonSelectOption>
            ))}
          </IonSelect>
        </IonItem>
      </IonList>
      <Segmented
        label="Zoom"
        value={zoom}
        onChange={setZoom}
        options={[
          { value: 'world', label: 'World' },
          { value: 'region', label: 'Region' },
          { value: 'local', label: 'Local' },
        ]}
      />
      <div>
        <svg viewBox={viewBox} className="map-svg" role="img" aria-label="Map">
          <g fill="var(--bar-dim)" stroke="none">
            {[-360, 0, 360].map((off) => (
              <path
                key={off}
                d={LAND.map((r) => r.map(([lon, lat], i) => `${i ? 'L' : 'M'}${(lon - cLon + off).toFixed(2)},${(-lat).toFixed(2)}`).join('') + 'Z').join('')}
              />
            ))}
          </g>
          {fieldLines}
          {squareLines}
          {reach && [...reach].map((g) => gridRect(g, 'fill-reach', `r${g}`))}
          {[...worked].filter((g) => isValidGrid(g)).map((g) => gridRect(g, 'fill-worked', `w${g}`))}
          {here && (
            <path
              d={pathOf(circle(here.latDeg, here.lonDeg, footprintAngle(here.altM)))}
              fill="none"
              stroke="var(--fg)"
              strokeWidth={1.2 * sw}
            />
          )}
          <path d={pathOf(past)} fill="none" stroke="var(--accent)" strokeWidth={1 * sw} opacity={0.5} />
          <path d={pathOf(future)} fill="none" stroke="var(--accent)" strokeWidth={1.6 * sw} />
          {here && <circle cx={x(here.lonDeg)} cy={y(here.latDeg)} r={5 * sw} fill="var(--fg)" stroke="var(--bg)" strokeWidth={1.5 * sw} aria-label="Satellite" />}
          <circle cx={x(location.lonDeg)} cy={y(location.latDeg)} r={4.5 * sw} fill="var(--accent)" stroke="var(--bg)" strokeWidth={1.5 * sw} aria-label="You" />
          {zoom === 'local' &&
            squareLabels(location, w, h).map(({ g, lat, lon }) => (
              <text key={g} x={x(lon)} y={y(lat)} fontSize={0.35} textAnchor="middle" dominantBaseline="central" fill="var(--muted)">
                {g}
              </text>
            ))}
        </svg>
      </div>
      {sat && here && (
        <p className="tabular" style={{ margin: 0 }}>
          <b>{sat.name}</b> over {grid4(toGrid6(here.latDeg, here.lonDeg))} · {formatDistance(here.altM, station.units)} up ·
          footprint {formatDistance(2 * footprintRadiusM(here.altM), station.units)} across
        </p>
      )}
      <IonList inset style={{ margin: 0 }}>
        <IonItem lines="none">
          <IonToggle checked={showReach} onIonChange={(e) => setShowReach(e.detail.checked)}>
            Grids {location.name} can reach through {sat?.name ?? 'this satellite'}
            <IonNote style={{ display: 'block' }}>Pick a rove location from the location chip to plan an activation.</IonNote>
          </IonToggle>
        </IonItem>
      </IonList>
      <p className="muted" style={{ fontSize: '0.85rem' }}>
        {worked.size} grid{worked.size === 1 ? '' : 's'} worked (dark squares). The map works offline; there are no street-level tiles.
      </p>
    </div>
  );
}

function interpolate(track: readonly GroundPoint[], t: number): GroundPoint | null {
  for (let i = 0; i + 1 < track.length; i++) {
    const a = track[i]!;
    const b = track[i + 1]!;
    if (a.t <= t && t <= b.t) {
      const f = (t - a.t) / (b.t - a.t);
      return { t, latDeg: a.latDeg + (b.latDeg - a.latDeg) * f, lonDeg: wrap(a.lonDeg + wrap(b.lonDeg - a.lonDeg) * f), altM: a.altM + (b.altM - a.altM) * f };
    }
  }
  return null;
}

function squareLabels(loc: Location, w: number, h: number) {
  const out: Array<{ g: string; lat: number; lon: number }> = [];
  for (let lat = Math.floor(loc.latDeg - h / 2); lat <= loc.latDeg + h / 2; lat++) {
    for (let lon = Math.floor((loc.lonDeg - w / 2) / 2) * 2; lon <= loc.lonDeg + w / 2; lon += 2) {
      const g = grid4(toGrid6(lat + 0.5, wrap(lon + 1)));
      out.push({ g, lat: lat + 0.5, lon: lon + 1 });
    }
  }
  return out;
}
