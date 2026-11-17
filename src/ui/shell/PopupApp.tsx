import { useState } from 'react';
import type { DashboardView } from '../../application/queries';
import { openDashboardSidePanel } from '../../platform/sidePanel';
import { Button } from '../design-system/Button';
import { DayStrip } from '../design-system/DayStrip';
import { Disclaimer } from '../design-system/Disclaimer';
import { EmptyState } from '../design-system/EmptyState';
import { Skeleton } from '../design-system/Skeleton';
import { useDashboard } from '../hooks/useDashboard';
import { useRefreshOnOpen } from '../hooks/useRefreshOnOpen';
import { useTheme } from '../hooks/useTheme';
import { TodayHero } from '../views/TodayHero';

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
    <div className="flex flex-col gap-4">
      <TodayHero view={view} compact />
      {current === null ? (
        <p className="text-sm text-muted">No active challenge.</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs text-muted">
            Day {current.dayNumber} of {current.planDays}, {current.successDays} of{' '}
            {current.requiredSuccessDays} full days, {current.graceRemaining} grace left
          </p>
          <DayStrip days={current.days} target={current.config.dailyTarget} />
        </div>
      )}
    </div>
  );
}

export function PopupApp({ openDashboard = openDashboardSidePanel }: PopupAppProps) {
  const state = useDashboard();
  useRefreshOnOpen();
  useTheme(state.status === 'ready' ? state.view.settings.theme : 'dark');
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
    <div className="flex w-[360px] flex-col gap-4 p-4">
      <header className="flex items-center gap-2">
        <img src="/icon/32.png" alt="" className="size-4" />
        <h1 className="text-sm font-semibold tracking-tight">DSA Discipline</h1>
      </header>

      {state.status === 'loading' && <Skeleton className="h-24 w-full" />}
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
