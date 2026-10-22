// D22: the URL decides what's on screen.

import { useRoute } from '../router';
import { Shell } from './Shell';

export function Root() {
  return <Shell route={useRoute()} />;
}
