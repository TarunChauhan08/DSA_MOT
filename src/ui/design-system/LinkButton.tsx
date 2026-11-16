import type { ReactNode } from 'react';
import { routeHref, type Route } from '../routing/routes';

export function LinkButton({ to, children }: { to: Route; children: ReactNode }) {
  return (
    <a
      href={routeHref(to)}
      className="inline-flex h-9 items-center rounded-lg bg-accent px-3.5 text-sm font-medium text-accent-contrast hover:bg-accent-strong"
    >
      {children}
    </a>
  );
}
