// R1 shells: each SPEC-v2 §6 screen exists at its URL and says which milestone fills it in.
// Until then the current app is one tap away.

import type { ReactNode } from 'react';
import { Link } from '../app/Link';
import { Panel } from '../ui/common';

export function Placeholder({ title, milestone, children }: { title: string; milestone: string; children?: ReactNode }) {
  return (
    <div className="stack">
      <h1 className="screen-title">{title}</h1>
      {children}
      <Panel>
        <p>
          This screen is part of the Passband rebuild and arrives in {milestone}. Everything works in the current app
          meanwhile.
        </p>
        <Link to={{ name: 'classic' }} className="key key-secondary key-block">
          Open the current app
        </Link>
      </Panel>
    </div>
  );
}
