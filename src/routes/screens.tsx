// The SPEC-v2 §6 screens, as R1 shells. Each grows into its own file as its milestone lands.

import { Link } from '../app/Link';
import { useAppState } from '../store/store';
import { Placeholder } from './Placeholder';

function useSatName(noradId: number): string {
  return useAppState((s) => s.catalog?.catalog.satellites.find((x) => x.noradId === noradId)?.name ?? `NORAD ${noradId}`);
}

export function PlanScreen() {
  return <Placeholder title="Plan" milestone="R5" />;
}

export function LogScreen() {
  return <Placeholder title="Log" milestone="R4" />;
}

export function ContactScreen({ qsoId }: { qsoId: string }) {
  return <Placeholder title="Contact" milestone="R4"><p className="muted">Contact {qsoId}</p></Placeholder>;
}

export function SatelliteScreen({ noradId }: { noradId: number }) {
  return <Placeholder title={useSatName(noradId)} milestone="R6" />;
}

export function StationScreen() {
  return <Placeholder title="Station" milestone="R6" />;
}

export function NotFoundScreen() {
  return (
    <div className="stack">
      <h1 className="screen-title">Nothing here</h1>
      <p>This address isn’t a Passband screen.</p>
      <Link to={{ name: 'now' }} className="key key-secondary key-block">Go to Now</Link>
    </div>
  );
}
