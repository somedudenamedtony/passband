// SPEC-v2 §6.8: help and the first-contact path. v1's Learn content, hosted here: its "use this
// pass" opens the pass page, and practice runs on the live route (D16).

import { passId } from '../model/passId';
import { toV1Station } from '../model/stationV2';
import { navigate } from '../router';
import { useActiveLocation, useAppState } from '../store/store';
import { Learn } from '../ui/Learn';
import { Gone } from './PassPage';

export function HelpScreen() {
  const catalog = useAppState((s) => s.catalog);
  const station = useAppState((s) => s.station);
  const location = useActiveLocation();
  if (!catalog || !station) return null;
  if (!location) return <Gone title="Help" text="Set where you are on Now first: the guide picks a real pass for you to try." />;
  return (
    <div className="stack">
      <h1 className="screen-title">Help</h1>
      <Learn
        catalog={catalog}
        location={location}
        station={toV1Station(station)}
        onPick={(p) => navigate({ name: 'pass', passId: passId(p.noradId, p.aos) })}
        onPractice={(p) => navigate({ name: 'live', passId: passId(p.noradId, p.aos), practice: true })}
      />
    </div>
  );
}
