import { useState } from 'react';
import { openDashboardSidePanel } from '../../platform/sidePanel';
import { Button } from '../design-system/Button';
import { Disclaimer } from '../design-system/Disclaimer';
import { EmptyState } from '../design-system/EmptyState';

interface PopupAppProps {
  openDashboard?: () => Promise<void>;
}

export function PopupApp({ openDashboard = openDashboardSidePanel }: PopupAppProps) {
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

      <EmptyState
        title="No active challenge"
        description="Open the dashboard to set up your first challenge."
      />

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
