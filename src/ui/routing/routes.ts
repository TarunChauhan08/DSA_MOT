/** Dashboard routes. Hash-based so every extension page can deep-link (e.g. options → #/settings). */
export const ROUTES = [
  'today',
  'challenge',
  'history',
  'integrations',
  'settings',
  'setup',
] as const;

export type Route = (typeof ROUTES)[number];

export const DEFAULT_ROUTE: Route = 'today';

export const ROUTE_LABELS: Record<Route, string> = {
  today: 'Today',
  challenge: 'Challenge',
  history: 'History',
  integrations: 'Integrations',
  settings: 'Settings',
  setup: 'New challenge',
};

function isRoute(value: string): value is Route {
  return (ROUTES as readonly string[]).includes(value);
}

/** Parses "#/history" → "history". Unknown or empty hashes fall back to `fallback`. */
export function parseRoute(hash: string, fallback: Route = DEFAULT_ROUTE): Route {
  const candidate = hash.replace(/^#\/?/, '').split(/[/?]/)[0] ?? '';
  return isRoute(candidate) ? candidate : fallback;
}

export function routeHref(route: Route): string {
  return `#/${route}`;
}
