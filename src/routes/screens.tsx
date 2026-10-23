// The address that isn't a Passband screen.

import { Link } from '../app/Link';

export function NotFoundScreen() {
  return (
    <div className="stack">
      <h1 className="screen-title">Nothing here</h1>
      <p>This address isn’t a Passband screen.</p>
      <Link to={{ name: 'now' }} className="key key-secondary key-block">Go to Now</Link>
    </div>
  );
}
