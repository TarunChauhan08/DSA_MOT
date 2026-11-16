import { useState } from 'react';
import type { DashboardView } from '../../application/queries';
import { openDashboardSidePanel } from '../../platform/sidePanel';
import { Button } from '../design-system/Button';
import { Disclaimer } from '../design-system/Disclaimer';
import { EmptyState } from '../design-system/EmptyState';
import { ProgressBar } from '../design-system/ProgressBar';
import { Skeleton } from '../design-system/Skeleton';
import { plural } from '../format';
import { useDashboard } from '../hooks/useDashboard';
import { useRefreshOnOpen } from '../hooks/useRefreshOnOpen';
import { penaltyHint } from '../views/penaltyHint';

interface PopupAppProps {
  openDashboard?: () => Promise<void>;
}

function Summary({ view }: { view: DashboardView }) {
  if (!view.hasAnyChallenge) {
    return (
      <EmptyState
        title="No challenge yet"
        description="Open the dashboard to set up your first challenge."
      />
    );
  }
  const { current } = view;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end justify-between">
        <p className="text-3xl font-semibold tabular-nums" aria-label="Solved today">
          {view.todaySolved}
          <span className="text-lg font-normal text-muted"> / {view.todayTarget ?? '—'}</span>
        </p>
        <p className="text-sm text-muted">
          {view.streak.current > 0
            ? `${plural(view.streak.current, 'day')} streak`
            : 'No streak yet'}
        </p>
      </div>
      {view.todayTarget !== null && (
        <ProgressBar value={view.todaySolved} max={view.todayTarget} label="Today's progress" />
      )}
      {current === null ? (
        <p className="text-sm text-muted">No active challenge.</p>
      ) : (
        <>
          <p className="text-sm text-muted">
            Day {current.dayNumber} of {current.planDays} ·{' '}
            {plural(current.graceRemaining, 'grace day')} left · {current.successDays}/
            {current.requiredSuccessDays} full days
          </p>
          <p className="text-sm">{penaltyHint(current.projectedToday)}</p>
        </>
      )}
    </div>
  );
}

export function PopupApp({ openDashboard = openDashboardSidePanel }: PopupAppProps) {
  const state = useDashboard();
  useRefreshOnOpen();
  const [error, setError] = useState<string | null>(null);

  const handleOpen = async () => {
    setError(null);
    try {
      await openDashboard();
      window.close();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not open the dashboard.');
    }
  };

  return (
    <div className="flex w-[340px] flex-col gap-4 p-4">
      <header className="flex items-center gap-2">
        <span aria-hidden="true" className="size-2 rounded-full bg-accent" />
        <h1 className="text-sm font-semibold tracking-tight">DSA Discipline</h1>
      </header>

      {state.status === 'loading' && <Skeleton className="h-20 w-full" />}
      {state.status === 'error' && (
        <p role="alert" className="text-sm text-danger">
          Could not load your data: {state.message}
        </p>
      )}
      {state.status === 'ready' && <Summary view={state.view} />}

      <Button onClick={() => void handleOpen()}>Open dashboard</Button>
      {error !== null && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      <Disclaimer />
    </div>
  );
}
