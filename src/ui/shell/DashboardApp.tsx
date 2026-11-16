import { Disclaimer } from '../design-system/Disclaimer';
import { ROUTE_LABELS, routeHref, type Route } from '../routing/routes';
import { useHashRoute } from '../routing/useHashRoute';
import { VIEWS } from '../views/views';

const NAV_ROUTES: readonly Route[] = ['today', 'challenge', 'history', 'integrations', 'settings'];

export function DashboardApp({ initialRoute }: { initialRoute: Route }) {
  const route = useHashRoute(initialRoute);
  const View = VIEWS[route];

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span aria-hidden="true" className="size-2 rounded-full bg-accent" />
        <h1 className="text-sm font-semibold tracking-tight">DSA Discipline</h1>
      </header>

      <nav aria-label="Dashboard" className="border-b border-border px-2">
        <ul className="flex overflow-x-auto">
          {NAV_ROUTES.map((r) => {
            const active = r === route;
            return (
              <li key={r} className="flex-1">
                <a
                  href={routeHref(r)}
                  aria-current={active ? 'page' : undefined}
                  className={`block border-b-2 px-1.5 py-2.5 text-center text-[13px] whitespace-nowrap transition-colors ${
                    active
                      ? 'border-accent text-text'
                      : 'border-transparent text-muted hover:text-text'
                  }`}
                >
                  {ROUTE_LABELS[r]}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>

      <main className="flex-1 px-4 py-5">
        <h2 className="sr-only">{ROUTE_LABELS[route]}</h2>
        <View />
      </main>

      <footer className="border-t border-border px-4 py-3">
        <Disclaimer />
      </footer>
    </div>
  );
}
