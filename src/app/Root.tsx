// D22: the URL decides what's on screen. Until R4 the root and /classic/ are the v1 app, and the
// SPEC-v2 screens live at their own paths beside it.

import { useRoute } from '../router';
import { App as Classic } from '../ui/App';
import { Shell } from './Shell';

export function Root() {
  const route = useRoute();
  return route.name === 'classic' ? <Classic /> : <Shell route={route} />;
}
