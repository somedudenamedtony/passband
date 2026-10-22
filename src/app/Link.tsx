// A real link (it can be long-pressed, opened in a tab, read by a screen reader as a link) that
// navigates in-app on a plain click (D22).

import type { MouseEvent, ReactNode } from 'react';
import { href, navigate, type Route } from '../router';

export function Link({ to, children, className, 'aria-label': ariaLabel }: { to: Route; children: ReactNode; className?: string; 'aria-label'?: string }) {
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(to);
  };
  return (
    <a href={href(to)} onClick={onClick} className={className} aria-label={ariaLabel}>
      {children}
    </a>
  );
}
