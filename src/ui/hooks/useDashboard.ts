import { liveQuery } from 'dexie';
import { useEffect, useState } from 'react';
import { loadDashboard, type DashboardView } from '../../application/queries';
import { currentTimeMs } from '../../platform/clock';
import { TEST_CLOCK_ENABLED } from '../../platform/env';
import { uiDb } from '../db';

export type DashboardState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly view: DashboardView }
  | { readonly status: 'error'; readonly message: string };

/** Re-derive at least this often so "today" rolls over at midnight without user action. */
const REFRESH_MS = 60_000;

export function useDashboard(): DashboardState {
  const [state, setState] = useState<DashboardState>({ status: 'loading' });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setTick((t) => t + 1);
    }, REFRESH_MS);
    return () => {
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    const subscription = liveQuery(async () =>
      loadDashboard(uiDb, await currentTimeMs(uiDb, TEST_CLOCK_ENABLED)),
    ).subscribe({
      next: (view) => {
        setState({ status: 'ready', view });
      },
      error: (error: unknown) => {
        console.error('[dsa] dashboard query failed', error);
        setState({
          status: 'error',
          message: error instanceof Error ? error.message : 'Could not load your data.',
        });
      },
    });
    return () => {
      subscription.unsubscribe();
    };
  }, [tick]);

  return state;
}
