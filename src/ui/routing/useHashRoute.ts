import { useEffect, useState } from 'react';
import { parseRoute, type Route } from './routes';

export function useHashRoute(fallback: Route): Route {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash, fallback));

  useEffect(() => {
    const onChange = () => {
      setRoute(parseRoute(window.location.hash, fallback));
    };
    window.addEventListener('hashchange', onChange);
    return () => {
      window.removeEventListener('hashchange', onChange);
    };
  }, [fallback]);

  return route;
}
